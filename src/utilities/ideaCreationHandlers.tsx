import { addIdeaToFirebase } from "./firebaseHelpers";

export function handleIdeaCreation(content: string, parentID: number) {
    const newID = Date.now();
    const idea = { id: newID, content: content, parentID: parentID };
    appendToLocalStorageFromFrontend(idea);
    addIdeaToFirebase(idea);
}


export function appendToLocalStorageFromFrontend(idea: { id: number, content: string, parentID: number }) {

    let currentData = localStorage.getItem('ideas');
    if (currentData === null) {
        localStorage.setItem('ideas', JSON.stringify([idea]));
    } else {
        const parsed = JSON.parse(currentData);
        if (Array.isArray(parsed)) {
            parsed.push(idea);
            localStorage.setItem('ideas', JSON.stringify(parsed));
        }
    }
}

