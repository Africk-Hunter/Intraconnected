import { useEffect, useMemo, useRef, useState } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { fetchFullIdeaList, getIdeaLink, isNoteMode, resolveIdeaLabel } from '../../utilities';
import { subtreeIds, useIdeaActions } from '../../utilities/idea/useIdeaActions';
import AnimatedOverlay from '../AnimatedOverlay';

interface Option {
    id: number;
    label: string;
    depth: number;
    isCurrent: boolean;
    hasChildren: boolean;
}

// Lists are cut here so a very large map doesn't render thousands of rows;
// typing narrows it.
const MAX_ROWS = 300;

// A click-or-keyboard way to move an idea, for anyone who can't or doesn't
// want to drag it. Shows every idea that can hold children, as an indented
// tree, with a filter.
function MoveModal() {
    const { moveIdeaId, setMoveIdeaId } = useIdeaContext();
    const { moveIdea } = useIdeaActions();
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const listRef = useRef<HTMLUListElement>(null);
    const open = moveIdeaId !== null;

    useEffect(() => {
        if (open) { setQuery(''); setActive(0); }
    }, [open]);

    const { options, movingName } = useMemo(() => {
        if (moveIdeaId === null) return { options: [] as Option[], movingName: '' };
        const all = fetchFullIdeaList();
        const moving = all.find((i) => i.id === moveIdeaId);
        const blocked = subtreeIds(all, moveIdeaId);
        const currentParent = moving?.parentID ?? 1;
        const out: Option[] = [{ id: 1, label: 'Top level', depth: 0, isCurrent: currentParent === 1, hasChildren: true }];
        // Depth-first from the top, so children sit under their parent in the list.
        const walk = (parentId: number, depth: number) => {
            for (const idea of all) {
                if (idea.parentID !== parentId || idea.id === 1 || blocked.has(idea.id)) continue;
                const holdsChildren = idea.type !== 'checklist' && !isNoteMode(idea) && getIdeaLink(idea) === '';
                if (!holdsChildren) continue;
                out.push({ id: idea.id, label: resolveIdeaLabel(idea).replace(/\s+/g, ' ').trim() || 'Untitled', depth, isCurrent: idea.id === currentParent, hasChildren: all.some((c) => c.parentID === idea.id && !blocked.has(c.id)) });
                walk(idea.id, depth + 1);
            }
        };
        walk(1, 1);
        return { options: out, movingName: moving ? resolveIdeaLabel(moving).replace(/\s+/g, ' ').trim() : '' };
    }, [moveIdeaId]);

    const q = query.trim().toLowerCase();
    const shown = useMemo(() => {
        const list = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
        return list.slice(0, MAX_ROWS);
    }, [options, q]);

    useEffect(() => { setActive(0); }, [q]);

    // Keep the highlighted row in view while arrowing through a long list.
    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [active, shown]);

    function close() { setMoveIdeaId(null); }

    function choose(option: Option | undefined) {
        if (!option || option.isCurrent || moveIdeaId === null) return;
        moveIdea(moveIdeaId, option.id);
        close();
    }

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); choose(shown[active]); }
    }

    return (
        <AnimatedOverlay open={open} onEscape={close}>
            <div className="modal neobrutal move-modal" role="dialog" aria-label="Move idea">
                <header className="move-modal-header">
                    <span className="move-modal-eyebrow">Move to…</span>
                    <h2 className="move-modal-title">{movingName || 'Untitled'}</h2>
                </header>
                <input
                    className="move-modal-search neobrutal-input"
                    type="text"
                    placeholder="Search where to put it"
                    value={query}
                    autoFocus
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    aria-label="Search destinations"
                />
                <ul className="move-modal-list" ref={listRef} role="listbox" aria-label="Destinations">
                    {shown.length === 0 && <li className="move-modal-empty">Nothing matches "{query}".</li>}
                    {shown.map((option, i) => (
                        <li key={option.id} role="presentation">
                            <button
                                type="button"
                                role="option"
                                aria-selected={i === active}
                                data-active={i === active}
                                tabIndex={-1}
                                disabled={option.isCurrent}
                                className={`move-modal-option${i === active ? ' move-modal-option--active' : ''}${option.isCurrent ? ' move-modal-option--current' : ''}`}
                                style={{ ['--depth' as string]: q ? 0 : option.depth }}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => choose(option)}
                            >
                                <span className={`move-modal-dot${option.id === 1 ? ' move-modal-dot--root' : option.hasChildren ? ' move-modal-dot--parent' : ''}`} aria-hidden="true" />
                                <span className="move-modal-label">{option.label}</span>
                                {option.isCurrent && <span className="move-modal-badge">Here now</span>}
                            </button>
                        </li>
                    ))}
                </ul>
                <footer className="move-modal-footer">
                    <span className="move-modal-hints" aria-hidden="true">
                        <kbd>↑</kbd><kbd>↓</kbd><span>choose</span><kbd>Enter</kbd><span>move</span><kbd>Esc</kbd><span>close</span>
                    </span>
                    <button className="modalButton cancel neobrutal-button" onClick={close}>Cancel</button>
                </footer>
            </div>
        </AnimatedOverlay>
    );
}

export default MoveModal;
