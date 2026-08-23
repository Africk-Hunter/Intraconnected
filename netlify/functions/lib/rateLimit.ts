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

// Firestore-tracked sliding-window limiter, same shape as the bespoke one
// submit-feature-request.ts already had (a pruned array of hit timestamps)
// but factored out for the other user-invoked functions that had no rate
// limiting at all. submit-feature-request.ts is left on its own inline
// version rather than migrated — its timestamp array doubles as the
// GitHub-issue tracking list, so unifying the storage shape isn't a
// same-behavior change.
//
// Admin SDK only (called from Netlify Functions, never the client), so this
// never needs a Firestore rules entry — rules don't apply to Admin SDK
// calls at all.
export async function checkRateLimit({ uid, key, limit, windowMs }: RateLimitOptions): Promise<boolean> {
    const ref = firestore().collection("users").doc(uid).collection("meta").doc(`rateLimit_${key}`);
    const snap = await ref.get();
    const existing: number[] = snap.exists ? (snap.data()?.hits ?? []) : [];

    const since = Date.now() - windowMs;
    const recent = existing.filter((ts) => ts >= since);
    if (recent.length >= limit) return false;

    recent.push(Date.now());
    await ref.set({ hits: recent });
    return true;
}
