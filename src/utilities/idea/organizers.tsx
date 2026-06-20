import { fetchIdeasFromFirebase } from "../firebase/firebaseHelpers";
import { IdeaType } from "../types";

export async function fetchFromFirebaseAndOrganizeIdeas() {
    clearLocalStorage();
    const ideas = await fetchIdeasFromFirebase();

    if (ideas) {
        organizeIdeas(ideas);
    }
}

function clearLocalStorage() {
    localStorage.clear();
}

function organizeIdeas(ideas: IdeaType[]) {
    ideas.forEach(idea => {
        appendToLocalStorageFromFirebase("ideas", idea);
    });
}

function appendToLocalStorageFromFirebase(name: string, data: any) {
    
    let currentData = localStorage.getItem(name);
    if (currentData === null) {
        localStorage.setItem(name, JSON.stringify([data]));
    } else {
        const parsed = JSON.parse(currentData);
        if (Array.isArray(parsed)) {
            parsed.push(data);
            localStorage.setItem(name, JSON.stringify(parsed));
        }
    }
}

