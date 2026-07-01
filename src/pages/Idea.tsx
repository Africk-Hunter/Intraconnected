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
import type { Modifier, CollisionDetection } from '@dnd-kit/core';
import { DndContext, PointerSensor, useSensor, useSensors, rectIntersection } from '@dnd-kit/core';

// Custom Libraries
import { auth } from '../firebaseConfig';
import { useIdeaContext } from '../context/IdeaContext';
import changelog from '../CHANGELOG.md?raw';
import { parseChangelog } from '../utilities/parseChangelog';
import { isPatchNotesNew, markPatchNotesSeen, syncPatchNotesFromFirebase } from '../utilities/patchNotesState';
import { getDEK, loadDEKFromSession } from '../utilities/dekStore';
import {
    fetchFullIdeaList,
    handleIdeaCreation,
    handleChecklistCreation,
    fetchFromFirebaseAndOrganizeIdeas,
    getIdeasByParentID,
    IdeaType,
    updateIdeaParentId,
    updateIdeaPriority,
    schedulePriorityFirebaseWrite,
    getParentID,
    getNameFromID,
    checkIfIdeaIsLeaf,
    getIdeaLink,
    sortIdeas,
} from '../utilities/index';
import LinkChangeModal from '../components/modals/LinkChangeModal';
import DeleteConfirmModal from '../components/modals/DeleteConfirmModal';
import ChecklistModal from '../components/modals/ChecklistModal';
import FeatureImplementedModal from '../components/modals/FeatureImplementedModal';
import OnboardingModal from '../components/modals/OnboardingModal';
import ProfileModal from '../components/modals/ProfileModal';
import MobileMindMap from '../components/MobileMindMap';
import MindMap from '../components/MindMap';
import { checkAndMarkImplementedFeatures } from '../utilities/firebase/featureRequests';

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
    const [initialFetch, setInitialFetch] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showPatchNotes, setShowPatchNotes] = useState(false);
    const [showMindMap, setShowMindMap] = useState(false);
    const [lastRootName, setLastRootName] = useState('');
    const [isNewPatchNotes, setIsNewPatchNotes] = useState(() =>
        isPatchNotesNew(auth.currentUser?.uid, _changelogEntries)
    );
    const [implementedTitles, setImplementedTitles] = useState<string[] | null>(null);
    const [sortMode, setSortMode] = useState<'priority' | 'recent'>(() =>
        (localStorage.getItem('idea_sort_mode') as 'priority' | 'recent') ?? 'priority'
    );
    const [rootPriority, setRootPriority] = useState<1 | 2 | 3 | undefined>(undefined);

    const ideaNodesRef = useRef<HTMLDivElement>(null);
    const flipSnapshot = useRef<Map<number, { top: number; left: number }>>(new Map());
    const prevFlipIds = useRef<number[]>([]);

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        syncPatchNotesFromFirebase(uid, _changelogEntries).then(isNew => setIsNewPatchNotes(isNew));
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

    const { rootId, rootName, setRootName, newIdeaSwitch, rootIdStack, ideas, setIdeas, setRenameModalOpen, setDeleteConfirmModalOpen, pendingDeleteId, setPendingDeleteId, setDeleteModalOrigin, nodesVisible, navigateToId } = useIdeaContext();

    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                try { getDEK(); return; } catch { /* not in memory — check session */ }
                const dekLoaded = await loadDEKFromSession();
                if (!dekLoaded) window.location.href = '/';
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
                    const restored = await loadDEKFromSession();
                    if (!restored) {
                        window.location.href = '/';
                        return;
                    }
                }
                await fetchFromFirebaseAndOrganizeIdeas().then(() => {
                    setInitialFetch(true);
                });
            }

            const loadedIdeas = getIdeasByParentID(rootId);
            if (rootIdStack.current.length === 0) {
                rootIdStack.current.push(rootId);
            }
            setIdeas(loadedIdeas);
        }

        const unsubscribe = auth.onAuthStateChanged(() => {
            init();
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const loadIdeas = async () => {
            setIdeasFromStorage();

            const currentRoot = fetchFullIdeaList().find((idea: IdeaType) => idea.id === rootId);
            if (currentRoot) {
                setRootName(currentRoot.content);
                setRootPriority(currentRoot.priority);
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

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (!active || !over) return;

        const activeId = Number(active.id.split('-')[1]);
        const overId = Number(over.id.split('-')[1]);
        const overIdea = fetchFullIdeaList().find((i: IdeaType) => i.id === overId);
        const overLink = getIdeaLink(overIdea);

        if (over.id === 'trash') {
            const trashEl = document.querySelector('.trashCan');
            if (trashEl) {
                const rect = trashEl.getBoundingClientRect();
                setDeleteModalOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            }
            setPendingDeleteId(activeId);
            setDeleteConfirmModalOpen(true);
        } else if (over.id === 'last-idea') {
            updateIdeaParentId(activeId, getParentID(rootId));
            setIdeasFromStorage();
        } else {
            if (activeId === overId) return;
            if (overLink !== '') return;
            const newParentId = Number(over.id.split('-')[1]);
            updateIdeaParentId(activeId, newParentId);
            setIdeasFromStorage();
        }
    };

    function setIdeasFromStorage() {
        const loadedIdeas = getIdeasByParentID(rootId);
        setIdeas(loadedIdeas);
    }

    function toggleSortMode() {
        const next = sortMode === 'priority' ? 'recent' : 'priority';
        setSortMode(next);
        localStorage.setItem('idea_sort_mode', next);
    }

    function handleRootPriority(p: 1 | 2 | 3) {
        const next: 1 | 2 | 3 | undefined = rootPriority === p ? undefined : p;
        setRootPriority(next);
        updateIdeaPriority(rootId, next);
        schedulePriorityFirebaseWrite(rootId, next);
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
        <DndContext onDragEnd={handleDragEnd} collisionDetection={nodePointerCollision} modifiers={[restrictToTopLeftRight]} sensors={sensors}>
            <section className="ideaPage">
                <section className="left">
                    <Navbar side="left" setShowHelp={handleToggleHelp} showHelp={showHelp} setShowPatchNotes={handleTogglePatchNotes} showPatchNotes={showPatchNotes} setShowMindMap={setShowMindMap} showMindMap={showMindMap} isNewPatchNotes={isNewPatchNotes} />
                    <Trash hidden={showMindMap} />
                </section>

                    <section className={`mid${showMindMap ? ' mid--map-open' : ''}`}>
                        <section className="top">
                            <section className="rootHolder">
                                <section className="rootAdditionalButtons">
                                    <button className={`back neobrutal-button ${rootId === 1 ? 'layerZero' : ''}`} onClick={() => navigateToId(getParentID(rootId))}><img src="/images/ArrowBack.svg" alt="Go Back To Previous Idea" className="backImg" /> Back</button>
                                    <button className={`sort-btn neobrutal-button${sortMode === 'recent' ? ' sort-btn--recent' : ''}${rootId === 1 ? ' sort-btn--at-root' : ''}`} onClick={toggleSortMode}><img src="/images/sort.svg" alt="" className="sort-btn-img" />{sortMode === 'priority' ? 'Priority' : 'Age'}</button>
                                </section>
                                <div className="ideaRoot neobrutal-button" onClick={() => { rootId !== 1 && setRenameModalOpen(true)}}><span className="ideaRoot-text">{rootName}</span></div>
                                <div className="rootSpacer">
                                    {(rootId !== 1) && <LastIdea lastRootName={lastRootName} />}
                                </div>
                            </section>
                        </section>

                        <section className="bottom">
                            <main className="ideaSpace">
                                <section className={`ideaNodes${!nodesVisible ? ' ideaNodes--fade' : ''}`} ref={ideaNodesRef}>
                                    {displayedIdeas?.map((idea: IdeaType) => (
                                        <div key={idea.id} data-flip-id={idea.id}>
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
                    <Navbar side="right" setShowHelp={handleToggleHelp} showHelp={showHelp} setShowPatchNotes={handleTogglePatchNotes} showPatchNotes={showPatchNotes} setShowMindMap={setShowMindMap} showMindMap={showMindMap} isNewPatchNotes={isNewPatchNotes} />
                    <Help showHelp={showHelp} />
                    <PatchNotes showPatchNotes={showPatchNotes} />
                </section>
            </section>
            <MobileMindMap />
            <MindMap onClose={() => setShowMindMap(false)} visible={showMindMap} />
            <RenameModal />
            <LinkChangeModal />
            <DeleteConfirmModal />
            <ChecklistModal />
            <CreationModal handleIdeaCreation={handleIdeaCreation} handleChecklistCreation={handleChecklistCreation} />
            <OnboardingModal />
            <ProfileModal />
            {implementedTitles && (
                <FeatureImplementedModal titles={implementedTitles} onClose={() => setImplementedTitles(null)} />
            )}
        </DndContext>
    );
}

export default Idea;
