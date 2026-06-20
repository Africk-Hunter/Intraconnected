import { useState, useEffect, useRef } from 'react';
import { useIdeaContext } from '../../context/IdeaContext';
import { ChecklistItem, fetchFullIdeaList, updateChecklistItems } from '../../utilities';

function ChecklistModal() {
    const {
        checklistModalId, setChecklistModalId,
        setCurrentNameChangeId, setSelectedIdeaName, setRenameModalOpen,
    } = useIdeaContext();

    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [title, setTitle] = useState('');
    const [draft, setDraft] = useState('');
    const addInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (checklistModalId === null) return;
        const idea = fetchFullIdeaList().find(i => i.id === checklistModalId);
        if (!idea || idea.type !== 'checklist') return;
        setTitle(idea.content);
        setItems(idea.items);
        setDraft('');
        setTimeout(() => addInputRef.current?.focus(), 50);
    }, [checklistModalId]);

    if (checklistModalId === null) return null;

    function close() { setChecklistModalId(null); }

    function toggleItem(itemId: string) {
        const newItems = items.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        setItems(newItems);
        updateChecklistItems(checklistModalId!, newItems);
    }

    function deleteItem(itemId: string) {
        const newItems = items.filter(item => item.id !== itemId);
        setItems(newItems);
        updateChecklistItems(checklistModalId!, newItems);
    }

    function addItem() {
        const text = draft.trim();
        if (!text) return;
        const newItems = [...items, { id: String(Date.now()), text, checked: false }];
        setItems(newItems);
        setDraft('');
        updateChecklistItems(checklistModalId!, newItems);
        addInputRef.current?.focus();
    }

    function openRename() {
        setCurrentNameChangeId(checklistModalId!);
        setSelectedIdeaName(title);
        setRenameModalOpen(true);
        close();
    }

    const checkedCount = items.filter(i => i.checked).length;

    return (
        <section className="overlay" onClick={close}>
            <div className="modal neobrutal checklistModal" onClick={e => e.stopPropagation()}>
                <div className="checklistModal-title-row">
                    <span className="checklistModal-title">{title}</span>
                    <span className="checklistModal-progress">{checkedCount}/{items.length}</span>
                    <button className="checklistModal-rename copy" onClick={openRename} title="Rename">
                        <img src="images/Pen.svg" alt="Rename" className="copyImg" />
                    </button>
                </div>
                <div className="contentHolder checklistModal-body">
                    <ul className="checklistModal-items">
                        {items.map(item => (
                            <li key={item.id} className={`checklistModal-item${item.checked ? ' checklistModal-item--checked' : ''}`}>
                                <button className="checklistModal-cb" onClick={() => toggleItem(item.id)}>
                                    {item.checked ? '☑' : '☐'}
                                </button>
                                <span className="checklistModal-item-text">{item.text}</span>
                                <button className="checklistModal-del" onClick={() => deleteItem(item.id)}>
                                    <img src="images/Trash.svg" alt="Delete" />
                                </button>
                            </li>
                        ))}
                        {items.length === 0 && (
                            <li className="checklistModal-empty">No items yet.</li>
                        )}
                    </ul>
                    <input
                        ref={addInputRef}
                        className="checklistModal-add-input"
                        placeholder="+ Add item"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                        maxLength={200}
                    />
                </div>
                <section className="modalButtons">
                    <button className="modalButton cancel neobrutal-button" onClick={close}>Close</button>
                    <button className="modalButton continue neobrutal-button" onClick={addItem} disabled={!draft.trim()}>Add</button>
                </section>
            </div>
        </section>
    );
}

export default ChecklistModal;
