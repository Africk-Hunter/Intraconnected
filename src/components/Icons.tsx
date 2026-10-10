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

// Celebration burst (replaces the party popper).
export function SparkleIcon(props: IconProps) {
    return (
        <svg {...base(props)}>
            <path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21" />
            <path d="m6 6 2.6 2.6M15.4 15.4 18 18M18 6l-2.6 2.6M8.6 15.4 6 18" />
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
