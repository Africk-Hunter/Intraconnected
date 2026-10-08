import { stripe } from "./lib/stripe";
import { jsonResponse } from "./lib/cors";
import { checkRateLimit } from "./lib/rateLimit";
import { authed } from "./lib/handler";
import { getBillingDoc } from "./lib/lifetimePricing";
import { SUPPORT_EMAIL } from "./lib/support";

// Self-serve, no-questions-asked refund window. Annual subscribers already
// have a bloodless self-serve remedy (cancel-subscription.ts's
// cancel_at_period_end lets the subscription just lapse) — Lifetime doesn't,
// since there's nothing to "let lapse" on a one-time purchase. Bounded and
// automatic rather than a support queue, matching how low the dollar amount
// involved is (see LIFETIME_PRICE_DISPLAY). Anything outside the window is
// pointed at SUPPORT_EMAIL for a manual Stripe Dashboard refund instead.
const REFUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const REFUND_RATE_LIMIT = 3;
const REFUND_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export default authed({ signInMessage: "You must be signed in to request a refund." }, async ({ req, uid, fail }) => {
    const allowed = await checkRateLimit({ uid, key: "refundLifetime", limit: REFUND_RATE_LIMIT, windowMs: REFUND_RATE_WINDOW_MS });
    if (!allowed) {
        return fail(429, "Too many refund attempts. Please wait a bit and try again.");
    }

    const billing = await getBillingDoc(uid);

    if (!billing || billing.plan !== "lifetime") {
        return fail(400, "You don't have a Lifetime purchase to refund.");
    }
    if (!billing.lifetimePaymentIntentId) {
        // Only possible for a doc written before this field existed —
        // nothing to look the charge up by without it.
        return fail(400, `Couldn't find your purchase on file — email ${SUPPORT_EMAIL} and we'll take care of it.`);
    }
    if (Date.now() - billing.updatedAt > REFUND_WINDOW_MS) {
        return fail(400, `Self-serve refunds are only available within 14 days of purchase. Email ${SUPPORT_EMAIL} and we'll help.`);
    }

    try {
        // The actual plan downgrade happens via the charge.refunded webhook
        // (deriveLifetimeRefundUpdate — already idempotent and tested), not
        // written here. This function's only job is triggering the refund
        // itself; Stripe reporting it back is what changes anything in
        // Firestore.
        await stripe().refunds.create({ payment_intent: billing.lifetimePaymentIntentId });
        return jsonResponse(req, { success: true });
    } catch (err) {
        console.error("refund-lifetime: failed to create refund", uid, err);
        return fail(502, `Failed to process refund. Please try again or email ${SUPPORT_EMAIL}.`);
    }
});
