import { db, auth } from "../../firebaseConfig";
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { IdeaType, ChecklistItem } from "../types";
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

export async function storeEncryptedDEK(encryptedDEK: string, recoveryEncryptedDEK: string, emailEncryptedDEK: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, { encryptedDEK, recoveryEncryptedDEK, emailEncryptedDEK, recoveryCodeAcknowledged: false });
}

export async function markRecoveryCodeAcknowledged(): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, { recoveryCodeAcknowledged: true }, { merge: true });
}

export async function addEmailEncryptedDEK(emailEncryptedDEK: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, { emailEncryptedDEK }, { merge: true });
}

export async function fetchEncryptedDEK(): Promise<{ encryptedDEK: string; recoveryEncryptedDEK: string; emailEncryptedDEK?: string; recoveryCodeAcknowledged?: boolean } | null> {
    const user = authCheck();
    if (!user) return null;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    const snap = await getDoc(metaDoc);
    if (!snap.exists()) return null;
    return snap.data() as { encryptedDEK: string; recoveryEncryptedDEK: string; emailEncryptedDEK?: string; recoveryCodeAcknowledged?: boolean };
}

export async function fetchIdeasFromFirebase() {
    const user = authCheck();
    if (!user) return;

    try {
        const dek = getDEK();
        const ideasCollection = collection(db, "users", user.uid, "ideas");
        const ideasSnapshot = await getDocs(ideasCollection);
        const ideasList = await Promise.all(ideasSnapshot.docs.map(async snap => {
            const data = snap.data();
            if (data.type === 'checklist') {
                return {
                    id: data.id as number,
                    type: 'checklist' as const,
                    content: await decryptField(data.content as string, dek),
                    parentID: data.parentID as number,
                    items: await Promise.all(((data.items ?? []) as ChecklistItem[]).map(async item => ({
                        id: item.id,
                        text: await decryptField(item.text, dek),
                        checked: item.checked,
                    }))),
                };
            }
            return {
                id: data.id as number,
                content: await decryptField(data.content as string, dek),
                parentID: data.parentID as number,
                link: await decryptField(data.link as string | null | undefined, dek),
            };
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
        const dek = getDEK();
        const ideasCollection = collection(db, "users", user.uid, "ideas");
        let encrypted: object;
        if (idea.type === 'checklist') {
            encrypted = {
                ...idea,
                content: await encryptField(idea.content, dek),
                items: await Promise.all(idea.items.map(async item => ({
                    ...item,
                    text: await encryptField(item.text, dek),
                }))),
            };
        } else {
            encrypted = {
                ...idea,
                content: await encryptField(idea.content, dek),
                link: await encryptField(idea.link, dek),
            };
        }
        await setDoc(doc(ideasCollection, idea.id.toString()), encrypted);
    } catch (error) {
        console.error("Error adding idea: ", error);
    }
}

export async function updateChecklistItemsInFirebase(ideaId: number, items: ChecklistItem[]) {
    const user = authCheck();
    if (!user) return;

    try {
        const dek = getDEK();
        const encryptedItems = await Promise.all(items.map(async item => ({
            ...item,
            text: await encryptField(item.text, dek),
        })));
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await setDoc(ideaDoc, { items: encryptedItems }, { merge: true });
    } catch (error) {
        console.error("Error updating checklist items: ", error);
    }
}

export async function deleteIdeaFromFirebase(ideaId: number) {
    const user = authCheck();
    if (!user) return;

    try {
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await deleteDoc(ideaDoc);
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
    } catch (error) {
        console.error("Error updating idea link: ", error);
    }
}
