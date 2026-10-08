import { firestore } from "./firebaseAdmin";
import { ANNUAL_PRICE_CENTS } from "../../../shared/pricing";
import { stripe } from "./stripe";
import { isEligibleForLifetimeUpgradeDiscount, type BillingDoc } from "./billingEvents";

// Flat credit toward Lifetime for existing Annual subscribers, equal to
// what they already paid for the year. Not a secret/per-environment value —
// committed as a constant (shared with the app's displayed price) rather than
// an env var, since env vars aren't committed and this needs to just work in
// every environment without extra setup.
const LIFETIME_UPGRADE_DISCOUNT_CENTS = ANNUAL_PRICE_CENTS;

export async function getBillingDoc(uid: string): Promise<BillingDoc | null> {
    const doc = await firestore().collection("users").doc(uid).collection("meta").doc("billing").get();
    return doc.exists ? (doc.data() as BillingDoc) : null;
}

const FIRESTORE_ALREADY_EXISTS = 6;

// Writes the Stripe Customer id onto meta/billing as soon as checkout
// creates it, rather than waiting for the first webhook. create-payment-intent
// asks Stripe "does this customer already have a live subscription / paid
// Lifetime?" before charging, and it can only do that if it knows the
// customer — otherwise a second checkout opened before the first purchase's
// webhook lands finds nothing and charges again.
//
// A brand-new doc is written with the full free-plan shape (the client reads
// `plan` straight off this doc, and a missing plan would look uncapped) using
// create(), so it can never overwrite a doc the webhook wrote in the
// meantime; an existing doc only gets the one field merged in.
export async function recordStripeCustomer(uid: string, customerId: string, existing: BillingDoc | null): Promise<void> {
    if (existing?.stripeCustomerId === customerId) return;
    const ref = firestore().collection("users").doc(uid).collection("meta").doc("billing");
    if (existing) {
        await ref.set({ stripeCustomerId: customerId }, { merge: true });
        return;
    }
    try {
        await ref.create({
            plan: "free",
            stripeCustomerId: customerId,
            stripeSubscriptionId: null,
            subscriptionStatus: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            updatedAt: Date.now(),
            previousPlan: null,
            lifetimePaymentIntentId: null,
        } satisfies BillingDoc);
    } catch (err) {
        if ((err as { code?: number }).code !== FIRESTORE_ALREADY_EXISTS) throw err;
        await ref.set({ stripeCustomerId: customerId }, { merge: true });
    }
}

// Best-effort: a failure here should never block checkout, just fall back
// to full price.
export async function getLifetimeUpgradeDiscountCents(uid: string): Promise<number> {
    try {
        const billing = await getBillingDoc(uid);
        return isEligibleForLifetimeUpgradeDiscount(billing) ? LIFETIME_UPGRADE_DISCOUNT_CENTS : 0;
    } catch {
        return 0;
    }
}

export interface LifetimePrice {
    amount: number;
    currency: string;
    discountCents: number;
}

// Shared by create-payment-intent.ts (actually charges this) and
// get-lifetime-price.ts (previews it before checkout opens) so the two
// never drift out of sync.
export async function getLifetimePrice(uid: string, priceId: string): Promise<LifetimePrice> {
    const price = await stripe().prices.retrieve(priceId);
    if (typeof price.unit_amount !== "number") {
        throw new Error("Lifetime price has no unit_amount.");
    }
    const discountCents = await getLifetimeUpgradeDiscountCents(uid);
    const amount = Math.max(price.unit_amount - discountCents, 0);
    return { amount, currency: price.currency, discountCents };
}
