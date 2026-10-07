import type { Context } from "@netlify/functions";
import { verifyIdToken, firestore } from "./lib/firebaseAdmin";
import { preflightResponse, jsonResponse } from "./lib/cors";

// Testing-only endpoint that flips the caller's own billing doc to "annual" or
// "lifetime" without a Stripe payment, for the Profile → Developer Testing tab.
// Gated by ALLOW_TEST_RESET exactly like reset-subscription-test.ts (local .env
// only, never Netlify site env vars), so it 404s on every deployed instance.
// It writes no Stripe objects, so Stripe-side state (Customer, subscriptions)
// is untouched; use "Reset to Free" afterwards to return to a clean state.
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

    let plan: unknown;
    try {
        plan = ((await req.json()) as { plan?: unknown }).plan;
    } catch {
        return jsonError(400, "Invalid request body.");
    }
    if (plan !== "annual" && plan !== "lifetime") {
        return jsonError(400, "plan must be 'annual' or 'lifetime'.");
    }

    const now = Date.now();
    const billingRef = firestore().collection("users").doc(uid).collection("meta").doc("billing");
    await billingRef.set(
        {
            plan,
            stripeSubscriptionId: null,
            subscriptionStatus: plan === "annual" ? "active" : null,
            currentPeriodEnd: plan === "annual" ? now + 365 * 24 * 60 * 60 * 1000 : null,
            cancelAtPeriodEnd: false,
            previousPlan: null,
            updatedAt: now,
        },
        { merge: true }
    );

    return jsonResponse(req, { success: true });
};
