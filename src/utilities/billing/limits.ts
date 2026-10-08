import { fetchFullIdeaList } from '../idea/helpers';
import { getCachedBillingStatus, BillingPlan } from './billingCache';

import { FREE_NODE_LIMIT } from '../../../shared/limits';
export { FREE_NODE_LIMIT };

// Pure — unit-tested directly without touching localStorage/Firestore.
export function isWithinFreeLimit(plan: BillingPlan, nodeCount: number): boolean {
    return plan !== 'free' || nodeCount < FREE_NODE_LIMIT;
}

export function canCreateIdea(): boolean {
    const { plan } = getCachedBillingStatus();
    return isWithinFreeLimit(plan, fetchFullIdeaList().length);
}
