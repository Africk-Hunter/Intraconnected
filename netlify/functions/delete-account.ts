import type { Context } from "@netlify/functions";
import type { Firestore } from "firebase-admin/firestore";
import { verifyIdToken, firestore, adminAuth } from "./lib/firebaseAdmin";
import { stripe } from "./lib/stripe";
import { preflightResponse, jsonResponse } from "./lib/cors";
import { checkRateLimit } from "./lib/rateLimit";

// Destructive and effectively one-shot per account (the account is gone
// after the first success) — this only needs to absorb a handful of retries
// after a transient failure, not support repeated real usage.
const DELETE_RATE_LIMIT = 3;
const DELETE_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function deleteCollection(db: Firestore, uid: string, subcollection: string) {
    const snap = await db.collection("users").doc(uid).collection(subcollection).get();
    const docs = snap.docs;
    // Firestore batches cap at 500 writes — an unlimited-plan user's idea
    // tree can easily exceed that, so chunk it.
    for (let i = 0; i < docs.length; i += 500) {
        const batch = db.batch();
        docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

// Runs the whole account deletion server-side via the Admin SDK, instead of
// the client deleting its own Firestore docs and Auth record. Two reasons:
// this is the only place that can reach Stripe to cancel a subscription
// before the billing doc naming it is gone, and doing the Firestore/Auth
// deletion here too means it doesn't depend on whatever the client happens
// to be allowed to touch under Firestore rules.
export default async (req: Request, _context: Context) => {
    const preflight = preflightResponse(req);
    if (preflight) return preflight;

    function jsonError(status: number, message: string) {
        return jsonResponse(req, { error: message }, status);
    }

    if (req.method !== "POST") {
        return jsonError(405, "Method not allowed.");
    }

    const uid = await verifyIdToken(req);
    if (!uid) {
        return jsonError(401, "You must be signed in to delete your account.");
    }

    const allowed = await checkRateLimit({ uid, key: "deleteAccount", limit: DELETE_RATE_LIMIT, windowMs: DELETE_RATE_WINDOW_MS });
    if (!allowed) {
        return jsonError(429, "Too many attempts. Please wait a bit and try again.");
    }

    const db = firestore();

    // Deleting the account means there's no one left to keep paying for or
    // to grant access to — this is a hard, immediate cancel, unlike the
    // self-serve cancel-subscription.ts flow (cancel_at_period_end), which
    // exists precisely because that user is still around to use out what
    // they already paid for.
    const billingSnap = await db.collection("users").doc(uid).collection("meta").doc("billing").get();
    const subscriptionId = billingSnap.exists ? (billingSnap.data()?.stripeSubscriptionId as string | null | undefined) : null;
    if (subscriptionId) {
        try {
            await stripe().subscriptions.cancel(subscriptionId);
        } catch (err) {
            // Already canceled, or a transient Stripe error — don't let a
            // billing-side failure block the user from deleting their
            // account; log it so a stray subscription can be caught.
            console.error("delete-account: failed to cancel subscription", subscriptionId, err);
        }
    }

    await deleteCollection(db, uid, "ideas");
    await deleteCollection(db, uid, "meta");

    await adminAuth().deleteUser(uid);

    return jsonResponse(req, { success: true });
};
