// Components
import Navbar from '../components/Navbar';
import IdeaNode from '../components/IdeaNode';
import CreationModal from '../components/modals/CreationModal';
import RenameModal from '../components/modals/RenameModal';
import Help from '../components/Help';
import PatchNotes from '../components/PatchNotes';
import Trash from '../components/Trash';
import LastIdea from '../components/LastIdea';

// 3rd Party Libraries
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Modifier, CollisionDetection, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { DndContext, PointerSensor, useSensor, useSensors, rectIntersection } from '@dnd-kit/core';

// Custom Libraries
import { auth } from '../firebaseConfig';
import { firstUnseenHelpScreen } from '../components/helpScreens';
import { fetchLifetimeCelebrated, markLifetimeCelebrated } from '../utilities/firebase/preferences';
import { useIdeaContext } from '../context/IdeaContext';
import changelog from '../../programmer-docs/CHANGELOG.md?raw';
import { parseChangelog } from '../utilities/parseChangelog';
import { isPatchNotesNew, markPatchNotesSeen, syncPatchNotesFromFirebase } from '../utilities/patchNotesState';
import { getDEK, loadPersistedDEK } from '../utilities/dekStore';
import { hideSplash, onAppResume } from '../utilities/platform';
import { refreshEmailVerified } from '../utilities/firebase/authFirebase';
import {
    fetchFullIdeaList,
    handleIdeaCreation,
    handleChecklistCreation,
    handleNoteCreation,
    getIdeasByParentID,
    buildAncestorPath,
    IdeaType,
    getParentID,
    getNameFromID,
    checkIfIdeaIsLeaf,
    canCreateIdea,
    getIdeaLink,
    sortIdeas,
    isNoteWide,
    isNoteMode,
    resolveIdeaLabel,
} from '../utilities/index';
import LinkChangeModal from '../components/modals/LinkChangeModal';
import DeleteConfirmModal from '../components/modals/DeleteConfirmModal';
import ChecklistModal from '../components/modals/ChecklistModal';
import FeatureImplementedModal from '../components/modals/FeatureImplementedModal';
import OnboardingModal from '../components/modals/OnboardingModal';
import ProfileModal from '../components/modals/ProfileModal';
import SessionEndedModal from '../components/modals/SessionEndedModal';
import UpgradeModal from '../components/modals/UpgradeModal';
import LazyCheckoutModal from '../components/modals/LazyCheckoutModal';
import UpgradeCelebrationModal from '../components/modals/UpgradeCelebrationModal';
import MobileMindMap from '../components/mobile/MobileMindMap';
import MindMap from '../components/MindMap';
import { checkAndMarkImplementedFeatures } from '../utilities/firebase/featureRequests';
import { consumePendingCheckoutPlan } from '../utilities/billing/billing';
import { useBillingPlanSync } from '../utilities/billing/useBillingPlanSync';
import { useNodeCountResync } from '../utilities/billing/useNodeCountResync';
import { useIsMobileUI } from '../utilities/useIsMobileUI';
import { syncOnLoad, startSyncListener } from '../utilities/sync/syncEngine';
import { onSyncRefreshed } from '../utilities/sync/syncStore';
import SyncStatusBanner from '../components/SyncStatusBanner';
import UndoToast from '../components/UndoToast';
import CardMenu from '../components/CardMenu';
import Breadcrumb from '../components/Breadcrumb';
import RootTitle from '../components/RootTitle';
import { readIdeaFromUrl, writeIdeaToUrl } from '../utilities/idea/ideaUrl';
import { recordVisit } from '../utilities/idea/recentVisits';
import MoveModal from '../components/modals/MoveModal';
import SearchModal from '../components/modals/SearchModal';
import ShortcutsModal from '../components/modals/ShortcutsModal';
import { useDesktopShortcuts } from '../utilities/useDesktopShortcuts';
import type { SearchResult } from '../utilities/idea/search';
import { useIdeaActions } from '../utilities/idea/useIdeaActions';

const _changelogEntries = parseChangelog(changelog);

const restrictToTopLeftRight: Modifier = ({ transform, draggingNodeRect, windowRect }) => {
    if (!draggingNodeRect || !windowRect) return transform;
    const value = { ...transform };
    if (draggingNodeRect.left + transform.x < windowRect.left) value.x = windowRect.left - draggingNodeRect.left;
    if (draggingNodeRect.right + transform.x > windowRect.right) value.x = windowRect.right - draggingNodeRect.right;
    if (draggingNodeRect.top + transform.y < windowRect.top) value.y = windowRect.top - draggingNodeRect.top;
    return value;
};

function Idea() {
    // The app's splash stays up until a screen is ready (capacitor.config.ts).
    useEffect(() => { hideSplash(); }, []);

    // Verifying the email happens in the browser; when the user comes back to
    // the app, pick that up so the "verify your email" prompt clears.
    useEffect(() => onAppResume(() => {
        const user = auth.currentUser;
        if (user && !user.emailVerified) refreshEmailVerified().catch(() => { /* offline: try next time */ });
    }), []);

    const [initialFetch, setInitialFetch] = useState(false);
    // True once this session has a confirmed-current copy from the server —
    // false while offline on load. Gates anything that would write local
    // counts back to the server (useNodeCountResync).
    const [serverSynced, setServerSynced] = useState(false);
    const [isLoadingIdeas, setIsLoadingIdeas] = useState(true);
    const [showHelp, setShowHelp] = useState(false);
    const [showPatchNotes, setShowPatchNotes] = useState(false);
    const [showMindMap, setShowMindMap] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [mapReveal, setMapReveal] = useState<{ id: number; tick: number } | null>(null);
    const [copiedAll, setCopiedAll] = useState(false);
    const copiedAllTimer = useRef<number>(0);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [lastRootName, setLastRootName] = useState('');
    const [isNewPatchNotes, setIsNewPatchNotes] = useState(() =>
        isPatchNotesNew(auth.currentUser?.uid, _changelogEntries)
    );
    const [hasNewHelp, setHasNewHelp] = useState(() => firstUnseenHelpScreen(auth.currentUser?.uid) >= 0);
    const [implementedTitles, setImplementedTitles] = useState<string[] | null>(null);
    const [sortMode, setSortMode] = useState<'priority' | 'recent'>(() =>
        (localStorage.getItem('idea_sort_mode') as 'priority' | 'recent') ?? 'priority'
    );

    const ideaNodesRef = useRef<HTMLDivElement>(null);
    const urlAppliedRef = useRef(false);
    const flipSnapshot = useRef<Map<number, { top: number; left: number }>>(new Map());
    const prevFlipIds = useRef<number[]>([]);

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        syncPatchNotesFromFirebase(uid, _changelogEntries).then(isNew => setIsNewPatchNotes(isNew));
    }, []);

    // auth.currentUser is still null on first render after a reload, so the
    // initial state can't be trusted; re-check once the user resolves.
    useEffect(() => {
        return auth.onAuthStateChanged(user => {
            setHasNewHelp(firstUnseenHelpScreen(user?.uid) >= 0);
        });
    }, []);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            if (!user) return;
            unsubscribe();
            checkAndMarkImplementedFeatures().then(titles => {
                if (titles) setImplementedTitles(titles);
            });
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (sessionStorage.getItem('new_user') === 'true') {
            sessionStorage.removeItem('new_user');
            setShowHelp(true);
        }
    }, []);

    // A plan clicked while signed out (see startCheckout in billing.tsx)
    // is remembered in sessionStorage and resumed here once auth resolves.
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            if (!user) return;
            unsubscribe();
            const pendingPlan = consumePendingCheckoutPlan();
            if (pendingPlan) setCheckoutPlan(pendingPlan);
        });
        return () => unsubscribe();
    }, []);

    function handleTogglePatchNotes() {
        if (!showPatchNotes) {
            markPatchNotesSeen(auth.currentUser?.uid, _changelogEntries);
            setIsNewPatchNotes(false);
            setShowHelp(false);
        }
        setShowPatchNotes(prev => !prev);
    }

    function handleToggleHelp() {
        setShowPatchNotes(false);
        setShowHelp(prev => !prev);
    }

    const { rootId, setRootId, rootName, setRootName, newIdeaSwitch, rootIdStack, ideas, setIdeas, setRenameModalOpen, nodesVisible, navigateToId, billingPlan, setBillingPlan, setCheckoutPlan, celebrationPlan, setCelebrationPlan, setNewIdeaSwitch, checklistModalId, setChecklistModalId, setCreationModalOpen, setUpgradeModalOpen, setUpgradeModalReason } = useIdeaContext();

    useBillingPlanSync(setBillingPlan);
    useNodeCountResync(billingPlan, serverSynced);
    const isMobileUI = useIsMobileUI();
    const { requestDelete, moveIdea, copyChildren } = useIdeaActions();

    // Lifetime granted without a checkout (Developer Testing): celebrate once
    // per account (flag lives in Firestore, not this browser) the next time the
    // app sees the plan. A real purchase shows the same modal via
    // CheckoutModal, so this flag is set for those too.
    const lifetimeCheckedRef = useRef(false);
    useEffect(() => {
        if (lifetimeCheckedRef.current) return;
        if (billingPlan !== 'lifetime' && celebrationPlan !== 'lifetime') return;
        lifetimeCheckedRef.current = true;
        const alreadyShowing = celebrationPlan === 'lifetime';
        fetchLifetimeCelebrated()
            .then(seen => {
                if (seen) return;
                if (!alreadyShowing) setCelebrationPlan('lifetime');
                return markLifetimeCelebrated();
            })
            .catch(() => {
                lifetimeCheckedRef.current = false;
            });
    }, [billingPlan, celebrationPlan, setCelebrationPlan]);

    // Live updates from other devices, once the initial load has settled.
    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!initialFetch || !uid) return;
        return startSyncListener(uid);
    }, [initialFetch]);

    // After another device's changes are pulled in: re-read the local list,
    // and step out of anything that was deleted over there.
    useEffect(() => {
        return onSyncRefreshed(() => {
            setServerSynced(true);
            const all = fetchFullIdeaList();
            if (rootId !== 1 && !all.some((idea) => idea.id === rootId)) navigateToId(1, { history: 'replace' });
            if (checklistModalId !== null && !all.some((idea) => idea.id === checklistModalId)) setChecklistModalId(null);
            setNewIdeaSwitch((prev) => !prev);
        });
    }, [rootId, checklistModalId, navigateToId, setChecklistModalId, setNewIdeaSwitch]);

    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                try { getDEK(); return; } catch { /* not in memory — check session */ }
                const dekLoaded = await loadPersistedDEK();
                if (!dekLoaded) window.location.href = '/login';
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    useEffect(() => {
        async function init() {
            if (auth.currentUser && !initialFetch) {
                try {
                    getDEK();
                } catch {
                    const restored = await loadPersistedDEK();
                    if (!restored) {
                        window.location.href = '/login';
                        return;
                    }
                }
                // Never empties the local map: if the server can't be
                // reached this shows the device's own copy and serverOk is
                // false until a later pull succeeds (see onSyncRefreshed).
                const { serverOk } = await syncOnLoad(auth.currentUser.uid);
                setServerSynced(serverOk);
                setInitialFetch(true);
            }

            // A link or refresh can name the level to open (?idea=ID). Use it only if
            // that idea still exists; otherwise fall back to the top and fix the address.
            let startId = rootId;
            if (!urlAppliedRef.current && auth.currentUser) {
                urlAppliedRef.current = true;
                const wanted = readIdeaFromUrl();
                const everything = fetchFullIdeaList();
                if (wanted !== null && wanted !== 1 && everything.some((idea: IdeaType) => idea.id === wanted)) {
                    startId = wanted;
                    rootIdStack.current = buildAncestorPath(wanted, everything);
                    setRootId(wanted);
                } else if (wanted !== null) {
                    writeIdeaToUrl(1, 'replace');
                }
            }
            const loadedIdeas = getIdeasByParentID(startId);
            if (rootIdStack.current.length === 0) {
                rootIdStack.current.push(startId);
            }
            setIdeas(loadedIdeas);
            setIsLoadingIdeas(false);
        }

        // Firebase reports "no user" once it has finished restoring the saved
        // session. Nobody signed in on arrival means /main has nothing to show
        // (the cached ideas belong to whoever used this browser last). A user
        // who vanishes mid-session is SessionEndedModal's case, not this one.
        let hadUser = false;
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) hadUser = true;
            else if (!hadUser) {
                window.location.replace('/login');
                return;
            }
            init();
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const loadIdeas = async () => {
            setIdeasFromStorage();

            const currentRoot = fetchFullIdeaList().find((idea: IdeaType) => idea.id === rootId);
            if (currentRoot) {
                setRootName(resolveIdeaLabel(currentRoot));
            }
        };

        loadIdeas();
        setLastRootName(getNameFromID(getParentID(rootId)));
    }, [rootId, newIdeaSwitch]);

    const nodePointerCollision: CollisionDetection = (args) => {
        const { droppableContainers, droppableRects, pointerCoordinates } = args;

        const specialContainers = droppableContainers.filter(c => c.id === 'trash' || c.id === 'last-idea');
        const specialHits = rectIntersection({ ...args, droppableContainers: specialContainers });
        if (specialHits.length > 0) return specialHits;

        if (!pointerCoordinates) return [];
        const { x, y } = pointerCoordinates;
        const BUFFER = 10;

        const ideaContainers = droppableContainers.filter(c => String(c.id).startsWith('idea-'));
        const collisions: { id: string | number; dist: number }[] = [];
        for (const container of ideaContainers) {
            const rect = droppableRects.get(container.id);
            if (!rect) continue;
            if (x >= rect.left - BUFFER && x <= rect.right + BUFFER && y >= rect.top - BUFFER && y <= rect.bottom + BUFFER) {
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                collisions.push({ id: container.id, dist: Math.hypot(x - cx, y - cy) });
            }
        }
        collisions.sort((a, b) => a.dist - b.dist);
        return collisions.map(c => ({ id: c.id }));
    };

    // The dragged card follows the pointer, so its own cursor is the one shown. While it
    // hovers a card that can't take a drop (checklist, note, link), a body class swaps the
    // whole page to the "not allowed" cursor.
    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        let blocked = false;
        if (active && over && String(over.id).startsWith('idea-') && over.id !== active.id) {
            const overIdea = fetchFullIdeaList().find((i: IdeaType) => i.id === Number(String(over.id).split('-')[1]));
            blocked = getIdeaLink(overIdea) !== '' || isNoteMode(overIdea) || overIdea?.type === 'checklist';
        }
        document.body.classList.toggle('dnd-blocked', blocked);
    };
    const clearBlockedCursor = () => document.body.classList.remove('dnd-blocked');

    const handleDragEnd = (event: DragEndEvent) => {
        clearBlockedCursor();
        const { active, over } = event;
        if (!active || !over) return;

        const activeId = Number(String(active.id).split('-')[1]);
        const overId = Number(String(over.id).split('-')[1]);
        const overIdea = fetchFullIdeaList().find((i: IdeaType) => i.id === overId);
        const overLink = getIdeaLink(overIdea);

        if (over.id === 'trash') {
            const trashEl = document.querySelector('.trashCan');
            const rect = trashEl?.getBoundingClientRect();
            requestDelete(activeId, rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined);
        } else if (over.id === 'last-idea') {
            moveIdea(activeId, getParentID(rootId));
        } else {
            if (activeId === overId) return;
            if (overLink !== '') return;
            if (isNoteMode(overIdea)) return;
            if (overIdea?.type === 'checklist') return;
            const newParentId = Number(String(over.id).split('-')[1]);
            moveIdea(activeId, newParentId);
        }
    };

    // Browser Back/Forward: the address already changed, so show that level without adding history.
    useEffect(() => {
        function onPopState() {
            if (window.location.pathname !== '/main') return;
            const wanted = readIdeaFromUrl() ?? 1;
            const exists = wanted === 1 || fetchFullIdeaList().some((idea: IdeaType) => idea.id === wanted);
            if (exists) navigateToId(wanted, { history: 'none' });
            else navigateToId(1, { history: 'replace' });
        }
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [navigateToId]);

    function openCreate() {
        if (canCreateIdea()) {
            setCreationModalOpen(true);
        } else {
            setUpgradeModalReason('limit');
            setUpgradeModalOpen(true);
        }
    }

    // Search result: go to the level the idea lives in and put the keyboard on its card.
    function pickSearchResult(result: SearchResult) {
        recordVisit(result.id);
        // With the map open, show the idea there instead of leaving it.
        if (showMindMap) {
            setMapReveal({ id: result.id, tick: Date.now() });
            return;
        }
        const focusIt = () => document.querySelector<HTMLElement>(`[data-idea-id="${result.id}"]`)?.focus();
        if (result.parentID === rootId) {
            setTimeout(focusIt, 50);
        } else {
            navigateToId(result.parentID);
            setTimeout(focusIt, 400);
        }
    }

    useDesktopShortcuts({
        enabled: !isMobileUI,
        mapOpen: showMindMap,
        onToggleMap: () => setShowMindMap(prev => !prev),
        onNewIdea: openCreate,
        onGoUp: () => { if (rootId !== 1) navigateToId(getParentID(rootId)); },
        onShowShortcuts: () => setShowShortcuts(true),
        onSearch: () => setShowSearch(true),
    });

    function setIdeasFromStorage() {
        const loadedIdeas = getIdeasByParentID(rootId);
        setIdeas(loadedIdeas);
    }

    function toggleSortMode() {
        const next = sortMode === 'priority' ? 'recent' : 'priority';
        setSortMode(next);
        localStorage.setItem('idea_sort_mode', next);
    }

    const displayedIdeas = sortIdeas(ideas, sortMode);

    function captureFlipSnapshot() {
        if (!ideaNodesRef.current) return;
        const nodes = ideaNodesRef.current.querySelectorAll<HTMLElement>('[data-flip-id]');
        const snap = new Map<number, { top: number; left: number }>();
        nodes.forEach(el => {
            const flipId = Number(el.dataset.flipId);
            const rect = el.getBoundingClientRect();
            snap.set(flipId, { top: rect.top, left: rect.left });
        });
        flipSnapshot.current = snap;
        prevFlipIds.current = Array.from(snap.keys());
    }

    // Initial snapshot capture — runs when ideas load or change outside of a reorder.
    useEffect(() => {
        if (!ideaNodesRef.current) return;
        const hasActiveFlip = Array.from(
            ideaNodesRef.current.querySelectorAll<HTMLElement>('[data-flip-id]')
        ).some(el => el.style.transform !== '');
        if (hasActiveFlip) return;
        captureFlipSnapshot();
    }, [ideas, sortMode]);

    // Before browser paint: FLIP surviving nodes into place after any add, delete, or reorder.
    // New positions are captured HERE (before the FLIP transform is applied) so the
    // snapshot always holds the true final positions — not the CSS-transition FROM value
    // that getBoundingClientRect returns when called mid-transition inside the rAF.
    useLayoutEffect(() => {
        if (!ideaNodesRef.current || flipSnapshot.current.size === 0) return;
        const prevSet = new Set(prevFlipIds.current);

        const nodes = ideaNodesRef.current.querySelectorAll<HTMLElement>('[data-flip-id]');

        // Read final positions now, before any transform is applied.
        const nextSnap = new Map<number, { top: number; left: number }>();
        const nextIds: number[] = [];
        nodes.forEach(el => {
            const flipId = Number(el.dataset.flipId);
            const rect = el.getBoundingClientRect();
            nextSnap.set(flipId, { top: rect.top, left: rect.left });
            nextIds.push(flipId);
        });

        // Skip if no IDs in common (full list replacement — e.g. navigation to a new root).
        const hasCommon = nextIds.some(id => prevSet.has(id));
        if (!hasCommon) {
            flipSnapshot.current = nextSnap;
            prevFlipIds.current = nextIds;
            return;
        }

        // Skip if the id sequence itself didn't change — this wasn't an add, delete, or
        // reorder, just an in-place content edit (e.g. renaming a note) that happened to
        // change a card's height. Animating a slide for every sibling that got pushed by
        // the reflow reads as the whole grid flickering, so let the browser reflow normally.
        const isSameSequence = nextIds.length === prevFlipIds.current.length &&
            nextIds.every((id, i) => id === prevFlipIds.current[i]);
        if (isSameSequence) {
            flipSnapshot.current = nextSnap;
            prevFlipIds.current = nextIds;
            return;
        }

        const toAnimate: HTMLElement[] = [];

        nodes.forEach(el => {
            const flipId = Number(el.dataset.flipId);
            if (!prevSet.has(flipId)) return; // new node — let its fade-in play instead
            const prev = flipSnapshot.current.get(flipId);
            const curr = nextSnap.get(flipId);
            if (!prev || !curr) return;
            const dx = prev.left - curr.left;
            const dy = prev.top - curr.top;
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                el.style.transform = `translate(${dx}px, ${dy}px)`;
                el.style.transition = 'none';
                toAnimate.push(el);
            }
        });

        // Commit the new snapshot before the animation starts.
        flipSnapshot.current = nextSnap;
        prevFlipIds.current = nextIds;

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
    }, [ideas, sortMode]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 10,
            },
        })
    );

    return (
        <DndContext onDragOver={handleDragOver} onDragCancel={clearBlockedCursor} onDragEnd={handleDragEnd} collisionDetection={nodePointerCollision} modifiers={[restrictToTopLeftRight]} sensors={sensors}>
            <section className="ideaPage">
                <section className="left">
                    <Navbar side="left" setShowHelp={handleToggleHelp} showHelp={showHelp} setShowPatchNotes={handleTogglePatchNotes} showPatchNotes={showPatchNotes} showMindMap={showMindMap} isNewPatchNotes={isNewPatchNotes} hasNewHelp={hasNewHelp} onSearch={() => setShowSearch(true)} />
                    <Trash hidden={showMindMap} />
                </section>

                    <section className={`mid${showMindMap ? ' mid--map-open' : ''}`}>
                        <section className="top">
                            <Breadcrumb onOpenMap={() => setShowMindMap(true)} />
                            <section className="rootHolder">
                                <section className="rootAdditionalButtons">
                                    <button className={`back neobrutal-button ${rootId === 1 ? 'layerZero' : ''}`} onClick={() => { if (rootId !== 1) navigateToId(getParentID(rootId)); }} tabIndex={rootId === 1 ? -1 : undefined} aria-hidden={rootId === 1 ? true : undefined}><img src="/images/ArrowBack.svg" alt="Go Back To Previous Idea" className="backImg" /> Back</button>
                                    <button className={`sort-btn neobrutal-button${sortMode === 'recent' ? ' sort-btn--recent' : ''}${rootId === 1 ? ' sort-btn--at-root' : ''}`} onClick={toggleSortMode} title={sortMode === 'priority' ? 'Sorted by priority. Click to sort oldest first.' : 'Sorted oldest first. Click to sort by priority.'}><img src="/images/sort.svg" alt="" className="sort-btn-img" />{sortMode === 'priority' ? 'Priority' : 'Oldest'}</button>
                                    <button className={`sort-btn copy-all-btn neobrutal-button${copiedAll ? ' copy-all-btn--done' : ''}${rootId === 1 ? ' sort-btn--at-root' : ''}`} onClick={() => copyChildren(rootId).then((ok) => {
                                        if (!ok) return;
                                        window.clearTimeout(copiedAllTimer.current);
                                        setCopiedAll(true);
                                        copiedAllTimer.current = window.setTimeout(() => setCopiedAll(false), 1200);
                                    })} aria-disabled={ideas.length === 0} title="Copy every idea in here as a numbered list"><span className="copy-all-glyph" aria-hidden="true">
                                        <svg className="glyph-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
                                        <svg className="glyph-done" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                                    </span>{copiedAll ? 'Copied' : 'Copy all'}</button>
                                </section>
                                <RootTitle name={rootName} renamable={rootId !== 1} onRename={() => setRenameModalOpen(true)} />
                                <div className="rootSpacer">
                                    {(rootId !== 1) && <LastIdea lastRootName={lastRootName} />}
                                </div>
                            </section>
                        </section>

                        <section className="bottom">
                            <main className="ideaSpace">
                                <section className={`ideaNodes${!nodesVisible ? ' ideaNodes--fade' : ''}${isLoadingIdeas ? ' ideaNodes--loading' : ''}`} ref={ideaNodesRef}>
                                    {isLoadingIdeas ? (
                                        <div className="ideaNode-loading" role="status" aria-label="Loading ideas">
                                            <span className="ideaNode-loading-dot" />
                                            <span className="ideaNode-loading-dot" />
                                            <span className="ideaNode-loading-dot" />
                                        </div>
                                    ) : displayedIdeas?.map((idea: IdeaType) => (
                                        <div key={idea.id} data-flip-id={idea.id} className={isNoteWide(idea) ? 'ideaNodes-wide-item' : undefined}>
                                            <IdeaNode
                                                idea={idea}
                                                isLeaf={checkIfIdeaIsLeaf(idea.id)}
                                            />
                                        </div>
                                    ))}
                                </section>
                            </main>
                        </section>
                    </section>

                <section className="right">
                    <Navbar side="right" setShowHelp={handleToggleHelp} showHelp={showHelp} setShowPatchNotes={handleTogglePatchNotes} showPatchNotes={showPatchNotes} showMindMap={showMindMap} isNewPatchNotes={isNewPatchNotes} hasNewHelp={hasNewHelp} onSearch={() => setShowSearch(true)} />
                    <Help showHelp={showHelp} onClose={() => setShowHelp(false)} onSeenChange={() => setHasNewHelp(firstUnseenHelpScreen(auth.currentUser?.uid) >= 0)} />
                    <PatchNotes showPatchNotes={showPatchNotes} />
                </section>
            </section>
            {isMobileUI && <MobileMindMap />}
            <SyncStatusBanner />
            {!isMobileUI && <UndoToast />}
            <MindMap onClose={() => setShowMindMap(false)} visible={showMindMap} reveal={mapReveal} />
            <RenameModal />
            <MoveModal />
            {!isMobileUI && (
                <>
                    <SearchModal
                        open={showSearch}
                        onClose={() => setShowSearch(false)}
                        onPick={pickSearchResult}
                        commands={[
                            { label: 'Create Shortcut', hint: 'C', run: openCreate },
                            ...(rootId !== 1 ? [{ label: 'Go to the top level', run: () => navigateToId(1) }] : []),
                            { label: 'Toggle mind map', hint: 'G', run: () => setShowMindMap(prev => !prev) },
                            { label: 'Keyboard shortcuts', hint: '/', run: () => setShowShortcuts(true) },
                        ]}
                    />
                    <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
                </>
            )}
            {!isMobileUI && <CardMenu />}
            <LinkChangeModal />
            <DeleteConfirmModal />
            <ChecklistModal />
            <CreationModal handleIdeaCreation={handleIdeaCreation} handleChecklistCreation={handleChecklistCreation} handleNoteCreation={handleNoteCreation} />
            <OnboardingModal />
            <ProfileModal />
            <SessionEndedModal />
            <UpgradeModal />
            <LazyCheckoutModal />
            {celebrationPlan && (
                <UpgradeCelebrationModal plan={celebrationPlan} onClose={() => setCelebrationPlan(null)} />
            )}
            {implementedTitles && (
                <FeatureImplementedModal titles={implementedTitles} onClose={() => setImplementedTitles(null)} />
            )}
        </DndContext>
    );
}

export default Idea;
