import { describe, expect, it, vi } from "vitest";

vi.mock("../cryptoConfig", () => ({
    WRITE_ENC2: true,
    WRITE_PASSWORD_WRAP_V3: true,
}));

import { decryptField, encryptField, wrapDEK, importDEK } from "../crypto";
import {
    VaultError,
    decryptVaultField,
    encryptVaultField,
    generateRawVaultKey,
    generateRecoveryCode,
    generateVaultKeyId,
    importVaultKey,
    parseRecoveryCode,
    recoveryCodeGroups,
    unwrapWithPassphrase,
    unwrapWithRecoveryCode,
    vaultKeyIdOf,
    wrapWithPassphrase,
    wrapWithRecoveryCode,
} from "./vaultCrypto";

const FAST = { m: 32, t: 1, p: 1 };
const uid = "uid-1";
const keyId = "0a1b2c3d";

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
        await promise;
        return undefined;
    } catch (error) {
        expect(error).toBeInstanceOf(VaultError);
        return (error as VaultError).code;
    }
}

describe("vault key ids and raw keys", () => {
    it("makes 8 lowercase hex characters and 32-byte keys", () => {
        expect(generateVaultKeyId()).toMatch(/^[0-9a-f]{8}$/);
        expect(generateRawVaultKey()).toHaveLength(32);
    });

    it("imports the key as non-extractable", async () => {
        const key = await importVaultKey(generateRawVaultKey());
        expect(key.extractable).toBe(false);
    });
});

describe("passphrase wrap", () => {
    it("round-trips the raw key", async () => {
        const raw = generateRawVaultKey();
        const wrap = await wrapWithPassphrase(raw, "correct horse", uid, keyId, FAST);
        expect(wrap.startsWith("vpw1:argon2id:m=32,t=1,p=1:")).toBe(true);
        expect(Array.from(await unwrapWithPassphrase(wrap, "correct horse", uid, keyId))).toEqual(Array.from(raw));
    });

    it("rejects a wrong passphrase, another account or another vault", async () => {
        const wrap = await wrapWithPassphrase(generateRawVaultKey(), "correct horse", uid, keyId, FAST);
        expect(await codeOf(unwrapWithPassphrase(wrap, "wrong", uid, keyId))).toBe("wrong-passphrase");
        expect(await codeOf(unwrapWithPassphrase(wrap, "correct horse", "uid-2", keyId))).toBe("wrong-passphrase");
        expect(await codeOf(unwrapWithPassphrase(wrap, "correct horse", uid, "ffffffff"))).toBe("wrong-passphrase");
    });

    it("never accepts the account's own password wrap in its place", async () => {
        const raw = generateRawVaultKey();
        const accountWrap = await wrapDEK(await importDEK(raw), "same password", uid, { argon2Parameters: FAST });
        expect(await codeOf(unwrapWithPassphrase(accountWrap, "same password", uid, keyId))).toBe("damaged");
        const relabelled = accountWrap.replace("v3:argon2id:", "vpw1:argon2id:");
        expect(await codeOf(unwrapWithPassphrase(relabelled, "same password", uid, keyId))).toBe("wrong-passphrase");
    });

    it("reports a missing Argon2id module separately from a wrong passphrase", async () => {
        const wrap = await wrapWithPassphrase(generateRawVaultKey(), "pw", uid, keyId, FAST);
        vi.resetModules();
        vi.doMock("hash-wasm", () => { throw new Error("no wasm"); });
        const fresh = await import("./vaultCrypto");
        let code: string | undefined;
        try {
            await fresh.unwrapWithPassphrase(wrap, "pw", uid, keyId);
        } catch (error) {
            code = (error as { code?: string }).code;
        }
        expect(code).toBe("argon2-unavailable");
        vi.doUnmock("hash-wasm");
        vi.resetModules();
    });
});

describe("recovery code", () => {
    it("is 32 Crockford characters in 8 groups of 4", () => {
        const code = generateRecoveryCode();
        expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
        expect(recoveryCodeGroups(code)).toHaveLength(8);
        expect(parseRecoveryCode(code)).toHaveLength(20);
    });

    it("accepts lower case, spaces, missing hyphens and O/I/L look-alikes", () => {
        const code = "0011-2233-4455-6677-8899-AABB-CCDD-EEFF";
        const expected = Array.from(parseRecoveryCode(code));
        expect(Array.from(parseRecoveryCode(code.toLowerCase().replace(/-/g, " ")))).toEqual(expected);
        expect(Array.from(parseRecoveryCode(code.replace(/-/g, "").replace(/0/g, "O").replace(/1/g, "l")))).toEqual(expected);
    });

    it("rejects characters outside the alphabet and the wrong length", () => {
        expect(() => parseRecoveryCode("U011-2233-4455-6677-8899-AABB-CCDD-EEFF")).toThrow(VaultError);
        expect(() => parseRecoveryCode("0011-2233")).toThrow(VaultError);
    });

    it("round-trips a wrap and rejects another code", async () => {
        const raw = generateRawVaultKey();
        const code = generateRecoveryCode();
        const wrap = await wrapWithRecoveryCode(raw, code, uid, keyId);
        expect(wrap.startsWith("vrc1:")).toBe(true);
        expect(Array.from(await unwrapWithRecoveryCode(wrap, code.toLowerCase(), uid, keyId))).toEqual(Array.from(raw));
        expect(await codeOf(unwrapWithRecoveryCode(wrap, generateRecoveryCode(), uid, keyId))).toBe("wrong-code");
        expect(await codeOf(unwrapWithRecoveryCode(wrap, "nonsense", uid, keyId))).toBe("malformed-code");
    });
});

describe("vault fields", () => {
    it("round-trips every field, empty and long text included", async () => {
        const key = await importVaultKey(generateRawVaultKey());
        for (const text of ["", "hunter2", "x".repeat(2000), "line\nbreak and émoji-free unicode"]) {
            for (const field of ["noteTitle", "content", "link"] as const) {
                const value = await encryptVaultField(text, key, keyId, uid, 42, field);
                expect(vaultKeyIdOf(value)).toBe(keyId);
                expect(await decryptVaultField(value, key, keyId, uid, 42, field)).toBe(text);
            }
        }
    });

    it("pads short texts to the same length", async () => {
        const key = await importVaultKey(generateRawVaultKey());
        const a = await encryptVaultField("a", key, keyId, uid, 1, "content");
        const b = await encryptVaultField("a much longer secret", key, keyId, uid, 1, "content");
        expect(a.length).toBe(b.length);
    });

    it("refuses ciphertext moved to another idea or field, or from another vault", async () => {
        const key = await importVaultKey(generateRawVaultKey());
        const value = await encryptVaultField("secret", key, keyId, uid, 1, "content");
        expect(await codeOf(decryptVaultField(value, key, keyId, uid, 2, "content"))).toBe("damaged");
        expect(await codeOf(decryptVaultField(value, key, keyId, uid, 1, "noteTitle"))).toBe("damaged");
        expect(await codeOf(decryptVaultField(value, key, "ffffffff", uid, 1, "content"))).toBe("other-vault");
        expect(await codeOf(decryptVaultField("plain text", key, keyId, uid, 1, "content"))).toBe("damaged");
    });

    it("comes back unchanged through the account-key encryption the outbox adds", async () => {
        const key = await importVaultKey(generateRawVaultKey());
        const dek = await importDEK(generateRawVaultKey());
        const inner = await encryptVaultField("secret", key, keyId, uid, 7, "content");
        const outer = await encryptField(inner, dek, `${uid}|7|content`);
        expect(outer.startsWith("enc2:")).toBe(true);
        expect(await decryptField(outer, dek, `${uid}|7|content`)).toBe(inner);
    });

    it("does not treat ordinary text as vault ciphertext", () => {
        expect(vaultKeyIdOf("vault1: my notes")).toBeNull();
        expect(vaultKeyIdOf(undefined)).toBeNull();
    });
});
