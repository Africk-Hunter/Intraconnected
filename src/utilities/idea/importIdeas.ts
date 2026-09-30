import { auth } from "../../firebaseConfig";
import { getCachedBillingStatus } from "../firebase/firebaseHelpers";
import { FREE_NODE_LIMIT } from "../billing/limits";
import { enqueueMany } from "../sync/outbox";
import { IdeaType } from "../types";
import { fetchFullIdeaList } from "./helpers";
import { ImportError, importToIdeas, ParsedImport } from "./importers";

// Each imported idea is its own outbox op (one Firestore batch each), and both
// the idea list and the unsent queue live in localStorage (~5 MB), so one
// import is capped rather than risking a half-saved map.
export const MAX_IMPORT_IDEAS = 2000;

export interface ImportPlan {
    ideas: IdeaType[];
    // Room left on the Free plan, or null when the plan isn't capped.
    freeRoom: number | null;
}

function freeRoom(existingCount: number): number | null {
    return getCachedBillingStatus().plan === 'free' ? Math.max(FREE_NODE_LIMIT - existingCount, 0) : null;
}

export function planImport(parsed: ParsedImport): ImportPlan {
    const existing = fetchFullIdeaList();
    const ideas = importToIdeas(parsed, { existingIds: new Set(existing.map((i) => i.id)), now: Date.now() });
    return { ideas, freeRoom: freeRoom(existing.length) };
}

// Adds the planned ideas locally, then queues them for Firestore — parents
// first, which the outbox preserves. The caller toggles newIdeaSwitch after.
// Limits are re-checked here against the current map, not the preview's.
export function applyImport(plan: ImportPlan): void {
    if (!auth.currentUser) throw new ImportError('You need to be signed in to import.');
    if (plan.ideas.length > MAX_IMPORT_IDEAS) throw new ImportError(`That’s more than ${MAX_IMPORT_IDEAS} ideas.`);
    const existing = fetchFullIdeaList();
    const room = freeRoom(existing.length);
    if (room !== null && plan.ideas.length > room) throw new ImportError('This import would go over the Free plan’s limit.');
    const taken = new Set(existing.map((i) => i.id));
    if (plan.ideas.some((idea) => taken.has(idea.id))) throw new ImportError('Your map changed while importing. Please try again.');

    try {
        localStorage.setItem('ideas', JSON.stringify([...existing, ...plan.ideas]));
    } catch {
        throw new ImportError('There isn’t enough storage space on this device for this import.');
    }
    enqueueMany(plan.ideas.map((idea) => ({ kind: 'create' as const, idea })));
}
