import { firestore } from "./firebaseAdmin";

interface RateLimitOptions {
    uid: string;
    // Bucket name — each caller picks its own (e.g. "checkout",
    // "cancelSubscription"), stored as a separate doc so different
    // endpoints' windows never share or clobber each other's hit history.
    key: string;
    limit: number;
    windowMs: number;
}

// Firestore-tracked sliding-window limiter (a pruned array of hit
// timestamps), shared by the user-invoked functions that call Stripe or
// GitHub.
//
// Admin SDK only (called from Netlify Functions, never the client), so this
// never needs a Firestore rules entry — rules don't apply to Admin SDK
// calls at all.
export async function checkRateLimit({ uid, key, limit, windowMs }: RateLimitOptions): Promise<boolean> {
    const db = firestore();
    const ref = db.collection("users").doc(uid).collection("meta").doc(`rateLimit_${key}`);

    // Read and write in one transaction: with a plain get-then-set, N
    // simultaneous requests all read "under the limit" and all go through.
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const existing: number[] = snap.exists ? (snap.data()?.hits ?? []) : [];

        const since = Date.now() - windowMs;
        const recent = existing.filter((ts) => ts >= since);
        if (recent.length >= limit) return false;

        recent.push(Date.now());
        tx.set(ref, { hits: recent });
        return true;
    });
}
