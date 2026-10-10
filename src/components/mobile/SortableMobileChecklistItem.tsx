import { useLayoutEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ChecklistItem } from '../../utilities/types';
import { cleanLink, openIdeaLink } from '../../utilities';
import MoreDotsIcon from './MoreDotsIcon';
import { LinkOutIcon } from '../Icons';

export interface SortableMobileItemProps {
    item: ChecklistItem;
    nodeId: number;
    onToggle: (id: string, nodeId: number) => void;
    onDelete: (id: string, nodeId: number) => void;
    onEdit: (id: string, newText: string, nodeId: number) => void;
    onLinkChange: (id: string, link: string, nodeId: number) => void;
}

// One row of the full checklist view: drag handle · (checkbox + text, one
// big target that ticks the item, like the inline view) · ↗ when it has a
// link · ⋯ for Edit / Link / Delete. Every target is at least 44px; the
// rarely-used actions sit behind ⋯ instead of crowding the row.
function SortableMobileChecklistItem({ item, nodeId, onToggle, onDelete, onEdit, onLinkChange }: SortableMobileItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const [menuOpen, setMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editDraft, setEditDraft] = useState('');
    const editInputRef = useRef<HTMLTextAreaElement>(null);
    const [isLinking, setIsLinking] = useState(false);
    const [linkDraft, setLinkDraft] = useState('');
    const linkInputRef = useRef<HTMLInputElement>(null);
    const cancelLinkRef = useRef(false);

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
    }, [isEditing]);

    useLayoutEffect(() => {
        if (!isLinking) return;
        linkInputRef.current?.focus();
    }, [isLinking]);

    function startEdit() {
        setMenuOpen(false);
        setEditDraft(item.text);
        setIsEditing(true);
    }

    function commitEdit() {
        const text = editDraft.trim();
        if (text && text !== item.text) onEdit(item.id, text, nodeId);
        setIsEditing(false);
    }

    function openLinkEditor() {
        setMenuOpen(false);
        setLinkDraft(item.link ?? '');
        setIsLinking(true);
    }

    function commitLink() {
        if (cancelLinkRef.current) { cancelLinkRef.current = false; return; }
        const url = linkDraft.trim() ? cleanLink(linkDraft.trim()) : '';
        if (url !== (item.link ?? '')) onLinkChange(item.id, url, nodeId);
        setIsLinking(false);
    }

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`mmobile-checklist-sheet-item${item.checked ? ' mmobile-checklist-sheet-item--checked' : ''}${menuOpen ? ' mmobile-checklist-sheet-item--menu' : ''}`}
        >
            <div className="mmobile-checklist-sheet-row">
                <button className="mmobile-checklist-sheet-drag" {...attributes} {...listeners} aria-label="Drag to reorder">
                    <img src="/images/DragHandle.svg" alt="" />
                </button>
                {isEditing ? (
                    <textarea
                        ref={editInputRef}
                        className="mmobile-checklist-sheet-edit-input"
                        value={editDraft}
                        rows={1}
                        enterKeyHint="done"
                        aria-label="Item text"
                        onChange={e => {
                            setEditDraft(e.target.value);
                            const el = e.target;
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                        }}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') setIsEditing(false); }}
                        maxLength={200}
                    />
                ) : (
                    <button
                        className="mmobile-checklist-sheet-toggle"
                        role="checkbox"
                        aria-checked={item.checked}
                        onClick={() => onToggle(item.id, nodeId)}
                    >
                        <span className="mmobile-checklist-sheet-cb" aria-hidden="true" />
                        <span className={`mmobile-checklist-sheet-text${item.link ? ' mmobile-checklist-sheet-text--linked' : ''}`}>{item.text}</span>
                    </button>
                )}
                {item.link && !isEditing && (
                    <button className="mmobile-checklist-sheet-open" onClick={() => openIdeaLink(item.link!)} aria-label="Open link">
                        <LinkOutIcon />
                    </button>
                )}
                {!isEditing && (
                    <button
                        className="mmobile-checklist-sheet-more"
                        onClick={() => setMenuOpen(open => !open)}
                        aria-expanded={menuOpen}
                        aria-label={`Actions for ${item.text}`}
                    >
                        <MoreDotsIcon />
                    </button>
                )}
            </div>

            {menuOpen && !isEditing && !isLinking && (
                <div className="mmobile-checklist-sheet-menu">
                    <button className="mmobile-checklist-sheet-menu-btn" onClick={startEdit}>
                        <img src="/images/Pen.svg" alt="" /> Edit
                    </button>
                    <button className="mmobile-checklist-sheet-menu-btn" onClick={openLinkEditor}>
                        <img src="/images/LinkBlack.svg" alt="" /> {item.link ? 'Link' : 'Add link'}
                    </button>
                    <button
                        className="mmobile-checklist-sheet-menu-btn mmobile-checklist-sheet-menu-btn--delete"
                        onClick={() => { setMenuOpen(false); onDelete(item.id, nodeId); }}
                    >
                        <img src="/images/Trash.svg" alt="" /> Delete
                    </button>
                </div>
            )}

            {isLinking && (
                <div className="mmobile-checklist-sheet-item-link-row">
                    <input
                        ref={linkInputRef}
                        className="mmobile-checklist-sheet-item-link-input"
                        value={linkDraft}
                        onChange={e => setLinkDraft(e.target.value)}
                        onBlur={commitLink}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitLink(); }
                            if (e.key === 'Escape') { cancelLinkRef.current = true; setIsLinking(false); }
                        }}
                        type="url"
                        enterKeyHint="done"
                        aria-label="Link"
                        placeholder="Paste URL, press Enter"
                        maxLength={500}
                    />
                    {item.link && (
                        <button
                            className="mmobile-checklist-sheet-item-link-clear"
                            onMouseDown={e => { e.preventDefault(); onLinkChange(item.id, '', nodeId); setIsLinking(false); }}
                            aria-label="Remove link"
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}
        </li>
    );
}

export default SortableMobileChecklistItem;
