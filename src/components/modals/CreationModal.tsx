import { useRef, useState } from "react";
import { useIdeaContext } from "../../context/IdeaContext";
import { cleanLink } from "../../utilities";
import { ChecklistItem } from "../../utilities/types";

interface CreationModalProps {
    handleIdeaCreation: (content: string, parentId: number, link: string) => void;
    handleChecklistCreation: (title: string, parentId: number, items: ChecklistItem[]) => void;
}

function CreationModal({ handleIdeaCreation, handleChecklistCreation }: CreationModalProps) {
    const { rootId, creationModalOpen, setCreationModalOpen, modalContent, setModalContent, setNewIdeaSwitch } = useIdeaContext();

    const [activeTab, setActiveTab] = useState<'idea' | 'checklist'>('idea');
    const [isLinkBoxShown, setisLinkBoxShown] = useState(false);
    const [link, setLink] = useState('');
    const [checklistTitle, setChecklistTitle] = useState('');
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [itemDraft, setItemDraft] = useState('');

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const itemInputRef = useRef<HTMLInputElement>(null);

    function autoResize() {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    function reset() {
        setActiveTab('idea');
        setisLinkBoxShown(false);
        setLink('');
        setChecklistTitle('');
        setChecklistItems([]);
        setItemDraft('');
    }

    function handleClose() {
        setCreationModalOpen(false);
        reset();
    }

    function handleCreateIdea() {
        handleIdeaCreation(modalContent, rootId, cleanLink(link));
        setCreationModalOpen(false);
        setisLinkBoxShown(false);
        setLink('');
        setNewIdeaSwitch(prev => !prev);
    }

    function handleCreateChecklist() {
        if (!checklistTitle.trim()) return;
        handleChecklistCreation(checklistTitle.trim(), rootId, checklistItems);
        setCreationModalOpen(false);
        setNewIdeaSwitch(prev => !prev);
        reset();
    }

    function addItem() {
        const text = itemDraft.trim();
        if (!text) return;
        setChecklistItems(prev => [...prev, { id: String(Date.now()), text, checked: false }]);
        setItemDraft('');
        itemInputRef.current?.focus();
    }

    function removeItem(itemId: string) {
        setChecklistItems(prev => prev.filter(i => i.id !== itemId));
    }

    function handleItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
        }
    }

    return (
        <>
            {creationModalOpen &&
                <section className="overlay">
                    <div className="modal neobrutal">
                        <div className="creation-tabs">
                            <button
                                className={`creation-tab${activeTab === 'idea' ? ' creation-tab--active' : ''}`}
                                onClick={() => setActiveTab('idea')}
                            >
                                Idea
                            </button>
                            <button
                                className={`creation-tab${activeTab === 'checklist' ? ' creation-tab--active' : ''}`}
                                onClick={() => setActiveTab('checklist')}
                            >
                                Checklist
                            </button>
                        </div>

                        {activeTab === 'idea' && (
                            <section className="contentHolder">
                                <textarea ref={textareaRef} autoFocus={true} maxLength={200} className="ideaContent" placeholder='Whats your idea?' onChange={(e) => { setModalContent(e.target.value); autoResize(); }}></textarea>
                                <button className="linkButton" onClick={() => setisLinkBoxShown(prev => !prev)}>
                                    <img src="/images/Link.svg" alt="Add Link" />
                                    <input type="text" className={`linkInput neobrutal-input ${isLinkBoxShown && 'show'}`} placeholder='Add a link' onClick={(e) => e.stopPropagation()} onChange={(e) => setLink(e.target.value)} />
                                </button>
                            </section>
                        )}

                        {activeTab === 'checklist' && (
                            <section className="checklist-creation">
                                <input
                                    autoFocus={activeTab === 'checklist'}
                                    className="checklist-creation-title neobrutal-input"
                                    placeholder="Checklist title"
                                    maxLength={100}
                                    value={checklistTitle}
                                    onChange={e => setChecklistTitle(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && itemInputRef.current?.focus()}
                                />
                                <ul className="checklist-creation-items">
                                    {checklistItems.map(item => (
                                        <li key={item.id} className="checklist-creation-item">
                                            <span>☐ {item.text}</span>
                                            <button className="checklist-creation-remove" onClick={() => removeItem(item.id)}>✕</button>
                                        </li>
                                    ))}
                                </ul>
                                <div className="checklist-creation-add">
                                    <input
                                        ref={itemInputRef}
                                        className="checklist-creation-item-input neobrutal-input"
                                        placeholder="Add an item (Enter to add)"
                                        value={itemDraft}
                                        onChange={e => setItemDraft(e.target.value)}
                                        onKeyDown={handleItemKeyDown}
                                        maxLength={200}
                                    />
                                </div>
                            </section>
                        )}

                        <section className="modalButtons">
                            <button className="modalButton cancel neobrutal-button" onClick={handleClose}>Cancel</button>
                            {activeTab === 'idea' ? (
                                <button className="modalButton continue neobrutal-button" onClick={handleCreateIdea}>Create</button>
                            ) : (
                                <button
                                    className="modalButton continue neobrutal-button"
                                    onClick={handleCreateChecklist}
                                    disabled={!checklistTitle.trim()}
                                >
                                    Create
                                </button>
                            )}
                        </section>
                    </div>
                </section>
            }
        </>
    );
}

export default CreationModal;
