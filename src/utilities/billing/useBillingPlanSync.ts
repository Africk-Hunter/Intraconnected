import { useEffect } from 'react';
import { auth } from '../../firebaseConfig';
import { subscribeBillingStatus, type BillingPlan } from '../firebase/firebaseHelpers';

// Mirrors the signed-in user's plan from Firestore into `setBillingPlan`
// until the returned function is called. Plain function (not only a hook)
// so the marketing pages can load it — and Firebase with it — via dynamic
// import after first paint; see MarketingTransition.tsx.
export function watchBillingPlan(setBillingPlan: (plan: BillingPlan) => void): () => void {
    let unsubscribeBilling: (() => void) | undefined;
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
        unsubscribeBilling?.();
        unsubscribeBilling = undefined;
        if (!user) return;
        unsubscribeBilling = subscribeBillingStatus(status => {
            setBillingPlan(status.plan);
            // Warm the discounted Lifetime price so the upgrade card has it
            // by the time it's opened (the endpoint is a cold-start + Stripe call).
            if (status.plan === 'annual') {
                void import('./billing').then(({ getLifetimePricePreview }) => getLifetimePricePreview().catch(() => {}));
            }
        });
    });
    return () => {
        unsubscribeAuth();
        unsubscribeBilling?.();
    };
}

// Keeps `billingPlan` (IdeaContext) in sync with Firestore for as long as
// the calling component is mounted. Originally lived only inside Idea.tsx
// (the authenticated app), which left `billingPlan` stuck at its default
// 'free' on the public marketing pages (/landing, /pricing) — those mount
// under a separate route tree and never ran that effect. An already-Annual
// user landing on /pricing from a bookmark would see "Start Annual Plan"
// again with nothing to stop them clicking it. Idea.tsx uses this hook;
// MarketingTransition.tsx lazy-loads watchBillingPlan instead.
export function useBillingPlanSync(setBillingPlan: (plan: BillingPlan) => void) {
    useEffect(() => watchBillingPlan(setBillingPlan), [setBillingPlan]);
}
