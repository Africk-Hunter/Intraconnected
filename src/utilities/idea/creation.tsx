import { addIdeaToFirebase } from "../firebase/firebaseHelpers";
import { appendToLocalStorageFromFrontend } from "./storage";
import { ChecklistItem } from "../types";

export function handleIdeaCreation(content: string, parentID: number, link: string, priority?: 1 | 2 | 3) {
    const newID = Date.now();
    const idea = { id: newID, content: content, parentID: parentID, link: link, ...(priority ? { priority } : {}) };
    appendToLocalStorageFromFrontend(idea);
    addIdeaToFirebase(idea);
}

export function handleChecklistCreation(title: string, parentID: number, items: ChecklistItem[], priority?: 1 | 2 | 3) {
    const newID = Date.now();
    const idea = { id: newID, type: 'checklist' as const, content: title, parentID, items, ...(priority ? { priority } : {}) };
    appendToLocalStorageFromFrontend(idea);
    addIdeaToFirebase(idea);
}
