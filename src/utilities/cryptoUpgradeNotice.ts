// Remembers that a sign-in could not finish upgrading an account's key
// protection (recovery wrap, legacy-wrap removal, password wrap), so
// CryptoUpgradeNotice can tell the user after the redirect to /main, and tells
// the server (report-crypto-upgrade.ts) so stuck accounts can be counted.
// Sign-in still works in every one of these cases; the old wrap stays usable.

import { auth } from "../firebaseConfig";
import { apiUrl } from "./platform";

const KEY_PREFIX = "crypto_upgrade_problem_";

export type CryptoUpgradeStep = "recovery-wrap" | "recovery-store" | "legacy-removal" | "password-wrap";

// Best-effort and never throws: the page is about to be replaced, so keepalive.
async function sendReport(body: { step: CryptoUpgradeStep } | { resolved: true }): Promise<void> {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const idToken = await user.getIdToken();
        await fetch(apiUrl("/.netlify/functions/report-crypto-upgrade"), {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify(body),
            keepalive: true,
        });
    } catch (error) {
        console.error("Could not report the encryption upgrade status.", error);
    }
}

export function flagCryptoUpgradeProblem(uid: string, step: CryptoUpgradeStep): void {
    try {
        localStorage.setItem(`${KEY_PREFIX}${uid}`, String(Date.now()));
    } catch (error) {
        console.error("Could not remember the encryption upgrade problem.", error);
    }
    void sendReport({ step });
}

// Tells the server the account is no longer stuck.
export function reportCryptoUpgradeResolved(): void {
    void sendReport({ resolved: true });
}

export function clearCryptoUpgradeProblem(uid: string): void {
    try {
        localStorage.removeItem(`${KEY_PREFIX}${uid}`);
    } catch {
        /* non-critical */
    }
}

export function hasCryptoUpgradeProblem(uid: string): boolean {
    try {
        return localStorage.getItem(`${KEY_PREFIX}${uid}`) !== null;
    } catch {
        return false;
    }
}
