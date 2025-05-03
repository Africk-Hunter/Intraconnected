import { addIdeaToFirebase } from "../firebase/firebaseHelpers";
import { appendToLocalStorageFromFrontend } from "./storage";

export function handleIdeaCreation(content: string, parentID: number, link: string) {
    const newID = Date.now();
    const idea = { id: newID, content: content, parentID: parentID, link: link };
    appendToLocalStorageFromFrontend(idea);
    addIdeaToFirebase(idea);
}