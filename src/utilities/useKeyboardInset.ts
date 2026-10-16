import { useEffect, type RefObject } from 'react';
import { onKeyboardHeight } from './platform';

const TEXT_INPUT_EXCLUDED = ['checkbox', 'radio', 'button', 'submit', 'range'];

function isTyping(): boolean {
    const el = document.activeElement;
    return el instanceof HTMLElement
        && (el.isContentEditable || el instanceof HTMLTextAreaElement
            || (el instanceof HTMLInputElement && !TEXT_INPUT_EXCLUDED.includes(el.type)));
}

// Writes the software keyboard's height to `--kb-inset` on the element, so a
// modal can pad its scroll area by it and let the buttons be scrolled above the
// keyboard. Fixed overlays are not resized by the keyboard on iOS or in the
// native app, which left the bottom of a tall modal unreachable.
export function useKeyboardInset(active: boolean, ref: RefObject<HTMLElement | null>) {
    useEffect(() => {
        const el = ref.current;
        if (!active || !el) return;
        const vv = window.visualViewport;
        let nativeKeyboard = 0;
        let fullHeight = window.innerHeight;

        function update() {
            if (!el) return;
            if (nativeKeyboard === 0) fullHeight = window.innerHeight;
            const fromViewport = vv ? window.innerHeight - vv.height - vv.offsetTop : 0;
            const fromNative = nativeKeyboard - (fullHeight - window.innerHeight);
            const inset = isTyping() || nativeKeyboard > 0
                ? Math.min(Math.max(0, fromViewport, fromNative), window.innerHeight * 0.6)
                : 0;
            el.style.setProperty('--kb-inset', `${inset}px`);
        }

        // Once the padding is in, bring the field being typed in back into view.
        function reveal() {
            update();
            const field = document.activeElement;
            if (field instanceof HTMLElement && el?.contains(field) && isTyping()) {
                field.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }

        let timers: number[] = [];
        function settle() {
            timers.forEach(clearTimeout);
            timers = [0, 150, 400].map(ms => window.setTimeout(reveal, ms));
        }

        update();
        const stopNative = onKeyboardHeight(height => { nativeKeyboard = height; settle(); });
        window.addEventListener('resize', update);
        vv?.addEventListener('resize', update);
        vv?.addEventListener('scroll', update);
        document.addEventListener('focusin', settle);
        document.addEventListener('focusout', settle);
        return () => {
            timers.forEach(clearTimeout);
            stopNative();
            window.removeEventListener('resize', update);
            vv?.removeEventListener('resize', update);
            vv?.removeEventListener('scroll', update);
            document.removeEventListener('focusin', settle);
            document.removeEventListener('focusout', settle);
            el.style.removeProperty('--kb-inset');
        };
    }, [active, ref]);
}
