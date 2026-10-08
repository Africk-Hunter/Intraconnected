import { db, auth } from "../../firebaseConfig";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { authCheck } from "../firebase/currentUser";
import type { BillingPlan } from "../../../shared/billing";

// Cached per account: a browser can hold several accounts over time, and a
// plain shared key would show the previous account's plan to the next one
// (e.g. Lifetime's uncapped creation) until its own snapshot arrived.
const LEGACY_BILLING_LS_KEY = 'billing_plan';
const billingKey = (uid: string) => `billing_plan_${uid}`;

export type { BillingPlan };

export interface BillingStatus {
    plan: BillingPlan;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string | null;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
    updatedAt: number;
    // Set only by a real Lifetime purchase; absent for a dev-granted plan, which has nothing to refund.
    lifetimePaymentIntentId?: string | null;
}

const FREE_BILLING_STATUS: BillingStatus = {
    plan: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    updatedAt: 0,
};

// The billing doc is written only by the stripe-webhook Netlify Function
// (server is the source of truth) — the client needs to react to a webhook
// write it didn't itself trigger, hence a listener rather than a one-shot
// getDoc. Mirrors every snapshot to localStorage so canCreateIdea() can read
// it synchronously.
export function subscribeBillingStatus(callback: (status: BillingStatus) => void): () => void {
    const user = authCheck();
    if (!user) return () => {};
    const billingDoc = doc(db, "users", user.uid, "meta", "billing");
    return onSnapshot(billingDoc, snap => {
        const status: BillingStatus = snap.exists() ? (snap.data() as BillingStatus) : FREE_BILLING_STATUS;
        try {
            localStorage.setItem(billingKey(user.uid), JSON.stringify(status));
            localStorage.removeItem(LEGACY_BILLING_LS_KEY);
        } catch {
            // Storage full or blocked — the live snapshot still drives the UI.
        }
        callback(status);
    });
}

export function getCachedBillingStatus(): BillingStatus {
    const uid = auth.currentUser?.uid;
    if (!uid) return FREE_BILLING_STATUS;
    try {
        const raw = localStorage.getItem(billingKey(uid));
        if (!raw) return FREE_BILLING_STATUS;
        return JSON.parse(raw) as BillingStatus;
    } catch {
        return FREE_BILLING_STATUS;
    }
}

// Overwrites meta/nodeCount with the true current count — see
// useNodeCountResync, which calls this once per session for free-plan
// users using a count already available locally (fetchFullIdeaList().length
// reads localStorage, not Firestore). Needed because the outbox only
// maintains the counter for free-plan users (see sendOp in sync/outbox.ts),
// so it goes stale for however long an account spends on a paid plan — this
// is what catches it back up on downgrade, and what corrects any drift from
// a change that was replayed after reaching the server.
export async function resyncNodeCount(count: number): Promise<void> {
    const user = authCheck();
    if (!user) return;
    try {
        const countDoc = doc(db, "users", user.uid, "meta", "nodeCount");
        await setDoc(countDoc, { count });
    } catch (error) {
        console.error("Error resyncing node count: ", error);
    }
}
