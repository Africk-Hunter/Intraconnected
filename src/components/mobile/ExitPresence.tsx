import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { SHEET_EXIT_MS } from './sheetExit';

type Variant = 'pop' | 'fade' | 'toast';

// Renders `children` only while `show`, and when `show` turns false plays a short
// exit on a copy of what was on screen (the real nodes unmount at once, so the
// children keep their simple mount/unmount logic). The wrapper is display: contents,
// so it never affects layout or positioning. `pop` shrinks toward the --origin vars
// like the sheets and desktop modals; `fade` and `toast` are for menus and the toast.
export default function ExitPresence({ show, variant = 'pop', children }: { show: boolean; variant?: Variant; children: ReactNode }) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const lastNodes = useRef<Element[]>([]);
    const wasShown = useRef(false);

    useLayoutEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        if (show) {
            lastNodes.current = Array.from(wrap.children);
        } else if (wasShown.current && lastNodes.current.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const host = wrap.parentElement;
            if (host) {
                const ghost = document.createElement('div');
                ghost.className = `mmobile-exit-ghost mmobile-exit-ghost--${variant}`;
                ghost.setAttribute('aria-hidden', 'true');
                for (const node of lastNodes.current) {
                    const copy = node.cloneNode(true) as HTMLElement;
                    copy.removeAttribute('role');
                    copy.removeAttribute('aria-modal');
                    copy.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
                    ghost.append(copy);
                }
                host.insertBefore(ghost, wrap.nextSibling);
                window.setTimeout(() => ghost.remove(), SHEET_EXIT_MS + 30);
            }
        }
        if (!show) lastNodes.current = [];
        wasShown.current = show;
    });

    return <div ref={wrapRef} style={{ display: 'contents' }}>{show ? children : null}</div>;
}
