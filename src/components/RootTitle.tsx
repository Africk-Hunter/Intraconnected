import { useEffect, useState } from 'react';

// Name length -> how much smaller the title is set, so most names fit whole.
// Past CLAMP_AT it stays small and folds to a few lines with "Show more".
const SCALE_STEPS: [maxLength: number, scale: number][] = [
    [28, 1],
    [56, 0.72],
    [Infinity, 0.52],
];
const CLAMP_AT = 110;

interface RootTitleProps {
    name: string;
    renamable: boolean;
    onRename: () => void;
}

// The big title card of the idea you are inside. Click or Enter renames it
// (except at the top level, where there is nothing to rename).
function RootTitle({ name, renamable, onRename }: RootTitleProps) {
    const [expanded, setExpanded] = useState(false);
    const length = name.trim().length;
    const scale = SCALE_STEPS.find(([max]) => length <= max)![1];
    const long = length > CLAMP_AT;

    // A new idea starts folded.
    useEffect(() => setExpanded(false), [name]);

    return (
        <div className="rootTitle">
            <div
                className={`ideaRoot neobrutal-button${long && !expanded ? ' ideaRoot--clamped' : ''}${long && expanded ? ' ideaRoot--expanded' : ''}`}
                style={{ '--root-scale': scale } as React.CSSProperties}
                onClick={() => { if (renamable) onRename(); }}
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
