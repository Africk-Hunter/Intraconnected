import { RECOVERY_KEY_ID, RECOVERY_PUBLIC_KEY_SPKI_BASE64 } from "./recoveryKey";
import { WRITE_ENC2, WRITE_PASSWORD_WRAP_V3 } from "./cryptoConfig";

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_ITERATIONS_V2 = 600_000;
const PASSWORD_WRAP_V2 = "v2:";
const PASSWORD_WRAP_V3 = "v3:argon2id:";
const FIELD_KEY_ID = "k1";
export const ARGON2_DEFAULTS = { m: 32_768, t: 3, p: 1 };
const ARGON2_LIMITS = { minMemory: 8, maxMemory: 65_536, maxIterations: 10, maxParallelism: 4 };

export interface Argon2Parameters {
    m: number;
    t: number;
    p: number;
}

export function uint8ToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

export function base64ToUint8(b64: string): Uint8Array {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function deriveKEK(password: string, uid: string, suffix = "", iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode(uid + suffix), iterations, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function aesEncrypt(data: Uint8Array, key: CryptoKey, aad?: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const algorithm: AesGcmParams = { name: "AES-GCM", iv };
    if (aad !== undefined) algorithm.additionalData = new TextEncoder().encode(aad);
    const ciphertext = await crypto.subtle.encrypt(algorithm, key, data);
    const combined = new Uint8Array(12 + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), 12);
    return uint8ToBase64(combined);
}

export async function aesDecrypt(encoded: string, key: CryptoKey, aad?: string): Promise<Uint8Array> {
    const combined = base64ToUint8(encoded);
    if (combined.length < 28) throw new Error("Encrypted data is truncated.");
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const algorithm: AesGcmParams = { name: "AES-GCM", iv };
    if (aad !== undefined) algorithm.additionalData = new TextEncoder().encode(aad);
    const decrypted = await crypto.subtle.decrypt(algorithm, key, data);
    return new Uint8Array(decrypted);
}

const PADDING_BUCKETS = [64, 128, 256, 512, 1024, 2048];

export function padEncryptedField(text: string): Uint8Array {
    const bytes = new TextEncoder().encode(text);
    const length = bytes.length;
    const needed = length + 4;
    const size = PADDING_BUCKETS.find(bucket => bucket >= needed)
        ?? Math.ceil(needed / 1024) * 1024;
    const padded = new Uint8Array(size);
    new DataView(padded.buffer).setUint32(0, length, false);
    padded.set(bytes, 4);
    return padded;
}

export function unpadEncryptedField(padded: Uint8Array): string {
    if (padded.length < 4) throw new Error("Padded encrypted data is truncated.");
    const length = new DataView(padded.buffer, padded.byteOffset, padded.byteLength).getUint32(0, false);
    if (length > padded.length - 4) throw new Error("Padded encrypted data has an invalid length.");
    for (let i = 4 + length; i < padded.length; i++) {
        if (padded[i] !== 0) throw new Error("Padded encrypted data is malformed.");
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(padded.slice(4, 4 + length));
}

// Plaintext is retained for old records. enc: stays byte-for-byte compatible;
// enc2: adds context binding and length padding when its write switch is on.
export async function encryptField(text: string, dek: CryptoKey, aad?: string): Promise<string> {
    if (WRITE_ENC2) {
        if (aad === undefined) throw new Error("Context is required to write enc2 fields.");
        return `enc2:${FIELD_KEY_ID}:${await aesEncrypt(padEncryptedField(text), dek, aad)}`;
    }
    return "enc:" + await aesEncrypt(new TextEncoder().encode(text), dek);
}

export async function decryptField(value: string | null | undefined, dek: CryptoKey, aad?: string): Promise<string> {
    if (!value) return "";
    if (value.startsWith("enc2:")) {
        const match = /^enc2:([^:]+):(.+)$/.exec(value);
        if (!match || match[1] !== FIELD_KEY_ID) throw new Error("Unsupported encrypted field version.");
        if (aad === undefined) throw new Error("Context is required to read enc2 fields.");
        return unpadEncryptedField(await aesDecrypt(match[2], dek, aad));
    }
    if (!value.startsWith("enc:")) return value;
    return new TextDecoder().decode(await aesDecrypt(value.slice(4), dek));
}

export async function generateDEK(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function exportKey(key: CryptoKey): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

export async function importDEK(raw: Uint8Array, extractable = true): Promise<CryptoKey> {
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, extractable, ["encrypt", "decrypt"]);
}

async function importKey(raw: Uint8Array): Promise<CryptoKey> {
    return importDEK(raw, true);
}

export async function deriveArgon2Key(password: string, salt: Uint8Array, parameters: Argon2Parameters): Promise<CryptoKey> {
    if (
        !Number.isInteger(parameters.m) || parameters.m < ARGON2_LIMITS.minMemory || parameters.m > ARGON2_LIMITS.maxMemory
        || !Number.isInteger(parameters.t) || parameters.t < 1 || parameters.t > ARGON2_LIMITS.maxIterations
        || !Number.isInteger(parameters.p) || parameters.p < 1 || parameters.p > ARGON2_LIMITS.maxParallelism
        || salt.length !== 16
    ) {
        throw new Error("Password wrap uses unsupported Argon2id parameters.");
    }

    let derived: Uint8Array;
    try {
        const { argon2id } = await import("hash-wasm");
        derived = await argon2id({
            password,
            salt,
            parallelism: parameters.p,
            iterations: parameters.t,
            memorySize: parameters.m,
            hashLength: 32,
            outputType: "binary",
        });
    } catch (cause) {
        throw Object.assign(new Error("Argon2id could not be loaded to unlock this account."), {
            code: "crypto/argon2-unavailable",
            cause,
        });
    }
    return crypto.subtle.importKey("raw", derived, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export interface WrapOptions {
    argon2Parameters?: Argon2Parameters;
}

export async function wrapDEK(dek: CryptoKey, password: string, uid: string, options?: WrapOptions): Promise<string> {
    if (WRITE_PASSWORD_WRAP_V3 || options?.argon2Parameters) {
        const parameters = options?.argon2Parameters ?? ARGON2_DEFAULTS;
        try {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const kek = await deriveArgon2Key(password, salt, parameters);
            return `${PASSWORD_WRAP_V3}m=${parameters.m},t=${parameters.t},p=${parameters.p}:${uint8ToBase64(salt)}:${await aesEncrypt(await exportKey(dek), kek)}`;
        } catch (error) {
            if (options?.argon2Parameters) throw error;
            console.error("Argon2id password wrapping failed; writing a v2 PBKDF2 wrap instead.", error);
        }
    }
    const kek = await deriveKEK(password, uid, "", PBKDF2_ITERATIONS_V2);
    return PASSWORD_WRAP_V2 + await aesEncrypt(await exportKey(dek), kek);
}

export async function unwrapDEK(encryptedDEK: string, password: string, uid: string): Promise<CryptoKey> {
    if (encryptedDEK.startsWith(PASSWORD_WRAP_V3)) {
        const match = /^v3:argon2id:m=(\d+),t=(\d+),p=(\d+):([^:]+):(.+)$/.exec(encryptedDEK);
        if (!match) throw new Error("Password wrap is malformed.");
        const parameters = { m: Number(match[1]), t: Number(match[2]), p: Number(match[3]) };
        const salt = base64ToUint8(match[4]);
        const kek = await deriveArgon2Key(password, salt, parameters);
        return importKey(await aesDecrypt(match[5], kek));
    }
    const v2 = encryptedDEK.startsWith(PASSWORD_WRAP_V2);
    const kek = await deriveKEK(password, uid, "", v2 ? PBKDF2_ITERATIONS_V2 : PBKDF2_ITERATIONS);
    return importKey(await aesDecrypt(v2 ? encryptedDEK.slice(PASSWORD_WRAP_V2.length) : encryptedDEK, kek));
}

export async function wrapDEKWithEmail(dek: CryptoKey, email: string, uid: string): Promise<string> {
    const kek = await deriveKEK(email, uid, "-email");
    return aesEncrypt(await exportKey(dek), kek);
}

export async function unwrapDEKWithEmail(encryptedDEK: string, email: string, uid: string): Promise<CryptoKey> {
    const kek = await deriveKEK(email, uid, "-email");
    return importKey(await aesDecrypt(encryptedDEK, kek));
}

export async function wrapDEKForRecovery(
    dek: CryptoKey,
    uid: string,
    publicKeySpkiBase64 = RECOVERY_PUBLIC_KEY_SPKI_BASE64,
    keyId = RECOVERY_KEY_ID
): Promise<string> {
    if (!publicKeySpkiBase64) throw new Error("KMS recovery public key has not been configured.");
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(keyId)) throw new Error("KMS recovery key ID is invalid.");
    const publicKey = await crypto.subtle.importKey(
        "spki",
        base64ToUint8(publicKeySpkiBase64),
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"]
    );
    const payload = new Uint8Array(32 + new TextEncoder().encode(uid).length);
    payload.set(await exportKey(dek));
    payload.set(new TextEncoder().encode(uid), 32);
    const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, payload);
    return `kms1:${keyId}:` + uint8ToBase64(new Uint8Array(wrapped));
}

// A v3 password wrap is the only current-strength password format. With the
// write switch off, existing v2 wraps are deliberately left untouched.
export function needsPasswordWrapUpgrade(encryptedDEK: string): boolean {
    return WRITE_PASSWORD_WRAP_V3 && !encryptedDEK.startsWith(PASSWORD_WRAP_V3);
}
