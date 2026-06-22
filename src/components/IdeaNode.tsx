import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { IdeaType, ChecklistItem, getIdeaLink, updateChecklistItems, scheduleChecklistFirebaseWrite, cleanLink } from '../utilities';


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
}

function SortableNodeItem({ item, onToggle, onDelete, onEdit, onLinkChange }: SortableNodeItemProps) {
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
                <>
                    <button
                        className={`checklist-item-link${item.link ? ' checklist-item-link--active' : ''}`}
                        onClick={e => { e.stopPropagation(); e.preventDefault(); isLinking ? setIsLinking(false) : openLink(e); }}
                        title={item.link ? 'Edit link' : 'Add link'}
                    >
                        <img src="images/LinkBlack.svg" alt="Link" />
                    </button>
                    <button className="checklist-item-edit" onClick={startEdit}>
                        <img src="images/Pen.svg" alt="Edit" />
                    </button>
                </>
            )}
            <button className="checklist-item-delete" onClick={e => onDelete(e, item.id)}>
                <img src="images/Trash.svg" alt="Delete" />
            </button>
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
    const { setRootId, setRootName, rootIdStack, setRenameModalOpen, setLinkChangeModalOpen, setCurrentLinkID, setCurrentLink, setCurrentNameChangeId, setSelectedIdeaName, setNewIdeaSwitch, setChecklistModalId, pendingDeleteId } = useIdeaContext();

    const { id, content: title } = idea;
    const link = getIdeaLink(idea);
    const isChecklist = idea.type === 'checklist';

    const [nodeType, setNodeType] = useState('leaf');
    const [copyPath, setCopyPath] = useState('images/CopyIcon.svg');
    const [addItemDraft, setAddItemDraft] = useState('');
    const [localItems, setLocalItems] = useState<ChecklistItem[]>(isChecklist ? idea.items : []);
    const addInputRef = useRef<HTMLInputElement>(null);
    const itemSensors = useSensors(useSensor(PointerSensor));
    const textRef = useRef<HTMLDivElement>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [needsExpand, setNeedsExpand] = useState(false);

    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(max-width: 768px)').matches;
    });

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
        if (isChecklist) {
            setLocalItems(idea.items);
        }
    }, [idea]);

    useEffect(() => {
        setIsExpanded(false);
    }, [title, isLeaf]);

    useEffect(() => {
        if (!textRef.current || !isLeaf || isExpanded) return;
        setNeedsExpand(textRef.current.scrollHeight > textRef.current.clientHeight);
    }, [title, isLeaf, isExpanded]);

    function makeRoot() {
        setRootId(id);
        setRootName(title);
        rootIdStack.current?.push(id);
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
                className={`neobrutal-button ideaNode checklist${fadeInClass}`}
                {...attributes}
                {...listeners}
            >
                <div className="checklist-header" onClick={() => setChecklistModalId(id)}>
                    <span className="checklist-title-text">{title}</span>
                    <button className="renameButtonNode copy" onClick={changeName}>
                        <img src='images/Pen.svg' alt="Rename" className="copyImg" />
                    </button>
                </div>
                <DndContext
                    sensors={itemSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleItemDragEnd}
                    modifiers={[restrictToVerticalAxis]}
                >
                    <SortableContext items={localItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                        <ul className="checklist-items" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                            {localItems.map(item => (
                                <SortableNodeItem
                                    key={item.id}
                                    item={item}
                                    onToggle={toggleItem}
                                    onDelete={deleteItem}
                                    onEdit={editItem}
                                    onLinkChange={linkChangeItem}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
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
            <a href={link} target='_blank' ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}${fadeInClass}`} {...attributes} {...listeners}>
                {title}
                <button className="editLink copy" onClick={changeLink}><img src='images/LinkBlack.svg' alt="Change Link" className="copyImg" /></button>
                <button className="renameButtonNode copy" onClick={changeName}><img src='images/Pen.svg' alt="Rename" className="copyImg" /></button>
                <button className="copy" onClick={copyToClipboard}><img src={copyPath} alt="Copy Idea Content" className="copyImg" /></button>
            </a>
        ) : (
            <div onClick={makeRoot} ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}${fadeInClass}`} {...attributes} {...listeners}>
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
                                    ▾
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
                        ▴
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
