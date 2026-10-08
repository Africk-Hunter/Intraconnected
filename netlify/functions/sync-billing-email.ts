import { stripe } from "./lib/stripe";
import { jsonResponse } from "./lib/cors";
import { checkRateLimit } from "./lib/rateLimit";
import { authed } from "./lib/handler";
import { adminAuth } from "./lib/firebaseAdmin";
import { getBillingDoc } from "./lib/lifetimePricing";

const SYNC_RATE_LIMIT = 10;
const SYNC_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

// After an email change completes, copies the account's current email onto its
// Stripe Customer so receipts, failed-payment notices and renewal reminders
// reach the new address. The email comes from Firebase Auth (Admin SDK), never
// from the request, so a caller can only ever sync their own verified address.
export default authed({ signInMessage: "You must be signed in to update your billing email." }, async ({ req, uid, fail }) => {
    const allowed = await checkRateLimit({ uid, key: "syncBillingEmail", limit: SYNC_RATE_LIMIT, windowMs: SYNC_RATE_WINDOW_MS });
    if (!allowed) {
        return fail(429, "Too many attempts. Please wait a bit and try again.");
    }

    const customerId = (await getBillingDoc(uid))?.stripeCustomerId;
    if (!customerId) {
        // Never checked out — no Customer to update.
        return jsonResponse(req, { success: true, updated: false });
    }

    try {
        const { email } = await adminAuth().getUser(uid);
        if (!email) return jsonResponse(req, { success: true, updated: false });
        await stripe().customers.update(customerId, { email });
        return jsonResponse(req, { success: true, updated: true });
    } catch (err) {
        console.error("Failed to sync billing email:", err);
        return fail(502, "Failed to update billing email.");
    }
});
