export type SheetState =
    | { type: 'rename'; nodeId: number; isNew?: boolean }
    | { type: 'edit'; nodeId: number }
    | { type: 'move'; nodeId: number }
    | { type: 'link'; nodeId: number }
    | { type: 'confirmDelete'; nodeId: number }
    | { type: 'checklist'; nodeId: number };

export const SWIPE_REVEAL_W = 160;
export const SWIPE_THRESHOLD = 55;
