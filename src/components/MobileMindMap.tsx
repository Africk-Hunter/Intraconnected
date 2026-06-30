import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useIdeaContext } from '../context/IdeaContext';
import {
    IdeaType,
    ChecklistItem,
    fetchFullIdeaList,
    appendToLocalStorageFromFrontend,
    addIdeaToFirebase,
    updateIdeaName,
    updateIdeaNameInFirebase,
    updateIdeaLink,
    updateIdeaLinkInFirebase,
    updateIdeaParentId,
    updateIdeaPriority,
    schedulePriorityFirebaseWrite,
    updateChecklistItems,
    scheduleChecklistFirebaseWrite,
    handleChecklistCreation,
    recursivelyDeleteChildren,
    cleanLink,
    signUserOut,
    getIdeaLink,
    sortIdeas,
} from '../utilities';
import MobileHelpSheet from './MobileHelpSheet';
import MobileMoveSheet from './MobileMoveSheet';
import MobileMindMapSheet from './MobileMindMapSheet';
import MobilePatchNotesSheet from './MobilePatchNotesSheet';
import changelog from '../CHANGELOG.md?raw';
import { parseChangelog } from '../utilities/parseChangelog';
import { isPatchNotesNew, markPatchNotesSeen, syncPatchNotesFromFirebase } from '../utilities/patchNotesState';
import { auth } from '../firebaseConfig';

const _changelogEntries = parseChangelog(changelog);

const lastPointer = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', (e) => {
        lastPointer.x = e.clientX;
        lastPointer.y = e.clientY;
    }, { passive: true });
}

type SheetState =
    | { type: 'rename'; nodeId: number; isNew?: boolean }
    | { type: 'edit'; nodeId: number }
    | { type: 'move'; nodeId: number }
    | { type: 'link'; nodeId: number }
    | { type: 'confirmDelete'; nodeId: number }
    | { type: 'checklist'; nodeId: number };

const SWIPE_REVEAL_W = 160;
const SWIPE_THRESHOLD = 55;

interface SortableMobileItemProps {
    item: ChecklistItem;
    nodeId: number;
    onToggle: (id: string, nodeId: number) => void;
    onDelete: (id: string, nodeId: number) => void;
    onEdit: (id: string, newText: string, nodeId: number) => void;
    onLinkChange: (id: string, link: string, nodeId: number) => void;
}

function SortableMobileChecklistItem({ item, nodeId, onToggle, onDelete, onEdit, onLinkChange }: SortableMobileItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const [isEditing, setIsEditing] = useState(false);
    const [editDraft, setEditDraft] = useState('');
    const editInputRef = useRef<HTMLTextAreaElement>(null);
    const [isLinking, setIsLinking] = useState(false);
    const [linkDraft, setLinkDraft] = useState('');
    const linkInputRef = useRef<HTMLInputElement>(null);
    const cancelLinkRef = useRef(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
        zIndex: isDragging ? 1 : undefined,
        position: isDragging ? 'relative' as const : undefined,
    };

    useLayoutEffect(() => {
        if (!isEditing) return;
        const el = editInputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
        el.focus();
    }, [isEditing]);

    useLayoutEffect(() => {
        if (!isLinking) return;
        linkInputRef.current?.focus();
    }, [isLinking]);

    function startEdit() {
        setEditDraft(item.text);
        setIsEditing(true);
    }

    function commitEdit() {
        const text = editDraft.trim();
        if (text && text !== item.text) onEdit(item.id, text, nodeId);
        setIsEditing(false);
    }

    function openLink() {
        setLinkDraft(item.link ?? '');
        setIsLinking(true);
    }

    function commitLink() {
        if (cancelLinkRef.current) { cancelLinkRef.current = false; return; }
        const url = linkDraft.trim() ? cleanLink(linkDraft.trim()) : '';
        if (url !== (item.link ?? '')) onLinkChange(item.id, url, nodeId);
        setIsLinking(false);
    }

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`mmobile-checklist-sheet-item${item.checked ? ' mmobile-checklist-sheet-item--checked' : ''}`}
        >
            <button className="mmobile-checklist-sheet-drag" {...attributes} {...listeners} aria-label="Drag to reorder">
                <img src="/images/DragHandle.svg" alt="" />
            </button>
            <button className="mmobile-checklist-sheet-cb" onClick={() => onToggle(item.id, nodeId)} />
            {isEditing ? (
                <textarea
                    ref={editInputRef}
                    className="mmobile-checklist-sheet-edit-input"
                    value={editDraft}
                    rows={1}
                    onChange={e => {
                        setEditDraft(e.target.value);
                        const el = e.target;
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                    }}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') setIsEditing(false); }}
                    maxLength={200}
                />
            ) : (
                item.link ? (
                    <a href={item.link} target="_blank" rel="noreferrer" className="mmobile-checklist-sheet-text mmobile-checklist-sheet-text--linked">
                        {item.text}
                    </a>
                ) : (
                    <span className="mmobile-checklist-sheet-text">{item.text}</span>
                )
            )}
            {!isEditing && (
                <>
                    <button
                        className={`mmobile-checklist-sheet-link${item.link ? ' mmobile-checklist-sheet-link--active' : ''}`}
                        onClick={() => isLinking ? setIsLinking(false) : openLink()}
                        title={item.link ? 'Edit link' : 'Add link'}
                    >
                        <img src="/images/LinkBlack.svg" alt="Link" />
                    </button>
                    <button className="mmobile-checklist-sheet-edit" onClick={startEdit}>
                        <img src="/images/Pen.svg" alt="Edit" />
                    </button>
                </>
            )}
            <button className="mmobile-checklist-sheet-del" onClick={() => onDelete(item.id, nodeId)}>
                <img src="/images/Trash.svg" alt="Delete" />
            </button>
            {isLinking && (
                <div className="mmobile-checklist-sheet-item-link-row">
                    <input
                        ref={linkInputRef}
                        className="mmobile-checklist-sheet-item-link-input"
                        value={linkDraft}
                        onChange={e => setLinkDraft(e.target.value)}
                        onBlur={commitLink}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitLink(); }
                            if (e.key === 'Escape') { cancelLinkRef.current = true; setIsLinking(false); }
                        }}
                        placeholder="Paste URL, press Enter"
                        maxLength={500}
                    />
                    {item.link && (
                        <button
                            className="mmobile-checklist-sheet-item-link-clear"
                            onMouseDown={e => { e.preventDefault(); onLinkChange(item.id, '', nodeId); setIsLinking(false); }}
                            title="Remove link"
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}
        </li>
    );
}

function MobileMindMap() {
    const { setNewIdeaSwitch, newIdeaSwitch } = useIdeaContext();

    const [currentId, setCurrentId] = useState(1);
    const [sortMode, setSortMode] = useState<'priority' | 'recent'>(() =>
        (localStorage.getItem('idea_sort_mode') as 'priority' | 'recent') ?? 'priority'
    );
    const [sheet, setSheet] = useState<SheetState | null>(null);
    const [draft, setDraft] = useState('');
    const [swipeRevealedId, setSwipeRevealedId] = useState<number | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const [showPatchNotes, setShowPatchNotes] = useState(false);
    const [showMindMap, setShowMindMap] = useState(false);
    const [animatingRibbonId, setAnimatingRibbonId] = useState<number | null>(null);
    const frozenOrderRef = useRef<number[] | null>(null);
    const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isNewPatchNotes, setIsNewPatchNotes] = useState(() =>
        isPatchNotesNew(auth.currentUser?.uid, _changelogEntries)
    );
    const [expandedChecklists, setExpandedChecklists] = useState<Set<number>>(new Set());
    const [inlineDrafts, setInlineDrafts] = useState<Record<number, string>>({});
    const [sheetItems, setSheetItems] = useState<ChecklistItem[]>([]);
    const [sheetItemDraft, setSheetItemDraft] = useState('');
    const [createTab, setCreateTab] = useState<'idea' | 'checklist'>('idea');
    const [checklistTitle, setChecklistTitle] = useState('');
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [checklistItemDraft, setChecklistItemDraft] = useState('');
    const [newIdeaLink, setNewIdeaLink] = useState('');
    const [editLinkDraft, setEditLinkDraft] = useState('');
    const [newIdeaPriority, setNewIdeaPriority] = useState<1 | 2 | 3 | undefined>(undefined);
    const [headerDraft, setHeaderDraft] = useState('');
    const [sheetOrigin, setSheetOrigin] = useState({ dx: 0, dy: 0 });
    const [helpOrigin, setHelpOrigin] = useState({ dx: 0, dy: 0 });
    const [mindMapOrigin, setMindMapOrigin] = useState({ dx: 0, dy: 0 });
    const [keyboardInset, setKeyboardInset] = useState(0);

    // Drag-and-drop
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isDroppingAnim, setIsDroppingAnim] = useState(false);
    const [dragNodeId, setDragNodeId] = useState<number | null>(null);
    const [pressingNodeId, setPressingNodeId] = useState<number | null>(null);
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const dragPosRef = useRef({ x: 0, y: 0 });
    const _dropTargetId = useRef<number | null>(null);
    const [dropTargetId, _setDropTargetId] = useState<number | null>(null);
    const parentZoneRef = useRef<HTMLDivElement | null>(null);
    function setDropTargetId(id: number | null) { _dropTargetId.current = id; _setDropTargetId(id); }
    const edgeScrollDirRef = useRef<'up' | 'down' | null>(null);
    const edgeZoneEnterTimeRef = useRef<number | null>(null);
    const edgeScrollRafRef = useRef<number | null>(null);

    const headerTextareaRef = useRef<HTMLTextAreaElement>(null);
    const headerDivRef = useRef<HTMLDivElement | null>(null);
    const fabAreaRef = useRef<HTMLDivElement | null>(null);
    const sheetWasNullRef = useRef(true);
    const mobileListRef = useRef<HTMLDivElement>(null);
    const mobileFlipSnapshot = useRef<Map<number, number>>(new Map());
    const mobilePrevFlipIds = useRef<number[]>([]);

    // Swipe-to-reveal tracking
    const nodeElRefs = useRef<Record<number, HTMLElement | null>>({});
    const swipeActionsElRefs = useRef<Record<number, HTMLElement | null>>({});
    const swipeStartRef = useRef<{ x: number; y: number; nodeId: number } | null>(null);
    const swipeDirRef = useRef<'h' | 'v' | null>(null);

    const sheetSensors = useSensors(useSensor(PointerSensor));

    function handleSheetDragEnd(event: DragEndEvent, nodeId: number) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = sheetItems.findIndex(i => i.id === active.id);
        const newIndex = sheetItems.findIndex(i => i.id === over.id);
        const newItems = arrayMove(sheetItems, oldIndex, newIndex);
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
        scheduleChecklistFirebaseWrite(nodeId, newItems);
    }

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        syncPatchNotesFromFirebase(uid, _changelogEntries).then(isNew => setIsNewPatchNotes(isNew));
    }, []);

    useEffect(() => {
        const isOpen = sheet !== null;
        if (isOpen && sheetWasNullRef.current) {
            setSheetOrigin({
                dx: lastPointer.x - window.innerWidth / 2,
                dy: lastPointer.y - (window.innerHeight - 10),
            });
        }
        sheetWasNullRef.current = !isOpen;
    }, [sheet]);

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv || !sheet) { setKeyboardInset(0); return; }
        function update() {
            setKeyboardInset(Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop));
        }
        update();
        vv.addEventListener('resize', update);
        return () => { vv.removeEventListener('resize', update); setKeyboardInset(0); };
    }, [sheet]);

    useEffect(() => {
        const idea = fetchFullIdeaList().find(i => i.id === currentId);
        setHeaderDraft(idea?.content ?? 'Ideas');
    }, [currentId]);

    useLayoutEffect(() => {
        const el = headerTextareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }, [headerDraft]);

    useEffect(() => {
        if (!isDragging) return;
        const prevent = (e: TouchEvent) => e.preventDefault();
        document.addEventListener('touchmove', prevent, { passive: false });
        return () => document.removeEventListener('touchmove', prevent);
    }, [isDragging]);

    // Prevent iOS scroll-recognizer confusion when swipes originate outside the list.
    // touch-action: manipulation alone isn't enough on all iOS versions; a non-passive
    // touchmove handler with preventDefault() is the reliable guarantee.
    useEffect(() => {
        const prevent = (e: TouchEvent) => e.preventDefault();
        const preventOutsideTextarea = (e: TouchEvent) => {
            if (e.target !== headerTextareaRef.current) e.preventDefault();
        };
        const fab = fabAreaRef.current;
        const hdr = headerDivRef.current;
        fab?.addEventListener('touchmove', prevent, { passive: false });
        hdr?.addEventListener('touchmove', preventOutsideTextarea, { passive: false });
        return () => {
            fab?.removeEventListener('touchmove', prevent);
            hdr?.removeEventListener('touchmove', preventOutsideTextarea);
        };
    }, []);

    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressActive = useRef(false);
    const touchMoved = useRef(false);
    const lastLongPressTime = useRef(0);

    const allIdeas: IdeaType[] = fetchFullIdeaList();
    const currentIdea = allIdeas.find(i => i.id === currentId);
    const naturalChildren = sortIdeas(allIdeas.filter(i => i.parentID === currentId), sortMode);
    const children = frozenOrderRef.current
        ? [...naturalChildren].sort((a, b) => {
            const ai = frozenOrderRef.current!.indexOf(a.id);
            const bi = frozenOrderRef.current!.indexOf(b.id);
            return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
        })
        : naturalChildren;

    function captureMobileSnapshot() {
        if (!mobileListRef.current) return;
        const nodes = mobileListRef.current.querySelectorAll<HTMLElement>('[data-flip-id]');
        const snap = new Map<number, number>();
        const ids: number[] = [];
        nodes.forEach(el => {
            const flipId = Number(el.dataset.flipId);
            snap.set(flipId, el.getBoundingClientRect().top);
            ids.push(flipId);
        });
        mobileFlipSnapshot.current = snap;
        mobilePrevFlipIds.current = ids;
    }

    useEffect(() => {
        if (!mobileListRef.current) return;
        const hasActiveFlip = Array.from(
            mobileListRef.current.querySelectorAll<HTMLElement>('[data-flip-id]')
        ).some(el => el.style.transform !== '');
        if (hasActiveFlip) return;
        captureMobileSnapshot();
    }, [sortMode, currentId, newIdeaSwitch]);

    useLayoutEffect(() => {
        if (!mobileListRef.current || mobileFlipSnapshot.current.size === 0) return;
        const prevSet = new Set(mobilePrevFlipIds.current);

        const nodes = mobileListRef.current.querySelectorAll<HTMLElement>('[data-flip-id]');
        const nextSnap = new Map<number, number>();
        const nextIds: number[] = [];
        nodes.forEach(el => {
            const flipId = Number(el.dataset.flipId);
            nextSnap.set(flipId, el.getBoundingClientRect().top);
            nextIds.push(flipId);
        });

        const hasCommon = nextIds.some(id => prevSet.has(id));
        if (!hasCommon) {
            mobileFlipSnapshot.current = nextSnap;
            mobilePrevFlipIds.current = nextIds;
            return;
        }

        const toAnimate: HTMLElement[] = [];
        nodes.forEach(el => {
            const flipId = Number(el.dataset.flipId);
            if (!prevSet.has(flipId)) return;
            const prevTop = mobileFlipSnapshot.current.get(flipId);
            const currTop = nextSnap.get(flipId);
            if (prevTop === undefined || currTop === undefined) return;
            const dy = prevTop - currTop;
            if (Math.abs(dy) > 0.5) {
                el.style.transform = `translateY(${dy}px)`;
                el.style.transition = 'none';
                toAnimate.push(el);
            }
        });

        mobileFlipSnapshot.current = nextSnap;
        mobilePrevFlipIds.current = nextIds;

        if (toAnimate.length === 0) return;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toAnimate.forEach(el => {
                    el.style.transition = 'transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                    el.style.transform = '';
                });
                setTimeout(() => {
                    toAnimate.forEach(el => { el.style.transition = ''; });
                }, 420);
            });
        });
    }, [sortMode, currentId, newIdeaSwitch]);

    function toggleSortMode() {
        const next = sortMode === 'priority' ? 'recent' : 'priority';
        setSortMode(next);
        localStorage.setItem('idea_sort_mode', next);
    }

    function cyclePriority(id: number, current: 1 | 2 | 3 | undefined) {
        const next = current === undefined ? 3 : current === 3 ? 2 : current === 2 ? 1 : undefined;
        updateIdeaPriority(id, next);
        schedulePriorityFirebaseWrite(id, next);
        setAnimatingRibbonId(id);
        setTimeout(() => setAnimatingRibbonId(null), 200);
        if (!frozenOrderRef.current) {
            frozenOrderRef.current = naturalChildren.map(c => c.id);
        }
        if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
        reorderTimerRef.current = setTimeout(() => {
            reorderTimerRef.current = null;
            frozenOrderRef.current = null;
            setNewIdeaSwitch(prev => !prev);
        }, 1500);
    }

    function resetSwipeNode(nodeId: number) {
        const el = nodeElRefs.current[nodeId];
        if (el) { el.style.transition = 'transform 0.2s ease'; el.style.transform = ''; }
        const actionsEl = swipeActionsElRefs.current[nodeId];
        if (actionsEl) { actionsEl.style.opacity = ''; actionsEl.style.pointerEvents = ''; }
        setSwipeRevealedId(null);
    }

    function endPress() {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        setPressingNodeId(null);
    }

    function startPress(nodeId?: number) {
        longPressActive.current = false;
        touchMoved.current = false;
        if (pressTimer.current) clearTimeout(pressTimer.current);
        if (nodeId !== undefined) setPressingNodeId(nodeId);
        pressTimer.current = setTimeout(() => {
            longPressActive.current = true;
            lastLongPressTime.current = Date.now();
            if (nodeId !== undefined) {
                setPressingNodeId(null);
                navigator.vibrate?.(25);
                const el = nodeElRefs.current[nodeId];
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const initialPos = { x: rect.left + rect.width / 2, y: rect.top + 40 };
                    dragPosRef.current = initialPos;
                    setDragPos(initialPos);
                    resetSwipeNode(nodeId);
                }
                isDraggingRef.current = true;
                setIsDragging(true);
                setDragNodeId(nodeId);
            }
        }, 360);
    }

    function stopEdgeScroll() {
        if (edgeScrollRafRef.current !== null) {
            cancelAnimationFrame(edgeScrollRafRef.current);
            edgeScrollRafRef.current = null;
        }
        edgeScrollDirRef.current = null;
        edgeZoneEnterTimeRef.current = null;
    }

    function startEdgeScroll(dir: 'up' | 'down', draggingId: number) {
        if (edgeScrollRafRef.current !== null) return;
        function tick() {
            if (!isDraggingRef.current || edgeScrollDirRef.current !== dir) {
                edgeScrollRafRef.current = null;
                return;
            }
            if (mobileListRef.current) {
                mobileListRef.current.scrollTop += dir === 'down' ? 4 : -4;
            }
            updateDropTarget(dragPosRef.current.x, dragPosRef.current.y, draggingId);
            edgeScrollRafRef.current = requestAnimationFrame(tick);
        }
        edgeScrollRafRef.current = requestAnimationFrame(tick);
    }

    function clearDrag() {
        isDraggingRef.current = false;
        setIsDragging(false);
        setDragNodeId(null);
        setDropTargetId(null);
        stopEdgeScroll();
    }

    function updateDropTarget(x: number, y: number, draggingId: number) {
        if (parentZoneRef.current) {
            const r = parentZoneRef.current.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                if (_dropTargetId.current !== -1) setDropTargetId(-1);
                return;
            }
        }
        for (const child of children) {
            if (child.id === draggingId) continue;
            if (child.type === 'checklist') continue;
            if (getIdeaLink(child)) continue;
            const el = nodeElRefs.current[child.id];
            if (!el) continue;
            const r = el.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                if (_dropTargetId.current !== child.id) setDropTargetId(child.id);
                return;
            }
        }
        if (_dropTargetId.current !== null) setDropTargetId(null);
    }

    function handleNodeTouchStart(e: React.TouchEvent, nodeId: number) {
        const t = e.touches[0];
        swipeStartRef.current = { x: t.clientX, y: t.clientY, nodeId };
        swipeDirRef.current = null;
        startPress(nodeId);
    }

    function handleNodeTouchMove(e: React.TouchEvent, nodeId: number) {
        if (!swipeStartRef.current || swipeStartRef.current.nodeId !== nodeId) return;
        const t = e.touches[0];
        const dx = t.clientX - swipeStartRef.current.x;
        const dy = t.clientY - swipeStartRef.current.y;

        // Long press has fired — this is a drag, not a swipe
        if (longPressActive.current) {
            touchMoved.current = true;
            if (!isDraggingRef.current) {
                isDraggingRef.current = true;
                setIsDragging(true);
                setDragNodeId(nodeId);
                if (swipeRevealedId === nodeId) resetSwipeNode(nodeId);
            }
            dragPosRef.current = { x: t.clientX, y: t.clientY };
            setDragPos({ x: t.clientX, y: t.clientY });
            updateDropTarget(t.clientX, t.clientY, nodeId);

            const listEl = mobileListRef.current;
            if (listEl) {
                const rect = listEl.getBoundingClientRect();
                const inTop = t.clientY < rect.top + 80;
                const inBottom = t.clientY > rect.bottom - 80;
                const dir: 'up' | 'down' | null = inTop ? 'up' : inBottom ? 'down' : null;
                if (dir !== edgeScrollDirRef.current) {
                    stopEdgeScroll();
                    if (dir) {
                        edgeScrollDirRef.current = dir;
                        edgeZoneEnterTimeRef.current = Date.now();
                    }
                } else if (dir && edgeZoneEnterTimeRef.current !== null) {
                    if (Date.now() - edgeZoneEnterTimeRef.current >= 250) {
                        startEdgeScroll(dir, nodeId);
                    }
                }
            }
            return;
        }

        if (!swipeDirRef.current) {
            if (Math.abs(dx) > 7 || Math.abs(dy) > 7) {
                swipeDirRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
            }
            return;
        }

        if (swipeDirRef.current === 'v') {
            endPress();
            touchMoved.current = true;
            return;
        }

        if (swipeDirRef.current === 'h') {
            endPress();
            touchMoved.current = true;
            const base = swipeRevealedId === nodeId ? -SWIPE_REVEAL_W : 0;
            const offset = Math.min(0, Math.max(base + dx, -SWIPE_REVEAL_W));
            const el = nodeElRefs.current[nodeId];
            if (el) {
                el.style.transition = 'none';
                el.style.transform = offset !== 0 ? `translateX(${offset}px)` : '';
            }
            const actionsEl = swipeActionsElRefs.current[nodeId];
            if (actionsEl) {
                actionsEl.style.opacity = offset !== 0 ? '1' : '';
                actionsEl.style.pointerEvents = offset !== 0 ? 'auto' : '';
            }
        }
    }

    function handleNodeTouchEnd(e: React.TouchEvent, nodeId: number) {
        if (isDraggingRef.current) {
            const target = _dropTargetId.current;
            if (target === -1 && currentIdea?.parentID) {
                doMove(nodeId, currentIdea.parentID);
            } else if (target !== null && target > 0) {
                doMove(nodeId, target);
            }
            // stop logic immediately, but let the ghost play its landing animation
            isDraggingRef.current = false;
            stopEdgeScroll();
            setDropTargetId(null);
            setIsDroppingAnim(true);
            setTimeout(() => {
                setIsDragging(false);
                setDragNodeId(null);
                setIsDroppingAnim(false);
            }, 180);
            swipeStartRef.current = null;
            swipeDirRef.current = null;
            endPress();
            return;
        }

        if (swipeDirRef.current === 'h') {
            const el = nodeElRefs.current[nodeId];
            if (el) {
                el.style.transition = 'transform 0.2s ease';
                const m = el.style.transform.match(/translateX\(([^)]+)px\)/);
                const cur = m ? parseFloat(m[1]) : 0;
                if (cur < -SWIPE_THRESHOLD) {
                    el.style.transform = `translateX(${-SWIPE_REVEAL_W}px)`;
                    // close any previously revealed node
                    if (swipeRevealedId !== null && swipeRevealedId !== nodeId) {
                        const prev = nodeElRefs.current[swipeRevealedId];
                        if (prev) { prev.style.transition = 'transform 0.2s ease'; prev.style.transform = ''; }
                        const prevActions = swipeActionsElRefs.current[swipeRevealedId];
                        if (prevActions) { prevActions.style.opacity = ''; prevActions.style.pointerEvents = ''; }
                    }
                    setSwipeRevealedId(nodeId);
                } else {
                    el.style.transform = '';
                    if (swipeRevealedId === nodeId) setSwipeRevealedId(null);
                    const actionsEl = swipeActionsElRefs.current[nodeId];
                    if (actionsEl) { actionsEl.style.opacity = ''; actionsEl.style.pointerEvents = ''; }
                }
            }
        } else {
            if (!touchMoved.current) { e.preventDefault(); tapNode(nodeId); }
        }
        swipeStartRef.current = null;
        swipeDirRef.current = null;
        endPress();
    }

    function getBreadcrumbs(): IdeaType[] {
        const path: IdeaType[] = [];
        let id = currentId;
        const visited = new Set<number>();
        while (id && !visited.has(id)) {
            visited.add(id);
            const idea = allIdeas.find(i => i.id === id);
            if (!idea) break;
            path.unshift(idea);
            if (!idea.parentID) break;
            id = idea.parentID;
        }
        return path;
    }

    const breadcrumbs = getBreadcrumbs();
    const canGoBack = !!(currentIdea?.parentID);

    function closeSheet() {
        setSheet(null);
        setNewIdeaLink('');
        setEditLinkDraft('');
        setNewIdeaPriority(undefined);
    }

    function tapNode(nodeId: number) {
        endPress();
        if (longPressActive.current) { longPressActive.current = false; return; }
        if (Date.now() - lastLongPressTime.current < 400) return;

        // Tapping while another node is revealed just closes the reveal
        if (swipeRevealedId !== null && swipeRevealedId !== nodeId) {
            resetSwipeNode(swipeRevealedId);
            return;
        }

        const node = allIdeas.find(i => i.id === nodeId);
        if (node?.type === 'checklist') {
            setExpandedChecklists(prev => {
                const next = new Set(prev);
                if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
                return next;
            });
            return;
        }
        const nodeLink = getIdeaLink(node);
        if (nodeLink) {
            window.open(nodeLink, '_blank', 'noopener,noreferrer');
            return;
        }
        setCurrentId(nodeId);
        setSheet(null);
    }

    function openChecklistSheet(nodeId: number) {
        const fresh = fetchFullIdeaList().find((i: IdeaType) => i.id === nodeId);
        setSheetItems(fresh?.type === 'checklist' ? fresh.items : []);
        setSheetItemDraft('');
        setSheet({ type: 'checklist', nodeId });
    }

    function toggleInlineItem(nodeId: number, itemId: string, currentItems: ChecklistItem[]) {
        const newItems = currentItems.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        updateChecklistItems(nodeId, newItems);
        scheduleChecklistFirebaseWrite(nodeId, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function addInlineItem(nodeId: number, currentItems: ChecklistItem[]) {
        const text = (inlineDrafts[nodeId] ?? '').trim();
        if (!text) return;
        const newItems = [...currentItems, { id: String(Date.now()), text, checked: false }];
        updateChecklistItems(nodeId, newItems);
        scheduleChecklistFirebaseWrite(nodeId, newItems);
        setInlineDrafts(prev => ({ ...prev, [nodeId]: '' }));
        setNewIdeaSwitch(prev => !prev);
    }

    function toggleSheetItem(itemId: string, nodeId: number) {
        const newItems = sheetItems.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
        scheduleChecklistFirebaseWrite(nodeId, newItems);
    }

    function deleteSheetItem(itemId: string, nodeId: number) {
        const newItems = sheetItems.filter(item => item.id !== itemId);
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
        scheduleChecklistFirebaseWrite(nodeId, newItems);
    }

    function editSheetItem(itemId: string, newText: string, nodeId: number) {
        const newItems = sheetItems.map(item =>
            item.id === itemId ? { ...item, text: newText } : item
        );
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
        scheduleChecklistFirebaseWrite(nodeId, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function linkChangeSheetItem(itemId: string, link: string, nodeId: number) {
        const newItems = sheetItems.map(item =>
            item.id === itemId ? { ...item, link: link || undefined } : item
        );
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
        scheduleChecklistFirebaseWrite(nodeId, newItems);
    }

    function addSheetItem(nodeId: number) {
        const text = sheetItemDraft.trim();
        if (!text) return;
        const newItems = [...sheetItems, { id: String(Date.now()), text, checked: false }];
        setSheetItems(newItems);
        setSheetItemDraft('');
        updateChecklistItems(nodeId, newItems);
        scheduleChecklistFirebaseWrite(nodeId, newItems);
    }

    function goBack() {
        if (!currentIdea?.parentID) return;
        setCurrentId(currentIdea.parentID);
        setSheet(null);
    }

    function addChild() {
        setDraft('');
        setCreateTab('idea');
        setChecklistTitle('');
        setChecklistItems([]);
        setChecklistItemDraft('');
        setNewIdeaPriority(undefined);
        setSheet({ type: 'rename', nodeId: -1, isNew: true });
    }

    function addChecklistItem() {
        const text = checklistItemDraft.trim();
        if (!text) return;
        setChecklistItems(prev => [...prev, { id: String(Date.now()), text, checked: false }]);
        setChecklistItemDraft('');
    }

    function removeChecklistItem(itemId: string) {
        setChecklistItems(prev => prev.filter(i => i.id !== itemId));
    }

    function saveHeaderDraft() {
        const trimmed = headerDraft.trim() || 'Untitled';
        const currentIdea = fetchFullIdeaList().find((i: IdeaType) => i.id === currentId);
        if (trimmed === currentIdea?.content) return;
        updateIdeaName(currentId, trimmed);
        updateIdeaNameInFirebase(currentId, trimmed).then(() => {
            setNewIdeaSwitch(prev => !prev);
        });
    }

    function commitRename() {
        if (!sheet || sheet.type !== 'rename') return;

        if (sheet.isNew && createTab === 'checklist') {
            const title = checklistTitle.trim() || 'Untitled';
            handleChecklistCreation(title, currentId, checklistItems, newIdeaPriority);
            setNewIdeaSwitch(prev => !prev);
            closeSheet();
            return;
        }

        const name = draft.trim() || 'Untitled';
        if (sheet.isNew) {
            const newId = Date.now();
            const newIdea: IdeaType = { id: newId, content: name, parentID: currentId, link: cleanLink(newIdeaLink.trim()), ...(newIdeaPriority ? { priority: newIdeaPriority } : {}) };
            appendToLocalStorageFromFrontend(newIdea);
            addIdeaToFirebase(newIdea);
            setNewIdeaSwitch(prev => !prev);
        } else {
            updateIdeaName(sheet.nodeId, name);
            updateIdeaNameInFirebase(sheet.nodeId, name).then(() => {
                setNewIdeaSwitch(prev => !prev);
            });
        }
        closeSheet();
    }

    function deleteNode(nodeId: number) {
        if (currentId === nodeId && currentIdea?.parentID) {
            setCurrentId(currentIdea.parentID);
        }
        recursivelyDeleteChildren(nodeId);
        setNewIdeaSwitch(prev => !prev);
        closeSheet();
    }

    function doMove(nodeId: number, targetId: number) {
        updateIdeaParentId(nodeId, targetId);
        setNewIdeaSwitch(prev => !prev);
        closeSheet();
    }

    function commitLink() {
        if (!sheet || sheet.type !== 'link') return;
        const url = cleanLink(draft.trim());
        updateIdeaLink(sheet.nodeId, url);
        updateIdeaLinkInFirebase(sheet.nodeId, url).then(() => {
            setNewIdeaSwitch(prev => !prev);
        });
        closeSheet();
    }

    function commitEdit() {
        if (!sheet || sheet.type !== 'edit') return;
        const node = allIdeas.find(i => i.id === sheet.nodeId);
        const name = draft.trim() || 'Untitled';
        let changed = false;

        if (name !== node?.content) {
            updateIdeaName(sheet.nodeId, name);
            updateIdeaNameInFirebase(sheet.nodeId, name);
            changed = true;
        }

        if (node?.type !== 'checklist') {
            const url = cleanLink(editLinkDraft.trim());
            if (url !== getIdeaLink(node)) {
                updateIdeaLink(sheet.nodeId, url);
                updateIdeaLinkInFirebase(sheet.nodeId, url);
                changed = true;
            }
        }

        if (changed) setNewIdeaSwitch(prev => !prev);
        closeSheet();
    }

    const sheetNode = sheet ? allIdeas.find(i => i.id === sheet.nodeId) : null;
    const sheetNodeLink = getIdeaLink(sheetNode ?? undefined);
    const sheetTitle =
        sheet?.type === 'move' ? 'Move under…' :
        sheet?.type === 'rename' ? (sheet.isNew ? (createTab === 'checklist' ? 'New checklist' : 'New idea') : sheetNode?.type === 'checklist' ? 'Rename checklist' : allIdeas.some(i => i.parentID === sheetNode?.id) ? 'Rename idea' : 'Rewrite idea') :
        sheet?.type === 'edit' ? (sheetNode?.type === 'checklist' ? 'Edit checklist' : 'Edit idea') :
        sheet?.type === 'link' ? (sheetNodeLink ? 'Change link' : 'Add link') :
        sheet?.type === 'confirmDelete' ? 'Delete idea?' :
        sheet?.type === 'checklist' ? (sheetNode?.content ?? '') : '';

    return (
        <div className="mmobile">
            <div className="mmobile-nav">
                <button className={`mmobile-help${showHelp ? ' mmobile-help--active' : ''}`} onClick={() => {
                    if (!showHelp) setHelpOrigin({ dx: lastPointer.x - window.innerWidth / 2, dy: lastPointer.y - window.innerHeight / 2 });
                    setShowHelp(h => !h);
                }}>
                    <img src="/images/QuestionMark.svg" alt="Help" />
                </button>
                {canGoBack && (
                    <button className="mmobile-back" onClick={goBack}>
                        <img src="/images/ArrowBack.svg" alt="Back" className="mmobile-back-icon" />
                    </button>
                )}
                {currentId === 1 ? (
                    <img src="/images/MainLargerLogo.svg" alt="Intraconnected" className="mmobile-nav-logo" />
                ) : (
                    <div className="mmobile-crumbs">
                        {breadcrumbs.map((idea, i) => (
                            <button
                                key={idea.id}
                                className={`mmobile-crumb${idea.id === currentId ? ' mmobile-crumb--active' : ''}`}
                                onClick={() => { setCurrentId(idea.id); setSheet(null); }}
                            >
                                {i > 0 ? '› ' : ''}{idea.content.split('\n')[0]}
                            </button>
                        ))}
                    </div>
                )}
                <button className="mmobile-logout" onClick={signUserOut}>
                    <img src="/images/LogOut.svg" alt="Sign out" />
                </button>
            </div>

            {showHelp && <MobileHelpSheet onClose={() => setShowHelp(false)} style={{ '--origin-dx': `${helpOrigin.dx}px`, '--origin-dy': `${helpOrigin.dy}px` } as React.CSSProperties} />}
            {showPatchNotes && <MobilePatchNotesSheet onClose={() => setShowPatchNotes(false)} style={{ '--origin-dx': `${helpOrigin.dx}px`, '--origin-dy': `${helpOrigin.dy}px` } as React.CSSProperties} />}
            {showMindMap && (
                <MobileMindMapSheet
                    key={currentId}
                    currentId={currentId}
                    allIdeas={allIdeas}
                    onNavigate={(id) => { setCurrentId(id); setShowMindMap(false); setSheet(null); }}
                    onClose={() => setShowMindMap(false)}
                    style={{ '--origin-dx': `${mindMapOrigin.dx}px`, '--origin-dy': `${mindMapOrigin.dy}px` } as React.CSSProperties}
                />
            )}

            <div
                ref={headerDivRef}
                className="mmobile-header"
                onMouseDown={() => startPress(currentId)}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                onTouchStart={() => startPress(currentId)}
                onTouchEnd={endPress}
            >
                <textarea
                    ref={headerTextareaRef}
                    className="mmobile-header-title"
                    value={headerDraft}
                    rows={1}
                    onChange={e => {
                        setHeaderDraft(e.target.value);
                        const el = e.target;
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                    }}
                    onBlur={saveHeaderDraft}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                />
                <div className="mmobile-header-count">
                    <span>{children.length} {children.length === 1 ? 'idea' : 'ideas'}</span>
                    <button
                        className={`mmobile-sort-btn${sortMode === 'recent' ? ' mmobile-sort-btn--recent' : ''}`}
                        onClick={e => { e.stopPropagation(); toggleSortMode(); }}
                        onMouseDown={e => e.stopPropagation()}
                        onTouchStart={e => e.stopPropagation()}
                    >
                        <img src="/images/sort.svg" alt="" />
                        {sortMode === 'priority' ? 'Priority' : 'Age'}
                    </button>
                </div>
            </div>

            <div className="mmobile-list" ref={mobileListRef}>
                {isDragging && currentIdea?.parentID && (
                    <div
                        ref={el => { parentZoneRef.current = el; }}
                        className={`mmobile-parent-drop-zone${dropTargetId === -1 ? ' mmobile-parent-drop-zone--active' : ''}`}
                    >
                        ↑ Move to parent
                    </div>
                )}
                {children.length === 0 ? (
                    <div className="mmobile-empty">No ideas here yet.<br />Tap + to create one.</div>
                ) : children.map(child => {
                    const hasKids = allIdeas.some(i => i.parentID === child.id);
                    const childLink = getIdeaLink(child);

                    if (child.type === 'checklist') {
                        const isExpanded = expandedChecklists.has(child.id);
                        const items = child.items;
                        const checkedCount = items.filter(i => i.checked).length;
                        return (
                            <div key={child.id} data-flip-id={child.id} className="mmobile-node-wrap">
                                <div className="mmobile-node-swipe-actions" ref={el => { swipeActionsElRefs.current[child.id] = el; }}>
                                    <button
                                        className="mmobile-node-swipe-btn mmobile-node-swipe-btn--rename"
                                        onClick={e => { e.stopPropagation(); resetSwipeNode(child.id); setDraft(child.content); setEditLinkDraft(getIdeaLink(child)); setSheet({ type: 'edit', nodeId: child.id }); }}
                                    >
                                        <img src="/images/Pen.svg" alt="Rename" />
                                    </button>
                                    <button
                                        className="mmobile-node-swipe-btn mmobile-node-swipe-btn--move"
                                        onClick={e => { e.stopPropagation(); resetSwipeNode(child.id); setSheet({ type: 'move', nodeId: child.id }); }}
                                    >
                                        <img src="/images/Move.svg" alt="Move" />
                                    </button>
                                    <button
                                        className="mmobile-node-swipe-btn mmobile-node-swipe-btn--delete"
                                        onClick={e => { e.stopPropagation(); resetSwipeNode(child.id); setSheet({ type: 'confirmDelete', nodeId: child.id }); }}
                                    >
                                        <img src="/images/Trash.svg" alt="Delete" />
                                    </button>
                                </div>
                                <div
                                    ref={el => { nodeElRefs.current[child.id] = el; }}
                                    className={`mmobile-node mmobile-node--checklist${isExpanded ? ' mmobile-node--expanded' : ''}${isDragging && dragNodeId === child.id ? ' mmobile-node--held' : ''}${pressingNodeId === child.id ? ' mmobile-node--pressing' : ''}`}
                                    onMouseDown={() => startPress(child.id)}
                                    onMouseUp={endPress}
                                    onMouseLeave={endPress}
                                    onTouchStart={e => handleNodeTouchStart(e, child.id)}
                                    onTouchMove={e => handleNodeTouchMove(e, child.id)}
                                    onTouchEnd={e => handleNodeTouchEnd(e, child.id)}
                                    onClick={() => tapNode(child.id)}
                                >
                                    <div className="mmobile-node-header-row">
                                        <span className="mmobile-node-title">{child.content}</span>
                                        <button
                                            className={`mmobile-node-priority-ribbon mmobile-node-priority-ribbon--${child.priority ? `p${child.priority}` : 'none'}${animatingRibbonId === child.id ? ' mmobile-node-priority-ribbon--animating' : ''}`}
                                            onClick={e => { e.stopPropagation(); cyclePriority(child.id, child.priority); }}
                                            onTouchEnd={e => e.stopPropagation()}
                                            onMouseDown={e => e.stopPropagation()}
                                        />
                                        <span className="mmobile-node-count">{checkedCount}/{items.length}</span>
                                        <button
                                            className="mmobile-checklist-open-btn"
                                            onClick={e => { e.stopPropagation(); openChecklistSheet(child.id); }}
                                            onTouchEnd={e => e.stopPropagation()}
                                            onMouseDown={e => e.stopPropagation()}
                                        >
                                            <img src="/images/OpenIconSkinny.svg" alt="Open full view" />
                                        </button>
                                        <span className="mmobile-node-arrow">{isExpanded ? '▾' : '▸'}</span>
                                    </div>
                                    {isExpanded && (
                                        <div
                                            className="mmobile-checklist-inline"
                                            onClick={e => e.stopPropagation()}
                                            onTouchStart={e => e.stopPropagation()}
                                            onTouchEnd={e => e.stopPropagation()}
                                            onMouseDown={e => e.stopPropagation()}
                                            onMouseUp={e => e.stopPropagation()}
                                        >
                                            <ul className="mmobile-checklist-inline-items">
                                                {items.map(item => (
                                                    <li
                                                        key={item.id}
                                                        className={`mmobile-checklist-inline-item${item.checked ? ' mmobile-checklist-inline-item--checked' : ''}`}
                                                        onClick={e => { e.stopPropagation(); toggleInlineItem(child.id, item.id, items); }}
                                                    >
                                                        <span className="mmobile-checklist-inline-cb" />
                                                        {item.link ? (
                                                            <a href={item.link} target="_blank" rel="noreferrer" className="mmobile-checklist-inline-text mmobile-checklist-inline-text--linked" onClick={e => e.stopPropagation()}>
                                                                {item.text}
                                                            </a>
                                                        ) : (
                                                            <span className="mmobile-checklist-inline-text">{item.text}</span>
                                                        )}
                                                    </li>
                                                ))}
                                                {items.length === 0 && (
                                                    <li className="mmobile-checklist-inline-empty">No items yet</li>
                                                )}
                                            </ul>
                                            <input
                                                className="mmobile-checklist-inline-input"
                                                placeholder="+ Add item"
                                                value={inlineDrafts[child.id] ?? ''}
                                                onChange={e => setInlineDrafts(prev => ({ ...prev, [child.id]: e.target.value }))}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.stopPropagation();
                                                        addInlineItem(child.id, items);
                                                    }
                                                }}
                                                maxLength={200}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }

                    const colorClass = childLink
                        ? 'mmobile-node--link'
                        : hasKids
                        ? 'mmobile-node--parent'
                        : 'mmobile-node--leaf';
                    return (
                        <div key={child.id} data-flip-id={child.id} className="mmobile-node-wrap">
                            <div className="mmobile-node-swipe-actions" ref={el => { swipeActionsElRefs.current[child.id] = el; }}>
                                <button
                                    className="mmobile-node-swipe-btn mmobile-node-swipe-btn--rename"
                                    onClick={e => { e.stopPropagation(); resetSwipeNode(child.id); setDraft(child.content); setEditLinkDraft(getIdeaLink(child)); setSheet({ type: 'edit', nodeId: child.id }); }}
                                >
                                    <img src="/images/Pen.svg" alt="Rename" />
                                </button>
                                <button
                                    className="mmobile-node-swipe-btn mmobile-node-swipe-btn--move"
                                    onClick={e => { e.stopPropagation(); resetSwipeNode(child.id); setSheet({ type: 'move', nodeId: child.id }); }}
                                >
                                    <img src="/images/Move.svg" alt="Move" />
                                </button>
                                <button
                                    className="mmobile-node-swipe-btn mmobile-node-swipe-btn--delete"
                                    onClick={e => { e.stopPropagation(); resetSwipeNode(child.id); setSheet({ type: 'confirmDelete', nodeId: child.id }); }}
                                >
                                    <img src="/images/Trash.svg" alt="Delete" />
                                </button>
                            </div>
                            <div
                                ref={el => { nodeElRefs.current[child.id] = el; }}
                                className={`mmobile-node ${colorClass}${dropTargetId === child.id ? ' mmobile-node--drop-target' : ''}${isDragging && dragNodeId === child.id ? ' mmobile-node--held' : ''}${pressingNodeId === child.id ? ' mmobile-node--pressing' : ''}`}
                                onMouseDown={() => startPress(child.id)}
                                onMouseUp={endPress}
                                onMouseLeave={endPress}
                                onTouchStart={e => handleNodeTouchStart(e, child.id)}
                                onTouchMove={e => handleNodeTouchMove(e, child.id)}
                                onTouchEnd={e => handleNodeTouchEnd(e, child.id)}
                                onClick={() => tapNode(child.id)}
                            >
                                <span className="mmobile-node-title">{child.content}</span>
                                <button
                                    className={`mmobile-node-priority-ribbon mmobile-node-priority-ribbon--${child.priority ? `p${child.priority}` : 'none'}${animatingRibbonId === child.id ? ' mmobile-node-priority-ribbon--animating' : ''}`}
                                    onClick={e => { e.stopPropagation(); cyclePriority(child.id, child.priority); }}
                                    onTouchEnd={e => e.stopPropagation()}
                                    onMouseDown={e => e.stopPropagation()}
                                />
                                <span className="mmobile-node-arrow">›</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div ref={fabAreaRef} className={`mmobile-fab-area${sheet ? ' mmobile-fab-area--hidden' : ''}`}>
                <button
                    className={`mmobile-patchnotes-btn${isNewPatchNotes ? ' mmobile-patchnotes-btn--new' : ''}${showPatchNotes ? ' mmobile-patchnotes-btn--active' : ''}`}
                    onClick={() => {
                        if (!showPatchNotes) {
                            setHelpOrigin({ dx: lastPointer.x - window.innerWidth / 2, dy: lastPointer.y - window.innerHeight / 2 });
                            markPatchNotesSeen(auth.currentUser?.uid, _changelogEntries);
                            setIsNewPatchNotes(false);
                        }
                        setShowPatchNotes(p => !p);
                    }}
                ><img src="/images/PatchNotesIconSkinny.svg" alt="Patch notes" /></button>
                <button
                    className={`mmobile-home-btn${currentId === 1 ? ' mmobile-home-btn--at-root' : ''}`}
                    onClick={currentId === 1 ? undefined : () => { setCurrentId(1); setSheet(null); }}
                ><img src="/images/Home.svg" alt="Home" /></button>
                <button
                    className={`mmobile-fab${sheet?.type === 'rename' && sheet.isNew ? ' mmobile-fab--active' : ''}`}
                    onClick={addChild}
                ><img src="/images/SkinnyPlus.svg" alt="Create" /></button>
                <button
                    className={`mmobile-navigate-btn${showMindMap ? ' mmobile-navigate-btn--active' : ''}`}
                    onClick={() => {
                        if (!showMindMap) setMindMapOrigin({ dx: lastPointer.x - window.innerWidth / 2, dy: lastPointer.y - window.innerHeight / 2 });
                        setShowMindMap(m => !m);
                    }}
                >
                    <img src="/images/MindMapBlack.svg" alt="Navigate" />
                </button>
            </div>

            {isDragging && dragNodeId !== null && (() => {
                const dragNode = allIdeas.find(i => i.id === dragNodeId);
                if (!dragNode) return null;
                const dragLink = getIdeaLink(dragNode);
                const dragColorClass = dragNode.type === 'checklist' ? 'mmobile-node--checklist'
                    : dragLink ? 'mmobile-node--link'
                    : allIdeas.some(i => i.parentID === dragNode.id) ? 'mmobile-node--parent'
                    : 'mmobile-node--leaf';
                return (
                    <div
                        className={`mmobile-drag-ghost mmobile-node ${dragColorClass}${isDroppingAnim ? ' mmobile-drag-ghost--dropping' : ''}`}
                        style={{ top: dragPos.y - 40 } as React.CSSProperties}
                    >
                        <span className="mmobile-node-title">{dragNode.content}</span>
                        <span className="mmobile-node-arrow">›</span>
                    </div>
                );
            })()}

            {sheet && (
                <>
                    <div className="mmobile-scrim" onClick={() => { if (Date.now() - lastLongPressTime.current < 400) return; closeSheet(); }} />
                    <div className="mmobile-sheet" style={{ '--origin-dx': `${sheetOrigin.dx}px`, '--origin-dy': `${sheetOrigin.dy}px`, ...(keyboardInset > 0 ? { bottom: `${keyboardInset + 8}px` } : {}) } as React.CSSProperties}>
                        <div className="mmobile-sheet-title">
                            {sheetTitle}
                            {(sheet.type === 'move' || sheet.type === 'checklist') && (
                                <button className="mmobile-sheet-close" onClick={closeSheet}>✕</button>
                            )}
                        </div>

                        {sheet.type === 'rename' && (
                            <>
                                {sheet.isNew && (
                                    <div className="mmobile-create-tabs">
                                        <button
                                            className={`mmobile-create-tab${createTab === 'idea' ? ' mmobile-create-tab--active' : ''}`}
                                            onClick={() => setCreateTab('idea')}
                                        >
                                            Idea
                                        </button>
                                        <button
                                            className={`mmobile-create-tab${createTab === 'checklist' ? ' mmobile-create-tab--active' : ''}`}
                                            onClick={() => setCreateTab('checklist')}
                                        >
                                            Checklist
                                        </button>
                                    </div>
                                )}

                                {(!sheet.isNew || createTab === 'idea') && (
                                    sheet.isNew ? (
                                        <textarea
                                            autoFocus
                                            className="mmobile-rename-input mmobile-rename-input--grow"
                                            value={draft}
                                            onChange={e => {
                                                setDraft(e.target.value);
                                                const el = e.target;
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                            }}
                                            placeholder="Idea name"
                                            rows={1}
                                        />
                                    ) : (
                                        <textarea
                                            autoFocus
                                            className="mmobile-rename-input mmobile-rename-input--grow"
                                            value={draft}
                                            onChange={e => {
                                                setDraft(e.target.value);
                                                const el = e.target;
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                            }}
                                            onFocus={e => { const el = e.target; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitRename(); } }}
                                            placeholder="Idea name"
                                            maxLength={100}
                                            rows={1}
                                        />
                                    )
                                )}

                                {sheet.isNew && createTab === 'idea' && (
                                    <input
                                        className="mmobile-rename-input mmobile-link-input"
                                        placeholder="Link (optional)"
                                        value={newIdeaLink}
                                        onChange={e => setNewIdeaLink(e.target.value)}
                                        type="url"
                                        maxLength={500}
                                    />
                                )}

                                {sheet.isNew && createTab === 'checklist' && (
                                    <div className="mmobile-sheet-cl-create">
                                        <input
                                            autoFocus
                                            className="mmobile-rename-input"
                                            placeholder="Checklist title"
                                            value={checklistTitle}
                                            onChange={e => setChecklistTitle(e.target.value)}
                                            maxLength={100}
                                        />
                                        {checklistItems.length > 0 && (
                                            <ul className="mmobile-sheet-cl-items">
                                                {checklistItems.map(item => (
                                                    <li key={item.id} className="mmobile-sheet-cl-item">
                                                        <span className="mmobile-sheet-cl-item-text">☐ {item.text}</span>
                                                        <button className="mmobile-sheet-cl-item-del" onClick={() => removeChecklistItem(item.id)}>✕</button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <input
                                            className="mmobile-rename-input"
                                            placeholder="Add item (Enter to add)"
                                            value={checklistItemDraft}
                                            onChange={e => setChecklistItemDraft(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
                                            maxLength={200}
                                        />
                                    </div>
                                )}

                                {sheet.isNew && (
                                    <div className="mmobile-priority-row mmobile-priority-row--create">
                                        <span className="mmobile-priority-label">Priority</span>
                                        <div className="mmobile-priority-btns">
                                            {([1, 2, 3] as const).map(p => (
                                                <button
                                                    key={p}
                                                    className={`mmobile-priority-btn${newIdeaPriority === p ? ' mmobile-priority-btn--active' : ''}`}
                                                    onClick={() => setNewIdeaPriority(prev => prev === p ? undefined : p)}
                                                    type="button"
                                                >
                                                    P{p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button
                                        className="mmobile-sheet-btn mmobile-sheet-btn--save"
                                        onClick={commitRename}
                                        disabled={sheet.isNew && createTab === 'checklist' && !checklistTitle.trim()}
                                    >
                                        {sheet.isNew ? 'Create' : 'Save'}
                                    </button>
                                </div>
                            </>
                        )}

                        {sheet.type === 'link' && (
                            <>
                                <input
                                    autoFocus
                                    className="mmobile-rename-input"
                                    value={draft}
                                    onChange={e => setDraft(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && commitLink()}
                                    placeholder="https://..."
                                    type="url"
                                    maxLength={500}
                                />
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--save" onClick={commitLink}>Save</button>
                                </div>
                            </>
                        )}

                        {sheet.type === 'move' && (
                            <MobileMoveSheet
                                nodeId={sheet.nodeId}
                                allIdeas={allIdeas}
                                onMove={doMove}
                            />
                        )}

                        {sheet.type === 'edit' && (
                            <>
                                <textarea
                                    autoFocus
                                    className="mmobile-rename-input mmobile-rename-input--grow"
                                    value={draft}
                                    onChange={e => {
                                        setDraft(e.target.value);
                                        const el = e.target;
                                        el.style.height = 'auto';
                                        el.style.height = el.scrollHeight + 'px';
                                    }}
                                    onFocus={e => { const el = e.target; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } }}
                                    placeholder="Idea name"
                                    maxLength={100}
                                    rows={1}
                                />
                                {sheetNode?.type !== 'checklist' && !allIdeas.some(i => i.parentID === sheetNode?.id) && (
                                    <input
                                        className="mmobile-rename-input mmobile-link-input"
                                        placeholder="Link (optional)"
                                        value={editLinkDraft}
                                        onChange={e => setEditLinkDraft(e.target.value)}
                                        type="url"
                                        maxLength={500}
                                    />
                                )}
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--save" onClick={commitEdit}>Save</button>
                                </div>
                            </>
                        )}

                        {sheet.type === 'confirmDelete' && (
                            <>
                                <p className="mmobile-confirm-text">
                                    This will permanently delete <strong>{sheetNode?.content}</strong> and all its children.
                                </p>
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--delete" onClick={() => deleteNode(sheet.nodeId)}>Delete</button>
                                </div>
                            </>
                        )}

                        {sheet.type === 'checklist' && (
                            <div className="mmobile-checklist-sheet">
                                <DndContext
                                    sensors={sheetSensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={(e) => handleSheetDragEnd(e, sheet.nodeId)}
                                    modifiers={[restrictToVerticalAxis]}
                                >
                                    <SortableContext items={sheetItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                        <ul className="mmobile-checklist-sheet-items">
                                            {sheetItems.map(item => (
                                                <SortableMobileChecklistItem
                                                    key={item.id}
                                                    item={item}
                                                    nodeId={sheet.nodeId}
                                                    onToggle={toggleSheetItem}
                                                    onDelete={deleteSheetItem}
                                                    onEdit={editSheetItem}
                                                    onLinkChange={linkChangeSheetItem}
                                                />
                                            ))}
                                            {sheetItems.length === 0 && (
                                                <li className="mmobile-checklist-sheet-empty">No items yet.</li>
                                            )}
                                        </ul>
                                    </SortableContext>
                                </DndContext>
                                <div className="mmobile-checklist-sheet-add">
                                    <input
                                        className="mmobile-checklist-sheet-input"
                                        placeholder="Add item…"
                                        value={sheetItemDraft}
                                        onChange={e => setSheetItemDraft(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); addSheetItem(sheet.nodeId); } }}
                                        maxLength={200}
                                    />
                                    <button className="mmobile-checklist-sheet-add-btn" onClick={() => addSheetItem(sheet.nodeId)}>+</button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default MobileMindMap;
