import { useEffect } from 'react';
import { auth } from '../../firebaseConfig';
import { subscribeBillingStatus, type BillingPlan } from '../firebase/firebaseHelpers';

// Keeps `billingPlan` (IdeaContext) in sync with Firestore for as long as
// the calling component is mounted. Originally lived only inside Idea.tsx
// (the authenticated app), which left `billingPlan` stuck at its default
// 'free' on the public marketing pages (/landing, /pricing) — those mount
// under a separate route tree and never ran that effect. An already-Annual
// user landing on /pricing from a bookmark would see "Start Annual Plan"
// again with nothing to stop them clicking it. Used by both Idea.tsx and
// MarketingTransition.tsx now, so the same live status is available
// wherever a plan-aware decision needs it.
export function useBillingPlanSync(setBillingPlan: (plan: BillingPlan) => void) {
    useEffect(() => {
        let unsubscribeBilling: (() => void) | undefined;
        const unsubscribeAuth = auth.onAuthStateChanged(user => {
            unsubscribeBilling?.();
            unsubscribeBilling = undefined;
            if (!user) return;
            unsubscribeBilling = subscribeBillingStatus(status => setBillingPlan(status.plan));
        });
        return () => {
            unsubscribeAuth();
            unsubscribeBilling?.();
        };
    }, [setBillingPlan]);
}
