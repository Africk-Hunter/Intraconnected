import { isNative } from './platform';

const SESSION_KEY = 'dek_session';
const LOCAL_KEY = 'dek_local';
const NATIVE_KEY = 'dek';
// Set when "Remember me" was used: the idle limit is longer for those sessions.
// Last click/keypress, shared by every tab; see idleSignOut.ts. Cleared with the key.
export const ACTIVITY_KEY = 'last_activity';
const REMEMBERED_FLAG = 'session_remembered';
const IDB_NAME = 'intraconnected-keys';
const IDB_STORE = 'keys';
const IDB_KEY = 'dek';
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

// "Remember me" on the web keeps the key as a non-extractable CryptoKey in
// IndexedDB: a script (or anyone reading the browser profile) can still ask
// the browser to use it on this origin, but can no longer read the raw bytes
// and carry them away, which the old raw copy in localStorage allowed.
function openKeyDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbRun<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openKeyDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, mode);
            const req = run(tx.objectStore(IDB_STORE));
            tx.oncomplete = () => resolve(req.result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

async function storeRememberedKey(raw: ArrayBuffer): Promise<void> {
    const locked = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    await idbRun('readwrite', store => store.put(locked, IDB_KEY));
}

async function loadRememberedKey(): Promise<CryptoKey | null> {
    try {
        const found = await idbRun<unknown>('readonly', store => store.get(IDB_KEY));
        return found instanceof CryptoKey ? found : null;
    } catch {
        return null;
    }
}

async function clearRememberedKey(): Promise<void> {
    try {
        await idbRun('readwrite', store => store.delete(IDB_KEY));
    } catch {
        // storage unavailable — nothing was stored there
    }
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
        localStorage.removeItem(LOCAL_KEY); // the old raw copy, if this browser still has one
        if (remember) {
            try {
                await storeRememberedKey(raw);
                sessionStorage.removeItem(SESSION_KEY);
                localStorage.setItem(REMEMBERED_FLAG, '1');
                return;
            } catch {
                // IndexedDB refused (some private modes): this tab session only
            }
        }
        await clearRememberedKey();
        localStorage.removeItem(REMEMBERED_FLAG);
        sessionStorage.setItem(SESSION_KEY, encoded);
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
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session) {
        try {
            _dek = await importEncoded(session);
            return true;
        } catch {
            sessionStorage.removeItem(SESSION_KEY);
        }
    }
    const remembered = await loadRememberedKey();
    if (remembered) {
        _dek = remembered;
        return true;
    }
    // Written by an older build: move it into IndexedDB, then drop the raw copy.
    const legacy = localStorage.getItem(LOCAL_KEY);
    if (!legacy) return false;
    try {
        const key = await importEncoded(legacy);
        _dek = key;
        await storeRememberedKey(await crypto.subtle.exportKey('raw', key));
        localStorage.setItem(REMEMBERED_FLAG, '1');
        localStorage.removeItem(LOCAL_KEY);
        return true;
    } catch {
        // Unreadable, or IndexedDB refused: keep using it this load if it parsed.
        if (_dek) return true;
        localStorage.removeItem(LOCAL_KEY);
        return false;
    }
}

export function isRememberedSession(): boolean {
    try {
        return localStorage.getItem(REMEMBERED_FLAG) === '1';
    } catch {
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
    localStorage.removeItem(REMEMBERED_FLAG);
    localStorage.removeItem(ACTIVITY_KEY);
    return isNative() ? clearNativeKey() : clearRememberedKey();
}
