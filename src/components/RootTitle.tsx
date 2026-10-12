import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Name length -> how much smaller the title is set, so most names fit whole.
// Interpolated between these points so the size glides from idea to idea
// (the CSS transition on font-size then animates each change).
// Past CLAMP_AT it stays small and folds to a few lines with "Show more".
const SCALE_POINTS: [length: number, scale: number][] = [
    [16, 1],
    [56, 0.72],
    [100, 0.52],
];
const CLAMP_AT = 110;

function scaleFor(length: number): number {
    const first = SCALE_POINTS[0];
    const last = SCALE_POINTS[SCALE_POINTS.length - 1];
    if (length <= first[0]) return first[1];
    if (length >= last[0]) return last[1];
    for (let i = 1; i < SCALE_POINTS.length; i++) {
        const [l0, s0] = SCALE_POINTS[i - 1];
        const [l1, s1] = SCALE_POINTS[i];
        if (length <= l1) return s0 + ((length - l0) / (l1 - l0)) * (s1 - s0);
    }
    return last[1];
}

interface RootTitleProps {
    name: string;
    renamable: boolean;
    onRename: () => void;
    onContextMenu: (x: number, y: number) => void;
}

// The big title card of the idea you are inside. Click or Enter renames it
// (except at the top level, where there is nothing to rename).
function RootTitle({ name, renamable, onRename, onContextMenu }: RootTitleProps) {
    const [expanded, setExpanded] = useState(false);
    const length = name.trim().length;
    const scale = Math.round(scaleFor(length) * 100) / 100;
    const long = length > CLAMP_AT;

    // A new idea starts folded.
    useEffect(() => setExpanded(false), [name]);

    // Width, height and font-size can't be CSS-transitioned across a name swap
    // (auto sizes), so glide from the old measurements to the new ones.
    const cardRef = useRef<HTMLDivElement>(null);
    const last = useRef<{ w: number; h: number; font: number; name: string } | null>(null);
    useLayoutEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const font = parseFloat(getComputedStyle(el).fontSize);
        const prev = last.current;
        last.current = { w: rect.width, h: rect.height, font, name };
        if (!prev || prev.name === name || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
        // The text stays laid out at its final size and wrapping (fixed width,
        // no font-size tween) so it never reflows mid-animation; it eases in
        // while the card grows or shrinks around it, clipping any overhang.
        const text = el.querySelector<HTMLElement>('.ideaRoot-text');
        const textWidth = text ? `${text.getBoundingClientRect().width}px` : 'auto';
        text?.animate(
            [
                { opacity: 0, transform: 'translateY(0.4em)', width: textWidth, flexShrink: 0 },
                { opacity: 1, transform: 'translateY(0)', width: textWidth, flexShrink: 0 },
            ],
            { duration: 320, easing: ease },
        );
        if (Math.abs(prev.w - rect.width) < 1 && Math.abs(prev.h - rect.height) < 1) return;
        el.animate(
            [
                { boxSizing: 'border-box', overflow: 'hidden', width: `${prev.w}px`, height: `${prev.h}px` },
                { boxSizing: 'border-box', overflow: 'hidden', width: `${rect.width}px`, height: `${rect.height}px` },
            ],
            { duration: 380, easing: ease },
        );
    }, [name, scale]);

    return (
        <div className="rootTitle">
            <div
                ref={cardRef}
                className={`ideaRoot neobrutal-button${long && !expanded ? ' ideaRoot--clamped' : ''}${long && expanded ? ' ideaRoot--expanded' : ''}`}
                style={{ '--root-scale': scale } as React.CSSProperties}
                onClick={() => { if (renamable) onRename(); }}
                onContextMenu={e => { e.preventDefault(); onContextMenu(e.clientX, e.clientY); }}
                title={renamable ? 'Rename (F2)' : undefined}
                role={renamable ? 'button' : undefined}
                tabIndex={renamable ? 0 : undefined}
                onKeyDown={e => { if (renamable && e.key === 'Enter') { e.preventDefault(); onRename(); } }}
            >
                <span className="ideaRoot-text">{name}</span>
            </div>
            {long && (
                <button type="button" className="rootTitle-toggle" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
                    {expanded ? 'Show less ▴' : 'Show more ▾'}
                </button>
            )}
        </div>
    );
}

export default RootTitle;
