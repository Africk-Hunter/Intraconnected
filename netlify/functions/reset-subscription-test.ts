import type { Context } from "@netlify/functions";
import { verifyIdToken, firestore } from "./lib/firebaseAdmin";
import { stripe } from "./lib/stripe";
import { preflightResponse, jsonResponse } from "./lib/cors";

// Testing-only endpoint that lets a signed-in user blow away their own
// billing state back to "free". Unlike cancel-subscription.ts (which sets
// cancel_at_period_end so paying users keep access through the period they
// paid for), this cancels the Stripe subscription immediately so no zombie
// test subscriptions keep renewing, then writes the Firestore billing doc to
// free directly instead of waiting on the customer.subscription.deleted
// webhook round-trip.
//
// The ProfileModal button that calls this is already hidden outside dev
// builds (import.meta.env.DEV) — but that only controls whether the button
// renders, not whether this function is reachable. It's a live, deployed
// endpoint with no role/admin check (only that the caller is signed in), so
// anyone with any account could otherwise POST here directly against a
// production or preview deploy and reset their own billing without going
// through cancel-subscription.ts's cancel_at_period_end semantics. ALLOW_TEST_RESET
// must only ever be set in a local .env (see programmer-docs/stripe-testing.local.md)
// — never in Netlify's site environment variables — so this 404s identically
// to a route that doesn't exist on every deployed instance: production,
// deploy previews, and branch deploys alike.
export default async (req: Request, _context: Context) => {
    if (process.env.ALLOW_TEST_RESET !== "true") {
        return new Response(null, { status: 404 });
    }

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
        return jsonError(401, "You must be signed in.");
    }

    const billingRef = firestore().collection("users").doc(uid).collection("meta").doc("billing");
    const billingSnap = await billingRef.get();
    const subscriptionId = billingSnap.exists ? (billingSnap.data()?.stripeSubscriptionId as string | null | undefined) : null;

    if (subscriptionId) {
        try {
            await stripe().subscriptions.cancel(subscriptionId);
        } catch (err) {
            // Already-canceled subscriptions 404 on Stripe's side — fine to
            // continue resetting Firestore either way.
            console.error("Failed to cancel Stripe subscription during test reset:", err);
        }
    }

    await billingRef.set(
        {
            plan: "free",
            stripeSubscriptionId: null,
            subscriptionStatus: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            previousPlan: null,
            updatedAt: Date.now(),
        },
        { merge: true }
    );

    return jsonResponse(req, { success: true });
};
