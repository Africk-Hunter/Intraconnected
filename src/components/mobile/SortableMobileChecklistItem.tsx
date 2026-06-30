import { useLayoutEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ChecklistItem } from '../../utilities/types';
import { cleanLink } from '../../utilities';

export interface SortableMobileItemProps {
    item: ChecklistItem;
    nodeId: number;
    onToggle: (id: string, nodeId: number) => void;
    onDelete: (id: string, nodeId: number) => void;
    onEdit: (id: string, newText: string, nodeId: number) => void;
    onLinkChange: (id: string, link: string, nodeId: number) => void;
}

function SortableMobileChecklistItem({ item, nodeId, onToggle, onDelete, onEdit, onLinkChange }: SortableMobileItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
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
        setEditDraft(item.text);
        setIsEditing(true);
    }

    function commitEdit() {
        const text = editDraft.trim();
        if (text && text !== item.text) onEdit(item.id, text, nodeId);
        setIsEditing(false);
    }

    function openLink() {
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
            className={`mmobile-checklist-sheet-item${item.checked ? ' mmobile-checklist-sheet-item--checked' : ''}`}
        >
            <button className="mmobile-checklist-sheet-drag" {...attributes} {...listeners} aria-label="Drag to reorder">
                <img src="/images/DragHandle.svg" alt="" />
            </button>
            <button className="mmobile-checklist-sheet-cb" onClick={() => onToggle(item.id, nodeId)} />
            {isEditing ? (
                <textarea
                    ref={editInputRef}
                    className="mmobile-checklist-sheet-edit-input"
                    value={editDraft}
                    rows={1}
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
                item.link ? (
                    <a href={item.link} target="_blank" rel="noreferrer" className="mmobile-checklist-sheet-text mmobile-checklist-sheet-text--linked">
                        {item.text}
                    </a>
                ) : (
                    <span className="mmobile-checklist-sheet-text">{item.text}</span>
                )
            )}
            {!isEditing && (
                <>
                    <button
                        className={`mmobile-checklist-sheet-link${item.link ? ' mmobile-checklist-sheet-link--active' : ''}`}
                        onClick={() => isLinking ? setIsLinking(false) : openLink()}
                        title={item.link ? 'Edit link' : 'Add link'}
                    >
                        <img src="/images/LinkBlack.svg" alt="Link" />
                    </button>
                    <button className="mmobile-checklist-sheet-edit" onClick={startEdit}>
                        <img src="/images/Pen.svg" alt="Edit" />
                    </button>
                </>
            )}
            <button className="mmobile-checklist-sheet-del" onClick={() => onDelete(item.id, nodeId)}>
                <img src="/images/Trash.svg" alt="Delete" />
            </button>
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
                        placeholder="Paste URL, press Enter"
                        maxLength={500}
                    />
                    {item.link && (
                        <button
                            className="mmobile-checklist-sheet-item-link-clear"
                            onMouseDown={e => { e.preventDefault(); onLinkChange(item.id, '', nodeId); setIsLinking(false); }}
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

export default SortableMobileChecklistItem;
