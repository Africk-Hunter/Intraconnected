// Password wraps written from now on carry PASSWORD_WRAP_V2 and use the higher
// count; older wraps (no prefix) stay readable at the original count and are
// upgraded the next time that account signs in. The email wrap is unchanged.
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_ITERATIONS_V2 = 600_000;
const PASSWORD_WRAP_V2 = 'v2:';

function uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function deriveKEK(password: string, uid: string, suffix = '', iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode(uid + suffix), iterations, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function aesEncrypt(data: Uint8Array, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const combined = new Uint8Array(12 + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), 12);
    return uint8ToBase64(combined);
}

async function aesDecrypt(encoded: string, key: CryptoKey): Promise<Uint8Array> {
    const combined = base64ToUint8(encoded);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new Uint8Array(decrypted);
}

// Prefix marks encrypted fields so legacy plaintext falls through gracefully
export async function encryptField(text: string, dek: CryptoKey): Promise<string> {
    const enc = new TextEncoder();
    return 'enc:' + await aesEncrypt(enc.encode(text), dek);
}

export async function decryptField(value: string | null | undefined, dek: CryptoKey): Promise<string> {
    if (!value) return '';
    if (!value.startsWith('enc:')) return value;
    const dec = new TextDecoder();
    const bytes = await aesDecrypt(value.slice(4), dek);
    return dec.decode(bytes);
}

export async function generateDEK(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function exportKey(key: CryptoKey): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

async function importKey(raw: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export async function wrapDEK(dek: CryptoKey, password: string, uid: string): Promise<string> {
    const kek = await deriveKEK(password, uid, '', PBKDF2_ITERATIONS_V2);
    return PASSWORD_WRAP_V2 + await aesEncrypt(await exportKey(dek), kek);
}

export async function unwrapDEK(encryptedDEK: string, password: string, uid: string): Promise<CryptoKey> {
    const v2 = encryptedDEK.startsWith(PASSWORD_WRAP_V2);
    const kek = await deriveKEK(password, uid, '', v2 ? PBKDF2_ITERATIONS_V2 : PBKDF2_ITERATIONS);
    return importKey(await aesDecrypt(v2 ? encryptedDEK.slice(PASSWORD_WRAP_V2.length) : encryptedDEK, kek));
}

export async function wrapDEKWithEmail(dek: CryptoKey, email: string, uid: string): Promise<string> {
    const kek = await deriveKEK(email, uid, '-email');
    return aesEncrypt(await exportKey(dek), kek);
}

export async function unwrapDEKWithEmail(encryptedDEK: string, email: string, uid: string): Promise<CryptoKey> {
    const kek = await deriveKEK(email, uid, '-email');
    return importKey(await aesDecrypt(encryptedDEK, kek));
}


// True for a password wrap written with the old, lower iteration count.
export function isLegacyPasswordWrap(encryptedDEK: string): boolean {
    return !encryptedDEK.startsWith(PASSWORD_WRAP_V2);
}
