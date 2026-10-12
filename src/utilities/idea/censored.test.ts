import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchFullIdeaList } from './helpers';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
});

describe('legacy `locked` field', () => {
    beforeEach(() => store.clear());

    it('reads as `censored` and the old name is dropped', () => {
        store.set('ideas', JSON.stringify([
            { id: 2, content: 'a', parentID: 1, link: '', locked: true },
            { id: 3, content: 'b', parentID: 1, link: '', locked: false },
            { id: 4, content: 'c', parentID: 1, link: '', censored: true },
        ]));
        const [a, b, c] = fetchFullIdeaList();
        expect(a).toMatchObject({ censored: true });
        expect('locked' in a).toBe(false);
        expect('locked' in b || 'censored' in b).toBe(false);
        expect(c).toMatchObject({ censored: true });
    });
});
