import { db, auth } from "../../firebaseConfig";
import {
    collection,
    doc,
    getCountFromServer,
    getDocFromServer,
    getDocsFromServer,
    onSnapshot,
    query,
    Timestamp,
    where,
    type DocumentData,
} from "firebase/firestore";
import { decryptField } from "../crypto";
import { getDEK } from "../dekStore";
import { fetchFullIdeaList } from "../idea/helpers";
import type { ChecklistItem, IdeaType } from "../types";
import { applyChanged, estimateServerIds, findOrphans, othersChanged, othersOnly, rebase, shouldPullFull, type DeviceCounters } from "./ops";
import { recordListenerError, recordSnapshot, resetPresence } from "./devicePresence";
import { announceChanges, bindOutbox, enqueue, getDeviceId, pendingOps, registerDevice, setOutboxRefreshHandler, unsyncedOpsSince } from "./outbox";
import { addSyncNotice, emitSyncRefreshed } from "./syncStore";

// Keeps this device's local idea list (localStorage "ideas", which every
// view reads) in step with Firestore:
//   - on load, pulls the server's data only if another device changed
//     something since this one last pulled (one small read otherwise);
//   - while open, listens to meta/sync and pulls again as soon as another
//     device's change counter moves;
//   - never replaces local data unless the server read fully succeeded, and
//     always re-applies this device's unsent changes on top (see rebase).

const IDEAS_KEY = "ideas";
// Which account the local idea list belongs to. Normal sign-out keeps
// localStorage, so without this the next account to sign in on an offline
// device could be shown the previous account's map.
const OWNER_KEY = "sync_owner";
const seenKey = (uid: string) => `sync_seen_${uid}`;
// Written by the previous sync scheme; nothing reads it any more.
const LEGACY_SYNC_KEY = "sync_lastModified";

// Kill switch for the incremental pull: false = every pull reads every idea,
// exactly as before. (Setting localStorage "sync_force_full" to "1" does the
// same for one browser, without a deploy.)
const INCREMENTAL_PULL = true;
const FORCE_FULL_KEY = "sync_force_full";
// Where the last pull left off: the newest `updatedAt` it saw, per account.
const watermarkKey = (uid: string) => `sync_wm_${uid}`;
const lastFullKey = (uid: string) => `sync_lastfull_${uid}`;
// Two writes committing at nearly the same moment can become visible out of
// order, so each incremental query starts a little before the watermark.
// Re-reading an idea twice is harmless.
const WATERMARK_OVERLAP_S = 5;

interface Watermark {
    s: number;
    n: number;
}

function getWatermark(uid: string): Watermark | null {
    try {
        const parsed = JSON.parse(localStorage.getItem(watermarkKey(uid)) ?? "null") as Watermark | null;
        return parsed && Number.isFinite(parsed.s) && Number.isFinite(parsed.n) ? parsed : null;
    } catch {
        return null;
    }
}

function getLastFullAt(uid: string): number | null {
    const raw = Number(localStorage.getItem(lastFullKey(uid)));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
}

// Newest `updatedAt` among docs that have one. Docs saved before the field
// existed simply don't count.
function newestStamp(docs: DocumentData[], floor: Watermark | null): Watermark | null {
    let best = floor;
    for (const data of docs) {
        const stamp = data.updatedAt;
        if (!(stamp instanceof Timestamp)) continue;
        if (!best || stamp.seconds > best.s || (stamp.seconds === best.s && stamp.nanoseconds > best.n)) {
            best = { s: stamp.seconds, n: stamp.nanoseconds };
        }
    }
    return best;
}

function syncDocRef(uid: string) {
    return doc(db, "users", uid, "meta", "sync");
}

function readDevices(data: DocumentData | undefined): DeviceCounters {
    const devices = data?.devices;
    return devices && typeof devices === "object" ? (devices as DeviceCounters) : {};
}

function getSeen(uid: string): DeviceCounters | null {
    try {
        const raw = localStorage.getItem(seenKey(uid));
        return raw ? (JSON.parse(raw) as DeviceCounters) : null;
    } catch {
        return null;
    }
}

// `locked` is the field's name before it was renamed to `censored`.
function isCensored(data: DocumentData): boolean {
    return data.censored === true || data.locked === true;
}

// Decrypts one idea doc. Throws on anything malformed so the caller can skip
// just this doc — a single unreadable idea must never hide all the others.
async function decodeIdea(data: DocumentData, dek: CryptoKey): Promise<IdeaType> {
    if (typeof data.id !== "number" || typeof data.parentID !== "number") {
        throw new Error("Idea document is missing its id or parentID.");
    }
    if (data.type === "checklist") {
        return {
            id: data.id,
            type: "checklist",
            content: await decryptField(data.content as string, dek),
            parentID: data.parentID,
            items: await Promise.all(
                ((data.items ?? []) as ChecklistItem[]).map(async (item) => {
                    const result: ChecklistItem = { id: item.id, text: await decryptField(item.text, dek), checked: item.checked };
                    if (item.link) result.link = await decryptField(item.link, dek);
                    return result;
                })
            ),
            ...(data.priority !== undefined ? { priority: data.priority as 1 | 2 | 3 } : {}),
            ...(isCensored(data) ? { censored: true } : {}),
        };
    }
    return {
        id: data.id,
        content: await decryptField(data.content as string, dek),
        parentID: data.parentID,
        link: await decryptField(data.link as string | null | undefined, dek),
        ...(data.priority !== undefined ? { priority: data.priority as 1 | 2 | 3 } : {}),
        ...(isCensored(data) ? { censored: true } : {}),
        ...(data.isNote !== undefined ? { isNote: data.isNote as boolean } : {}),
        ...(data.noteTitle !== undefined ? { noteTitle: await decryptField(data.noteTitle as string, dek) } : {}),
    };
}

async function pullFromServer(uid: string): Promise<boolean> {
    const startedAt = Date.now();
    try {
        const syncSnap = await getDocFromServer(syncDocRef(uid));
        const devices = readDevices(syncSnap.data());
        // FromServer on purpose: plain getDocs() quietly answers from the
        // (empty, in-memory) cache while offline, which looks exactly like
        // "this account has no ideas". This throws instead.
        const snapshot = await getDocsFromServer(collection(db, "users", uid, "ideas"));
        const dek = getDEK();

        const decoded = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
                try {
                    const data = docSnap.data();
                    return { ok: true as const, idea: await decodeIdea(data, dek), legacyName: data.locked !== undefined };
                } catch (error) {
                    console.error(`Sync: couldn't read idea ${docSnap.id}.`, error);
                    return { ok: false as const, docId: Number(docSnap.id) };
                }
            })
        );

        // Signed out or switched account while this was loading — the
        // result belongs to someone who isn't here any more.
        if (auth.currentUser?.uid !== uid) return false;

        // ── Nothing below awaits: reading local state, rebasing and writing
        // it back happens in one synchronous step, so no local edit can slip
        // in between and be overwritten. ──
        const serverIdeas: IdeaType[] = [];
        const skippedIds: number[] = [];
        const legacyCensor: IdeaType[] = [];
        for (const result of decoded) {
            if (result.ok) {
                serverIdeas.push(result.idea);
                if (result.legacyName) legacyCensor.push(result.idea);
            }
            else skippedIds.push(result.docId);
        }

        // An idea the server has but this device can't read: keep the copy
        // this device already had (if it had one) rather than making it
        // vanish.
        const ownsLocal = localStorage.getItem(OWNER_KEY) === uid;
        const local = ownsLocal ? fetchFullIdeaList() : [];
        const keptLocal = local.filter((idea) => skippedIds.includes(idea.id));

        const merged = rebase([...serverIdeas, ...keptLocal], unsyncedOpsSince(startedAt));

        // A full read: the next incremental pull starts from the newest
        // stamp it saw (none yet = the next pull is full again).
        const stamp = newestStamp(snapshot.docs.map((docSnap) => docSnap.data()), null);
        if (stamp) localStorage.setItem(watermarkKey(uid), JSON.stringify(stamp));
        else localStorage.removeItem(watermarkKey(uid));
        localStorage.setItem(lastFullKey(uid), String(Date.now()));

        // Orphans only when every doc was readable — otherwise an idea whose
        // parent merely failed to decrypt would look orphaned and get moved.
        finishPull(uid, devices, merged, legacyCensor, skippedIds.length === 0);
        return true;
    } catch (error) {
        // Offline, or the read failed — local data is left exactly as it was.
        console.error("Sync: couldn't load ideas from the server.", error);
        return false;
    }
}

// The synchronous tail shared by both pulls: fixes orphans, stores the
// result, and tells the app to re-read.
function finishPull(uid: string, devices: DeviceCounters, list: IdeaType[], legacyCensor: IdeaType[], fixOrphans: boolean): void {
    let merged = list;
    const orphans = fixOrphans ? findOrphans(merged) : [];
    if (orphans.length > 0) {
        const orphanIds = new Set(orphans.map((idea) => idea.id));
        merged = merged.map((idea) => (orphanIds.has(idea.id) ? { ...idea, parentID: 1 } : idea));
    }

    localStorage.setItem(IDEAS_KEY, JSON.stringify(merged));
    localStorage.setItem(seenKey(uid), JSON.stringify(othersOnly(devices, getDeviceId())));
    localStorage.setItem(OWNER_KEY, uid);

    // Ideas saved with the old field name get the new one (and lose the old) once.
    legacyCensor.forEach((idea) => enqueue({ kind: "update", id: idea.id, patch: { censored: idea.censored ? true : null } }));
    orphans.forEach((idea) => enqueue({ kind: "update", id: idea.id, patch: { parentID: 1 } }));
    if (orphans.length > 0) {
        addSyncNotice(
            orphans.length === 1
                ? "Moved 1 idea whose parent had been deleted to your top level."
                : `Moved ${orphans.length} ideas whose parent had been deleted to your top level.`
        );
    }
    emitSyncRefreshed();
}

// Reads only the ideas changed since the last pull, instead of all of them.
// Returns "fallback" whenever it can't be certain it saw everything; the
// caller then does the full pull, so the worst case is today's cost.
//
// Deletions can't show up in a "changed since" query, so the server's idea
// count is compared with what this device expects the server to hold. Every
// delete makes the server's number smaller than the expected one, and a
// racing write makes them differ too, so any mismatch means "do the full pull".
async function pullIncremental(uid: string): Promise<boolean | "fallback"> {
    const watermark = getWatermark(uid);
    if (!watermark) return "fallback";
    const startedAt = Date.now();
    try {
        // Counters first, as in the full pull, so nothing is marked "seen"
        // that the reads below might not include.
        const syncSnap = await getDocFromServer(syncDocRef(uid));
        const devices = readDevices(syncSnap.data());

        const ideasRef = collection(db, "users", uid, "ideas");
        const since = new Timestamp(watermark.s - WATERMARK_OVERLAP_S, watermark.n);
        const [changedSnap, countSnap] = await Promise.all([
            getDocsFromServer(query(ideasRef, where("updatedAt", ">", since))),
            getCountFromServer(ideasRef),
        ]);
        const dek = getDEK();

        const changed: IdeaType[] = [];
        const legacyCensor: IdeaType[] = [];
        for (const docSnap of changedSnap.docs) {
            try {
                const data = docSnap.data();
                const idea = await decodeIdea(data, dek);
                changed.push(idea);
                if (data.locked !== undefined) legacyCensor.push(idea);
            } catch (error) {
                console.error(`Sync: couldn't read idea ${docSnap.id}.`, error);
                return "fallback";
            }
        }

        if (auth.currentUser?.uid !== uid) return false;

        // ── Nothing below awaits (see pullFromServer). ──
        if (localStorage.getItem(OWNER_KEY) !== uid) return "fallback";
        const local = fetchFullIdeaList();
        const expected = estimateServerIds(
            local.map((idea) => idea.id),
            pendingOps()
        );
        changed.forEach((idea) => expected.add(idea.id));
        if (expected.size !== countSnap.data().count) return "fallback";

        const merged = rebase(applyChanged(local, changed), unsyncedOpsSince(startedAt));
        // This pull only saw part of the data, so an idea that looks parentless
        // may just have a parent it hasn't seen. Never move anything on that
        // evidence: the full pull sees everything and decides.
        if (findOrphans(merged).length > 0) return "fallback";
        const stamp = newestStamp(
            changedSnap.docs.map((docSnap) => docSnap.data()),
            watermark
        );
        if (stamp) localStorage.setItem(watermarkKey(uid), JSON.stringify(stamp));
        finishPull(uid, devices, merged, legacyCensor, true);
        return true;
    } catch (error) {
        // Offline or a failed read: same as the full pull, local data stays.
        console.error("Sync: couldn't load changes from the server.", error);
        return false;
    }
}

// Incremental when every precondition holds, the full pull otherwise (and
// whenever the incremental one isn't sure).
async function pull(uid: string, forceFull: boolean): Promise<boolean> {
    const full = shouldPullFull({
        enabled: INCREMENTAL_PULL,
        forced: forceFull || localStorage.getItem(FORCE_FULL_KEY) === "1",
        ownsLocal: localStorage.getItem(OWNER_KEY) === uid,
        hasLocal: localStorage.getItem(IDEAS_KEY) !== null,
        hasWatermark: getWatermark(uid) !== null,
        lastFullAt: getLastFullAt(uid),
        now: Date.now(),
    });
    if (!full) {
        const result = await pullIncremental(uid);
        if (result !== "fallback") return result;
    }
    return pullFromServer(uid);
}

let refreshing: Promise<boolean> | null = null;
let rerunRequested = false;
let fullRequested = false;

// Pulls the server's data now. Coalesces: a request made while a pull is
// running schedules exactly one more pull afterwards, so a burst of
// listener events costs at most two pulls. `full` forces a read of every
// idea (used when something is known to be out of step).
export function requestRefresh(options: { full?: boolean } = {}): Promise<boolean> {
    const uid = auth.currentUser?.uid;
    if (!uid) return Promise.resolve(false);
    if (options.full) fullRequested = true;
    if (refreshing) {
        rerunRequested = true;
        return refreshing;
    }
    refreshing = (async () => {
        let ok = false;
        do {
            rerunRequested = false;
            const forceFull = fullRequested;
            fullRequested = false;
            ok = await pull(uid, forceFull);
        } while (rerunRequested && auth.currentUser?.uid === uid);
        return ok;
    })().finally(() => {
        refreshing = null;
    });
    return refreshing;
}

// The outbox asks for a refresh after a change hit a deleted idea or the user
// discarded a refused one: the local copy is known to be off, so read it all.
setOutboxRefreshHandler(() => {
    void requestRefresh({ full: true });
});

// A different account's map is on this device: drop it. (A missing owner is a
// device from before this existed — its data is the current user's as far as
// anyone can tell, so it's kept.) Also called at sign-in, so /main never
// paints the previous account's map while the first pull is still running.
export function discardForeignIdeas(uid: string): void {
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner !== null && owner !== uid) localStorage.removeItem(IDEAS_KEY);
}

// Called once when the app opens for a signed-in user. Resolves with
// serverOk = false when the server couldn't be reached — the local list
// (whatever this device last had) is left in place, never emptied.
export async function syncOnLoad(uid: string): Promise<{ serverOk: boolean }> {
    localStorage.removeItem(LEGACY_SYNC_KEY);

    const owner = localStorage.getItem(OWNER_KEY);
    discardForeignIdeas(uid);

    // Sends anything this account left unsent on this device last time.
    bindOutbox(uid);

    try {
        const snap = await getDocFromServer(syncDocRef(uid));
        const needsPull =
            owner !== uid ||
            localStorage.getItem(IDEAS_KEY) === null ||
            othersChanged(readDevices(snap.data()), getSeen(uid), getDeviceId());
        if (!needsPull) return { serverOk: true };
        return { serverOk: await requestRefresh() };
    } catch (error) {
        console.error("Sync: couldn't reach the server; showing this device's copy.", error);
        return { serverOk: false };
    }
}

// A pull re-reads every idea doc, so another device's edits are pulled
// in only once they pause for this long — not once per keystroke-level
// change while someone is actively editing elsewhere.
const REMOTE_PULL_DEBOUNCE_MS = 3000;

// Live cross-device updates: meta/sync changes on every write from any
// device, and each device only bumps its own counter, so a change to anyone
// else's means there's something new to pull. This device's own writes
// never trigger a pull.
//
// Pulls only while this tab/app is visible: a backgrounded device (the
// usual case — people use one device at a time) makes exactly one pull when
// it's brought back, the same read cost as the old "check on load", instead
// of one full pull per edit made elsewhere in the meantime.
export function startSyncListener(uid: string): () => void {
    let pullTimer: ReturnType<typeof setTimeout> | null = null;
    let pullWanted = false;

    const pullWhenVisible = () => {
        if (!pullWanted || document.visibilityState !== "visible") return;
        if (pullTimer) clearTimeout(pullTimer);
        pullTimer = setTimeout(() => {
            pullTimer = null;
            pullWanted = false;
            void requestRefresh();
        }, REMOTE_PULL_DEBOUNCE_MS);
    };

    const onVisibility = () => {
        if (document.visibilityState === "visible") pullWhenVisible();
        else if (pullTimer) {
            // Went to the background before the pull fired — pull on return.
            clearTimeout(pullTimer);
            pullTimer = null;
        }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const unsubscribe = onSnapshot(
        syncDocRef(uid),
        (snap) => {
            const devices = readDevices(snap.data());
            // Cached snapshots may be stale; only act on what the server says.
            const { newDevices, needsRegister } = recordSnapshot(devices, getDeviceId(), snap.metadata.fromCache);
            if (snap.metadata.fromCache) return;
            if (needsRegister) void registerDevice(uid);
            // A device just appeared: tell it about anything changed while
            // this one thought it was alone (writes skip the bump until then).
            if (newDevices.length > 0) void announceChanges(uid);
            if (othersChanged(devices, getSeen(uid), getDeviceId())) {
                pullWanted = true;
                pullWhenVisible();
            }
        },
        (error) => {
            recordListenerError();
            console.error("Sync: live updates stopped.", error);
        }
    );

    return () => {
        resetPresence();
        unsubscribe();
        document.removeEventListener("visibilitychange", onVisibility);
        if (pullTimer) clearTimeout(pullTimer);
    };
}
