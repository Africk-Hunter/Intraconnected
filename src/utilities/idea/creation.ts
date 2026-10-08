import { createIdea } from "./ideaStore";
import { ChecklistItem } from "../types";
import { canCreateIdea } from "../billing/limits";

// Redundant free-tier gate — the primary check happens where the "create"
// UI is triggered (Navbar/MobileMindMap), before this ever runs. Kept here
// too as defense-in-depth against any future call site that skips that
// check. This one's still just a UX nicety (a client that skips it entirely
// would just have its Firestore write rejected instead) — the actual
// enforcement lives server-side in firestore.rules (meta/nodeCount), not
// here. See sendOp in sync/outbox.ts for where that counter gets maintained.
export function handleIdeaCreation(content: string, parentID: number, link: string, priority?: 1 | 2 | 3) {
    if (!canCreateIdea()) return;
    createIdea({ id: Date.now(), content, parentID, link, ...(priority ? { priority } : {}) });
}

export function handleChecklistCreation(title: string, parentID: number, items: ChecklistItem[], priority?: 1 | 2 | 3) {
    if (!canCreateIdea()) return;
    createIdea({ id: Date.now(), type: 'checklist' as const, content: title, parentID, items, ...(priority ? { priority } : {}) });
}

export function handleNoteCreation(title: string, parentID: number, body: string, priority?: 1 | 2 | 3) {
    if (!canCreateIdea()) return;
    createIdea({ id: Date.now(), content: body, parentID, link: '', isNote: true, noteTitle: title, ...(priority ? { priority } : {}) });
}
