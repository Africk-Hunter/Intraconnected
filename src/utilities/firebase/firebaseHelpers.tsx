import { db, auth } from "../../firebaseConfig";
import { doc, setDoc, collection, getDocs, deleteDoc} from "firebase/firestore";
import { IdeaType } from "../types";

function authCheck() {
    const user = auth.currentUser;
    if (!user) {
        console.error("User is not authenticated");
        return null;
    }
    return user;
}

export async function fetchIdeasFromFirebase() {
    const user = authCheck();
    if (!user) return;

    try {
        const ideasCollection = collection(db, "users", user.uid, "ideas");
        const ideasSnapshot = await getDocs(ideasCollection);
        const ideasList = ideasSnapshot.docs.map(doc => ({ 
            id: doc.data().id as number,
            content: doc.data().content as string,
            parentID: doc.data().parentID as number,
            link: doc.data().link as string,
        }));
        return ideasList;
    } catch (error) {
        console.error("Error fetching ideas: ", error);
    }
}

export async function addIdeaToFirebase(idea: IdeaType) {
    const user = authCheck();
    if (!user) return;

    try {
        const ideasCollection = collection(db, "users", user.uid, "ideas");
        await setDoc(doc(ideasCollection, idea.id.toString()), idea);
    } catch (error) {
        console.error("Error adding idea: ", error);
    }
}

export async function deleteIdeaFromFirebase(ideaId: number) {
    const user = authCheck();
    if (!user) return;

    try {
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await deleteDoc(ideaDoc);
        console.log("Idea deleted successfully");
    } catch (error) {
        console.error("Error deleting idea: ", error);
    }
}

export async function updateIdeaParentIdInFirebase(ideaId: number, newParentId: number) {
    const user = authCheck();
    if (!user) return;

    try {
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await setDoc(ideaDoc, { parentID: newParentId }, { merge: true });
        console.log("Idea parent ID updated successfully");
    } catch (error) {
        console.error("Error updating idea parent ID: ", error);
    }
}

export async function updateIdeaNameInFirebase(ideaId: number, newName: string) {
    const user = authCheck();
    if (!user) return;

    try {
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await setDoc(ideaDoc, { content: newName }, { merge: true });
        console.log("Idea name updated successfully");
    }catch (error) {
        console.error("Error updating idea name: ", error);
    }


}

export async function updateIdeaLinkInFirebase(ideaId: number, newLink: string) {
    const user = authCheck();
    if (!user) return;

    try {
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await setDoc(ideaDoc, { link: newLink }, { merge: true }); // <-- update the 'link' field
        console.log("Idea link updated successfully");
    } catch (error) {
        console.error("Error updating idea link: ", error);
    }
}

