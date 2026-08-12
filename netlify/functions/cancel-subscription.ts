import type { Context } from "@netlify/functions";
import { verifyIdToken, firestore } from "./lib/firebaseAdmin";
import { stripe } from "./lib/stripe";

function jsonError(status: number, message: string) {
    return Response.json({ error: message }, { status });
}

export default async (req: Request, _context: Context) => {
    if (req.method !== "POST") {
        return jsonError(405, "Method not allowed.");
    }

    const uid = await verifyIdToken(req);
    if (!uid) {
        return jsonError(401, "You must be signed in to cancel your subscription.");
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
        return Response.json({ success: true });
    } catch (err) {
        console.error("Failed to cancel subscription:", err);
        return jsonError(502, "Failed to cancel subscription.");
    }
};
