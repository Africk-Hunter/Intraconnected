import { useEffect, useRef } from 'react';
import { resyncNodeCount, type BillingPlan } from './billingCache';
import { fetchFullIdeaList } from '../idea/helpers';

// Firestore's free-tier node-cap rule (firestore.rules) checks
// meta/nodeCount, which is only kept live while an account is actually on
// the free plan (see sendOp in sync/outbox.ts — a paid account is never
// capped, so maintaining it for one would be pure overhead). That means it
// goes stale for however long an account spends on a paid plan, and can
// drift by one if a change is replayed after it already reached the server.
// Resyncing to the true count — just fetchFullIdeaList().length, a
// localStorage read, not a Firestore one — once per session whenever the
// plan is free catches all of these with one mechanism, at a cost of at
// most one extra write per free-plan session (not per create/delete).
//
// Must wait until this session has a confirmed-current copy from the server
// (serverSynced) — resyncing against a local list that loaded offline, or
// never loaded at all on a new device, would write a wrong (possibly zero)
// count and let a free account past the cap.
export function useNodeCountResync(billingPlan: BillingPlan, serverSynced: boolean) {
    const hasResyncedRef = useRef(false);

    useEffect(() => {
        if (!serverSynced || billingPlan !== 'free' || hasResyncedRef.current) return;
        hasResyncedRef.current = true;
        resyncNodeCount(fetchFullIdeaList().length);
    }, [billingPlan, serverSynced]);
}
