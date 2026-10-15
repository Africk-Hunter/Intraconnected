import { isNative } from './platform';

const SESSION_KEY = 'dek_session';
const SESSION_MARKER = 'dek_session_marker';
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

async function importEncoded(stored: string, extractable = false): Promise<CryptoKey> {
    const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);
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
    try {
        const raw = await crypto.subtle.exportKey('raw', key);
        const encoded = encodeRaw(raw);
        _dek = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        if (isNative()) {
            // An app is expected to keep you signed in, so "remember" doesn't
            // apply: the key is always kept.
            const { SecureStorage, KeychainAccess } = await nativeStore();
            await SecureStorage.set(NATIVE_KEY, encoded, false, false, KeychainAccess.afterFirstUnlockThisDeviceOnly);
            return;
        }
        localStorage.removeItem(LOCAL_KEY); // the old raw copy, if this browser still has one
        try {
            await storeRememberedKey(raw);
            sessionStorage.removeItem(SESSION_KEY);
            if (remember) {
                sessionStorage.removeItem(SESSION_MARKER);
                localStorage.setItem(REMEMBERED_FLAG, '1');
            } else {
                localStorage.removeItem(REMEMBERED_FLAG);
                sessionStorage.setItem(SESSION_MARKER, '1');
            }
        } catch (error) {
            // Never fall back to storing readable key bytes in browser storage.
            console.error('Could not persist the non-extractable encryption key.', error);
            await clearRememberedKey();
            localStorage.removeItem(REMEMBERED_FLAG);
            sessionStorage.removeItem(SESSION_MARKER);
        }
    } catch (error) {
        console.error('Could not initialize the encryption key store.', error);
    }
}

// Reads the key back after a page load or an app restart. Web keys are always
// stored as non-extractable CryptoKeys in IndexedDB; a session marker decides
// whether a non-remembered key is still valid for this tab.
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
        let migrated = false;
        try {
            const oldKey = await importEncoded(session, true);
            const raw = await crypto.subtle.exportKey('raw', oldKey);
            _dek = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
            await storeRememberedKey(raw);
            migrated = true;
        } catch (error) {
            console.error('Could not migrate the session encryption key.', error);
        }
        if (_dek) {
            sessionStorage.removeItem(SESSION_KEY);
            if (migrated) sessionStorage.setItem(SESSION_MARKER, '1');
            return true;
        }
        sessionStorage.removeItem(SESSION_KEY);
    }

    // Written by an older build: migrate the raw copy and remove it even when
    // IndexedDB is unavailable; keep the key only in memory for this session.
    const legacy = localStorage.getItem(LOCAL_KEY);
    if (legacy) {
        try {
            const oldKey = await importEncoded(legacy, true);
            const raw = await crypto.subtle.exportKey('raw', oldKey);
            _dek = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
            try {
                await storeRememberedKey(raw);
                localStorage.setItem(REMEMBERED_FLAG, '1');
            } catch (error) {
                console.error('Could not migrate the remembered encryption key to IndexedDB.', error);
                localStorage.removeItem(REMEMBERED_FLAG);
                sessionStorage.setItem(SESSION_MARKER, '1');
            }
            localStorage.removeItem(LOCAL_KEY);
            return true;
        } catch (error) {
            console.error('Could not read the legacy remembered encryption key.', error);
            localStorage.removeItem(LOCAL_KEY);
        }
    }

    const sessionMarked = sessionStorage.getItem(SESSION_MARKER) === '1';
    const rememberedFlag = localStorage.getItem(REMEMBERED_FLAG) === '1';
    if (!sessionMarked && !rememberedFlag) {
        await clearRememberedKey();
        return false;
    }

    const persisted = await loadRememberedKey();
    if (persisted) {
        _dek = persisted;
        return true;
    }
    sessionStorage.removeItem(SESSION_MARKER);
    localStorage.removeItem(REMEMBERED_FLAG);
    return false;
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
    sessionStorage.removeItem(SESSION_MARKER);
    localStorage.removeItem(LOCAL_KEY);
    localStorage.removeItem(REMEMBERED_FLAG);
    localStorage.removeItem(ACTIVITY_KEY);
    return isNative() ? clearNativeKey() : clearRememberedKey();
}
