import { useSyncExternalStore } from 'react';
import { apiUrl, isNative, nativePlatform } from './platform';
import { describeError } from './errorDetails';
import { getSyncStatus } from './sync/syncStore';
import type { ReportArea, ReportDiagnostics } from '../../shared/bugReports';

// "Send a report" on any error screen. The button calls openReport() with where
// the person is and what they saw; ReportModal (mounted once, outside the
// ErrorBoundary) shows the form. Nothing here reads idea text, links, the uid
// or the email: what is attached is listed back to the person in the form.

export interface ReportContext {
    area: ReportArea;
    // The error object or the message that was on screen. Run through
    // describeError, so anything that looks like payment or Firebase data is
    // dropped rather than sent.
    error?: unknown;
}

let current: ReportContext | null = null;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((listener) => listener());
}

export function openReport(context: ReportContext): void {
    current = context;
    emit();
}

export function closeReport(): void {
    current = null;
    emit();
}

export function useReportContext(): ReportContext | null {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        () => current,
    );
}

function errorLine(error: unknown): string | undefined {
    if (error === undefined || error === null || error === '') return undefined;
    const value = typeof error === 'string' ? new Error(error) : error;
    const { text, withheld } = describeError(value);
    return withheld ? `${text} (message withheld)` : text;
}

// Only the path: the query string can hold the idea id of the level being viewed.
async function collectDiagnostics(context: ReportContext): Promise<ReportDiagnostics> {
    const sync = getSyncStatus();
    const diagnostics: ReportDiagnostics = {
        error: errorLine(context.error),
        route: location.pathname,
        platform: isNative() ? nativePlatform() : 'web',
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        pendingChanges: sync.pendingCount,
        syncFailure: sync.failure?.code,
    };
    try {
        // Dynamic: Firebase stays out of the marketing bundle.
        const [{ auth }, { getCachedBillingStatus }] = await Promise.all([
            import('../firebaseConfig'),
            import('./billing/billingCache'),
        ]);
        if (auth.currentUser) diagnostics.plan = getCachedBillingStatus().plan;
    } catch { /* diagnostics are best-effort */ }
    return diagnostics;
}

// Resolves with the report id. Works signed out (the server limits by address
// instead); a signed-in token is attached when there is one.
export async function submitReport(
    context: ReportContext,
    message: string,
    contact: string,
): Promise<string> {
    const diagnostics = await collectDiagnostics(context);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
        const { auth } = await import('../firebaseConfig');
        const token = await auth.currentUser?.getIdToken();
        if (token) headers.Authorization = `Bearer ${token}`;
    } catch { /* send it signed out */ }

    const res = await fetch(apiUrl('/.netlify/functions/submit-bug-report'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ area: context.area, message, contact: contact || undefined, diagnostics }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data && typeof data.error === 'string' ? data.error : 'Couldn’t send your report. Try again.');
    }
    return (data as { reportId: string }).reportId;
}
