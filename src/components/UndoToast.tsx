import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { dismissUndoToast, getUndoToast, subscribeUndo } from '../utilities/idea/undoStack';
import { useIdeaActions } from '../utilities/idea/useIdeaActions';
import { isTypingTarget } from '../utilities/useDesktopShortcuts';

const TOAST_MS = 6000;
const NOTICE_MS = 1500;
const EXIT_MS = 180; // keep in step with undo-toast-out in undoToast.scss

// One short-lived message at the bottom of the screen with an Undo for the
// change that was just made, plus the Ctrl/Cmd+Z that does the same. The timer
// stops while the pointer or keyboard focus is on the toast, so it never goes
// away under someone who is reaching for Undo.
function UndoToast() {
    const toast = useSyncExternalStore(subscribeUndo, getUndoToast);
    const { undo } = useIdeaActions();
    const [paused, setPaused] = useState(false);
    const undoRef = useRef(undo);
    undoRef.current = undo;
    const [exiting, setExiting] = useState<typeof toast>(null);
    const lastRef = useRef<typeof toast>(null);

    // A new toast is a new element: if the old one went away while hovered or
    // focused, its mouseleave/blur never fired, and the pause would stick and
    // keep every later toast on screen.
    useEffect(() => { setPaused(false); }, [toast?.key]);

    useEffect(() => {
        if (!toast || paused) return;
        const timer = setTimeout(dismissUndoToast, toast.canUndo ? TOAST_MS : NOTICE_MS);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only when the listed deps change, by design
    }, [toast?.key, paused]);

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.defaultPrevented || e.altKey || e.shiftKey) return;
            if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
            // Inside a text field Ctrl+Z belongs to the text; with a modal open it
            // would change things the user can't see.
            if (isTypingTarget(e.target) || document.querySelector('.overlay')) return;
            e.preventDefault();
            undoRef.current();
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    // Keep the last toast on screen while it fades out, instead of unmounting it mid-frame.
    useEffect(() => {
        if (toast) {
            lastRef.current = toast;
            setExiting(null);
            return;
        }
        if (!lastRef.current) return;
        setExiting(lastRef.current);
        const timer = setTimeout(() => { lastRef.current = null; setExiting(null); }, EXIT_MS);
        return () => clearTimeout(timer);
    }, [toast]);

    const shown = toast ?? exiting;
    if (!shown) return null;

    return (
        <div
            className={`undo-toast${toast ? '' : ' undo-toast--out'}`}
            role="status"
            aria-live="polite"
            key={shown.key}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <span className="undo-toast-text">{shown.message}</span>
            {shown.canUndo && (
                <button className="undo-toast-undo neobrutal-button" type="button" onClick={undo} title="Undo (Ctrl+Z)">
                    Undo
                </button>
            )}
            {shown.action && (
                <button
                    className="undo-toast-undo neobrutal-button"
                    type="button"
                    onClick={() => { shown.action?.run(); dismissUndoToast(); }}
                >
                    {shown.action.label}
                </button>
            )}
            <button className="undo-toast-close" type="button" onClick={dismissUndoToast} aria-label="Dismiss">✕</button>
        </div>
    );
}

export default UndoToast;
