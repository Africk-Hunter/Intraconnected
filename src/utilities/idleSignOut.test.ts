import { describe, it, expect } from 'vitest';
import { isIdleExpired, IDLE_LIMIT_MS, REMEMBERED_IDLE_LIMIT_MS } from './idleSignOut';

describe('isIdleExpired', () => {
    const now = 1_000_000_000_000;

    it('never expires without a recorded activity time', () => {
        expect(isIdleExpired(null, now, false)).toBe(false);
    });

    it('expires a normal session only after the short limit', () => {
        expect(isIdleExpired(now - IDLE_LIMIT_MS + 1000, now, false)).toBe(false);
        expect(isIdleExpired(now - IDLE_LIMIT_MS - 1000, now, false)).toBe(true);
    });

    it('gives a remembered session the long limit', () => {
        expect(isIdleExpired(now - IDLE_LIMIT_MS * 10, now, true)).toBe(false);
        expect(isIdleExpired(now - REMEMBERED_IDLE_LIMIT_MS - 1000, now, true)).toBe(true);
    });
});
