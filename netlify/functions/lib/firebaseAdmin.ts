import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
    const existing = getApps();
    if (existing.length > 0) return existing[0]!;

    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!encoded) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set.");
    }
    const serviceAccount = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    return initializeApp({ credential: cert(serviceAccount) });
}

export function firestore() {
    return getFirestore(getAdminApp());
}

export function adminAuth() {
    return getAuth(getAdminApp());
}

export async function verifyIdToken(req: Request): Promise<string | null> {
    const header = req.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length);
    try {
        const decoded = await adminAuth().verifyIdToken(token);
        return decoded.uid;
    } catch {
        return null;
    }
}

export interface VerifiedUser {
    uid: string;
    emailVerified: boolean;
}

// Like verifyIdToken, but also surfaces the token's email_verified claim —
// for the one caller (create-payment-intent.ts) that needs to gate on it.
// Everyone else keeps using the uid-only verifyIdToken above; account
// deletion/cancellation in particular must never be blocked by this, since
// re-auth with the password is already the real gate there.
export async function verifyIdTokenDetailed(req: Request): Promise<VerifiedUser | null> {
    const header = req.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length);
    try {
        const decoded = await adminAuth().verifyIdToken(token);
        return { uid: decoded.uid, emailVerified: decoded.email_verified === true };
    } catch {
        return null;
    }
}
