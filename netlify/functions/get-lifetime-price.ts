import type { Context } from "@netlify/functions";
import { verifyIdToken } from "./lib/firebaseAdmin";
import { getLifetimePrice } from "./lib/lifetimePricing";

const PRICE_ID = process.env.STRIPE_PRICE_LIFETIME;

function jsonError(status: number, message: string) {
    return Response.json({ error: message }, { status });
}

// Read-only preview of what create-payment-intent.ts would actually charge
// for Lifetime — lets the upgrade-picker modal show the real (possibly
// Annual-upgrade-discounted) price before the user has committed to a plan,
// without creating a throwaway PaymentIntent just to find out.
export default async (req: Request, _context: Context) => {
    if (req.method !== "GET") {
        return jsonError(405, "Method not allowed.");
    }

    const uid = await verifyIdToken(req);
    if (!uid) {
        return jsonError(401, "You must be signed in.");
    }

    if (!PRICE_ID) {
        return jsonError(500, "Server misconfigured.");
    }

    try {
        const { amount, currency, discountCents } = await getLifetimePrice(uid, PRICE_ID);
        return Response.json({ amount, currency, discountCents });
    } catch (error) {
        console.error("get-lifetime-price failed:", error);
        return jsonError(502, "Failed to load pricing.");
    }
};
