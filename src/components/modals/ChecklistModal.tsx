import { useState, useEffect, useRef } from 'react';
import AnimatedOverlay from '../AnimatedOverlay';
import ChecklistItemRow from '../ChecklistItemRow';
import { useEnteringIds } from '../../utilities/idea/useEnteringIds';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useIdeaContext } from '../../context/IdeaContext';
import { ChecklistItem, fetchFullIdeaList, updateChecklistItems } from '../../utilities';
import { pushItemDeleteUndo } from '../../utilities/idea/checklistUndo';


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
    const enteringIds = useEnteringIds(items);

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
        setNewIdeaSwitch(prev => !prev);
    }

    function deleteItem(itemId: string) {
        const index = items.findIndex(item => item.id === itemId);
        if (index === -1) return;
        const removed = items[index];
        const ideaId = checklistModalId!;
        const newItems = items.filter(item => item.id !== itemId);
        setItems(newItems);
        updateChecklistItems(ideaId, newItems);
        setNewIdeaSwitch(prev => !prev);
        pushItemDeleteUndo(ideaId, removed, index, restored => {
            // The modal may have been closed or switched to another list since.
            if (ideaId === checklistModalId) setItems(restored);
            setNewIdeaSwitch(prev => !prev);
        });
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

    function linkChangeItem(itemId: string, link: string) {
        const newItems = items.map(item =>
            item.id === itemId ? { ...item, link: link || undefined } : item
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

    function copyItemText(text: string) {
        navigator.clipboard.writeText(text).catch(() => {});
    }

    function openRename() {
        setCurrentNameChangeId(checklistModalId!);
        setSelectedIdeaName(title);
        setRenameModalOpen(true);
        close();
    }

    const checkedCount = items.filter(i => i.checked).length;

    return (
        <AnimatedOverlay open={checklistModalId !== null} scrollable onClick={close} onEscape={close}>
            <div className="modal neobrutal checklistModal" onClick={e => e.stopPropagation()}>
                <div className="checklistModal-title-row">
                    <span className="checklistModal-title">{title}</span>
                    <span className="checklistModal-progress">{checkedCount}/{items.length}</span>
                    <button className="checklistModal-rename copy" onClick={openRename} title="Rename" aria-label="Rename checklist">
                        <img src="images/Pen.svg" alt="" className="copyImg" />
                    </button>
                </div>
                <div
                    className={`checklistModal-bar${items.length > 0 && checkedCount === items.length ? ' checklistModal-bar--done' : ''}`}
                    role="progressbar"
                    aria-label="Checklist progress"
                    aria-valuemin={0}
                    aria-valuemax={items.length}
                    aria-valuenow={checkedCount}
                >
                    <div className="checklistModal-bar-fill" style={{ transform: `scaleX(${items.length ? checkedCount / items.length : 0})` }} />
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
                                    <ChecklistItemRow
                                        key={item.id}
                                        variant="modal"
                                        entering={enteringIds.has(item.id)}
                                        item={item}
                                        onToggle={toggleItem}
                                        onDelete={deleteItem}
                                        onEdit={editItem}
                                        onLinkChange={linkChangeItem}
                                        onCopy={copyItemText}
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
                        aria-label="Add item"
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
