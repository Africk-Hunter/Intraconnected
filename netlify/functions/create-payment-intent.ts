import type { Context } from "@netlify/functions";
import type Stripe from "stripe";
import { verifyIdTokenDetailed } from "./lib/firebaseAdmin";
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

// TEMP: step-by-step tracing while debugging the annual-upgrade 502 — safe
// to leave in (dev-only visibility, no secrets logged), but fine to trim
// once the cause is confirmed.
const DEBUG = "[create-payment-intent]";

export default async (req: Request, _context: Context) => {
    const preflight = preflightResponse(req);
    if (preflight) return preflight;

    function jsonError(status: number, message: string) {
        return jsonResponse(req, { error: message }, status);
    }

    console.log(DEBUG, "invoked", { method: req.method });

    if (req.method !== "POST") {
        return jsonError(405, "Method not allowed.");
    }

    let user: { uid: string; emailVerified: boolean } | null;
    try {
        user = await verifyIdTokenDetailed(req);
    } catch (error) {
        console.error(DEBUG, "verifyIdToken threw", error);
        return jsonError(401, "You must be signed in to upgrade.");
    }
    console.log(DEBUG, "verifyIdToken resolved", { signedIn: Boolean(user) });
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
    console.log(DEBUG, "plan requested", { plan });
    if (plan !== "annual" && plan !== "lifetime") {
        return jsonError(400, "Plan must be 'annual' or 'lifetime'.");
    }

    const priceId = PRICE_IDS[plan];
    console.log(DEBUG, "resolved priceId from env", { plan, hasPriceId: Boolean(priceId) });
    if (!priceId) {
        return jsonError(500, "Server misconfigured.");
    }

    try {
        // Fetched once up front and reused by both branches below — this is
        // also what the double-billing/repurchase guards check against, so
        // it needs to happen before either branch commits to a Stripe call.
        const billing = await getBillingDoc(uid);
        console.log(DEBUG, "billing doc fetched", { plan: billing?.plan ?? null, subscriptionStatus: billing?.subscriptionStatus ?? null });

        if (plan === "lifetime") {
            // Already own it outright — a second purchase would just be a
            // wasted charge for something they already have. Checked before
            // resolving a customer below, so a rejected request never costs
            // an extra Stripe call.
            if (billing?.plan === "lifetime") {
                console.log(DEBUG, "lifetime checkout rejected — already lifetime");
                return jsonError(409, "You already have Lifetime access.");
            }

            const { amount, currency } = await getLifetimePrice(uid, priceId);
            console.log(DEBUG, "lifetime price resolved", { amount, currency });

            // Reuse the Stripe Customer already on file rather than leaving
            // this PaymentIntent anonymous — so a Lifetime purchase doesn't
            // sever the relationship a prior Annual subscription already
            // established. That relationship (and its saved payment method)
            // is what lets stripe-webhook.ts resume Annual billing
            // off-session if an annual→lifetime upgrade later gets refunded.
            const customer = billing?.stripeCustomerId
                ?? (await stripe().customers.create({ metadata: { firebaseUid: uid } })).id;
            console.log(DEBUG, "customer resolved", { customer });

            const paymentIntent = await stripe().paymentIntents.create({
                amount,
                currency,
                // Card only — automatic_payment_methods pulls in every method
                // enabled on the account (bank, Klarna, Cash App, Link's
                // signup fields...), which is a lot of vertical space for a
                // $5 purchase.
                payment_method_types: ["card"],
                customer,
                metadata: { firebaseUid: uid, plan: "lifetime" },
            });
            console.log(DEBUG, "lifetime PaymentIntent created", { id: paymentIntent.id, hasClientSecret: Boolean(paymentIntent.client_secret) });

            return jsonResponse(req, { clientSecret: paymentIntent.client_secret, amount, currency });
        }

        // Already have a live Annual subscription — Stripe allows multiple
        // subscriptions per customer, so subscriptions.create below would
        // silently create a second, independent one rather than reuse or
        // reject the existing one. Reject here instead of double-billing.
        if (billing?.subscriptionStatus && ACTIVE_SUBSCRIPTION_STATUSES.includes(billing.subscriptionStatus)) {
            console.log(DEBUG, "annual checkout rejected — already has a live subscription", { status: billing.subscriptionStatus });
            return jsonError(409, "You already have an active Annual subscription.");
        }

        // Reuse the Stripe Customer already on file so repeated subscribe
        // attempts don't create duplicate Customer objects.
        const customer = billing?.stripeCustomerId
            ?? (await stripe().customers.create({ metadata: { firebaseUid: uid } })).id;
        console.log(DEBUG, "customer resolved", { customer });

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
        console.log(DEBUG, "subscription created", { id: subscription.id, status: subscription.status });

        const invoice = subscription.latest_invoice as Stripe.Invoice | null;
        console.log(DEBUG, "latest_invoice on subscription", {
            invoiceId: invoice?.id ?? null,
            invoiceStatus: invoice?.status ?? null,
            hasConfirmationSecret: Boolean(invoice?.confirmation_secret),
            // Not in this SDK version's Invoice type (superseded by
            // confirmation_secret) but logging the raw field in case it's
            // still present on the wire — tells us whether this is a
            // finalization-timing gap or a field-name mismatch.
            legacyPaymentIntentField: (invoice as unknown as { payment_intent?: unknown })?.payment_intent ?? null,
        });

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
