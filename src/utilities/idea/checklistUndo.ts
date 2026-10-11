import type { ChecklistItem } from '../types';
import { fetchFullIdeaList } from './helpers';
import { updateChecklistItems } from './ideaStore';
import { pushUndo } from './undoStack';

const LABEL_MAX = 24;

// A deleted checklist item can be put back from the desktop undo toast. The undo reads the
// list fresh (the card and the modal both edit it), puts the item back at its old position
// and hands the new list to `onRestored` so the caller can refresh its own copy.
export function pushItemDeleteUndo(
    ideaId: number,
    item: ChecklistItem,
    index: number,
    onRestored: (items: ChecklistItem[]) => void,
): void {
    const short = item.text.length > LABEL_MAX ? `${item.text.slice(0, LABEL_MAX)}…` : item.text;
    pushUndo({
        label: `Deleted "${short}"`,
        undo: () => {
            const idea = fetchFullIdeaList().find(i => i.id === ideaId);
            if (!idea || idea.type !== 'checklist') return;
            if (idea.items.some(i => i.id === item.id)) return;
            const items = [...idea.items];
            items.splice(Math.min(index, items.length), 0, item);
            updateChecklistItems(ideaId, items);
            onRestored(items);
        },
    });
}
