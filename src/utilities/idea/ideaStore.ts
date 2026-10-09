import type { ChecklistItem, IdeaType } from "../types";
import { applyOpLocally, type SyncOp } from "../sync/ops";
import { enqueue, enqueueMany } from "../sync/outbox";
import { fetchFullIdeaList } from "./helpers";

// The one place idea changes are made. Each function does both halves of a
// change — the local copy every view reads (localStorage "ideas") and the
// sync outbox that carries it to Firestore — so a caller can't do one and
// forget the other. The local half is applied with the same applyOpLocally
// the sync engine rebases with, so what's shown here is exactly what a pull
// from the server would later produce.
//
// Callers still toggle newIdeaSwitch themselves afterwards (CLAUDE.md →
// Critical Gotchas); the functions returning a Promise resolve as soon as the
// change is recorded, so doing it in `.then()` works offline too.

const IDEAS_KEY = "ideas";

// Quick successive checklist ticks / priority taps are merged into one
// write. The change is recorded in the outbox immediately (so closing the
// tab inside the delay no longer loses it); only the *send* waits.
const DEBOUNCE_MS = 1500;

// One outbox op is one Firestore batch. Deleting a big subtree (an import can
// be 2000 ideas) is split so no single batch is enormous.
const DELETE_CHUNK_SIZE = 450;

function writeLocal(list: IdeaType[]): void {
    localStorage.setItem(IDEAS_KEY, JSON.stringify(list));
}

function commit(op: SyncOp, options?: { debounceMs?: number }): void {
    writeLocal(applyOpLocally(fetchFullIdeaList(), op));
    enqueue(op, options);
}

export function createIdea(idea: IdeaType): void {
    commit({ kind: "create", idea });
}

export async function updateIdeaName(id: number, newName: string): Promise<void> {
    commit({ kind: "update", id, patch: { content: newName } });
}

export async function updateIdeaNoteTitle(id: number, newTitle: string): Promise<void> {
    commit({ kind: "update", id, patch: { noteTitle: newTitle } });
}

export async function updateIdeaLink(id: number, newLink: string): Promise<void> {
    commit({ kind: "update", id, patch: { link: newLink } });
}

export function updateIdeaParentId(id: number, newParentId: number): void {
    commit({ kind: "update", id, patch: { parentID: newParentId } });
}

export function updateIdeaPriority(id: number, priority: 1 | 2 | 3 | undefined): void {
    commit({ kind: "update", id, patch: { priority: priority ?? null } }, { debounceMs: DEBOUNCE_MS });
}

export function updateChecklistItems(id: number, items: ChecklistItem[]): void {
    commit({ kind: "update", id, patch: { items } }, { debounceMs: DEBOUNCE_MS });
}

// The idea and everything under it, children before parents.
function collectSubtreeIds(list: IdeaType[], rootIdeaId: number): number[] {
    const childrenOf = new Map<number, number[]>();
    for (const idea of list) {
        const siblings = childrenOf.get(idea.parentID);
        if (siblings) siblings.push(idea.id);
        else childrenOf.set(idea.parentID, [idea.id]);
    }
    const ids: number[] = [];
    const seen = new Set<number>();
    const walk = (id: number) => {
        if (seen.has(id)) return;
        seen.add(id);
        (childrenOf.get(id) ?? []).forEach(walk);
        ids.push(id);
    };
    walk(rootIdeaId);
    return ids;
}

// Returns what was removed, so the caller can offer Undo (restoreIdeas).
export function recursivelyDeleteChildren(ideaId: number): IdeaType[] {
    const list = fetchFullIdeaList();
    const ids = collectSubtreeIds(list, ideaId);
    const removed = new Set(ids);
    writeLocal(list.filter((idea) => !removed.has(idea.id)));

    const ops: SyncOp[] = [];
    for (let i = 0; i < ids.length; i += DELETE_CHUNK_SIZE) {
        ops.push({ kind: "delete", ids: ids.slice(i, i + DELETE_CHUNK_SIZE) });
    }
    enqueueMany(ops);
    return list.filter((idea) => removed.has(idea.id));
}

// Undo for a delete: puts the ideas back with the same ids, as ordinary
// creates queued after the delete. Parents are queued before their children,
// so no create ever lands under a parent the server doesn't have yet. Any
// that already exist again (restored twice, or re-created by a sync) are
// skipped. The free-plan node counter nets out: -N on delete, +N here.
export function restoreIdeas(ideas: IdeaType[]): void {
    const list = fetchFullIdeaList();
    const present = new Set(list.map((idea) => idea.id));
    const pending = ideas.filter((idea) => !present.has(idea.id));
    const ordered = parentsFirst(pending);
    if (ordered.length === 0) return;
    writeLocal([...list, ...ordered]);
    enqueueMany(ordered.map((idea) => ({ kind: "create" as const, idea })));
}

function parentsFirst(ideas: IdeaType[]): IdeaType[] {
    const inSet = new Set(ideas.map((idea) => idea.id));
    const childrenOf = new Map<number, IdeaType[]>();
    const tops: IdeaType[] = [];
    for (const idea of ideas) {
        if (inSet.has(idea.parentID) && idea.parentID !== idea.id) {
            const siblings = childrenOf.get(idea.parentID);
            if (siblings) siblings.push(idea);
            else childrenOf.set(idea.parentID, [idea]);
        } else {
            tops.push(idea);
        }
    }
    const ordered: IdeaType[] = [];
    const seen = new Set<number>();
    const queue = [...tops];
    while (queue.length > 0) {
        const idea = queue.shift()!;
        if (seen.has(idea.id)) continue;
        seen.add(idea.id);
        ordered.push(idea);
        queue.push(...(childrenOf.get(idea.id) ?? []));
    }
    // A parent cycle in bad data has no top; keep those ideas rather than drop them.
    for (const idea of ideas) if (!seen.has(idea.id)) ordered.push(idea);
    return ordered;
}
