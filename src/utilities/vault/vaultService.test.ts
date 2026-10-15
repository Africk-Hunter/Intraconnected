import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
    getDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    txGet: vi.fn(),
    txSet: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
    doc: (_db: unknown, ...path: string[]) => path.join("/"),
    getDoc: fs.getDoc,
    updateDoc: fs.updateDoc,
    deleteDoc: fs.deleteDoc,
    serverTimestamp: () => "ts",
    runTransaction: async (_db: unknown, run: (tx: unknown) => Promise<void>) => run({ get: fs.txGet, set: fs.txSet }),
}));
vi.mock("../../firebaseConfig", () => ({ db: {}, auth: { currentUser: { uid: "uid-1" } } }));
const { enqueue, enqueueMany } = vi.hoisted(() => ({ enqueue: vi.fn(), enqueueMany: vi.fn() }));
vi.mock("../sync/outbox", () => ({ enqueue, enqueueMany }));
vi.mock("../platform", () => ({ isNative: () => false, onAppResume: () => () => {}, openExternal: () => {} }));
vi.mock("../crypto", async (original) => ({
    ...(await original<typeof import("../crypto")>()),
    ARGON2_DEFAULTS: { m: 32, t: 1, p: 1 },
}));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
});

import type { IdeaType, StandardIdea } from "../types";
import {
    commitVaultSetup,
    decryptVaultNote,
    loadVaultMeta,
    prepareVaultSetup,
    resetVault,
    saveVaultNote,
    unlockVault,
    type VaultMeta,
} from "./vaultService";
import { handleVaultCreation } from "../idea/creation";
import { getVaultSnapshot, lockVault } from "./vaultSession";
import { VaultError } from "./vaultError";

const saved = (): IdeaType[] => JSON.parse(storage.get("ideas") ?? "[]");

function serverHas(meta: VaultMeta | null) {
    fs.getDoc.mockResolvedValue({ exists: () => meta !== null, data: () => meta });
}

async function setUpVault(passphrase = "pass"): Promise<VaultMeta> {
    fs.txGet.mockResolvedValue({ exists: () => false });
    const pending = await prepareVaultSetup(passphrase);
    await commitVaultSetup(pending);
    return pending.meta;
}

beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    lockVault("signout");
    vi.stubGlobal("navigator", { onLine: true });
});

describe("setup", () => {
    it("writes nothing until committed, then unlocks", async () => {
        const pending = await prepareVaultSetup("pass");
        expect(fs.txSet).not.toHaveBeenCalled();
        expect(pending.recoveryCode).toHaveLength(39);
        fs.txGet.mockResolvedValue({ exists: () => false });
        await commitVaultSetup(pending);
        expect(fs.txSet).toHaveBeenCalledWith("users/uid-1/meta/vault", expect.objectContaining({ v: 1, keyId: pending.meta.keyId, createdAt: "ts" }));
        expect(getVaultSnapshot().unlocked).toBe(true);
        expect(Array.from(pending.raw).every((b) => b === 0)).toBe(true);
    });

    it("refuses to overwrite an existing vault", async () => {
        const pending = await prepareVaultSetup("pass");
        fs.txGet.mockResolvedValue({ exists: () => true });
        await expect(commitVaultSetup(pending)).rejects.toMatchObject({ code: "already-set-up" });
        expect(fs.txSet).not.toHaveBeenCalled();
        expect(getVaultSnapshot().unlocked).toBe(false);
    });
});

describe("loadVaultMeta", () => {
    it("uses this device's saved copy when the server can't be reached", async () => {
        const meta = await setUpVault();
        fs.getDoc.mockRejectedValue(new Error("offline"));
        expect(await loadVaultMeta()).toEqual(meta);
    });

    it("reports offline with no saved copy, and null for an account without a vault", async () => {
        fs.getDoc.mockRejectedValue(new Error("offline"));
        await expect(loadVaultMeta()).rejects.toBeInstanceOf(VaultError);
        serverHas(null);
        expect(await loadVaultMeta()).toBeNull();
    });

    it("unlocks with the right passphrase only", async () => {
        const meta = await setUpVault("right");
        lockVault("manual");
        serverHas(meta);
        await expect(unlockVault("wrong")).rejects.toMatchObject({ code: "wrong-passphrase" });
        await unlockVault("right");
        expect(getVaultSnapshot().unlocked).toBe(true);
    });
});

describe("vault notes", () => {
    it("are created encrypted, read back, and saved as one update with only the changes", async () => {
        await setUpVault();
        expect(await handleVaultCreation("Bank", 1, "hunter2", "bank.example.com")).toBe(true);
        const stored = saved()[0] as StandardIdea;
        expect(stored).toMatchObject({ isNote: true, isVault: true, parentID: 1 });
        expect(JSON.stringify(stored)).not.toMatch(/Bank|hunter2|bank\.example/);
        const text = await decryptVaultNote(stored);
        expect(text).toEqual({ label: "Bank", secret: "hunter2", link: "https://bank.example.com" });

        enqueue.mockClear();
        await saveVaultNote(stored.id, { ...text, secret: "new secret" }, text);
        expect(enqueue).toHaveBeenCalledTimes(1);
        expect(Object.keys(enqueue.mock.calls[0][0].patch)).toEqual(["content"]);
    });
});

describe("resetVault", () => {
    const vaultNote = { id: 5, parentID: 1, isNote: true, isVault: true, noteTitle: "vault1:0a1b2c3d:x", content: "vault1:0a1b2c3d:y", link: "vault1:0a1b2c3d:z" };
    const plain = { id: 6, parentID: 1, content: "keep", link: "" };

    it("changes nothing when the vault doc can't be deleted", async () => {
        storage.set("ideas", JSON.stringify([vaultNote, plain]));
        fs.deleteDoc.mockRejectedValue(new Error("offline"));
        await expect(resetVault()).rejects.toBeInstanceOf(VaultError);
        expect(saved()).toHaveLength(2);
        expect(enqueueMany).not.toHaveBeenCalled();
    });

    it("deletes the vault doc first, then exactly the vault notes", async () => {
        storage.set("ideas", JSON.stringify([vaultNote, plain]));
        fs.deleteDoc.mockResolvedValue(undefined);
        expect(await resetVault()).toBe(1);
        expect(saved().map((i) => i.id)).toEqual([6]);
        expect(enqueueMany).toHaveBeenCalledWith([{ kind: "delete", ids: [5] }]);
    });

    it("refuses while offline", async () => {
        vi.stubGlobal("navigator", { onLine: false });
        await expect(resetVault()).rejects.toMatchObject({ code: "offline" });
        expect(fs.deleteDoc).not.toHaveBeenCalled();
    });
});
