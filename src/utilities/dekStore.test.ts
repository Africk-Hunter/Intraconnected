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
    });

    describe('on the web', () => {
        it('keeps the key in sessionStorage only without Remember me', async () => {
            const { setDEK } = await import('./dekStore');
            await setDEK(await newKey(), false);
            expect(sessionStorage.getItem('dek_session')).not.toBeNull();
            expect(localStorage.getItem('dek_local')).toBeNull();
            expect(secure.set).not.toHaveBeenCalled();
        });

        it('also keeps it in localStorage with Remember me, and a fresh load recovers it', async () => {
            const first = await import('./dekStore');
            await first.setDEK(await newKey(), true);
            expect(localStorage.getItem('dek_local')).not.toBeNull();

            vi.resetModules();
            const reloaded = await import('./dekStore');
            expect(() => reloaded.getDEK()).toThrow();
            expect(await reloaded.loadPersistedDEK()).toBe(true);
            expect(() => reloaded.getDEK()).not.toThrow();
        });

        it('clearDEK wipes memory and both stores', async () => {
            const { setDEK, clearDEK, getDEK } = await import('./dekStore');
            await setDEK(await newKey(), true);
            await clearDEK();
            expect(() => getDEK()).toThrow();
            expect(sessionStorage.getItem('dek_session')).toBeNull();
            expect(localStorage.getItem('dek_local')).toBeNull();
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
