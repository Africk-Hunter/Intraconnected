import { db, auth } from "../../firebaseConfig";
import { collection, doc, getDocFromServer, getDocsFromServer, onSnapshot, type DocumentData } from "firebase/firestore";
import { decryptField } from "../crypto";
import { getDEK } from "../dekStore";
import { fetchFullIdeaList } from "../idea/helpers";
import type { ChecklistItem, IdeaType } from "../types";
import { findOrphans, othersChanged, othersOnly, rebase, type DeviceCounters } from "./ops";
import { bindOutbox, enqueue, getDeviceId, setOutboxRefreshHandler, unsyncedOpsSince } from "./outbox";
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
        };
    }
    return {
        id: data.id,
        content: await decryptField(data.content as string, dek),
        parentID: data.parentID,
        link: await decryptField(data.link as string | null | undefined, dek),
        ...(data.priority !== undefined ? { priority: data.priority as 1 | 2 | 3 } : {}),
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
                    return { ok: true as const, idea: await decodeIdea(docSnap.data(), dek) };
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
        for (const result of decoded) {
            if (result.ok) serverIdeas.push(result.idea);
            else skippedIds.push(result.docId);
        }

        // An idea the server has but this device can't read: keep the copy
        // this device already had (if it had one) rather than making it
        // vanish.
        const ownsLocal = localStorage.getItem(OWNER_KEY) === uid;
        const local = ownsLocal ? fetchFullIdeaList() : [];
        const keptLocal = local.filter((idea) => skippedIds.includes(idea.id));

        let merged = rebase([...serverIdeas, ...keptLocal], unsyncedOpsSince(startedAt));

        // Only when every doc was readable — otherwise an idea whose parent
        // merely failed to decrypt would look orphaned and get moved.
        const orphans = skippedIds.length === 0 ? findOrphans(merged) : [];
        if (orphans.length > 0) {
            const orphanIds = new Set(orphans.map((idea) => idea.id));
            merged = merged.map((idea) => (orphanIds.has(idea.id) ? { ...idea, parentID: 1 } : idea));
        }

        localStorage.setItem(IDEAS_KEY, JSON.stringify(merged));
        localStorage.setItem(seenKey(uid), JSON.stringify(othersOnly(devices, getDeviceId())));
        localStorage.setItem(OWNER_KEY, uid);

        orphans.forEach((idea) => enqueue({ kind: "update", id: idea.id, patch: { parentID: 1 } }));
        if (orphans.length > 0) {
            addSyncNotice(
                orphans.length === 1
                    ? "Moved 1 idea whose parent had been deleted to your top level."
                    : `Moved ${orphans.length} ideas whose parent had been deleted to your top level.`
            );
        }
        emitSyncRefreshed();
        return true;
    } catch (error) {
        // Offline, or the read failed — local data is left exactly as it was.
        console.error("Sync: couldn't load ideas from the server.", error);
        return false;
    }
}

let refreshing: Promise<boolean> | null = null;
let rerunRequested = false;

// Pulls the server's data now. Coalesces: a request made while a pull is
// running schedules exactly one more pull afterwards, so a burst of
// listener events costs at most two full reads.
export function requestRefresh(): Promise<boolean> {
    const uid = auth.currentUser?.uid;
    if (!uid) return Promise.resolve(false);
    if (refreshing) {
        rerunRequested = true;
        return refreshing;
    }
    refreshing = (async () => {
        let ok = false;
        do {
            rerunRequested = false;
            ok = await pullFromServer(uid);
        } while (rerunRequested && auth.currentUser?.uid === uid);
        return ok;
    })().finally(() => {
        refreshing = null;
    });
    return refreshing;
}

setOutboxRefreshHandler(() => {
    void requestRefresh();
});

// Called once when the app opens for a signed-in user. Resolves with
// serverOk = false when the server couldn't be reached — the local list
// (whatever this device last had) is left in place, never emptied.
export async function syncOnLoad(uid: string): Promise<{ serverOk: boolean }> {
    localStorage.removeItem(LEGACY_SYNC_KEY);

    const owner = localStorage.getItem(OWNER_KEY);
    // A different account's map is on this device. (A missing owner is a
    // device from before this existed — its data is the current user's as
    // far as anyone can tell, so it's kept.)
    if (owner !== null && owner !== uid) localStorage.removeItem(IDEAS_KEY);

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
            // Cached snapshots may be stale; only act on what the server says.
            if (snap.metadata.fromCache) return;
            if (othersChanged(readDevices(snap.data()), getSeen(uid), getDeviceId())) {
                pullWanted = true;
                pullWhenVisible();
            }
        },
        (error) => console.error("Sync: live updates stopped.", error)
    );

    return () => {
        unsubscribe();
        document.removeEventListener("visibilitychange", onVisibility);
        if (pullTimer) clearTimeout(pullTimer);
    };
}
