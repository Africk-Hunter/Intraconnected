import { useEffect, useRef, useState } from 'react';
import { IdeaType } from '../utilities';

interface Props {
    currentId: number;
    allIdeas: IdeaType[];
    onNavigate: (id: number) => void;
}

function MobileNavigateSheet({ currentId, allIdeas, onNavigate }: Props) {
    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
    const listRef = useRef<HTMLDivElement>(null);
    const currentBtnRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const expanded = new Set<number>();
        let id: number | undefined = currentId;
        while (id) {
            expanded.add(id);
            const node = allIdeas.find(i => i.id === id);
            id = node?.parentID || undefined;
        }
        setExpandedNodes(expanded);
        const timer = setTimeout(() => {
            const container = listRef.current;
            const btn = currentBtnRef.current;
            if (container && btn) {
                const containerRect = container.getBoundingClientRect();
                const btnRect = btn.getBoundingClientRect();
                container.scrollTop += btnRect.top - containerRect.top - containerRect.height / 2;
            }
        }, 250);
        return () => clearTimeout(timer);
    }, []);

    function toggleExpanded(id: number) {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function renderTree(parentId: number, depth: number): React.ReactNode[] {
        return allIdeas
            .filter(i => i.parentID === parentId)
            .flatMap(child => {
                const hasKids = allIdeas.some(i => i.parentID === child.id);
                const isExpanded = expandedNodes.has(child.id);
                const isCurrent = child.id === currentId;
                const isLink = !!child.link;
                const isDisabled = isCurrent || isLink;
                const colorClass = isLink
                    ? 'mmobile-move-btn--link'
                    : hasKids
                    ? 'mmobile-move-btn--parent'
                    : 'mmobile-move-btn--leaf';
                return [
                    <div key={child.id} className="mmobile-move-row" style={{ paddingLeft: `${depth * 16}px` }}>
                        <button
                            ref={isCurrent ? el => { currentBtnRef.current = el; } : undefined}
                            className={`mmobile-move-btn ${colorClass}${isCurrent ? ' mmobile-move-btn--current' : ''}${isLink ? ' mmobile-move-btn--disabled' : ''}`}
                            disabled={isDisabled}
                            onClick={isDisabled ? undefined : () => onNavigate(child.id)}
                        >
                            {child.content}
                        </button>
                        {hasKids && (
                            <button className="mmobile-move-toggle" onClick={() => toggleExpanded(child.id)}>
                                {isExpanded ? '▾' : '▸'}
                            </button>
                        )}
                    </div>,
                    ...(hasKids && isExpanded ? renderTree(child.id, depth + 1) : [])
                ];
            });
    }

    const root = allIdeas.find(i => i.id === 1);
    const rootIsCurrent = currentId === 1;
    const rootExpanded = expandedNodes.has(1);

    return (
        <div className="mmobile-move-list" ref={listRef}>
            {root && (
                <div className="mmobile-move-row">
                    <button
                        ref={rootIsCurrent ? el => { currentBtnRef.current = el; } : undefined}
                        className={`mmobile-move-btn mmobile-move-btn--parent${rootIsCurrent ? ' mmobile-move-btn--current' : ''}`}
                        disabled={rootIsCurrent}
                        onClick={rootIsCurrent ? undefined : () => onNavigate(1)}
                    >
                        {root.content}
                    </button>
                    <button className="mmobile-move-toggle" onClick={() => toggleExpanded(1)}>
                        {rootExpanded ? '▾' : '▸'}
                    </button>
                </div>
            )}
            {rootExpanded && renderTree(1, 1)}
        </div>
    );
}

export default MobileNavigateSheet;
