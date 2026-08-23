import type { Context } from "@netlify/functions";
import { verifyIdToken, firestore } from "./lib/firebaseAdmin";
import { stripe } from "./lib/stripe";
import { preflightResponse, jsonResponse } from "./lib/cors";
import { checkRateLimit } from "./lib/rateLimit";

// Self-serve cancellation shouldn't need to be called often — this is
// generous enough for a user who backs out of the confirm step a few times,
// while still capping unbounded retries against a real Stripe call.
const CANCEL_RATE_LIMIT = 5;
const CANCEL_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

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
        return jsonError(401, "You must be signed in to cancel your subscription.");
    }

    const allowed = await checkRateLimit({ uid, key: "cancelSubscription", limit: CANCEL_RATE_LIMIT, windowMs: CANCEL_RATE_WINDOW_MS });
    if (!allowed) {
        return jsonError(429, "Too many cancellation attempts. Please wait a bit and try again.");
    }

    const billingRef = firestore().collection("users").doc(uid).collection("meta").doc("billing");
    const billingSnap = await billingRef.get();
    const subscriptionId = billingSnap.exists ? (billingSnap.data()?.stripeSubscriptionId as string | null | undefined) : null;

    if (!subscriptionId) {
        return jsonError(400, "No active subscription found.");
    }

    try {
        // cancel_at_period_end (not immediate cancel.subscriptions.cancel) so
        // the user keeps access through what they already paid for; the
        // subsequent customer.subscription.updated webhook mirrors
        // cancel_at_period_end into the Firestore billing doc, and
        // customer.subscription.deleted flips plan to "free" once the period
        // actually ends.
        await stripe().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
        return jsonResponse(req, { success: true });
    } catch (err) {
        console.error("Failed to cancel subscription:", err);
        return jsonError(502, "Failed to cancel subscription.");
    }
};
