import { useLayoutEffect, useRef, useState } from 'react';

// A plain (green) idea's text, folded to 12 lines with a Show more / Show less
// button when it runs longer. Overflow is only re-measured while folded, so the
// button stays after the text is opened.
export default function LeafTitle({ text }: { text: string }) {
    const textRef = useRef<HTMLSpanElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [overflows, setOverflows] = useState(false);

    useLayoutEffect(() => {
        const el = textRef.current;
        if (!el || expanded) return;
        const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [text, expanded]);

    const stop = (e: React.SyntheticEvent) => e.stopPropagation();

    return (
        <span className="mmobile-node-title mmobile-node-title--leaf">
            <span ref={textRef} className={`mmobile-node-leaf-text${expanded ? '' : ' mmobile-node-leaf-text--clamped'}`}>{text}</span>
            {(overflows || expanded) && (
                <button
                    type="button"
                    className="mmobile-node-leaf-toggle"
                    aria-expanded={expanded}
                    onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                    onTouchStart={stop}
                    onTouchEnd={stop}
                >
                    {expanded ? 'Show less ▴' : 'Show more ▾'}
                </button>
            )}
        </span>
    );
}
