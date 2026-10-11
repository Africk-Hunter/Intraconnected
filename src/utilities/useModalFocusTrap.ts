import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open traps, oldest first. Only the last one reacts to keys, so a modal opened
// on top of another (e.g. a confirm inside Profile) closes alone on Esc.
const trapStack: symbol[] = [];

// Minimal, dependency-free focus trap + Escape-to-close for a single modal.
// AnimatedOverlay uses it for every modal that passes `onEscape`; CheckoutModal
// and UpgradeModal call it directly.
export function useModalFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>, onClose: () => void) {
    const previouslyFocused = useRef<HTMLElement | null>(null);
    // Latest handler without re-running the effect: a new closure on every
    // render would otherwise re-focus the first field each time.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!active) return;
        const container = containerRef.current;
        if (!container) return;

        const id = Symbol('modal-trap');
        trapStack.push(id);
        previouslyFocused.current = document.activeElement as HTMLElement | null;

        const focusable = () =>
            Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
                (el) => el.offsetParent !== null
            );

        // A field with autoFocus already has the cursor; don't take it away.
        if (!container.contains(document.activeElement)) {
            const first = focusable()[0];
            (first ?? container).focus({ preventScroll: true });
        }

        function handleKeyDown(e: KeyboardEvent) {
            if (trapStack[trapStack.length - 1] !== id) return;
            if (e.key === 'Escape') {
                // A handler closer to the field (cancelling an inline edit) has
                // already used this Esc.
                if (e.defaultPrevented) return;
                e.preventDefault();
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab') return;

            const elements = focusable();
            if (elements.length === 0) {
                e.preventDefault();
                return;
            }
            const firstEl = elements[0];
            const lastEl = elements[elements.length - 1];
            if (e.shiftKey && document.activeElement === firstEl) {
                e.preventDefault();
                lastEl.focus();
            } else if (!e.shiftKey && document.activeElement === lastEl) {
                e.preventDefault();
                firstEl.focus();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            const at = trapStack.indexOf(id);
            if (at !== -1) trapStack.splice(at, 1);
            previouslyFocused.current?.focus?.({ preventScroll: true });
        };
    }, [active, containerRef]);
}
