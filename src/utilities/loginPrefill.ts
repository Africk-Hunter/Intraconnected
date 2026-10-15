// Hands an email address from one page to the sign-in form (after a password
// reset, AuthAction knows it; Auth.tsx fills it in and focuses the password).
// sessionStorage, not the URL, so the address never appears in the address bar.

const KEY = "login_prefill_email";

export function stashLoginEmail(email: string): void {
    try {
        sessionStorage.setItem(KEY, email);
    } catch {
        /* non-critical: the user just types it */
    }
}

// Reads the address once and forgets it.
export function takeLoginEmail(): string | null {
    try {
        const email = sessionStorage.getItem(KEY);
        sessionStorage.removeItem(KEY);
        return email;
    } catch {
        return null;
    }
}
