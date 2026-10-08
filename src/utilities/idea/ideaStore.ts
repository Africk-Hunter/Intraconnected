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

export function recursivelyDeleteChildren(ideaId: number): void {
    const list = fetchFullIdeaList();
    const ids = collectSubtreeIds(list, ideaId);
    const removed = new Set(ids);
    writeLocal(list.filter((idea) => !removed.has(idea.id)));

    const ops: SyncOp[] = [];
    for (let i = 0; i < ids.length; i += DELETE_CHUNK_SIZE) {
        ops.push({ kind: "delete", ids: ids.slice(i, i + DELETE_CHUNK_SIZE) });
    }
    enqueueMany(ops);
}
