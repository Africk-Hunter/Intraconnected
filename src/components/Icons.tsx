// Drawn icons for places that used emoji or emoji-capable symbols (↗ 🔒 ✉️ 🎉
// ⚠ ☑ ☐). Those characters get swapped for colour emoji on some phones and
// browsers; these are the same on every device and follow the text colour.
interface IconProps {
    size?: number | string;
    className?: string;
}

function base({ size = '1em', className }: IconProps) {
    return {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2.6,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        className,
        style: { verticalAlign: '-0.15em' },
        'aria-hidden': true as const,
        focusable: false as const,
    };
}

// Arrow leaving a box: "opens a website".
export function LinkOutIcon(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M14 4h6v6" />
            <path d="M20 4 10.5 13.5" />
            <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
        </svg>
    );
}

export function LockIcon(props: IconProps) {
    return (
        <svg {...base(props)}>
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </svg>
    );
}

export function UnlockIcon(props: IconProps) {
    return (
        <svg {...base(props)}>
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
            <path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" />
        </svg>
    );
}

export function MailIcon(props: IconProps) {
    return (
        <svg {...base(props)}>
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="m4 7.5 8 6 8-6" />
        </svg>
    );
}

export function WarningIcon(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M12 4 2.8 19.5h18.4L12 4Z" />
            <path d="M12 10v4.5" />
            <path d="M12 17.2v.1" />
        </svg>
    );
}

// Square checkbox, ticked or empty.
export function CheckboxIcon({ checked, ...props }: IconProps & { checked: boolean }) {
    return (
        <svg {...base(props)}>
            <rect x="4" y="4" width="16" height="16" rx="3" />
            {checked && <path d="m8.5 12.3 2.4 2.4 4.6-5" />}
        </svg>
    );
}

// Painter's palette: a round board with a thumb hole, a finger notch and dabs of paint. The theme panel.
export function PaletteIcon(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M12 3.5c-5 0-9 3.4-9 7.8 0 3.9 3.3 7.2 7.6 7.2 1.3 0 1.9-.7 1.9-1.6 0-.6-.3-1-.3-1.6 0-1 .8-1.7 1.8-1.7h2.2c2.9 0 4.8-1.6 4.8-4C21 6.6 17 3.5 12 3.5z" />
            <circle cx="16.8" cy="11.4" r="1.3" />
            <g fill="currentColor" stroke="none">
                <circle cx="7.4" cy="9.6" r="1.45" />
                <circle cx="11.2" cy="6.9" r="1.45" />
                <circle cx="15.4" cy="7.2" r="1.45" />
                <circle cx="6.9" cy="13.7" r="1.45" />
            </g>
        </svg>
    );
}
