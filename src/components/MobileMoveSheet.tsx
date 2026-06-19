import { useEffect, useRef, useState } from 'react';
import { IdeaType } from '../utilities';

interface Props {
    nodeId: number;
    allIdeas: IdeaType[];
    onMove: (nodeId: number, targetId: number) => void;
}

function MobileMoveSheet({ nodeId, allIdeas, onMove }: Props) {
    const [expandedMoveNodes, setExpandedMoveNodes] = useState<Set<number>>(new Set());
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

    function renderMoveTree(parentId: number, depth: number) {
        return allIdeas
            .filter(i => i.parentID === parentId && !hidden.has(i.id))
            .flatMap(child => {
                const visibleKids = allIdeas.filter(i => i.parentID === child.id && !hidden.has(i.id));
                const isDisabled = disabled.has(child.id);
                const isExpanded = expandedMoveNodes.has(child.id);
                const isCurrentParent = child.id === movingNode?.parentID;
                const hasKids = allIdeas.some(i => i.parentID === child.id);
                const colorClass = child.link
                    ? 'mmobile-move-btn--link'
                    : hasKids ? 'mmobile-move-btn--parent'
                    : 'mmobile-move-btn--leaf';
                return [
                    <div key={child.id} className="mmobile-move-row" style={{ paddingLeft: `${depth * 16}px` }}>
                        <button
                            ref={isCurrentParent ? (el) => { moveParentBtnRef.current = el; } : undefined}
                            className={`mmobile-move-btn ${colorClass}${isDisabled ? ' mmobile-move-btn--disabled' : ''}`}
                            disabled={isDisabled}
                            onClick={isDisabled ? undefined : () => onMove(nodeId, child.id)}
                        >
                            {child.content}
                        </button>
                        {visibleKids.length > 0 && (
                            <button className="mmobile-move-toggle" onClick={() => toggleExpanded(child.id)}>
                                {isExpanded ? '▾' : '▸'}
                            </button>
                        )}
                    </div>,
                    ...(visibleKids.length > 0 && isExpanded ? renderMoveTree(child.id, depth + 1) : [])
                ];
            });
    }

    return (
        <div className="mmobile-move-list" ref={moveListRef}>
            {root && (
                <div className="mmobile-move-row">
                    <button
                        ref={movingNode?.parentID === 1 ? (el) => { moveParentBtnRef.current = el; } : undefined}
                        className={`mmobile-move-btn mmobile-move-btn--parent${rootDisabled ? ' mmobile-move-btn--disabled' : ''}`}
                        disabled={rootDisabled}
                        onClick={rootDisabled ? undefined : () => onMove(nodeId, 1)}
                    >
                        {root.content}
                    </button>
                    <button className="mmobile-move-toggle" onClick={() => toggleExpanded(1)}>
                        {rootExpanded ? '▾' : '▸'}
                    </button>
                </div>
            )}
            {rootExpanded && renderMoveTree(1, 1)}
        </div>
    );
}

export default MobileMoveSheet;
