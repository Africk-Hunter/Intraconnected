import { auth } from "../../firebaseConfig";
import { clearDEK, getDEK } from "../dekStore";
import { wrapDEKWithEmail } from "../crypto";
import { storePendingEmailWrap } from "./encryptionKeys";
import { flushOutbox } from "../sync/outbox";
import {
    verifyBeforeUpdateEmail,
    EmailAuthProvider,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    sendEmailVerification,
} from "firebase/auth";

// How long sign-out waits for unsent changes to reach the server. Anything
// still unsent after this isn't lost — it stays in this account's outbox on
// this device and goes out the next time the same account signs in here.
const SIGN_OUT_FLUSH_MS = 5000;

export async function signUserOut() {
    try {
        // Before clearDEK — sending a change needs the key to encrypt it.
        await flushOutbox(SIGN_OUT_FLUSH_MS);
        clearDEK();
        await auth.signOut();
        window.location.href = '/login';
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
        let message = 'Something went wrong. Please try again.';
        try {
            const body = await res.json() as { error?: string };
            if (body.error) message = body.error;
        } catch {
            // Non-JSON error body — keep the generic message.
        }
        throw new Error(message);
    }

    // The Auth user record is already gone server-side at this point —
    // signOut just clears the client's local session state to match.
    // Key first: the session-ended modal only opens while the key is still held.
    clearDEK();
    try {
        await auth.signOut();
    } catch {
        // Already gone server-side; nothing left to sign out of.
    }

    localStorage.clear();
    window.location.href = '/';
}

// Asks the server whether another account already uses this address (see
// check-email-available.ts for why Firebase can't be asked from the browser).
async function isEmailAvailable(email: string): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user");
    const idToken = await user.getIdToken();
    const res = await fetch('/.netlify/functions/check-email-available', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error("Could not check that email address");
    return ((await res.json()) as { available: boolean }).available;
}

// Starts an email change. Firebase emails a link to the NEW address and only
// switches the account over once it's clicked (handled in AuthAction.tsx), so
// a typo can't lock anyone out. Needs the password (fresh sign-in), and the
// unlocked key: the recovery wrap is derived from the email, so a copy for the
// new address is stored now — the click may happen with no key available.
export async function requestEmailChange(password: string, newEmail: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw Object.assign(new Error("Not signed in"), { code: "app/not-signed-in" });
    // user.email can be empty while the password provider's record still has
    // it; reauthenticating needs the address the account signs in with.
    const currentEmail = user.email ?? user.providerData.find(p => p.providerId === 'password')?.email ?? null;
    if (!currentEmail) {
        console.error('requestEmailChange: signed-in user has no email', { uid: user.uid, providers: user.providerData.map(p => p.providerId) });
        throw Object.assign(new Error("Account has no email"), { code: "app/no-account-email" });
    }

    const normalized = newEmail.trim().toLowerCase();
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(currentEmail, password));

    if (!(await isEmailAvailable(normalized))) {
        throw Object.assign(new Error("Email already in use"), { code: "auth/email-already-in-use" });
    }

    const wrap = await wrapDEKWithEmail(getDEK(), normalized, user.uid);
    await storePendingEmailWrap(normalized, wrap);
    await verifyBeforeUpdateEmail(user, normalized);
}

// Copies the account's current email onto its Stripe Customer (no-op for
// accounts that never checked out). Best-effort at the call sites.
export async function syncBillingEmail(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    const res = await fetch('/.netlify/functions/sync-billing-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error("Could not update billing email");
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
