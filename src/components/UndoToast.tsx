import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { dismissUndoToast, getUndoToast, subscribeUndo } from '../utilities/idea/undoStack';
import { useIdeaActions } from '../utilities/idea/useIdeaActions';

const TOAST_MS = 6000;

function isTypingTarget(target: EventTarget | null) {
    return target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

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

    useEffect(() => {
        if (!toast || paused) return;
        const timer = setTimeout(dismissUndoToast, TOAST_MS);
        return () => clearTimeout(timer);
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

    if (!toast) return null;

    return (
        <div
            className="undo-toast"
            role="status"
            aria-live="polite"
            key={toast.key}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <span className="undo-toast-text">{toast.message}</span>
            {toast.canUndo && (
                <button className="undo-toast-undo neobrutal-button" type="button" onClick={undo} title="Undo (Ctrl+Z)">
                    Undo
                </button>
            )}
            {toast.action && (
                <button
                    className="undo-toast-undo neobrutal-button"
                    type="button"
                    onClick={() => { toast.action?.run(); dismissUndoToast(); }}
                >
                    {toast.action.label}
                </button>
            )}
            <button className="undo-toast-close" type="button" onClick={dismissUndoToast} aria-label="Dismiss">✕</button>
        </div>
    );
}

export default UndoToast;
