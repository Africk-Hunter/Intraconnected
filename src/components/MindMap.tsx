import { useEffect, useRef, useState, useMemo, MouseEvent } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { fetchFullIdeaList, IdeaType, getIdeaLink } from '../utilities';

interface TreeNodeProps {
    ideaId: number;
    allIdeas: IdeaType[];
    currentRootId: number;
    onNavigate: (idea: IdeaType) => void;
    expandedIds: Set<number>;
}

function TreeNode({ ideaId, allIdeas, currentRootId, onNavigate, expandedIds }: TreeNodeProps) {
    const idea = allIdeas.find(i => Number(i.id) === ideaId);
    const [collapsed, setCollapsed] = useState(!expandedIds.has(ideaId));

    if (!idea) return null;

    const children = allIdeas.filter(i => Number(i.parentID) === ideaId);
    const hasKids = children.length > 0;

    const isLink = !!getIdeaLink(idea);
    const isChecklist = idea.type === 'checklist';

    const btnClass = [
        'mm-node-btn',
        ideaId === 1 ? 'mm-node-btn--root' : '',
        ideaId === currentRootId
            ? 'mm-node-btn--current'
            : isChecklist
            ? 'mm-node-btn--checklist'
            : isLink
            ? 'mm-node-btn--link'
            : hasKids
            ? 'mm-node-btn--parent'
            : 'mm-node-btn--leaf',
    ].filter(Boolean).join(' ');

    const isRoot = ideaId === 1;

    function handleClick() {
        if (isChecklist) return;
        if (isLink) {
            window.open(getIdeaLink(idea), '_blank', 'noopener,noreferrer');
        } else {
            onNavigate(idea);
        }
    }

    return (
        <div className="mm-node-col">
            <button
                className={btnClass}
                style={isRoot ? { fontSize: '1.9rem', padding: '1rem 2rem', maxWidth: '300px', fontWeight: 800 } : undefined}
                onClick={handleClick}
            >
                {idea.content}
            </button>
            {hasKids && (
                <>
                    <button
                        className="mm-toggle-btn"
                        onClick={() => setCollapsed(c => !c)}
                        title={collapsed ? 'Expand' : 'Collapse'}
                    >
                        <span>{collapsed ? '+' : '−'}</span>
                    </button>
                    {!collapsed && (
                        <>
                            <div className="mm-connector-v" />
                            <div className="mm-children-row">
                                {children.map(child => (
                                    <div key={child.id} className="mm-child-wrap">
                                        <TreeNode
                                            ideaId={Number(child.id)}
                                            allIdeas={allIdeas}
                                            currentRootId={currentRootId}
                                            onNavigate={onNavigate}
                                            expandedIds={expandedIds}
                                        />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

interface MindMapProps {
    onClose: () => void;
}

function MindMap({ onClose }: MindMapProps) {
    const { rootId, setRootId, setRootName, rootIdStack, newIdeaSwitch } = useIdeaContext();
    const [allIdeas, setAllIdeas] = useState<IdeaType[]>([]);

    useEffect(() => {
        const raw: IdeaType[] = fetchFullIdeaList();
        const hasRoot = raw.some(i => Number(i.id) === 1);
        const withRoot = hasRoot
            ? raw
            : [{ id: 1, content: 'Ideas', parentID: 0, link: '' } as IdeaType, ...raw];
        setAllIdeas(withRoot);
    }, [newIdeaSwitch]);

    const expandedIds = useMemo(() => {
        const ids = new Set<number>();
        let id = rootId;
        while (true) {
            ids.add(id);
            if (id === 1) break;
            const node = allIdeas.find(i => Number(i.id) === id);
            if (!node || !node.parentID) break;
            id = Number(node.parentID);
        }
        return ids;
    }, [allIdeas, rootId]);

    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [dragging, setDragging] = useState(false);
    const isDragging = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const startOffset = useRef({ x: 0, y: 0 });
    const bodyRef = useRef<HTMLDivElement>(null);

    // Non-passive wheel listener so preventDefault works
    useEffect(() => {
        const el = bodyRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            setZoom(prev => Math.min(4, Math.max(0.2, prev * factor)));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    function onMouseDown(e: MouseEvent<HTMLDivElement>) {
        if ((e.target as HTMLElement).closest('button')) return;
        isDragging.current = true;
        setDragging(true);
        startPos.current = { x: e.clientX, y: e.clientY };
        startOffset.current = { ...offset };
    }

    function onMouseMove(e: MouseEvent<HTMLDivElement>) {
        if (!isDragging.current) return;
        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;
        setOffset({
            x: startOffset.current.x + dx,
            y: startOffset.current.y + dy,
        });
    }

    function stopDragging() {
        if (!isDragging.current) return;
        isDragging.current = false;
        setDragging(false);
    }

    function navigateTo(idea: IdeaType) {
        const path: number[] = [];
        let id = Number(idea.id);
        while (true) {
            path.unshift(id);
            const node = allIdeas.find(i => Number(i.id) === id);
            if (!node || Number(node.id) === 1 || !node.parentID) break;
            id = Number(node.parentID);
        }
        rootIdStack.current.length = 0;
        path.forEach(p => rootIdStack.current.push(p));
        setRootId(Number(idea.id));
        setRootName(idea.content);
        onClose();
    }

    return (
        <div className="mm-wrap">
            <div
                ref={bodyRef}
                className={`mm-body${dragging ? ' mm-body--dragging' : ''}`}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={stopDragging}
                onMouseLeave={stopDragging}
            >
                <div
                    className="mm-canvas"
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                        transformOrigin: '50% 0',
                    }}
                >
                    {allIdeas.length === 0 ? (
                        <p className="mm-empty-msg">Loading ideas…</p>
                    ) : (
                        <TreeNode
                            ideaId={1}
                            allIdeas={allIdeas}
                            currentRootId={rootId}
                            onNavigate={navigateTo}
                            expandedIds={expandedIds}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default MindMap;
