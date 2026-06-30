import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { IdeaType, ChecklistItem, getIdeaLink, updateChecklistItems, scheduleChecklistFirebaseWrite, cleanLink, updateIdeaPriority, schedulePriorityFirebaseWrite } from '../utilities';


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

    const [nodeType, setNodeType] = useState('leaf');
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
    const [needsExpand, setNeedsExpand] = useState(false);

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
        setIsExpanded(false);
    }, [title, isLeaf]);

    useEffect(() => {
        if (!textRef.current || !isLeaf || isExpanded) return;
        setNeedsExpand(textRef.current.scrollHeight > textRef.current.clientHeight);
    }, [title, isLeaf, isExpanded]);

    useEffect(() => {
        setIsChecklistExpanded(false);
    }, [id]);

    useEffect(() => {
        if (!checklistItemsRef.current || isChecklistExpanded) return;
        setNeedsChecklistExpand(checklistItemsRef.current.scrollHeight > checklistItemsRef.current.clientHeight);
    }, [localItems, isChecklistExpanded]);

    function makeRoot() {
        navigateToIdea(id, title);
    }

    useEffect(() => {
        determineNodeType();
    }, [id, link, isLeaf, isChecklist]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width: 768px)');
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    function determineNodeType() {
        if (isChecklist) {
            setNodeType('checklist');
            return;
        }
        if (link !== '') {
            setNodeType('link');
            return;
        }
        setNodeType(isLeaf ? 'leaf' : 'parent');
    }

    // Drag and Drop
    const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
        id: `idea-${id}`,
        disabled: isMobile,
    });
    const { isOver, setNodeRef: setDroppableRef, active } = useDroppable({
        id: `idea-${id}`,
        disabled: isMobile || isChecklist,
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
        navigator.clipboard.writeText(title).then(() => {
            setTimeout(() => setCopyPath('images/CopyIcon.svg'), 1000);
            setCopyPath('images/Checkmark.svg');
        });
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
        setSelectedIdeaName(title);
        setRenameModalOpen(true);
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

    return (
        link !== "" ? (
            <a href={link} target='_blank' ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}${fadeInClass}${priorityClass}`} onMouseLeave={flushResort} {...attributes} {...listeners}>
                <button className={`priority-ribbon priority-ribbon--${priority ? `p${priority}` : 'none'}${isRibbonAnimating ? ' priority-ribbon--animating' : ''}`} onClick={cyclePriority} title={priority ? `Priority ${priority} — click to change` : 'Click to set priority'} />
                {title}
                <button className="editLink copy" onClick={changeLink}><img src='images/LinkBlack.svg' alt="Change Link" className="copyImg" /></button>
                <button className="renameButtonNode copy" onClick={changeName}><img src='images/Pen.svg' alt="Rename" className="copyImg" /></button>
                <button className="copy" onClick={e => { e.stopPropagation(); e.preventDefault(); navigator.clipboard.writeText(link).then(() => { setCopyPath('images/Checkmark.svg'); setTimeout(() => setCopyPath('images/CopyIcon.svg'), 1000); }); }}><img src={copyPath} alt="Copy Link" className="copyImg" /></button>
            </a>
        ) : (
            <div onClick={makeRoot} ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}${fadeInClass}${priorityClass}`} onMouseLeave={flushResort} {...attributes} {...listeners}>
                <button className={`priority-ribbon priority-ribbon--${priority ? `p${priority}` : 'none'}${isRibbonAnimating ? ' priority-ribbon--animating' : ''}`} onClick={cyclePriority} title={priority ? `Priority ${priority} — click to change` : 'Click to set priority'} />
                {isLeaf ? (
                    <div ref={textRef} className={`leaf-wrapper${!isExpanded ? ' leaf-wrapper--collapsed' : ''}`}>
                        {title}
                        {needsExpand && !isExpanded && (
                            <div
                                className="leaf-fade-overlay"
                                onClick={e => { e.stopPropagation(); e.preventDefault(); }}
                            >
                                <button
                                    className="leaf-expand-btn"
                                    onClick={e => { e.stopPropagation(); e.preventDefault(); setIsExpanded(true); }}
                                >
                                    Show more ▾
                                </button>
                            </div>
                        )}
                    </div>
                ) : title}
                {isLeaf && needsExpand && isExpanded && (
                    <button
                        className="leaf-expand-btn leaf-expand-btn--collapse"
                        onClick={e => { e.stopPropagation(); e.preventDefault(); setIsExpanded(false); }}
                    >
                        Show less ▴
                    </button>
                )}
                {isLeaf && <button className="editLink copy" onClick={changeLink}><img src='images/LinkBlack.svg' alt="Change Link" className="copyImg" /></button>}
                <button className="renameButtonNode copy" onClick={changeName}><img src='images/Pen.svg' alt="Rename" className="copyImg" /></button>
                <button className="copy" onClick={copyToClipboard}><img src={copyPath} alt="Copy Idea Content" className="copyImg" /></button>
            </div>
        )
    );
};

export default IdeaNode;
