import { useEffect, useState, useSyncExternalStore } from 'react';
import { dismissSyncNotice, getSyncStatus, subscribeSyncStatus } from '../utilities/sync/syncStore';
import { discardFailed, retryFailed } from '../utilities/sync/outbox';

// Changes normally reach the server in well under a second; only call the
// queue out once one has been waiting noticeably longer than that.
const SLOW_AFTER_MS = 3000;

function useOnline(): boolean {
    const [online, setOnline] = useState(() => navigator.onLine);
    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => {
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
        };
    }, []);
    return online;
}

// Re-renders once `since + delayMs` has passed, so "waiting too long" can
// flip on without any other state changing.
function useElapsed(since: number | null, delayMs: number): boolean {
    const [, setTick] = useState(0);
    const elapsed = since !== null && Date.now() - since >= delayMs;
    useEffect(() => {
        if (since === null || elapsed) return;
        const timer = setTimeout(() => setTick((tick) => tick + 1), since + delayMs - Date.now());
        return () => clearTimeout(timer);
    }, [since, delayMs, elapsed]);
    return elapsed;
}

// Tells the user when their changes aren't reaching the server: a change the
// server refused (their call: try again or discard it), changes waiting
// because they're offline, and one-off notices from a sync (unreadable or
// re-homed ideas). Renders nothing while everything is in sync.
function SyncStatusBanner() {
    const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
    const online = useOnline();
    const slow = useElapsed(status.oldestPendingAt, SLOW_AFTER_MS);
    const [busy, setBusy] = useState(false);

    // Re-enable the buttons whenever the failure itself changes.
    useEffect(() => setBusy(false), [status.failure]);

    const showWaiting = !status.failure && status.pendingCount > 0 && (!online || slow);
    if (!status.failure && !showWaiting && status.notices.length === 0) return null;

    const changes = status.pendingCount === 1 ? '1 change is' : `${status.pendingCount} changes are`;

    return (
        <section className="syncBanner" aria-label="Sync status">
            {status.failure && (
                <div className="syncBanner__item syncBanner__item--failed" role="alert">
                    <p className="syncBanner__text">
                        <strong>A change couldn't be saved.</strong> {status.failure.message}
                    </p>
                    <div className="syncBanner__actions">
                        <button
                            type="button"
                            className="syncBanner__button syncBanner__button--retry neobrutal-button"
                            disabled={busy}
                            onClick={() => {
                                setBusy(true);
                                retryFailed();
                            }}
                        >
                            Try again
                        </button>
                        <button
                            type="button"
                            className="syncBanner__button syncBanner__button--discard neobrutal-button"
                            disabled={busy}
                            onClick={() => {
                                setBusy(true);
                                discardFailed();
                            }}
                        >
                            Discard change
                        </button>
                    </div>
                </div>
            )}

            {showWaiting && (
                <div className="syncBanner__item syncBanner__item--waiting" role="status">
                    <p className="syncBanner__text">
                        {online
                            ? `Saving… ${changes} waiting to reach the server.`
                            : `You're offline. ${changes} saved on this device and will sync when you reconnect.`}
                    </p>
                </div>
            )}

            {status.notices.map((notice) => (
                <div key={notice.id} className="syncBanner__item syncBanner__item--notice" role="status">
                    <p className="syncBanner__text">{notice.text}</p>
                    <button
                        type="button"
                        className="syncBanner__dismiss"
                        aria-label="Dismiss"
                        onClick={() => dismissSyncNotice(notice.id)}
                    >
                        ×
                    </button>
                </div>
            ))}
        </section>
    );
}

export default SyncStatusBanner;
