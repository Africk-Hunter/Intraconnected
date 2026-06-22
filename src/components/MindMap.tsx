import { useEffect, useRef, useState, useMemo, MouseEvent } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { fetchFullIdeaList, IdeaType, ChecklistIdea, getIdeaLink } from '../utilities';

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

    if (isChecklist) {
        const checklistIdea = idea as ChecklistIdea;
        const items = checklistIdea.items ?? [];
        return (
            <div className="mm-node-col">
                <div className="mm-checklist-card">
                    <span className="mm-checklist-card__title">{idea.content.split('\n')[0]}</span>
                    {items.length > 0 && (
                        <ul className="mm-checklist-card__items">
                            {items.map(item => (
                                <li
                                    key={item.id}
                                    className={`mm-checklist-card__item${item.checked ? ' mm-checklist-card__item--checked' : ''}`}
                                >
                                    <span className="mm-checklist-card__check" aria-hidden="true">
                                        {item.checked ? '✓' : '○'}
                                    </span>
                                    <span className="mm-checklist-card__text">{item.text}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="mm-node-col">
            <button
                className={btnClass}
                style={isRoot ? { fontSize: '1.9rem', padding: '1rem 2rem', maxWidth: '300px', fontWeight: 800 } : undefined}
                onClick={handleClick}
            >
                {idea.content.split('\n')[0]}
            </button>
            {hasKids && (
                <>
                    <button
                        className={`mm-toggle-btn${collapsed ? ' mm-toggle-btn--collapsed' : ''}`}
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
    visible: boolean;
}

function MindMap({ onClose, visible }: MindMapProps) {
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

    const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
    const [dragging, setDragging] = useState(false);
    const isDragging = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const startOffset = useRef({ x: 0, y: 0 });
    const bodyRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const hasCenteredRef = useRef(false);

    // Each time the overlay opens, center the view on the current idea node.
    // The overlay is always in the DOM (just opacity: 0), so getBoundingClientRect
    // is valid immediately — no need to wait for a visibility-triggered re-render.
    useEffect(() => {
        if (!visible) {
            hasCenteredRef.current = false;
            return;
        }
        if (hasCenteredRef.current || allIdeas.length === 0) return;

        const raf = requestAnimationFrame(() => {
            if (!bodyRef.current || !canvasRef.current) return;

            const bodyRect = bodyRef.current.getBoundingClientRect();
            const currentNode = canvasRef.current.querySelector('.mm-node-btn--current') as HTMLElement | null;

            if (!currentNode) {
                // Fallback: center canvas horizontally
                const canvasRect = canvasRef.current.getBoundingClientRect();
                setView({ x: Math.max(0, (bodyRect.width - canvasRect.width) / 2), y: 0, zoom: 1 });
                hasCenteredRef.current = true;
                return;
            }

            const nodeRect = currentNode.getBoundingClientRect();
            const nodeScreenX = nodeRect.left - bodyRect.left + nodeRect.width / 2;
            const nodeScreenY = nodeRect.top - bodyRect.top + nodeRect.height / 2;

            // Convert screen position → canvas-local position using the current transform,
            // then compute the view offset that places the node at the body center at zoom=1.
            setView(prev => {
                const cx = (nodeScreenX - prev.x) / prev.zoom;
                const cy = (nodeScreenY - prev.y) / prev.zoom;
                return { zoom: 1, x: bodyRect.width / 2 - cx, y: bodyRect.height / 2 - cy };
            });
            hasCenteredRef.current = true;
        });

        return () => cancelAnimationFrame(raf);
    }, [visible, allIdeas]);

    // Non-passive wheel listener so preventDefault works
    useEffect(() => {
        const el = bodyRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            const rect = el.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            setView(prev => {
                const newZoom = Math.min(4, Math.max(0.2, prev.zoom * factor));
                const scale = newZoom / prev.zoom;
                return {
                    zoom: newZoom,
                    x: mouseX - (mouseX - prev.x) * scale,
                    y: mouseY - (mouseY - prev.y) * scale,
                };
            });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    function onMouseDown(e: MouseEvent<HTMLDivElement>) {
        if ((e.target as HTMLElement).closest('button')) return;
        isDragging.current = true;
        setDragging(true);
        startPos.current = { x: e.clientX, y: e.clientY };
        startOffset.current = { x: view.x, y: view.y };
    }

    function onMouseMove(e: MouseEvent<HTMLDivElement>) {
        if (!isDragging.current) return;
        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;
        setView(prev => ({
            ...prev,
            x: startOffset.current.x + dx,
            y: startOffset.current.y + dy,
        }));
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
        <div className={`mm-wrap${visible ? ' mm-wrap--visible' : ''}`}>
            <div
                ref={bodyRef}
                className={`mm-body${dragging ? ' mm-body--dragging' : ''}`}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={stopDragging}
                onMouseLeave={stopDragging}
            >
                <div
                    ref={canvasRef}
                    className="mm-canvas"
                    style={{
                        transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
                        transformOrigin: '0 0',
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
