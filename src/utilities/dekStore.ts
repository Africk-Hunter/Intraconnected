import { isNative } from './platform';

const SESSION_KEY = 'dek_session';
const LOCAL_KEY = 'dek_local';
const NATIVE_KEY = 'dek';
let _dek: CryptoKey | null = null;

function encodeRaw(raw: ArrayBuffer): string {
    let binary = '';
    new Uint8Array(raw).forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
}

async function importEncoded(stored: string): Promise<CryptoKey> {
    const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

// In the app the key lives in the iOS Keychain / Android Keystore, which
// survives the OS killing the app (sessionStorage does not) and is not
// readable by other apps. It is only ever the device's own copy: no iCloud
// sync, no migration to another device. Loaded lazily so the web bundle
// never pulls the plugin in.
let nativeReady: Promise<typeof import('@aparajita/capacitor-secure-storage')> | null = null;

function nativeStore() {
    nativeReady ??= import('@aparajita/capacitor-secure-storage').then(async mod => {
        await mod.SecureStorage.setSynchronize(false);
        return mod;
    });
    return nativeReady;
}

export async function setDEK(key: CryptoKey, remember = false): Promise<void> {
    _dek = key;
    try {
        const raw = await crypto.subtle.exportKey('raw', key);
        const encoded = encodeRaw(raw);
        if (isNative()) {
            // An app is expected to keep you signed in, so "remember" doesn't
            // apply: the key is always kept.
            const { SecureStorage, KeychainAccess } = await nativeStore();
            await SecureStorage.set(NATIVE_KEY, encoded, false, false, KeychainAccess.afterFirstUnlockThisDeviceOnly);
            return;
        }
        sessionStorage.setItem(SESSION_KEY, encoded);
        if (remember) {
            localStorage.setItem(LOCAL_KEY, encoded);
        } else {
            localStorage.removeItem(LOCAL_KEY);
        }
    } catch {
        // non-extractable key, or the secure store refused — skip persistence
    }
}

// Reads the key back after a page load or an app restart. On the web that is
// sessionStorage (or localStorage when "Remember me" was checked); in the app,
// the Keychain / Keystore.
export async function loadPersistedDEK(): Promise<boolean> {
    if (isNative()) {
        try {
            const { SecureStorage } = await nativeStore();
            const stored = await SecureStorage.get(NATIVE_KEY, false, false);
            if (typeof stored !== 'string') return false;
            _dek = await importEncoded(stored);
            return true;
        } catch {
            // Corrupted or unreadable (e.g. restored from a backup onto a
            // device whose Keystore key is gone): same as no key.
            await clearNativeKey();
            return false;
        }
    }
    const stored = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(LOCAL_KEY);
    if (!stored) return false;
    try {
        _dek = await importEncoded(stored);
        return true;
    } catch {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(LOCAL_KEY);
        return false;
    }
}

export function getDEK(): CryptoKey {
    if (!_dek) throw new Error('Encryption key not initialized, please log in again.');
    return _dek;
}

async function clearNativeKey(): Promise<void> {
    try {
        const { SecureStorage } = await nativeStore();
        await SecureStorage.remove(NATIVE_KEY, false);
    } catch {
        // nothing stored, or already unreadable
    }
}

// The in-memory key and web storage are cleared immediately, before the
// returned promise settles: callers rely on that ordering (SessionEndedModal
// treats "key already cleared" as a deliberate sign-out). Await the promise
// before leaving the page so the Keychain / Keystore removal isn't cut off.
export function clearDEK(): Promise<void> {
    _dek = null;
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LOCAL_KEY);
    return isNative() ? clearNativeKey() : Promise.resolve();
}
