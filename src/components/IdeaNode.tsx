import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useIdeaContext } from '../context/IdeaContext';
import ChecklistItemRow from './ChecklistItemRow';
import { LockIcon, UnlockIcon } from './Icons';
import { useEnteringIds } from '../utilities/idea/useEnteringIds';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { dragPreviewScale } from '../utilities/idea/dragPreview';
import { pushItemDeleteUndo } from '../utilities/idea/checklistUndo';
import { IdeaType, ChecklistItem, getIdeaLink, updateChecklistItems, openIdeaLink, isNoteMode, isNoteWide, updateIdeaName } from '../utilities';

const NOTE_BODY_MAX_LENGTH = 2000;

function cssLengthToPx(value: string, el: Element): number {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return 0;
    if (value.endsWith('rem')) {
        const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        return num * rootSize;
    }
    if (value.endsWith('em')) {
        const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
        return num * fontSize;
    }
    return num;
}

function placeCaretAtEnd(el: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}

interface CaretPointApi {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
}

// Firefox only exposes caretPositionFromPoint; Chrome/Safari only expose caretRangeFromPoint.
function placeCaretAtPoint(el: HTMLElement, x: number, y: number): boolean {
    const doc = document as unknown as CaretPointApi;
    if (doc.caretRangeFromPoint) {
        const range = doc.caretRangeFromPoint(x, y);
        if (!range || !el.contains(range.startContainer)) return false;
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return true;
    }
    if (doc.caretPositionFromPoint) {
        const pos = doc.caretPositionFromPoint(x, y);
        if (!pos || !el.contains(pos.offsetNode)) return false;
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return true;
    }
    return false;
}


interface IdeaNodeProps {
    idea: IdeaType;
    isLeaf: boolean;
}

const IdeaNode: React.FC<IdeaNodeProps> = ({ idea, isLeaf }) => {
    const { navigateToId, setRenameModalOpen, setCurrentNameChangeId, setSelectedIdeaName, setNewIdeaSwitch, setChecklistModalId, pendingDeleteId, setCardMenu } = useIdeaContext();

    const { id, content: title } = idea;
    const link = getIdeaLink(idea);
    const isChecklist = idea.type === 'checklist';
    const noteTitle = (idea as { noteTitle?: string }).noteTitle ?? '';

    const [addItemDraft, setAddItemDraft] = useState('');
    const [localItems, setLocalItems] = useState<ChecklistItem[]>(isChecklist ? idea.items : []);
    const enteringIds = useEnteringIds(localItems);
    const addInputRef = useRef<HTMLInputElement>(null);
    const checklistItemsRef = useRef<HTMLUListElement>(null);
    const [isChecklistExpanded, setIsChecklistExpanded] = useState(false);
    const [needsChecklistExpand, setNeedsChecklistExpand] = useState(false);
    const itemSensors = useSensors(useSensor(PointerSensor));
    const textRef = useRef<HTMLDivElement>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    // Separate from isExpanded so the max-height clamp (leaf-wrapper--collapsed) isn't
    // reapplied until the retract animation actually finishes — applying it the instant
    // isExpanded flips would clamp the box to the collapsed height immediately, making
    // the WAAPI animation play invisibly underneath and read as a snap.
    const [isLeafClamped, setIsLeafClamped] = useState(true);
    const [needsExpand, setNeedsExpand] = useState(false);
    const [leafWrapperHeight, setLeafWrapperHeight] = useState<string | undefined>(undefined);
    const leafAnimFrameRef = useRef<number | null>(null);
    const leafAnimPlaybackRef = useRef<Animation | null>(null);
    const leafCollapseBtnWrapperRef = useRef<HTMLDivElement>(null);
    const [leafCollapseBtnHeight, setLeafCollapseBtnHeight] = useState<string | undefined>(undefined);
    const leafCollapseBtnAnimRef = useRef<Animation | null>(null);

    const noteMode = isNoteMode(idea);
    const [isEditingBody, setIsEditingBody] = useState(false);
    const bodyEditRef = useRef<HTMLDivElement>(null);
    const bodyEditClickPosRef = useRef<{ x: number; y: number } | null>(null);
    const noteBodyRef = useRef<HTMLDivElement>(null);
    const [isNoteExpanded, setIsNoteExpanded] = useState(false);
    const [needsNoteExpand, setNeedsNoteExpand] = useState(false);
    const [noteBodyHeight, setNoteBodyHeight] = useState<string | undefined>(undefined);
    const noteAnimFrameRef = useRef<number | null>(null);
    const noteAnimPlaybackRef = useRef<Animation | null>(null);
    // The "Show less" button stays permanently mounted (never conditionally added/removed —
    // that was an instant layout jump of its own) and instead grows/shrinks its own wrapper
    // height in lockstep with the note-body animation, so it reads as one continuous motion.
    const noteCollapseBtnWrapperRef = useRef<HTMLDivElement>(null);
    const [collapseBtnHeight, setCollapseBtnHeight] = useState<string | undefined>(undefined);
    const collapseBtnAnimRef = useRef<Animation | null>(null);

    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(max-width: 768px)').matches;
    });

    const censored = idea.censored === true;
    // Revealing is per card and per visit: locking, navigating or reloading veils it again.
    const [revealed, setRevealed] = useState(false);
    useEffect(() => { setRevealed(false); }, [id, censored]);
    const veiled = censored && !revealed;

    const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(idea.priority);
    const [isFadingIn, setIsFadingIn] = useState(false);
    const prevPendingDeleteRef = useRef<number | null>(null);

    useEffect(() => {
        const wasThisNodePending = prevPendingDeleteRef.current === id;
        prevPendingDeleteRef.current = pendingDeleteId;

        if (wasThisNodePending && pendingDeleteId !== id) {
            setIsFadingIn(true);
            const t = setTimeout(() => setIsFadingIn(false), 1400);
            return () => clearTimeout(t);
        }
    }, [pendingDeleteId, id]);

    const isHidden = pendingDeleteId === id;

    useEffect(() => {
        setPriority(idea.priority);
        if (isChecklist) setLocalItems(idea.items);
    }, [idea]);

    useEffect(() => {
        if (leafAnimFrameRef.current !== null) cancelAnimationFrame(leafAnimFrameRef.current);
        leafAnimPlaybackRef.current?.cancel();
        leafCollapseBtnAnimRef.current?.cancel();
        setIsExpanded(false);
        setIsLeafClamped(true);
        setLeafWrapperHeight(undefined);
        setLeafCollapseBtnHeight(undefined);
    }, [title, isLeaf]);

    useEffect(() => {
        if (!textRef.current || !isLeaf || isExpanded) return;
        setNeedsExpand(textRef.current.scrollHeight > textRef.current.clientHeight);
    }, [title, isLeaf, isExpanded]);

    useEffect(() => {
        setIsChecklistExpanded(false);
    }, [id]);

    useEffect(() => {
        setIsNoteExpanded(false);
        setIsEditingBody(false);
    }, [id]);

    useEffect(() => {
        const el = noteBodyRef.current;
        if (!el || !noteMode) return;
        // scrollHeight is the note's true content height regardless of any in-progress
        // expand/collapse animation, so this can't race with the height being mid-transition.
        const collapsedVar = getComputedStyle(el).getPropertyValue('--note-collapsed-height').trim() || '12rem';
        const collapsedPx = cssLengthToPx(collapsedVar, el);
        setNeedsNoteExpand(el.scrollHeight > collapsedPx + 1);
    }, [idea, noteMode]);

    useLayoutEffect(() => {
        if (!isEditingBody) return;
        const el = bodyEditRef.current;
        if (!el) return;
        el.innerText = title;
        document.execCommand('defaultParagraphSeparator', false, 'br');
        el.focus();
        const clickPos = bodyEditClickPosRef.current;
        bodyEditClickPosRef.current = null;
        if (!clickPos || !placeCaretAtPoint(el, clickPos.x, clickPos.y)) {
            placeCaretAtEnd(el);
        }
    }, [isEditingBody]);

    useEffect(() => {
        if (!checklistItemsRef.current || isChecklistExpanded) return;
        setNeedsChecklistExpand(checklistItemsRef.current.scrollHeight > checklistItemsRef.current.clientHeight);
    }, [localItems, isChecklistExpanded]);

    function makeRoot() {
        navigateToId(id);
    }

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width: 768px)');
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const nodeType = link !== '' ? 'link' : (isLeaf ? 'leaf' : 'parent');

    // Drag and Drop
    const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
        id: `idea-${id}`,
        disabled: isMobile,
    });
    const { isOver, setNodeRef: setDroppableRef, active } = useDroppable({
        id: `idea-${id}`,
        disabled: isMobile,
    });
    // Checklists, notes and links can't hold children: they stay in collision detection
    // (handleDragEnd refuses the drop) so they can tint red instead of lighting up.
    const canAcceptDrop = !(isChecklist || noteMode || link !== '');
    const nodeElRef = useRef<HTMLElement | null>(null);
    const dragXRef = useRef(0);
    dragXRef.current = transform?.x ?? 0;
    const setNodeRef = (node: HTMLElement | null) => {
        nodeElRef.current = node;
        setDraggableRef(node);
        setDroppableRef(node);
    };
    const isHoveredByDrag = isOver && active?.id !== `idea-${id}`;
    const isBeingDraggedOver = isHoveredByDrag && canAcceptDrop;
    const isBlockedDragOver = isHoveredByDrag && !canAcceptDrop;
    // Where on the card, and at what size, it was grabbed: the picked-up card
    // shrinks around that point so it stays under the pointer.
    const grabRef = useRef({ x: 0, y: 0, scale: 1 });
    const dragListeners = {
        ...listeners,
        onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            grabRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, scale: dragPreviewScale(rect.width, rect.height) };
            listeners?.onPointerDown?.(e);
        },
    };
    // The shrink is part of `transform`, after the translate: the standalone
    // `scale` property is applied outside `transform`, which would scale the
    // drag offset too and make the card lag behind the pointer.
    const shrink = isDragging && grabRef.current.scale < 1 ? grabRef.current.scale : 1;
    // Swing: the shrunken card hangs from the spot it was grabbed. Horizontal
    // pointer speed pushes a damped spring, so it trails the cursor, overshoots
    // and settles. Written straight to a CSS variable each frame (no re-renders).
    const swinging = isDragging && grabRef.current.scale < 1;
    useEffect(() => {
        const el = nodeElRef.current;
        if (!swinging || !el) return;
        const REST = -3, STIFFNESS = 120, DAMPING = 14, SPEED_TO_DEG = 0.008, MAX_DEG = 22;
        let angle = REST, vel = 0, lastX = dragXRef.current, lastT = performance.now(), smoothVx = 0, raf = 0;
        const tick = (now: number) => {
            const dt = Math.min((now - lastT) / 1000, 0.032) || 0.016;
            lastT = now;
            const x = dragXRef.current;
            smoothVx += ((x - lastX) / dt - smoothVx) * 0.12;
            lastX = x;
            const target = Math.max(-MAX_DEG, Math.min(MAX_DEG, REST + smoothVx * SPEED_TO_DEG));
            vel += (STIFFNESS * (target - angle) - DAMPING * vel) * dt;
            angle += vel * dt;
            el.style.setProperty('--swing', `${angle}deg`);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(raf);
            el.style.removeProperty('--swing');
        };
    }, [swinging]);
    const draggableStyle = {
        transform: transform || shrink < 1
            ? `translate3d(${transform?.x ?? 0}px, ${transform?.y ?? 0}px, 0)${shrink < 1 ? ` scale(${shrink}) rotate(var(--swing, -3deg))` : ''}`
            : undefined,
        ...(shrink < 1 ? { transformOrigin: `${grabRef.current.x}px ${grabRef.current.y}px` } : {}),
        transition: 'none',
        // Lift above sibling cards' priority ribbons (z-index 4) while dragging.
        zIndex: isDragging ? 10 : undefined,
        cursor: isChecklist && !isDragging ? undefined : 'grabbing',
    };
    const dropStyle = {
        border: isBeingDraggedOver ? '3px dashed #000' : undefined,
        transition: isBeingDraggedOver ? 'scale 0.2s ease-in-out, border 0.2s ease-in-out' : undefined,
        // Only set when hovered: an explicit `scale: undefined` here would
        // overwrite the drag-preview shrink from draggableStyle in the spread.
        ...(isBeingDraggedOver ? { scale: '1.15' } : {}),
        boxShadow: isBlockedDragOver ? 'inset 0 0 0 100vmax rgba(220, 38, 38, 0.3)' : undefined,
    };
    const pendingStyle = isHidden ? { opacity: 0, pointerEvents: 'none' as const } : {};
    const combinedStyle = { ...draggableStyle, ...dropStyle, ...pendingStyle };
    const fadeInClass = isFadingIn ? ' ideaNode--fade-in' : '';
    const priorityClass = priority ? ' ideaNode--has-priority' : '';

    function handleNodeClick(e: React.SyntheticEvent) {
        if (link !== '') {
            e.preventDefault();
            openIdeaLink(link);
            return;
        }
        makeRoot();
    }

    // Cards are focusable (dnd-kit adds tabIndex), so Enter must do what a click does.
    function handleCardKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            if (veiled) setRevealed(true);
            else if (isChecklist) setChecklistModalId(id);
            else if (!noteMode) handleNodeClick(e);
        }
    }

    function changeName(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        setCurrentNameChangeId(id);
        setSelectedIdeaName(noteMode ? noteTitle : title);
        setRenameModalOpen(true);
    }

    useEffect(() => {
        return () => {
            if (noteAnimFrameRef.current !== null) cancelAnimationFrame(noteAnimFrameRef.current);
            noteAnimPlaybackRef.current?.cancel();
            collapseBtnAnimRef.current?.cancel();
            if (leafAnimFrameRef.current !== null) cancelAnimationFrame(leafAnimFrameRef.current);
            leafAnimPlaybackRef.current?.cancel();
            leafCollapseBtnAnimRef.current?.cancel();
        };
    }, []);

    function animateNoteExpand(expand: boolean) {
        const el = noteBodyRef.current;
        const btnWrapEl = noteCollapseBtnWrapperRef.current;
        if (noteAnimFrameRef.current !== null) cancelAnimationFrame(noteAnimFrameRef.current);
        if (!el) {
            setIsNoteExpanded(expand);
            return;
        }
        // Read the live heights before cancelling any in-flight animations — if one is
        // mid-flight this is its current on-screen position, not where cancelling it
        // would leave things.
        const startHeight = el.getBoundingClientRect().height;
        const btnStartHeight = btnWrapEl ? btnWrapEl.getBoundingClientRect().height : 0;
        noteAnimPlaybackRef.current?.cancel();
        collapseBtnAnimRef.current?.cancel();
        // Pin those heights inline before flipping state, so removing/adding the
        // collapsed class doesn't snap the box before the animation starts.
        setNoteBodyHeight(`${startHeight}px`);
        if (btnWrapEl) setCollapseBtnHeight(`${btnStartHeight}px`);
        setIsNoteExpanded(expand);

        noteAnimFrameRef.current = requestAnimationFrame(() => {
            noteAnimFrameRef.current = requestAnimationFrame(() => {
                const collapsedHeight = cssLengthToPx(
                    getComputedStyle(el).getPropertyValue('--note-collapsed-height').trim() || '12rem',
                    el
                );
                const fullHeight = el.scrollHeight;
                const btnFullHeight = btnWrapEl ? btnWrapEl.scrollHeight : 0;

                let keyframes: Keyframe[];
                let duration: number;
                let btnEasing: string;
                if (expand) {
                    // Tug the screen down like a spring-loaded roller: pull past the stop,
                    // it springs back up short of catching, then pull again and it locks.
                    // Overshoot/retreat scale with the actual expand distance — fixed pixel
                    // amounts either vanished on long notes or, on notes barely past the
                    // threshold, clamped the retreat all the way back to the start (wiping
                    // out the drop and forcing the final leg to cover the whole distance
                    // in a rush, which read as a snap).
                    const delta = Math.max(fullHeight - startHeight, 1);
                    const overshootHeight = fullHeight + Math.max(delta * 0.2, 10);
                    const retreatHeight = startHeight + delta * 0.78;
                    keyframes = [
                        { height: `${startHeight}px`, offset: 0, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' },
                        { height: `${overshootHeight}px`, offset: 0.32, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
                        { height: `${retreatHeight}px`, offset: 0.6, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
                        { height: `${fullHeight}px`, offset: 1 },
                    ];
                    duration = 780;
                    btnEasing = 'cubic-bezier(0.16, 1, 0.3, 1)';
                } else {
                    // Tug it down a bit to release the catch, hold there, then it rolls
                    // back up under its own weight, accelerating as it goes — overshooting
                    // the stop slightly and settling back down, same as the little bounce
                    // at the end of the expand.
                    const travel = Math.max(startHeight - collapsedHeight, 1);
                    const tugHeight = startHeight + Math.max(travel * 0.08, 8);
                    const overshootAmount = Math.min(Math.max(travel * 0.06, 6), 20);
                    const overshootHeight = Math.max(collapsedHeight - overshootAmount, 0);
                    keyframes = [
                        { height: `${startHeight}px`, offset: 0, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
                        { height: `${tugHeight}px`, offset: 0.3, easing: 'linear' },
                        { height: `${tugHeight}px`, offset: 0.45, easing: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)' },
                        { height: `${overshootHeight}px`, offset: 0.85, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' },
                        { height: `${collapsedHeight}px`, offset: 1 },
                    ];
                    duration = 600;
                    btnEasing = 'cubic-bezier(0.55, 0.085, 0.68, 0.53)';
                }

                const animation = el.animate(keyframes, { duration, fill: 'forwards' });
                noteAnimPlaybackRef.current = animation;
                animation.onfinish = () => {
                    // Write the landed height into the inline style before cancelling the
                    // animation, so releasing it doesn't revert to the stale pinned value
                    // while the state update to the real target is still pending.
                    animation.commitStyles();
                    animation.cancel();
                    setNoteBodyHeight(expand ? undefined : `${collapsedHeight}px`);
                    noteAnimPlaybackRef.current = null;
                };

                // The collapse button grows/shrinks over the same duration, right alongside
                // the box, instead of popping in once the box has already finished.
                if (btnWrapEl) {
                    const btnAnimation = btnWrapEl.animate(
                        [
                            { height: `${btnStartHeight}px`, offset: 0 },
                            { height: `${expand ? btnFullHeight : 0}px`, offset: 1 },
                        ],
                        { duration, easing: btnEasing, fill: 'forwards' }
                    );
                    collapseBtnAnimRef.current = btnAnimation;
                    btnAnimation.onfinish = () => {
                        btnAnimation.commitStyles();
                        btnAnimation.cancel();
                        setCollapseBtnHeight(expand ? undefined : '0px');
                        collapseBtnAnimRef.current = null;
                    };
                }
            });
        });
    }

    function animateLeafExpand(expand: boolean) {
        const el = textRef.current;
        const btnWrapEl = leafCollapseBtnWrapperRef.current;
        if (leafAnimFrameRef.current !== null) cancelAnimationFrame(leafAnimFrameRef.current);
        if (!el) {
            setIsExpanded(expand);
            setIsLeafClamped(!expand);
            return;
        }
        // Read the live heights before cancelling any in-flight animations — if one is
        // mid-flight this is its current on-screen position, not where cancelling it
        // would leave things.
        const startHeight = el.getBoundingClientRect().height;
        const btnStartHeight = btnWrapEl ? btnWrapEl.getBoundingClientRect().height : 0;
        leafAnimPlaybackRef.current?.cancel();
        leafCollapseBtnAnimRef.current?.cancel();
        // Pin those heights inline before flipping state, so removing/adding the
        // collapsed class doesn't snap the box before the animation starts.
        setLeafWrapperHeight(`${startHeight}px`);
        // Lift the max-height clamp up front for both directions — collapsing re-applies
        // it only once the animation lands (below), not here, otherwise it clamps the box
        // to the collapsed height instantly and the animation plays invisibly underneath it.
        setIsLeafClamped(false);
        if (btnWrapEl) setLeafCollapseBtnHeight(`${btnStartHeight}px`);
        setIsExpanded(expand);

        leafAnimFrameRef.current = requestAnimationFrame(() => {
            leafAnimFrameRef.current = requestAnimationFrame(() => {
                const collapsedHeight = cssLengthToPx(
                    getComputedStyle(el).getPropertyValue('--leaf-collapsed-height').trim() || '13.9rem',
                    el
                );
                const fullHeight = el.scrollHeight;
                const btnFullHeight = btnWrapEl ? btnWrapEl.scrollHeight : 0;

                const smoothEasing = 'cubic-bezier(0.4, 0, 0.2, 1)';
                const targetHeight = expand ? fullHeight : collapsedHeight;
                const duration = expand ? 350 : 300;
                const keyframes: Keyframe[] = [
                    { height: `${startHeight}px`, offset: 0 },
                    { height: `${targetHeight}px`, offset: 1 },
                ];

                const animation = el.animate(keyframes, { duration, easing: smoothEasing, fill: 'forwards' });
                leafAnimPlaybackRef.current = animation;
                animation.onfinish = () => {
                    // Write the landed height into the inline style before cancelling the
                    // animation, so releasing it doesn't revert to the stale pinned value
                    // while the state update to the real target is still pending.
                    animation.commitStyles();
                    animation.cancel();
                    setLeafWrapperHeight(expand ? undefined : `${collapsedHeight}px`);
                    if (!expand) setIsLeafClamped(true);
                    leafAnimPlaybackRef.current = null;
                };

                // The collapse button grows/shrinks over the same duration, right alongside
                // the box, instead of popping in once the box has already finished.
                if (btnWrapEl) {
                    const btnAnimation = btnWrapEl.animate(
                        [
                            { height: `${btnStartHeight}px`, offset: 0 },
                            { height: `${expand ? btnFullHeight : 0}px`, offset: 1 },
                        ],
                        { duration, easing: smoothEasing, fill: 'forwards' }
                    );
                    leafCollapseBtnAnimRef.current = btnAnimation;
                    btnAnimation.onfinish = () => {
                        btnAnimation.commitStyles();
                        btnAnimation.cancel();
                        setLeafCollapseBtnHeight(expand ? undefined : '0px');
                        leafCollapseBtnAnimRef.current = null;
                    };
                }
            });
        });
    }

    function startBodyEdit(e: React.MouseEvent) {
        bodyEditClickPosRef.current = { x: e.clientX, y: e.clientY };
        setIsEditingBody(true);
    }

    function commitBodyEdit() {
        const el = bodyEditRef.current;
        const newBody = el ? el.innerText : title;
        setIsEditingBody(false);
        if (newBody === title) return;
        updateIdeaName(id, newBody).then(() => {
            setNewIdeaSwitch(prev => !prev);
        }).catch((error) => {
            console.error("Error updating note body: ", error);
        });
    }

    // Pasted content carries its source's fonts/colors/sizes — strip it down to
    // plain text so it always matches the site's default style.
    function handleBodyPaste(e: React.ClipboardEvent<HTMLDivElement>) {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
        handleBodyInput();
    }

    function handleBodyInput() {
        const el = bodyEditRef.current;
        if (!el) return;
        if ((el.innerText ?? '').length > NOTE_BODY_MAX_LENGTH) {
            el.innerText = (el.innerText ?? '').slice(0, NOTE_BODY_MAX_LENGTH);
            placeCaretAtEnd(el);
        }
    }

    function openMenuAt(x: number, y: number) {
        setCardMenu({ id, x, y });
    }

    // Right-click anywhere on the card. Text fields keep the browser's own menu (paste, spell check).
    function handleContextMenu(e: React.MouseEvent) {
        if ((e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return;
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
    }

    // The ⋯ button and the priority ribbon: open the menu just under the button.
    function openMenuFromButton(e: React.MouseEvent<HTMLElement>) {
        e.stopPropagation();
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        openMenuAt(rect.left, rect.bottom + 4);
    }

    const moreButton = (
        <button
            className="card-more"
            type="button"
            aria-label="Idea actions"
            aria-haspopup="menu"
            title="More actions"
            onClick={openMenuFromButton}
            onPointerDown={e => e.stopPropagation()}
        >
            ⋯
        </button>
    );

    // Sits beside ⋯ on a censored idea: tap to peek or to hide it again.
    const censorButton = censored ? (
        <button
            className="card-censor"
            type="button"
            aria-label={veiled ? 'Censored idea, click to show' : 'Hide censored idea'}
            title={veiled ? 'Censored. Click to show' : 'Click to hide again'}
            onClick={e => { e.stopPropagation(); e.preventDefault(); setRevealed(v => !v); }}
            onPointerDown={e => e.stopPropagation()}
        >
            {veiled ? <LockIcon size={18} /> : <UnlockIcon size={18} />}
        </button>
    ) : null;

    const checkedCount = localItems.filter(i => i.checked).length;

    function toggleItem(itemId: string) {
        const newItems = localItems.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
    }

    function commitAddItem() {
        const text = addItemDraft.trim();
        if (!text) return;
        const newItem: ChecklistItem = { id: String(Date.now()), text, checked: false };
        const newItems = [...localItems, newItem];
        setLocalItems(newItems);
        setAddItemDraft('');
        updateChecklistItems(id, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            commitAddItem();
        }
    }

    function copyItem(text: string) {
        navigator.clipboard.writeText(text).catch(() => {});
    }

    function deleteItem(itemId: string) {
        const index = localItems.findIndex(item => item.id === itemId);
        if (index === -1) return;
        const removed = localItems[index];
        const newItems = localItems.filter(item => item.id !== itemId);
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
        pushItemDeleteUndo(id, removed, index, restored => {
            setLocalItems(restored);
            setNewIdeaSwitch(prev => !prev);
        });
    }

    // Grows or shrinks the list to its new height instead of snapping.
    function setChecklistExpanded(next: boolean) {
        const el = checklistItemsRef.current;
        if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setIsChecklistExpanded(next);
            return;
        }
        const from = el.getBoundingClientRect().height;
        flushSync(() => setIsChecklistExpanded(next));
        const to = el.getBoundingClientRect().height;
        if (from === to) return;
        el.style.overflow = 'hidden';
        const anim = el.animate(
            { maxHeight: [`${from}px`, `${to}px`] },
            { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
        anim.onfinish = anim.oncancel = () => { el.style.overflow = ''; };
    }

    function editItem(itemId: string, newText: string) {
        const newItems = localItems.map(item =>
            item.id === itemId ? { ...item, text: newText } : item
        );
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function linkChangeItem(itemId: string, link: string) {
        const newItems = localItems.map(item =>
            item.id === itemId ? { ...item, link: link || undefined } : item
        );
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
    }

    function handleItemDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = localItems.findIndex(i => i.id === active.id);
        const newIndex = localItems.findIndex(i => i.id === over.id);
        const newItems = arrayMove(localItems, oldIndex, newIndex);
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
    }

    if (veiled) {
        const typeClass = isChecklist ? 'checklist' : noteMode ? 'note' : 'leaf';
        return (
            <div
                ref={setNodeRef}
                style={combinedStyle}
                className={`neobrutal-button ideaNode ${typeClass} ideaNode--censored${fadeInClass}${priorityClass}`}
                onClick={() => setRevealed(true)}
                onKeyDown={handleCardKeyDown}
                onContextMenu={handleContextMenu}
                data-idea-id={id} data-dragging={isDragging || undefined}
                {...attributes}
                {...dragListeners}
            >
                <button className={`priority-ribbon priority-ribbon--${priority ? `p${priority}` : 'none'}`} onClick={openMenuFromButton} onPointerDown={e => e.stopPropagation()} title={priority ? `Priority ${priority}. Click for options.` : 'Set priority'} />
                {censorButton}
                {moreButton}
                <div className="ideaNode-content ideaNode-censored">
                    <span className="ideaNode-censored-dots" aria-hidden="true">••••••••</span>
                    <span className="ideaNode-censored-hint">Censored · click to open</span>
                </div>
            </div>
        );
    }

    if (isChecklist) {
        return (
            <div
                ref={setNodeRef}
                style={combinedStyle}
                className={`neobrutal-button ideaNode checklist${fadeInClass}${priorityClass}`}
                onKeyDown={handleCardKeyDown}
                onContextMenu={handleContextMenu}
                data-idea-id={id} data-dragging={isDragging || undefined}
                {...attributes}
                {...dragListeners}
            >
                <button className={`priority-ribbon priority-ribbon--${priority ? `p${priority}` : 'none'}`} onClick={openMenuFromButton} onPointerDown={e => e.stopPropagation()} title={priority ? `Priority ${priority}. Click for options.` : 'Set priority'} />
                {censorButton}
                {moreButton}
                <div className="checklist-header" onClick={() => setChecklistModalId(id)}>
                    <span className="checklist-title-text">{title}</span>
                </div>
                {localItems.length > 0 && (
                    <div
                        className={`checklist-progress${checkedCount === localItems.length ? ' checklist-progress--done' : ''}`}
                        role="progressbar"
                        aria-label="Checklist progress"
                        aria-valuemin={0}
                        aria-valuemax={localItems.length}
                        aria-valuenow={checkedCount}
                    >
                        <div className="checklist-progress-track">
                            <div className="checklist-progress-fill" style={{ transform: `scaleX(${checkedCount / localItems.length})` }} />
                        </div>
                        <span className="checklist-progress-count">{checkedCount}/{localItems.length}</span>
                    </div>
                )}
                <div className="checklist-items-wrapper" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                    <DndContext
                        sensors={itemSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleItemDragEnd}
                        modifiers={[restrictToVerticalAxis]}
                    >
                        <SortableContext items={localItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            <ul ref={checklistItemsRef} className={`checklist-items${!isChecklistExpanded ? ' checklist-items--collapsed' : ''}`}>
                                {localItems.map(item => (
                                    <ChecklistItemRow
                                        key={item.id}
                                        variant="card"
                                        entering={enteringIds.has(item.id)}
                                        item={item}
                                        onToggle={toggleItem}
                                        onDelete={deleteItem}
                                        onEdit={editItem}
                                        onLinkChange={linkChangeItem}
                                        onCopy={copyItem}
                                    />
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                    {needsChecklistExpand && !isChecklistExpanded && (
                        <div className="checklist-fade-overlay">
                            <button className="checklist-expand-btn" onClick={e => { e.stopPropagation(); e.preventDefault(); setChecklistExpanded(true); }}>
                                Show more ▾
                            </button>
                        </div>
                    )}
                </div>
                {needsChecklistExpand && isChecklistExpanded && (
                    <button className="checklist-expand-btn checklist-expand-btn--collapse" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); e.preventDefault(); setChecklistExpanded(false); }}>
                        Show less ▴
                    </button>
                )}
                <div className="checklist-add" onClick={e => e.stopPropagation()}>
                    <input
                        ref={addInputRef}
                        className="checklist-add-input"
                        aria-label="Add item"
                        placeholder="+ Add item"
                        value={addItemDraft}
                        onChange={e => setAddItemDraft(e.target.value)}
                        onKeyDown={handleAddKeyDown}
                        maxLength={200}
                    />
                </div>
            </div>
        );
    }

    if (noteMode) {
        const wideClass = isNoteWide(idea) ? ' ideaNode--wide' : '';
        return (
            <div
                ref={setNodeRef}
                style={combinedStyle}
                className={`neobrutal-button ideaNode note${wideClass}${fadeInClass}${priorityClass}`}
                onContextMenu={handleContextMenu}
                data-idea-id={id} data-dragging={isDragging || undefined}
                {...attributes}
                {...dragListeners}
            >
                <button className={`priority-ribbon priority-ribbon--${priority ? `p${priority}` : 'none'}`} onClick={openMenuFromButton} onPointerDown={e => e.stopPropagation()} title={priority ? `Priority ${priority}. Click for options.` : 'Set priority'} />
                {censorButton}
                {moreButton}
                <div className="note-main">
                    <div className="note-header">
                        <div className="note-header-main">
                            <span
                                className="note-title-text"
                                onClick={changeName}
                            >
                                {noteTitle}
                            </span>
                        </div>
                    </div>
                    <div className="note-body-wrapper" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        {isEditingBody ? (
                            <div
                                key="edit"
                                ref={bodyEditRef}
                                className="note-body-edit"
                                contentEditable
                                suppressContentEditableWarning
                                onInput={handleBodyInput}
                                onPaste={handleBodyPaste}
                                onBlur={commitBodyEdit}
                                onClick={e => e.stopPropagation()}
                            />
                        ) : (
                            <div
                                key="display"
                                ref={noteBodyRef}
                                className={`note-body${needsNoteExpand && !isNoteExpanded ? ' note-body--collapsed' : ''}`}
                                style={{ height: noteBodyHeight }}
                                onClick={e => { e.stopPropagation(); startBodyEdit(e); }}
                            >
                                {title}
                                {needsNoteExpand && (
                                    <div className={`note-fade-overlay${isNoteExpanded ? ' note-fade-overlay--hidden' : ''}`} onClick={e => e.stopPropagation()}>
                                        <button className="note-expand-btn" onClick={e => { e.stopPropagation(); e.preventDefault(); animateNoteExpand(true); }}>
                                            Show more ▾
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {needsNoteExpand && (
                        <div
                            ref={noteCollapseBtnWrapperRef}
                            className={`note-collapse-btn-wrapper${isNoteExpanded ? ' note-collapse-btn-wrapper--expanded' : ''}`}
                            style={{ height: collapseBtnHeight }}
                        >
                            <button className="note-expand-btn note-expand-btn--collapse" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); e.preventDefault(); animateNoteExpand(false); }}>
                                Show less ▴
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div onClick={handleNodeClick} onKeyDown={handleCardKeyDown} onContextMenu={handleContextMenu} data-idea-id={id} data-dragging={isDragging || undefined} ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}${fadeInClass}${priorityClass}`} {...attributes} {...dragListeners}>
            <button className={`priority-ribbon priority-ribbon--${priority ? `p${priority}` : 'none'}`} onClick={openMenuFromButton} title={priority ? `Priority ${priority}. Click for options.` : 'Set priority'} />
                {censorButton}
                {moreButton}
            <div className="ideaNode-content">
                {isLeaf && link === '' ? (
                    <div
                        ref={textRef}
                        className={`leaf-wrapper${isLeafClamped ? ' leaf-wrapper--collapsed' : ''}`}
                        style={{ height: leafWrapperHeight }}
                    >
                        {title}
                        {needsExpand && (
                            <div className={`leaf-fade-overlay${isExpanded ? ' leaf-fade-overlay--hidden' : ''}`} onClick={e => e.stopPropagation()}>
                                <button
                                    className="leaf-expand-btn"
                                    onClick={e => { e.stopPropagation(); e.preventDefault(); animateLeafExpand(true); }}
                                >
                                    Show more ▾
                                </button>
                            </div>
                        )}
                    </div>
                ) : title}
                {isLeaf && link === '' && needsExpand && (
                    <div
                        ref={leafCollapseBtnWrapperRef}
                        className={`leaf-collapse-btn-wrapper${isExpanded ? ' leaf-collapse-btn-wrapper--expanded' : ''}`}
                        style={{ height: leafCollapseBtnHeight }}
                    >
                        <button
                            className="leaf-expand-btn leaf-expand-btn--collapse"
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); e.preventDefault(); animateLeafExpand(false); }}
                        >
                            Show less ▴
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IdeaNode;
