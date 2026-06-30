import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ChecklistItem } from '../../utilities/types';
import SortableMobileChecklistItem from './SortableMobileChecklistItem';

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
}

function MobileChecklistItemSheet({ nodeId, items, draft, onDraftChange, onAdd, onToggle, onDelete, onEdit, onLinkChange, onReorder }: Props) {
    const sensors = useSensors(useSensor(PointerSensor));

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        onReorder(arrayMove(items, oldIndex, newIndex), nodeId);
    }

    return (
        <div className="mmobile-checklist-sheet">
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
                            <li className="mmobile-checklist-sheet-empty">No items yet.</li>
                        )}
                    </ul>
                </SortableContext>
            </DndContext>
            <div className="mmobile-checklist-sheet-add">
                <input
                    className="mmobile-checklist-sheet-input"
                    placeholder="Add item…"
                    value={draft}
                    onChange={e => onDraftChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onAdd(nodeId); } }}
                    maxLength={200}
                />
                <button className="mmobile-checklist-sheet-add-btn" onClick={() => onAdd(nodeId)}>+</button>
            </div>
        </div>
    );
}

export default MobileChecklistItemSheet;
