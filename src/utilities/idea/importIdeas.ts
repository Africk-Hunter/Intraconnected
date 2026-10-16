import { auth } from "../../firebaseConfig";
import { getCachedBillingStatus } from "../billing/billingCache";
import { FREE_NODE_LIMIT } from "../billing/limits";
import { enqueueMany } from "../sync/outbox";
import { MAX_CREATE_MANY, type SyncOp } from "../sync/ops";
import { IdeaType } from "../types";
import { fetchFullIdeaList } from "./helpers";
import { ImportError, importToIdeas, ParsedImport } from "./importers";

// Imported ideas go out in batches of MAX_CREATE_MANY (one Firestore commit
// each). Each one is a document write, so imports are limited per account over
// a rolling day. Kept in localStorage, which a determined user can clear: it
// stops accidents and casual abuse, not a hand-made client (the Free plan's
// cap is the only server-enforced one).
export const DAILY_IMPORT_LIMIT = 2000;
// Times an account may go past the daily limit, ever. After that: support.
const IMPORT_EXCEPTIONS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const importLogKey = (uid: string) => `import_log_${uid}`;
const exceptionsKey = (uid: string) => `import_exceptions_${uid}`;

function exceptionsLeft(): number {
    const uid = auth.currentUser?.uid;
    if (!uid) return IMPORT_EXCEPTIONS;
    const used = Number(localStorage.getItem(exceptionsKey(uid))) || 0;
    return Math.max(IMPORT_EXCEPTIONS - used, 0);
}

function spendException(): void {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        localStorage.setItem(exceptionsKey(uid), String(IMPORT_EXCEPTIONS - exceptionsLeft() + 1));
    } catch {
        // Storage full: the exception just isn't counted this time.
    }
}

interface ImportLogEntry {
    at: number;
    count: number;
}

function recentImports(uid: string): ImportLogEntry[] {
    try {
        const parsed = JSON.parse(localStorage.getItem(importLogKey(uid)) ?? '[]');
        if (!Array.isArray(parsed)) return [];
        const cutoff = Date.now() - DAY_MS;
        return parsed.filter((e): e is ImportLogEntry => typeof e?.at === 'number' && typeof e?.count === 'number' && e.at >= cutoff);
    } catch {
        return [];
    }
}

function dailyRoom(): number {
    const uid = auth.currentUser?.uid;
    if (!uid) return DAILY_IMPORT_LIMIT;
    return Math.max(DAILY_IMPORT_LIMIT - recentImports(uid).reduce((sum, e) => sum + e.count, 0), 0);
}

function recordImport(count: number): void {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        localStorage.setItem(importLogKey(uid), JSON.stringify([...recentImports(uid), { at: Date.now(), count }]));
    } catch {
        // Storage full: the limit just isn't tracked this time.
    }
}

export interface ImportPlan {
    ideas: IdeaType[];
    // Room left on the Free plan, or null when the plan isn't capped.
    freeRoom: number | null;
    // Ideas left in today's import allowance.
    dailyRoom: number;
    // Times this account can still go past that allowance.
    exceptionsLeft: number;
}

function freeRoom(existingCount: number): number | null {
    return getCachedBillingStatus().plan === 'free' ? Math.max(FREE_NODE_LIMIT - existingCount, 0) : null;
}

export function planImport(parsed: ParsedImport): ImportPlan {
    const existing = fetchFullIdeaList();
    const ideas = importToIdeas(parsed, { existingIds: new Set(existing.map((i) => i.id)), now: Date.now() });
    return { ideas, freeRoom: freeRoom(existing.length), dailyRoom: dailyRoom(), exceptionsLeft: exceptionsLeft() };
}

// Adds the planned ideas locally, then queues them for Firestore — parents
// first, which the outbox preserves. The caller toggles newIdeaSwitch after.
// Limits are re-checked here against the current map, not the preview's.
export function applyImport(plan: ImportPlan, options: { useException?: boolean } = {}): void {
    if (!auth.currentUser) throw new ImportError('You need to be signed in to import.');
    const overDaily = plan.ideas.length > dailyRoom();
    if (overDaily && !(options.useException && exceptionsLeft() > 0)) {
        throw new ImportError('You’ve reached the import limit. Try again tomorrow or contact support.');
    }
    const existing = fetchFullIdeaList();
    const room = freeRoom(existing.length);
    if (room !== null && plan.ideas.length > room) throw new ImportError('This import would go over the Free plan’s limit.');
    const taken = new Set(existing.map((i) => i.id));
    if (plan.ideas.some((idea) => taken.has(idea.id))) throw new ImportError('Your ideas changed while importing. Please try again.');

    try {
        localStorage.setItem('ideas', JSON.stringify([...existing, ...plan.ideas]));
    } catch {
        throw new ImportError('There isn’t enough storage space on this device for this import.');
    }
    const ops: SyncOp[] = [];
    for (let i = 0; i < plan.ideas.length; i += MAX_CREATE_MANY) {
        ops.push({ kind: 'createMany', ideas: plan.ideas.slice(i, i + MAX_CREATE_MANY) });
    }
    if (overDaily) spendException();
    recordImport(plan.ideas.length);
    enqueueMany(ops);
}
