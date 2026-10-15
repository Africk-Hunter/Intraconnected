import { onAppResume } from "../platform";
import { VaultError } from "./vaultError";

// The unlocked vault key, held in memory only (never in any storage), plus
// what locks it again. Deliberately free of Firebase: helpers.ts reads the
// label cache from here, and helpers.ts is in every route's bundle.

export interface VaultSnapshot {
    unlocked: boolean;
    keyId: string | null;
    version: number;
}

export type LockReason = "manual" | "idle" | "background" | "signout" | "reset" | "other-tab";
export type AutoLockMinutes = 1 | 5 | 15;

export const AUTO_LOCK_CHOICES: AutoLockMinutes[] = [1, 5, 15];
const AUTO_LOCK_KEY = "vault_autolock_minutes";
const DEFAULT_AUTO_LOCK: AutoLockMinutes = 5;
export const BACKGROUND_LOCK_MS = 60_000;
const CHANNEL_NAME = "intraconnected-vault";

let key: CryptoKey | null = null;
let keyId: string | null = null;
let boundUid: string | null = null;
let snapshot: VaultSnapshot = { unlocked: false, keyId: null, version: 0 };
const listeners = new Set<() => void>();
// Vault ciphertext (the stored noteTitle) → its decrypted label. Keyed by the
// ciphertext so an edit, here or synced from elsewhere, simply misses.
const labels = new Map<string, string>();

let idleDeadline = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let hiddenAt: number | null = null;
let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
let detachLifecycle: (() => void) | null = null;
let channel: BroadcastChannel | null = null;

function publish(): void {
    snapshot = { unlocked: key !== null, keyId, version: snapshot.version + 1 };
    listeners.forEach((listener) => listener());
}

export function getVaultSnapshot(): VaultSnapshot {
    return snapshot;
}

export function subscribeVault(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getAutoLockMinutes(): AutoLockMinutes {
    try {
        const stored = Number(localStorage.getItem(AUTO_LOCK_KEY));
        return (AUTO_LOCK_CHOICES as number[]).includes(stored) ? (stored as AutoLockMinutes) : DEFAULT_AUTO_LOCK;
    } catch {
        return DEFAULT_AUTO_LOCK;
    }
}

export function setAutoLockMinutes(minutes: AutoLockMinutes): void {
    try {
        localStorage.setItem(AUTO_LOCK_KEY, String(minutes));
    } catch {
        // storage unavailable: the choice lasts for this page only
    }
    if (key) touchVault();
    publish();
}

function clearTimers(): void {
    if (idleTimer) clearTimeout(idleTimer);
    if (backgroundTimer) clearTimeout(backgroundTimer);
    idleTimer = null;
    backgroundTimer = null;
    hiddenAt = null;
}

// Timers can be frozen while a phone app is suspended, so deadlines are also
// checked whenever the page or app comes back.
function enforceDeadlines(): void {
    if (!key) return;
    const now = Date.now();
    if (now >= idleDeadline) lockVault("idle");
    else if (hiddenAt !== null && now - hiddenAt >= BACKGROUND_LOCK_MS) lockVault("background");
}

function onVisibilityChange(): void {
    if (!key) return;
    if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        if (backgroundTimer) clearTimeout(backgroundTimer);
        backgroundTimer = setTimeout(() => lockVault("background"), BACKGROUND_LOCK_MS);
        return;
    }
    enforceDeadlines();
    if (backgroundTimer) clearTimeout(backgroundTimer);
    backgroundTimer = null;
    hiddenAt = null;
}

function attachLifecycle(): void {
    if (detachLifecycle) return;
    const stopResume = onAppResume(enforceDeadlines);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);
    detachLifecycle = () => {
        stopResume();
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
    };
}

function getChannel(): BroadcastChannel | null {
    if (channel || typeof BroadcastChannel === "undefined") return channel;
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => {
        if ((event.data as { type?: string } | null)?.type === "lock") lockVault("other-tab");
    };
    return channel;
}

export function setVaultUnlocked(nextKey: CryptoKey, nextKeyId: string, uid: string): void {
    if (keyId !== nextKeyId) labels.clear();
    key = nextKey;
    keyId = nextKeyId;
    boundUid = uid;
    attachLifecycle();
    getChannel();
    touchVault();
    publish();
}

// Synchronous, so clearDEK() can drop the key in the same step as its own.
export function lockVault(reason: LockReason): void {
    const wasUnlocked = key !== null;
    key = null;
    keyId = null;
    boundUid = null;
    labels.clear();
    clearTimers();
    detachLifecycle?.();
    detachLifecycle = null;
    if (reason === "manual" || reason === "reset") {
        try {
            getChannel()?.postMessage({ type: "lock" });
        } catch {
            // the other tabs keep their own timers
        }
    }
    if (wasUnlocked || reason === "reset") publish();
}

export function requireVaultKey(): { key: CryptoKey; keyId: string; uid: string } {
    if (!key || !keyId || !boundUid) throw new VaultError("locked");
    return { key, keyId, uid: boundUid };
}

// Pushes the idle deadline out: called on every vault action.
export function touchVault(): void {
    if (!key) return;
    idleDeadline = Date.now() + getAutoLockMinutes() * 60_000;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(enforceDeadlines, idleDeadline - Date.now());
}

export function getCachedVaultLabel(cipher: string): string | undefined {
    return labels.get(cipher);
}

export function cacheVaultLabel(cipher: string, label: string): void {
    cacheVaultLabels([[cipher, label]]);
}

// Many at once (after an unlock), announced with a single update.
export function cacheVaultLabels(entries: [cipher: string, label: string][]): void {
    if (!key) return;
    let changed = false;
    for (const [cipher, label] of entries) {
        if (labels.get(cipher) === label) continue;
        labels.set(cipher, label);
        changed = true;
    }
    if (changed) publish();
}
