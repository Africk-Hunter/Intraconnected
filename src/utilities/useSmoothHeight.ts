import { useCallback, useEffect, useRef, useState } from 'react';

// Animates a container's height as its content grows or shrinks. CSS can't
// transition to/from `height: auto` in every browser, so this measures the
// inner element with a ResizeObserver and hands back an explicit pixel height
// for the outer one to transition. The first measurement is applied without
// animating (`animate` stays false until the next frame) so opening doesn't
// sweep up from zero.
export function useSmoothHeight<T extends HTMLElement>() {
    const [height, setHeight] = useState<number | undefined>(undefined);
    const [animate, setAnimate] = useState(false);
    const observerRef = useRef<ResizeObserver | null>(null);
    const frameRef = useRef<number | null>(null);

    const contentRef = useCallback((node: T | null) => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

        if (!node) {
            setHeight(undefined);
            setAnimate(false);
            return;
        }

        // offsetHeight is the layout size — unaffected by the modal's scale-in transform
        setHeight(node.offsetHeight);
        frameRef.current = requestAnimationFrame(() => setAnimate(true));

        const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
        observer.observe(node);
        observerRef.current = observer;
    }, []);

    useEffect(() => () => {
        observerRef.current?.disconnect();
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    }, []);

    return { contentRef, height, animate };
}
