import { describe, it, expect } from 'vitest';
import { isWithinFreeLimit, FREE_NODE_LIMIT } from './limits';

describe('isWithinFreeLimit', () => {
    it('allows creation below the free-tier cap', () => {
        expect(isWithinFreeLimit('free', FREE_NODE_LIMIT - 1)).toBe(true);
    });

    it('blocks creation at the free-tier cap', () => {
        expect(isWithinFreeLimit('free', FREE_NODE_LIMIT)).toBe(false);
    });

    it('blocks creation above the free-tier cap', () => {
        expect(isWithinFreeLimit('free', FREE_NODE_LIMIT + 10)).toBe(false);
    });

    it('always allows an annual-plan user regardless of node count', () => {
        expect(isWithinFreeLimit('annual', 10_000)).toBe(true);
    });

    it('always allows a lifetime-plan user regardless of node count', () => {
        expect(isWithinFreeLimit('lifetime', 10_000)).toBe(true);
    });
});
