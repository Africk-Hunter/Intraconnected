// Arrow glyphs (← ↑ → ↓) fall back to different fonts and render at different
// sizes, so arrows are drawn as one SVG, rotated, inside their own key cap.
const ARROW_ROTATION: Record<string, number> = { '↑': 0, '→': 90, '↓': 180, '←': 270 };

function KeyCaps({ keys }: { keys: string }) {
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
