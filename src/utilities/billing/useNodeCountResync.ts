import { useEffect, useRef } from 'react';
import { resyncNodeCount, type BillingPlan } from '../firebase/firebaseHelpers';
import { fetchFullIdeaList } from '../idea/helpers';

// Firestore's free-tier node-cap rule (firestore.rules) checks
// meta/nodeCount, which is only kept live while an account is actually on
// the free plan (see adjustNodeCount in firebaseHelpers.tsx — a paid
// account is never capped, so maintaining it for one would be pure
// overhead). That means it goes stale for however long an account spends
// on a paid plan, and doesn't exist at all yet for an existing user's first
// session after this feature ships. Resyncing to the true count — just
// fetchFullIdeaList().length, a localStorage read, not a Firestore one —
// once per session whenever the plan is free catches both cases with one
// mechanism, at a cost of at most one extra write per free-plan session
// (not per create/delete).
//
// Must wait for the idea list to have actually finished loading
// (ideasLoaded) — resyncing against an empty/stale local list before the
// initial Firestore fetch completes would wrongly zero out an existing
// user's real count.
export function useNodeCountResync(billingPlan: BillingPlan, ideasLoaded: boolean) {
    const hasResyncedRef = useRef(false);

    useEffect(() => {
        if (!ideasLoaded || billingPlan !== 'free' || hasResyncedRef.current) return;
        hasResyncedRef.current = true;
        resyncNodeCount(fetchFullIdeaList().length);
    }, [billingPlan, ideasLoaded]);
}
