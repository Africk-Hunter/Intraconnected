import { useEffect, useRef, useState } from 'react';

// Whole-swap caps (ms), however long the text: long text is backspaced/typed
// several characters per frame, so it still reads as typing, just faster.
const DELETE_MAX_MS = 240;
const TYPE_MAX_MS = 300;
const FRAME_MS = 16;
const DELETE_STEP_MS = 16;
const TYPE_STEP_MS = 24;

// Shows `text`, but when it changes, backspaces the old text and types the new
// one. `enabled` false (e.g. while the title is being edited) tracks `text` at once.
// `visibleLength`, if given, says how many characters of the old text are actually on
// screen (a clamped title hides the rest): the hidden tail goes at once, then the
// visible part is backspaced.
export function useTypedSwap(text: string, enabled: boolean, visibleLength?: () => number): string {
    const [shown, setShown] = useState(text);
    const shownRef = useRef(text);
    const timer = useRef<number | undefined>(undefined);
    const visibleRef = useRef(visibleLength);
    visibleRef.current = visibleLength;

    useEffect(() => {
        const set = (v: string) => { shownRef.current = v; setShown(v); };
        window.clearTimeout(timer.current);

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!enabled || reduced || !shownRef.current || shownRef.current === text) {
            set(text);
            return;
        }

        const visible = Math.min(visibleRef.current?.() ?? shownRef.current.length, shownRef.current.length);
        if (visible < shownRef.current.length) set(shownRef.current.slice(0, Math.max(visible, 1)));
        const oldLen = shownRef.current.length;
        const delBudget = DELETE_MAX_MS;
        const typeBudget = TYPE_MAX_MS;
        // One frame per tick; long text removes/adds several characters per tick so the
        // whole swap stays inside its budget however long the text is.
        const delPerTick = Math.max(1, Math.ceil((oldLen * FRAME_MS) / delBudget));
        const typePerTick = Math.max(1, Math.ceil((text.length * FRAME_MS) / typeBudget));
        const delStep = Math.min(DELETE_STEP_MS, Math.max(FRAME_MS, delBudget / oldLen));
        const typeStep = Math.min(TYPE_STEP_MS, Math.max(FRAME_MS, typeBudget / Math.max(text.length, 1)));

        const type = (n: number) => {
            set(text.slice(0, n));
            if (n < text.length) timer.current = window.setTimeout(() => type(Math.min(n + typePerTick, text.length)), typeStep);
        };
        const erase = () => {
            const cur = shownRef.current;
            if (!cur) { type(Math.min(typePerTick, text.length)); return; }
            set(cur.slice(0, -delPerTick));
            timer.current = window.setTimeout(erase, delStep);
        };
        erase();

        return () => window.clearTimeout(timer.current);
    }, [text, enabled]);

    return shown;
}
