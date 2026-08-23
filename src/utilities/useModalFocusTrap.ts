import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Minimal, dependency-free focus trap + Escape-to-close for a single modal.
// Scoped to CheckoutModal/UpgradeModal (see programmer-docs/artifacts/launch-readiness-audit.md)
// rather than folded into AnimatedOverlay, which every modal in the app
// shares — changing behavior there would affect all of them at once.
export function useModalFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>, onClose: () => void) {
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!active) return;
        const container = containerRef.current;
        if (!container) return;

        previouslyFocused.current = document.activeElement as HTMLElement | null;

        const focusable = () =>
            Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
                (el) => el.offsetParent !== null
            );

        const first = focusable()[0];
        (first ?? container).focus({ preventScroll: true });

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
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
            previouslyFocused.current?.focus?.({ preventScroll: true });
        };
    }, [active, containerRef, onClose]);
}
