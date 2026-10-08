import { getLifetimePrice } from "./lib/lifetimePricing";
import { jsonResponse } from "./lib/cors";
import { authed } from "./lib/handler";

const PRICE_ID = process.env.STRIPE_PRICE_LIFETIME;

// Read-only preview of what create-payment-intent.ts would actually charge
// for Lifetime — lets the upgrade-picker modal show the real (possibly
// Annual-upgrade-discounted) price before the user has committed to a plan,
// without creating a throwaway PaymentIntent just to find out.
export default authed({ method: "GET", signInMessage: "You must be signed in." }, async ({ req, uid, fail }) => {
    if (!PRICE_ID) {
        return fail(500, "Server misconfigured.");
    }

    try {
        const { amount, currency, discountCents } = await getLifetimePrice(uid, PRICE_ID);
        return jsonResponse(req, { amount, currency, discountCents });
    } catch (error) {
        console.error("get-lifetime-price failed:", error);
        return fail(502, "Failed to load pricing.");
    }
});
