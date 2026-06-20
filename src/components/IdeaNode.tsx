import React, { useEffect, useRef, useState } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { IdeaType, ChecklistItem, getIdeaLink, updateChecklistItems } from '../utilities';

interface IdeaNodeProps {
    idea: IdeaType;
    isLeaf: boolean;
}

const IdeaNode: React.FC<IdeaNodeProps> = ({ idea, isLeaf }) => {
    const { setRootId, setRootName, rootIdStack, setRenameModalOpen, setLinkChangeModalOpen, setCurrentLinkID, setCurrentLink, setCurrentNameChangeId, setSelectedIdeaName, setNewIdeaSwitch, setChecklistModalId } = useIdeaContext();

    const { id, content: title } = idea;
    const link = getIdeaLink(idea);
    const isChecklist = idea.type === 'checklist';

    const [nodeType, setNodeType] = useState('leaf');
    const [copyPath, setCopyPath] = useState('images/CopyIcon.svg');
    const [addItemDraft, setAddItemDraft] = useState('');
    const [localItems, setLocalItems] = useState<ChecklistItem[]>(isChecklist ? idea.items : []);
    const addInputRef = useRef<HTMLInputElement>(null);

    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(max-width: 768px)').matches;
    });

    useEffect(() => {
        if (isChecklist) {
            setLocalItems(idea.items);
        }
    }, [idea]);

    function makeRoot() {
        setRootId(id);
        setRootName(title);
        rootIdStack.current?.push(id);
    }

    useEffect(() => {
        determineNodeType();
    }, [id, link, isLeaf, isChecklist]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width: 768px)');
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    function determineNodeType() {
        if (isChecklist) {
            setNodeType('checklist');
            return;
        }
        if (link && link !== '') {
            setNodeType('link');
            return;
        }
        setNodeType(isLeaf ? 'leaf' : 'parent');
    }

    // Drag and Drop
    const { attributes, listeners, setNodeRef: setDraggableRef, transform } = useDraggable({
        id: `idea-${id}`,
        disabled: isMobile,
    });
    const { isOver, setNodeRef: setDroppableRef, active } = useDroppable({
        id: `idea-${id}`,
        disabled: isMobile || isChecklist,
    });
    const setNodeRef = (node: HTMLElement | null) => {
        setDraggableRef(node);
        setDroppableRef(node);
    };
    const isBeingDraggedOver = isOver && active?.id !== `idea-${id}`;
    const draggableStyle = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition: 'none',
        cursor: 'grabbing',
    };
    const dropStyle = {
        border: isBeingDraggedOver ? '3px dashed #000' : undefined,
        transition: isBeingDraggedOver ? 'scale 0.2s ease-in-out, border 0.2s ease-in-out' : undefined,
        scale: isBeingDraggedOver ? '1.15' : undefined,
    };
    const combinedStyle = { ...draggableStyle, ...dropStyle };

    function copyToClipboard(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(title).then(() => {
            setTimeout(() => setCopyPath('images/CopyIcon.svg'), 1000);
            setCopyPath('images/Checkmark.svg');
        });
    }

    function changeLink(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        setCurrentLinkID(id);
        setCurrentLink(link);
        setLinkChangeModalOpen(true);
    }

    function changeName(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        setCurrentNameChangeId(id);
        setSelectedIdeaName(title);
        setRenameModalOpen(true);
    }

    function toggleItem(e: React.MouseEvent, itemId: string) {
        e.stopPropagation();
        e.preventDefault();
        const newItems = localItems.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
    }

    function commitAddItem() {
        const text = addItemDraft.trim();
        if (!text) return;
        const newItem: ChecklistItem = { id: String(Date.now()), text, checked: false };
        const newItems = [...localItems, newItem];
        setLocalItems(newItems);
        setAddItemDraft('');
        updateChecklistItems(id, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            commitAddItem();
        }
    }

    function deleteItem(e: React.MouseEvent, itemId: string) {
        e.stopPropagation();
        e.preventDefault();
        const newItems = localItems.filter(item => item.id !== itemId);
        setLocalItems(newItems);
        updateChecklistItems(id, newItems);
    }

    if (isChecklist) {
        return (
            <div
                ref={setNodeRef}
                style={combinedStyle}
                className={`neobrutal-button ideaNode checklist`}
                {...attributes}
                {...listeners}
            >
                <div className="checklist-header" onClick={() => setChecklistModalId(id)}>
                    <span className="checklist-title-text">{title}</span>
                    <button className="renameButtonNode copy" onClick={changeName}>
                        <img src='images/Pen.svg' alt="Rename" className="copyImg" />
                    </button>
                    <button className="copy" onClick={copyToClipboard}>
                        <img src={copyPath} alt="Copy" className="copyImg" />
                    </button>
                </div>
                <ul className="checklist-items" onClick={e => e.stopPropagation()}>
                    {localItems.map(item => (
                        <li key={item.id} className={`checklist-item${item.checked ? ' checklist-item--checked' : ''}`}>
                            <button
                                className="checklist-checkbox"
                                onClick={e => toggleItem(e, item.id)}
                            >
                                {item.checked ? '☑' : '☐'}
                            </button>
                            <span className="checklist-item-text">{item.text}</span>
                            <button className="checklist-item-delete" onClick={e => deleteItem(e, item.id)}>
                                <img src="images/Trash.svg" alt="Delete" />
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="checklist-add" onClick={e => e.stopPropagation()}>
                    <input
                        ref={addInputRef}
                        className="checklist-add-input"
                        placeholder="+ Add item"
                        value={addItemDraft}
                        onChange={e => setAddItemDraft(e.target.value)}
                        onKeyDown={handleAddKeyDown}
                        maxLength={200}
                    />
                </div>
            </div>
        );
    }

    return (
        link && link !== "" ? (
            <a href={link} target='_blank' ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}`} {...attributes} {...listeners}>
                {title}
                <button className="editLink copy" onClick={changeLink}><img src='images/LinkBlack.svg' alt="Change Link" className="copyImg" /></button>
                <button className="renameButtonNode copy" onClick={changeName}><img src='images/Pen.svg' alt="Rename" className="copyImg" /></button>
                <button className="copy" onClick={copyToClipboard}><img src={copyPath} alt="Copy Idea Content" className="copyImg" /></button>
            </a>
        ) : (
            <div onClick={makeRoot} ref={setNodeRef} style={combinedStyle} className={`neobrutal-button ideaNode ${nodeType}`} {...attributes} {...listeners}>
                {title}
                {isLeaf ? <button className="editLink copy" onClick={changeLink}><img src='images/LinkBlack.svg' alt="Change Link" className="copyImg" /></button> : <></>}
                <button className="renameButtonNode copy" onClick={changeName}><img src='images/Pen.svg' alt="Rename" className="copyImg" /></button>
                <button className="copy" onClick={copyToClipboard}><img src={copyPath} alt="Copy Idea Content" className="copyImg" /></button>
            </div>
        )
    );
};

export default IdeaNode;
