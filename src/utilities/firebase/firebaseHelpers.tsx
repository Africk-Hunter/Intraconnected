import { db, auth } from "../../firebaseConfig";
import { doc, setDoc, collection, getDocs, deleteDoc} from "firebase/firestore";


export async function fetchIdeasFromFirebase() {
    const user = auth.currentUser;
    if (!user) {
        console.error("User is not authenticated");
        return;
    }

    try {
        const ideasCollection = collection(db, "users", user.uid, "ideas");
        const ideasSnapshot = await getDocs(ideasCollection);
        const ideasList = ideasSnapshot.docs.map(doc => ({ 
            id: doc.data().id as number,
            content: doc.data().content as string,
            parentID: doc.data().parentID as number
        }));
        return ideasList;
    } catch (error) {
        console.error("Error fetching ideas:", error);
    }
}

export async function addIdeaToFirebase(idea: { id: number; content: string; parentID: number }) {
    const user = auth.currentUser;
    if (!user) {
        console.error("User is not authenticated");
        return;
    }

    try {
        const ideasCollection = collection(db, "users", user.uid, "ideas");
        await setDoc(doc(ideasCollection, idea.id.toString()), idea);
    } catch (error) {
        console.error("Error adding idea:", error);
    }
}

export async function deleteIdeaFromFirebase(ideaId: number) {
    const user = auth.currentUser;
    if (!user) {
        console.error("User is not authenticated");
        return;
    }

    try {
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await deleteDoc(ideaDoc);
        console.log("Idea deleted successfully");
    } catch (error) {
        console.error("Error deleting idea:", error);
    }
}

export async function updateIdeaParentIdInFirebase(ideaId: number, newParentId: number) {
    const user = auth.currentUser;
    if (!user) {
        console.error("User is not authenticated");
        return;
    }

    try {
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await setDoc(ideaDoc, { parentID: newParentId }, { merge: true });
        console.log("Idea parent ID updated successfully");
    } catch (error) {
        console.error("Error updating idea parent ID:", error);
    }
}