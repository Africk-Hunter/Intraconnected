import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { IdeaType, getIdeaLink, resolveIdeaLabel, isNoteMode } from '../../utilities';
import { searchIdeas } from '../../utilities/idea/search';

interface Props {
    nodeId: number;
    allIdeas: IdeaType[];
    onMove: (nodeId: number, targetId: number) => void;
}

function MobileMoveSheet({ nodeId, allIdeas, onMove }: Props) {
    const [query, setQuery] = useState('');
    const [expandedMoveNodes,setExpandedMoveNodes] = useState<Set<number>>(new Set());
    const moveListRef = useRef<HTMLDivElement>(null);
    const moveParentBtnRef = useRef<HTMLButtonElement | null>(null);

    const movingNode = allIdeas.find(i => i.id === nodeId);

    useEffect(() => {
        const expanded = new Set<number>();
        let id: number | undefined = movingNode?.parentID;
        while (id) {
            expanded.add(id);
            const parent = allIdeas.find((i: IdeaType) => i.id === id);
            id = parent?.parentID || undefined;
        }
        setExpandedMoveNodes(expanded);
        const timer = setTimeout(() => {
            const container = moveListRef.current;
            const btn = moveParentBtnRef.current;
            if (container && btn) {
                const containerRect = container.getBoundingClientRect();
                const btnRect = btn.getBoundingClientRect();
                container.scrollTop += btnRect.top - containerRect.top;
            }
        }, 250);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only when the listed deps change, by design
    }, []);

    const descendants = (() => {
        const result = new Set<number>();
        const walk = (id: number) => {
            allIdeas.filter(i => i.parentID === id).forEach(child => {
                result.add(child.id);
                walk(child.id);
            });
        };
        walk(nodeId);
        return result;
    })();

    const hidden = new Set([nodeId, ...descendants]);
    const disabled = movingNode?.parentID ? new Set([movingNode.parentID]) : new Set<number>();
    const root = allIdeas.find(i => i.id === 1);
    const rootDisabled = disabled.has(1);
    const rootExpanded = expandedMoveNodes.has(1);

    function toggleExpanded(id: number) {
        setExpandedMoveNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function renderMoveTree(parentId: number, depth: number): ReactNode[] {
        return allIdeas
            .filter(i => i.parentID === parentId && !hidden.has(i.id))
            .flatMap(child => {
                const visibleKids = allIdeas.filter(i => i.parentID === child.id && !hidden.has(i.id));
                const isChecklist = child.type === 'checklist';
                const isNote = isNoteMode(child);
                // Same rule as drag-and-drop: a link node opens its URL when
                // tapped, so anything moved under it would be unreachable.
                const isDisabled = disabled.has(child.id) || isChecklist || isNote || !!getIdeaLink(child);
                const isExpanded = expandedMoveNodes.has(child.id);
                const isCurrentParent = child.id === movingNode?.parentID;
                const hasKids = allIdeas.some(i => i.parentID === child.id);
                const colorClass = isChecklist
                    ? 'mmobile-move-btn--checklist'
                    : isNote
                    ? 'mmobile-move-btn--note'
                    : getIdeaLink(child)
                    ? 'mmobile-move-btn--link'
                    : hasKids ? 'mmobile-move-btn--parent'
                    : 'mmobile-move-btn--leaf';
                return [
                    <div key={child.id} className="mmobile-move-row" style={{ '--depth': depth } as CSSProperties}>
                        <button
                            ref={isCurrentParent ? (el) => { moveParentBtnRef.current = el; } : undefined}
                            className={`mmobile-move-btn ${colorClass}${isDisabled ? ' mmobile-move-btn--disabled' : ''}`}
                            disabled={isDisabled}
                            onClick={isDisabled ? undefined : () => onMove(nodeId, child.id)}
                        >
                            <span className="mmobile-move-label">{resolveIdeaLabel(child).split('\n')[0]}</span>
                            {isCurrentParent && <span className="mmobile-move-badge">Current</span>}
                        </button>
                        {visibleKids.length > 0 && (
                            <button
                                className={`mmobile-move-toggle${isExpanded ? ' mmobile-move-toggle--open' : ''}`}
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                aria-expanded={isExpanded}
                                onClick={() => toggleExpanded(child.id)}
                            >
                                <span aria-hidden="true">›</span>
                            </button>
                        )}
                    </div>,
                    ...(visibleKids.length > 0 && isExpanded ? renderMoveTree(child.id, depth + 1) : [])
                ];
            });
    }

    const trimmed = query.trim();
    const matches = trimmed
        ? searchIdeas(allIdeas.filter(i => !hidden.has(i.id)), trimmed).filter(r => r.isMatch)
        : [];

    function renderMatches(): ReactNode {
        if (matches.length === 0) return <p className="mmobile-move-empty">No ideas match.</p>;
        return matches.map(r => {
            const idea = allIdeas.find(i => i.id === r.id);
            if (!idea) return null;
            const isDisabled = disabled.has(r.id) || r.kind !== 'idea';
            const isCurrentParent = r.id === movingNode?.parentID;
            const colorClass = r.kind === 'checklist'
                ? 'mmobile-move-btn--checklist'
                : r.kind === 'note'
                ? 'mmobile-move-btn--note'
                : r.kind === 'link'
                ? 'mmobile-move-btn--link'
                : r.hasChildren ? 'mmobile-move-btn--parent'
                : 'mmobile-move-btn--leaf';
            return (
                <div key={r.id} className="mmobile-move-row">
                    <button
                        className={`mmobile-move-btn ${colorClass}${isDisabled ? ' mmobile-move-btn--disabled' : ''}`}
                        disabled={isDisabled}
                        onClick={isDisabled ? undefined : () => onMove(nodeId, r.id)}
                    >
                        <span className="mmobile-move-text">
                            <span className="mmobile-move-label">{r.label}</span>
                            {r.path.length > 0 && <span className="mmobile-move-path">{r.path.join(' › ')}</span>}
                        </span>
                        {isCurrentParent && <span className="mmobile-move-badge">Current</span>}
                    </button>
                </div>
            );
        });
    }

    return (
        <>
        <div className="mmobile-search-field mmobile-move-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M15.5 15.5L21 21" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
            <input
                className="mmobile-search-input"
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Search for where to move it…"
                aria-label="Search for a destination"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.blur(); }
                }}
            />
            {query !== '' && (
                <button type="button" className="mmobile-search-clear" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery('')} aria-label="Clear search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" /></svg></button>
            )}
        </div>
        <p className="mmobile-move-hint">Tap an idea to move it there.</p>
        {trimmed ? (
            <div className="mmobile-move-list">{renderMatches()}</div>
        ) : (
        <div className="mmobile-move-list" ref={moveListRef}>
            {root && (
                <div className="mmobile-move-row">
                    <button
                        ref={movingNode?.parentID === 1 ? (el) => { moveParentBtnRef.current = el; } : undefined}
                        className={`mmobile-move-btn mmobile-move-btn--parent${rootDisabled ? ' mmobile-move-btn--disabled' : ''}`}
                        disabled={rootDisabled}
                        onClick={rootDisabled ? undefined : () => onMove(nodeId, 1)}
                    >
                        <span className="mmobile-move-label">{resolveIdeaLabel(root).split('\n')[0]}</span>
                        {movingNode?.parentID === 1 && <span className="mmobile-move-badge">Current</span>}
                    </button>
                    <button
                        className={`mmobile-move-toggle${rootExpanded ? ' mmobile-move-toggle--open' : ''}`}
                        aria-label={rootExpanded ? 'Collapse' : 'Expand'}
                        aria-expanded={rootExpanded}
                        onClick={() => toggleExpanded(1)}
                    >
                        <span aria-hidden="true">›</span>
                    </button>
                </div>
            )}
            {rootExpanded && renderMoveTree(1, 1)}
        </div>
        )}
        </>
    );
}

export default MobileMoveSheet;
