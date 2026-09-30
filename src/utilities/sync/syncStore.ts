// Observable sync status for the UI (SyncStatusBanner via useSyncStatus) plus
// the "refreshed" event the app listens to after another device's changes
// have been pulled in. Plain module state + listeners, shaped for React's
// useSyncExternalStore.

export interface SyncFailure {
    code: string;
    message: string;
}

export interface SyncNotice {
    id: number;
    text: string;
    // Notices sharing a key replace each other rather than stacking up
    // (e.g. the same problem reported again by every pull).
    key?: string;
    onDismiss?: () => void;
}

export interface SyncStatus {
    pendingCount: number;
    // When the oldest unsent change was made — the banner only calls a
    // queue "stuck" once it's been waiting a few seconds.
    oldestPendingAt: number | null;
    failure: SyncFailure | null;
    notices: SyncNotice[];
}

let status: SyncStatus = { pendingCount: 0, oldestPendingAt: null, failure: null, notices: [] };
const statusListeners = new Set<() => void>();
const refreshListeners = new Set<() => void>();
let nextNoticeId = 1;

export function getSyncStatus(): SyncStatus {
    return status;
}

export function subscribeSyncStatus(listener: () => void): () => void {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
}

export function updateSyncStatus(patch: Partial<SyncStatus>): void {
    status = { ...status, ...patch };
    statusListeners.forEach((listener) => listener());
}

export function addSyncNotice(text: string, options: { key?: string; onDismiss?: () => void } = {}): void {
    const others = options.key ? status.notices.filter((notice) => notice.key !== options.key) : status.notices;
    updateSyncStatus({ notices: [...others, { id: nextNoticeId++, text, ...options }] });
}

// Removes a keyed notice without running its onDismiss (the problem went away
// on its own, the user didn't acknowledge it).
export function clearSyncNotice(key: string): void {
    if (!status.notices.some((notice) => notice.key === key)) return;
    updateSyncStatus({ notices: status.notices.filter((notice) => notice.key !== key) });
}

export function dismissSyncNotice(id: number): void {
    status.notices.find((notice) => notice.id === id)?.onDismiss?.();
    updateSyncStatus({ notices: status.notices.filter((notice) => notice.id !== id) });
}

// Fires after local storage has been replaced with fresh server data, so
// views can re-read it (and step out of an idea that no longer exists).
export function onSyncRefreshed(listener: () => void): () => void {
    refreshListeners.add(listener);
    return () => refreshListeners.delete(listener);
}

export function emitSyncRefreshed(): void {
    refreshListeners.forEach((listener) => listener());
}
