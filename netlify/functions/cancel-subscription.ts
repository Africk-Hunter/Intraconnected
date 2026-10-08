import { stripe } from "./lib/stripe";
import { jsonResponse } from "./lib/cors";
import { checkRateLimit } from "./lib/rateLimit";
import { authed } from "./lib/handler";
import { getBillingDoc } from "./lib/lifetimePricing";

// Self-serve cancellation shouldn't need to be called often — this is
// generous enough for a user who backs out of the confirm step a few times,
// while still capping unbounded retries against a real Stripe call.
const CANCEL_RATE_LIMIT = 5;
const CANCEL_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export default authed({ signInMessage: "You must be signed in to cancel your subscription." }, async ({ req, uid, fail }) => {
    const allowed = await checkRateLimit({ uid, key: "cancelSubscription", limit: CANCEL_RATE_LIMIT, windowMs: CANCEL_RATE_WINDOW_MS });
    if (!allowed) {
        return fail(429, "Too many cancellation attempts. Please wait a bit and try again.");
    }

    const subscriptionId = (await getBillingDoc(uid))?.stripeSubscriptionId;

    if (!subscriptionId) {
        return fail(400, "No active subscription found.");
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
        return fail(502, "Failed to cancel subscription.");
    }
});
