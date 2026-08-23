import { auth } from '../../firebaseConfig';

const PENDING_CHECKOUT_KEY = 'pending_checkout_plan';

export type CheckoutPlan = 'annual' | 'lifetime';

// Signed-out visitors get sent to log in first; the intended plan is
// remembered so checkout resumes automatically post-login (mirrors the
// existing `sessionStorage` "new_user" idiom already used to resume
// post-signup state — see Idea.tsx). Signed-in visitors are handed back to
// `onReady`, which opens the embedded checkout modal for the chosen plan.
export function startCheckout(plan: CheckoutPlan, onReady: (plan: CheckoutPlan) => void): void {
    const user = auth.currentUser;
    if (!user) {
        sessionStorage.setItem(PENDING_CHECKOUT_KEY, plan);
        window.location.href = '/';
        return;
    }

    onReady(plan);
}

export interface CheckoutIntent {
    clientSecret: string;
    amount: number;
    currency: string;
}

// Creates a PaymentIntent (lifetime) or an incomplete Subscription (annual)
// and returns its client secret — what <Elements> needs to mount the
// Payment Element — plus the actual amount that will be charged (Lifetime's
// may be discounted; see fetchLifetimePricePreview).
export async function fetchCheckoutIntent(plan: CheckoutPlan): Promise<CheckoutIntent> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('You must be signed in to check out.');
    }

    const idToken = await user.getIdToken();
    const res = await fetch('/.netlify/functions/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ plan }),
    });

    if (!res.ok) {
        // Server errors here are JSON ({ error: "..." }, see jsonError in
        // create-payment-intent.ts) — e.g. "You already have an active
        // Annual subscription." is genuinely useful to show, unlike a
        // generic retry message that would just fail the same way again.
        let message = 'Failed to start checkout.';
        try {
            const body = await res.json() as { error?: string };
            if (body.error) message = body.error;
        } catch {
            // Non-JSON error body — keep the generic message.
        }
        throw new Error(message);
    }

    return (await res.json()) as CheckoutIntent;
}

export interface LifetimePricePreview {
    amount: number;
    currency: string;
    discountCents: number;
}

// Lets the plan-picker modal show Lifetime's real price (credited if the
// user already has Annual) before they've committed to a plan — mirrors
// what create-payment-intent.ts will actually charge.
export async function fetchLifetimePricePreview(): Promise<LifetimePricePreview> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('You must be signed in.');
    }

    const idToken = await user.getIdToken();
    const res = await fetch('/.netlify/functions/get-lifetime-price', {
        headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!res.ok) {
        throw new Error(await res.text());
    }

    return (await res.json()) as LifetimePricePreview;
}

export function formatMoney(amountCents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amountCents / 100);
}

// Mirrors REFUND_WINDOW_MS in refund-lifetime.ts — duplicated rather than
// shared (Netlify Functions can't import from src/, same constraint as
// SUPPORT_EMAIL) so this is only used client-side to decide whether to show
// the refund button at all; the server call above is the actual authority.
const REFUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function isLifetimeRefundEligible(updatedAt: number): boolean {
    return Date.now() - updatedAt <= REFUND_WINDOW_MS;
}

export async function requestLifetimeRefund(): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('You must be signed in to request a refund.');
    }

    const idToken = await user.getIdToken();
    const res = await fetch('/.netlify/functions/refund-lifetime', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!res.ok) {
        let message = 'Failed to process refund.';
        try {
            const body = await res.json() as { error?: string };
            if (body.error) message = body.error;
        } catch {
            // Non-JSON error body — keep the generic message.
        }
        throw new Error(message);
    }
}

export async function cancelSubscription(): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('You must be signed in to cancel your subscription.');
    }

    const idToken = await user.getIdToken();
    const res = await fetch('/.netlify/functions/cancel-subscription', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!res.ok) {
        throw new Error(await res.text());
    }
}

// Testing-only helper (see reset-subscription-test.ts) — cancels the user's
// live Stripe subscription (if any) and resets their billing doc to free.
// Not wired into any production-visible UI path.
export async function resetSubscriptionForTesting(): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('You must be signed in.');
    }

    const idToken = await user.getIdToken();
    const res = await fetch('/.netlify/functions/reset-subscription-test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!res.ok) {
        throw new Error(await res.text());
    }
}

export function consumePendingCheckoutPlan(): CheckoutPlan | null {
    const plan = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    if (plan !== 'annual' && plan !== 'lifetime') return null;
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    return plan;
}
