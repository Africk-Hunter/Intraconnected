interface VaultLockGlyphProps {
    open: boolean;
    size?: number | string;
    className?: string;
}

// Padlock whose shackle lifts and swings open when the vault unlocks, so the
// state change is visible rather than a silent icon swap (motion in vault.scss).
function VaultLockGlyph({ open, size = '1em', className }: VaultLockGlyphProps) {
    return (
        <svg
            className={`vault-lock${open ? ' vault-lock--open' : ''}${className ? ` ${className}` : ''}`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path className="vault-lock-shackle" d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
            <path d="M12 14.6v2" />
        </svg>
    );
}

export default VaultLockGlyph;
