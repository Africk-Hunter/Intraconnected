import type { IdeaType } from '../types';
import { getIdeaLink, isNoteMode, resolveIdeaLabel } from './helpers';

export type IdeaKind = 'idea' | 'link' | 'checklist' | 'note';

export const KIND_LABEL: Record<IdeaKind, string> = { idea: 'Idea', link: 'Link', checklist: 'Checklist', note: 'Note' };

export interface SearchResult {
    id: number;
    // The level the idea sits in: where to go to see its card.
    parentID: number;
    kind: IdeaKind;
    label: string;
    // A short piece of text around the match when it isn't in the label.
    snippet: string;
    // Names of the ideas above it, top level first (the top level itself excluded).
    path: string[];
    score: number;
}

const SNIPPET_RADIUS = 40;

function oneLine(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function kindOf(idea: IdeaType): IdeaKind {
    if (idea.type === 'checklist') return 'checklist';
    if (isNoteMode(idea)) return 'note';
    return getIdeaLink(idea) !== '' ? 'link' : 'idea';
}

function snippetAround(text: string, at: number, length: number): string {
    const start = Math.max(0, at - SNIPPET_RADIUS);
    const end = Math.min(text.length, at + length + SNIPPET_RADIUS);
    return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

// Every word of the query must appear somewhere in the idea. Better matches
// sort first: in the title, then in the body, then in a checklist item or the link.
function makePathOf(ideas: IdeaType[]): (idea: IdeaType) => string[] {
    const byId = new Map<number, IdeaType>();
    for (const idea of ideas) byId.set(idea.id, idea);

    return (idea) => {
        const names: string[] = [];
        const seen = new Set<number>([idea.id]);
        let parentId = idea.parentID;
        while (parentId !== 1 && byId.has(parentId) && !seen.has(parentId)) {
            seen.add(parentId);
            const parent = byId.get(parentId)!;
            names.unshift(oneLine(resolveIdeaLabel(parent)) || 'Untitled');
            parentId = parent.parentID;
        }
        return names;
    };
}

function plainResults(ideas: IdeaType[], picked: IdeaType[]): SearchResult[] {
    const pathOf = makePathOf(ideas);
    return picked.map((idea) => ({
        id: idea.id,
        parentID: idea.parentID,
        kind: kindOf(idea),
        label: oneLine(resolveIdeaLabel(idea)) || 'Untitled',
        snippet: '',
        path: pathOf(idea),
        score: 0,
    }));
}

// Ideas the user opened, most recent first (ids that no longer exist are skipped).
export function recentIdeas(ideas: IdeaType[], visitedIds: number[], limit = 5): SearchResult[] {
    const byId = new Map(ideas.map((idea) => [idea.id, idea]));
    const picked = visitedIds
        .map((id) => byId.get(id))
        .filter((idea): idea is IdeaType => idea !== undefined && idea.id !== 1)
        .slice(0, limit);
    return plainResults(ideas, picked);
}

// The newest ideas: what the empty search box shows before anything has been opened.
export function newestIdeas(ideas: IdeaType[], limit = 5): SearchResult[] {
    const picked = ideas.filter((idea) => idea.id !== 1).sort((a, b) => b.id - a.id).slice(0, limit);
    return plainResults(ideas, picked);
}

// What an empty search box offers: the ideas the user opened lately, or the
// newest ones if they haven't opened any yet.
export function suggestedIdeas(ideas: IdeaType[], visitedIds: number[], limit = 5): { title: 'Recent' | 'Newest'; results: SearchResult[] } {
    const recent = recentIdeas(ideas, visitedIds, limit);
    return recent.length > 0 ? { title: 'Recent', results: recent } : { title: 'Newest', results: newestIdeas(ideas, limit) };
}

export function searchIdeas(ideas: IdeaType[], query: string, limit = 50): SearchResult[] {
    const words = oneLine(query).toLowerCase().split(' ').filter(Boolean);
    if (words.length === 0) return [];

    const pathOf = makePathOf(ideas);

    const results: SearchResult[] = [];
    for (const idea of ideas) {
        if (idea.id === 1) continue;
        const label = oneLine(resolveIdeaLabel(idea)) || 'Untitled';
        const body = isNoteMode(idea) ? idea.content : '';
        const items = idea.type === 'checklist' ? idea.items.map((item) => item.text).join('\n') : '';
        const link = getIdeaLink(idea);

        const fields = [label.toLowerCase(), body.toLowerCase(), items.toLowerCase(), link.toLowerCase()];
        const haystack = fields.join('\n');
        if (!words.every((word) => haystack.includes(word))) continue;

        // Rank by the best place the first word matches.
        const first = words[0];
        let score = fields.findIndex((field) => field.includes(first));
        if (score === 0 && label.toLowerCase().startsWith(first)) score = -1;

        let snippet = '';
        if (score > 0) {
            const flat = oneLine([label, body, items, link][score]);
            snippet = snippetAround(flat, Math.max(0, flat.toLowerCase().indexOf(first)), first.length);
        }

        results.push({
            id: idea.id,
            parentID: idea.parentID,
            kind: kindOf(idea),
            label,
            snippet,
            path: pathOf(idea),
            score,
        });
    }

    // Stable for ties: newer ideas (larger id) first.
    results.sort((a, b) => a.score - b.score || b.id - a.id);
    return results.slice(0, limit);
}
