import { IdeaType, ChecklistItem } from "../types";
import { updateIdeaParentIdInFirebase, updateChecklistItemsInFirebase } from "../firebase/firebaseHelpers";
import { fetchFullIdeaList } from "./helpers";

const _checklistTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function scheduleChecklistFirebaseWrite(id: number, items: ChecklistItem[]) {
    const existing = _checklistTimers.get(id);
    if (existing) clearTimeout(existing);
    _checklistTimers.set(id, setTimeout(() => {
        _checklistTimers.delete(id);
        updateChecklistItemsInFirebase(id, items);
    }, 1500));
}

export function deleteFromLocalStorage(id: number) {
    const ideas = localStorage.getItem("ideas");
    if (!ideas) {
        console.warn("No ideas found in localStorage.");
        return;
    }

    const parsedIdeas = JSON.parse(ideas);
    const updatedIdeas = parsedIdeas.filter((idea: IdeaType) => idea.id !== id);
    localStorage.setItem("ideas", JSON.stringify(updatedIdeas));
}

export function updateIdeaParentId(id: number, newParentId: number) {
    const ideas = fetchFullIdeaList();

    const updatedIdeas = ideas.map((idea: IdeaType) => {
        if (idea.id === id) {
            return { ...idea, parentID: newParentId };
        }
        return idea;
    });
    localStorage.setItem("ideas", JSON.stringify(updatedIdeas));
    updateIdeaParentIdInFirebase(id, newParentId);
}

export function appendToLocalStorageFromFrontend(idea: IdeaType) {
    const currentData = localStorage.getItem("ideas");
    if (currentData === null) {
        localStorage.setItem("ideas", JSON.stringify([idea]));
    } else {
        const parsed = JSON.parse(currentData);
        if (Array.isArray(parsed)) {
            parsed.push(idea);
            localStorage.setItem("ideas", JSON.stringify(parsed));
        }
    }
}

export function updateIdeaName(id: number, newName: string) {
    const ideas = fetchFullIdeaList();
    const updatedIdeas = ideas.map((idea: IdeaType) => {
        if (idea.id === id) {
            return { ...idea, content: newName };
        }
        return idea;
    });
    localStorage.setItem("ideas", JSON.stringify(updatedIdeas));
}

export function updateIdeaLink(id: number, newLink: string) {
    const ideas = fetchFullIdeaList();
    const updatedIdeas = ideas.map((idea: IdeaType) => {
        if (idea.id === id) {
            return { ...idea, link: newLink };
        }
        return idea;
    });
    localStorage.setItem("ideas", JSON.stringify(updatedIdeas));
}

export function updateChecklistItems(id: number, items: ChecklistItem[]) {
    const ideas = fetchFullIdeaList();
    const updatedIdeas = ideas.map((idea: IdeaType) => {
        if (idea.id === id && idea.type === 'checklist') {
            return { ...idea, items };
        }
        return idea;
    });
    localStorage.setItem("ideas", JSON.stringify(updatedIdeas));
}
