import { auth } from "../../firebaseConfig";
import { clearDEK } from "../dekStore";
import {
    EmailAuthProvider,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    sendEmailVerification,
} from "firebase/auth";

export async function signUserOut() {
    try {
        clearDEK();
        await auth.signOut();
        window.location.href = '/';
    } catch (error) {
        console.error("Sign out error:", error);
    }
}

// Reauthenticates client-side (confirms the password before an irreversible
// action, and is what surfaces auth/wrong-password to the caller), then
// hands the actual deletion to the delete-account Netlify Function — it
// needs the Admin SDK to cancel any Stripe subscription and can then wipe
// Firestore/Auth in one place rather than the client doing it doc-by-doc.
export async function deleteUserAccount(password: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("No authenticated user");

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    const idToken = await user.getIdToken();
    const res = await fetch('/.netlify/functions/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
        throw new Error(await res.text());
    }

    // The Auth user record is already gone server-side at this point —
    // signOut just clears the client's local session state to match.
    try {
        await auth.signOut();
    } catch {
        // Already gone server-side; nothing left to sign out of.
    }

    clearDEK();
    localStorage.clear();
    window.location.href = '/';
}

export async function sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
}

export async function resendVerificationEmail(): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user");
    await sendEmailVerification(user);
}

// Firebase caches emailVerified on both the local user object and any
// already-issued ID token — reload() refreshes the former from the server,
// and forcing a token refresh is what makes the server-side check in
// create-payment-intent.ts (which reads the claim off the token, not a
// fresh Admin SDK lookup) see a just-completed verification too.
export async function refreshEmailVerified(): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return false;
    await user.reload();
    await user.getIdToken(true);
    return user.emailVerified;
}
