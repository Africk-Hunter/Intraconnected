import { describe, it, expect, vi, beforeEach } from 'vitest';

const { native, secure } = vi.hoisted(() => ({
    native: { value: false },
    secure: {
        store: new Map<string, unknown>(),
        setSynchronize: vi.fn(async () => {}),
        set: vi.fn(),
        get: vi.fn(),
        remove: vi.fn(),
    },
}));

vi.mock('./platform', () => ({ isNative: () => native.value }));
vi.mock('@aparajita/capacitor-secure-storage', () => ({
    KeychainAccess: { afterFirstUnlockThisDeviceOnly: 3 },
    SecureStorage: {
        setSynchronize: secure.setSynchronize,
        set: secure.set,
        get: secure.get,
        remove: secure.remove,
    },
}));

function memoryStorage() {
    const data = new Map<string, string>();
    return {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
    };
}

// Just enough of IndexedDB for dekStore: one store, put/get/delete.
function fakeIndexedDB(data = new Map<string, unknown>()) {
    const request = <T,>(value: () => T, tx: { oncomplete?: () => void }) => {
        const req = { result: undefined as T };
        queueMicrotask(() => { req.result = value(); queueMicrotask(() => tx.oncomplete?.()); });
        return req;
    };
    const db = {
        createObjectStore: () => {},
        close: () => {},
        transaction: () => {
            const tx: { oncomplete?: () => void } = {};
            return Object.assign(tx, {
                objectStore: () => ({
                    put: (v: unknown, k: string) => request(() => (data.set(k, v), k), tx),
                    get: (k: string) => request(() => data.get(k), tx),
                    delete: (k: string) => request(() => (data.delete(k), undefined), tx),
                }),
            });
        },
    };
    return {
        data,
        open: () => {
            const req: { result: typeof db; onsuccess?: () => void; onupgradeneeded?: () => void } = { result: db };
            queueMicrotask(() => { req.onupgradeneeded?.(); req.onsuccess?.(); });
            return req;
        },
    };
}

async function newKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

describe('dekStore', () => {
    beforeEach(() => {
        vi.resetModules();
        native.value = false;
        secure.store.clear();
        secure.set.mockReset().mockImplementation(async (k: string, v: unknown) => void secure.store.set(k, v));
        secure.get.mockReset().mockImplementation(async (k: string) => secure.store.get(k) ?? null);
        secure.remove.mockReset().mockImplementation(async (k: string) => void secure.store.delete(k));
        vi.stubGlobal('sessionStorage', memoryStorage());
        vi.stubGlobal('localStorage', memoryStorage());
        vi.stubGlobal('indexedDB', fakeIndexedDB());
    });

    describe('on the web', () => {
        it('keeps a non-extractable key in IndexedDB for this tab without Remember me', async () => {
            const { setDEK, getDEK } = await import('./dekStore');
            await setDEK(await newKey(), false);
            expect(sessionStorage.getItem('dek_session')).toBeNull();
            expect(sessionStorage.getItem('dek_session_marker')).toBe('1');
            expect(localStorage.getItem('session_remembered')).toBeNull();
            expect((indexedDB as unknown as ReturnType<typeof fakeIndexedDB>).data.get('dek')).toBeInstanceOf(CryptoKey);
            expect(getDEK().extractable).toBe(false);
            expect(localStorage.getItem('dek_local')).toBeNull();
            expect(secure.set).not.toHaveBeenCalled();
        });

        it('with Remember me keeps a non-extractable key in IndexedDB, not a raw copy in web storage', async () => {
            const { setDEK } = await import('./dekStore');
            await setDEK(await newKey(), true);
            const stored = (indexedDB as unknown as ReturnType<typeof fakeIndexedDB>).data.get('dek') as CryptoKey;
            expect(stored.extractable).toBe(false);
            expect(localStorage.getItem('dek_local')).toBeNull();
            expect(sessionStorage.getItem('dek_session')).toBeNull();
            expect(localStorage.getItem('session_remembered')).toBe('1');
        });

        it('migrates and removes a legacy raw session key', async () => {
            const key = await newKey();
            const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
            sessionStorage.setItem('dek_session', btoa(String.fromCharCode(...raw)));

            const { loadPersistedDEK, getDEK } = await import('./dekStore');
            expect(await loadPersistedDEK()).toBe(true);
            expect(sessionStorage.getItem('dek_session')).toBeNull();
            expect(sessionStorage.getItem('dek_session_marker')).toBe('1');
            expect(getDEK().extractable).toBe(false);
            expect((indexedDB as unknown as ReturnType<typeof fakeIndexedDB>).data.get('dek')).toBeInstanceOf(CryptoKey);
        });

        it('a fresh load recovers a remembered key', async () => {
            const first = await import('./dekStore');
            await first.setDEK(await newKey(), true);

            vi.resetModules();
            const reloaded = await import('./dekStore');
            expect(() => reloaded.getDEK()).toThrow();
            expect(await reloaded.loadPersistedDEK()).toBe(true);
            expect(() => reloaded.getDEK()).not.toThrow();
        });

        it('drops a session-only IndexedDB key after its tab marker is gone', async () => {
            const first = await import('./dekStore');
            await first.setDEK(await newKey(), false);
            sessionStorage.removeItem('dek_session_marker');

            vi.resetModules();
            const reloaded = await import('./dekStore');
            expect(await reloaded.loadPersistedDEK()).toBe(false);
            expect((indexedDB as unknown as ReturnType<typeof fakeIndexedDB>).data.has('dek')).toBe(false);
        });

        it('keeps the key in memory without writing raw bytes when IndexedDB is unavailable', async () => {
            vi.stubGlobal('indexedDB', undefined);
            const { setDEK, getDEK } = await import('./dekStore');
            await setDEK(await newKey(), true);
            expect(sessionStorage.getItem('dek_session')).toBeNull();
            expect(sessionStorage.getItem('dek_session_marker')).toBeNull();
            expect(getDEK().extractable).toBe(false);
            expect(localStorage.getItem('dek_local')).toBeNull();
        });

        it('moves a raw key left by an older build into IndexedDB', async () => {
            const { setDEK } = await import('./dekStore');
            await setDEK(await newKey(), false);
            localStorage.setItem('dek_local', sessionStorage.getItem('dek_session')!);
            sessionStorage.removeItem('dek_session');

            vi.resetModules();
            const reloaded = await import('./dekStore');
            expect(await reloaded.loadPersistedDEK()).toBe(true);
            expect(localStorage.getItem('dek_local')).toBeNull();
            expect((indexedDB as unknown as ReturnType<typeof fakeIndexedDB>).data.has('dek')).toBe(true);
        });

        it('clearDEK wipes memory and every store', async () => {
            const { setDEK, clearDEK, getDEK, loadPersistedDEK } = await import('./dekStore');
            await setDEK(await newKey(), true);
            localStorage.setItem('last_activity', '1');
            await clearDEK();
            expect(() => getDEK()).toThrow();
            expect(sessionStorage.getItem('dek_session')).toBeNull();
            expect(sessionStorage.getItem('dek_session_marker')).toBeNull();
            expect(localStorage.getItem('dek_local')).toBeNull();
            expect(localStorage.getItem('last_activity')).toBeNull();
            expect(await loadPersistedDEK()).toBe(false);
        });
    });

    describe('in the app', () => {
        beforeEach(() => {
            native.value = true;
        });

        it('stores the key in the secure store, not the web storages, and ignores Remember me', async () => {
            const { setDEK } = await import('./dekStore');
            await setDEK(await newKey(), false);
            expect(secure.setSynchronize).toHaveBeenCalledWith(false);
            expect(secure.set).toHaveBeenCalledWith('dek', expect.any(String), false, false, 3);
            expect(sessionStorage.getItem('dek_session')).toBeNull();
            expect(localStorage.getItem('dek_local')).toBeNull();
        });

        it('recovers the key after the app restarts', async () => {
            const first = await import('./dekStore');
            await first.setDEK(await newKey());

            vi.resetModules();
            const restarted = await import('./dekStore');
            expect(() => restarted.getDEK()).toThrow();
            expect(await restarted.loadPersistedDEK()).toBe(true);
            expect(() => restarted.getDEK()).not.toThrow();
        });

        it('reports no key when nothing is stored', async () => {
            const { loadPersistedDEK } = await import('./dekStore');
            expect(await loadPersistedDEK()).toBe(false);
        });

        it('treats an unreadable stored key as no key and removes it', async () => {
            secure.store.set('dek', '%%% not base64 %%%');
            const { loadPersistedDEK } = await import('./dekStore');
            expect(await loadPersistedDEK()).toBe(false);
            expect(secure.remove).toHaveBeenCalledWith('dek', false);
        });

        it('treats a secure-store failure as no key', async () => {
            secure.get.mockRejectedValue(new Error('keystore unavailable'));
            const { loadPersistedDEK } = await import('./dekStore');
            expect(await loadPersistedDEK()).toBe(false);
        });

        it('clearDEK drops the in-memory key immediately and removes the stored one', async () => {
            const { setDEK, clearDEK, getDEK } = await import('./dekStore');
            await setDEK(await newKey());
            const pending = clearDEK();
            expect(() => getDEK()).toThrow(); // before the promise settles
            await pending;
            expect(secure.store.has('dek')).toBe(false);
        });
    });
});
