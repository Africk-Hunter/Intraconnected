// Three round dots for the ⋯ "more actions" buttons. Drawn rather than the
// "⋯" character, which most fonts don't have, so the fallback glyph came out
// wide and stretched.
function MoreDotsIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
            <circle cx="4" cy="10" r="2.1" />
            <circle cx="10" cy="10" r="2.1" />
            <circle cx="16" cy="10" r="2.1" />
        </svg>
    );
}

export default MoreDotsIcon;
