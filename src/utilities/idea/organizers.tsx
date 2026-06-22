import { fetchIdeasFromFirebase, fetchSyncTimestamp, updateSyncTimestamp } from "../firebase/firebaseHelpers";
import { IdeaType } from "../types";

const SYNC_LS_KEY = 'sync_lastModified';

export async function fetchFromFirebaseAndOrganizeIdeas() {
    const remoteTs = await fetchSyncTimestamp();
    const localTs = localStorage.getItem(SYNC_LS_KEY);

    if (remoteTs !== null && localTs !== null && String(remoteTs) === localTs) {
        return;
    }

    clearLocalStorage();
    const ideas = await fetchIdeasFromFirebase();
    if (ideas) {
        organizeIdeas(ideas);
    }

    if (remoteTs !== null) {
        localStorage.setItem(SYNC_LS_KEY, String(remoteTs));
    } else {
        // No sync doc exists yet — stamp one so subsequent loads can skip the fetch
        await updateSyncTimestamp();
    }
}

function clearLocalStorage() {
    localStorage.removeItem('ideas');
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

