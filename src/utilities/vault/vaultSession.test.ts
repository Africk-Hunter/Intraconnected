import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resume } = vi.hoisted(() => ({ resume: { callback: null as null | (() => void) } }));
vi.mock("../platform", () => ({
    isNative: () => false,
    onAppResume: (callback: () => void) => {
        resume.callback = callback;
        return () => { resume.callback = null; };
    },
}));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
});

const doc = {
    visibilityState: "visible" as "visible" | "hidden",
    handlers: new Set<() => void>(),
    addEventListener: (_: string, handler: () => void) => doc.handlers.add(handler),
    removeEventListener: (_: string, handler: () => void) => doc.handlers.delete(handler),
};
vi.stubGlobal("document", doc);

function setVisibility(state: "visible" | "hidden") {
    doc.visibilityState = state;
    doc.handlers.forEach((handler) => handler());
}

import {
    BACKGROUND_LOCK_MS,
    cacheVaultLabel,
    getCachedVaultLabel,
    getVaultSnapshot,
    lockVault,
    requireVaultKey,
    setAutoLockMinutes,
    setVaultUnlocked,
    subscribeVault,
    touchVault,
} from "./vaultSession";
import { VaultError } from "./vaultError";

const fakeKey = {} as CryptoKey;

beforeEach(() => {
    vi.useFakeTimers();
    storage.clear();
    doc.visibilityState = "visible";
});

afterEach(() => {
    lockVault("signout");
    vi.useRealTimers();
});

describe("vault session", () => {
    it("holds the key until locked, and refuses it while locked", () => {
        expect(() => requireVaultKey()).toThrow(VaultError);
        setVaultUnlocked(fakeKey, "0a1b2c3d", "uid-1");
        expect(requireVaultKey()).toEqual({ key: fakeKey, keyId: "0a1b2c3d", uid: "uid-1" });
        lockVault("manual");
        expect(() => requireVaultKey()).toThrow(VaultError);
    });

    it("locks after the idle time, and each vault action pushes that out", () => {
        setVaultUnlocked(fakeKey, "0a1b2c3d", "uid-1");
        vi.advanceTimersByTime(4 * 60_000);
        touchVault();
        vi.advanceTimersByTime(4 * 60_000);
        expect(getVaultSnapshot().unlocked).toBe(true);
        vi.advanceTimersByTime(60_000 + 1);
        expect(getVaultSnapshot().unlocked).toBe(false);
    });

    it("uses the chosen auto-lock time", () => {
        setVaultUnlocked(fakeKey, "0a1b2c3d", "uid-1");
        setAutoLockMinutes(1);
        vi.advanceTimersByTime(60_000 + 1);
        expect(getVaultSnapshot().unlocked).toBe(false);
    });

    it("locks after a minute in the background, not before", () => {
        setVaultUnlocked(fakeKey, "0a1b2c3d", "uid-1");
        setVisibility("hidden");
        vi.advanceTimersByTime(BACKGROUND_LOCK_MS - 1000);
        setVisibility("visible");
        vi.advanceTimersByTime(BACKGROUND_LOCK_MS);
        expect(getVaultSnapshot().unlocked).toBe(true);
        setVisibility("hidden");
        vi.advanceTimersByTime(BACKGROUND_LOCK_MS);
        expect(getVaultSnapshot().unlocked).toBe(false);
    });

    it("checks the deadlines on resume, for timers that were frozen", () => {
        setVaultUnlocked(fakeKey, "0a1b2c3d", "uid-1");
        vi.setSystemTime(Date.now() + 10 * 60_000); // the clock moved, no timer fired
        expect(getVaultSnapshot().unlocked).toBe(true);
        resume.callback?.();
        expect(getVaultSnapshot().unlocked).toBe(false);
    });

    it("clears cached labels on lock and announces changes with a new snapshot", () => {
        const seen: number[] = [];
        const stop = subscribeVault(() => seen.push(getVaultSnapshot().version));
        setVaultUnlocked(fakeKey, "0a1b2c3d", "uid-1");
        const before = getVaultSnapshot();
        expect(getVaultSnapshot()).toBe(before);
        cacheVaultLabel("vault1:0a1b2c3d:abc", "Bank");
        expect(getCachedVaultLabel("vault1:0a1b2c3d:abc")).toBe("Bank");
        cacheVaultLabel("vault1:0a1b2c3d:abc", "Bank"); // unchanged: no update
        lockVault("manual");
        expect(getCachedVaultLabel("vault1:0a1b2c3d:abc")).toBeUndefined();
        expect(seen).toHaveLength(3);
        stop();
    });

    it("does not cache labels while locked", () => {
        cacheVaultLabel("vault1:0a1b2c3d:abc", "Bank");
        expect(getCachedVaultLabel("vault1:0a1b2c3d:abc")).toBeUndefined();
    });
});

describe("signing out", () => {
    it("clearDEK locks the vault", async () => {
        vi.doMock("@aparajita/capacitor-secure-storage", () => ({}));
        vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
        vi.stubGlobal("indexedDB", { open: () => { throw new Error("no idb"); } });
        const { clearDEK } = await import("../dekStore");
        setVaultUnlocked(fakeKey, "0a1b2c3d", "uid-1");
        void clearDEK();
        expect(getVaultSnapshot().unlocked).toBe(false);
    });
});
