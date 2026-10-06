import type { Context } from "@netlify/functions";
import type Stripe from "stripe";
import { verifyIdTokenDetailed, type VerifiedUser } from "./lib/firebaseAdmin";
import { stripe } from "./lib/stripe";
import { getBillingDoc, getLifetimePrice } from "./lib/lifetimePricing";
import { preflightResponse, jsonResponse } from "./lib/cors";
import { checkRateLimit } from "./lib/rateLimit";

type PlanKey = "annual" | "lifetime";

const PRICE_IDS: Record<PlanKey, string | undefined> = {
    annual: process.env.STRIPE_PRICE_ANNUAL,
    lifetime: process.env.STRIPE_PRICE_LIFETIME,
};

// Statuses that mean "there's already a live Annual subscription" — starting
// a second one via subscriptions.create would double-bill rather than fix
// anything (Stripe allows multiple subscriptions per customer, it doesn't
// dedupe for you). past_due is included: that subscription still exists and
// is still trying to collect, so the fix there is updating the payment
// method, not stacking a new subscription on top of it.
const ACTIVE_SUBSCRIPTION_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

// A handful of legitimate retries (a declined card, a typo'd CVC) is normal;
// this only needs to stop unbounded hammering of a real Stripe-calling
// endpoint, not police normal checkout friction.
const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_RATE_WINDOW_MS = 60 * 60 * 1000;

const DEBUG = "[create-payment-intent]";

// Reuses the Stripe Customer already on file (so repeated checkouts and a
// later Lifetime purchase stay on one Customer — stripe-webhook.ts relies on
// that to restore Annual if an upgrade is refunded), creating one only the
// first time. Either way the Customer carries the account's verified email:
// without one Stripe can't send receipts, failed-payment notices or renewal
// reminders. Existing Customers are updated rather than trusted, so ones
// created before this existed (or before an email change) get backfilled.
async function resolveCustomer(existingId: string | null | undefined, uid: string, email: string | null): Promise<string> {
    if (existingId) {
        try {
            if (email) await stripe().customers.update(existingId, { email });
            return existingId;
        } catch (err) {
            // A Customer deleted in the Dashboard still sits in meta/billing;
            // fall through and make a new one instead of failing checkout.
            if ((err as { code?: string }).code !== "resource_missing") throw err;
        }
    }
    const created = await stripe().customers.create({
        ...(email ? { email } : {}),
        metadata: { firebaseUid: uid },
    });
    return created.id;
}

export default async (req: Request, _context: Context) => {
    const preflight = preflightResponse(req);
    if (preflight) return preflight;

    function jsonError(status: number, message: string) {
        return jsonResponse(req, { error: message }, status);
    }

    if (req.method !== "POST") {
        return jsonError(405, "Method not allowed.");
    }

    let user: VerifiedUser | null;
    try {
        user = await verifyIdTokenDetailed(req);
    } catch (error) {
        console.error(DEBUG, "verifyIdToken threw", error);
        return jsonError(401, "You must be signed in to upgrade.");
    }
    if (!user) {
        return jsonError(401, "You must be signed in to upgrade.");
    }
    // A real, confirmed email is what makes a receipt and support contact
    // possible for a paid account — gated here (not just nudged client-side)
    // so hitting this function directly can't skip it either.
    if (!user.emailVerified) {
        return jsonError(403, "Please verify your email address before upgrading — check your inbox for the verification link.");
    }
    const uid = user.uid;

    const allowed = await checkRateLimit({ uid, key: "checkout", limit: CHECKOUT_RATE_LIMIT, windowMs: CHECKOUT_RATE_WINDOW_MS });
    if (!allowed) {
        return jsonError(429, "Too many checkout attempts. Please wait a bit and try again.");
    }

    let payload: { plan?: unknown };
    try {
        payload = (await req.json()) as { plan?: unknown };
    } catch (error) {
        console.error(DEBUG, "failed to parse request body", error);
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
        // Fetched once up front and reused by both branches below — this is
        // also what the double-billing/repurchase guards check against, so
        // it needs to happen before either branch commits to a Stripe call.
        const billing = await getBillingDoc(uid);

        if (plan === "lifetime") {
            // Already own it outright — a second purchase would just be a
            // wasted charge for something they already have. Checked before
            // resolving a customer below, so a rejected request never costs
            // an extra Stripe call.
            if (billing?.plan === "lifetime") {
                return jsonError(409, "You already have Lifetime access.");
            }

            const { amount, currency } = await getLifetimePrice(uid, priceId);

            // Kept on the same Customer as any prior Annual subscription (see
            // resolveCustomer) rather than left anonymous — that Customer's
            // canceled subscription and saved card are what stripe-webhook.ts
            // restores Annual from if an annual→lifetime upgrade is refunded.
            const customer = await resolveCustomer(billing?.stripeCustomerId, uid, user.email);

            const paymentIntent = await stripe().paymentIntents.create({
                amount,
                currency,
                // Card only — automatic_payment_methods pulls in every method
                // enabled on the account (bank, Klarna, Cash App, Link's
                // signup fields...), which is a lot of vertical space for a
                // small one-time purchase.
                payment_method_types: ["card"],
                customer,
                // A one-time PaymentIntent doesn't pick up the Customer's
                // email for receipts on its own.
                ...(user.email ? { receipt_email: user.email } : {}),
                metadata: { firebaseUid: uid, plan: "lifetime" },
            });

            return jsonResponse(req, { clientSecret: paymentIntent.client_secret, amount, currency });
        }

        // Already have a live Annual subscription — Stripe allows multiple
        // subscriptions per customer, so subscriptions.create below would
        // silently create a second, independent one rather than reuse or
        // reject the existing one. Reject here instead of double-billing.
        if (billing?.subscriptionStatus && ACTIVE_SUBSCRIPTION_STATUSES.includes(billing.subscriptionStatus)) {
            return jsonError(409, "You already have an active Annual subscription.");
        }

        const customer = await resolveCustomer(billing?.stripeCustomerId, uid, user.email);

        const subscription = await stripe().subscriptions.create({
            customer,
            items: [{ price: priceId }],
            payment_behavior: "default_incomplete",
            // Card only — see the matching note on the lifetime PaymentIntent
            // above.
            payment_settings: { save_default_payment_method: "on_subscription", payment_method_types: ["card"] },
            // confirmation_secret is opt-in — expanding latest_invoice alone
            // returns it as an object but *without* confirmation_secret
            // populated (confirmed against the live API: it's simply absent
            // from the response unless explicitly requested). The dotted
            // path expands both the invoice and this nested field in one call.
            expand: ["latest_invoice.confirmation_secret"],
            // customer.subscription.updated/.deleted (billingEvents.ts) key
            // off this to resolve the account — carries no client_reference_id
            // of its own the way a Checkout Session did.
            metadata: { firebaseUid: uid },
        });

        const invoice = subscription.latest_invoice as Stripe.Invoice | null;
        const clientSecret = invoice?.confirmation_secret?.client_secret;
        if (!clientSecret) {
            console.error(DEBUG, "no confirmation_secret.client_secret on latest_invoice — returning 502");
            return jsonError(502, "Failed to create subscription.");
        }

        return jsonResponse(req, { clientSecret, amount: invoice.amount_due, currency: invoice.currency });
    } catch (error) {
        console.error(DEBUG, "threw", error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error);
        return jsonError(502, "Failed to start checkout.");
    }
};
