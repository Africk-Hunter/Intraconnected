import { Timestamp } from "firebase-admin/firestore";
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
// For endpoints open to signed-out visitors (a sign-in error is exactly when
// someone has no account to attribute a report to). Keyed by a hash of the
// caller's IP in its own top-level collection, so no fake `users/{uid}` docs
// appear. Same Admin-SDK-only note as above: clients are denied by default.
//
// The hash is keyed with a server secret: a plain SHA-256 of an IPv4 address
// can be reversed by hashing all 4 billion of them. The privacy policy relies
// on this ("we cannot reverse it") and on `expireAt`, which the daily
// cleanup-rate-limits function uses to delete the doc once the window has
// passed.
export async function checkIpRateLimit({ ip, key, limit, windowMs }: { ip: string; key: string; limit: number; windowMs: number }): Promise<boolean> {
    const { createHmac } = await import("node:crypto");
    const secret = process.env.IP_HASH_SECRET || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!secret) throw new Error("No secret to hash IP addresses with.");
    const db = firestore();
    const id = `${key}_${createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32)}`;
    const ref = db.collection("rateLimits").doc(id);

    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const existing: number[] = snap.exists ? (snap.data()?.hits ?? []) : [];

        const since = Date.now() - windowMs;
        const recent = existing.filter((ts) => ts >= since);
        if (recent.length >= limit) return false;

        recent.push(Date.now());
        tx.set(ref, { hits: recent, expireAt: Timestamp.fromMillis(Date.now() + windowMs) });
        return true;
    });
}

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
