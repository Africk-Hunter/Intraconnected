import { describe, it, expect } from 'vitest';
import type Stripe from 'stripe';
import { deriveBillingUpdate, deriveLifetimeRefundUpdate, extractUidFromEvent, isEligibleForLifetimeUpgradeDiscount, type BillingDoc } from './billingEvents';

function fakeEvent(type: string, object: Record<string, unknown>): Stripe.Event {
    return { type, data: { object } } as unknown as Stripe.Event;
}

function fakeBilling(overrides: Partial<BillingDoc>): BillingDoc {
    return {
        plan: 'free',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionStatus: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        updatedAt: 0,
        previousPlan: null,
        lifetimePaymentIntentId: null,
        ...overrides,
    };
}

describe('extractUidFromEvent', () => {
    it('reads firebaseUid from a payment intent', () => {
        const event = fakeEvent('payment_intent.succeeded', { metadata: { firebaseUid: 'uid-123' } });
        expect(extractUidFromEvent(event)).toBe('uid-123');
    });

    it('returns null for a payment intent with no firebaseUid', () => {
        const event = fakeEvent('payment_intent.succeeded', { metadata: {} });
        expect(extractUidFromEvent(event)).toBeNull();
    });

    it('reads firebaseUid from a subscription update', () => {
        const event = fakeEvent('customer.subscription.updated', { metadata: { firebaseUid: 'uid-123' } });
        expect(extractUidFromEvent(event)).toBe('uid-123');
    });

    it('reads firebaseUid from a subscription deletion', () => {
        const event = fakeEvent('customer.subscription.deleted', { metadata: { firebaseUid: 'uid-123' } });
        expect(extractUidFromEvent(event)).toBe('uid-123');
    });

    it('returns null for an event type it does not resolve a uid from', () => {
        const event = fakeEvent('invoice.payment_failed', { id: 'in_123' });
        expect(extractUidFromEvent(event)).toBeNull();
    });
});

describe('deriveBillingUpdate', () => {
    it('grants lifetime on a succeeded payment intent', () => {
        const event = fakeEvent('payment_intent.succeeded', {
            id: 'pi_123',
            customer: 'cus_abc',
            metadata: { firebaseUid: 'uid-123', plan: 'lifetime' },
        });

        const result = deriveBillingUpdate(event);

        expect(result?.uid).toBe('uid-123');
        expect(result?.update.plan).toBe('lifetime');
        expect(result?.update.stripeCustomerId).toBe('cus_abc');
        expect(result?.update.stripeSubscriptionId).toBeNull();
        // No currentBilling passed — a brand-new customer never had anything
        // before this, so a later refund should revert to "free".
        expect(result?.update.previousPlan).toBe('free');
        // Recorded so refund-lifetime.ts has something to refund later —
        // there's no other field on this doc that identifies the charge.
        expect(result?.update.lifetimePaymentIntentId).toBe('pi_123');
    });

    it('ignores a payment intent with no firebaseUid metadata', () => {
        const event = fakeEvent('payment_intent.succeeded', {
            customer: 'cus_abc',
            metadata: {},
        });

        expect(deriveBillingUpdate(event)).toBeNull();
    });

    it('ignores a payment intent with firebaseUid but no lifetime plan tag', () => {
        // Guards against ever treating some other succeeded PaymentIntent
        // (present or future) as a Lifetime purchase just because it happens
        // to carry a firebaseUid.
        const event = fakeEvent('payment_intent.succeeded', {
            customer: 'cus_abc',
            metadata: { firebaseUid: 'uid-123' },
        });

        expect(deriveBillingUpdate(event)).toBeNull();
    });

    it('flags the prior Annual subscription for cancellation when upgrading to Lifetime', () => {
        const event = fakeEvent('payment_intent.succeeded', {
            customer: 'cus_abc',
            metadata: { firebaseUid: 'uid-123', plan: 'lifetime' },
        });
        const currentBilling = fakeBilling({ plan: 'annual', stripeSubscriptionId: 'sub_old', subscriptionStatus: 'active' });

        const result = deriveBillingUpdate(event, currentBilling);

        expect(result?.update.plan).toBe('lifetime');
        expect(result?.cancelSubscriptionId).toBe('sub_old');
        // Snapshot of what this account had before the upgrade — what a
        // later refund of this same purchase should revert to.
        expect(result?.update.previousPlan).toBe('annual');
    });

    it('does not flag a cancellation for a first-time Lifetime purchase with no prior subscription', () => {
        const event = fakeEvent('payment_intent.succeeded', {
            customer: 'cus_abc',
            metadata: { firebaseUid: 'uid-123', plan: 'lifetime' },
        });

        // No currentBilling passed at all — matches a brand-new customer
        // stripe-webhook.ts would see no existing doc for.
        const result = deriveBillingUpdate(event);

        expect(result?.update.plan).toBe('lifetime');
        expect(result?.cancelSubscriptionId).toBeFalsy();
    });

    it('updates plan details on subscription renewal/status change', () => {
        const periodEnd = 1_800_000_000;
        const event = fakeEvent('customer.subscription.updated', {
            id: 'sub_xyz',
            customer: 'cus_abc',
            status: 'active',
            cancel_at_period_end: false,
            metadata: { firebaseUid: 'uid-123' },
            items: { data: [{ current_period_end: periodEnd }] },
        });

        const result = deriveBillingUpdate(event);

        expect(result?.uid).toBe('uid-123');
        expect(result?.update.plan).toBe('annual');
        expect(result?.update.subscriptionStatus).toBe('active');
        expect(result?.update.currentPeriodEnd).toBe(periodEnd * 1000);
        expect(result?.update.cancelAtPeriodEnd).toBe(false);
    });

    it.each([
        ['active', 'annual'],
        ['trialing', 'annual'],
        ['past_due', 'annual'],
        ['incomplete', 'free'],
        ['incomplete_expired', 'free'],
        ['unpaid', 'free'],
        ['paused', 'free'],
    ] as const)('grants "%s" the plan "%s"', (status, expectedPlan) => {
        const event = fakeEvent('customer.subscription.updated', {
            id: 'sub_xyz',
            customer: 'cus_abc',
            status,
            cancel_at_period_end: false,
            metadata: { firebaseUid: 'uid-123' },
            items: { data: [{ current_period_end: 1_800_000_000 }] },
        });

        const result = deriveBillingUpdate(event);

        expect(result?.update.plan).toBe(expectedPlan);
        // subscriptionStatus is always recorded accurately regardless of
        // whether it grants access — only `plan` is gated.
        expect(result?.update.subscriptionStatus).toBe(status);
    });

    it('actively revokes access — downgrades an already-Annual account to free once its subscription lapses to unpaid', () => {
        // The critical case this fix is for: there is no separate expiration
        // check anywhere in this app (see the audit) — if this event doesn't
        // actively flip plan back to "free", a subscription that goes unpaid
        // and is never actually deleted by Stripe (depends on dunning
        // config, not something this app controls) would keep "annual"
        // forever, since nothing else would ever run again to revoke it.
        const event = fakeEvent('customer.subscription.updated', {
            id: 'sub_xyz',
            customer: 'cus_abc',
            status: 'unpaid',
            cancel_at_period_end: false,
            metadata: { firebaseUid: 'uid-123' },
            items: { data: [{ current_period_end: 1_800_000_000 }] },
        });
        const previouslyAnnual = fakeBilling({
            plan: 'annual',
            stripeCustomerId: 'cus_abc',
            stripeSubscriptionId: 'sub_xyz',
            subscriptionStatus: 'active',
        });

        const result = deriveBillingUpdate(event, previouslyAnnual);

        expect(result?.update.plan).toBe('free');
        expect(result?.update.subscriptionStatus).toBe('unpaid');
        // The subscription itself still exists in Stripe (just not paying) —
        // stripeSubscriptionId/stripeCustomerId stay on file so a later
        // recovery (status returns to active) re-grants access on its own,
        // without the user needing to do anything in this app.
        expect(result?.update.stripeSubscriptionId).toBe('sub_xyz');
        expect(result?.update.stripeCustomerId).toBe('cus_abc');
    });

    it('never grants access to a subscription that was abandoned before its first payment ever completed', () => {
        // The exact exploit scenario from the audit: start an Annual
        // checkout, never enter a card, wait for Stripe's confirmation
        // window to lapse. No prior billing doc exists for this uid at all —
        // this must not grant "annual" for a subscription that was never
        // paid for even once.
        const event = fakeEvent('customer.subscription.updated', {
            id: 'sub_new',
            customer: 'cus_abc',
            status: 'incomplete_expired',
            cancel_at_period_end: false,
            metadata: { firebaseUid: 'uid-123' },
            items: { data: [{ current_period_end: 1_800_000_000 }] },
        });

        const result = deriveBillingUpdate(event);

        expect(result?.update.plan).toBe('free');
    });

    it('does not downgrade an already-Lifetime plan when the superseded subscription updates', () => {
        // This is exactly the event the immediate cancel triggers on its way
        // to being deleted (or a late/duplicate delivery of an update from
        // before the upgrade) — must never clobber "lifetime" back to "annual".
        const event = fakeEvent('customer.subscription.updated', {
            id: 'sub_old',
            customer: 'cus_abc',
            status: 'active',
            cancel_at_period_end: false,
            metadata: { firebaseUid: 'uid-123' },
            items: { data: [{ current_period_end: 1_800_000_000 }] },
        });
        const currentBilling = fakeBilling({ plan: 'lifetime', stripeSubscriptionId: null, subscriptionStatus: null });

        expect(deriveBillingUpdate(event, currentBilling)).toBeNull();
    });

    it('downgrades to free when a subscription is deleted', () => {
        const event = fakeEvent('customer.subscription.deleted', {
            id: 'sub_xyz',
            customer: 'cus_abc',
            metadata: { firebaseUid: 'uid-123' },
        });

        const result = deriveBillingUpdate(event);

        expect(result?.uid).toBe('uid-123');
        expect(result?.update.plan).toBe('free');
        expect(result?.update.stripeSubscriptionId).toBeNull();
        expect(result?.update.subscriptionStatus).toBe('canceled');
        expect(result?.update.previousPlan).toBeNull();
    });

    it('preserves an already-Lifetime plan when the superseded subscription is deleted, clearing its fields', () => {
        // The end of the immediate-cancel sequence the Lifetime purchase
        // triggers: the old subscription is genuinely gone, so its tracking
        // fields should clear, but `plan` must stay "lifetime" — the account
        // shouldn't be downgraded to "free" just because its old, now-defunct
        // Annual subscription finished being canceled.
        const event = fakeEvent('customer.subscription.deleted', {
            id: 'sub_old',
            customer: 'cus_abc',
            metadata: { firebaseUid: 'uid-123' },
        });
        const currentBilling = fakeBilling({
            plan: 'lifetime',
            stripeSubscriptionId: 'sub_old',
            subscriptionStatus: 'active',
            previousPlan: 'annual',
            lifetimePaymentIntentId: 'pi_123',
        });

        const result = deriveBillingUpdate(event, currentBilling);

        expect(result?.uid).toBe('uid-123');
        expect(result?.update.plan).toBe('lifetime');
        expect(result?.update.stripeSubscriptionId).toBeNull();
        expect(result?.update.subscriptionStatus).toBe('canceled');
        expect(result?.cancelSubscriptionId).toBeFalsy();
        // Still mid-upgrade (the just-superseded subscription finishing its
        // cancellation) — a refund of the Lifetime purchase still needs this.
        expect(result?.update.previousPlan).toBe('annual');
        // Same reasoning — this cleanup event has no business touching what
        // refund-lifetime.ts would need if this purchase is refunded later.
        expect(result?.update.lifetimePaymentIntentId).toBe('pi_123');
    });

    it('ignores a subscription event with no firebaseUid metadata', () => {
        const event = fakeEvent('customer.subscription.deleted', {
            id: 'sub_xyz',
            customer: 'cus_abc',
            metadata: {},
        });

        expect(deriveBillingUpdate(event)).toBeNull();
    });

    it('returns null for event types it does not act on', () => {
        const event = fakeEvent('invoice.payment_failed', { id: 'in_123' });

        expect(deriveBillingUpdate(event)).toBeNull();
    });
});

// End-to-end regression for the specific bug this was fixed for: an Annual
// subscriber upgrades to Lifetime, and the resulting cancellation of their
// old subscription must not silently downgrade them back down. Chains real
// event sequences through deriveBillingUpdate exactly as stripe-webhook.ts
// would — each call's `currentBilling` is the previous call's own output —
// rather than testing either event's handling in isolation.
describe('Annual → Lifetime upgrade sequence', () => {
    it('keeps the account on Lifetime through the full purchase-then-cancel event sequence, in either delivery order', () => {
        const annualBilling = fakeBilling({
            plan: 'annual',
            stripeCustomerId: 'cus_abc',
            stripeSubscriptionId: 'sub_old',
            subscriptionStatus: 'active',
        });

        const lifetimePurchase = fakeEvent('payment_intent.succeeded', {
            customer: 'cus_abc',
            metadata: { firebaseUid: 'uid-123', plan: 'lifetime' },
        });
        const oldSubUpdated = fakeEvent('customer.subscription.updated', {
            id: 'sub_old',
            customer: 'cus_abc',
            status: 'canceled',
            cancel_at_period_end: false,
            metadata: { firebaseUid: 'uid-123' },
            items: { data: [{ current_period_end: 1_800_000_000 }] },
        });
        const oldSubDeleted = fakeEvent('customer.subscription.deleted', {
            id: 'sub_old',
            customer: 'cus_abc',
            metadata: { firebaseUid: 'uid-123' },
        });

        // 1. Lifetime PaymentIntent succeeds. Starting state is the Annual
        // billing doc — this is the event that must flag sub_old for the
        // caller to cancel.
        const step1 = deriveBillingUpdate(lifetimePurchase, annualBilling);
        expect(step1?.update.plan).toBe('lifetime');
        expect(step1?.cancelSubscriptionId).toBe('sub_old');
        // Recorded so a later refund of this purchase reverts to "annual",
        // not "free" — see the deriveLifetimeRefundUpdate tests below.
        expect(step1?.update.previousPlan).toBe('annual');

        // Simulates stripe-webhook.ts: the Firestore doc now reflects step
        // 1's write before either downstream event from the resulting
        // stripe().subscriptions.cancel('sub_old') call can possibly arrive.
        const afterStep1 = step1!.update;

        // 2a. Try .deleted arriving first (immediate-cancel's actual event).
        const deletedFirst = deriveBillingUpdate(oldSubDeleted, afterStep1);
        expect(deletedFirst?.update.plan).toBe('lifetime');
        expect(deletedFirst?.update.stripeSubscriptionId).toBeNull();
        expect(deletedFirst?.update.subscriptionStatus).toBe('canceled');
        expect(deletedFirst?.update.previousPlan).toBe('annual');

        // 2b. Independently, try .updated arriving instead (defense in
        // depth in case any stray update for the same now-dead subscription
        // shows up) — from the same post-step-1 state, not chained after 2a.
        const updatedInstead = deriveBillingUpdate(oldSubUpdated, afterStep1);
        expect(updatedInstead).toBeNull();

        // 2c. And both, .updated then .deleted, chained in sequence.
        const afterUpdated = afterStep1; // .updated was a no-op, state unchanged
        const deletedAfterUpdated = deriveBillingUpdate(oldSubDeleted, afterUpdated);
        expect(deletedAfterUpdated?.update.plan).toBe('lifetime');
        expect(deletedAfterUpdated?.update.stripeSubscriptionId).toBeNull();
        expect(deletedAfterUpdated?.update.subscriptionStatus).toBe('canceled');

        // None of these should ever ask the caller to cancel anything a
        // second time.
        expect(deletedFirst?.cancelSubscriptionId).toBeFalsy();
        expect(updatedInstead?.cancelSubscriptionId).toBeFalsy();
        expect(deletedAfterUpdated?.cancelSubscriptionId).toBeFalsy();
    });

    it('is naturally idempotent if the original payment_intent.succeeded is redelivered after the doc is already updated', () => {
        const lifetimePurchase = fakeEvent('payment_intent.succeeded', {
            customer: 'cus_abc',
            metadata: { firebaseUid: 'uid-123', plan: 'lifetime' },
        });
        const alreadyLifetime = fakeBilling({
            plan: 'lifetime',
            stripeCustomerId: 'cus_abc',
            stripeSubscriptionId: null,
            previousPlan: 'annual',
        });

        const redelivered = deriveBillingUpdate(lifetimePurchase, alreadyLifetime);

        expect(redelivered?.update.plan).toBe('lifetime');
        expect(redelivered?.cancelSubscriptionId).toBeFalsy();
        // Must reuse the already-recorded previousPlan, not recompute it from
        // currentBilling.plan — that's already "lifetime" on a redelivery, so
        // naively snapshotting it again would overwrite the real "annual"
        // and make a later refund revert to Lifetime itself instead of Annual.
        expect(redelivered?.update.previousPlan).toBe('annual');
    });
});

describe('deriveLifetimeRefundUpdate', () => {
    it('reverts a free→lifetime purchase to free when fully refunded', () => {
        const currentBilling = fakeBilling({
            plan: 'lifetime',
            stripeCustomerId: 'cus_abc',
            previousPlan: 'free',
            lifetimePaymentIntentId: 'pi_123',
        });

        const result = deriveLifetimeRefundUpdate('uid-123', currentBilling);

        expect(result?.uid).toBe('uid-123');
        expect(result?.update.plan).toBe('free');
        expect(result?.update.stripeCustomerId).toBe('cus_abc');
        expect(result?.update.stripeSubscriptionId).toBeNull();
        expect(result?.update.subscriptionStatus).toBeNull();
        // Consumed — no longer meaningful once off Lifetime.
        expect(result?.update.previousPlan).toBeNull();
        // Same reasoning — the refund that just happened already consumed
        // this; leaving it set would let refund-lifetime.ts attempt (and
        // Stripe reject) a second refund of the same already-refunded charge.
        expect(result?.update.lifetimePaymentIntentId).toBeNull();
        // A refund never implies canceling some *other* Stripe subscription —
        // unlike the Annual→Lifetime upgrade case, there's nothing else to
        // clean up in Stripe here.
        expect(result?.cancelSubscriptionId).toBeFalsy();
    });

    it('reverts an annual→lifetime upgrade to annual, not free, when the upgrade is refunded', () => {
        // The exact scenario this fix is for: someone on Annual upgrades to
        // Lifetime, then gets that purchase refunded. They already had paid
        // access before the upgrade — a refund of the upgrade should undo
        // the upgrade, not wipe out access they had independently of it.
        const currentBilling = fakeBilling({ plan: 'lifetime', stripeCustomerId: 'cus_abc', previousPlan: 'annual' });

        const result = deriveLifetimeRefundUpdate('uid-123', currentBilling);

        expect(result?.update.plan).toBe('annual');
        // No live Stripe subscription is resurrected — the original one was
        // already canceled immediately at upgrade time — so these stay
        // cleared even though `plan` reverts to "annual".
        expect(result?.update.stripeSubscriptionId).toBeNull();
        expect(result?.update.subscriptionStatus).toBeNull();
        expect(result?.update.previousPlan).toBeNull();
    });

    it('falls back to free when previousPlan was never recorded (a doc written before this field existed)', () => {
        const currentBilling = fakeBilling({ plan: 'lifetime', stripeCustomerId: 'cus_abc' });
        // previousPlan defaults to null via fakeBilling — simulates a legacy doc.

        const result = deriveLifetimeRefundUpdate('uid-123', currentBilling);

        expect(result?.update.plan).toBe('free');
    });

    it('is a no-op when the account is not currently on Lifetime', () => {
        // Covers both a stray/unrelated refund and a redelivered duplicate
        // charge.refunded arriving after the first delivery already
        // reverted the account off Lifetime.
        expect(deriveLifetimeRefundUpdate('uid-123', fakeBilling({ plan: 'free' }))).toBeNull();
    });

    it('is a no-op when there is no billing doc at all', () => {
        expect(deriveLifetimeRefundUpdate('uid-123', null)).toBeNull();
    });
});

describe('isEligibleForLifetimeUpgradeDiscount', () => {
    it('is eligible on an active annual subscription', () => {
        expect(isEligibleForLifetimeUpgradeDiscount({ plan: 'annual', subscriptionStatus: 'active' })).toBe(true);
    });

    it('is eligible on a trialing annual subscription', () => {
        expect(isEligibleForLifetimeUpgradeDiscount({ plan: 'annual', subscriptionStatus: 'trialing' })).toBe(true);
    });

    it('is not eligible when payment is past due', () => {
        expect(isEligibleForLifetimeUpgradeDiscount({ plan: 'annual', subscriptionStatus: 'past_due' })).toBe(false);
    });

    it('is not eligible when unpaid', () => {
        expect(isEligibleForLifetimeUpgradeDiscount({ plan: 'annual', subscriptionStatus: 'unpaid' })).toBe(false);
    });

    it('is not eligible once canceled', () => {
        expect(isEligibleForLifetimeUpgradeDiscount({ plan: 'annual', subscriptionStatus: 'canceled' })).toBe(false);
    });

    it('is not eligible on the free plan', () => {
        expect(isEligibleForLifetimeUpgradeDiscount({ plan: 'free', subscriptionStatus: null })).toBe(false);
    });

    it('is not eligible on the lifetime plan', () => {
        expect(isEligibleForLifetimeUpgradeDiscount({ plan: 'lifetime', subscriptionStatus: null })).toBe(false);
    });

    it('is not eligible with no billing doc at all', () => {
        expect(isEligibleForLifetimeUpgradeDiscount(null)).toBe(false);
    });
});
