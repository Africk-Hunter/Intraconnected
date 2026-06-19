import { db, auth } from "../../firebaseConfig";
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { IdeaType } from "../types";
import { encryptField, decryptField } from "../crypto";
import { getDEK } from "../dekStore";

function authCheck() {
    const user = auth.currentUser;
    if (!user) {
        console.error("User is not authenticated");
        return null;
    }
    return user;
}

export async function storeEncryptedDEK(encryptedDEK: string, recoveryEncryptedDEK: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, { encryptedDEK, recoveryEncryptedDEK, recoveryCodeAcknowledged: false });
}

export async function markRecoveryCodeAcknowledged(): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, { recoveryCodeAcknowledged: true }, { merge: true });
}

export async function fetchEncryptedDEK(): Promise<{ encryptedDEK: string; recoveryEncryptedDEK: string; recoveryCodeAcknowledged?: boolean } | null> {
    const user = authCheck();
    if (!user) return null;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    const snap = await getDoc(metaDoc);
    if (!snap.exists()) return null;
    return snap.data() as { encryptedDEK: string; recoveryEncryptedDEK: string; recoveryCodeAcknowledged?: boolean };
}

export async function fetchIdeasFromFirebase() {
    const user = authCheck();
    if (!user) return;

    try {
        const dek = getDEK();
        const ideasCollection = collection(db, "users", user.uid, "ideas");
        const ideasSnapshot = await getDocs(ideasCollection);
        const ideasList = await Promise.all(ideasSnapshot.docs.map(async doc => ({
            id: doc.data().id as number,
            content: await decryptField(doc.data().content as string, dek),
            parentID: doc.data().parentID as number,
            link: await decryptField(doc.data().link as string | null | undefined, dek),
        })));
        return ideasList;
    } catch (error) {
        console.error("Error fetching ideas: ", error);
    }
}

export async function addIdeaToFirebase(idea: IdeaType) {
    const user = authCheck();
    if (!user) return;

    try {
        const dek = getDEK();
        const ideasCollection = collection(db, "users", user.uid, "ideas");
        const encrypted = {
            ...idea,
            content: await encryptField(idea.content, dek),
            link: await encryptField(idea.link, dek),
        };
        await setDoc(doc(ideasCollection, idea.id.toString()), encrypted);
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
        const dek = getDEK();
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await setDoc(ideaDoc, { content: await encryptField(newName, dek) }, { merge: true });
        console.log("Idea name updated successfully");
    } catch (error) {
        console.error("Error updating idea name: ", error);
    }
}

export async function updateIdeaLinkInFirebase(ideaId: number, newLink: string) {
    const user = authCheck();
    if (!user) return;

    try {
        const dek = getDEK();
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await setDoc(ideaDoc, { link: await encryptField(newLink, dek) }, { merge: true });
        console.log("Idea link updated successfully");
    } catch (error) {
        console.error("Error updating idea link: ", error);
    }
}
