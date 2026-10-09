import { useEffect, useRef } from 'react';

export interface UndoToastState {
    // Bumped for every new toast, so a repeat of the same message restarts the timer.
    key: number;
    message: string;
    onUndo?: () => void;
}

interface Props {
    toast: UndoToastState;
    // A sheet is open: sit in the space the hidden bottom bar leaves, above
    // the scrim, so Undo stays reachable (e.g. after deleting a checklist item).
    aboveSheet?: boolean;
    onDismiss: () => void;
}

const TOAST_MS = 5000;
const SWIPE_AWAY_PX = 70;

// One short-lived message above the bottom bar, with an Undo for the change
// that was just made. The change itself has already happened (and is queued
// for sync), so letting the toast expire does nothing; Undo makes a second,
// opposite change. ✕, or a swipe sideways or down, puts it away early.
function MobileUndoToast({ toast, aboveSheet, onDismiss }: Props) {
    const elRef = useRef<HTMLDivElement>(null);
    const start = useRef<{ x: number; y: number } | null>(null);
    const offset = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const timer = setTimeout(onDismiss, TOAST_MS);
        return () => clearTimeout(timer);
        // Restart only for a new toast, not when the parent re-renders.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast.key]);

    function setPosition(x: number, y: number, animate: boolean) {
        const el = elRef.current;
        if (!el) return;
        el.style.transition = animate ? 'transform 0.18s ease, opacity 0.18s ease' : 'none';
        el.style.transform = x || y ? `translate(${x}px, ${y}px)` : '';
        el.style.opacity = x || y ? String(Math.max(0.2, 1 - Math.max(Math.abs(x), y) / 200)) : '';
    }

    function onTouchStart(e: React.TouchEvent) {
        start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        offset.current = { x: 0, y: 0 };
    }

    function onTouchMove(e: React.TouchEvent) {
        if (!start.current) return;
        const dx = e.touches[0].clientX - start.current.x;
        const dy = e.touches[0].clientY - start.current.y;
        // Follow the finger sideways, or downwards; never up into the screen
        offset.current = Math.abs(dx) >= Math.abs(dy) ? { x: dx, y: 0 } : { x: 0, y: Math.max(0, dy) };
        setPosition(offset.current.x, offset.current.y, false);
    }

    function onTouchEnd() {
        if (!start.current) return;
        start.current = null;
        const { x, y } = offset.current;
        if (Math.abs(x) > SWIPE_AWAY_PX || y > SWIPE_AWAY_PX / 2) {
            // Carry on off-screen in the direction it was thrown, then go
            setPosition(x ? Math.sign(x) * window.innerWidth : 0, y ? 160 : 0, true);
            setTimeout(onDismiss, 160);
        } else {
            setPosition(0, 0, true);
        }
    }

    return (
        <div
            ref={elRef}
            className={`mmobile-toast${aboveSheet ? ' mmobile-toast--above-sheet' : ''}`}
            role="status"
            aria-live="polite"
            key={toast.key}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={() => { start.current = null; setPosition(0, 0, true); }}
        >
            <span className="mmobile-toast-text">{toast.message}</span>
            {toast.onUndo && (
                <button
                    className="mmobile-toast-undo"
                    onClick={() => { toast.onUndo?.(); onDismiss(); }}
                >
                    Undo
                </button>
            )}
            <button className="mmobile-toast-close" onClick={onDismiss} aria-label="Dismiss">
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            </button>
        </div>
    );
}

export default MobileUndoToast;
