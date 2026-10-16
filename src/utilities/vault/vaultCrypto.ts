import {
    ARGON2_DEFAULTS,
    aesDecrypt,
    aesEncrypt,
    base64ToUint8,
    deriveArgon2Key,
    padEncryptedField,
    uint8ToBase64,
    unpadEncryptedField,
    type Argon2Parameters,
} from "../crypto";
import { VaultError } from "./vaultError";

// Pure crypto for vault notes: no Firebase, no storage. A vault note's fields
// are encrypted here with the vault key first; the outbox then encrypts the
// resulting `vault1:` string again with the account key like any other field.

export type VaultField = "noteTitle" | "content" | "link";

export { VaultError, type VaultErrorCode } from "./vaultError";

const KEY_BYTES = 32;
const CODE_BYTES = 20;
const CODE_GROUP = 4;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PASSPHRASE_WRAP = "vpw1:argon2id:";
const RECOVERY_WRAP = "vrc1:";
const FIELD_PREFIX = "vault1:";
const FIELD_PATTERN = /^vault1:([0-9a-f]{8}):(.+)$/;
const RECOVERY_INFO = "intraconnected-vault-recovery-v1";

// Binds a wrapped vault key to this account and this vault, so no other
// wrapped key (the account's own password wrap included) can stand in for it.
function wrapContext(uid: string, keyId: string): string {
    return `intraconnected-vault-key|${uid}|${keyId}`;
}

function fieldContext(uid: string, ideaId: number, field: VaultField): string {
    return `${uid}|${ideaId}|vault.${field}`;
}

export function generateVaultKeyId(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateRawVaultKey(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(KEY_BYTES));
}

export function importVaultKey(raw: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// ── Recovery code ──────────────────────────────────────────────────────────

function encodeBase32(bytes: Uint8Array): string {
    let out = "";
    let buffer = 0;
    let bits = 0;
    for (const byte of bytes) {
        buffer = (buffer << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += CROCKFORD[(buffer >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += CROCKFORD[(buffer << (5 - bits)) & 31];
    return out;
}

export function generateRecoveryCode(): string {
    const chars = encodeBase32(crypto.getRandomValues(new Uint8Array(CODE_BYTES)));
    return chars.match(new RegExp(`.{${CODE_GROUP}}`, "g"))!.join("-");
}

// Upper case, O read as 0 and I/L as 1, so a code copied by hand still works.
function normalizeRecoveryInput(input: string): string {
    return input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

export function parseRecoveryCode(input: string): Uint8Array {
    const chars = normalizeRecoveryInput(input);
    if (chars.length !== CODE_BYTES * 8 / 5) throw new VaultError("malformed-code");
    const bytes = new Uint8Array(CODE_BYTES);
    let buffer = 0;
    let bits = 0;
    let at = 0;
    for (const ch of chars) {
        const value = CROCKFORD.indexOf(ch);
        if (value === -1) throw new VaultError("malformed-code");
        buffer = ((buffer << 5) | value) & 0xffff;
        bits += 5;
        if (bits >= 8) {
            bytes[at++] = (buffer >>> (bits - 8)) & 0xff;
            bits -= 8;
        }
    }
    return bytes;
}

export function recoveryCodeGroups(code: string): string[] {
    return code.split("-");
}

async function recoveryKey(code: string, uid: string): Promise<CryptoKey> {
    const bytes = parseRecoveryCode(code);
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", bytes, "HKDF", false, ["deriveKey"]);
    bytes.fill(0);
    return crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt: enc.encode(`intraconnected-vault|${uid}`), info: enc.encode(RECOVERY_INFO) },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

// ── Wraps ──────────────────────────────────────────────────────────────────

async function passphraseKey(passphrase: string, salt: Uint8Array, parameters: Argon2Parameters): Promise<CryptoKey> {
    try {
        return await deriveArgon2Key(passphrase, salt, parameters);
    } catch (error) {
        if ((error as { code?: string }).code === "crypto/argon2-unavailable") throw new VaultError("argon2-unavailable");
        throw new VaultError("damaged");
    }
}

export async function wrapWithPassphrase(
    raw: Uint8Array,
    passphrase: string,
    uid: string,
    keyId: string,
    parameters: Argon2Parameters = ARGON2_DEFAULTS
): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const kek = await passphraseKey(passphrase, salt, parameters);
    const sealed = await aesEncrypt(raw, kek, wrapContext(uid, keyId));
    return `${PASSPHRASE_WRAP}m=${parameters.m},t=${parameters.t},p=${parameters.p}:${uint8ToBase64(salt)}:${sealed}`;
}

export async function unwrapWithPassphrase(wrap: string, passphrase: string, uid: string, keyId: string): Promise<Uint8Array> {
    const match = /^vpw1:argon2id:m=(\d+),t=(\d+),p=(\d+):([^:]+):(.+)$/.exec(wrap);
    if (!match) throw new VaultError("damaged");
    let salt: Uint8Array;
    try {
        salt = base64ToUint8(match[4]);
    } catch {
        throw new VaultError("damaged");
    }
    const kek = await passphraseKey(passphrase, salt, { m: Number(match[1]), t: Number(match[2]), p: Number(match[3]) });
    try {
        return await aesDecrypt(match[5], kek, wrapContext(uid, keyId));
    } catch {
        throw new VaultError("wrong-passphrase");
    }
}

export async function wrapWithRecoveryCode(raw: Uint8Array, code: string, uid: string, keyId: string): Promise<string> {
    const kek = await recoveryKey(code, uid);
    return RECOVERY_WRAP + await aesEncrypt(raw, kek, wrapContext(uid, keyId));
}

export async function unwrapWithRecoveryCode(wrap: string, code: string, uid: string, keyId: string): Promise<Uint8Array> {
    if (!wrap.startsWith(RECOVERY_WRAP)) throw new VaultError("damaged");
    const kek = await recoveryKey(code, uid);
    try {
        return await aesDecrypt(wrap.slice(RECOVERY_WRAP.length), kek, wrapContext(uid, keyId));
    } catch {
        throw new VaultError("wrong-code");
    }
}

// ── Fields ─────────────────────────────────────────────────────────────────

export async function encryptVaultField(
    text: string,
    key: CryptoKey,
    keyId: string,
    uid: string,
    ideaId: number,
    field: VaultField
): Promise<string> {
    return `${FIELD_PREFIX}${keyId}:${await aesEncrypt(padEncryptedField(text), key, fieldContext(uid, ideaId, field))}`;
}

export async function decryptVaultField(
    value: string,
    key: CryptoKey,
    keyId: string,
    uid: string,
    ideaId: number,
    field: VaultField
): Promise<string> {
    const match = FIELD_PATTERN.exec(value);
    if (!match) throw new VaultError("damaged");
    if (match[1] !== keyId) throw new VaultError("other-vault");
    try {
        return unpadEncryptedField(await aesDecrypt(match[2], key, fieldContext(uid, ideaId, field)));
    } catch {
        throw new VaultError("damaged");
    }
}

export function vaultKeyIdOf(value: string | undefined): string | null {
    if (!value) return null;
    return FIELD_PATTERN.exec(value)?.[1] ?? null;
}
