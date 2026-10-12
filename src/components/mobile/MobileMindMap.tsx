import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useIdeaContext } from '../../context/IdeaContext';
import { SheetState, SWIPE_REVEAL_W, SWIPE_THRESHOLD } from './mobileTypes';
import MobileChecklistItemSheet from './MobileChecklistItemSheet';
import { haptic, onKeyboardHeight } from '../../utilities/platform';
import { useShake } from '../../utilities/useShake';
import {
    IdeaType,
    ChecklistItem,
    fetchFullIdeaList,
    handleIdeaCreation,
    updateIdeaName,
    updateIdeaLink,
    updateIdeaNoteTitle,
    isNoteMode,
    resolveIdeaLabel,
    updateIdeaParentId,
    updateIdeaPriority,
    updateChecklistItems,
    handleChecklistCreation,
    handleNoteCreation,
    recursivelyDeleteChildren,
    restoreIdeas,
    cleanLink,
    openIdeaLink,
    getIdeaLink,
    sortIdeas,
    canCreateIdea,
} from '../../utilities';
import MobileHelpSheet from './MobileHelpSheet';
import MobileMoveSheet from './MobileMoveSheet';
import MobileMindMapSheet from './MobileMindMapSheet';
import MobileSearchSheet from './MobileSearchSheet';
import { recordVisit } from '../../utilities/idea/recentVisits';
import type { SearchResult } from '../../utilities/idea/search';
import MobilePatchNotesSheet from './MobilePatchNotesSheet';
import MobileUndoToast, { type UndoToastState } from './MobileUndoToast';
import MobilePriorityPicker from './MobilePriorityPicker';
import { useSheetSwipeDown } from './useSheetSwipeDown';
import MoreDotsIcon from './MoreDotsIcon';
import { LinkOutIcon } from '../Icons';
import changelog from '../../../programmer-docs/CHANGELOG.md?raw';
import { parseChangelog } from '../../utilities/parseChangelog';
import { isPatchNotesNew, markPatchNotesSeen, syncPatchNotesFromFirebase } from '../../utilities/patchNotesState';
import { auth } from '../../firebaseConfig';
import { onSyncRefreshed } from '../../utilities/sync/syncStore';
import { useBackHandler } from '../../utilities/backStack';

const _changelogEntries = parseChangelog(changelog);

// iOS uses ~0.5s for long-press; shorter turns a resting thumb into a hold.
const LONG_PRESS_MS = 500;
// How far the finger must move after the hold before it becomes a drag.
const DRAG_START_PX = 10;

const lastPointer = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', (e) => {
        lastPointer.x = e.clientX;
        lastPointer.y = e.clientY;
    }, { passive: true });
}

// Where the last tap was, relative to the screen's centre: full-screen panels grow out of it.
// Sheets that open with the keyboard up. They hang from the top of the screen
// (like search), so the field being typed in is never pushed off the top.
function isTypingSheet(sheet: SheetState | null): boolean {
    return sheet?.type === 'create' || sheet?.type === 'edit';
}

function pointerOrigin() {
    return { dx: lastPointer.x - window.innerWidth / 2, dy: lastPointer.y - window.innerHeight / 2 };
}


function MobileMindMap() {
    const { setNewIdeaSwitch, newIdeaSwitch, profileModalOpen, setProfileModalOpen, setUpgradeModalOpen, setUpgradeModalReason } = useIdeaContext();

    const [currentId, setCurrentId] = useState(1);

    // Another device's changes were just pulled in (Idea.tsx already
    // re-renders via newIdeaSwitch) — if the idea being viewed was deleted
    // over there, step back to the top level instead of showing a dead view.
    useEffect(() => {
        return onSyncRefreshed(() => {
            if (currentId !== 1 && !fetchFullIdeaList().some((idea) => idea.id === currentId)) {
                setCurrentId(1);
                setSheet(null);
                showToast('That idea was deleted on another device');
            }
        });
    }, [currentId]);

    const [sortMode, setSortMode] = useState<'priority' | 'recent'>(() =>
        (localStorage.getItem('idea_sort_mode') as 'priority' | 'recent') ?? 'priority'
    );
    const [sheet, setSheet] = useState<SheetState | null>(null);
    const [draft, setDraft] = useState('');
    const [swipeRevealedId, setSwipeRevealedId] = useState<number | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const [showPatchNotes, setShowPatchNotes] = useState(false);
    const [showMindMap, setShowMindMap] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showPath, setShowPath] = useState(false);
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
    const [createTab, setCreateTab] = useState<'idea' | 'checklist' | 'note'>('idea');
    const [checklistTitle, setChecklistTitle] = useState('');
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [checklistItemDraft, setChecklistItemDraft] = useState('');
    const checklistItemInputRef = useRef<HTMLInputElement>(null);
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteBody, setNewNoteBody] = useState('');
    const [newIdeaLink, setNewIdeaLink] = useState('');
    const [editLinkDraft, setEditLinkDraft] = useState('');
    const [editBodyDraft, setEditBodyDraft] = useState('');
    const [newIdeaPriority, setNewIdeaPriority] = useState<1 | 2 | 3 | undefined>(undefined);
    const [headerDraft, setHeaderDraft] = useState('');
    const [editingTitle, setEditingTitle] = useState(false);
    const [sheetOrigin, setSheetOrigin] = useState({ dx: 0, dy: 0 });
    const [helpOrigin, setHelpOrigin] = useState({ dx: 0, dy: 0 });
    const [mindMapOrigin, setMindMapOrigin] = useState({ dx: 0, dy: 0 });
    const [searchOrigin, setSearchOrigin] = useState({ dx: 0, dy: 0 });
    // The idea a search just picked: its card is scrolled to and ringed once the level shows.
    // A fresh object per pick, so picking the same idea twice still runs it.
    const [found, setFound] = useState<{ id: number } | null>(null);
    const [keyboardInset, setKeyboardInset] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport?.height ?? window.innerHeight);
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    // Visible height with no keyboard, for telling when one is up (see below).
    const tallestViewport = useRef({ width: window.visualViewport?.width ?? 0, height: window.visualViewport?.height ?? 0 });
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    // Bumped each time Create is tried with the required name empty; the
    // field re-keys on it so the red flash replays on every attempt.
    const [nameFlash, setNameFlash] = useState(0);
    const createNameRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    // Which checklist the full-view sheet is showing, for undo callbacks that
    // run after the sheet may have closed or changed.
    const sheetNodeIdRef = useRef<number | null>(null);

    // Drag-and-drop
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isDroppingAnim, setIsDroppingAnim] = useState(false);
    const [isHolding, setIsHolding] = useState(false);
    const [toast, setToast] = useState<UndoToastState | null>(null);
    const toastKeyRef = useRef(0);
    // The newest change that can still be undone, kept after its toast is gone so a shake can use it.
    const lastUndoRef = useRef<(() => void) | null>(null);
    const [editPriority, setEditPriority] = useState<1 | 2 | 3 | undefined>(undefined);
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

    const mountTimeRef = useRef(Date.now());

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

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        syncPatchNotesFromFirebase(uid, _changelogEntries).then(isNew => setIsNewPatchNotes(isNew));
    }, []);

    useEffect(() => {
        const isOpen = sheet !== null;
        if (isOpen && sheetWasNullRef.current) {
            setSheetOrigin({
                dx: lastPointer.x - window.innerWidth / 2,
                // Typing sheets grow from their top edge, the rest from their bottom
                dy: isTypingSheet(sheet) ? lastPointer.y - 10 : lastPointer.y - (window.innerHeight - 10),
            });
        }
        sheetWasNullRef.current = !isOpen;
        sheetNodeIdRef.current = sheet?.type === 'checklist' ? sheet.nodeId : null;
    }, [sheet]);

    // Mobile overlays (sheet, help, patch notes, mind map, search, profile) are mutually exclusive —
    // opening one closes any others already open.
    useEffect(() => {
        if (sheet !== null) {
            setShowHelp(false);
            setShowPatchNotes(false);
            setShowMindMap(false);
            setShowSearch(false);
            setProfileModalOpen(false);
        }
    }, [sheet, setProfileModalOpen]);

    useEffect(() => {
        if (showHelp) {
            setSheet(null);
            setShowPatchNotes(false);
            setShowMindMap(false);
            setShowSearch(false);
            setProfileModalOpen(false);
        }
    }, [showHelp, setProfileModalOpen]);

    useEffect(() => {
        if (showPatchNotes) {
            setSheet(null);
            setShowHelp(false);
            setShowMindMap(false);
            setShowSearch(false);
            setProfileModalOpen(false);
        }
    }, [showPatchNotes, setProfileModalOpen]);

    useEffect(() => {
        if (showMindMap) {
            setSheet(null);
            setShowHelp(false);
            setShowPatchNotes(false);
            setShowSearch(false);
            setProfileModalOpen(false);
        }
    }, [showMindMap, setProfileModalOpen]);

    useEffect(() => {
        if (showSearch) {
            setSheet(null);
            setShowHelp(false);
            setShowPatchNotes(false);
            setShowMindMap(false);
            setProfileModalOpen(false);
        }
    }, [showSearch, setProfileModalOpen]);

    useEffect(() => {
        if (profileModalOpen) {
            setSheet(null);
            setShowHelp(false);
            setShowPatchNotes(false);
            setShowMindMap(false);
            setShowSearch(false);
        }
    }, [profileModalOpen]);

    useEffect(() => {
        if (!sheet && !showSearch) { setKeyboardInset(0); return; }
        const vv = window.visualViewport;
        // In the app the keyboard can cover the WebView without shrinking any
        // viewport, so the plugin's height counts too, minus whatever the
        // layout did shrink by (or the lift would be applied twice).
        let nativeKeyboard = 0;
        let fullHeight = window.innerHeight;
        function update() {
            if (nativeKeyboard === 0) fullHeight = window.innerHeight;
            const visible = vv?.height ?? window.innerHeight;
            const fromViewport = vv ? window.innerHeight - vv.height - vv.offsetTop : 0;
            const fromNative = nativeKeyboard - (fullHeight - window.innerHeight);
            // A keyboard can't be up with no field focused. iOS sometimes drops it
            // without a final viewport event, which left the sheet floating high.
            const active = document.activeElement;
            const typing = active instanceof HTMLElement
                && (active.isContentEditable || active instanceof HTMLTextAreaElement
                    || (active instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range'].includes(active.type)));
            // Also capped: no keyboard is taller than 60% of the screen.
            const inset = typing || nativeKeyboard > 0
                ? Math.min(Math.max(0, fromViewport, fromNative), window.innerHeight * 0.6)
                : 0;
            // iOS Safari can shrink the layout viewport along with the visual
            // one, leaving `inset` at 0 while the keyboard takes half the
            // screen. So "open" is judged by how far the visible height fell
            // below the tallest seen at this width (the URL bar alone moves
            // it by less than 150px).
            if (vv && vv.width !== tallestViewport.current.width) tallestViewport.current = { width: vv.width, height: 0 };
            tallestViewport.current.height = Math.max(tallestViewport.current.height, visible);
            setKeyboardOpen(inset > 0 || (typing && tallestViewport.current.height - visible > 150));
            setKeyboardInset(inset);
            setViewportHeight(Math.min(visible, window.innerHeight - inset));
        }
        update();
        const stopNative = onKeyboardHeight(height => { nativeKeyboard = height; update(); });
        window.addEventListener('resize', update);
        vv?.addEventListener('resize', update);
        // iOS also pans the visual viewport when the keyboard opens
        vv?.addEventListener('scroll', update);
        // Focus moving between fields (or away) changes the keyboard without a
        // reliable viewport event; measure again once iOS has settled.
        let timers: number[] = [];
        function settle() {
            timers.forEach(clearTimeout);
            timers = [0, 150, 400].map(ms => window.setTimeout(update, ms));
        }
        document.addEventListener('focusin', settle);
        document.addEventListener('focusout', settle);
        return () => {
            timers.forEach(clearTimeout);
            document.removeEventListener('focusin', settle);
            document.removeEventListener('focusout', settle);
            stopNative();
            window.removeEventListener('resize', update);
            vv?.removeEventListener('resize', update);
            vv?.removeEventListener('scroll', update);
            setKeyboardInset(0);
            setKeyboardOpen(false);
        };
    }, [sheet, showSearch]);

    // Once the sheet has moved above the keyboard, bring the field being typed
    // in back into view (the sheet scrolls inside when it is short on room).
    // Done by hand: scrollIntoView ignores the sticky title row (so the field
    // could land under it) and on iOS also scrolls the page itself.
    useEffect(() => {
        if (!keyboardOpen) return;
        const frame = requestAnimationFrame(() => {
            const field = document.activeElement;
            const sheetEl = field instanceof HTMLElement ? field.closest<HTMLElement>('.mmobile-sheet') : null;
            if (!sheetEl || !(field instanceof HTMLElement)) return;
            const sheetRect = sheetEl.getBoundingClientRect();
            const top = (sheetEl.querySelector('.mmobile-sheet-top')?.getBoundingClientRect().bottom ?? sheetRect.top) + 8;
            const bottom = sheetRect.bottom - 8;
            const rect = field.getBoundingClientRect();
            if (rect.top < top) sheetEl.scrollTop -= top - rect.top;
            else if (rect.bottom > bottom) sheetEl.scrollTop += Math.min(rect.bottom - bottom, rect.top - top);
        });
        return () => cancelAnimationFrame(frame);
    }, [keyboardOpen, keyboardInset, viewportHeight]);

    useEffect(() => {
        const idea = fetchFullIdeaList().find(i => i.id === currentId);
        setHeaderDraft(idea ? resolveIdeaLabel(idea) : 'Ideas');
        // The revealed row belonged to the view just left; without this the
        // first tap in the new view is spent closing a reveal that isn't there.
        setSwipeRevealedId(null);
        setShowPath(false);
        setEditingTitle(false);
    }, [currentId]);

    useLayoutEffect(() => {
        const el = headerTextareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }, [headerDraft, editingTitle]);

    useEffect(() => {
        if (!isDragging && !isHolding) return;
        const prevent = (e: TouchEvent) => e.preventDefault();
        document.addEventListener('touchmove', prevent, { passive: false });
        return () => document.removeEventListener('touchmove', prevent);
    }, [isDragging, isHolding]);

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
    const lastTouchRef = useRef({ x: 0, y: 0 });
    const holdPointRef = useRef({ x: 0, y: 0 });
    const longPressActive = useRef(false);
    const touchMoved = useRef(false);
    const lastLongPressTime = useRef(0);
    // A touch that lands while the list is still coasting only stops it (as
    // in native lists); it must not also open the row under the finger.
    const lastScrollTimeRef = useRef(0);
    const touchStoppedScrollRef = useRef(false);

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

    // Holding a row still opens its action menu (the iPhone habit); moving the
    // finger after that lifts the row for dragging instead (handleNodeTouchMove).
    function startPress(nodeId: number) {
        longPressActive.current = false;
        touchMoved.current = false;
        if (pressTimer.current) clearTimeout(pressTimer.current);
        setPressingNodeId(nodeId);
        pressTimer.current = setTimeout(() => {
            setPressingNodeId(null);
            if (Date.now() - mountTimeRef.current < 1000) return;
            longPressActive.current = true;
            lastLongPressTime.current = Date.now();
            holdPointRef.current = { ...lastTouchRef.current };
            // Block scrolling from here on, so a move after the hold is still
            // ours to turn into a drag (touchmove is only cancelable before
            // the browser starts scrolling).
            setIsHolding(true);
            haptic('hold');
            resetSwipeNode(nodeId);
            setSheet({ type: 'actions', nodeId });
        }, LONG_PRESS_MS);
    }

    function finishDrag(nodeId: number, drop: boolean) {
        if (drop) {
            const target = _dropTargetId.current;
            if (target === -1 && currentIdea?.parentID) {
                doMove(nodeId, currentIdea.parentID);
            } else if (target !== null && target > 0) {
                doMove(nodeId, target);
            }
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
            if (isNoteMode(child)) continue;
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
        lastTouchRef.current = { x: t.clientX, y: t.clientY };
        touchStoppedScrollRef.current = Date.now() - lastScrollTimeRef.current < 100;
        startPress(nodeId);
    }

    function handleNodeTouchMove(e: React.TouchEvent, nodeId: number) {
        if (!swipeStartRef.current || swipeStartRef.current.nodeId !== nodeId) return;
        const t = e.touches[0];
        lastTouchRef.current = { x: t.clientX, y: t.clientY };
        const dx = t.clientX - swipeStartRef.current.x;
        const dy = t.clientY - swipeStartRef.current.y;

        // The hold has fired (menu open): moving now turns it into a drag
        if (longPressActive.current) {
            if (!isDraggingRef.current) {
                const hold = holdPointRef.current;
                if (Math.hypot(t.clientX - hold.x, t.clientY - hold.y) < DRAG_START_PX) return;
                closeSheet();
                touchMoved.current = true;
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
        setIsHolding(false);
        if (isDraggingRef.current) {
            finishDrag(nodeId, true);
            longPressActive.current = false;
            swipeStartRef.current = null;
            swipeDirRef.current = null;
            endPress();
            return;
        }

        // Held without moving: the action menu is open; lifting the finger
        // must not also count as a tap on the row (or on the menu's scrim).
        if (longPressActive.current) {
            e.preventDefault();
            longPressActive.current = false;
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
            if (!touchMoved.current) {
                e.preventDefault();
                if (!touchStoppedScrollRef.current) tapNode(nodeId);
            }
        }
        swipeStartRef.current = null;
        swipeDirRef.current = null;
        endPress();
    }

    // The OS took the touch away (an incoming call, a system gesture): undo
    // whatever was half-done instead of leaving a drag or swipe stuck.
    function handleNodeTouchCancel(nodeId: number) {
        setIsHolding(false);
        if (isDraggingRef.current) finishDrag(nodeId, false);
        if (swipeDirRef.current === 'h') resetSwipeNode(nodeId);
        longPressActive.current = false;
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
    const canGoBack = currentId !== 1;
    const parentCrumb = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

    function closeSheet() {
        setSheet(null);
        setConfirmDiscard(false);
        setNewIdeaLink('');
        setEditLinkDraft('');
        setNewIdeaPriority(undefined);
    }

    // Something typed into the open Create/Edit sheet that a stray tap on the
    // scrim (or Back, or a swipe down) would otherwise silently throw away.
    function isSheetDirty(): boolean {
        if (sheet?.type === 'create') {
            return !!(draft.trim() || newIdeaLink.trim() || checklistTitle.trim() || checklistItems.length
                || checklistItemDraft.trim() || newNoteTitle.trim() || newNoteBody.trim());
        }
        if (sheet?.type === 'edit') {
            const node = allIdeas.find(i => i.id === sheet.nodeId);
            if (!node) return false;
            if (editPriority !== node.priority) return true;
            if (node.type !== 'checklist' && node.isNote) {
                return draft !== (node.noteTitle ?? '') || editBodyDraft !== node.content;
            }
            if ((draft.trim() || 'Untitled') !== node.content) return true;
            return node.type !== 'checklist' && cleanLink(editLinkDraft.trim()) !== getIdeaLink(node);
        }
        return false;
    }

    // Close unless that would lose typed text; then ask first. Returns
    // whether it closed. Cancel buttons call closeSheet directly.
    function requestCloseSheet(): boolean {
        if (isSheetDirty()) {
            setConfirmDiscard(true);
            return false;
        }
        closeSheet();
        return true;
    }

    const sheetSwipe = useSheetSwipeDown(requestCloseSheet);

    // The phone's Back button / back gesture: close whatever is open first,
    // otherwise go up one level (see utilities/backStack.ts).
    useBackHandler(canGoBack, goBack);
    useBackHandler(sheet !== null, requestCloseSheet, 1);
    useBackHandler(showHelp, () => setShowHelp(false), 1);
    useBackHandler(showPatchNotes, () => setShowPatchNotes(false), 1);
    useBackHandler(showMindMap, () => setShowMindMap(false), 1);
    useBackHandler(showSearch, () => setShowSearch(false), 1);

    function pickSearchResult(result: SearchResult) {
        recordVisit(result.id);
        setShowSearch(false);
        setSheet(null);
        setCurrentId(result.parentID);
        setFound({ id: result.id });
    }

    // Arriving from search, the picked card may be anywhere in a long level:
    // bring it to the middle and ring it briefly so the eye lands on it.
    useEffect(() => {
        if (found === null) return;
        const frame = requestAnimationFrame(() => {
            const el = nodeElRefs.current[found.id];
            if (!el) return;
            const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
            const ring = (alpha: number, offset: number) => ({ outline: `3px solid rgba(17, 17, 17, ${alpha})`, outlineOffset: `${still ? 3 : offset}px` });
            el.animate(
                [ring(0, 12), { ...ring(1, 3), offset: 0.2 }, { ...ring(1, 3), offset: 0.75 }, ring(0, 3)],
                { duration: 1600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
            );
        });
        return () => cancelAnimationFrame(frame);
    }, [found]);
    useBackHandler(showPath, () => setShowPath(false), 1);
    useBackHandler(profileModalOpen, () => setProfileModalOpen(false), 1);

    function tapNode(nodeId: number) {
        endPress();
        if (longPressActive.current) { longPressActive.current = false; return; }
        if (Date.now() - lastLongPressTime.current < 400) return;

        // Tapping while a node is revealed (that one or another) just closes
        // the reveal, as in iOS lists
        if (swipeRevealedId !== null) {
            resetSwipeNode(swipeRevealedId);
            return;
        }

        const node = allIdeas.find(i => i.id === nodeId);
        if (node?.type === 'checklist') {
            toggleChecklistExpanded(nodeId);
            return;
        }
        // A note has nothing inside it; tapping opens it to read or edit.
        if (node && isNoteMode(node)) { openEditSheet(node); return; }
        const nodeLink = getIdeaLink(node);
        // A link that somehow has children (an import, or a move from an older
        // build) drills in instead, so those children stay reachable.
        if (nodeLink && !allIdeas.some(i => i.parentID === nodeId)) {
            openIdeaLink(nodeLink);
            return;
        }
        setCurrentId(nodeId);
        setSheet(null);
    }

    function toggleChecklistExpanded(nodeId: number) {
        setExpandedChecklists(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
            return next;
        });
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
        setNewIdeaSwitch(prev => !prev);
    }

    function addInlineItem(nodeId: number, currentItems: ChecklistItem[]) {
        const text = (inlineDrafts[nodeId] ?? '').trim();
        if (!text) return;
        const newItems = [...currentItems, { id: String(Date.now()), text, checked: false }];
        updateChecklistItems(nodeId, newItems);
        setInlineDrafts(prev => ({ ...prev, [nodeId]: '' }));
        setNewIdeaSwitch(prev => !prev);
    }

    function toggleSheetItem(itemId: string, nodeId: number) {
        const newItems = sheetItems.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
    }

    function deleteSheetItem(itemId: string, nodeId: number) {
        const index = sheetItems.findIndex(item => item.id === itemId);
        if (index === -1) return;
        const removed = sheetItems[index];
        const newItems = sheetItems.filter(item => item.id !== itemId);
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
        setNewIdeaSwitch(prev => !prev);
        const text = removed.text.length > 40 ? `${removed.text.slice(0, 39)}…` : removed.text;
        showToast(`Deleted “${text}”`, () => {
            // Put it back where it was, in whatever the list is now
            const fresh = fetchFullIdeaList().find(i => i.id === nodeId);
            if (fresh?.type !== 'checklist' || fresh.items.some(item => item.id === itemId)) return;
            const items = [...fresh.items];
            items.splice(Math.min(index, items.length), 0, removed);
            updateChecklistItems(nodeId, items);
            setSheetItems(prev => (sheetNodeIdRef.current === nodeId ? items : prev));
            setNewIdeaSwitch(prev => !prev);
        });
    }

    function editSheetItem(itemId: string, newText: string, nodeId: number) {
        const newItems = sheetItems.map(item =>
            item.id === itemId ? { ...item, text: newText } : item
        );
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function linkChangeSheetItem(itemId: string, link: string, nodeId: number) {
        const newItems = sheetItems.map(item =>
            item.id === itemId ? { ...item, link: link || undefined } : item
        );
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
    }

    function addSheetItem(nodeId: number) {
        const text = sheetItemDraft.trim();
        if (!text) return;
        const newItems = [...sheetItems, { id: String(Date.now()), text, checked: false }];
        setSheetItems(newItems);
        setSheetItemDraft('');
        updateChecklistItems(nodeId, newItems);
    }

    function goBack() {
        if (currentId === 1) return;
        // Synchronous so that, on reaching the top level, the Back handler is
        // unregistered before backStack re-pushes its history trap; otherwise
        // the trap is pushed and immediately history.back()'d, which stalls
        // the WebView for seconds after a back swipe.
        flushSync(() => {
            setCurrentId(currentIdea?.parentID || 1);
            setSheet(null);
        });
    }

    function openPatchNotes() {
        setHelpOrigin({ dx: lastPointer.x - window.innerWidth / 2, dy: lastPointer.y - window.innerHeight / 2 });
        markPatchNotesSeen(auth.currentUser?.uid, _changelogEntries);
        setIsNewPatchNotes(false);
        setShowPatchNotes(true);
    }

    function addChild() {
        if (!canCreateIdea()) {
            setUpgradeModalReason('limit');
            setUpgradeModalOpen(true);
            return;
        }
        setDraft('');
        setCreateTab('idea');
        setNameFlash(0);
        setChecklistTitle('');
        setChecklistItems([]);
        setChecklistItemDraft('');
        setNewNoteTitle('');
        setNewNoteBody('');
        setNewIdeaPriority(undefined);
        setSheet({ type: 'create', nodeId: -1 });
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
        const currentIdea = fetchFullIdeaList().find((i: IdeaType) => i.id === currentId);
        if (currentIdea && currentIdea.type !== 'checklist' && currentIdea.isNote) {
            const trimmed = headerDraft.trim();
            if (trimmed === (currentIdea.noteTitle ?? '')) return;
            updateIdeaNoteTitle(currentId, trimmed).then(() => {
                setNewIdeaSwitch(prev => !prev);
            });
            return;
        }
        const trimmed = headerDraft.trim() || 'Untitled';
        if (trimmed === currentIdea?.content) return;
        updateIdeaName(currentId, trimmed).then(() => {
            setNewIdeaSwitch(prev => !prev);
        });
    }

    function flashMissingName() {
        setNameFlash(n => n + 1); // keeps the field red until something is typed
        haptic('warn');
        const field = createNameRef.current;
        field?.focus();
        // Replays on every attempt without remounting (which could drop the keyboard)
        field?.animate(
            [
                { backgroundColor: '#ff8f8f', transform: 'translateX(0)' },
                { backgroundColor: '#ff5a5a', transform: 'translateX(-6px)' },
                { backgroundColor: '#ff8f8f', transform: 'translateX(5px)' },
                { backgroundColor: '#ff5a5a', transform: 'translateX(-3px)' },
                { backgroundColor: '', transform: 'translateX(0)' },
            ],
            { duration: 450, easing: 'ease-out' },
        );
    }

    function commitCreate() {
        if (!sheet || sheet.type !== 'create') return;
        const missing = createTab === 'idea' ? !draft.trim() : createTab === 'checklist' ? !checklistTitle.trim() : !newNoteTitle.trim();
        if (missing) { flashMissingName(); return; }

        if (createTab === 'checklist') {
            const title = checklistTitle.trim();
            // An item typed but not yet added with Return is still meant to be kept
            const pending = checklistItemDraft.trim();
            const items = pending
                ? [...checklistItems, { id: String(Date.now()), text: pending, checked: false }]
                : checklistItems;
            handleChecklistCreation(title, currentId, items, newIdeaPriority);
            setNewIdeaSwitch(prev => !prev);
            closeSheet();
            return;
        }

        if (createTab === 'note') {
            const title = newNoteTitle.trim();
            handleNoteCreation(title, currentId, newNoteBody, newIdeaPriority);
            setNewIdeaSwitch(prev => !prev);
            closeSheet();
            return;
        }

        const name = draft.trim();
        handleIdeaCreation(name, currentId, cleanLink(newIdeaLink.trim()), newIdeaPriority);
        setNewIdeaSwitch(prev => !prev);
        closeSheet();
    }

    function showToast(message: string, onUndo?: () => void, action?: UndoToastState['action']) {
        toastKeyRef.current += 1;
        if (onUndo) {
            lastUndoRef.current = () => {
                lastUndoRef.current = null;
                onUndo();
            };
        }
        setToast({
            key: toastKeyRef.current,
            message,
            onUndo: onUndo && (() => { lastUndoRef.current = null; onUndo(); }),
            action,
        });
    }

    useShake(() => {
        const undo = lastUndoRef.current;
        if (!undo || sheet !== null) return;
        haptic('hold');
        undo();
        setToast(null);
    });

    function shortLabel(idea: IdeaType | undefined): string {
        const label = resolveIdeaLabel(idea).split('\n')[0].trim() || 'Untitled';
        return label.length > 40 ? `${label.slice(0, 39)}…` : label;
    }

    function countDescendants(nodeId: number): number {
        let count = 0;
        const seen = new Set<number>([nodeId]);
        const stack = [nodeId];
        while (stack.length > 0) {
            const id = stack.pop()!;
            for (const idea of allIdeas) {
                if (idea.parentID === id && !seen.has(idea.id)) {
                    seen.add(idea.id);
                    count++;
                    stack.push(idea.id);
                }
            }
        }
        return count;
    }

    // A single idea is deleted straight away (Undo is offered); a branch
    // asks first, saying how much will go.
    function requestDelete(nodeId: number) {
        if (countDescendants(nodeId) === 0) deleteNode(nodeId);
        else setSheet({ type: 'confirmDelete', nodeId });
    }

    function deleteNode(nodeId: number) {
        const node = allIdeas.find(i => i.id === nodeId);
        if (currentId === nodeId && currentIdea?.parentID) {
            setCurrentId(currentIdea.parentID);
        }
        const removed = recursivelyDeleteChildren(nodeId);
        setNewIdeaSwitch(prev => !prev);
        closeSheet();
        const inside = removed.length - 1;
        showToast(
            inside > 0 ? `Deleted “${shortLabel(node)}” and ${inside} inside` : `Deleted “${shortLabel(node)}”`,
            () => {
                restoreIdeas(removed);
                setNewIdeaSwitch(prev => !prev);
            },
        );
    }

    function doMove(nodeId: number, targetId: number) {
        const oldParentId = allIdeas.find(i => i.id === nodeId)?.parentID ?? 1;
        const target = allIdeas.find(i => i.id === targetId);
        updateIdeaParentId(nodeId, targetId);
        setNewIdeaSwitch(prev => !prev);
        closeSheet();
        showToast(`Moved to “${shortLabel(target)}”`, () => {
            const list = fetchFullIdeaList();
            if (!list.some(i => i.id === nodeId)) return;
            updateIdeaParentId(nodeId, list.some(i => i.id === oldParentId) ? oldParentId : 1);
            setNewIdeaSwitch(prev => !prev);
        }, { label: 'Take me there', run: () => setCurrentId(targetId) });
    }

    function openActions(nodeId: number) {
        if (swipeRevealedId !== null) resetSwipeNode(swipeRevealedId);
        setSheet({ type: 'actions', nodeId });
    }

    function openEditSheet(node: IdeaType) {
        if (swipeRevealedId !== null) resetSwipeNode(swipeRevealedId);
        setDraft(isNoteMode(node) && node.type !== 'checklist' ? (node.noteTitle ?? '') : node.content);
        setEditBodyDraft(node.content);
        setEditLinkDraft(getIdeaLink(node));
        setEditPriority(node.priority);
        setSheet({ type: 'edit', nodeId: node.id });
    }

    function setPriorityFromMenu(nodeId: number, priority: 1 | 2 | 3 | undefined) {
        const node = allIdeas.find(i => i.id === nodeId);
        if (node && node.priority !== priority) {
            updateIdeaPriority(nodeId, priority);
            setNewIdeaSwitch(prev => !prev);
        }
        closeSheet();
    }

    function commitEdit() {
        if (!sheet || sheet.type !== 'edit') return;
        const node = allIdeas.find(i => i.id === sheet.nodeId);
        let changed = false;

        if (node && editPriority !== node.priority) {
            updateIdeaPriority(sheet.nodeId, editPriority);
            changed = true;
        }

        if (node && node.type !== 'checklist' && node.isNote) {
            const title = draft.trim();
            if (title !== (node.noteTitle ?? '')) {
                updateIdeaNoteTitle(sheet.nodeId, title);
                changed = true;
            }
            if (editBodyDraft !== node?.content) {
                updateIdeaName(sheet.nodeId, editBodyDraft);
                changed = true;
            }
            if (changed) setNewIdeaSwitch(prev => !prev);
            closeSheet();
            return;
        }

        const name = draft.trim() || 'Untitled';
        if (name !== node?.content) {
            updateIdeaName(sheet.nodeId, name);
            changed = true;
        }

        if (node?.type !== 'checklist') {
            const url = cleanLink(editLinkDraft.trim());
            if (url !== getIdeaLink(node)) {
                updateIdeaLink(sheet.nodeId, url);
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
        sheet?.type === 'create' ? (createTab === 'checklist' ? 'New checklist' : createTab === 'note' ? 'New note' : 'New idea') :
        sheet?.type === 'edit' ? (sheetNode?.type === 'checklist' ? 'Edit checklist' : isNoteMode(sheetNode ?? undefined) ? 'Edit note' : 'Edit idea') :
        sheet?.type === 'confirmDelete' ? 'Delete idea?' :
        sheet?.type === 'actions' ? shortLabel(sheetNode ?? undefined) :
        sheet?.type === 'checklist' ? (sheetNode?.content ?? '') : '';

    return (
        <div className="mmobile">
            <div className="mmobile-nav">
                <button
                    className={`mmobile-help${showHelp ? ' mmobile-help--active' : ''}${isNewPatchNotes ? ' mmobile-help--new' : ''}`}
                    aria-label={isNewPatchNotes ? 'Help (new patch notes)' : 'Help'}
                    onClick={() => {
                        if (!showHelp) setHelpOrigin({ dx: lastPointer.x - window.innerWidth / 2, dy: lastPointer.y - window.innerHeight / 2 });
                        setShowHelp(h => !h);
                    }}
                >
                    <img src="/images/QuestionMark.svg" alt="" />
                </button>
                {currentId === 1 || !parentCrumb ? (
                    <img src="/images/MainLargerLogo.svg" alt="Intraconnected" className="mmobile-nav-logo" />
                ) : (
                    <div className="mmobile-path">
                        <button
                            className={`mmobile-path-btn${showPath ? ' mmobile-path-btn--open' : ''}`}
                            onClick={() => setShowPath(p => !p)}
                            aria-expanded={showPath}
                            aria-haspopup="true"
                        >
                            <span className="mmobile-path-in">in</span>
                            <span className="mmobile-path-name">{resolveIdeaLabel(parentCrumb).split('\n')[0]}</span>
                            <span className="mmobile-path-caret" aria-hidden="true">▾</span>
                        </button>
                        {showPath && (
                            <>
                                <div className="mmobile-path-scrim" onClick={() => setShowPath(false)} />
                                <ol className="mmobile-path-menu">
                                    {breadcrumbs.map((idea, i) => {
                                        const isCurrent = idea.id === currentId;
                                        return (
                                            <li key={idea.id} style={{ '--depth': i } as React.CSSProperties}>
                                                <button
                                                    className={`mmobile-path-item${isCurrent ? ' mmobile-path-item--current' : ''}`}
                                                    onClick={isCurrent ? () => setShowPath(false) : () => { setCurrentId(idea.id); setSheet(null); }}
                                                    aria-current={isCurrent ? 'page' : undefined}
                                                >
                                                    {resolveIdeaLabel(idea).split('\n')[0]}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </>
                        )}
                    </div>
                )}
                <button className="mmobile-logout" onClick={() => setProfileModalOpen(true)}>
                    <img src="/images/Profile.svg" alt="Profile" />
                </button>
            </div>

            {showHelp && <MobileHelpSheet onClose={() => setShowHelp(false)} onOpenPatchNotes={openPatchNotes} hasNewPatchNotes={isNewPatchNotes} style={{ '--origin-dx': `${helpOrigin.dx}px`, '--origin-dy': `${helpOrigin.dy}px` } as React.CSSProperties} />}
            {showPatchNotes && <MobilePatchNotesSheet onClose={() => setShowPatchNotes(false)} style={{ '--origin-dx': `${helpOrigin.dx}px`, '--origin-dy': `${helpOrigin.dy}px` } as React.CSSProperties} />}
            {showSearch && (
                <MobileSearchSheet
                    allIdeas={allIdeas}
                    onPick={pickSearchResult}
                    onOpenMindMap={() => {
                        setMindMapOrigin(pointerOrigin());
                        setShowMindMap(true);
                    }}
                    onClose={() => setShowSearch(false)}
                    style={{
                        '--origin-dx': `${searchOrigin.dx}px`,
                        '--origin-dy': `${searchOrigin.dy}px`,
                        ...(keyboardOpen ? { bottom: `${keyboardInset + 8}px` } : {}),
                    } as React.CSSProperties}
                />
            )}
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

            <div ref={headerDivRef} className="mmobile-header">
                {editingTitle ? (
                    <textarea
                        ref={headerTextareaRef}
                        className="mmobile-header-title"
                        value={headerDraft}
                        rows={1}
                        autoFocus
                        enterKeyHint="done"
                        aria-label="Name"
                        onChange={e => {
                            setHeaderDraft(e.target.value);
                            const el = e.target;
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                            if (e.key === 'Escape') {
                                setHeaderDraft(currentIdea ? resolveIdeaLabel(currentIdea) : 'Ideas');
                                setEditingTitle(false);
                            }
                        }}
                        onBlur={() => { saveHeaderDraft(); setEditingTitle(false); }}
                    />
                ) : (
                    <div className="mmobile-header-title-row">
                        <h1 className="mmobile-header-title mmobile-header-title--static">{headerDraft.trim() || 'Untitled'}</h1>
                        {currentId !== 1 && (
                            <button className="mmobile-header-edit" onClick={() => setEditingTitle(true)} aria-label="Rename">
                                <img src="/images/Pen.svg" alt="" />
                            </button>
                        )}
                    </div>
                )}
                <div className="mmobile-header-count">
                    <span>{children.length} {children.length === 1 ? 'idea' : 'ideas'}</span>
                    <button
                        className={`mmobile-sort-btn${sortMode === 'recent' ? ' mmobile-sort-btn--recent' : ''}`}
                        onClick={toggleSortMode}
                    >
                        <img src="/images/sort.svg" alt="" />
                        Sort: {sortMode === 'priority' ? 'Priority' : 'Age'}
                    </button>
                </div>
            </div>

            {/* Between the title card and the list rather than inside the
                scrolling list: it pushes the rows down as it slides open, and
                stays visible however far the list is scrolled. */}
            {isDragging && !!currentIdea?.parentID && (
                <div className="mmobile-parent-drop-anchor">
                    <div
                        ref={el => { parentZoneRef.current = el; }}
                        className={`mmobile-parent-drop-zone${dropTargetId === -1 ? ' mmobile-parent-drop-zone--active' : ''}`}
                    >
                        ↑ Move to parent
                    </div>
                </div>
            )}

            <div
                className="mmobile-list"
                ref={mobileListRef}
                onScroll={() => {
                    lastScrollTimeRef.current = Date.now();
                    if (swipeRevealedId !== null && !isDraggingRef.current) resetSwipeNode(swipeRevealedId);
                }}
            >
                {children.length === 0 ? (
                    <div className="mmobile-empty">No ideas here yet.<br />Tap + to create one.</div>
                ) : children.map(child => {
                    const kidCount = allIdeas.reduce((n, i) => (i.parentID === child.id ? n + 1 : n), 0);
                    const hasKids = kidCount > 0;
                    const isRevealed = swipeRevealedId === child.id;
                    const priorityLabel = `Priority: ${child.priority === 1 ? 'High' : child.priority === 2 ? 'Medium' : child.priority === 3 ? 'Low' : 'none'}. Tap to change.`;
                    const childLink = getIdeaLink(child);

                    if (child.type === 'checklist') {
                        const isExpanded = expandedChecklists.has(child.id);
                        const items = child.items;
                        const checkedCount = items.filter(i => i.checked).length;
                        return (
                            <div key={child.id} data-flip-id={child.id} className="mmobile-node-wrap">
                                <div className="mmobile-node-swipe-actions" ref={el => { swipeActionsElRefs.current[child.id] = el; }} aria-hidden={!isRevealed}>
                                    <button
                                        className="mmobile-node-swipe-btn mmobile-node-swipe-btn--rename"
                                        tabIndex={isRevealed ? 0 : -1}
                                        onClick={e => { e.stopPropagation(); openEditSheet(child); }}
                                    >
                                        <img src="/images/Pen.svg" alt="Edit" />
                                    </button>
                                    <button
                                        className="mmobile-node-swipe-btn mmobile-node-swipe-btn--move"
                                        tabIndex={isRevealed ? 0 : -1}
                                        onClick={e => { e.stopPropagation(); resetSwipeNode(child.id); setSheet({ type: 'move', nodeId: child.id }); }}
                                    >
                                        <img src="/images/Move.svg" alt="Move" />
                                    </button>
                                    <button
                                        className="mmobile-node-swipe-btn mmobile-node-swipe-btn--delete"
                                        tabIndex={isRevealed ? 0 : -1}
                                        onClick={e => { e.stopPropagation(); resetSwipeNode(child.id); requestDelete(child.id); }}
                                    >
                                        <img src="/images/Trash.svg" alt="Delete" />
                                    </button>
                                </div>
                                <div
                                    ref={el => { nodeElRefs.current[child.id] = el; }}
                                    className={`mmobile-node mmobile-node--checklist${isExpanded ? ' mmobile-node--expanded' : ''}${isDragging && dragNodeId === child.id ? ' mmobile-node--held' : ''}${pressingNodeId === child.id ? ' mmobile-node--pressing' : ''}`}
                                    onTouchStart={e => handleNodeTouchStart(e, child.id)}
                                    onTouchMove={e => handleNodeTouchMove(e, child.id)}
                                    onTouchEnd={e => handleNodeTouchEnd(e, child.id)}
                                    onTouchCancel={() => handleNodeTouchCancel(child.id)}
                                    onContextMenu={e => e.preventDefault()}
                                    onClick={() => tapNode(child.id)}
                                >
                                    <div className="mmobile-node-header-row">
                                        <button
                                            className={`mmobile-node-priority-ribbon mmobile-node-priority-ribbon--${child.priority ? `p${child.priority}` : 'none'}${animatingRibbonId === child.id ? ' mmobile-node-priority-ribbon--animating' : ''}`}
                                            aria-label={priorityLabel}
                                            onClick={e => { e.stopPropagation(); cyclePriority(child.id, child.priority); }}
                                            onTouchEnd={e => e.stopPropagation()}
                                            onTouchStart={e => e.stopPropagation()}
                                        />
                                        <span className="mmobile-node-title">{child.content}</span>
                                        <button
                                            className="mmobile-node-more"
                                            aria-label={`Actions for ${shortLabel(child)}`}
                                            onClick={e => { e.stopPropagation(); openActions(child.id); }}
                                            onTouchStart={e => e.stopPropagation()}
                                            onTouchEnd={e => e.stopPropagation()}
                                        >
                                            <MoreDotsIcon />
                                        </button>
                                        {/* A dropdown, not a way in: count + a chevron that
                                            points down when closed and flips up when open. */}
                                        <button
                                            className={`mmobile-checklist-toggle${isExpanded ? ' mmobile-checklist-toggle--open' : ''}`}
                                            aria-expanded={isExpanded}
                                            aria-label={`${isExpanded ? 'Hide' : 'Show'} items, ${checkedCount} of ${items.length} done`}
                                            onClick={e => { e.stopPropagation(); toggleChecklistExpanded(child.id); }}
                                            onTouchStart={e => e.stopPropagation()}
                                            onTouchEnd={e => e.stopPropagation()}
                                        >
                                            <span className="mmobile-checklist-toggle-count">{checkedCount}/{items.length}</span>
                                            <svg className="mmobile-checklist-toggle-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                                                <path d="M2 4.25 6 8.25 10 4.25" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </button>
                                    </div>
                                    {isExpanded && (
                                        <div
                                            className="mmobile-checklist-inline"
                                            onClick={e => e.stopPropagation()}
                                            onTouchStart={e => e.stopPropagation()}
                                            onTouchEnd={e => e.stopPropagation()}
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
                                            {/* Full view only shows once the list is open, so the
                                                closed card's header stays uncluttered. */}
                                            <div className="mmobile-checklist-inline-footer">
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
                                                <button
                                                    className="mmobile-checklist-open-btn"
                                                    onClick={e => { e.stopPropagation(); openChecklistSheet(child.id); }}
                                                >
                                                    <img src="/images/OpenIconSkinny.svg" alt="" />
                                                    Full view
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }

                    const noteMode = isNoteMode(child);
                    const colorClass = noteMode
                        ? 'mmobile-node--note'
                        : childLink
                        ? 'mmobile-node--link'
                        : hasKids
                        ? 'mmobile-node--parent'
                        : 'mmobile-node--leaf';
                    return (
                        <div key={child.id} data-flip-id={child.id} className="mmobile-node-wrap">
                            <div className="mmobile-node-swipe-actions" ref={el => { swipeActionsElRefs.current[child.id] = el; }} aria-hidden={!isRevealed}>
                                <button
                                    className="mmobile-node-swipe-btn mmobile-node-swipe-btn--rename"
                                    tabIndex={isRevealed ? 0 : -1}
                                    onClick={e => { e.stopPropagation(); openEditSheet(child); }}
                                >
                                    <img src="/images/Pen.svg" alt="Edit" />
                                </button>
                                <button
                                    className="mmobile-node-swipe-btn mmobile-node-swipe-btn--move"
                                    tabIndex={isRevealed ? 0 : -1}
                                    onClick={e => { e.stopPropagation(); resetSwipeNode(child.id); setSheet({ type: 'move', nodeId: child.id }); }}
                                >
                                    <img src="/images/Move.svg" alt="Move" />
                                </button>
                                <button
                                    className="mmobile-node-swipe-btn mmobile-node-swipe-btn--delete"
                                    tabIndex={isRevealed ? 0 : -1}
                                    onClick={e => { e.stopPropagation(); resetSwipeNode(child.id); requestDelete(child.id); }}
                                >
                                    <img src="/images/Trash.svg" alt="Delete" />
                                </button>
                            </div>
                            <div
                                ref={el => { nodeElRefs.current[child.id] = el; }}
                                className={`mmobile-node ${colorClass}${dropTargetId === child.id ? ' mmobile-node--drop-target' : ''}${isDragging && dragNodeId === child.id ? ' mmobile-node--held' : ''}${pressingNodeId === child.id ? ' mmobile-node--pressing' : ''}`}
                                onTouchStart={e => handleNodeTouchStart(e, child.id)}
                                onTouchMove={e => handleNodeTouchMove(e, child.id)}
                                onTouchEnd={e => handleNodeTouchEnd(e, child.id)}
                                onTouchCancel={() => handleNodeTouchCancel(child.id)}
                                onContextMenu={e => e.preventDefault()}
                                onClick={() => tapNode(child.id)}
                            >
                                <button
                                    className={`mmobile-node-priority-ribbon mmobile-node-priority-ribbon--${child.priority ? `p${child.priority}` : 'none'}${animatingRibbonId === child.id ? ' mmobile-node-priority-ribbon--animating' : ''}`}
                                    aria-label={priorityLabel}
                                    onClick={e => { e.stopPropagation(); cyclePriority(child.id, child.priority); }}
                                    onTouchEnd={e => e.stopPropagation()}
                                    onTouchStart={e => e.stopPropagation()}
                                />
                                {noteMode ? (
                                    <span className="mmobile-node-title mmobile-node-title--note">
                                        <span className="mmobile-node-note-header">{resolveIdeaLabel(child)}</span>
                                        <span className="mmobile-node-note-body">{child.content}</span>
                                    </span>
                                ) : (
                                    <span className="mmobile-node-title">{child.content}</span>
                                )}
                                <span className="mmobile-node-end">
                                    <button
                                        className="mmobile-node-more"
                                        aria-label={`Actions for ${shortLabel(child)}`}
                                        onClick={e => { e.stopPropagation(); openActions(child.id); }}
                                        onTouchStart={e => e.stopPropagation()}
                                        onTouchEnd={e => e.stopPropagation()}
                                    >
                                        <MoreDotsIcon />
                                    </button>
                                    {!noteMode && (childLink && !hasKids ? (
                                        <span className="mmobile-node-arrow mmobile-node-arrow--out" aria-label="opens website"><LinkOutIcon /></span>
                                    ) : (
                                        <span className="mmobile-node-arrow">
                                            {hasKids && <span className="mmobile-node-kids" aria-label={`${kidCount} inside`}>{kidCount}</span>}
                                            ›
                                        </span>
                                    ))}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div ref={fabAreaRef} className={`mmobile-fab-area${sheet ? ' mmobile-fab-area--hidden' : ''}`}>
                <button
                    className={`mmobile-back-btn${canGoBack ? '' : ' mmobile-back-btn--at-root'}`}
                    onClick={canGoBack ? goBack : undefined}
                    aria-disabled={!canGoBack}
                ><img src="/images/ArrowBack.svg" alt="Back" /></button>
                <button
                    className={`mmobile-home-btn${currentId === 1 ? ' mmobile-home-btn--at-root' : ''}`}
                    onClick={currentId === 1 ? undefined : () => { setCurrentId(1); setSheet(null); }}
                    aria-disabled={currentId === 1}
                ><img src="/images/Home.svg" alt="Home" /></button>
                <button
                    className={`mmobile-navigate-btn${showSearch ? ' mmobile-navigate-btn--active' : ''}`}
                    onClick={() => {
                        if (!showSearch) setSearchOrigin(pointerOrigin());
                        setShowSearch(s => !s);
                    }}
                    aria-label={showSearch ? 'Close search' : 'Search ideas'}
                    aria-pressed={showSearch}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /></svg>
                </button>
                <button
                    className={`mmobile-fab${sheet?.type === 'create' ? ' mmobile-fab--active' : ''}`}
                    onClick={addChild}
                ><img src="/images/SkinnyPlus.svg" alt="Create" /></button>
            </div>

            {toast && <MobileUndoToast toast={toast} aboveSheet={sheet !== null} onDismiss={() => setToast(null)} />}

            {isDragging && dragNodeId !== null && (() => {
                const dragNode = allIdeas.find(i => i.id === dragNodeId);
                if (!dragNode) return null;
                const dragLink = getIdeaLink(dragNode);
                const dragColorClass = dragNode.type === 'checklist' ? 'mmobile-node--checklist'
                    : isNoteMode(dragNode) ? 'mmobile-node--note'
                    : dragLink ? 'mmobile-node--link'
                    : allIdeas.some(i => i.parentID === dragNode.id) ? 'mmobile-node--parent'
                    : 'mmobile-node--leaf';
                return (
                    <div
                        className={`mmobile-drag-ghost mmobile-node ${dragColorClass}${isDroppingAnim ? ' mmobile-drag-ghost--dropping' : ''}`}
                        style={{ top: dragPos.y - 40 } as React.CSSProperties}
                    >
                        <span className="mmobile-node-title">{resolveIdeaLabel(dragNode)}</span>
                        {!isNoteMode(dragNode) && <span className="mmobile-node-arrow">›</span>}
                    </div>
                );
            })()}

            {sheet && (
                <>
                    <div className="mmobile-scrim" onClick={() => { if (Date.now() - lastLongPressTime.current < 400) return; requestCloseSheet(); }} />
                    <div
                        ref={sheetSwipe.sheetRef}
                        className={`mmobile-sheet${sheet.type === 'checklist' ? ' mmobile-sheet--checklist' : ''}${isTypingSheet(sheet) ? ' mmobile-sheet--top' : ''}`}
                        role="dialog"
                        aria-modal="true"
                        aria-label={sheetTitle || 'Sheet'}
                        style={{
                            '--origin-dx': `${sheetOrigin.dx}px`,
                            '--origin-dy': `${sheetOrigin.dy}px`,
                            // With the keyboard up, sit just above it and fit
                            // what's left of the screen (dvh doesn't shrink for
                            // the keyboard on iOS), scrolling inside if needed.
                            // In the app the status bar overlays the page, so stay below it.
                            // Typing sheets keep their top and only stop short of the keyboard.
                            ...(keyboardOpen && isTypingSheet(sheet)
                                ? { maxHeight: `max(160px, calc(${viewportHeight - 8}px - max(8px, env(safe-area-inset-top, 8px))))` }
                                : {}),
                            ...(keyboardOpen && !isTypingSheet(sheet) ? { bottom:`${keyboardInset + 8}px`, maxHeight: `max(160px, calc(${viewportHeight - 16}px - env(safe-area-inset-top, 0px)))` } : {}),
                        } as React.CSSProperties}
                    >
                        <div className="mmobile-sheet-top" {...sheetSwipe.dragProps}>
                            <div className="mmobile-sheet-grab" aria-hidden="true" />
                            <div className="mmobile-sheet-title">
                                {sheetTitle}
                                <button className="mmobile-sheet-close" onClick={() => requestCloseSheet()} aria-label="Close">✕</button>
                            </div>
                        </div>

                        {confirmDiscard && (
                            <div className="mmobile-discard" role="alertdialog" aria-label="Discard changes?">
                                <p className="mmobile-discard-text">Discard what you typed?</p>
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--save" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--delete" onClick={closeSheet}>Discard</button>
                                </div>
                            </div>
                        )}

                        {sheet.type === 'create' && (
                            <>
                                <div className="mmobile-create-tabs">
                                        <button
                                            className={`mmobile-create-tab mmobile-create-tab--idea${createTab === 'idea' ? ' mmobile-create-tab--active' : ''}`}
                                            onClick={() => { setCreateTab('idea'); setNameFlash(0); }}
                                        >
                                            Idea
                                        </button>
                                        <button
                                            className={`mmobile-create-tab mmobile-create-tab--checklist${createTab === 'checklist' ? ' mmobile-create-tab--active' : ''}`}
                                            onClick={() => { setCreateTab('checklist'); setNameFlash(0); }}
                                        >
                                            Checklist
                                        </button>
                                        <button
                                            className={`mmobile-create-tab mmobile-create-tab--note${createTab === 'note' ? ' mmobile-create-tab--active' : ''}`}
                                            onClick={() => { setCreateTab('note'); setNameFlash(0); }}
                                        >
                                            Note
                                        </button>
                                </div>

                                {createTab === 'idea' && (
                                    <div className="mmobile-sheet-create-fields">
                                        <textarea
                                            ref={el => { createNameRef.current = el; }}
                                            autoFocus
                                            className="mmobile-rename-input mmobile-rename-input--grow"
                                            aria-invalid={nameFlash > 0 && !draft.trim()}
                                            value={draft}
                                            onChange={e => {
                                                setDraft(e.target.value);
                                                const el = e.target;
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                            }}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitCreate(); } }}
                                            enterKeyHint="done"
                                            placeholder="Idea name"
                                            rows={1}
                                        />
                                        <input
                                            className="mmobile-rename-input mmobile-link-input"
                                            placeholder="Link (optional)"
                                            value={newIdeaLink}
                                            onChange={e => setNewIdeaLink(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitCreate(); } }}
                                            enterKeyHint="done"
                                            type="url"
                                        />
                                    </div>
                                )}

                                {createTab === 'checklist' && (
                                    <div className="mmobile-sheet-cl-create">
                                        <input
                                            ref={el => { createNameRef.current = el; }}
                                            autoFocus
                                            className="mmobile-rename-input"
                                            aria-invalid={nameFlash > 0 && !checklistTitle.trim()}
                                            placeholder="Checklist title"
                                            value={checklistTitle}
                                            onChange={e => setChecklistTitle(e.target.value)}
                                            enterKeyHint="next"
                                            maxLength={100}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); checklistItemInputRef.current?.focus(); } }}
                                        />
                                        {checklistItems.length > 0 && (
                                            <ul className="mmobile-sheet-cl-items">
                                                {checklistItems.map(item => (
                                                    <li key={item.id} className="mmobile-sheet-cl-item">
                                                        <span className="mmobile-sheet-cl-box" aria-hidden="true" />
                                                        <span className="mmobile-sheet-cl-item-text">{item.text}</span>
                                                        <button
                                                            type="button"
                                                            className="mmobile-sheet-cl-item-del"
                                                            aria-label={`Remove ${item.text}`}
                                                            onClick={() => removeChecklistItem(item.id)}
                                                        >✕</button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <div className="mmobile-sheet-cl-add-row">
                                            <input
                                                ref={checklistItemInputRef}
                                                className="mmobile-rename-input"
                                                placeholder="Add an item"
                                                value={checklistItemDraft}
                                                onChange={e => setChecklistItemDraft(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
                                                enterKeyHint="next"
                                                maxLength={200}
                                            />
                                            <button
                                                type="button"
                                                className="mmobile-sheet-cl-add-btn"
                                                onClick={addChecklistItem}
                                                disabled={!checklistItemDraft.trim()}
                                                aria-label="Add item"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {createTab === 'note' && (
                                    <div className="mmobile-sheet-create-fields">
                                        <input
                                            ref={el => { createNameRef.current = el; }}
                                            autoFocus
                                            className="mmobile-rename-input"
                                            aria-invalid={nameFlash > 0 && !newNoteTitle.trim()}
                                            placeholder="Note title"
                                            value={newNoteTitle}
                                            onChange={e => setNewNoteTitle(e.target.value)}
                                            enterKeyHint="next"
                                            maxLength={100}
                                        />
                                        <textarea
                                            className="mmobile-rename-input mmobile-rename-input--grow"
                                            value={newNoteBody}
                                            onChange={e => {
                                                setNewNoteBody(e.target.value);
                                                const el = e.target;
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                            }}
                                            placeholder="Write your note..."
                                            maxLength={2000}
                                            rows={4}
                                        />
                                    </div>
                                )}

                                <MobilePriorityPicker value={newIdeaPriority} onChange={setNewIdeaPriority} />

                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button
                                        className="mmobile-sheet-btn mmobile-sheet-btn--save"
                                        onClick={commitCreate}
                                        aria-disabled={(createTab === 'idea' && !draft.trim()) || (createTab === 'checklist' && !checklistTitle.trim()) || (createTab === 'note' && !newNoteTitle.trim())}
                                    >
                                        Create
                                    </button>
                                </div>
                            </>
                        )}

                        {sheet.type === 'actions' && sheetNode && (
                            <div className="mmobile-actions">
                                <button className="mmobile-action-btn" onClick={() => openEditSheet(sheetNode)}>
                                    <img src="/images/Pen.svg" className="mmobile-action-icon" alt="" />
                                    Edit
                                </button>
                                <button className="mmobile-action-btn" onClick={() => setSheet({ type: 'move', nodeId: sheetNode.id })}>
                                    <img src="/images/Move.svg" className="mmobile-action-icon" alt="" />
                                    Move…
                                </button>
                                <MobilePriorityPicker value={sheetNode.priority} onChange={p => setPriorityFromMenu(sheetNode.id, p)} />
                                <button className="mmobile-action-btn mmobile-action-btn--delete" onClick={() => requestDelete(sheetNode.id)}>
                                    <img src="/images/Trash.svg" className="mmobile-action-icon" alt="" />
                                    Delete
                                </button>
                            </div>
                        )}

                        {sheet.type === 'move' && (
                            <MobileMoveSheet
                                nodeId={sheet.nodeId}
                                allIdeas={allIdeas}
                                onMove={doMove}
                            />
                        )}

                        {sheet.type === 'edit' && isNoteMode(sheetNode ?? undefined) && (
                            <>
                                <textarea
                                    autoFocus
                                    className="mmobile-rename-input"
                                    value={draft}
                                    onChange={e => setDraft(e.target.value)}
                                    placeholder="Name this note…"
                                    maxLength={100}
                                    rows={1}
                                />
                                <textarea
                                    className="mmobile-rename-input mmobile-rename-input--grow"
                                    value={editBodyDraft}
                                    onChange={e => {
                                        setEditBodyDraft(e.target.value);
                                        const el = e.target;
                                        el.style.height = 'auto';
                                        el.style.height = el.scrollHeight + 'px';
                                    }}
                                    onFocus={e => { const el = e.target; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
                                    placeholder="Note body"
                                    maxLength={2000}
                                    rows={4}
                                />
                                <MobilePriorityPicker value={editPriority} onChange={setEditPriority} />
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--save" onClick={commitEdit}>Save</button>
                                </div>
                            </>
                        )}

                        {sheet.type === 'edit' && !isNoteMode(sheetNode ?? undefined) && (
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
                                    enterKeyHint="done"
                                    placeholder="Idea name"
                                    rows={1}
                                />
                                {sheetNode?.type !== 'checklist' && (!allIdeas.some(i => i.parentID === sheetNode?.id) || !!sheetNodeLink) && (
                                    <input
                                        className="mmobile-rename-input mmobile-link-input"
                                        placeholder="Link (optional)"
                                        value={editLinkDraft}
                                        onChange={e => setEditLinkDraft(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } }}
                                        enterKeyHint="done"
                                        type="url"
                                    />
                                )}
                                {sheetNode?.type !== 'checklist' && allIdeas.some(i => i.parentID === sheetNode?.id) && !sheetNodeLink && (
                                    <p className="mmobile-sheet-hint">An idea with ideas inside it can't be a link.</p>
                                )}
                                <MobilePriorityPicker value={editPriority} onChange={setEditPriority} />
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--save" onClick={commitEdit}>Save</button>
                                </div>
                            </>
                        )}

                        {sheet.type === 'confirmDelete' && (
                            <>
                                <p className="mmobile-confirm-text">
                                    {(() => {
                                        const inside = countDescendants(sheet.nodeId);
                                        return (
                                            <>This will delete <strong>{shortLabel(sheetNode ?? undefined)}</strong> and the {inside === 1 ? 'idea' : `${inside} ideas`} inside it.</>
                                        );
                                    })()}
                                </p>
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--delete" onClick={() => deleteNode(sheet.nodeId)}>Delete</button>
                                </div>
                            </>
                        )}

                        {sheet.type === 'checklist' && (
                            <MobileChecklistItemSheet
                                nodeId={sheet.nodeId}
                                items={sheetItems}
                                draft={sheetItemDraft}
                                onDraftChange={text => setSheetItemDraft(text)}
                                onAdd={addSheetItem}
                                onToggle={toggleSheetItem}
                                onDelete={deleteSheetItem}
                                onEdit={editSheetItem}
                                onLinkChange={linkChangeSheetItem}
                                onReorder={(newItems, nodeId) => {
                                    setSheetItems(newItems);
                                    updateChecklistItems(nodeId, newItems);
                                }}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default MobileMindMap;
