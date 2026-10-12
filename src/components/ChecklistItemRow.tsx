import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CheckboxIcon } from './Icons';
import ChecklistItemMenu from './ChecklistItemMenu';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChecklistItem, cleanLink } from '../utilities';
import { showNotice } from '../utilities/idea/undoStack';

// One row of a checklist, shared by the card on the grid ('card') and the full view ('modal').
// Both are sortable inside the caller's own DndContext; the caller owns the list and the writes.

const LEAVE_MS = 140;
const POP_MS = 260;

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface ChecklistItemRowProps {
    item: ChecklistItem;
    variant: 'card' | 'modal';
    entering?: boolean;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (id: string, newText: string) => void;
    onLinkChange: (id: string, link: string) => void;
    onCopy: (text: string) => void;
}

function ChecklistItemRow({ item, variant, entering, onToggle, onDelete, onEdit, onLinkChange, onCopy }: ChecklistItemRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const [isEditing, setIsEditing] = useState(false);
    const [editDraft, setEditDraft] = useState('');
    const editInputRef = useRef<HTMLTextAreaElement>(null);
    const [isLinking, setIsLinking] = useState(false);
    const [linkDraft, setLinkDraft] = useState('');
    const linkInputRef = useRef<HTMLInputElement>(null);
    const cancelLinkRef = useRef(false);
    const [leaving, setLeaving] = useState(false);
    const [popped, setPopped] = useState(false);
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const moreRef = useRef<HTMLButtonElement>(null);

    // The delayed delete must call the latest handler, not the one from the click's render.
    const onDeleteRef = useRef(onDelete);
    onDeleteRef.current = onDelete;
    const timers = useRef<number[]>([]);
    useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
        zIndex: isDragging ? 1 : undefined,
        position: isDragging ? 'relative' as const : undefined,
    };

    useLayoutEffect(() => {
        if (!isEditing) return;
        const el = editInputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, [isEditing]);

    useLayoutEffect(() => {
        if (!isLinking) return;
        linkInputRef.current?.focus();
    }, [isLinking]);

    function startEdit() {
        setEditDraft(item.text);
        setIsEditing(true);
    }

    function commitEdit() {
        const text = editDraft.trim();
        if (text && text !== item.text) onEdit(item.id, text);
        setIsEditing(false);
    }

    function openLinkEditor() {
        setLinkDraft(item.link ?? '');
        setIsLinking(true);
    }

    function openMenuFromButton() {
        const rect = moreRef.current?.getBoundingClientRect();
        if (rect) setMenu({ x: rect.left, y: rect.bottom + 4 });
    }

    function closeMenu(returnFocus: boolean) {
        setMenu(null);
        if (returnFocus) moreRef.current?.focus({ preventScroll: true });
    }

    function commitLink() {
        if (cancelLinkRef.current) { cancelLinkRef.current = false; return; }
        const url = linkDraft.trim() ? cleanLink(linkDraft.trim()) : '';
        if (url !== (item.link ?? '')) onLinkChange(item.id, url);
        setIsLinking(false);
    }

    function toggle() {
        if (!item.checked && !prefersReducedMotion()) {
            setPopped(true);
            timers.current.push(window.setTimeout(() => setPopped(false), POP_MS));
        }
        onToggle(item.id);
    }

    function copy() {
        onCopy(item.text);
        showNotice('Copied');
    }

    // Plays the exit, then removes the row. A user who asked for less motion gets it at once.
    function remove() {
        if (leaving) return;
        if (prefersReducedMotion()) { onDelete(item.id); return; }
        setLeaving(true);
        timers.current.push(window.setTimeout(() => onDeleteRef.current(item.id), LEAVE_MS));
    }

    const classes = [
        'cl-item',
        `cl-item--${variant}`,
        item.checked && 'cl-item--checked',
        entering && 'cl-item--entering',
        leaving && 'cl-item--leaving',
    ].filter(Boolean).join(' ');

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={classes}
            onContextMenu={e => {
                if (isEditing || isLinking) return;
                e.preventDefault();
                e.stopPropagation();
                setMenu({ x: e.clientX, y: e.clientY });
            }}
        >
            <button className="cl-drag" {...attributes} {...listeners} aria-label={`Reorder "${item.text}"`}>
                <img src="images/DragHandle.svg" alt="" />
            </button>
            <button
                className={`cl-cb${popped ? ' cl-cb--pop' : ''}`}
                role="checkbox"
                aria-checked={item.checked}
                aria-label={item.text}
                onClick={toggle}
            >
                <CheckboxIcon checked={item.checked} />
            </button>
            {isEditing ? (
                <textarea
                    ref={editInputRef}
                    className="cl-edit-input"
                    aria-label="Item text"
                    value={editDraft}
                    onChange={e => {
                        setEditDraft(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onBlur={commitEdit}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); commitEdit(); }
                        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setIsEditing(false); }
                    }}
                    maxLength={200}
                />
            ) : item.link ? (
                <a href={item.link} target="_blank" rel="noreferrer" className="cl-text cl-text--linked">
                    {item.text}
                </a>
            ) : (
                <span className="cl-text" onDoubleClick={startEdit}>{item.text}</span>
            )}
            {!isEditing && (
                <button
                    ref={moreRef}
                    className="cl-more"
                    aria-label={`Actions for "${item.text}"`}
                    aria-haspopup="menu"
                    aria-expanded={menu !== null}
                    title="More actions"
                    onClick={openMenuFromButton}
                >
                    ⋯
                </button>
            )}
            {menu && (
                <ChecklistItemMenu
                    x={menu.x}
                    y={menu.y}
                    hasLink={!!item.link}
                    onClose={closeMenu}
                    onRename={startEdit}
                    onCopy={copy}
                    onLink={openLinkEditor}
                    onRemoveLink={() => onLinkChange(item.id, '')}
                    onDelete={remove}
                />
            )}
            {isLinking && (
                <div className="cl-link-row">
                    <input
                        ref={linkInputRef}
                        className="cl-link-input"
                        aria-label="Link address"
                        value={linkDraft}
                        onChange={e => setLinkDraft(e.target.value)}
                        onBlur={commitLink}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitLink(); }
                            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelLinkRef.current = true; setIsLinking(false); }
                        }}
                        placeholder="Paste URL, press Enter"
                        maxLength={500}
                    />
                    {item.link && (
                        <button
                            className="cl-link-clear"
                            aria-label="Remove link"
                            onMouseDown={e => { e.preventDefault(); onLinkChange(item.id, ''); setIsLinking(false); }}
                            title="Remove link"
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}
        </li>
    );
}

export default ChecklistItemRow;
