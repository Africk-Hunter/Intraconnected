import { db } from "../../firebaseConfig";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { authCheck } from "./currentUser";

// Small per-user flags at users/{uid}/meta/preferences.

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

// Whether this account has already seen the upgrade celebration for a plan —
// kept on the account (not localStorage) so it shows once per account, not
// browser. The Lifetime flag keeps its original field name.
const CELEBRATED_FIELD = { annual: "annualCelebrated", lifetime: "lifetimeCelebrated" } as const;

export async function fetchPlanCelebrated(plan: "annual" | "lifetime"): Promise<boolean> {
    const user = authCheck();
    if (!user) return true;
    const prefsDoc = doc(db, "users", user.uid, "meta", "preferences");
    const snap = await getDoc(prefsDoc);
    if (!snap.exists()) return false;
    return (snap.data()[CELEBRATED_FIELD[plan]] as boolean) ?? false;
}

export async function markPlanCelebrated(plan: "annual" | "lifetime"): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const prefsDoc = doc(db, "users", user.uid, "meta", "preferences");
    await setDoc(prefsDoc, { [CELEBRATED_FIELD[plan]]: true }, { merge: true });
}

// Dev-only: lets both celebrations show again after "Reset to Free".
export async function clearPlanCelebrated(): Promise<void> {
    const user = authCheck();
    if (!user) return;
    const prefsDoc = doc(db, "users", user.uid, "meta", "preferences");
    await setDoc(prefsDoc, { annualCelebrated: false, lifetimeCelebrated: false }, { merge: true });
}
