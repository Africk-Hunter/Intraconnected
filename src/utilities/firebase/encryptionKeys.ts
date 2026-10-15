import { db } from "../../firebaseConfig";
import { doc, setDoc, getDoc, deleteField } from "firebase/firestore";
import { authCheck } from "./currentUser";

// The wrapped copies of the account's data key (see crypto.ts and
// CLAUDE.md → Client-side encryption), at users/{uid}/meta/encryption.

export interface EncryptionDoc {
    encryptedDEK: string;
    recoveryWrap?: string;
    emailEncryptedDEK?: string;
    // Legacy recovery metadata: sign-in compares it to the current email and
    // re-wraps only when they differ.
    emailWrapFor?: string;
    // Written when an email change is requested, while the key is in memory:
    // the same key wrapped for the *new* address. The change completes later,
    // from a link, possibly with no key available — so if the user then resets
    // their password before signing in, recovery can still use this wrap.
    pendingEmail?: string;
    pendingEmailEncryptedDEK?: string;
}

export async function storeEncryptedDEK(
    encryptedDEK: string,
    recoveryWrap: string
): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, {
        encryptedDEK,
        recoveryWrap,
    });
}

// Replaces only the password wrap.
export async function storePasswordWrap(encryptedDEK: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    await setDoc(doc(db, "users", user.uid, "meta", "encryption"), { encryptedDEK }, { merge: true });
}

export async function storeRecoveryWrap(recoveryWrap: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    await setDoc(doc(db, "users", user.uid, "meta", "encryption"), { recoveryWrap }, { merge: true });
}

// Legacy accounts only: drops the old email-derived recovery fields.
export async function removeLegacyEmailWrap(): Promise<void> {
    const user = authCheck();
    if (!user) return;
    await setDoc(doc(db, "users", user.uid, "meta", "encryption"), {
        emailEncryptedDEK: deleteField(),
        emailWrapFor: deleteField(),
        pendingEmail: deleteField(),
        pendingEmailEncryptedDEK: deleteField(),
    }, { merge: true });
}

export async function fetchEncryptedDEK(): Promise<EncryptionDoc | null> {
    const user = authCheck();
    if (!user) return null;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    const snap = await getDoc(metaDoc);
    if (!snap.exists()) return null;
    return snap.data() as EncryptionDoc;
}
