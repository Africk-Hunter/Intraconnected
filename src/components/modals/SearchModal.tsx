import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { fetchFullIdeaList } from '../../utilities';
import { readRecentVisits } from '../../utilities/idea/recentVisits';
import { KIND_LABEL, searchIdeas, suggestedIdeas, visibleResults, type SearchResult } from '../../utilities/idea/search';
import Highlighted from '../Highlighted';
import AnimatedOverlay from '../AnimatedOverlay';

export interface SearchCommand {
    label: string;
    hint?: string;
    run: () => void;
}

interface Props {
    open: boolean;
    onClose: () => void;
    // Picking an idea takes the user to the level it lives in and selects its card.
    onPick: (result: SearchResult) => void;
    commands: SearchCommand[];
}

type Row =
    | { type: 'command'; command: SearchCommand }
    | { type: 'idea'; result: SearchResult };

// Ctrl/Cmd+K: find any idea at any level by what it says, and jump to it.
// Results come first; the commands sit below under their own "Actions" heading.
function SearchModal({ open, onClose, onPick, commands }: Props) {
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (open) { setQuery(''); setActive(0); setExpanded(new Set()); }
    }, [open]);

    const { rows, suggestedTitle } = useMemo(() => {
        if (!open) return { rows: [] as Row[], suggestedTitle: '' };
        const q = query.trim().toLowerCase();
        const matchingCommands = commands.filter((c) => q === '' || c.label.toLowerCase().includes(q));
        const all = fetchFullIdeaList();
        const suggested = suggestedIdeas(all, readRecentVisits());
        const results = q !== '' ? searchIdeas(all, query) : suggested.results;
        return {
            rows: [
                ...visibleResults(results, expanded).map((result): Row => ({ type: 'idea', result })),
                ...matchingCommands.map((command): Row => ({ type: 'command', command })),
            ],
            suggestedTitle: suggested.title,
        };
    }, [open, query, commands, expanded]);

    useEffect(() => { setActive(0); setExpanded(new Set()); }, [query]);

    function toggle(id: number) {
        setExpanded((prev) => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; });
    }

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [active, rows]);

    function choose(row: Row | undefined) {
        if (!row) return;
        onClose();
        if (row.type === 'idea') onPick(row.result);
        else row.command.run();
    }

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); choose(rows[active]); }
    }

    const hasQuery = query.trim() !== '';
    const words = useMemo(() => query.trim().toLowerCase().split(/s+/).filter(Boolean), [query]);
    const ideaCount = rows.filter((r) => r.type === 'idea' && r.result.isMatch).length;
    const isOpen = (r: SearchResult) => expanded.has(r.id);
    const colorOf = (r: SearchResult) => (r.kind !== 'idea' ? r.kind : r.hasChildren ? 'parent' : 'leaf');
    const groupTitle = (type: Row['type']) =>
        type === 'command' ? 'Actions' : hasQuery ? `${ideaCount} ${ideaCount === 1 ? 'match' : 'matches'}` : suggestedTitle;

    return (
        <AnimatedOverlay open={open} onClick={onClose} onEscape={onClose}>
            <div className="modal neobrutal search-modal" role="dialog" aria-label="Search ideas" onClick={(e) => e.stopPropagation()}>
                <input
                    className="search-modal-input neobrutal-input"
                    type="text"
                    placeholder="Search ideas, notes and checklists…"
                    value={query}
                    autoFocus
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    aria-label="Search ideas"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="search-modal-list"
                />
                <ul className="search-modal-list" id="search-modal-list" ref={listRef} role="listbox" aria-label="Results">
                    {hasQuery && ideaCount === 0 && (
                        <li className="search-modal-empty" role="presentation">No idea says "{query.trim()}".</li>
                    )}
                    {rows.map((row, i) => (
                        <Fragment key={row.type === 'idea' ? `i${row.result.id}` : `c${row.command.label}`}>
                        {(i === 0 || rows[i - 1].type !== row.type) && (
                            <li className="search-modal-group" role="presentation">{groupTitle(row.type)}</li>
                        )}
                        <li
                            role="presentation"
                            className={row.type === 'idea' && row.result.depth > 0 ? 'search-modal-item--nested' : undefined}
                            style={row.type === 'idea' && row.result.depth > 0 ? ({ '--depth': row.result.depth, '--i': i % 6 } as React.CSSProperties) : undefined}
                        >
                            <div
                                role="option"
                                aria-selected={i === active}
                                data-active={i === active}
                                tabIndex={-1}
                                className={`search-modal-row${row.type === 'idea' ? ` search-modal-row--idea search-modal-row--${colorOf(row.result)}` : ''}${row.type === 'idea' && !row.result.isMatch ? ' search-modal-row--context' : ''}${i === active ? ' search-modal-row--active' : ''}`}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => choose(row)}
                            >
                                {row.type === 'idea' ? (
                                    <>
                                        <span className="search-modal-main">
                                            <span className="search-modal-label"><Highlighted text={row.result.label} words={words} /></span>
                                            {row.result.snippet && <span className="search-modal-snippet"><Highlighted text={row.result.snippet} words={words} /></span>}
                                            {row.result.depth === 0 && <span className="search-modal-path">{['Ideas', ...row.result.path].join(' › ')}</span>}
                                        </span>
                                        <span className="search-modal-side">
                                            <span className={`search-modal-kind search-modal-kind--${row.result.kind}`}>{KIND_LABEL[row.result.kind]}</span>
                                            {row.result.descendants > 0 && (
                                                <button
                                                    type="button"
                                                    tabIndex={-1}
                                                    className={`search-modal-expand${isOpen(row.result) ? ' search-modal-expand--open' : ''}`}
                                                    aria-expanded={isOpen(row.result)}
                                                    onClick={(e) => { e.stopPropagation(); toggle(row.result.id); }}
                                                >
                                                    {isOpen(row.result) ? 'Hide' : `${row.result.descendants} inside`}
                                                    <span className="search-modal-expand-chevron" aria-hidden="true">▾</span>
                                                </button>
                                            )}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="search-modal-label">{row.command.label}</span>
                                        {row.command.hint && <kbd>{row.command.hint}</kbd>}
                                    </>
                                )}
                            </div>
                        </li>
                        </Fragment>
                    ))}
                </ul>
                <p className="search-modal-foot">↑ ↓ to choose · Enter to go · Esc to close</p>
            </div>
        </AnimatedOverlay>
    );
}

export default SearchModal;
