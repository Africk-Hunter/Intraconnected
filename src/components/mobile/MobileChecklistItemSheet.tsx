import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ChecklistItem } from '../../utilities/types';
import SortableMobileChecklistItem from './SortableMobileChecklistItem';
import { CheckboxIcon } from '../Icons';

// The full checklist view, laid out like the desktop ChecklistModal: a head
// (badge, progress label, title) in the sheet's title row, then a progress
// bar, one card holding the list and the add row, and Edit / Done.

function progress(items: ChecklistItem[]) {
    const checked = items.filter(i => i.checked).length;
    const allDone = items.length > 0 && checked === items.length;
    const status = items.length === 0
        ? 'Checklist'
        : allDone ? 'Checklist · All done' : `Checklist · ${checked} of ${items.length} done`;
    return { checked, allDone, status };
}

// Rendered by MobileMindMap inside the sheet's sticky title row (so it is also the swipe-down area).
export function MobileChecklistHead({ title, items }: { title: string; items: ChecklistItem[] }) {
    const { allDone, status } = progress(items);
    return (
        <div className="mmobile-checklist-head">
            <span className={`mmobile-checklist-badge${allDone ? ' mmobile-checklist-badge--done' : ''}`} aria-hidden="true">
                <CheckboxIcon checked size={24} />
            </span>
            <span className="mmobile-checklist-head-text">
                <span className="mmobile-checklist-eyebrow">{status}</span>
                <span className="mmobile-checklist-title">{title}</span>
            </span>
        </div>
    );
}

interface Props {
    nodeId: number;
    items: ChecklistItem[];
    draft: string;
    onDraftChange: (text: string) => void;
    onAdd: (nodeId: number) => void;
    onToggle: (itemId: string, nodeId: number) => void;
    onDelete: (itemId: string, nodeId: number) => void;
    onEdit: (itemId: string, newText: string, nodeId: number) => void;
    onLinkChange: (itemId: string, link: string, nodeId: number) => void;
    onReorder: (newItems: ChecklistItem[], nodeId: number) => void;
    onEditChecklist: () => void;
    onDone: () => void;
}

function MobileChecklistItemSheet({ nodeId, items, draft, onDraftChange, onAdd, onToggle, onDelete, onEdit, onLinkChange, onReorder, onEditChecklist, onDone }: Props) {
    const sensors = useSensors(useSensor(PointerSensor));
    const { checked, allDone } = progress(items);

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        onReorder(arrayMove(items, oldIndex, newIndex), nodeId);
    }

    return (
        <div className="mmobile-checklist-sheet">
            {items.length > 0 && (
                <div
                    className={`mmobile-checklist-bar${allDone ? ' mmobile-checklist-bar--done' : ''}`}
                    role="progressbar"
                    aria-label="Checklist progress"
                    aria-valuemin={0}
                    aria-valuemax={items.length}
                    aria-valuenow={checked}
                >
                    <div className="mmobile-checklist-bar-fill" style={{ transform: `scaleX(${checked / items.length})` }} />
                </div>
            )}
            <div className="mmobile-checklist-card">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis]}
                >
                    <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                        <ul className="mmobile-checklist-sheet-items">
                            {items.map(item => (
                                <SortableMobileChecklistItem
                                    key={item.id}
                                    item={item}
                                    nodeId={nodeId}
                                    onToggle={onToggle}
                                    onDelete={onDelete}
                                    onEdit={onEdit}
                                    onLinkChange={onLinkChange}
                                />
                            ))}
                            {items.length === 0 && (
                                <li className="mmobile-checklist-sheet-empty">Nothing here yet. Add one below.</li>
                            )}
                        </ul>
                    </SortableContext>
                </DndContext>
                <form
                    className="mmobile-checklist-sheet-add"
                    onSubmit={e => { e.preventDefault(); e.stopPropagation(); onAdd(nodeId); }}
                >
                    <input
                        className="mmobile-checklist-sheet-input"
                        aria-label="New item"
                        placeholder="Add an item"
                        enterKeyHint="enter"
                        value={draft}
                        onChange={e => onDraftChange(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}
                        maxLength={200}
                    />
                    <button
                        type="submit"
                        className="mmobile-checklist-sheet-add-btn"
                        disabled={!draft.trim()}
                        aria-label="Add item"
                        // Keep focus in the field so the keyboard stays up for the next item.
                        onMouseDown={e => e.preventDefault()}
                    >
                        +
                    </button>
                </form>
            </div>
            <div className="mmobile-sheet-btns mmobile-checklist-btns">
                <button className="mmobile-sheet-btn mmobile-checklist-btn--edit" onClick={onEditChecklist}>Edit</button>
                <button className="mmobile-sheet-btn mmobile-sheet-btn--save" onClick={onDone}>Done</button>
            </div>
        </div>
    );
}

export default MobileChecklistItemSheet;
