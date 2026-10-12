import { useEffect, useRef, useState, useMemo, type MouseEvent, type MutableRefObject } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { useIdeaActions, subtreeIds } from '../utilities/idea/useIdeaActions';
import { computeLens, type MapLens, type LensInfo } from '../utilities/idea/mapLens';
import { fetchFullIdeaList, IdeaType, ChecklistIdea, getIdeaLink, openIdeaLink, resolveIdeaLabel, isNoteMode } from '../utilities';

interface TreeNodeProps {
    ideaId: number;
    allIdeas: IdeaType[];
    currentRootId: number;
    onNavigate: (idea: IdeaType) => void;
    expandedIds: Set<number>;
    lens: MapLens;
    lensInfo: Map<number, LensInfo>;
    // The idea being dragged, the one it would land on, and a hovered one it can't land on.
    drag: { id: number; over: number | null; bad: number | null } | null;
    onNodePress: (e: MouseEvent<HTMLElement>, idea: IdeaType) => void;
    // Set for a moment after a drag ends, so the release isn't also a click.
    suppressClick: MutableRefObject<boolean>;
    // Opens this node when something has just been dropped into it (`tick` makes each drop a new request).
    expandReq: { ids: number[]; tick: number } | null;
    // The idea a search just revealed (ringed for a moment).
    foundId: number | null;
}

function TreeNode({ ideaId, allIdeas, currentRootId, onNavigate, expandedIds, lens, lensInfo, drag, onNodePress, suppressClick, expandReq, foundId }: TreeNodeProps) {
    const idea = allIdeas.find(i => Number(i.id) === ideaId);
    const [collapsed, setCollapsed] = useState(!expandedIds.has(ideaId));
    const wasOnPathRef = useRef(expandedIds.has(ideaId));

    // TreeNode instances persist across navigations (the overlay never unmounts),
    // so `collapsed` must re-sync whenever this node enters or leaves the current
    // path — the useState initializer above only runs once, at first mount. Only
    // forcing collapsed when path membership actually flips (not on every render)
    // preserves a manual +/- toggle on branches that aren't on the current path.
    useEffect(() => {
        const isOnPath = expandedIds.has(ideaId);
        if (isOnPath !== wasOnPathRef.current) {
            setCollapsed(!isOnPath);
            wasOnPathRef.current = isOnPath;
        }
    }, [expandedIds, ideaId]);

    useEffect(() => {
        if (expandReq?.ids.includes(ideaId)) setCollapsed(false);
    }, [expandReq, ideaId]);

    if (!idea) return null;

    const children = allIdeas.filter(i => Number(i.parentID) === ideaId);
    const hasKids = children.length > 0;

    const isLink = !!getIdeaLink(idea);
    const isChecklist = idea.type === 'checklist';
    const isNote = isNoteMode(idea);

    const btnClass = [
        'mm-node-btn',
        ideaId === 1 ? 'mm-node-btn--root' : '',
        ideaId === currentRootId
            ? 'mm-node-btn--current'
            : isChecklist
            ? 'mm-node-btn--checklist'
            : isNote
            ? 'mm-node-btn--note'
            : isLink
            ? 'mm-node-btn--link'
            : hasKids
            ? 'mm-node-btn--parent'
            : 'mm-node-btn--leaf',
    ].filter(Boolean).join(' ');

    const isRoot = ideaId === 1;

    // A lens prunes the tree to the matching ideas and the branches leading to them
    // (collapsing is ignored meanwhile); the path nodes are drawn a little faded.
    const lensOn = lens !== 'off';
    const info = lensOn ? lensInfo.get(ideaId) : undefined;
    const lensClass = !lensOn ? '' : info?.tone ? ' mm-lens--match' : ' mm-lens--path';
    const ringClass = info?.tone ? ` mm-lens-ring--${info.tone}` : '';
    const badge = info?.badge ? <span className={`mm-lens-badge mm-lens-badge--${info.tone}`}>{info.badge}</span> : null;
    const isCollapsed = collapsed && !lensOn;
    const foundClass = foundId === ideaId ? ' mm-found' : '';
    const dragClass = drag?.over === ideaId ? ' mm-drop-target' : drag?.bad === ideaId ? ' mm-drop-denied' : drag?.id === ideaId ? ' mm-drag-source' : '';
    const shownKids = lensOn
        ? children.filter(c => { const ci = lensInfo.get(Number(c.id)); return !!(ci?.tone || ci?.onPath); })
        : children;

    function handleClick() {
        if (suppressClick.current) return;
        if (!idea || isChecklist || isNote) return;
        if (isLink) {
            openIdeaLink(getIdeaLink(idea));
        } else {
            onNavigate(idea);
        }
    }

    if (isChecklist) {
        const checklistIdea = idea as ChecklistIdea;
        const items = checklistIdea.items ?? [];
        return (
            <div className="mm-node-col">
                <div className={`mm-node-wrap${lensClass}${ringClass}${foundClass}`} data-mm-find={ideaId}>
                {badge}
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
            </div>
        );
    }

    return (
        <div className="mm-node-col">
            <div className={`mm-node-wrap${lensClass}${ringClass}${dragClass}${foundClass}`} data-mm-id={ideaId} data-mm-find={ideaId}>
                {badge}
                <button
                    className={btnClass}
                    onMouseDown={e => onNodePress(e, idea)}
                    style={isRoot ? { fontSize: '1.9rem', padding: '1rem 2rem', maxWidth: '300px', fontWeight: 800 } : undefined}
                    onClick={handleClick}
                >
                    {resolveIdeaLabel(idea).split('\n')[0]}
                </button>
            </div>
            {(lensOn ? shownKids.length > 0 : hasKids) && (
                <>
                    {!lensOn && (
                        <button
                            className={`mm-toggle-btn${collapsed ? ' mm-toggle-btn--collapsed' : ''}`}
                            onClick={() => setCollapsed(c => !c)}
                            title={collapsed ? 'Expand' : 'Collapse'}
                        >
                            <span>{collapsed ? '+' : '−'}</span>
                        </button>
                    )}
                    {!isCollapsed && (
                        <>
                            <div className="mm-connector-v" />
                            <div className="mm-children-row">
                                {shownKids.map(child => (
                                    <div key={child.id} className="mm-child-wrap">
                                        <TreeNode
                                            ideaId={Number(child.id)}
                                            allIdeas={allIdeas}
                                            currentRootId={currentRootId}
                                            onNavigate={onNavigate}
                                            expandedIds={expandedIds}
                                            lens={lens}
                                            lensInfo={lensInfo}
                                            drag={drag}
                                            onNodePress={onNodePress}
                                            suppressClick={suppressClick}
                                            expandReq={expandReq}
                                            foundId={foundId}
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

const LENS_KEY = 'mindmap_lens';

const LEGENDS: Record<'priority' | 'recent', { tone: string; label: string }[]> = {
    priority: [
        { tone: 'p1', label: 'P1 High' },
        { tone: 'p2', label: 'P2 Medium' },
        { tone: 'p3', label: 'P3 Low' },
    ],
    recent: [
        { tone: 'today', label: 'Created today' },
        { tone: 'week', label: 'Created this week' },
        { tone: 'month', label: 'Created this month' },
    ],
};

interface MindMapProps {
    onClose: () => void;
    visible: boolean;
    // Set by a search while the map is open: open the branches down to this idea and pan to it.
    reveal?: { id: number; tick: number } | null;
}

function MindMap({ onClose, visible, reveal }: MindMapProps) {
    const { rootId, navigateToId, newIdeaSwitch } = useIdeaContext();
    const [allIdeas, setAllIdeas] = useState<IdeaType[]>([]);

    useEffect(() => {
        const raw: IdeaType[] = fetchFullIdeaList();
        const hasRoot = raw.some(i => Number(i.id) === 1);
        const withRoot = hasRoot
            ? raw
            : [{ id: 1, content: 'Ideas', parentID: 0, link: '' } as IdeaType, ...raw];
        setAllIdeas(withRoot);
    }, [newIdeaSwitch]);

    // The set of ids whose CHILDREN should render — every ancestor of the current
    // idea, PLUS the current idea itself (so its direct children preview one level
    // ahead), but not any of those children (so grandchildren of the current idea
    // stay hidden).
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

    const [lens, setLens] = useState<MapLens>(() => {
        try {
            const saved = localStorage.getItem(LENS_KEY);
            return saved === 'priority' || saved === 'recent' ? saved : 'off';
        } catch {
            return 'off';
        }
    });
    // Legend chips the viewer has picked to narrow the lens (empty = show them all).
    const [tones, setTones] = useState<ReadonlySet<string>>(new Set());
    useEffect(() => { setTones(new Set()); }, [lens]);
    const toggleTone = (tone: string) => setTones(prev => {
        const next = new Set(prev);
        if (!next.delete(tone)) next.add(tone);
        return next;
    });
    useEffect(() => {
        try { localStorage.setItem(LENS_KEY, lens); } catch { /* storage unavailable */ }
    }, [lens]);
    // `visible` re-dates the "recent" buckets each time the map opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const lensInfo = useMemo(() => computeLens(allIdeas, lens, Date.now(), tones), [allIdeas, lens, tones, visible]);
    const noMatches = lens !== 'off' && ![...lensInfo.values()].some(i => i.tone);
    const toggleLens = (which: 'priority' | 'recent') => setLens(prev => (prev === which ? 'off' : which));

    const { moveIdea } = useIdeaActions();
    const [drag, setDrag] = useState<{ id: number; label: string; x: number; y: number; over: number | null; bad: number | null } | null>(null);
    const suppressClick = useRef(false);
    const [expandReq, setExpandReq] = useState<{ ids: number[]; tick: number } | null>(null);
    const [foundId, setFoundId] = useState<number | null>(null);
    const dropLabel = drag?.over != null ? resolveIdeaLabel(allIdeas.find(i => Number(i.id) === drag.over)!).split('\n')[0] : null;

    const [treeKey, setTreeKey] = useState(0);
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
            setTreeKey(k => k + 1);
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

    // Zoom about the middle of the view (the wheel zooms about the pointer).
    function zoomBy(factor: number) {
        const el = bodyRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        setView(prev => {
            const newZoom = Math.min(4, Math.max(0.05, prev.zoom * factor));
            const scale = newZoom / prev.zoom;
            return { zoom: newZoom, x: cx - (cx - prev.x) * scale, y: cy - (cy - prev.y) * scale };
        });
    }

    // Back to the current idea at 100%, centred, however far the user panned or zoomed.
    function centerOnCurrent() {
        if (!bodyRef.current || !canvasRef.current) return;
        const bodyRect = bodyRef.current.getBoundingClientRect();
        const currentNode = canvasRef.current.querySelector('.mm-node-btn--current') as HTMLElement | null;
        if (!currentNode) return;
        const nodeRect = currentNode.getBoundingClientRect();
        const nodeScreenX = nodeRect.left - bodyRect.left + nodeRect.width / 2;
        const nodeScreenY = nodeRect.top - bodyRect.top + nodeRect.height / 2;
        setView(prev => {
            const cx = (nodeScreenX - prev.x) / prev.zoom;
            const cy = (nodeScreenY - prev.y) / prev.zoom;
            return { zoom: 1, x: bodyRect.width / 2 - cx, y: bodyRect.height / 2 - cy };
        });
    }

    // Zoom out (never in past 100%) until the whole drawn tree fits, with room
    // left at the bottom for the controls.
    function fitToView() {
        const body = bodyRef.current;
        const canvas = canvasRef.current;
        if (!body || !canvas) return;
        const rect = body.getBoundingClientRect();
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        if (!w || !h) return;
        const usableH = Math.max(120, rect.height - 170);
        const zoom = Math.max(0.05, Math.min(1, rect.width / w, usableH / h));
        setView({ zoom, x: (rect.width - w * zoom) / 2, y: Math.max(16, (usableH - h * zoom) / 2) });
    }

    // Switching a lens on, or a legend chip, fits the pruned tree; switching it off goes back to the current idea.
    const prevLens = useRef<MapLens>(lens);
    useEffect(() => {
        if (!visible) return;
        const was = prevLens.current;
        prevLens.current = lens;
        if (lens === 'off' && was === 'off') return;
        const raf = requestAnimationFrame(() => (lens === 'off' ? centerOnCurrent() : fitToView()));
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lens, tones, visible, allIdeas]);

    // A search result while the map is open: drop any lens (it hides unmatched branches),
    // open every branch down to the idea, then pan to it and ring it.
    useEffect(() => {
        if (!reveal) return;
        const chain: number[] = [];
        let cur = allIdeas.find(i => Number(i.id) === reveal.id);
        while (cur && Number(cur.parentID)) {
            chain.push(Number(cur.parentID));
            cur = allIdeas.find(i => Number(i.id) === Number(cur!.parentID));
        }
        setLens('off');
        setExpandReq({ ids: chain, tick: reveal.tick });
        setFoundId(reveal.id);
        const pan = setTimeout(() => {
            const body = bodyRef.current;
            const node = canvasRef.current?.querySelector<HTMLElement>(`[data-mm-find="${reveal.id}"]`);
            if (!body || !node) return;
            const b = body.getBoundingClientRect();
            const n = node.getBoundingClientRect();
            const nx = n.left - b.left + n.width / 2;
            const ny = n.top - b.top + n.height / 2;
            setView(prev => ({
                zoom: 1,
                x: b.width / 2 - (nx - prev.x) / prev.zoom,
                y: b.height / 2 - (ny - prev.y) / prev.zoom,
            }));
        }, 120);
        const clear = setTimeout(() => setFoundId(null), 2600);
        return () => { clearTimeout(pan); clearTimeout(clear); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reveal]);

    // Keyboard while the map is open: Esc closes, + / - zoom, 0 recentres,
    // arrows pan, P and N switch the lenses (G, which also closes it, is handled
    // with the other global shortcuts). Ignored while typing and while any modal is on top.
    useEffect(() => {
        if (!visible) return;
        const PAN_STEP = 80;
        function onKeyDown(e: KeyboardEvent) {
            if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target;
            if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
            if (document.querySelector('.overlay')) return;
            switch (e.key) {
                case 'Escape': onClose(); break;
                case '+': case '=': zoomBy(1.2); break;
                case '-': case '_': zoomBy(1 / 1.2); break;
                case '0': centerOnCurrent(); break;
                case 'p': case 'P': toggleLens('priority'); break;
                case 'n': case 'N': toggleLens('recent'); break;
                case 'ArrowLeft': setView(v => ({ ...v, x: v.x + PAN_STEP })); break;
                case 'ArrowRight': setView(v => ({ ...v, x: v.x - PAN_STEP })); break;
                case 'ArrowUp': setView(v => ({ ...v, y: v.y + PAN_STEP })); break;
                case 'ArrowDown': setView(v => ({ ...v, y: v.y - PAN_STEP })); break;
                default: return;
            }
            e.preventDefault();
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [visible, onClose]);

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
                const newZoom = Math.min(4, Math.max(0.05, prev.zoom * factor));
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

        // Attach document-level listeners so drag continues over fixed navbars (z-index > mm-wrap)
        function handleMove(ev: globalThis.MouseEvent) {
            const dx = ev.clientX - startPos.current.x;
            const dy = ev.clientY - startPos.current.y;
            setView(prev => ({
                ...prev,
                x: startOffset.current.x + dx,
                y: startOffset.current.y + dy,
            }));
        }

        function handleUp() {
            isDragging.current = false;
            setDragging(false);
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        }

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    }

    // Drag a node onto another to make it a child there. Press, move 6px to start,
    // release over a node to drop (Esc cancels); the move goes through moveIdea,
    // so it can be undone like any other.
    function canDropOn(sourceId: number, targetId: number): boolean {
        if (targetId === sourceId) return false;
        const source = allIdeas.find(i => Number(i.id) === sourceId);
        const target = allIdeas.find(i => Number(i.id) === targetId);
        if (!source || !target) return false;
        if (Number(source.parentID) === targetId) return false;
        if (target.type === 'checklist' || isNoteMode(target) || getIdeaLink(target)) return false;
        return !subtreeIds(allIdeas as { id: number; parentID: number }[], sourceId).has(targetId);
    }

    function startNodePress(e: MouseEvent<HTMLElement>, idea: IdeaType) {
        const sourceId = Number(idea.id);
        if (e.button !== 0 || sourceId === 1) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const label = resolveIdeaLabel(idea).split('\n')[0];
        let started = false;
        let cancelled = false;

        // The node under the pointer: `over` when the drag may land there, `bad` when it may not.
        function hoverAt(ev: globalThis.MouseEvent): { over: number | null; bad: number | null } {
            const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-mm-id]');
            const id = el ? Number(el.dataset.mmId) : null;
            if (id === null || id === sourceId) return { over: null, bad: null };
            return canDropOn(sourceId, id) ? { over: id, bad: null } : { over: null, bad: id };
        }
        function onMove(ev: globalThis.MouseEvent) {
            if (cancelled) return;
            if (!started) {
                if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
                started = true;
            }
            setDrag({ id: sourceId, label, x: ev.clientX, y: ev.clientY, ...hoverAt(ev) });
        }
        function finish() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('keydown', onKey, true);
            setDrag(null);
        }
        function onUp(ev: globalThis.MouseEvent) {
            const target = started && !cancelled ? hoverAt(ev).over : null;
            finish();
            if (started) {
                suppressClick.current = true;
                setTimeout(() => { suppressClick.current = false; }, 0);
            }
            if (target !== null) {
                moveIdea(sourceId, target);
                setExpandReq({ ids: [target], tick: Date.now() });
            }
        }
        function onKey(ev: KeyboardEvent) {
            if (ev.key !== 'Escape') return;
            // Cancels the drag only; the map stays open.
            ev.stopImmediatePropagation();
            ev.preventDefault();
            cancelled = true;
            setDrag(null);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('keydown', onKey, true);
    }

    function navigateTo(idea: IdeaType) {
        navigateToId(Number(idea.id));
        onClose();
    }

    return (
        <div className={`mm-wrap${visible ? ' mm-wrap--visible' : ''}${drag && drag.bad !== null ? ' mm-wrap--denied' : ''}`}>
            <div
                ref={bodyRef}
                className={`mm-body${dragging || drag ? ' mm-body--dragging' : ''}`}
                onMouseDown={onMouseDown}
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
                            key={treeKey}
                            ideaId={1}
                            allIdeas={allIdeas}
                            currentRootId={rootId}
                            onNavigate={navigateTo}
                            expandedIds={expandedIds}
                            lens={lens}
                            lensInfo={lensInfo}
                            drag={drag}
                            onNodePress={startNodePress}
                            suppressClick={suppressClick}
                            expandReq={expandReq}
                            foundId={foundId}
                        />
                    )}
                </div>
            </div>
            {drag && (
                <div className={`mm-drag-ghost${drag.bad !== null ? ' mm-drag-ghost--denied' : ''}`} style={{ left: drag.x, top: drag.y }}>
                    <span>{drag.label}</span>
                    <small>{dropLabel ? `Move into “${dropLabel}”` : drag.bad !== null ? 'Can’t move it there' : 'Drop on an idea · Esc cancels'}</small>
                </div>
            )}
            {lens !== 'off' && (
                <div className="mm-legend" aria-label="Lens key">
                    {LEGENDS[lens].map(entry => (
                        <button
                            key={entry.tone}
                            type="button"
                            className={`mm-lens-badge mm-lens-badge--${entry.tone} mm-lens-badge--static${tones.size > 0 && !tones.has(entry.tone) ? ' mm-lens-badge--off' : ''}`}
                            aria-pressed={tones.has(entry.tone)}
                            title={tones.has(entry.tone) ? 'Show all again' : `Show only ${entry.label}`}
                            onClick={() => toggleTone(entry.tone)}
                        >{entry.label}</button>
                    ))}
                    <span className="mm-legend__note">{noMatches ? (tones.size > 0 ? 'Nothing matches those' : lens === 'priority' ? 'No ideas have a priority yet' : 'Nothing created in the last 30 days') : tones.size > 0 ? 'Click a chip again to widen' : 'Click a chip to narrow further'}</span>
                </div>
            )}
            <div className="mm-controls" role="group" aria-label="Mind map view">
                <button className="mm-ctrl-btn neobrutal-button" type="button" onClick={() => zoomBy(1 / 1.2)} title="Zoom out (-)" aria-label="Zoom out">−</button>
                <span className="mm-ctrl-zoom" aria-live="polite">{Math.round(view.zoom * 100)}%</span>
                <button className="mm-ctrl-btn neobrutal-button" type="button" onClick={() => zoomBy(1.2)} title="Zoom in (+)" aria-label="Zoom in">+</button>
                <button className="mm-ctrl-btn mm-ctrl-btn--wide neobrutal-button" type="button" onClick={centerOnCurrent} title="Center on the current idea (0)">Center</button>
                <button className="mm-ctrl-btn mm-ctrl-btn--wide neobrutal-button" type="button" onClick={fitToView} title="Zoom out to fit everything drawn">Fit</button>
                <span className="mm-ctrl-sep" aria-hidden="true" />
                <button className="mm-ctrl-btn mm-ctrl-btn--wide neobrutal-button" type="button" aria-pressed={lens === 'priority'} onClick={() => toggleLens('priority')} title="Highlight ideas by priority (P)">Priority</button>
                <button className="mm-ctrl-btn mm-ctrl-btn--wide neobrutal-button" type="button" aria-pressed={lens === 'recent'} onClick={() => toggleLens('recent')} title="Highlight the newest ideas, by when they were created (N)">Newest</button>
                <span className="mm-ctrl-sep" aria-hidden="true" />
                <button className="mm-ctrl-btn mm-ctrl-btn--wide mm-ctrl-btn--close neobrutal-button" type="button" onClick={onClose} title="Close the map (G or Esc)">Close</button>
            </div>
        </div>
    );
}

export default MindMap;
