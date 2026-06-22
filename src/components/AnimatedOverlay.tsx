import { useState, useEffect, ReactNode, useRef } from 'react';

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
    children: ReactNode;
}

export default function AnimatedOverlay({ open, scrollable, onClick, children }: Props) {
    const [show, setShow] = useState(open);
    const [closing, setClosing] = useState(false);
    const [origin, setOrigin] = useState({ x: 0, y: 0 });
    const everOpenedRef = useRef(open);

    useEffect(() => {
        if (open) {
            everOpenedRef.current = true;
            setOrigin({
                x: lastPointer.x - window.innerWidth / 2,
                y: lastPointer.y - window.innerHeight / 2,
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
    }, [open]);

    if (!show) return null;

    const cls = [
        'overlay',
        scrollable && 'overlay--scroll',
        closing && 'overlay--closing',
    ].filter(Boolean).join(' ');

    return (
        <section
            className={cls}
            onClick={onClick}
            style={{
                '--origin-dx': `${origin.x}px`,
                '--origin-dy': `${origin.y}px`,
            } as React.CSSProperties}
        >
            {children}
        </section>
    );
}
