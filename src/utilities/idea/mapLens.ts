import type { IdeaType } from '../types';

// What the desktop mind map highlights. 'priority' picks out ideas that have a
// priority; 'recent' picks out ideas created lately.
export type MapLens = 'off' | 'priority' | 'recent';

export interface LensInfo {
    // Short label drawn on the node (null when the idea doesn't match).
    badge: string | null;
    // CSS tone for the badge and ring (null when the idea doesn't match).
    tone: string | null;
    // True when something below this idea matches, so the path stays readable.
    onPath: boolean;
}

const DAY = 86_400_000;

// Ids are Date.now() at creation. Anything smaller than this (the root, test
// data) carries no usable date.
const MIN_TIMESTAMP_ID = 1e12;

function matchFor(idea: IdeaType, lens: MapLens, now: number): { badge: string; tone: string } | null {
    if (lens === 'priority') {
        return idea.priority ? { badge: `P${idea.priority}`, tone: `p${idea.priority}` } : null;
    }
    if (lens === 'recent') {
        const id = Number(idea.id);
        if (id < MIN_TIMESTAMP_ID) return null;
        const age = now - id;
        if (age < DAY) return { badge: 'Today', tone: 'today' };
        if (age < 7 * DAY) return { badge: 'This week', tone: 'week' };
        if (age < 30 * DAY) return { badge: 'This month', tone: 'month' };
    }
    return null;
}

// One entry per idea reachable from the root. Empty when the lens is off.
// `tones`, when given and not empty, narrows the matches to those tones (the
// map's legend chips: only P1, only Today, ...).
export function computeLens(ideas: IdeaType[], lens: MapLens, now: number, tones?: ReadonlySet<string>): Map<number, LensInfo> {
    const out = new Map<number, LensInfo>();
    if (lens === 'off') return out;

    const kids = new Map<number, IdeaType[]>();
    for (const idea of ideas) {
        const parent = Number(idea.parentID);
        const list = kids.get(parent);
        if (list) list.push(idea);
        else kids.set(parent, [idea]);
    }

    const seen = new Set<number>();
    // Returns whether this idea or anything below it matches.
    function visit(idea: IdeaType): boolean {
        const id = Number(idea.id);
        if (seen.has(id)) return false;
        seen.add(id);
        let below = false;
        for (const child of kids.get(id) ?? []) {
            if (visit(child)) below = true;
        }
        let match = matchFor(idea, lens, now);
        if (match && tones && tones.size > 0 && !tones.has(match.tone)) match = null;
        out.set(id, { badge: match?.badge ?? null, tone: match?.tone ?? null, onPath: below });
        return below || match !== null;
    }

    const root = ideas.find((i) => Number(i.id) === 1);
    if (root) visit(root);
    return out;
}
