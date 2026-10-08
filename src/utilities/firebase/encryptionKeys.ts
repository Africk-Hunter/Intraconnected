import { db } from "../../firebaseConfig";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { authCheck } from "./currentUser";

// The wrapped copies of the account's data key (see crypto.ts and
// CLAUDE.md → Client-side encryption), at users/{uid}/meta/encryption.

export async function storeEncryptedDEK(encryptedDEK: string, emailEncryptedDEK: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, { encryptedDEK, emailEncryptedDEK });
}

export async function addEmailEncryptedDEK(emailEncryptedDEK: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, { emailEncryptedDEK }, { merge: true });
}

export async function fetchEncryptedDEK(): Promise<{ encryptedDEK: string; emailEncryptedDEK?: string } | null> {
    const user = authCheck();
    if (!user) return null;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    const snap = await getDoc(metaDoc);
    if (!snap.exists()) return null;
    return snap.data() as { encryptedDEK: string; emailEncryptedDEK?: string };
}
