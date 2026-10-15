import { describe, expect, it, vi } from "vitest";

vi.mock("./cryptoConfig", () => ({
    WRITE_ENC2: true,
    WRITE_PASSWORD_WRAP_V3: true,
}));

import {
    decryptField,
    encryptField,
    importDEK,
    needsPasswordWrapUpgrade,
    padEncryptedField,
    unpadEncryptedField,
    unwrapDEK,
    wrapDEK,
    wrapDEKForRecovery,
} from "./crypto";

const FIXTURE_KEY = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=";
const FIXTURES = {
    legacyField: "enc:AAECAwQFBgcICQoLdOSOEX5w+S8eypHpkD3Lg/UWVzfvb+qzmydW4ne9",
    contextualField: "enc2:k1:AAECAwQFBgcICQoLGIHpfX9mrCcTkoP1miwZiIQ8to4YYncxFs5juo7XbQXeb0bil88x/fTlw7Zc97Uz9DBcedTV5JZxT7SMoMAbzwkhqyrtZIcLiwerSaFei+s=",
    passwordV1: "AAECAwQFBgcICQoLSqAN/3E/+8N3QMYSKoPY/g0ScGMLxHANngaYEPz2QIhBy2f+VaCnt1XB2nB2rHAC",
    passwordV2: "v2:AAECAwQFBgcICQoLLsyvCT/SeWK+sVfK8s/1Z8Ru9Culr6+VAGP1SURrcsVAKStbW8zws5WsNsha2Kq/",
    passwordV3: "v3:argon2id:m=32,t=1,p=1:ICEiIyQlJicoKSorLC0uLw==:AAECAwQFBgcICQoL4DWDtcroYgYlJTjdH0cX4jvpB2YmqKQZtqKo0AOGVe3UHdcw3gHbdyvPhZ0iYZKl",
} as const;

const uid = "uid-1";
const password = "fixture password";
const context = `${uid}|42|content`;

async function fixedKey(): Promise<CryptoKey> {
    return importDEK(Uint8Array.from(atob(FIXTURE_KEY), character => character.charCodeAt(0)));
}

async function raw(key: CryptoKey): Promise<number[]> {
    return Array.from(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

describe("field encryption formats", () => {
    it("decrypts committed legacy and context-bound fixtures", async () => {
        const dek = await fixedKey();
        expect(await decryptField(FIXTURES.legacyField, dek)).toBe("legacy fixture");
        expect(await decryptField(FIXTURES.contextualField, dek, context)).toBe("bound fixture");
    });

    it("rejects an enc2 field moved to another idea or field", async () => {
        const dek = await fixedKey();
        await expect(decryptField(FIXTURES.contextualField, dek, `${uid}|43|content`)).rejects.toBeDefined();
        await expect(decryptField(FIXTURES.contextualField, dek, `${uid}|42|link`)).rejects.toBeDefined();
    });

    it("round-trips empty, ASCII, multibyte and 5 KB text using enc2", async () => {
        const dek = await fixedKey();
        for (const text of ["", "ASCII text", "café 🧠", "x".repeat(5 * 1024)]) {
            const encrypted = await encryptField(text, dek, context);
            expect(encrypted.startsWith("enc2:k1:")).toBe(true);
            expect(await decryptField(encrypted, dek, context)).toBe(text);
        }
    });

    it("pads to the configured buckets and preserves a large checklist below 1 MiB", () => {
        expect(padEncryptedField("").length).toBe(64);
        expect(padEncryptedField("x".repeat(60)).length).toBe(64);
        expect(padEncryptedField("x".repeat(61)).length).toBe(128);
        expect(padEncryptedField("é".repeat(30)).length).toBe(64);
        expect(padEncryptedField("é".repeat(30) + "x").length).toBe(128);
        expect(unpadEncryptedField(padEncryptedField("")).length).toBe(0);

        const paddedChecklistBytes = Array.from({ length: 100 }, () => padEncryptedField("x".repeat(5 * 1024)).length)
            .reduce((total, size) => total + size, 0);
        expect(paddedChecklistBytes).toBeLessThan(1024 * 1024);
    });
});

describe("password wrap formats", () => {
    it("opens fixed v1, v2 and v3 fixtures", async () => {
        const dekV1 = await unwrapDEK(FIXTURES.passwordV1, password, uid);
        const dekV2 = await unwrapDEK(FIXTURES.passwordV2, password, uid);
        const dekV3 = await unwrapDEK(FIXTURES.passwordV3, password, uid);
        expect(await raw(dekV1)).toEqual(await raw(dekV2));
        expect(await raw(dekV2)).toEqual(await raw(dekV3));
        expect(await raw(dekV3)).toEqual(await raw(await fixedKey()));
    });

    it("writes and opens a v3 wrap with test-only cheap Argon2id parameters", async () => {
        const dek = await fixedKey();
        const wrapped = await wrapDEK(dek, password, uid, { argon2Parameters: { m: 32, t: 1, p: 1 } });
        expect(wrapped).toMatch(/^v3:argon2id:m=32,t=1,p=1:/);
        expect(needsPasswordWrapUpgrade(wrapped)).toBe(false);
        expect(await raw(await unwrapDEK(wrapped, password, uid))).toEqual(await raw(dek));
    });

    it("rejects a wrong password", async () => {
        await expect(unwrapDEK(FIXTURES.passwordV3, "wrong password", uid)).rejects.toBeDefined();
    });

    it("marks pre-v3 wraps for upgrade when v3 writes are enabled", () => {
        expect(needsPasswordWrapUpgrade(FIXTURES.passwordV1)).toBe(true);
        expect(needsPasswordWrapUpgrade(FIXTURES.passwordV2)).toBe(true);
    });

    it("falls back to a readable v2 wrap if Argon2id cannot load", async () => {
        vi.doMock("hash-wasm", () => ({
            argon2id: vi.fn().mockRejectedValue(new Error("WASM load failed")),
        }));
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            const wrapped = await wrapDEK(await fixedKey(), password, uid);
            expect(wrapped.startsWith("v2:")).toBe(true);
        } finally {
            vi.doUnmock("hash-wasm");
            log.mockRestore();
        }
    });
});

describe("KMS recovery wrapping", () => {
    it("wraps the DEK together with the account uid using RSA-OAEP", async () => {
        const pair = await crypto.subtle.generateKey(
            { name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
            true,
            ["encrypt", "decrypt"]
        );
        const publicKey = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
        const publicKeyBase64 = btoa(String.fromCharCode(...publicKey));
        const wrapped = await wrapDEKForRecovery(await fixedKey(), uid, publicKeyBase64);
        expect(wrapped.startsWith("kms1:k1:")).toBe(true);

        const ciphertext = Uint8Array.from(atob(wrapped.slice("kms1:k1:".length)), character => character.charCodeAt(0));
        const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, pair.privateKey, ciphertext));
        expect(Array.from(plaintext.slice(0, 32))).toEqual(await raw(await fixedKey()));
        expect(new TextDecoder().decode(plaintext.slice(32))).toBe(uid);
    });

    it("includes the selected key ID and rejects malformed IDs", async () => {
        const pair = await crypto.subtle.generateKey(
            { name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
            true,
            ["encrypt", "decrypt"]
        );
        const publicKey = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
        const publicKeyBase64 = btoa(String.fromCharCode(...publicKey));
        const wrapped = await wrapDEKForRecovery(await fixedKey(), uid, publicKeyBase64, "k2");
        expect(wrapped.startsWith("kms1:k2:")).toBe(true);
        await expect(wrapDEKForRecovery(await fixedKey(), uid, publicKeyBase64, "K2")).rejects.toThrow(/key ID is invalid/);
    });

    it("fails explicitly until the public key is configured", async () => {
        await expect(wrapDEKForRecovery(await fixedKey(), uid, "")).rejects.toThrow(/not been configured/);
    });
});
