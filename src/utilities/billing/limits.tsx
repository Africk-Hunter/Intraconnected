import { fetchFullIdeaList } from '../idea/helpers';
import { getCachedBillingStatus, BillingPlan } from '../firebase/firebaseHelpers';

export const FREE_NODE_LIMIT = 50;

// Pure — unit-tested directly without touching localStorage/Firestore.
export function isWithinFreeLimit(plan: BillingPlan, nodeCount: number): boolean {
    return plan !== 'free' || nodeCount < FREE_NODE_LIMIT;
}

export function canCreateIdea(): boolean {
    const { plan } = getCachedBillingStatus();
    return isWithinFreeLimit(plan, fetchFullIdeaList().length);
}
