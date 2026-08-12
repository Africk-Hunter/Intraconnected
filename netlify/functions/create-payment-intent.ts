import type { Context } from "@netlify/functions";
import type Stripe from "stripe";
import { verifyIdToken } from "./lib/firebaseAdmin";
import { stripe } from "./lib/stripe";
import { getBillingDoc, getLifetimePrice } from "./lib/lifetimePricing";

type PlanKey = "annual" | "lifetime";

const PRICE_IDS: Record<PlanKey, string | undefined> = {
    annual: process.env.STRIPE_PRICE_ANNUAL,
    lifetime: process.env.STRIPE_PRICE_LIFETIME,
};

function jsonError(status: number, message: string) {
    return Response.json({ error: message }, { status });
}

export default async (req: Request, _context: Context) => {
    if (req.method !== "POST") {
        return jsonError(405, "Method not allowed.");
    }

    const uid = await verifyIdToken(req);
    if (!uid) {
        return jsonError(401, "You must be signed in to upgrade.");
    }

    let payload: { plan?: unknown };
    try {
        payload = (await req.json()) as { plan?: unknown };
    } catch {
        return jsonError(400, "Invalid request body.");
    }

    const plan = payload.plan;
    if (plan !== "annual" && plan !== "lifetime") {
        return jsonError(400, "Plan must be 'annual' or 'lifetime'.");
    }

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
        return jsonError(500, "Server misconfigured.");
    }

    try {
        if (plan === "lifetime") {
            const { amount, currency } = await getLifetimePrice(uid, priceId);

            const paymentIntent = await stripe().paymentIntents.create({
                amount,
                currency,
                // Card only — automatic_payment_methods pulls in every method
                // enabled on the account (bank, Klarna, Cash App, Link's
                // signup fields...), which is a lot of vertical space for a
                // $5 purchase.
                payment_method_types: ["card"],
                metadata: { firebaseUid: uid, plan: "lifetime" },
            });

            return Response.json({ clientSecret: paymentIntent.client_secret, amount, currency });
        }

        // Annual — reuse the Stripe Customer already on file so repeated
        // subscribe attempts don't create duplicate Customer objects.
        const billing = await getBillingDoc(uid);
        const customer = billing?.stripeCustomerId
            ?? (await stripe().customers.create({ metadata: { firebaseUid: uid } })).id;

        const subscription = await stripe().subscriptions.create({
            customer,
            items: [{ price: priceId }],
            payment_behavior: "default_incomplete",
            // Card only — see the matching note on the lifetime PaymentIntent
            // above.
            payment_settings: { save_default_payment_method: "on_subscription", payment_method_types: ["card"] },
            expand: ["latest_invoice"],
            // customer.subscription.updated/.deleted (billingEvents.ts) key
            // off this to resolve the account — carries no client_reference_id
            // of its own the way a Checkout Session did.
            metadata: { firebaseUid: uid },
        });

        const invoice = subscription.latest_invoice as Stripe.Invoice | null;
        const clientSecret = invoice?.confirmation_secret?.client_secret;
        if (!clientSecret) {
            return jsonError(502, "Failed to create subscription.");
        }

        return Response.json({ clientSecret, amount: invoice.amount_due, currency: invoice.currency });
    } catch (error) {
        console.error("create-payment-intent failed:", error);
        return jsonError(502, "Failed to start checkout.");
    }
};
