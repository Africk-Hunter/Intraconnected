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

export async function verifyIdToken(req: Request): Promise<string | null> {
    const header = req.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length);
    try {
        const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
        return decoded.uid;
    } catch {
        return null;
    }
}
