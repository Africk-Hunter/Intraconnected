// Undo for structural changes on the desktop screen (delete, move).
//
// The change itself has already happened (and is queued for sync) when an entry
// is pushed here, so an entry that is never used does nothing. Undoing makes a
// second, opposite change through ideaStore. The stack is in memory only: it
// does not survive a reload, and it is small on purpose.

export interface UndoEntry {
    // Past tense, shown in the toast: `Deleted "Plan"`.
    label: string;
    // Makes the opposite change. Data only; the caller refreshes the screen.
    undo: () => void;
    // Optional second button on the toast, e.g. "Take me there".
    action?: ToastAction;
}

interface ToastAction {
    label: string;
    run: () => void;
}

export interface UndoToastState {
    // Bumped for every toast, so a repeat of the same message restarts its timer.
    key: number;
    message: string;
    // False for the "Undone" confirmation.
    canUndo: boolean;
    action?: ToastAction;
}

const MAX_ENTRIES = 20;

let stack: UndoEntry[] = [];
let toast: UndoToastState | null = null;
let nextKey = 0;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((l) => l());
}

export function subscribeUndo(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function getUndoToast(): UndoToastState | null {
    return toast;
}

export function canUndo(): boolean {
    return stack.length > 0;
}

export function pushUndo(entry: UndoEntry): void {
    stack.push(entry);
    if (stack.length > MAX_ENTRIES) stack = stack.slice(stack.length - MAX_ENTRIES);
    toast = { key: ++nextKey, message: entry.label, canUndo: true, action: entry.action };
    emit();
}

// Undoes the most recent change. Returns whether there was one.
export function undoLast(): boolean {
    const entry = stack.pop();
    if (!entry) return false;
    entry.undo();
    toast = { key: ++nextKey, message: `Undone: ${entry.label}`, canUndo: false };
    emit();
    return true;
}

// A plain confirmation with no Undo (e.g. "Copied").
export function showNotice(message: string): void {
    toast = { key: ++nextKey, message, canUndo: false };
    emit();
}

export function dismissUndoToast(): void {
    if (toast === null) return;
    toast = null;
    emit();
}

export function clearUndo(): void {
    stack = [];
    toast = null;
    emit();
}
