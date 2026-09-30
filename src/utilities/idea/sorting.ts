import { IdeaType } from "../types";

export type SortMode = 'priority' | 'recent';

// Kept free of Firebase/localStorage imports (unlike parsing.tsx, which
// re-exports it) so pure modules like exporters.ts can use it and stay
// unit-testable.
export function sortIdeas(ideas: IdeaType[], mode: SortMode): IdeaType[] {
    if (mode === 'recent') return [...ideas].sort((a, b) => a.id - b.id);
    return [...ideas].sort((a, b) => {
        const pa = a.priority ?? 4;
        const pb = b.priority ?? 4;
        if (pa !== pb) return pa - pb;
        return a.id - b.id;
    });
}
