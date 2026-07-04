export interface ChecklistItem {
    id: string;
    text: string;
    checked: boolean;
    link?: string;
}

export interface StandardIdea {
    type?: 'standard';
    id: number;
    content: string;
    parentID: number;
    link: string;
    priority?: 1 | 2 | 3;
    noteTitle?: string; // header label once content grows past the note-mode threshold
}

export interface ChecklistIdea {
    type: 'checklist';
    id: number;
    content: string;
    parentID: number;
    items: ChecklistItem[];
    priority?: 1 | 2 | 3;
}

export type IdeaType = StandardIdea | ChecklistIdea;
