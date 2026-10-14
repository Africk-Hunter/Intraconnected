import { useEffect } from 'react';
import { ACTIVITY_KEY, isRememberedSession } from './dekStore';
import { isNative } from './platform';
import { signUserOut } from './firebase/authFirebase';

// Signs the user out after a stretch with no clicks, taps or keys, in any tab.
// A session that used "Remember me" gets the long limit; one that didn't gets
// the short one. The app (Capacitor) keeps you signed in on purpose.
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const REMEMBERED_IDLE_LIMIT_MS = 30 * 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 30 * 1000;
const WRITE_EVERY_MS = 15 * 1000;

export function isIdleExpired(lastActivity: number | null, now: number, remembered: boolean): boolean {
    if (lastActivity === null) return false;
    return now - lastActivity > (remembered ? REMEMBERED_IDLE_LIMIT_MS : IDLE_LIMIT_MS);
}

function readLastActivity(): number | null {
    try {
        const raw = localStorage.getItem(ACTIVITY_KEY);
        const n = raw === null ? NaN : Number(raw);
        return Number.isFinite(n) ? n : null;
    } catch {
        return null;
    }
}

export function useIdleSignOut(): void {
    useEffect(() => {
        if (isNative()) return;
        let lastWrite = 0;
        let signingOut = false;

        const touch = (force = false) => {
            const now = Date.now();
            if (!force && now - lastWrite < WRITE_EVERY_MS) return;
            lastWrite = now;
            try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch { /* storage blocked: no idle sign-out */ }
        };

        const check = () => {
            if (signingOut) return;
            if (isIdleExpired(readLastActivity(), Date.now(), isRememberedSession())) {
                signingOut = true;
                void signUserOut();
            }
        };

        // A session that was already idle when this page opened ends at once.
        check();
        if (!signingOut) touch(true);

        const onActivity = () => touch();
        const onVisible = () => { if (document.visibilityState === 'visible') check(); };
        const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
        events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
        document.addEventListener('visibilitychange', onVisible);
        const timer = window.setInterval(check, CHECK_EVERY_MS);
        return () => {
            events.forEach(e => window.removeEventListener(e, onActivity));
            document.removeEventListener('visibilitychange', onVisible);
            window.clearInterval(timer);
        };
    }, []);
}
