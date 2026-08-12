import { describe, it, expect } from 'vitest';
import type Stripe from 'stripe';
import { deriveBillingUpdate, isEligibleForLifetimeUpgradeDiscount } from './billingEvents';

function fakeEvent(type: string, object: Record<string, unknown>): Stripe.Event {
    return { type, data: { object } } as unknown as Stripe.Event;
}

describe('deriveBillingUpdate', () => {
    it('grants lifetime on a succeeded payment intent', () => {
        const event = fakeEvent('payment_intent.succeeded', {
            customer: 'cus_abc',
            metadata: { firebaseUid: 'uid-123', plan: 'lifetime' },
        });

        const result = deriveBillingUpdate(event);

        expect(result?.uid).toBe('uid-123');
        expect(result?.update.plan).toBe('lifetime');
        expect(result?.update.stripeCustomerId).toBe('cus_abc');
        expect(result?.update.stripeSubscriptionId).toBeNull();
    });

    it('ignores a payment intent with no firebaseUid metadata', () => {
        const event = fakeEvent('payment_intent.succeeded', {
            customer: 'cus_abc',
            metadata: {},
        });

        expect(deriveBillingUpdate(event)).toBeNull();
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
