import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useIdeaContext } from '../../context/IdeaContext';
import { ChecklistItem, fetchFullIdeaList, updateChecklistItems } from '../../utilities';

interface SortableItemProps {
    item: ChecklistItem;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (id: string, newText: string) => void;
}

function SortableChecklistItem({ item, onToggle, onDelete, onEdit }: SortableItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const [isEditing, setIsEditing] = useState(false);
    const [editDraft, setEditDraft] = useState('');
    const editInputRef = useRef<HTMLTextAreaElement>(null);

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

    function startEdit() {
        setEditDraft(item.text);
        setIsEditing(true);
    }

    function commitEdit() {
        const text = editDraft.trim();
        if (text && text !== item.text) onEdit(item.id, text);
        setIsEditing(false);
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
                <span className="checklistModal-item-text">{item.text}</span>
            )}
            {!isEditing && (
                <button className="checklistModal-edit-item" onClick={startEdit}>
                    <img src="images/Pen.svg" alt="Edit" />
                </button>
            )}
            <button className="checklistModal-del" onClick={() => onDelete(item.id)}>
                <img src="images/Trash.svg" alt="Delete" />
            </button>
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

    if (checklistModalId === null) return null;

    function close() { setChecklistModalId(null); }

    function toggleItem(itemId: string) {
        const newItems = items.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        setItems(newItems);
        updateChecklistItems(checklistModalId!, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function deleteItem(itemId: string) {
        const newItems = items.filter(item => item.id !== itemId);
        setItems(newItems);
        updateChecklistItems(checklistModalId!, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function addItem() {
        const text = draft.trim();
        if (!text) return;
        const newItems = [...items, { id: String(Date.now()), text, checked: false }];
        setItems(newItems);
        setDraft('');
        updateChecklistItems(checklistModalId!, newItems);
        setNewIdeaSwitch(prev => !prev);
        addInputRef.current?.focus();
    }

    function editItem(itemId: string, newText: string) {
        const newItems = items.map(item =>
            item.id === itemId ? { ...item, text: newText } : item
        );
        setItems(newItems);
        updateChecklistItems(checklistModalId!, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        setItems(newItems);
        updateChecklistItems(checklistModalId!, newItems);
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
        <section className="overlay overlay--scroll" onClick={close}>
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
        </section>
    );
}

export default ChecklistModal;
