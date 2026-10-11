// What the crash screen may show about an error: its name and message, never
// the stack or component stack (file paths, internals). If the message looks
// like it holds payment or Firebase data it is withheld entirely, not masked.
const MAX_LENGTH = 200;

// Deliberately narrow: only payment details and Firebase data/credentials.
const SENSITIVE: RegExp[] = [
    // Payments
    /\b(sk|pk|rk|whsec|pi|cus|sub|price|ch|re|in|pm|seti)_[A-Za-z0-9_]{6,}/, // Stripe keys and object ids
    /\b(?:\d[ -]?){15,19}\b/,                                  // card numbers (not 13-digit idea ids)
    /\bstripe\b/i,
    // Firebase
    /AIza[0-9A-Za-z_-]{20,}/,                                  // Firebase web API key
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,             // ID token / JWT
    /enc:[A-Za-z0-9+/=_-]+/,                                   // encrypted idea text
    /\b(users|ideas|meta)\/\S+/i,                              // Firestore paths (hold the uid)
    /\b(uid|dek|encryptedDEK|emailEncryptedDEK)\b/i,           // account id / encryption key
    /interconnectedness-3a37b|firebaseapp\.com|firestore\.googleapis|identitytoolkit|securetoken/i,
];

export interface ErrorDetails {
    text: string;
    // True when the message was withheld because it may contain private data.
    withheld: boolean;
}

export function describeError(error: unknown): ErrorDetails {
    const name = error instanceof Error && error.name ? error.name : 'Error';
    const message = (error instanceof Error ? error.message : '').replace(/\s+/g, ' ').trim();
    if (!message) return { text: name, withheld: false };
    if (SENSITIVE.some((pattern) => pattern.test(message))) return { text: name, withheld: true };
    return { text: `${name}: ${message.slice(0, MAX_LENGTH)}`, withheld: false };
}

// Failed reloads are counted in sessionStorage so a crash that survives
// reloading is told apart from a one-off. A count older than the window is
// stale (the app worked in between) and starts over.
const KEY = 'error_reloads';
const WINDOW_MS = 5 * 60 * 1000;
export const RELOADS_BEFORE_DETAILS = 3;

export function failedReloads(now = Date.now()): number {
    try {
        const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
        if (saved && typeof saved.count === 'number' && now - saved.at < WINDOW_MS) return saved.count;
    } catch { /* storage blocked or corrupt: treat as no history */ }
    return 0;
}

export function recordReload(now = Date.now()): void {
    try {
        sessionStorage.setItem(KEY, JSON.stringify({ count: failedReloads(now) + 1, at: now }));
    } catch { /* nothing to do: the reload still happens */ }
}
