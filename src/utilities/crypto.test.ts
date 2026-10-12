import { describe, it, expect } from 'vitest';
import { generateDEK, isLegacyPasswordWrap, unwrapDEK, wrapDEK } from './crypto';

async function raw(key: CryptoKey) {
    return Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
}

describe('password wrap', () => {
    it('round-trips with the password and marks the stronger format', async () => {
        const dek = await generateDEK();
        const wrapped = await wrapDEK(dek, 'correct horse', 'uid-1');
        expect(isLegacyPasswordWrap(wrapped)).toBe(false);
        expect(await raw(await unwrapDEK(wrapped, 'correct horse', 'uid-1'))).toEqual(await raw(dek));
    });

    it('rejects a wrong password', async () => {
        const wrapped = await wrapDEK(await generateDEK(), 'correct horse', 'uid-1');
        await expect(unwrapDEK(wrapped, 'wrong', 'uid-1')).rejects.toBeDefined();
    });

    it('treats an unprefixed wrap as the old format', () => {
        expect(isLegacyPasswordWrap('AAAA')).toBe(true);
    });
});
