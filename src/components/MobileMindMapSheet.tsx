import { useEffect, useRef, useState } from 'react';
import { IdeaType, getIdeaLink } from '../utilities';

interface Props {
    currentId: number;
    allIdeas: IdeaType[];
    onNavigate: (id: number) => void;
    onClose: () => void;
    style?: React.CSSProperties;
}

function MobileMindMapSheet({ currentId, allIdeas, onNavigate, onClose, style }: Props) {
    const ideasWithRoot = (() => {
        const hasRoot = allIdeas.some(i => Number(i.id) === 1);
        return hasRoot
            ? allIdeas
            : [{ id: 1, content: 'Ideas', parentID: 0, link: '' } as IdeaType, ...allIdeas];
    })();

    // Expand all ancestors of currentId on open
    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(() => {
        const ids = new Set<number>();
        let id = currentId;
        while (true) {
            ids.add(id);
            if (id === 1) break;
            const node = ideasWithRoot.find(i => Number(i.id) === id);
            if (!node || !node.parentID) break;
            id = Number(node.parentID);
        }
        return ids;
    });

    const scrollRef = useRef<HTMLDivElement>(null);
    const currentNodeRef = useRef<HTMLButtonElement | null>(null);

    // Auto-scroll to highlight current node
    useEffect(() => {
        const timer = setTimeout(() => {
            const container = scrollRef.current;
            const btn = currentNodeRef.current;
            if (container && btn) {
                const containerRect = container.getBoundingClientRect();
                const btnRect = btn.getBoundingClientRect();
                container.scrollTop += btnRect.top - containerRect.top - containerRect.height / 2;
            }
        }, 200);
        return () => clearTimeout(timer);
    }, []);

    function toggleExpanded(id: number) {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    // guides: boolean[] — for each ancestor depth, whether the vertical line continues past this row
    function renderTree(parentId: number, guides: boolean[]): React.ReactNode[] {
        const children = ideasWithRoot.filter(i => Number(i.parentID) === parentId);
        return children.flatMap((child, index) => {
            const id = Number(child.id);
            const isLast = index === children.length - 1;
            const hasKids = ideasWithRoot.some(i => Number(i.parentID) === id);
            const isExpanded = expandedNodes.has(id);
            const isCurrent = id === currentId;
            const isLink = !!getIdeaLink(child);
            const isChecklist = child.type === 'checklist';

            const nodeClass = [
                'vtree-node',
                isCurrent      ? 'vtree-node--current'   :
                isChecklist    ? 'vtree-node--checklist'  :
                isLink         ? 'vtree-node--link'       :
                hasKids        ? 'vtree-node--parent'     :
                                 'vtree-node--leaf'
            ].join(' ');

            function handleClick() {
                if (isChecklist) return;
                if (isLink) { window.open(getIdeaLink(child), '_blank', 'noopener,noreferrer'); return; }
                onNavigate(id);
            }

            const rows: React.ReactNode[] = [
                <div key={child.id} className="vtree-row">
                    <div className="vtree-guides">
                        {guides.map((hasLine, gi) => (
                            <div key={gi} className={`vtree-guide${hasLine ? ' vtree-guide--line' : ''}`} />
                        ))}
                        <div className={`vtree-connector${isLast ? ' vtree-connector--last' : ''}`} />
                    </div>
                    <button
                        ref={isCurrent ? el => { currentNodeRef.current = el; } : undefined}
                        className={nodeClass}
                        onClick={handleClick}
                    >
                        {child.content.split('\n')[0]}
                    </button>
                    {hasKids && (
                        <button className="vtree-toggle" onClick={() => toggleExpanded(id)}>
                            {isExpanded ? '▾' : '▸'}
                        </button>
                    )}
                </div>
            ];

            if (hasKids && isExpanded) {
                rows.push(...renderTree(id, [...guides, !isLast]));
            }

            return rows;
        });
    }

    const root = ideasWithRoot.find(i => Number(i.id) === 1);
    const rootHasKids = ideasWithRoot.some(i => Number(i.parentID) === 1);
    const rootExpanded = expandedNodes.has(1);
    const rootIsCurrent = currentId === 1;

    return (
        <>
            <div className="mmobile-scrim" onClick={onClose} />
            <div className="mmobile-mindmap-sheet" style={style}>
                <div className="mmobile-mindmap-header">
                    <span className="mmobile-mindmap-title">Mind Map</span>
                    <button className="mmobile-mindmap-close" onClick={onClose}>✕</button>
                </div>
                <div className="vtree-scroll" ref={scrollRef}>
                    {root && (
                        <div className="vtree-root-row">
                            <button
                                ref={rootIsCurrent ? el => { currentNodeRef.current = el; } : undefined}
                                className={`vtree-root-btn${rootIsCurrent ? ' vtree-root-btn--current' : ''}`}
                                onClick={() => { if (!rootIsCurrent) onNavigate(1); }}
                            >
                                {root.content.split('\n')[0]}
                            </button>
                            {rootHasKids && (
                                <button className="vtree-toggle" onClick={() => toggleExpanded(1)}>
                                    {rootExpanded ? '▾' : '▸'}
                                </button>
                            )}
                        </div>
                    )}
                    {rootExpanded && renderTree(1, [])}
                </div>
                <div className="mmobile-mindmap-footer">
                    <button className="mmobile-mindmap-close-btn" onClick={onClose}>Close</button>
                </div>
            </div>
        </>
    );
}

export default MobileMindMapSheet;
