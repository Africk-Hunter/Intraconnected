import { useRef } from 'react';

const CLOSE_DISTANCE_PX = 90;
const FLICK_DISTANCE_PX = 30;
const FLICK_SPEED_PX_PER_MS = 0.5;

// Drag a sheet down by its grab handle / header to close it, as with native
// bottom sheets. Spread `dragProps` on the handle area and put `sheetRef` on
// the element that should move. `onRequestClose` returns false when the
// sheet decided not to close (e.g. it asked "Discard changes?"), and the
// sheet springs back.
export function useSheetSwipeDown(onRequestClose: () => boolean | void) {
    const sheetRef = useRef<HTMLDivElement | null>(null);
    const start = useRef<{ y: number; t: number } | null>(null);
    const dy = useRef(0);

    function springBack() {
        const el = sheetRef.current;
        if (!el) return;
        el.style.transition = 'transform 0.2s ease';
        el.style.transform = '';
    }

    function onTouchStart(e: React.TouchEvent) {
        start.current = { y: e.touches[0].clientY, t: Date.now() };
        dy.current = 0;
        if (sheetRef.current) sheetRef.current.style.transition = 'none';
    }

    function onTouchMove(e: React.TouchEvent) {
        if (!start.current) return;
        dy.current = Math.max(0, e.touches[0].clientY - start.current.y);
        if (sheetRef.current) sheetRef.current.style.transform = dy.current > 0 ? `translateY(${dy.current}px)` : '';
    }

    function onTouchEnd() {
        if (!start.current) return;
        const distance = dy.current;
        const speed = distance / Math.max(1, Date.now() - start.current.t);
        start.current = null;
        dy.current = 0;
        const wantsClose = distance > CLOSE_DISTANCE_PX || (distance > FLICK_DISTANCE_PX && speed > FLICK_SPEED_PX_PER_MS);
        // Closing unmounts the sheet from where it was dragged to; anything
        // else (a tap, a short drag, a refused close) springs back.
        if (!wantsClose || onRequestClose() === false) springBack();
    }

    return {
        sheetRef,
        dragProps: {
            onTouchStart,
            onTouchMove,
            onTouchEnd,
            onTouchCancel: () => { start.current = null; springBack(); },
        },
    };
}
