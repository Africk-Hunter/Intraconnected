import { IdeaType } from "../types";
import { updateIdeaParentIdInFirebase } from "../firebase/firebaseHelpers";
import { fetchFullIdeaList } from "./helpers";

/**
 * Deletes an idea from localStorage by its ID.
 * @param id The ID of the idea to delete.
 */
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

/**
 * Updates the parent ID of an idea in localStorage.
 * @param id The ID of the idea to update.
 * @param newParentId The new parent ID.
 */
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

/**
 * Appends a new idea to localStorage.
 * @param idea The idea to append.
 */
export function appendToLocalStorageFromFrontend(idea: IdeaType) {
    let currentData = localStorage.getItem("ideas");
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