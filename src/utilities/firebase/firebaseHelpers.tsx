import { db, auth } from "../../firebaseConfig";
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, writeBatch, deleteField } from "firebase/firestore";
import { IdeaType, ChecklistItem } from "../types";
import { encryptField, decryptField } from "../crypto";
import { getDEK } from "../dekStore";

const SYNC_LS_KEY = 'sync_lastModified';

export async function updateSyncTimestamp(): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const ts = Date.now();
    const syncDoc = doc(db, "users", user.uid, "meta", "sync");
    await setDoc(syncDoc, { lastModified: ts }, { merge: true });
    localStorage.setItem(SYNC_LS_KEY, String(ts));
}

export async function fetchSyncTimestamp(): Promise<number | null> {
    const user = authCheck();
    if (!user) return null;
    const syncDoc = doc(db, "users", user.uid, "meta", "sync");
    const snap = await getDoc(syncDoc);
    if (!snap.exists()) return null;
    return (snap.data().lastModified as number) ?? null;
}

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
                    items: await Promise.all(((data.items ?? []) as ChecklistItem[]).map(async item => {
                        const result: ChecklistItem = {
                            id: item.id,
                            text: await decryptField(item.text, dek),
                            checked: item.checked,
                        };
                        if (item.link) result.link = await decryptField(item.link, dek);
                        return result;
                    })),
                    ...(data.priority !== undefined ? { priority: data.priority as 1 | 2 | 3 } : {}),
                };
            }
            return {
                id: data.id as number,
                content: await decryptField(data.content as string, dek),
                parentID: data.parentID as number,
                link: await decryptField(data.link as string | null | undefined, dek),
                ...(data.priority !== undefined ? { priority: data.priority as 1 | 2 | 3 } : {}),
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
                items: await Promise.all(idea.items.map(async item => {
                    const enc: ChecklistItem = { ...item, text: await encryptField(item.text, dek) };
                    if (item.link) enc.link = await encryptField(item.link, dek);
                    return enc;
                })),
            };
        } else {
            encrypted = {
                ...idea,
                content: await encryptField(idea.content, dek),
                link: await encryptField(idea.link, dek),
            };
        }
        await setDoc(doc(ideasCollection, idea.id.toString()), encrypted);
        await updateSyncTimestamp();
    } catch (error) {
        console.error("Error adding idea: ", error);
    }
}

export async function updateChecklistItemsInFirebase(ideaId: number, items: ChecklistItem[]) {
    const user = authCheck();
    if (!user) return;

    try {
        const dek = getDEK();
        const encryptedItems = await Promise.all(items.map(async item => {
            const enc: ChecklistItem = { ...item, text: await encryptField(item.text, dek) };
            if (item.link) enc.link = await encryptField(item.link, dek);
            return enc;
        }));
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await setDoc(ideaDoc, { items: encryptedItems }, { merge: true });
        await updateSyncTimestamp();
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
        await updateSyncTimestamp();
    } catch (error) {
        console.error("Error deleting idea: ", error);
    }
}

export async function batchDeleteIdeasFromFirebase(ids: number[]): Promise<void> {
    const user = authCheck();
    if (!user || ids.length === 0) return;
    try {
        const batch = writeBatch(db);
        ids.forEach(id => {
            batch.delete(doc(db, "users", user.uid, "ideas", id.toString()));
        });
        await batch.commit();
        await updateSyncTimestamp();
    } catch (error) {
        console.error("Error batch deleting ideas: ", error);
    }
}

export async function updateIdeaParentIdInFirebase(ideaId: number, newParentId: number) {
    const user = authCheck();
    if (!user) return;

    try {
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await setDoc(ideaDoc, { parentID: newParentId }, { merge: true });
        await updateSyncTimestamp();
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
        await updateSyncTimestamp();
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
        await updateSyncTimestamp();
    } catch (error) {
        console.error("Error updating idea link: ", error);
    }
}

export async function fetchLastSeenPatchVersion(): Promise<string | null> {
    const user = authCheck();
    if (!user) return null;
    const prefsDoc = doc(db, "users", user.uid, "meta", "preferences");
    const snap = await getDoc(prefsDoc);
    if (!snap.exists()) return null;
    return (snap.data().lastSeenPatchVersion as string) ?? null;
}

export async function updateLastSeenPatchVersion(version: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const prefsDoc = doc(db, "users", user.uid, "meta", "preferences");
    await setDoc(prefsDoc, { lastSeenPatchVersion: version }, { merge: true });
}

export async function fetchOnboardingSeen(): Promise<boolean> {
    const user = authCheck();
    if (!user) return false;
    const prefsDoc = doc(db, "users", user.uid, "meta", "preferences");
    const snap = await getDoc(prefsDoc);
    if (!snap.exists()) return false;
    return (snap.data().onboardingSeen as boolean) ?? false;
}

export async function markOnboardingSeen(): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const prefsDoc = doc(db, "users", user.uid, "meta", "preferences");
    await setDoc(prefsDoc, { onboardingSeen: true }, { merge: true });
}

export async function updateIdeaPriorityInFirebase(ideaId: number, priority: 1 | 2 | 3 | undefined): Promise<void> {
    const user = authCheck();
    if (!user) return;
    try {
        const ideaDoc = doc(db, "users", user.uid, "ideas", ideaId.toString());
        await setDoc(ideaDoc, { priority: priority ?? deleteField() }, { merge: true });
        await updateSyncTimestamp();
    } catch (error) {
        console.error("Error updating idea priority: ", error);
    }
}
