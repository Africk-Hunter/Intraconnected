import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { IdeaType, ChecklistItem, getIdeaLink, updateChecklistItems, scheduleChecklistFirebaseWrite, cleanLink, updateIdeaPriority, schedulePriorityFirebaseWrite, isNoteMode, isNoteWide, updateIdeaName, updateIdeaNameInFirebase } from '../utilities';

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

interface SortableNodeItemProps {
    item: ChecklistItem;
    onToggle: (e: React.MouseEvent, id: string) => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
    onEdit: (id: string, newText: string) => void;
    onLinkChange: (id: string, link: string) => void;
    onCopy: (text: string) => void;
}

function SortableNodeItem({ item, onToggle, onDelete, onEdit, onLinkChange, onCopy }: SortableNodeItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const [isEditing, setIsEditing] = useState(false);
    const [editDraft, setEditDraft] = useState('');
    const editInputRef = useRef<HTMLTextAreaElement>(null);
    const [copied, setCopied] = useState(false);
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

    function startEdit(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        setEditDraft(item.text);
        setIsEditing(true);
    }

    function commitEdit() {
        const text = editDraft.trim();
        if (text && text !== item.text) onEdit(item.id, text);
        setIsEditing(false);
    }

    function openLink(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        setLinkDraft(item.link ?? '');
        setIsLinking(true);
    }

    function commitLink() {
        if (cancelLinkRef.current) { cancelLinkRef.current = false; return; }
        const url = linkDraft.trim() ? cleanLink(linkDraft.trim()) : '';
        if (url !== (item.link ?? '')) onLinkChange(item.id, url);
        setIsLinking(false);
    }

    return (
        <li ref={setNodeRef} style={style} className={`checklist-item${item.checked ? ' checklist-item--checked' : ''}`}>
            <button className="checklist-drag" {...attributes} {...listeners}>
                <img src="images/DragHandle.svg" alt="" />
            </button>
            <button className="checklist-checkbox" onClick={e => onToggle(e, item.id)}>
                {item.checked ? '☑' : '☐'}
            </button>
            {isEditing ? (
                <textarea
                    ref={editInputRef}
                    className="checklist-item-edit-input"
                    value={editDraft}
                    onChange={e => {
                        setEditDraft(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); commitEdit(); } if (e.key === 'Escape') setIsEditing(false); }}
                    onClick={e => e.stopPropagation()}
                    maxLength={200}
                />
            ) : (
                item.link ? (
                    <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="checklist-item-text checklist-item-text--linked"
                        onClick={e => e.stopPropagation()}
                    >
                        {item.text}
                    </a>
                ) : (
                    <span className="checklist-item-text">{item.text}</span>
                )
            )}
            {!isEditing && (
                <div className={`checklist-item-actions${item.link ? ' has-active-link' : ''}`}>
                    <button className="checklist-item-copy" onClick={e => { e.stopPropagation(); e.preventDefault(); onCopy(item.text); setCopied(true); setTimeout(() => setCopied(false), 1000); }} title="Copy text">
                        <img src={copied ? 'images/Checkmark.svg' : 'images/CopyIcon.svg'} alt="Copy" />
                    </button>
                    <button
                        className={`checklist-item-link${item.link ? ' checklist-item-link--active' : ''}`}
                        onClick={e => { e.stopPropagation(); e.preventDefault(); isLinking ? setIsLinking(false) : openLink(e); }}
                        title={item.link ? 'Edit link' : 'Add link'}
                    >
                        <img src="images/LinkBlack.svg" alt="Link" />
                    </button>
                    <button className="checklist-item-edit" onClick={startEdit} title="Rename">
                        <img src="images/Pen.svg" alt="Rename" />
                    </button>
                    <button className="checklist-item-delete" onClick={e => onDelete(e, item.id)} title="Delete">
                        <img src="images/Trash.svg" alt="Delete" />
                    </button>
                </div>
            )}
            {isLinking && (
                <div className="checklist-item-link-row" onClick={e => { e.stopPropagation(); e.preventDefault(); }}>
                    <input
                        ref={linkInputRef}
                        className="checklist-item-link-input"
                        value={linkDraft}
                        onChange={e => setLinkDraft(e.target.value)}
                        onBlur={commitLink}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitLink(); }
                            if (e.key === 'Escape') { cancelLinkRef.current = true; setIsLinking(false); }
                        }}
                        onClick={e => e.stopPropagation()}
                        placeholder="Paste URL, press Enter"
                        maxLength={500}
                    />
                    {item.link && (
                        <button
                            className="checklist-item-link-clear"
                            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onLinkChange(item.id, ''); setIsLinking(false); }}
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

const IdeaNode: React.FC<IdeaNodeProps> = ({ idea, isLeaf }) => {
    const { navigateToIdea, setRenameModalOpen, setLinkChangeModalOpen, setCurrentLinkID, setCurrentLink, setCurrentNameChangeId, setSelectedIdeaName, setNewIdeaSwitch, setChecklistModalId, pendingDeleteId } = useIdeaContext();

    const { id, content: title } = idea;
    const link = getIdeaLink(idea);
    const isChecklist = idea.type === 'checklist';
    const noteTitle = (idea as { noteTitle?: string }).noteTitle ?? '';

    const [copyPath, setCopyPath] = useState('images/CopyIcon.svg');
    const [addItemDraft, setAddItemDraft] = useState('');
    const [localItems, setLocalItems] = useState<ChecklistItem[]>(isChecklist ? idea.items : []);
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

    const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(idea.priority);
    const [isRibbonAnimating, setIsRibbonAnimating] = useState(false);
    const pendingResort = useRef(false);
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
        navigateToIdea(id, title);
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
        disabled: isMobile || isChecklist || noteMode,
    });
    const setNodeRef = (node: HTMLElement | null) => {
        setDraggableRef(node);
        setDroppableRef(node);
    };
    const isBeingDraggedOver = isOver && active?.id !== `idea-${id}`;
    const draggableStyle = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition: 'none',
        cursor: isChecklist && !isDragging ? undefined : 'grabbing',
    };
    const dropStyle = {
        border: isBeingDraggedOver ? '3px dashed #000' : undefined,
        transition: isBeingDraggedOver ? 'scale 0.2s ease-in-out, border 0.2s ease-in-out' : undefined,
        scale: isBeingDraggedOver ? '1.15' : undefined,
    };
    const pendingStyle = isHidden ? { opacity: 0, pointerEvents: 'none' as const } : {};
    const combinedStyle = { ...draggableStyle, ...dropStyle, ...pendingStyle };
    const fadeInClass = isFadingIn ? ' ideaNode--fade-in' : '';
    const priorityClass = priority ? ' ideaNode--has-priority' : '';

    function copyToClipboard(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        const textToCopy = link !== '' ? link : title;
        navigator.clipboard.writeText(textToCopy).then(() => {
            setTimeout(() => setCopyPath('images/CopyIcon.svg'), 1000);
            setCopyPath('images/Checkmark.svg');
        });
    }

    function handleNodeClick(e: React.MouseEvent) {
        if (link !== '') {
            e.preventDefault();
            window.open(link, '_blank', 'noopener,noreferrer');
            return;
        }
        makeRoot();
    }

    function changeLink(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        setCurrentLinkID(id);
        setCurrentLink(link);
        setLinkChangeModalOpen(true);
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
        updateIdeaNameInFirebase(id, newBody).then(() => {
            updateIdeaName(id, newBody);
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

    function cyclePriority(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        if (isRibbonAnimating) return;
        const next = priority === undefined ? 3 : priority === 3 ? 2 : priority === 2 ? 1 : undefined;
        updateIdeaPriority(id, next);
        schedulePriorityFirebaseWrite(id, next);
        pendingResort.current = true;
        setIsRibbonAnimating(true);
        setTimeout(() => {
            setIsRibbonAnimating(false);
            setPriority(next);
        }, 180);
    }

    function flushResort() {
        if (!pendingResort.current) return;
        pendingResort.current = false;
        setNewIdeaSwitch(prev => !prev);
    }

    function toggleItem(e: React.MouseEvent, itemId: string) {
        e.stopPropagation();
        e.preventDefault();
        const newItems = localItems.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
        scheduleChecklistFirebaseWrite(id, newItems);
    }

    function commitAddItem() {
        const text = addItemDraft.trim();
        if (!text) return;
        const newItem: ChecklistItem = { id: String(Date.now()), text, checked: false };
        const newItems = [...localItems, newItem];
        setLocalItems(newItems);
        setAddItemDraft('');
        updateChecklistItems(id, newItems);
        scheduleChecklistFirebaseWrite(id, newItems);
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

    function deleteItem(e: React.MouseEvent, itemId: string) {
        e.stopPropagation();
        e.preventDefault();
        const newItems = localItems.filter(item => item.id !== itemId);
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
        scheduleChecklistFirebaseWrite(id, newItems);
    }

    function editItem(itemId: string, newText: string) {
        const newItems = localItems.map(item =>
            item.id === itemId ? { ...item, text: newText } : item
        );
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
        scheduleChecklistFirebaseWrite(id, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function linkChangeItem(itemId: string, link: string) {
        const newItems = localItems.map(item =>
            item.id === itemId ? { ...item, link: link || undefined } : item
        );
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
        scheduleChecklistFirebaseWrite(id, newItems);
    }

    function handleItemDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = localItems.findIndex(i => i.id === active.id);
        const newIndex = localItems.findIndex(i => i.id === over.id);
        const newItems = arrayMove(localItems, oldIndex, newIndex);
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
        scheduleChecklistFirebaseWrite(id, newItems);
    }

    if (isChecklist) {
        return (
            <div
                ref={setNodeRef}
                style={combinedStyle}
                className={`neobrutal-button ideaNode checklist${fadeInClass}${priorityClass}`}
                onMouseLeave={flushResort}
                {...attributes}
                {...listeners}
            >
                <button className={`priority-ribbon priority-ribbon--${priority ? `p${priority}` : 'none'}${isRibbonAnimating ? ' priority-ribbon--animating' : ''}`} onClick={cyclePriority} onPointerDown={e => e.stopPropagation()} title={priority ? `Priority ${priority} — click to change` : 'Click to set priority'} />
                <div className="checklist-header" onClick={() => setChecklistModalId(id)}>
                    <span className="checklist-title-text">{title}</span>
                    <button className="renameButtonNode copy" onClick={changeName}>
                        <img src='images/Pen.svg' alt="Rename" className="copyImg" />
                    </button>
                </div>
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
                                    <SortableNodeItem
                                        key={item.id}
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
                            <button className="checklist-expand-btn" onClick={e => { e.stopPropagation(); e.preventDefault(); setIsChecklistExpanded(true); }}>
                                Show more ▾
                            </button>
                        </div>
                    )}
                </div>
                {needsChecklistExpand && isChecklistExpanded && (
                    <button className="checklist-expand-btn checklist-expand-btn--collapse" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); e.preventDefault(); setIsChecklistExpanded(false); }}>
                        Show less ▴
                    </button>
                )}
                <div className="checklist-add" onClick={e => e.stopPropagation()}>
                    <input
                        ref={addInputRef}
                        className="checklist-add-input"
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
                onMouseLeave={flushResort}
                {...attributes}
                {...listeners}
            >
                <button className={`priority-ribbon priority-ribbon--${priority ? `p${priority}` : 'none'}${isRibbonAnimating ? ' priority-ribbon--animating' : ''}`} onClick={cyclePriority} onPointerDown={e => e.stopPropagation()} title={priority ? `Priority ${priority} — click to change` : 'Click to set priority'} />
                <div className="note-main">
                    <div className="note-header">
                        <div className="note-header-main">
                            <span
                                className="note-title-text"
                                onClick={changeName}
                            >
                                {noteTitle}
                            </span>
                            <button className="renameButtonNode copy" onClick={changeName}>
                                <img src='images/Pen.svg' alt="Rename" className="copyImg" />
                            </button>
                        </div>
                        <button className="note-header-copy copy" onClick={copyToClipboard} title="Copy note content">
                            <img src={copyPath} alt="Copy Note Content" className="copyImg" />
                        </button>
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
        <div onClick={handleNodeClick} ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}${fadeInClass}${priorityClass}`} onMouseLeave={flushResort} {...attributes} {...listeners}>
            <button className={`priority-ribbon priority-ribbon--${priority ? `p${priority}` : 'none'}${isRibbonAnimating ? ' priority-ribbon--animating' : ''}`} onClick={cyclePriority} title={priority ? `Priority ${priority} — click to change` : 'Click to set priority'} />
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
                {(isLeaf || link !== '') && <button className="editLink copy" onClick={changeLink}><img src='images/LinkBlack.svg' alt="Change Link" className="copyImg" /></button>}
                <button className="renameButtonNode copy" onClick={changeName}><img src='images/Pen.svg' alt="Rename" className="copyImg" /></button>
                <button className="copy" onClick={copyToClipboard}><img src={copyPath} alt={link !== '' ? 'Copy Link' : 'Copy Idea Content'} className="copyImg" /></button>
            </div>
        </div>
    );
};

export default IdeaNode;
