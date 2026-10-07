// Gate for the dev-only Developer Testing tab. The password is never stored in
// source — only a PBKDF2-SHA256 hash of it (100k iterations, fixed salt). This
// is a convenience lock for a dev-build-only tab, not a security boundary: the
// tab doesn't render in production builds and the server endpoints it calls are
// separately gated by ALLOW_TEST_RESET.
const SALT = 'intraconnected-dev-tools';
const ITERATIONS = 100_000;
const PASSWORD_HASH = '116f0741d70f6ac0b788fbae8cf43be496ce9feff368b6a688fe3c36e88ae1b2';

export async function checkDevPassword(input: string): Promise<boolean> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(input), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(SALT), iterations: ITERATIONS, hash: 'SHA-256' },
        key,
        256
    );
    const hex = Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
    return hex === PASSWORD_HASH;
}
