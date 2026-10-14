import React, { useMemo, useRef, useState } from 'react';
import type { IdeaType } from '../../utilities/types';
import { readRecentVisits } from '../../utilities/idea/recentVisits';
import { KIND_LABEL, searchIdeas, suggestedIdeas, visibleResults, type SearchResult } from '../../utilities/idea/search';
import Highlighted from '../Highlighted';
import { useSheetSwipeDown } from './useSheetSwipeDown';

interface Props {
    allIdeas: IdeaType[];
    // Takes the user to the level the idea lives in.
    onPick: (result: SearchResult) => void;
    onOpenMindMap: () => void;
    onClose: () => void;
    style?: React.CSSProperties;
}

// The empty box has the room for more than the desktop palette's five.
const SUGGESTED_LIMIT = 8;
// Rows past this one enter together, so a long list doesn't trickle in.
const STAGGER_CAP = 8;

function SearchIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" />
        </svg>
    );
}

function MobileSearchSheet({ allIdeas, onPick, onOpenMindMap, onClose, style }: Props) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const swipe = useSheetSwipeDown(onClose);

    const suggested = useMemo(() => suggestedIdeas(allIdeas, readRecentVisits(), SUGGESTED_LIMIT), [allIdeas]);
        const words = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);
    const hasQuery = words.length > 0;
    const results = useMemo(() => (hasQuery ? searchIdeas(allIdeas, query) : suggested.results), [hasQuery, allIdeas, query, suggested]);

    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const shown = useMemo(() => visibleResults(results, expanded), [results, expanded]);
    function toggle(id: number) {
        setExpanded((prev) => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; });
    }
    const matchCount = results.filter((r) => r.isMatch).length;
    const heading = hasQuery ? `${matchCount} ${matchCount === 1 ? 'match' : 'matches'}` : suggested.title;

    // Same colours as the cards in the list, so a result is recognisable on arrival.
    function colorOf(result: SearchResult): string {
        if (result.kind !== 'idea') return result.kind;
        return result.hasChildren ? 'parent' : 'leaf';
    }

    function clear() {
        setQuery('');
        inputRef.current?.focus();
    }

    // Scrolling the results means the user is reading, not typing: let the
    // keyboard go so they can see the whole list.
    function dismissKeyboard() {
        if (document.activeElement === inputRef.current) inputRef.current?.blur();
    }

    return (
        <>
            <div className="mmobile-scrim" onClick={onClose} />
            <div ref={swipe.sheetRef} className="mmobile-search-sheet" style={style} role="dialog" aria-modal="true" aria-labelledby="mmobile-search-title">
                <div className="mmobile-search-header" {...swipe.dragProps}>
                    <div className="mmobile-sheet-grab mmobile-sheet-grab--panel" aria-hidden="true" />
                    <button type="button" className="mmobile-search-map" onClick={onOpenMindMap}>
                        <img src="/images/MindMapBlack.svg" alt="" />
                        Mind map
                    </button>
                    <h2 className="mmobile-search-title" id="mmobile-search-title">Search</h2>
                    <button type="button" className="mmobile-search-close" onClick={onClose} aria-label="Close search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" /></svg></button>
                </div>

                <div className="mmobile-search-field">
                    <SearchIcon />
                    <input
                        ref={inputRef}
                        className="mmobile-search-input"
                        type="search"
                        inputMode="search"
                        enterKeyHint="search"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="Ideas, notes, checklist items…"
                        aria-label="Search ideas"
                        value={query}
                        autoFocus
                        onChange={(e) => { setQuery(e.target.value); setExpanded(new Set()); }}
                        onKeyDown={(e) => {
                            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                            e.preventDefault();
                            if (hasQuery && results[0]) onPick(results[0]);
                            else dismissKeyboard();
                        }}
                    />
                    {query !== '' && (
                        // mousedown is cancelled so the field keeps focus and the keyboard stays up.
                        <button type="button" className="mmobile-search-clear" onMouseDown={(e) => e.preventDefault()} onClick={clear} aria-label="Clear search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" /></svg></button>
                    )}
                </div>

                <div className="mmobile-search-results" onTouchMove={dismissKeyboard}>
                    {results.length > 0 && <p className="mmobile-search-heading" aria-live="polite">{heading}</p>}
                    {results.length === 0 && (
                        <div className="mmobile-search-empty" aria-live="polite">
                            {hasQuery ? (
                                <>
                                    <p className="mmobile-search-empty-title">Nothing matches “{query.trim()}”</p>
                                    <p className="mmobile-search-empty-text">Search looks at idea names, notes, checklist items and links.</p>
                                </>
                            ) : (
                                <>
                                    <p className="mmobile-search-empty-title">Nothing to search yet</p>
                                    <p className="mmobile-search-empty-text">Ideas you add will show up here.</p>
                                </>
                            )}
                        </div>
                    )}
                    <ul className="mmobile-search-list">
                        {shown.map((result, i) => (
                            <li key={result.id} className={result.depth > 0 ? 'mmobile-search-item--nested' : undefined} style={{ '--i': Math.min(i, STAGGER_CAP), '--depth': Math.min(result.depth, 5) } as React.CSSProperties}>
                                <div className={`mmobile-search-row mmobile-search-row--${colorOf(result)}${result.isMatch ? '' : ' mmobile-search-row--context'}`}>
                                    <button type="button" className="mmobile-search-row-main" onClick={() => onPick(result)}>
                                        <span className="mmobile-search-row-label"><Highlighted text={result.label} words={words} /></span>
                                        {result.snippet && <span className="mmobile-search-row-snippet"><Highlighted text={result.snippet} words={words} /></span>}
                                        {result.depth === 0 && <span className="mmobile-search-row-meta">{['Ideas', ...result.path].join(' › ')}</span>}
                                    </button>
                                    <span className="mmobile-search-row-side">
                                        <span className="mmobile-search-kind">{KIND_LABEL[result.kind]}</span>
                                        {result.descendants > 0 && (
                                            <button
                                                type="button"
                                                className={`mmobile-search-expand${expanded.has(result.id) ? ' mmobile-search-expand--open' : ''}`}
                                                onClick={() => toggle(result.id)}
                                                aria-expanded={expanded.has(result.id)}
                                            >
                                                {expanded.has(result.id) ? 'Hide' : `${result.descendants} inside`}
                                                <span className="mmobile-search-expand-chevron" aria-hidden="true">▾</span>
                                            </button>
                                        )}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    );
}

export default MobileSearchSheet;
