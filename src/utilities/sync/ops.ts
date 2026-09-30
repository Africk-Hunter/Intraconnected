import type { ChecklistItem, IdeaType } from "../types";

// Pure core of the sync layer — no localStorage, no Firestore, so every rule
// about how queued changes combine with server data is unit-tested directly
// (ops.test.ts). outbox.ts and syncEngine.ts are the I/O shells around this.

// Plaintext field changes to one idea. `priority: null` means "remove the
// priority" (Firestore deleteField()), since `undefined` can't survive the
// JSON round-trip the outbox is persisted through.
export interface IdeaPatch {
    content?: string;
    link?: string;
    noteTitle?: string;
    parentID?: number;
    priority?: 1 | 2 | 3 | null;
    items?: ChecklistItem[];
}

// One user-visible change, recorded before it's sent so it survives a closed
// tab or a reload while offline. Every op is idempotent (create = full set,
// update = field patch, delete = delete), which is what makes replaying one
// that may already have reached the server safe.
export type SyncOp =
    | { kind: "create"; idea: IdeaType }
    | { kind: "update"; id: number; patch: IdeaPatch }
    | { kind: "delete"; ids: number[] };

export interface QueuedOp {
    seq: number;
    op: SyncOp;
    // Debounced ops (checklist ticks, priority taps) wait until this time so
    // a burst of changes goes out as one write. 0 = send immediately.
    notBefore: number;
    // When the change was first made — kept through coalescing, so "how long
    // has this been waiting to sync" stays honest.
    queuedAt: number;
}

export function opIds(op: SyncOp): number[] {
    switch (op.kind) {
        case "create":
            return [op.idea.id];
        case "update":
            return [op.id];
        case "delete":
            return op.ids;
    }
}

function applyPatch(idea: IdeaType, patch: IdeaPatch): IdeaType {
    const next: Record<string, unknown> = { ...idea };
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        if (value === null) delete next[key];
        else next[key] = value;
    }
    return next as unknown as IdeaType;
}

// Idempotent: applying an op that's already reflected in `list` is a no-op.
// An update to an idea that isn't there is dropped rather than creating a
// partial idea — the same rule the server enforces (outbox.ts sends updates
// with update(), which fails on a missing doc).
export function applyOpLocally(list: IdeaType[], op: SyncOp): IdeaType[] {
    switch (op.kind) {
        case "create": {
            const index = list.findIndex((idea) => idea.id === op.idea.id);
            if (index === -1) return [...list, op.idea];
            const next = list.slice();
            next[index] = op.idea;
            return next;
        }
        case "update":
            return list.map((idea) => (idea.id === op.id ? applyPatch(idea, op.patch) : idea));
        case "delete": {
            const ids = new Set(op.ids);
            return list.filter((idea) => !ids.has(idea.id));
        }
    }
}

// Server data plus every change this device has made that the server may not
// reflect yet — what the user should see after a refresh, so pulling another
// device's edits never erases this device's unsent ones.
export function rebase(serverIdeas: IdeaType[], ops: SyncOp[]): IdeaType[] {
    return ops.reduce(applyOpLocally, serverIdeas);
}

// meta/sync keeps one write counter per device. A device only ever bumps its
// own, so "did anyone else change anything" is just "did any *other*
// device's counter move since I last pulled" — no timestamps, no races with
// this device's own writes.
export type DeviceCounters = Record<string, number>;

export function othersOnly(devices: DeviceCounters, myDeviceId: string): DeviceCounters {
    const others: DeviceCounters = {};
    for (const [id, count] of Object.entries(devices)) {
        if (id !== myDeviceId) others[id] = count;
    }
    return others;
}

export function othersChanged(devices: DeviceCounters, seen: DeviceCounters | null, myDeviceId: string): boolean {
    if (!seen) return true;
    const others = othersOnly(devices, myDeviceId);
    const keys = new Set([...Object.keys(others), ...Object.keys(seen)]);
    for (const key of keys) {
        if ((others[key] ?? 0) !== (seen[key] ?? 0)) return true;
    }
    return false;
}

// Adds `entry` to the queue, folding a debounced update into the last queued
// op for the same idea when that op is an update that isn't already being
// sent — so ten quick checklist ticks become one write. Only merges into the
// *last* op touching that id, so it can never reorder a change past a later
// create/delete of the same idea.
export function coalesce(queue: QueuedOp[], entry: QueuedOp, inFlightSeq: number | null): QueuedOp[] {
    if (entry.op.kind !== "update") return [...queue, entry];
    const id = entry.op.id;
    for (let i = queue.length - 1; i >= 0; i--) {
        const existing = queue[i];
        if (!opIds(existing.op).includes(id)) continue;
        if (existing.op.kind !== "update" || existing.seq === inFlightSeq) break;
        const merged: QueuedOp = {
            seq: existing.seq,
            op: { kind: "update", id, patch: { ...existing.op.patch, ...entry.op.patch } },
            notBefore: Math.max(existing.notBefore, entry.notBefore),
            queuedAt: existing.queuedAt,
        };
        const next = queue.slice();
        next[i] = merged;
        return next;
    }
    return [...queue, entry];
}

// When the user discards a change the server refused, later changes that
// only make sense on top of it go too: anything touching the same ideas, and
// (transitively) ideas created or moved under an idea that will now never
// exist on the server — otherwise they'd land there as orphans.
export function withoutDependents(queue: QueuedOp[], discardedIds: number[]): QueuedOp[] {
    const removed = new Set(discardedIds);
    const kept: QueuedOp[] = [];
    for (const entry of queue) {
        const { op } = entry;
        const touches = opIds(op).some((id) => removed.has(id));
        const underRemoved =
            (op.kind === "create" && removed.has(op.idea.parentID)) ||
            (op.kind === "update" && op.patch.parentID !== undefined && removed.has(op.patch.parentID));
        if (touches || underRemoved) {
            opIds(op).forEach((id) => removed.add(id));
            continue;
        }
        kept.push(entry);
    }
    return kept;
}

export type ErrorClass = "permanent" | "gone" | "transient";

// Firestore write errors that retrying can't fix. Everything else (network,
// quota, token refresh, a missing encryption key mid-login) is treated as
// transient: the op stays at the head of the queue and is retried.
const PERMANENT_CODES = new Set(["permission-denied", "invalid-argument", "failed-precondition", "out-of-range", "already-exists"]);

export function classifyError(code: string | undefined): ErrorClass {
    if (code === "not-found") return "gone";
    if (code && PERMANENT_CODES.has(code)) return "permanent";
    return "transient";
}

// Ideas whose parent no longer exists (root is the virtual id 1). These are
// invisible in every view — typically left behind when one device deleted a
// parent while another, with a stale view, added a child under it.
export function findOrphans(list: IdeaType[]): IdeaType[] {
    const ids = new Set(list.map((idea) => idea.id));
    return list.filter((idea) => idea.parentID !== 1 && !ids.has(idea.parentID));
}
