import { useCallback } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { recursivelyDeleteChildren, restoreIdeas, updateIdeaLocked, updateIdeaParentId, updateIdeaPriority } from './ideaStore';
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

const COPIED_MARK_MS = 1200;
const copiedTimers = new WeakMap<HTMLElement, number>();

// Shows "Copied" on the card itself (styled by [data-copied] in idea.scss), so a
// Ctrl/Cmd+C on a hovered card confirms where it landed, not just in the toast.
// An attribute rather than a class: React rewrites className on re-render.
function markCopied(id: number) {
    const card = document.querySelector<HTMLElement>(`[data-idea-id="${id}"]`);
    if (!card) return;
    window.clearTimeout(copiedTimers.get(card));
    card.removeAttribute('data-copied');
    void card.offsetWidth; // restart the animation on a repeat copy
    card.setAttribute('data-copied', '');
    copiedTimers.set(card, window.setTimeout(() => card.removeAttribute('data-copied'), COPIED_MARK_MS));
}

// The desktop screen's actions on an idea in one place, so the drag, the card
// menu, the keyboard and Undo all do exactly the same thing: change the data
// through ideaStore, remember how to reverse it, and refresh what is on screen.
// Deleting a bottom-row card shortens the page, and the browser clamps the scroll position
// upwards. Keep the page at its current height until the user scrolls on their own.
function holdPageHeight() {
    const root = document.documentElement;
    if (window.scrollY <= 0) return;
    root.style.minHeight = `${root.scrollHeight}px`;
    const release = () => {
        root.style.minHeight = '';
        window.removeEventListener('wheel', release);
        window.removeEventListener('touchmove', release);
        window.removeEventListener('keydown', release);
    };
    window.addEventListener('wheel', release, { once: true, passive: true });
    window.addEventListener('touchmove', release, { once: true, passive: true });
    window.addEventListener('keydown', release, { once: true });
}

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
        holdPageHeight();
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
        holdPageHeight();
        refresh();
    }, [refresh, navigateToId]);

    const setPriority = useCallback((id: number, priority: 1 | 2 | 3 | undefined) => {
        updateIdeaPriority(id, priority);
        refresh();
    }, [refresh]);

    const setLocked = useCallback((id: number, locked: boolean) => {
        updateIdeaLocked(id, locked);
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
            .then(() => {
                markCopied(id);
                showNotice(link !== '' ? 'Copied link' : `Copied "${shortName(id)}"`);
            })
            .catch(() => showNotice("Couldn't copy to the clipboard"));
    }, []);

    // Every idea directly inside this one, a line each (a link idea keeps its address after the text).
    // Resolves true once the clipboard has it, so a button can confirm.
    const copyChildren = useCallback((id: number): Promise<boolean> => {
        const children = getIdeasByParentID(id);
        if (children.length === 0) return Promise.resolve(false);
        const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();
        const list = children.map((child, i) => {
            const body = isNoteMode(child)
                ? [oneLine((child as { noteTitle?: string }).noteTitle ?? ''), oneLine(child.content)].filter(Boolean).join(' - ')
                : oneLine(child.content);
            const link = getIdeaLink(child);
            return `${i + 1}. ${link !== '' ? `${body} (${link})` : body}`;
        }).join('\n');
        const text = `${oneLine(getNameFromID(id)) || 'Untitled'}\n-----------\n${list}\n########`;
        return navigator.clipboard.writeText(text)
            .then(() => {
                markCopied(id);
                showNotice(`Copied ${children.length} ${children.length === 1 ? 'idea' : 'ideas'} from "${shortName(id)}"`);
                return true;
            })
            .catch(() => {
                showNotice("Couldn't copy to the clipboard");
                return false;
            });
    }, []);

    // The whole branch under this idea, nested ideas indented with 1.1-style numbers.
    const copyBranch = useCallback((id: number): Promise<boolean> => {
        if (getIdeasByParentID(id).length === 0) return Promise.resolve(false);
        const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();
        const seen = new Set<number>([id]);
        let total = 0;
        const lines: string[] = [];
        const walk = (parentId: number, prefix: string, depth: number) => {
            getIdeasByParentID(parentId).forEach((child, i) => {
                if (seen.has(child.id)) return;
                seen.add(child.id);
                total++;
                const body = isNoteMode(child)
                    ? [oneLine((child as { noteTitle?: string }).noteTitle ?? ''), oneLine(child.content)].filter(Boolean).join(' - ')
                    : oneLine(child.content);
                const link = getIdeaLink(child);
                const num = `${prefix}${i + 1}`;
                lines.push(`${'   '.repeat(depth)}${num}. ${link !== '' ? `${body} (${link})` : body}`);
                walk(child.id, `${num}.`, depth + 1);
            });
        };
        walk(id, '', 0);
        const text = `${oneLine(getNameFromID(id)) || 'Untitled'}\n-----------\n${lines.join('\n')}\n########`;
        return navigator.clipboard.writeText(text)
            .then(() => {
                markCopied(id);
                showNotice(`Copied ${total} ${total === 1 ? 'idea' : 'ideas'} from "${shortName(id)}" and below`);
                return true;
            })
            .catch(() => {
                showNotice("Couldn't copy to the clipboard");
                return false;
            });
    }, []);

    const openMovePicker =useCallback((id: number) => setMoveIdeaId(id), [setMoveIdeaId]);

    const undo = useCallback(() => {
        if (undoLast()) refresh();
    }, [refresh]);

    return {
        deleteIdea, requestDelete, moveIdea, setPriority, setLocked, openIdea, renameIdea,
        editIdeaLink, copyIdea, copyChildren, copyBranch, openMovePicker, undo,
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
