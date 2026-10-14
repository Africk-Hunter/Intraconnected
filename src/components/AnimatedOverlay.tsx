import { useState, useEffect, ReactNode, useRef } from 'react';
import { useModalFocusTrap } from '../utilities/useModalFocusTrap';

const lastPointer = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', (e) => {
        lastPointer.x = e.clientX;
        lastPointer.y = e.clientY;
    }, { passive: true });
}

interface Props {
    open: boolean;
    scrollable?: boolean;
    onClick?: () => void;
    // Passing this makes the overlay a proper modal: Esc calls it, Tab stays inside,
    // and focus goes back to whatever opened it. Omit for forced modals.
    onEscape?: () => void;
    children: ReactNode;
    origin?: { x: number; y: number };
}

export default function AnimatedOverlay({ open, scrollable, onClick, onEscape, children, origin }: Props) {
    const [show, setShow] = useState(open);
    const [closing, setClosing] = useState(false);
    const [animOrigin, setAnimOrigin] = useState({ x: 0, y: 0 });
    const everOpenedRef = useRef(open);
    const sectionRef = useRef<HTMLElement>(null);
    useModalFocusTrap(open && show && !!onEscape, sectionRef, onEscape ?? (() => {}));

    useEffect(() => {
        if (open) {
            everOpenedRef.current = true;
            const src = origin ?? lastPointer;
            setAnimOrigin({
                x: src.x - window.innerWidth / 2,
                y: src.y - window.innerHeight / 2,
            });
            setShow(true);
            setClosing(false);
        } else if (everOpenedRef.current) {
            setClosing(true);
            const t = setTimeout(() => {
                setShow(false);
                setClosing(false);
            }, 150);
            return () => clearTimeout(t);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only when the listed deps change, by design
    }, [open]);

    if (!show) return null;

    const cls = [
        'overlay',
        scrollable && 'overlay--scroll',
        closing && 'overlay--closing',
    ].filter(Boolean).join(' ');

    return (
        <section
            ref={sectionRef}
            className={cls}
            onClick={onClick}
            style={{
                '--origin-dx': `${animOrigin.x}px`,
                '--origin-dy': `${animOrigin.y}px`,
            } as React.CSSProperties}
        >
            {children}
        </section>
    );
}
