import { addIdeaToFirebase } from "../firebase/firebaseHelpers";
import { appendToLocalStorageFromFrontend } from "./storage";
import { ChecklistItem } from "../types";
import { canCreateIdea } from "../billing/limits";

// Redundant free-tier gate — the primary check happens where the "create"
// UI is triggered (Navbar/MobileMindMap), before this ever runs. Kept here
// too as defense-in-depth against any future call site that skips that
// check. This one's still just a UX nicety (a client that skips it entirely
// would just have its Firestore write rejected instead) — the actual
// enforcement now lives server-side in firestore.rules (meta/nodeCount),
// not here. See addIdeaToFirebase in firebaseHelpers.tsx for where that
// counter actually gets maintained.
export function handleIdeaCreation(content: string, parentID: number, link: string, priority?: 1 | 2 | 3) {
    if (!canCreateIdea()) return;
    const newID = Date.now();
    const idea = { id: newID, content: content, parentID: parentID, link: link, ...(priority ? { priority } : {}) };
    appendToLocalStorageFromFrontend(idea);
    addIdeaToFirebase(idea);
}

export function handleChecklistCreation(title: string, parentID: number, items: ChecklistItem[], priority?: 1 | 2 | 3) {
    if (!canCreateIdea()) return;
    const newID = Date.now();
    const idea = { id: newID, type: 'checklist' as const, content: title, parentID, items, ...(priority ? { priority } : {}) };
    appendToLocalStorageFromFrontend(idea);
    addIdeaToFirebase(idea);
}

export function handleNoteCreation(title: string, parentID: number, body: string, priority?: 1 | 2 | 3) {
    if (!canCreateIdea()) return;
    const newID = Date.now();
    const idea = { id: newID, content: body, parentID, link: '', isNote: true, noteTitle: title, ...(priority ? { priority } : {}) };
    appendToLocalStorageFromFrontend(idea);
    addIdeaToFirebase(idea);
}
