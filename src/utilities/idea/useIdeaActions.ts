import { useCallback } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { recursivelyDeleteChildren, restoreIdeas, updateIdeaParentId, updateIdeaPriority } from './ideaStore';
import { fetchFullIdeaList, getIdeaLink, getNameFromID, getParentID, isNoteMode, openIdeaLink } from './helpers';
import { getIdeasByParentID } from './parsing';
import { pushUndo, showNotice, undoLast } from './undoStack';
import type { IdeaType } from '../types';

const NAME_MAX = 40;

function shortName(id: number): string {
    if (id === 1) return 'the top level';
    const name = getNameFromID(id).replace(/\s+/g, ' ').trim() || 'Untitled';
    return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX - 1)}…` : name;
}

function findIdea(id: number): IdeaType | undefined {
    return fetchFullIdeaList().find((idea) => idea.id === id);
}

// The desktop screen's actions on an idea in one place, so the drag, the card
// menu, the keyboard and Undo all do exactly the same thing: change the data
// through ideaStore, remember how to reverse it, and refresh what is on screen.
export function useIdeaActions() {
    const {
        rootId, setIdeas, setNewIdeaSwitch, navigateToId, setChecklistModalId,
        setRenameModalOpen, setCurrentNameChangeId, setSelectedIdeaName,
        setLinkChangeModalOpen, setCurrentLinkID, setCurrentLink,
        setPendingDeleteId, setDeleteConfirmModalOpen, setDeleteModalOrigin, setMoveIdeaId,
    } = useIdeaContext();

    const refresh = useCallback(() => {
        setIdeas(getIdeasByParentID(rootId));
        setNewIdeaSwitch((prev) => !prev);
    }, [rootId, setIdeas, setNewIdeaSwitch]);

    // Deletes an idea and everything under it. Undo puts them all back.
    const deleteIdea = useCallback((id: number) => {
        const name = shortName(id);
        const removed = recursivelyDeleteChildren(id);
        if (removed.length === 0) return;
        const label = removed.length > 1
            ? `Deleted "${name}" and ${removed.length - 1} more`
            : `Deleted "${name}"`;
        pushUndo({ label, undo: () => restoreIdeas(removed) });
        refresh();
    }, [refresh]);

    // Nothing under it: delete at once, Undo brings it back. A branch asks first, with the count.
    const requestDelete = useCallback((id: number, origin?: { x: number; y: number }) => {
        if (getIdeasByParentID(id).length === 0) {
            deleteIdea(id);
            return;
        }
        if (origin) setDeleteModalOrigin(origin);
        setPendingDeleteId(id);
        setDeleteConfirmModalOpen(true);
    }, [deleteIdea, setDeleteModalOrigin, setPendingDeleteId, setDeleteConfirmModalOpen]);

    const moveIdea = useCallback((id: number, newParentId: number) => {
        const oldParentId = getParentID(id);
        if (oldParentId === newParentId || id === newParentId) return;
        const name = shortName(id);
        updateIdeaParentId(id, newParentId);
        pushUndo({
            label: `Moved "${name}" to ${newParentId === 1 ? shortName(1) : `"${shortName(newParentId)}"`}`,
            undo: () => updateIdeaParentId(id, oldParentId),
            action: { label: 'Take me there', run: () => navigateToId(newParentId) },
        });
        refresh();
    }, [refresh, navigateToId]);

    const setPriority = useCallback((id: number, priority: 1 | 2 | 3 | undefined) => {
        updateIdeaPriority(id, priority);
        refresh();
    }, [refresh]);

    // What a click on the card does: go into it, open its link, or open the checklist.
    // Notes have no "open"; their body is edited in place.
    const openIdea = useCallback((id: number) => {
        const idea = findIdea(id);
        if (!idea) return;
        if (idea.type === 'checklist') { setChecklistModalId(id); return; }
        if (isNoteMode(idea)) return;
        const link = getIdeaLink(idea);
        if (link !== '') { openIdeaLink(link); return; }
        navigateToId(id);
    }, [navigateToId, setChecklistModalId]);

    // Opens the rename dialog for a card; with no id, for the idea you are inside.
    const renameIdea = useCallback((id?: number) => {
        if (id === undefined) {
            if (rootId === 1) return;
            setCurrentNameChangeId(-1);
            setRenameModalOpen(true);
            return;
        }
        const idea = findIdea(id);
        if (!idea) return;
        const noteTitle = (idea as { noteTitle?: string }).noteTitle ?? '';
        setCurrentNameChangeId(id);
        setSelectedIdeaName(isNoteMode(idea) ? noteTitle : idea.content);
        setRenameModalOpen(true);
    }, [rootId, setCurrentNameChangeId, setRenameModalOpen, setSelectedIdeaName]);

    const editIdeaLink = useCallback((id: number) => {
        setCurrentLinkID(id);
        setCurrentLink(getIdeaLink(findIdea(id)));
        setLinkChangeModalOpen(true);
    }, [setCurrentLinkID, setCurrentLink, setLinkChangeModalOpen]);

    const copyIdea = useCallback((id: number) => {
        const idea = findIdea(id);
        if (!idea) return;
        const link = getIdeaLink(idea);
        const text = idea.type === 'checklist'
            ? [idea.content, ...idea.items.map((item) => `${item.checked ? '[x]' : '[ ]'} ${item.text}`)].join('\n')
            : link !== '' ? link : idea.content;
        navigator.clipboard.writeText(text)
            .then(() => showNotice(link !== '' ? 'Copied link' : `Copied "${shortName(id)}"`))
            .catch(() => showNotice("Couldn't copy to the clipboard"));
    }, []);

    const openMovePicker = useCallback((id: number) => setMoveIdeaId(id), [setMoveIdeaId]);

    const undo = useCallback(() => {
        if (undoLast()) refresh();
    }, [refresh]);

    return {
        deleteIdea, requestDelete, moveIdea, setPriority, openIdea, renameIdea,
        editIdeaLink, copyIdea, openMovePicker, undo,
    };
}

// How many ideas a delete would remove, the idea itself included.
export function countSubtree(allIdeas: { id: number; parentID: number }[], id: number): number {
    let count = 0;
    const queue = [id];
    const seen = new Set<number>();
    while (queue.length) {
        const current = queue.pop()!;
        if (seen.has(current)) continue;
        seen.add(current);
        if (allIdeas.some((i) => i.id === current)) count++;
        for (const child of allIdeas) if (child.parentID === current) queue.push(child.id);
    }
    return count;
}

// The ids of an idea and everything under it.
export function subtreeIds(allIdeas: { id: number; parentID: number }[], id: number): Set<number> {
    const ids = new Set<number>();
    const queue = [id];
    while (queue.length) {
        const current = queue.pop()!;
        if (ids.has(current)) continue;
        ids.add(current);
        for (const child of allIdeas) if (child.parentID === current) queue.push(child.id);
    }
    return ids;
}
