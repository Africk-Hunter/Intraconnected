import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import AnimatedOverlay from '../AnimatedOverlay';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useIdeaContext } from '../../context/IdeaContext';
import { ChecklistItem, fetchFullIdeaList, updateChecklistItems, scheduleChecklistFirebaseWrite, cleanLink } from '../../utilities';

interface SortableItemProps {
    item: ChecklistItem;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (id: string, newText: string) => void;
    onLinkChange: (id: string, link: string) => void;
}

function SortableChecklistItem({ item, onToggle, onDelete, onEdit, onLinkChange }: SortableItemProps) {
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
        if (text && text !== item.text) onEdit(item.id, text);
        setIsEditing(false);
    }

    function openLink() {
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
        <li ref={setNodeRef} style={style} className={`checklistModal-item${item.checked ? ' checklistModal-item--checked' : ''}`}>
            <button className="checklistModal-drag" {...attributes} {...listeners} aria-label="Drag to reorder">
                <img src="images/DragHandle.svg" alt="" />
            </button>
            <button className="checklistModal-cb" onClick={() => onToggle(item.id)}>
                {item.checked ? '☑' : '☐'}
            </button>
            {isEditing ? (
                <textarea
                    ref={editInputRef}
                    className="checklistModal-item-edit-input"
                    value={editDraft}
                    onChange={e => {
                        setEditDraft(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') setIsEditing(false); }}
                    maxLength={200}
                />
            ) : (
                item.link ? (
                    <a href={item.link} target="_blank" rel="noreferrer" className="checklistModal-item-text checklistModal-item-text--linked">
                        {item.text}
                    </a>
                ) : (
                    <span className="checklistModal-item-text">{item.text}</span>
                )
            )}
            {!isEditing && (
                <>
                    <button
                        className={`checklistModal-link-btn${item.link ? ' checklistModal-link-btn--active' : ''}`}
                        onClick={() => isLinking ? setIsLinking(false) : openLink()}
                        title={item.link ? 'Edit link' : 'Add link'}
                    >
                        <img src="images/LinkBlack.svg" alt="Link" />
                    </button>
                    <button className="checklistModal-edit-item" onClick={startEdit}>
                        <img src="images/Pen.svg" alt="Edit" />
                    </button>
                </>
            )}
            <button className="checklistModal-del" onClick={() => onDelete(item.id)}>
                <img src="images/Trash.svg" alt="Delete" />
            </button>
            {isLinking && (
                <div className="checklistModal-item-link-row">
                    <input
                        ref={linkInputRef}
                        className="checklistModal-item-link-input"
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
                            className="checklistModal-item-link-clear"
                            onMouseDown={e => { e.preventDefault(); onLinkChange(item.id, ''); setIsLinking(false); }}
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

function ChecklistModal() {
    const {
        checklistModalId, setChecklistModalId,
        setCurrentNameChangeId, setSelectedIdeaName, setRenameModalOpen,
        setNewIdeaSwitch,
    } = useIdeaContext();

    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [title, setTitle] = useState('');
    const [draft, setDraft] = useState('');
    const addInputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        if (checklistModalId === null) return;
        const idea = fetchFullIdeaList().find(i => i.id === checklistModalId);
        if (!idea || idea.type !== 'checklist') return;
        setTitle(idea.content);
        setItems(idea.items);
        setDraft('');
        setTimeout(() => addInputRef.current?.focus(), 50);
    }, [checklistModalId]);

    function close() { setChecklistModalId(null); }

    function toggleItem(itemId: string) {
        const newItems = items.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        setItems(newItems);
        updateChecklistItems(checklistModalId!, newItems);
        scheduleChecklistFirebaseWrite(checklistModalId!, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function deleteItem(itemId: string) {
        const newItems = items.filter(item => item.id !== itemId);
        setItems(newItems);
        updateChecklistItems(checklistModalId!, newItems);
        scheduleChecklistFirebaseWrite(checklistModalId!, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function addItem() {
        const text = draft.trim();
        if (!text) return;
        const newItems = [...items, { id: String(Date.now()), text, checked: false }];
        setItems(newItems);
        setDraft('');
        updateChecklistItems(checklistModalId!, newItems);
        scheduleChecklistFirebaseWrite(checklistModalId!, newItems);
        setNewIdeaSwitch(prev => !prev);
        addInputRef.current?.focus();
    }

    function editItem(itemId: string, newText: string) {
        const newItems = items.map(item =>
            item.id === itemId ? { ...item, text: newText } : item
        );
        setItems(newItems);
        updateChecklistItems(checklistModalId!, newItems);
        scheduleChecklistFirebaseWrite(checklistModalId!, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function linkChangeItem(itemId: string, link: string) {
        const newItems = items.map(item =>
            item.id === itemId ? { ...item, link: link || undefined } : item
        );
        setItems(newItems);
        updateChecklistItems(checklistModalId!, newItems);
        scheduleChecklistFirebaseWrite(checklistModalId!, newItems);
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        setItems(newItems);
        updateChecklistItems(checklistModalId!, newItems);
        scheduleChecklistFirebaseWrite(checklistModalId!, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function openRename() {
        setCurrentNameChangeId(checklistModalId!);
        setSelectedIdeaName(title);
        setRenameModalOpen(true);
        close();
    }

    const checkedCount = items.filter(i => i.checked).length;

    return (
        <AnimatedOverlay open={checklistModalId !== null} scrollable onClick={close}>
            <div className="modal neobrutal checklistModal" onClick={e => e.stopPropagation()}>
                <div className="checklistModal-title-row">
                    <span className="checklistModal-title">{title}</span>
                    <span className="checklistModal-progress">{checkedCount}/{items.length}</span>
                    <button className="checklistModal-rename copy" onClick={openRename} title="Rename">
                        <img src="images/Pen.svg" alt="Rename" className="copyImg" />
                    </button>
                </div>
                <div className="contentHolder checklistModal-body">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                        modifiers={[restrictToVerticalAxis]}
                    >
                        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            <ul className="checklistModal-items">
                                {items.map(item => (
                                    <SortableChecklistItem
                                        key={item.id}
                                        item={item}
                                        onToggle={toggleItem}
                                        onDelete={deleteItem}
                                        onEdit={editItem}
                                        onLinkChange={linkChangeItem}
                                    />
                                ))}
                                {items.length === 0 && (
                                    <li className="checklistModal-empty">No items yet.</li>
                                )}
                            </ul>
                        </SortableContext>
                    </DndContext>
                    <input
                        ref={addInputRef}
                        className="checklistModal-add-input"
                        placeholder="+ Add item"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                        maxLength={200}
                    />
                </div>
                <section className="modalButtons">
                    <button className="modalButton cancel neobrutal-button" onClick={close}>Close</button>
                    <button className="modalButton continue neobrutal-button" onClick={addItem} disabled={!draft.trim()}>Add</button>
                </section>
            </div>
        </AnimatedOverlay>
    );
}

export default ChecklistModal;
