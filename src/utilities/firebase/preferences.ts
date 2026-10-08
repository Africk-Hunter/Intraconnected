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
