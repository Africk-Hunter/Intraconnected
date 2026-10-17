import { useEffect, useRef, useState } from 'react';
import CustomizationSettings from './modals/CustomizationSettings';
import { PaletteIcon } from './Icons';

interface Props {
    open: boolean;
    onClose: () => void;
}

// The theme editor, docked beside the right sidebar with no backdrop: every
// change paints the real app behind it, so the app itself is the preview.
// Esc closes it unless a modal (the color picker) is open on top.
export default function ThemePanel({ open, onClose }: Props) {
    const ref = useRef<HTMLElement>(null);
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });
    // Mounted on first open and kept, so edits, scroll and open dropdowns survive closing.
    const [mounted, setMounted] = useState(open);
    if (open && !mounted) setMounted(true);

    useEffect(() => {
        if (!open) return;
        const panel = ref.current;
        const opener = document.activeElement as HTMLElement | null;
        panel?.focus({ preventScroll: true });
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('.overlay')) return;
            e.preventDefault();
            onCloseRef.current();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            // Hand focus back to the palette button if it was in the panel (inert has
            // already dropped it to <body> by now), not if the user clicked elsewhere.
            const el = document.activeElement;
            const lost = !el || el === document.body || panel?.contains(el);
            if (lost && opener?.isConnected) opener.focus({ preventScroll: true });
        };
    }, [open]);

    return (
        <aside
            ref={ref}
            className={`theme-panel${open ? ' theme-panel--open' : ''}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby="theme-panel-title"
            tabIndex={-1}
            inert={!open}
        >
            <header className="theme-panel-head">
                <span className="theme-panel-icon"><PaletteIcon size="1.35rem" /></span>
                <h2 className="theme-panel-title" id="theme-panel-title">Theme</h2>
                <button type="button" className="theme-panel-close neobrutal-button" onClick={onClose} aria-label="Close theme panel" title="Close (Esc)">
                    &#10005;
                </button>
            </header>
            {mounted && <CustomizationSettings variant="panel" />}
        </aside>
    );
}
