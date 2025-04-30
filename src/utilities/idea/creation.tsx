import { addIdeaToFirebase } from "../firebase/firebaseHelpers";
import { appendToLocalStorageFromFrontend } from "./storage";

export function handleIdeaCreation(content: string, parentID: number) {
    const newID = Date.now();
    const idea = { id: newID, content: content, parentID: parentID };
    appendToLocalStorageFromFrontend(idea);
    addIdeaToFirebase(idea);
}