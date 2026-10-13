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
    censored?: true | null;
    items?: ChecklistItem[];
}

// One user-visible change, recorded before it's sent so it survives a closed
// tab or a reload while offline. Every op is idempotent (create = full set,
// update = field patch, delete = delete), which is what makes replaying one
// that may already have reached the server safe.
export type SyncOp =
    | { kind: "create"; idea: IdeaType }
    // Many creates sent as one atomic batch (an import), parents before children.
    | { kind: "createMany"; ideas: IdeaType[] }
    | { kind: "update"; id: number; patch: IdeaPatch }
    | { kind: "delete"; ids: number[] };

// Firestore allows 500 writes per batch; a createMany adds the node counter
// and the meta/sync counter on top of its ideas.
export const MAX_CREATE_MANY = 400;

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
        case "createMany":
            return op.ideas.map((idea) => idea.id);
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
        case "createMany":
            return op.ideas.reduce((acc, idea) => applyOpLocally(acc, { kind: "create", idea }), list);
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

// Replaces (or adds) each changed idea in `list`, leaving every other idea
// exactly as it is. The incremental pull's merge step: the result is then
// rebased over this device's unsent ops, which is safe because every op is
// idempotent.
export function applyChanged(list: IdeaType[], changed: IdeaType[]): IdeaType[] {
    if (changed.length === 0) return list;
    const byId = new Map(changed.map((idea) => [idea.id, idea]));
    const seen = new Set<number>();
    const next = list.map((idea) => {
        const replacement = byId.get(idea.id);
        if (!replacement) return idea;
        seen.add(idea.id);
        return replacement;
    });
    for (const idea of changed) if (!seen.has(idea.id)) next.push(idea);
    return next;
}

// The ids the server should hold, given this device's local list and the
// ops it has not had accepted yet (the refused one plus the queue, NOT the
// accepted ones: the server already reflects those). Walks the ops backwards:
// a pending create means the server lacks that id, a pending delete means the
// server still has it. A create and delete that both never left the device
// cancel out. Used to spot ideas deleted elsewhere by comparing with the
// server's document count.
export function estimateServerIds(localIds: number[], pending: SyncOp[]): Set<number> {
    const ids = new Set(localIds);
    for (let i = pending.length - 1; i >= 0; i--) {
        const op = pending[i];
        if (op.kind === "create" || op.kind === "createMany") opIds(op).forEach((id) => ids.delete(id));
        else if (op.kind === "delete") op.ids.forEach((id) => ids.add(id));
    }
    return ids;
}

export interface PullPlanInput {
    enabled: boolean;
    forced: boolean;
    ownsLocal: boolean;
    hasLocal: boolean;
    hasWatermark: boolean;
    lastFullAt: number | null;
    now: number;
}

// An incremental pull is only a shortcut: every doubt means the full pull.
export const FULL_PULL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldPullFull(input: PullPlanInput): boolean {
    if (!input.enabled || input.forced) return true;
    if (!input.ownsLocal || !input.hasLocal || !input.hasWatermark) return true;
    if (input.lastFullAt === null || input.now - input.lastFullAt > FULL_PULL_MAX_AGE_MS || input.now < input.lastFullAt) return true;
    return false;
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

// What this device currently knows about the account's other devices, from
// meta/sync. Nothing known (the default) always means "announce".
export interface DevicePresence {
    // The latest meta/sync snapshot came from the server, not the cache.
    confirmed: boolean;
    // The live listener is still running (it stops for good on an error).
    healthy: boolean;
    hasOthers: boolean;
    // A new device appeared and this device hasn't yet announced what it
    // changed while it thought it was alone.
    catchUpNeeded: boolean;
}

// Whether a write should bump this device's change counter. Only a device
// that is provably alone (fresh server view, live listener, no other device
// registered) may skip it; any doubt bumps, which is today's behaviour.
export function shouldBump(presence: DevicePresence): boolean {
    return !(presence.confirmed && presence.healthy && !presence.hasOthers && !presence.catchUpNeeded);
}

// Other devices in `devices` that were not in `known`. Empty when nothing was
// known yet (the first snapshot only establishes the baseline).
export function newDeviceIds(devices: DeviceCounters, myDeviceId: string, known: ReadonlySet<string> | null): string[] {
    if (!known) return [];
    return Object.keys(devices).filter((id) => id !== myDeviceId && !known.has(id));
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
            (op.kind === "createMany" && op.ideas.some((idea) => removed.has(idea.parentID))) ||
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
