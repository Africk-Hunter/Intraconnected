const SESSION_KEY = 'dek_session';
const LOCAL_KEY = 'dek_local';
let _dek: CryptoKey | null = null;

export async function setDEK(key: CryptoKey, remember = false): Promise<void> {
    _dek = key;
    try {
        const raw = await crypto.subtle.exportKey('raw', key);
        let binary = '';
        new Uint8Array(raw).forEach(b => binary += String.fromCharCode(b));
        const encoded = btoa(binary);
        sessionStorage.setItem(SESSION_KEY, encoded);
        if (remember) {
            localStorage.setItem(LOCAL_KEY, encoded);
        } else {
            localStorage.removeItem(LOCAL_KEY);
        }
    } catch {
        // non-extractable key — skip persistence
    }
}

export async function loadDEKFromSession(): Promise<boolean> {
    const stored = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(LOCAL_KEY);
    if (!stored) return false;
    try {
        const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
        _dek = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
        return true;
    } catch {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(LOCAL_KEY);
        return false;
    }
}

export function getDEK(): CryptoKey {
    if (!_dek) throw new Error('Encryption key not initialized — please log in again.');
    return _dek;
}

export function clearDEK(): void {
    _dek = null;
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LOCAL_KEY);
}
