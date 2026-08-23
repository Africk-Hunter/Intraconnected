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
    // Snapshot of `plan` taken at the moment a Lifetime purchase overwrites
    // it — the only record of what a refund should restore, since the
    // purchase itself wipes every other subscription-tracking field (and, in
    // the Annual→Lifetime case, the superseded subscription is canceled in
    // Stripe immediately, not left to expire — see the `payment_intent.succeeded`
    // branch below). Meaningless once `plan` isn't `"lifetime"`; only
    // deriveLifetimeRefundUpdate reads it. `null` on docs written before this
    // field existed — treated the same as `"free"` wherever it's read.
    previousPlan: BillingPlan | null;
    // The PaymentIntent a self-serve refund (refund-lifetime.ts) actually
    // refunds — recorded at purchase time since nothing else on this doc
    // identifies the charge itself (stripeSubscriptionId is null for a
    // Lifetime purchase). Cleared once consumed by a refund, same lifecycle
    // as previousPlan; `null` on docs written before this field existed.
    lifetimePaymentIntentId: string | null;
}

export interface BillingEventResult {
    uid: string;
    update: BillingDoc;
    // Set only when this event should also cause the caller to cancel a
    // *different*, now-superseded Stripe subscription (currently just the
    // Lifetime-purchase case below) — deriveBillingUpdate stays free of
    // Stripe/Firestore SDK calls, so it can only ever describe this as data
    // for the impure caller (stripe-webhook.ts) to act on, never perform it.
    cancelSubscriptionId?: string | null;
}

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
    if (!customer) return null;
    return typeof customer === "string" ? customer : customer.id;
}

// Mirrors the per-event-type uid lookup inside deriveBillingUpdate below —
// lets the caller fetch the user's *current* billing doc before calling it
// (deriveBillingUpdate needs that doc for the checks documented there, but
// can't fetch it itself without an SDK call). Keep in sync with the switch
// below; both are covered in billingEvents.test.ts.
export function extractUidFromEvent(event: Stripe.Event): string | null {
    switch (event.type) {
        case "payment_intent.succeeded":
            return (event.data.object as Stripe.PaymentIntent).metadata?.firebaseUid ?? null;
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
            return (event.data.object as Stripe.Subscription).metadata?.firebaseUid ?? null;
        default:
            return null;
    }
}

// Statuses that keep Annual access. active/trialing are the obvious ones;
// past_due is a deliberate policy call — Stripe's Smart Retries run over
// roughly 2-3 weeks, and revoking access on the very first failed renewal
// charge (which can happen for reasons that have nothing to do with the
// user, like a bank flagging the transaction) is harsher than warranted.
// Everything else — incomplete (first payment never confirmed),
// incomplete_expired (that confirmation window lapsed), unpaid (retries
// exhausted), paused, and canceled if it's ever reported this way instead of
// via .deleted — does not. Deliberately a *stricter* superset than
// LIFETIME_UPGRADE_DISCOUNT_ELIGIBLE_STATUSES below: keeping access during a
// payment hiccup is one thing, handing out a new discount while behind on
// payment is another.
const ANNUAL_ACCESS_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

// Pure mapping from an already-signature-verified Stripe event, plus the
// user's current billing doc (fetched by the caller — see
// extractUidFromEvent above), to the Firestore write it implies. Kept free
// of any Stripe/Firestore SDK calls so it's unit-testable against plain
// fixture objects — `currentBilling` is just another plain-object input, not
// a live read. Returns null for event types we don't act on (e.g.
// invoice.payment_failed), for events missing the uid we need to resolve
// the account, or when there's nothing to change (see the Lifetime-plan
// guards below).
export function deriveBillingUpdate(event: Stripe.Event, currentBilling?: BillingDoc | null): BillingEventResult | null {
    switch (event.type) {
        case "payment_intent.succeeded": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const uid = paymentIntent.metadata?.firebaseUid;
            // Also require the plan tag create-payment-intent.ts stamps
            // alongside firebaseUid on the Lifetime PaymentIntent — belt
            // and suspenders against ever treating some other succeeded
            // PaymentIntent as a Lifetime purchase. (An Annual subscription's
            // own invoice PaymentIntent never carries firebaseUid at all —
            // create-payment-intent.ts only sets metadata on the Subscription
            // object for that flow — so this mainly guards intent, not a
            // known live collision.)
            if (!uid || paymentIntent.metadata?.plan !== "lifetime") return null;
            // Snapshot what plan this account is being upgraded *from*, so a
            // later refund (deriveLifetimeRefundUpdate) knows what to restore
            // instead of always dropping to "free". Guarded against
            // redelivery: if currentBilling is already "lifetime", this event
            // is a retried/duplicate delivery of the *same* original
            // purchase, not a second one (create-payment-intent.ts rejects a
            // second Lifetime purchase outright) — reuse the
            // already-recorded previousPlan rather than overwrite it with
            // "lifetime", which would make a subsequent refund revert to
            // Lifetime itself.
            const previousPlan: BillingPlan =
                currentBilling?.plan === "lifetime" ? (currentBilling.previousPlan ?? "free") : (currentBilling?.plan ?? "free");
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
                    previousPlan,
                    lifetimePaymentIntentId: paymentIntent.id,
                },
                // An Annual subscriber upgrading to Lifetime already paid for
                // this purchase (see the flat, non-prorated credit in
                // lifetimePricing.ts) — the old subscription now needs to
                // stop renewing entirely, immediately, not linger through
                // cancel_at_period_end. The caller performs the actual
                // Stripe cancel call; see stripe-webhook.ts.
                cancelSubscriptionId: currentBilling?.stripeSubscriptionId ?? null,
            };
        }

        case "customer.subscription.updated": {
            const sub = event.data.object as Stripe.Subscription;
            const uid = sub.metadata?.firebaseUid;
            if (!uid) return null;
            // A Lifetime purchase supersedes any Annual subscription. The
            // subscription this event describes is the one about to be (or
            // already being) canceled as a direct result of that purchase —
            // never let it downgrade a plan that's already ahead of it.
            // (customer.subscription.deleted below handles the actual
            // cleanup once that cancellation completes.)
            if (currentBilling?.plan === "lifetime") return null;
            return {
                uid,
                update: {
                    // Recomputed fresh from sub.status on *every* event, not
                    // just granted once and left alone — there's no separate
                    // expiration check anywhere else in this app (no polling,
                    // no "on login" verification; Firestore's onSnapshot just
                    // mirrors whatever's already written whenever a client
                    // happens to be listening). If this doesn't actively
                    // revoke on a bad status, nothing else ever will:
                    // .deleted only fires if Stripe actually deletes the
                    // subscription, which an unpaid-but-still-existing
                    // subscription may never do, depending on dunning config.
                    plan: ANNUAL_ACCESS_STATUSES.includes(sub.status) ? "annual" : "free",
                    stripeCustomerId: customerId(sub.customer),
                    stripeSubscriptionId: sub.id,
                    subscriptionStatus: sub.status,
                    currentPeriodEnd: sub.items.data[0]?.current_period_end ? sub.items.data[0].current_period_end * 1000 : null,
                    cancelAtPeriodEnd: sub.cancel_at_period_end,
                    updatedAt: Date.now(),
                    // Irrelevant while not on Lifetime — passed through
                    // unchanged rather than reset, simply because this event
                    // has no reason to touch it either way.
                    previousPlan: currentBilling?.previousPlan ?? null,
                    lifetimePaymentIntentId: currentBilling?.lifetimePaymentIntentId ?? null,
                },
            };
        }

        case "customer.subscription.deleted": {
            const sub = event.data.object as Stripe.Subscription;
            const uid = sub.metadata?.firebaseUid;
            if (!uid) return null;
            // Same Lifetime-supersedes-Annual precedence as .updated above,
            // but this event is the authoritative "this subscription no
            // longer exists" signal, so — unlike .updated, which can just
            // no-op — the now-defunct subscription-tracking fields still
            // need clearing even though `plan` itself must stay "lifetime".
            if (currentBilling?.plan === "lifetime") {
                return {
                    uid,
                    update: {
                        plan: "lifetime",
                        stripeCustomerId: customerId(sub.customer),
                        stripeSubscriptionId: null,
                        subscriptionStatus: "canceled",
                        currentPeriodEnd: null,
                        cancelAtPeriodEnd: false,
                        updatedAt: Date.now(),
                        // Preserved, not reset — this is the just-superseded
                        // subscription finishing its cancellation, still
                        // mid-upgrade; a refund of the Lifetime purchase that
                        // triggered this needs the snapshot intact.
                        previousPlan: currentBilling.previousPlan ?? null,
                        lifetimePaymentIntentId: currentBilling.lifetimePaymentIntentId ?? null,
                    },
                };
            }
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
                    // Not on Lifetime, so nothing for either field to mean.
                    previousPlan: null,
                    lifetimePaymentIntentId: null,
                },
            };
        }

        default:
            return null;
    }
}

// Fully refunding a Lifetime purchase revokes the access it granted —
// reverting to whatever plan the account actually had *before* that
// purchase (recorded as `previousPlan` at purchase time — see
// `payment_intent.succeeded` above), not unconditionally to "free". A
// free→lifetime purchase reverts to "free"; an annual→lifetime *upgrade*
// reverts to "annual", since that refund is undoing the upgrade, not an
// original purchase the account never had anything before.
//
// This deliberately does not attempt to resurrect a live Stripe
// subscription for the annual→lifetime case — the original subscription was
// canceled immediately at upgrade time (see the Annual→Lifetime critical
// fix), not left to expire, so there is nothing left in Stripe to restore.
// Reverting `plan` to "annual" here grants that access back on our own
// record without a subscription behind it, which means nothing will ever
// bill or expire it again automatically. Accepted, disclosed trade-off for
// an edge case (upgrade, then refund the upgrade) rather than building a
// synthetic-subscription reinstatement flow for it.
//
// Unlike deriveBillingUpdate above, this doesn't take the raw Stripe event —
// Charge metadata is a separate dictionary from the PaymentIntent's and is
// never copied over automatically, so resolving the uid/plan tag for a
// refund requires an extra `paymentIntents.retrieve` call, which (like
// currentBilling) has to happen in stripe-webhook.ts to keep this file
// SDK-free. The caller is also responsible for only invoking this on a
// *fully* refunded charge (Charge.refunded === true) — charge.refunded also
// fires on partial refunds (e.g. a support goodwill credit), which must not
// revoke access.
export function deriveLifetimeRefundUpdate(uid: string, currentBilling: BillingDoc | null): BillingEventResult | null {
    // Not on Lifetime already — either this refund is for a purchase that
    // was already superseded some other way, or it's a redelivered/duplicate
    // charge.refunded arriving after the first delivery already downgraded
    // the account (Firestore then already reads the reverted plan).
    // Returning null in both cases is what makes this idempotent on Stripe's
    // at-least-once redelivery.
    if (currentBilling?.plan !== "lifetime") return null;
    return {
        uid,
        update: {
            plan: currentBilling.previousPlan ?? "free",
            stripeCustomerId: currentBilling.stripeCustomerId,
            stripeSubscriptionId: null,
            subscriptionStatus: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            updatedAt: Date.now(),
            // Consumed — no longer meaningful once reverted off Lifetime.
            previousPlan: null,
            lifetimePaymentIntentId: null,
        },
    };
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
