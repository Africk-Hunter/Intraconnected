import { db } from "../../firebaseConfig";
import { doc, setDoc, getDoc, deleteField } from "firebase/firestore";
import { authCheck } from "./currentUser";

// The wrapped copies of the account's data key (see crypto.ts and
// CLAUDE.md → Client-side encryption), at users/{uid}/meta/encryption.

export interface EncryptionDoc {
    encryptedDEK: string;
    emailEncryptedDEK?: string;
    // The email emailEncryptedDEK was wrapped with. Sign-in compares it to the
    // account's current email and re-wraps when they differ (after an email
    // change), without paying for a key derivation on every login.
    emailWrapFor?: string;
    // Written when an email change is requested, while the key is in memory:
    // the same key wrapped for the *new* address. The change completes later,
    // from a link, possibly with no key available — so if the user then resets
    // their password before signing in, recovery can still use this wrap.
    pendingEmail?: string;
    pendingEmailEncryptedDEK?: string;
}

export async function storeEncryptedDEK(encryptedDEK: string, emailEncryptedDEK: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, { encryptedDEK, emailEncryptedDEK, ...(user.email ? { emailWrapFor: user.email } : {}) });
}

// Replaces the email wrap (and records which email it is for), leaving the
// password wrap alone, and clears any pending wrap since it's now stale.
export async function storeEmailWrap(emailEncryptedDEK: string, email: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, {
        emailEncryptedDEK,
        emailWrapFor: email,
        pendingEmail: deleteField(),
        pendingEmailEncryptedDEK: deleteField(),
    }, { merge: true });
}

export async function storePendingEmailWrap(pendingEmail: string, pendingEmailEncryptedDEK: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, { pendingEmail, pendingEmailEncryptedDEK }, { merge: true });
}

export async function fetchEncryptedDEK(): Promise<EncryptionDoc | null> {
    const user = authCheck();
    if (!user) return null;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    const snap = await getDoc(metaDoc);
    if (!snap.exists()) return null;
    return snap.data() as EncryptionDoc;
}
