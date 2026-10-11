// Arrow glyphs (← ↑ → ↓) fall back to different fonts and render at different
// sizes, so arrows are drawn as one SVG, rotated, inside their own key cap.
const ARROW_ROTATION: Record<string, number> = { '↑': 0, '→': 90, '↓': 180, '←': 270 };

// "Ctrl+K" becomes two caps joined by a plus; "/ or ?" is two alternatives.
function KeyCaps({ keys }: { keys: string }) {
    if (keys.includes(' or ')) {
        return (
            <span className="keycaps-combo">
                {keys.split(' or ').map((alt, i) => (
                    <span key={alt} className="keycaps-combo">
                        {i > 0 && <span className="keycaps-or">or</span>}
                        <KeyCaps keys={alt} />
                    </span>
                ))}
            </span>
        );
    }
    if (/^[^\s+]+\+[^\s]+$/.test(keys)) {
        return (
            <span className="keycaps-combo">
                {keys.split('+').map((k, i) => (
                    <span key={k} className="keycaps-combo">
                        {i > 0 && <span className="keycaps-plus" aria-hidden="true">+</span>}
                        <kbd>{k}</kbd>
                    </span>
                ))}
            </span>
        );
    }
    const tokens = keys.split(' ');
    if (!tokens.every((t) => t in ARROW_ROTATION)) return <kbd>{keys}</kbd>;

    return (
        <span className="keycaps-arrows">
            {tokens.map((t) => (
                <kbd key={t} className="keycap-arrow" aria-label={`${{ '↑': 'Up', '→': 'Right', '↓': 'Down', '←': 'Left' }[t]} arrow`}>
                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" style={{ transform: `rotate(${ARROW_ROTATION[t]}deg)` }}>
                        <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </kbd>
            ))}
        </span>
    );
}

export default KeyCaps;
