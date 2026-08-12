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
        throw new Error(await res.text());
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

export function consumePendingCheckoutPlan(): CheckoutPlan | null {
    const plan = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    if (plan !== 'annual' && plan !== 'lifetime') return null;
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    return plan;
}
