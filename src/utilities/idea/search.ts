import type { IdeaType } from '../types';
import { getIdeaLink, isNoteMode, isVaultIdea, resolveIdeaLabel, VAULT_LABEL } from './helpers';

export type IdeaKind = 'idea' | 'link' | 'checklist' | 'note' | 'vault';

export const KIND_LABEL: Record<IdeaKind, string> = { idea: 'Idea', link: 'Link', checklist: 'Checklist', note: 'Note', vault: 'Vault' };

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
    // 0 for a top match; ideas beneath it are indented one more per level.
    depth: number;
    // False for an idea shown only because it sits under a match.
    isMatch: boolean;
    hasChildren: boolean;
    // Ideas anywhere beneath it: what the expand button offers to reveal.
    descendants: number;
}

const SNIPPET_RADIUS = 40;

// "is:" filters, typed in the search box and turned into chips once finished.
export const SEARCH_TAGS = ['vault', 'parent', 'leaf', 'note', 'checklist', 'p1', 'p2', 'p3'] as const;
export type SearchTag = (typeof SEARCH_TAGS)[number];

export const TAG_HINT: Record<SearchTag, string> = {
    vault: 'Vault notes',
    parent: 'Ideas with ideas inside',
    leaf: 'Ideas with nothing inside',
    note: 'Notes',
    checklist: 'Checklists',
    p1: 'High priority',
    p2: 'Medium priority',
    p3: 'Low priority',
};

const PRIORITY_TAGS: SearchTag[] = ['p1', 'p2', 'p3'];

function isSearchTag(value: string): value is SearchTag {
    return (SEARCH_TAGS as readonly string[]).includes(value);
}

// A finished tag at the end of the box ("is:note " with the space typed): returns
// the tag and the text left once it is taken out. Also handles a pasted "is:p1 foo bar".
export function takeFinishedTag(value: string): { tag: SearchTag; rest: string } | null {
    const match = /(^|\s)is:([a-z0-9]+)(\s)/i.exec(value);
    if (!match) return null;
    const tag = match[2].toLowerCase();
    if (!isSearchTag(tag)) return null;
    const before = value.slice(0, match.index);
    const after = value.slice(match.index + match[0].length);
    return { tag, rest: (before && after ? `${before} ${after}` : before + after).replace(/^\s+/, '') };
}

// Tags to offer while the last word is a half-typed "is:…".
export function suggestTags(value: string, taken: readonly SearchTag[]): SearchTag[] {
    const match = /(?:^|\s)is:([a-z0-9]*)$/i.exec(value);
    if (!match) return [];
    const typed = match[1].toLowerCase();
    return SEARCH_TAGS.filter((tag) => !taken.includes(tag) && tag.startsWith(typed));
}

// Swaps the half-typed "is:…" at the end for a finished one, ready to become a chip.
export function completeTag(value: string, tag: SearchTag): string {
    return value.replace(/is:[a-z0-9]*$/i, `is:${tag} `);
}

// Tags of one kind widen the search (is:note is:checklist = either); different
// kinds narrow it (is:note is:p1 = notes with high priority).
function matchesTags(idea: IdeaType, tags: readonly SearchTag[], hasChildren: boolean): boolean {
    if (tags.length === 0) return true;
    const kinds = tags.filter((t) => !PRIORITY_TAGS.includes(t));
    const priorities = tags.filter((t) => PRIORITY_TAGS.includes(t));
    const kind = kindOf(idea);
    const kindOk = kinds.length === 0 || kinds.some((t) => {
        if (t === 'parent') return hasChildren;
        if (t === 'leaf') return !hasChildren && kind === 'idea';
        return kind === t;
    });
    const priorityOk = priorities.length === 0 || priorities.some((t) => `p${idea.priority ?? 0}` === t);
    return kindOk && priorityOk;
}

function oneLine(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function kindOf(idea: IdeaType): IdeaKind {
    if (idea.type === 'checklist') return 'checklist';
    if (isVaultIdea(idea)) return 'vault';
    if (isNoteMode(idea)) return 'note';
    return getIdeaLink(idea) !== '' ? 'link' : 'idea';
}

function snippetAround(text: string, at: number, length: number): string {
    const start = Math.max(0, at - SNIPPET_RADIUS);
    const end = Math.min(text.length, at + length + SNIPPET_RADIUS);
    return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

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
    const parents = new Set(ideas.map((idea) => idea.parentID));
    return picked.map((idea) => ({
        id: idea.id,
        parentID: idea.parentID,
        kind: kindOf(idea),
        label: oneLine(resolveIdeaLabel(idea)) || 'Untitled',
        snippet: '',
        path: pathOf(idea),
        score: 0,
        depth: 0,
        isMatch: true,
        hasChildren: parents.has(idea.id),
        descendants: 0,
    }));
}

// Ideas the user opened, most recent first (ids that no longer exist are skipped).
function recentIdeas(ideas: IdeaType[], visitedIds: number[], limit = 5): SearchResult[] {
    const byId = new Map(ideas.map((idea) => [idea.id, idea]));
    const picked = visitedIds
        .map((id) => byId.get(id))
        .filter((idea): idea is IdeaType => idea !== undefined && idea.id !== 1)
        .slice(0, limit);
    return plainResults(ideas, picked);
}

// The newest ideas: what the empty search box shows before anything has been opened.
function newestIdeas(ideas: IdeaType[], limit = 5): SearchResult[] {
    const picked = ideas.filter((idea) => idea.id !== 1).sort((a, b) => b.id - a.id).slice(0, limit);
    return plainResults(ideas, picked);
}

// What an empty search box offers: the ideas the user opened lately, or the
// newest ones if they haven't opened any yet.
export function suggestedIdeas(ideas: IdeaType[], visitedIds: number[], limit = 5): { title: 'Recent' | 'Newest'; results: SearchResult[] } {
    ideas = ideas.filter((idea) => !isVaultIdea(idea));
    const recent = recentIdeas(ideas, visitedIds, limit);
    return recent.length > 0 ? { title: 'Recent', results: recent } : { title: 'Newest', results: newestIdeas(ideas, limit) };
}

// Edit distance, giving up early once it must exceed `max`.
function editDistance(a: string, b: string, max: number): number {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            best = Math.min(best, row[j]);
        }
        if (best > max) return max + 1;
        prev = row;
    }
    return prev[b.length];
}

function typoAllowance(word: string): number {
    return word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0;
}

// A word typed slightly wrong: close to a whole word, or to the start of a longer one.
function fuzzyIn(word: string, text: string): boolean {
    const max = typoAllowance(word);
    if (max === 0) return false;
    return text.split(/[^\p{L}\p{N}]+/u).some((token) =>
        token.length > 0 &&
        (editDistance(word, token, max) <= max ||
            (token.length > word.length && editDistance(word, token.slice(0, word.length), max) <= max)),
    );
}

// The letters appear in order ("grdnpln" finds "Garden plan").
function isSubsequence(word: string, text: string): boolean {
    let at = 0;
    for (const ch of text) if (ch === word[at] && ++at === word.length) return true;
    return false;
}

const FUZZY_SCORE = 4;
const LOOSE_SCORE = 5;
const ANCESTOR_SCORE = 6;

// Where one word matches the idea itself: -1 label start, 0 label, 1 body, 2 items,
// 3 link, then 4 typo, 5 letters in order. null = not at all.
function matchWord(word: string, fields: string[]): number | null {
    const at = fields.findIndex((field) => field.includes(word));
    if (at === 0 && fields[0].startsWith(word)) return -1;
    if (at >= 0) return at;
    if (fields.slice(0, 3).some((field) => fuzzyIn(word, field))) return FUZZY_SCORE;
    if (word.length >= 3 && isSubsequence(word, fields[0])) return LOOSE_SCORE;
    return null;
}

// Every word must match the idea (exactly, with a typo, or as letters in order) or
// a name above it. Matches come back each followed by the ideas beneath it, so a
// half-remembered name still leads to what is inside.
export function searchIdeas(ideas: IdeaType[], query: string, limit = 50, tags: SearchTag[] = []): SearchResult[] {
    const words = oneLine(query).toLowerCase().split(' ').filter(Boolean);
    if (words.length === 0) {
        if (tags.length === 0) return [];
        const parentIds = new Set(ideas.map((idea) => idea.parentID));
        const picked = ideas
            .filter((idea) => idea.id !== 1 && matchesTags(idea, tags, parentIds.has(idea.id)))
            .sort((a, b) => b.id - a.id)
            .slice(0, limit);
        return plainResults(ideas, picked);
    }

    const pathOf = makePathOf(ideas);
    const byId = new Map(ideas.map((idea) => [idea.id, idea]));
    const children = new Map<number, IdeaType[]>();
    for (const idea of ideas) {
        if (idea.id === 1) continue;
        const list = children.get(idea.parentID);
        if (list) list.push(idea);
        else children.set(idea.parentID, [idea]);
    }
    for (const list of children.values()) list.sort((a, b) => a.id - b.id);

    const counts = new Map<number, number>();
    const countBelow = (id: number, seen = new Set<number>()): number => {
        const known = counts.get(id);
        if (known !== undefined) return known;
        if (seen.has(id)) return 0;
        seen.add(id);
        let total = 0;
        for (const child of children.get(id) ?? []) total += 1 + countBelow(child.id, seen);
        counts.set(id, total);
        return total;
    };

    const toResult = (idea: IdeaType, depth: number, isMatch: boolean, score: number, snippet = ''): SearchResult => ({
        id: idea.id,
        parentID: idea.parentID,
        kind: kindOf(idea),
        label: oneLine(resolveIdeaLabel(idea)) || 'Untitled',
        snippet,
        path: pathOf(idea),
        score,
        depth,
        isMatch,
        hasChildren: (children.get(idea.id)?.length ?? 0) > 0,
        descendants: countBelow(idea.id),
    });

    const matches = new Map<number, SearchResult>();
    for (const idea of ideas) {
        if (idea.id === 1) continue;
        if (!matchesTags(idea, tags, children.has(idea.id))) continue;
        const label = oneLine(resolveIdeaLabel(idea)) || 'Untitled';
        // A vault note matches on its label only (known while the vault is
        // unlocked); its content and link are ciphertext and never searched.
        const vault = isVaultIdea(idea);
        if (vault && label === VAULT_LABEL) continue;
        const body = isNoteMode(idea) && !vault ? idea.content : '';
        const items = idea.type === 'checklist' ? idea.items.map((item) => item.text).join('\n') : '';
        const link = getIdeaLink(idea);
        const fields = [label, body, items, link].map((field) => field.toLowerCase());
        const ancestors = pathOf(idea).join('\n').toLowerCase();

        let own = 0;
        let score = 0;
        let ok = true;
        words.forEach((word, i) => {
            let hit = matchWord(word, fields);
            if (hit === null) {
                if (ancestors.includes(word) || fuzzyIn(word, ancestors)) hit = ANCESTOR_SCORE;
                else ok = false;
            } else own++;
            if (i === 0 && hit !== null) score = hit;
        });
        // Words found only in the names above would match everything under a branch.
        if (!ok || own === 0) continue;

        let snippet = '';
        if (score > 0 && score <= 3) {
            const flat = oneLine([label, body, items, link][score]);
            snippet = snippetAround(flat, Math.max(0, flat.toLowerCase().indexOf(words[0])), words[0].length);
        }
        matches.set(idea.id, toResult(idea, 0, true, score, snippet));
    }

    const hasMatchedAncestor = (idea: IdeaType): boolean => {
        const seen = new Set<number>([idea.id]);
        let parent = byId.get(idea.parentID);
        while (parent && !seen.has(parent.id)) {
            if (matches.has(parent.id)) return true;
            seen.add(parent.id);
            parent = byId.get(parent.parentID);
        }
        return false;
    };

    // A match inside another match shows in that match's tree, not on its own.
    const roots = [...matches.values()].filter((m) => !hasMatchedAncestor(byId.get(m.id)!));
    const groupScore = new Map<number, number>();
    const collect = (idea: IdeaType, root: number, visited: Set<number>) => {
        const m = matches.get(idea.id);
        if (m) groupScore.set(root, Math.min(groupScore.get(root) ?? m.score, m.score));
        for (const child of children.get(idea.id) ?? []) {
            if (visited.has(child.id)) continue;
            visited.add(child.id);
            collect(child, root, visited);
        }
    };
    for (const root of roots) collect(byId.get(root.id)!, root.id, new Set([root.id]));
    roots.sort((a, b) => groupScore.get(a.id)! - groupScore.get(b.id)! || b.id - a.id);

    const MAX_ROWS = 200;
    const rows: SearchResult[] = [];
    const walk = (idea: IdeaType, depth: number, visited: Set<number>) => {
        for (const child of children.get(idea.id) ?? []) {
            if (rows.length >= MAX_ROWS) return;
            if (visited.has(child.id)) continue;
            visited.add(child.id);
            const match = matches.get(child.id);
            rows.push(match ? { ...match, depth } : toResult(child, depth, false, 0));
            walk(child, depth + 1, visited);
        }
    };
    for (const root of roots.slice(0, limit)) {
        if (rows.length >= MAX_ROWS) break;
        rows.push(root);
        walk(byId.get(root.id)!, 1, new Set([root.id]));
    }
    return rows;
}

// Hides the ideas that sit under a collapsed match. Ideas that match the query
// themselves stay visible, so collapsing never hides a hit.
export function visibleResults(results: SearchResult[], expanded: ReadonlySet<number>): SearchResult[] {
    const shown: SearchResult[] = [];
    let collapsedAt = Infinity;
    for (const row of results) {
        if (row.depth <= collapsedAt) collapsedAt = Infinity;
        if (row.depth > collapsedAt && !row.isMatch) continue;
        shown.push(row);
        if (row.descendants > 0 && !expanded.has(row.id)) collapsedAt = Math.min(collapsedAt, row.depth);
    }
    return shown;
}
