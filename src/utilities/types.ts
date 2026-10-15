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
    isNote?: boolean; // set at creation via the Note tab; immutable after that — ideas and notes can't convert into each other
    noteTitle?: string; // header label shown while isNote is true
    censored?: boolean; // shown masked until clicked (a screen-privacy veil, not a password)
    isVault?: boolean; // set at creation via the Vault tab, always with isNote; immutable. noteTitle/content/link hold vault1: ciphertext
}

export interface ChecklistIdea {
    type: 'checklist';
    id: number;
    content: string;
    parentID: number;
    items: ChecklistItem[];
    priority?: 1 | 2 | 3;
    censored?: boolean;
}

export type IdeaType = StandardIdea | ChecklistIdea;
