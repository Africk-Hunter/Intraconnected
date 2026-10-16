import { useState, useEffect, useRef } from 'react';
import AnimatedOverlay from '../AnimatedOverlay';
import ChecklistItemRow from '../ChecklistItemRow';
import { CheckboxIcon } from '../Icons';
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
    const allDone = items.length > 0 && checkedCount === items.length;
    const status = items.length === 0
        ? 'Checklist'
        : allDone ? 'Checklist · All done' : `Checklist · ${checkedCount} of ${items.length} done`;

    return (
        <AnimatedOverlay open={checklistModalId !== null} scrollable onClick={close} onEscape={close}>
            <div
                className="modal neobrutal checklistModal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="checklistModal-title"
                onClick={e => e.stopPropagation()}
            >
                <header className="checklistModal-head">
                    <span className={`checklistModal-badge${allDone ? ' checklistModal-badge--done' : ''}`} aria-hidden="true">
                        <CheckboxIcon checked size={34} />
                    </span>
                    <div className="checklistModal-head-text">
                        <p className="checklistModal-eyebrow">{status}</p>
                        <h2 className="checklistModal-title" id="checklistModal-title">{title}</h2>
                    </div>
                </header>
                {items.length > 0 && (
                    <div
                        className={`checklistModal-bar${allDone ? ' checklistModal-bar--done' : ''}`}
                        role="progressbar"
                        aria-label="Checklist progress"
                        aria-valuemin={0}
                        aria-valuemax={items.length}
                        aria-valuenow={checkedCount}
                    >
                        <div className="checklistModal-bar-fill" style={{ transform: `scaleX(${checkedCount / items.length})` }} />
                    </div>
                )}
                <div className="checklistModal-sheet">
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
                                    <li className="checklistModal-empty">Nothing here yet. Type below and press Enter.</li>
                                )}
                            </ul>
                        </SortableContext>
                    </DndContext>
                    <form className="checklistModal-add" onSubmit={e => { e.preventDefault(); addItem(); }}>
                        <input
                            ref={addInputRef}
                            className="checklistModal-add-input"
                            aria-label="New item"
                            placeholder="Add an item"
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            maxLength={200}
                        />
                        <button
                            type="submit"
                            className="checklistModal-add-btn neobrutal-button"
                            disabled={!draft.trim()}
                            aria-label="Add item"
                            title="Add item (Enter)"
                        >
                            +
                        </button>
                    </form>
                </div>
                <footer className="checklistModal-actions">
                    <button className="checklistModal-action checklistModal-action--edit neobrutal-button" onClick={openRename}>Rename</button>
                    <button className="checklistModal-action checklistModal-action--go neobrutal-button" onClick={close}>Done</button>
                </footer>
            </div>
        </AnimatedOverlay>
    );
}

export default ChecklistModal;
