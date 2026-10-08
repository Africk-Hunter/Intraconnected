import { describe, it, expect } from 'vitest';
import { buildAncestorPath, cleanLink, isOpenableLink } from './helpers';
import { IdeaType } from '../types';

describe('buildAncestorPath', () => {
    const ideas: IdeaType[] = [
        { id: 10, content: 'Child', parentID: 1, link: '' } as IdeaType,
        { id: 20, content: 'Grandchild', parentID: 10, link: '' } as IdeaType,
        { id: 30, content: 'Great-grandchild', parentID: 20, link: '' } as IdeaType,
    ];

    it('returns [1] for the root itself', () => {
        expect(buildAncestorPath(1, ideas)).toEqual([1]);
    });

    it('returns root-to-target path for a direct child of root', () => {
        expect(buildAncestorPath(10, ideas)).toEqual([1, 10]);
    });

    it('returns full root-to-target path for a deeply nested idea', () => {
        expect(buildAncestorPath(30, ideas)).toEqual([1, 10, 20, 30]);
    });

    it('stops gracefully if a parent is missing from the list', () => {
        const orphaned: IdeaType[] = [{ id: 99, content: 'Orphan', parentID: 500, link: '' } as IdeaType];
        expect(buildAncestorPath(99, orphaned)).toEqual([99]);
    });
});

describe('link safety', () => {
    it('only treats web and mail addresses as openable', () => {
        expect(isOpenableLink('https://example.com/a?b=c')).toBe(true);
        expect(isOpenableLink('http://example.com')).toBe(true);
        expect(isOpenableLink('mailto:me@example.com')).toBe(true);
        expect(isOpenableLink('javascript:alert(1)')).toBe(false);
        expect(isOpenableLink('  JavaScript:alert(1)')).toBe(false);
        expect(isOpenableLink('data:text/html,hi')).toBe(false);
        expect(isOpenableLink('file:///etc/passwd')).toBe(false);
        expect(isOpenableLink('not a url')).toBe(false);
        expect(isOpenableLink('')).toBe(false);
    });

    it('cleanLink keeps its usual behaviour for ordinary input', () => {
        expect(cleanLink('')).toBe('');
        expect(cleanLink('example.com')).toBe('https://example.com');
        expect(cleanLink('http://example.com')).toBe('https://example.com');
        expect(cleanLink('https://example.com/x')).toBe('https://example.com/x');
        expect(cleanLink('localhost:3000')).toBe('https://localhost:3000');
    });

    it('cleanLink refuses other URL schemes instead of storing them as links', () => {
        expect(cleanLink('javascript://%0Aalert(1)')).toBe('');
        expect(cleanLink('ftp://example.com')).toBe('');
        expect(cleanLink('data://x')).toBe('');
    });

    it('a javascript: link without slashes is turned into plain https text, not a script URL', () => {
        expect(cleanLink('javascript:alert(1)').startsWith('https://')).toBe(true);
    });
});
