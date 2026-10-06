import { db, auth } from "../../firebaseConfig";
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import { IdeaType, ChecklistItem } from "../types";
import { enqueue } from "../sync/outbox";

const BILLING_LS_KEY = 'billing_plan';

export type BillingPlan = 'free' | 'annual' | 'lifetime';

export interface BillingStatus {
    plan: BillingPlan;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string | null;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
    updatedAt: number;
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
        localStorage.setItem(BILLING_LS_KEY, JSON.stringify(status));
        callback(status);
    });
}

export function getCachedBillingStatus(): BillingStatus {
    try {
        const raw = localStorage.getItem(BILLING_LS_KEY);
        if (!raw) return FREE_BILLING_STATUS;
        return JSON.parse(raw) as BillingStatus;
    } catch {
        return FREE_BILLING_STATUS;
    }
}

function authCheck() {
    const user = auth.currentUser;
    if (!user) {
        console.error("User is not authenticated");
        return null;
    }
    return user;
}

export async function storeEncryptedDEK(encryptedDEK: string, emailEncryptedDEK: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, { encryptedDEK, emailEncryptedDEK });
}

export async function addEmailEncryptedDEK(emailEncryptedDEK: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    await setDoc(metaDoc, { emailEncryptedDEK }, { merge: true });
}

export async function fetchEncryptedDEK(): Promise<{ encryptedDEK: string; emailEncryptedDEK?: string } | null> {
    const user = authCheck();
    if (!user) return null;
    const metaDoc = doc(db, "users", user.uid, "meta", "encryption");
    const snap = await getDoc(metaDoc);
    if (!snap.exists()) return null;
    return snap.data() as { encryptedDEK: string; emailEncryptedDEK?: string };
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

// ── Idea writes ─────────────────────────────────────────────────────────────
// Each of these only records the change in the sync outbox (sync/outbox.ts),
// which encrypts it and sends it — in order, retrying until the server
// accepts it, surviving reloads — and reports anything the server refuses
// through SyncStatusBanner. The returned promise resolves as soon as the
// change is safely recorded on this device, not when the server confirms
// it: callers only use it to refresh the local view, which should reflect
// the change straight away, online or not.

export async function addIdeaToFirebase(idea: IdeaType): Promise<void> {
    enqueue({ kind: 'create', idea });
}

export async function updateChecklistItemsInFirebase(ideaId: number, items: ChecklistItem[]): Promise<void> {
    enqueue({ kind: 'update', id: ideaId, patch: { items } });
}

export async function deleteIdeaFromFirebase(ideaId: number): Promise<void> {
    enqueue({ kind: 'delete', ids: [ideaId] });
}

export async function batchDeleteIdeasFromFirebase(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    enqueue({ kind: 'delete', ids });
}

export async function updateIdeaParentIdInFirebase(ideaId: number, newParentId: number): Promise<void> {
    enqueue({ kind: 'update', id: ideaId, patch: { parentID: newParentId } });
}

export async function updateIdeaNameInFirebase(ideaId: number, newName: string): Promise<void> {
    enqueue({ kind: 'update', id: ideaId, patch: { content: newName } });
}

export async function updateNoteTitleInFirebase(ideaId: number, newTitle: string): Promise<void> {
    enqueue({ kind: 'update', id: ideaId, patch: { noteTitle: newTitle } });
}

export async function updateIdeaLinkInFirebase(ideaId: number, newLink: string): Promise<void> {
    enqueue({ kind: 'update', id: ideaId, patch: { link: newLink } });
}

export async function updateIdeaPriorityInFirebase(ideaId: number, priority: 1 | 2 | 3 | undefined): Promise<void> {
    enqueue({ kind: 'update', id: ideaId, patch: { priority: priority ?? null } });
}

// ── Preferences ─────────────────────────────────────────────────────────────

export async function fetchLastSeenPatchVersion(): Promise<string | null> {
    const user = authCheck();
    if (!user) return null;
    const prefsDoc = doc(db, "users", user.uid, "meta", "preferences");
    const snap = await getDoc(prefsDoc);
    if (!snap.exists()) return null;
    return (snap.data().lastSeenPatchVersion as string) ?? null;
}

export async function updateLastSeenPatchVersion(version: string): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const prefsDoc = doc(db, "users", user.uid, "meta", "preferences");
    await setDoc(prefsDoc, { lastSeenPatchVersion: version }, { merge: true });
}

export async function fetchOnboardingSeen(): Promise<boolean> {
    const user = authCheck();
    if (!user) return false;
    const prefsDoc = doc(db, "users", user.uid, "meta", "preferences");
    const snap = await getDoc(prefsDoc);
    if (!snap.exists()) return false;
    return (snap.data().onboardingSeen as boolean) ?? false;
}

export async function markOnboardingSeen(): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const prefsDoc = doc(db, "users", user.uid, "meta", "preferences");
    await setDoc(prefsDoc, { onboardingSeen: true }, { merge: true });
}
