import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
    if (!stripePromise) {
        const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
        if (!key) {
            throw new Error('VITE_STRIPE_PUBLISHABLE_KEY environment variable is not set.');
        }
        stripePromise = loadStripe(key);
    }
    return stripePromise;
}
