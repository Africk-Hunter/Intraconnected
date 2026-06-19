const SESSION_KEY = 'dek_session';
let _dek: CryptoKey | null = null;

export async function setDEK(key: CryptoKey): Promise<void> {
    _dek = key;
    try {
        const raw = await crypto.subtle.exportKey('raw', key);
        let binary = '';
        new Uint8Array(raw).forEach(b => binary += String.fromCharCode(b));
        sessionStorage.setItem(SESSION_KEY, btoa(binary));
    } catch {
        // non-extractable key — skip sessionStorage persistence
    }
}

export async function loadDEKFromSession(): Promise<boolean> {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return false;
    try {
        const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
        _dek = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
        return true;
    } catch {
        sessionStorage.removeItem(SESSION_KEY);
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
}
