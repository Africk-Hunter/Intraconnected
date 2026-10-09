export type SheetState =
    | { type: 'create'; nodeId: number }
    | { type: 'edit'; nodeId: number }
    | { type: 'actions'; nodeId: number }
    | { type: 'move'; nodeId: number }
    | { type: 'confirmDelete'; nodeId: number }
    | { type: 'checklist'; nodeId: number };

export const SWIPE_REVEAL_W = 160;
export const SWIPE_THRESHOLD = 55;
