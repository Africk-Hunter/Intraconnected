import { firestore } from "./firebaseAdmin";
import { stripe } from "./stripe";
import type { BillingDoc } from "./billingEvents";

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

export interface LifetimePrice {
    amount: number;
    currency: string;
}

// The amount create-payment-intent.ts charges for Lifetime, straight from the
// Stripe price.
export async function getLifetimePrice(priceId: string): Promise<LifetimePrice> {
    const price = await stripe().prices.retrieve(priceId);
    if (typeof price.unit_amount !== "number") {
        throw new Error("Lifetime price has no unit_amount.");
    }
    return { amount: price.unit_amount, currency: price.currency };
}
