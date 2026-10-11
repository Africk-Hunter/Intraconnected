import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface MenuItem {
    label: string;
    danger?: boolean;
    run: () => void;
}

interface ChecklistItemMenuProps {
    x: number;
    y: number;
    hasLink: boolean;
    onRename: () => void;
    onCopy: () => void;
    onLink: () => void;
    onRemoveLink: () => void;
    onDelete: () => void;
    // `returnFocus`: hand focus back to the button that opened the menu.
    onClose: (returnFocus: boolean) => void;
}

// The actions for one checklist row, opened by its ⋯ button, a right-click or the keyboard.
// Same look and keys as CardMenu (it reuses its classes). Rendered in a portal because the row
// sits inside a draggable card and a scrolling modal.
function ChecklistItemMenu({ x, y, hasLink, onRename, onCopy, onLink, onRemoveLink, onDelete, onClose }: ChecklistItemMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

    // Open where asked, then slide back in if it would overflow the window.
    useLayoutEffect(() => {
        const el = menuRef.current;
        if (!el) return;
        const margin = 8;
        setPos({
            left: Math.max(margin, Math.min(x, window.innerWidth - el.offsetWidth - margin)),
            top: Math.max(margin, Math.min(y, window.innerHeight - el.offsetHeight - margin)),
        });
    }, [x, y]);

    // First item gets focus so the arrow keys work straight away.
    useEffect(() => {
        if (pos) menuRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    }, [pos]);

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            const el = menuRef.current;
            if (!el) return;
            const items = Array.from(el.querySelectorAll<HTMLElement>('button'));
            const at = items.indexOf(document.activeElement as HTMLElement);
            const move = (to: number) => { e.preventDefault(); e.stopPropagation(); items[to]?.focus(); };
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(true); }
            else if (e.key === 'ArrowDown') move((at + 1) % items.length);
            else if (e.key === 'ArrowUp') move((at - 1 + items.length) % items.length);
            else if (e.key === 'Home') move(0);
            else if (e.key === 'End') move(items.length - 1);
            else if (e.key === 'Tab') onClose(false);
        }
        const dismiss = () => onClose(false);
        // Capture phase, so an open modal's own Esc handler sees the key already used.
        document.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('resize', dismiss);
        window.addEventListener('blur', dismiss);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('resize', dismiss);
            window.removeEventListener('blur', dismiss);
        };
    }, [onClose]);

    const items: MenuItem[] = [
        { label: 'Rename', run: onRename },
        { label: 'Copy text', run: onCopy },
        { label: hasLink ? 'Change link' : 'Add link', run: onLink },
    ];
    if (hasLink) items.push({ label: 'Remove link', run: onRemoveLink });
    items.push({ label: 'Delete', danger: true, run: onDelete });

    return createPortal(
        <>
            <div
                className="card-menu-backdrop"
                onMouseDown={e => { e.stopPropagation(); onClose(false); }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onClose(false); }}
            />
            <div
                ref={menuRef}
                className="card-menu card-menu--item neobrutal"
                role="menu"
                aria-label="Item actions"
                style={{ left: pos?.left ?? x, top: pos?.top ?? y, visibility: pos ? 'visible' : 'hidden' }}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
            >
                {items.map(item => (
                    <button
                        key={item.label}
                        className={`card-menu-item${item.danger ? ' card-menu-item--danger' : ''}`}
                        role="menuitem"
                        type="button"
                        onClick={() => { onClose(false); item.run(); }}
                    >
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>
        </>,
        document.body,
    );
}

export default ChecklistItemMenu;
