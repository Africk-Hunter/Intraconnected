import { db, auth } from "../../firebaseConfig";
import { collection, deleteField, doc, increment, writeBatch, type FieldValue } from "firebase/firestore";
import { encryptField } from "../crypto";
import { getDEK } from "../dekStore";
import { getCachedBillingStatus } from "../firebase/firebaseHelpers";
import type { ChecklistItem, IdeaType } from "../types";
import { classifyError, coalesce, opIds, withoutDependents, type IdeaPatch, type QueuedOp, type SyncOp } from "./ops";
import { updateSyncStatus, type SyncFailure } from "./syncStore";

// The only path idea writes take to Firestore. Every change is recorded in
// localStorage *before* it's sent and removed only once the server has
// accepted it, so nothing is lost to a closed tab, a reload while offline,
// or a sign-out mid-save; changes go out one at a time, in the order they
// were made, so a create can never land after its own delete.
//
// Keyed by uid: one account's unsent changes are never sent under another
// account that signs in on the same browser — they wait for their owner.

const DEVICE_KEY = "sync_device_id";
const outboxKey = (uid: string) => `sync_outbox_${uid}`;

// How long an accepted change stays available for syncEngine's rebase — a
// refresh whose server read raced this change's write still shows it.
const ACKED_RETENTION_MS = 5 * 60 * 1000;
const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60_000;

interface FailedOp {
    entry: QueuedOp;
    failure: SyncFailure;
}

interface PersistedOutbox {
    queue: QueuedOp[];
    failed: FailedOp | null;
    nextSeq: number;
}

let boundUid: string | null = null;
// Bumped on every rebind — a send still in flight for a previous account
// sees the mismatch when it resumes and bows out without touching state.
let generation = 0;
let queue: QueuedOp[] = [];
let failed: FailedOp | null = null;
let nextSeq = 1;
let inFlightSeq: number | null = null;
let pumping = false;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = 0;
let acked: { op: SyncOp; ackedAt: number }[] = [];
const drainWaiters = new Set<() => void>();

// Set by syncEngine — called when a change turned out to target an idea
// that no longer exists, or after the user discards a refused change, so
// the local view is rebuilt from the server.
let refreshHandler: (() => void) | null = null;
export function setOutboxRefreshHandler(handler: () => void): void {
    refreshHandler = handler;
}

export function getDeviceId(): string {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
        id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
}

function load(uid: string): PersistedOutbox {
    try {
        const raw = localStorage.getItem(outboxKey(uid));
        if (raw) {
            const parsed = JSON.parse(raw) as PersistedOutbox;
            if (Array.isArray(parsed.queue)) return parsed;
        }
    } catch {
        console.error("Sync: the saved outbox was unreadable and has been reset.");
    }
    return { queue: [], failed: null, nextSeq: 1 };
}

function persist(): void {
    if (!boundUid) return;
    try {
        localStorage.setItem(outboxKey(boundUid), JSON.stringify({ queue, failed, nextSeq } satisfies PersistedOutbox));
    } catch (error) {
        // Still held in memory and sent this session; only reload-survival
        // is lost (e.g. storage full).
        console.error("Sync: couldn't save pending changes to this device.", error);
    }
}

function publish(): void {
    updateSyncStatus({
        pendingCount: queue.length,
        oldestPendingAt: queue.length ? Math.min(...queue.map((entry) => entry.queuedAt)) : null,
        failure: failed?.failure ?? null,
    });
}

// Switches to `uid`'s outbox (loading whatever it left unsent) and starts
// sending. A no-op if already bound to that account.
export function bindOutbox(uid: string): void {
    if (boundUid === uid) return;
    generation++;
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = null;
    pumping = false;
    inFlightSeq = null;
    backoffMs = 0;
    acked = [];
    boundUid = uid;
    const saved = load(uid);
    queue = saved.queue;
    failed = saved.failed;
    nextSeq = saved.nextSeq;
    publish();
    pump();
}

// Records `op` and schedules it to be sent. Synchronous on purpose: by the
// time this returns the change is on disk, so callers that update the local
// idea list right after can never race it.
export function enqueue(op: SyncOp, options: { debounceMs?: number } = {}): void {
    const uid = auth.currentUser?.uid;
    if (!uid) {
        console.error("Sync: not signed in — change was not queued.");
        return;
    }
    bindOutbox(uid);
    const now = Date.now();
    const entry: QueuedOp = { seq: nextSeq++, op, notBefore: options.debounceMs ? now + options.debounceMs : 0, queuedAt: now };
    queue = options.debounceMs ? coalesce(queue, entry, inFlightSeq) : [...queue, entry];
    persist();
    publish();
    pump();
}

// enqueue() for many ops at once (an import): same ordering and sending,
// but the queue is saved once rather than once per op.
export function enqueueMany(ops: SyncOp[]): void {
    const uid = auth.currentUser?.uid;
    if (!uid) {
        console.error("Sync: not signed in — changes were not queued.");
        return;
    }
    if (ops.length === 0) return;
    bindOutbox(uid);
    const now = Date.now();
    queue = [...queue, ...ops.map((op) => ({ seq: nextSeq++, op, notBefore: 0, queuedAt: now }))];
    persist();
    publish();
    pump();
}

function scheduleWake(ms: number): void {
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = setTimeout(() => {
        wakeTimer = null;
        pump();
    }, ms);
}

function pump(): void {
    if (pumping || !boundUid || failed) return;
    if (wakeTimer) {
        clearTimeout(wakeTimer);
        wakeTimer = null;
    }
    pumping = true;
    void drain(generation, boundUid);
}

function removeEntry(seq: number): void {
    queue = queue.filter((entry) => entry.seq !== seq);
}

function notifyDrainWaiters(): void {
    drainWaiters.forEach((waiter) => waiter());
}

async function drain(gen: number, uid: string): Promise<void> {
    try {
        while (gen === generation && !failed && queue.length > 0) {
            const head = queue[0];
            const wait = head.notBefore - Date.now();
            if (wait > 0) {
                scheduleWake(wait);
                return;
            }

            inFlightSeq = head.seq;
            let error: unknown = null;
            try {
                await sendOp(head.op, uid);
            } catch (caught) {
                error = caught;
            }
            if (gen !== generation) return;
            inFlightSeq = null;

            if (!error) {
                removeEntry(head.seq);
                acked.push({ op: head.op, ackedAt: Date.now() });
                const cutoff = Date.now() - ACKED_RETENTION_MS;
                acked = acked.filter((entry) => entry.ackedAt >= cutoff);
                backoffMs = 0;
                persist();
                publish();
                continue;
            }

            const code = (error as { code?: string }).code;
            const kind = classifyError(code);
            if (kind === "gone") {
                // The idea was deleted (most likely on another device) —
                // nothing left to apply this to. Drop it and let the refresh
                // bring the local view in line with the server.
                removeEntry(head.seq);
                persist();
                publish();
                refreshHandler?.();
                continue;
            }
            if (kind === "permanent") {
                console.error("Sync: the server refused a change.", error);
                removeEntry(head.seq);
                failed = { entry: head, failure: { code: code ?? "unknown", message: describeFailure(code) } };
                persist();
                publish();
                return;
            }
            console.warn("Sync: couldn't send a change yet, will retry.", error);
            backoffMs = Math.min(Math.max(backoffMs * 2, MIN_BACKOFF_MS), MAX_BACKOFF_MS);
            scheduleWake(backoffMs);
            return;
        }
    } finally {
        if (gen === generation) {
            pumping = false;
            if (queue.length === 0 || failed) notifyDrainWaiters();
        }
    }
}

function describeFailure(code: string | undefined): string {
    switch (code) {
        case "permission-denied":
            return "The server refused it. On the Free plan this usually means you've reached the 50-idea limit.";
        case "invalid-argument":
            return "The server rejected it as invalid. It may be too large.";
        default:
            return `The server rejected it (${code ?? "unknown error"}).`;
    }
}

// Puts the refused change back at the front of the queue and tries again.
export function retryFailed(): void {
    if (!failed) return;
    queue = [{ ...failed.entry, notBefore: 0 }, ...queue];
    failed = null;
    persist();
    publish();
    pump();
}

// Drops the refused change (and later changes that depend on it), then
// rebuilds the local view from the server so it disappears there too.
export function discardFailed(): void {
    if (!failed) return;
    const ids = opIds(failed.entry.op);
    failed = null;
    queue = withoutDependents(queue, ids);
    persist();
    publish();
    pump();
    refreshHandler?.();
}

// Tries to send everything now (skipping debounce delays), resolving true
// once nothing is left or false if `timeoutMs` passes first. Unsent changes
// are kept either way and go out the next time this account signs in here.
export function flushOutbox(timeoutMs: number): Promise<boolean> {
    if (queue.length === 0 && !failed) return Promise.resolve(true);
    // Paused on a refused change — nothing will send until the user deals
    // with it, so there's nothing to wait for.
    if (failed) return Promise.resolve(false);
    queue = queue.map((entry) => ({ ...entry, notBefore: 0 }));
    persist();
    pump();
    return new Promise((resolve) => {
        const finish = () => {
            clearTimeout(timer);
            drainWaiters.delete(waiter);
            resolve(queue.length === 0 && !failed);
        };
        const waiter = () => {
            if (queue.length === 0 || failed) finish();
        };
        const timer = setTimeout(finish, timeoutMs);
        drainWaiters.add(waiter);
    });
}

// Every local change the server's copy might not show yet, oldest first:
// changes accepted since `since` (a refresh's server read may predate them),
// the refused one the user hasn't dealt with, then everything still queued.
export function unsyncedOpsSince(since: number): SyncOp[] {
    return [
        ...acked.filter((entry) => entry.ackedAt >= since).map((entry) => entry.op),
        ...(failed ? [failed.entry.op] : []),
        ...queue.map((entry) => entry.op),
    ];
}

if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
        backoffMs = 0;
        pump();
    });
}

// ── Sending ────────────────────────────────────────────────────────────────

// Firestore rejects `undefined` field values outright; ideas built in code
// can carry them (optional props), ones read back from JSON can't.
function stripUndefined<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

async function encryptItems(items: ChecklistItem[], dek: CryptoKey): Promise<ChecklistItem[]> {
    return Promise.all(
        items.map(async (item) => {
            const encrypted: ChecklistItem = { ...stripUndefined(item), text: await encryptField(item.text, dek) };
            if (item.link) encrypted.link = await encryptField(item.link, dek);
            return encrypted;
        })
    );
}

async function encryptIdea(idea: IdeaType, dek: CryptoKey): Promise<Record<string, unknown>> {
    const base = stripUndefined({ ...idea }) as Record<string, unknown>;
    if (idea.type === "checklist") {
        return { ...base, content: await encryptField(idea.content, dek), items: await encryptItems(idea.items, dek) };
    }
    return {
        ...base,
        content: await encryptField(idea.content, dek),
        link: await encryptField(idea.link ?? "", dek),
        ...(idea.noteTitle !== undefined ? { noteTitle: await encryptField(idea.noteTitle, dek) } : {}),
    };
}

async function encryptPatch(patch: IdeaPatch, dek: CryptoKey): Promise<{ [field: string]: FieldValue | string | number | ChecklistItem[] }> {
    const out: { [field: string]: FieldValue | string | number | ChecklistItem[] } = {};
    if (patch.content !== undefined) out.content = await encryptField(patch.content, dek);
    if (patch.link !== undefined) out.link = await encryptField(patch.link, dek);
    if (patch.noteTitle !== undefined) out.noteTitle = await encryptField(patch.noteTitle, dek);
    if (patch.parentID !== undefined) out.parentID = patch.parentID;
    if (patch.priority !== undefined) out.priority = patch.priority === null ? deleteField() : patch.priority;
    if (patch.items !== undefined) out.items = await encryptItems(patch.items, dek);
    return out;
}

// One op = one atomic batch: the idea write itself, the free-plan node
// counter (rules gate creates on it — see firestore.rules), and this
// device's change counter in meta/sync that other devices watch.
//
// Updates use update(), not set(merge): an update to an idea deleted
// elsewhere fails with not-found instead of silently re-creating a partial
// doc with no id/parentID.
async function sendOp(op: SyncOp, uid: string): Promise<void> {
    const dek = getDEK();
    const ideas = collection(db, "users", uid, "ideas");
    const batch = writeBatch(db);
    let countDelta = 0;

    switch (op.kind) {
        case "create":
            batch.set(doc(ideas, String(op.idea.id)), await encryptIdea(op.idea, dek));
            countDelta = 1;
            break;
        case "update": {
            const fields = await encryptPatch(op.patch, dek);
            if (Object.keys(fields).length === 0) return;
            batch.update(doc(ideas, String(op.id)), fields);
            break;
        }
        case "delete":
            if (op.ids.length === 0) return;
            op.ids.forEach((id) => batch.delete(doc(ideas, String(id))));
            countDelta = -op.ids.length;
            break;
    }

    // A paid account is never capped, so its counter isn't maintained —
    // useNodeCountResync re-establishes it if the account drops to free.
    if (countDelta !== 0 && getCachedBillingStatus().plan === "free") {
        batch.set(doc(db, "users", uid, "meta", "nodeCount"), { count: increment(countDelta) }, { merge: true });
    }
    // lastModified is no longer read by this version of the app; kept so a
    // tab still running the previous build during a deploy keeps syncing.
    batch.set(
        doc(db, "users", uid, "meta", "sync"),
        { devices: { [getDeviceId()]: increment(1) }, lastModified: Date.now() },
        { merge: true }
    );
    await batch.commit();
}
