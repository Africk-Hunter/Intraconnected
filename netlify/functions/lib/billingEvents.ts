import type Stripe from "stripe";

export type BillingPlan = "free" | "annual" | "lifetime";

export interface BillingDoc {
    plan: BillingPlan;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionStatus: Stripe.Subscription.Status | null;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
    updatedAt: number;
}

export interface BillingEventResult {
    uid: string;
    update: BillingDoc;
}

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
    if (!customer) return null;
    return typeof customer === "string" ? customer : customer.id;
}

// Pure mapping from an already-signature-verified Stripe event to the
// Firestore write it implies. Kept free of any Stripe/Firestore SDK calls so
// it's unit-testable against plain fixture objects. Returns null for event
// types we don't act on (e.g. invoice.payment_failed) or that are missing
// the uid we need to resolve the account.
export function deriveBillingUpdate(event: Stripe.Event): BillingEventResult | null {
    switch (event.type) {
        case "payment_intent.succeeded": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const uid = paymentIntent.metadata?.firebaseUid;
            if (!uid) return null;
            return {
                uid,
                update: {
                    plan: "lifetime",
                    stripeCustomerId: customerId(paymentIntent.customer),
                    stripeSubscriptionId: null,
                    subscriptionStatus: null,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    updatedAt: Date.now(),
                },
            };
        }

        case "customer.subscription.updated": {
            const sub = event.data.object as Stripe.Subscription;
            const uid = sub.metadata?.firebaseUid;
            if (!uid) return null;
            return {
                uid,
                update: {
                    plan: "annual",
                    stripeCustomerId: customerId(sub.customer),
                    stripeSubscriptionId: sub.id,
                    subscriptionStatus: sub.status,
                    currentPeriodEnd: sub.items.data[0]?.current_period_end ? sub.items.data[0].current_period_end * 1000 : null,
                    cancelAtPeriodEnd: sub.cancel_at_period_end,
                    updatedAt: Date.now(),
                },
            };
        }

        case "customer.subscription.deleted": {
            const sub = event.data.object as Stripe.Subscription;
            const uid = sub.metadata?.firebaseUid;
            if (!uid) return null;
            return {
                uid,
                update: {
                    plan: "free",
                    stripeCustomerId: customerId(sub.customer),
                    stripeSubscriptionId: null,
                    subscriptionStatus: "canceled",
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    updatedAt: Date.now(),
                },
            };
        }

        default:
            return null;
    }
}

const LIFETIME_UPGRADE_DISCOUNT_ELIGIBLE_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing"];

// Annual subscribers already paid for the current term, so they get a flat
// credit toward Lifetime regardless of how far into the year they are (not
// day-prorated — the whole annual price is ~$2, not worth date math for).
// cancelAtPeriodEnd is deliberately not checked: a cancel-pending sub is
// still paid-through and stays eligible until access actually lapses.
// Cancel/resubscribe discount-farming is an accepted risk given the amounts.
export function isEligibleForLifetimeUpgradeDiscount(
    billing: Pick<BillingDoc, "plan" | "subscriptionStatus"> | null
): boolean {
    if (!billing) return false;
    if (billing.plan !== "annual") return false;
    return billing.subscriptionStatus !== null && LIFETIME_UPGRADE_DISCOUNT_ELIGIBLE_STATUSES.includes(billing.subscriptionStatus);
}
