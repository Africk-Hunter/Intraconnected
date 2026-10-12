import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { fetchFullIdeaList, getIdeaLink, isNoteMode } from '../utilities';
import { useIdeaActions } from '../utilities/idea/useIdeaActions';

interface MenuItem {
    label: string;
    hint?: string;
    danger?: boolean;
    run: () => void;
}

const PRIORITIES: { value: 1 | 2 | 3 | undefined; label: string; key: string }[] = [
    { value: 1, label: 'High', key: 'p1' },
    { value: 2, label: 'Med', key: 'p2' },
    { value: 3, label: 'Low', key: 'p3' },
    { value: undefined, label: 'None', key: 'none' },
];

// The one menu for an idea card: right-click on a card, the ⋯ button, the
// priority ribbon, or the keyboard (see useCardShortcuts) all open it. The same
// actions are what drag, F2 and D call, so nothing is reachable only here.
function CardMenu() {
    const { cardMenu, setCardMenu } = useIdeaContext();
    const actions = useIdeaActions();
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

    const idea = cardMenu ? fetchFullIdeaList().find((i) => i.id === cardMenu.id) : undefined;

    function close(returnFocus: boolean) {
        const id = cardMenu?.id;
        setCardMenu(null);
        if (returnFocus && id !== undefined) {
            document.querySelector<HTMLElement>(`[data-idea-id="${id}"]`)?.focus({ preventScroll: true });
        }
    }

    // Keep the menu on screen: open where asked, then slide back in if it would overflow.
    useLayoutEffect(() => {
        if (!cardMenu) { setPos(null); return; }
        const el = menuRef.current;
        if (!el) return;
        const margin = 8;
        const left = Math.max(margin, Math.min(cardMenu.x, window.innerWidth - el.offsetWidth - margin));
        const top = Math.max(margin, Math.min(cardMenu.y, window.innerHeight - el.offsetHeight - margin));
        setPos({ left, top });
    }, [cardMenu, idea?.priority]);

    // First item gets focus so the arrow keys work straight away.
    useEffect(() => {
        if (!cardMenu || !pos) return;
        const active = document.activeElement;
        if (menuRef.current && !menuRef.current.contains(active)) {
            menuRef.current.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
        }
    }, [cardMenu, pos]);

    useEffect(() => {
        if (!cardMenu) return;
        function onKeyDown(e: KeyboardEvent) {
            const el = menuRef.current;
            if (!el) return;
            const items = Array.from(el.querySelectorAll<HTMLElement>('button'));
            const at = items.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'Escape') {
                e.preventDefault();
                close(true);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                items[(at + 1) % items.length]?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                items[(at - 1 + items.length) % items.length]?.focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                items[0]?.focus();
            } else if (e.key === 'End') {
                e.preventDefault();
                items[items.length - 1]?.focus();
            } else if (e.key === 'Tab') {
                close(false);
            }
        }
        const dismiss = () => close(false);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', dismiss);
        window.addEventListener('blur', dismiss);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', dismiss);
            window.removeEventListener('blur', dismiss);
        };
        // close() only reads cardMenu, which is in the deps through the guard.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cardMenu]);

    // The idea can disappear while the menu is open (deleted on another device).
    useEffect(() => {
        if (cardMenu && !idea) setCardMenu(null);
    }, [cardMenu, idea, setCardMenu]);

    if (!cardMenu || !idea) return null;

    const id = idea.id;
    const link = getIdeaLink(idea);
    const isChecklist = idea.type === 'checklist';
    const isNote = isNoteMode(idea);
    const hasChildren = fetchFullIdeaList().some((i) => i.parentID === id);
    const canEditLink = !isChecklist && !isNote && (!hasChildren || link !== '');

    function run(fn: () => void) {
        setCardMenu(null);
        fn();
    }

    const items: MenuItem[] = [];
    if (isChecklist) items.push({ label: 'Open checklist', hint: 'Enter', run: () => actions.openIdea(id) });
    else if (link !== '') items.push({ label: 'Open link', hint: 'Enter', run: () => actions.openIdea(id) });
    else if (!isNote) items.push({ label: 'Open', hint: 'Enter', run: () => actions.openIdea(id) });
    items.push({ label: isNote ? 'Rename note' : isChecklist ? 'Rename checklist' : hasChildren ? 'Rename' : 'Rewrite', hint: 'R', run: () => actions.renameIdea(id) });
    if (canEditLink) items.push({ label: link !== '' ? 'Change link' : 'Add link', run: () => actions.editIdeaLink(id) });
    items.push({ label: link !== '' ? 'Copy link' : isChecklist ? 'Copy checklist' : isNote ? 'Copy note' : 'Copy text', run: () => actions.copyIdea(id) });
    if (hasChildren) items.push({ label: 'Copy all ideas', run: () => actions.copyChildren(id) });
    items.push({ label: 'Move to…', hint: 'M', run: () => actions.openMovePicker(id) });
    items.push({ label: idea.locked ? 'Unlock idea' : 'Lock idea', run: () => actions.setLocked(id, !idea.locked) });

    const rect = document.querySelector<HTMLElement>(`[data-idea-id="${id}"]`)?.getBoundingClientRect();
    const origin = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined;

    return (
        <>
            <div className="card-menu-backdrop" onMouseDown={() => close(false)} onContextMenu={(e) => { e.preventDefault(); close(false); }} />
            <div
                ref={menuRef}
                className="card-menu neobrutal"
                role="menu"
                aria-label="Idea actions"
                style={{ left: pos?.left ?? cardMenu.x, top: pos?.top ?? cardMenu.y, visibility: pos ? 'visible' : 'hidden' }}
            >
                {items.map((item) => (
                    <button key={item.label} className="card-menu-item" role="menuitem" type="button" onClick={() => run(item.run)}>
                        <span>{item.label}</span>
                        {item.hint && <kbd>{item.hint}</kbd>}
                    </button>
                ))}
                <div className="card-menu-group" role="group" aria-label="Priority">
                    <span className="card-menu-group-label">Priority</span>
                    <div className="card-menu-chips">
                        {PRIORITIES.map((p) => (
                            <button
                                key={p.key}
                                className={`card-menu-chip card-menu-chip--${p.key}${idea.priority === p.value ? ' card-menu-chip--on' : ''}`}
                                role="menuitemradio"
                                aria-checked={idea.priority === p.value}
                                type="button"
                                onClick={() => run(() => actions.setPriority(id, p.value))}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
                <button className="card-menu-item card-menu-item--danger" role="menuitem" type="button" onClick={() => run(() => actions.requestDelete(id, origin))}>
                    <span>Delete</span>
                    <kbd>D</kbd>
                </button>
            </div>
        </>
    );
}

export default CardMenu;
