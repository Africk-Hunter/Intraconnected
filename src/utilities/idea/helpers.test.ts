import { describe, it, expect } from 'vitest';
import { buildAncestorPath } from './helpers';
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
