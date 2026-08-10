import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useIdeaContext } from "../../context/IdeaContext";
import { cleanLink } from "../../utilities";
import { ChecklistItem } from "../../utilities/types";
import AnimatedOverlay from "../AnimatedOverlay";

const ITEM_REMOVE_ANIM_MS = 300;
// Checklist title is a single-line input; note body mirrors the 2000-char cap
// enforced on already-created notes (IdeaNode.tsx's contentEditable body).
const CHECKLIST_TITLE_MAX_LENGTH = 100;
const NOTE_BODY_MAX_LENGTH = 2000;
// Fallback if the CSS transitionend backing finishAddItem() never fires
// (backgrounded tab, browser quirk) — keeps the add row from getting stuck
// mid-press forever. Comfortably longer than the 0.3s press transition.
const ITEM_PRESS_FALLBACK_MS = 500;

interface CreationModalProps {
    handleIdeaCreation: (content: string, parentId: number, link: string, priority?: 1 | 2 | 3) => void;
    handleChecklistCreation: (title: string, parentId: number, items: ChecklistItem[], priority?: 1 | 2 | 3) => void;
    handleNoteCreation: (title: string, parentId: number, body: string, priority?: 1 | 2 | 3) => void;
}

function CreationModal({ handleIdeaCreation, handleChecklistCreation, handleNoteCreation }: CreationModalProps) {
    const { rootId, creationModalOpen, setCreationModalOpen, modalContent, setModalContent, setNewIdeaSwitch } = useIdeaContext();

    const [activeTab, setActiveTab] = useState<'idea' | 'checklist' | 'note'>('idea');
    const [isLinkBoxShown, setisLinkBoxShown] = useState(false);
    const [isLinkClosing, setIsLinkClosing] = useState(false);
    const [link, setLink] = useState('');
    const [checklistTitle, setChecklistTitle] = useState('');
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [itemDraft, setItemDraft] = useState('');
    // True for the brief moment between Enter and the press-in transition
    // finishing on the input (see finishAddItem()).
    const [isPressingActive, setIsPressingActive] = useState(false);
    const [noteTitle, setNoteTitle] = useState('');
    const [noteBody, setNoteBody] = useState('');
    const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(undefined);
    const [removingItemIds, setRemovingItemIds] = useState<Set<string>>(new Set());
    const [panelHeight, setPanelHeight] = useState<number | undefined>(undefined);

    const itemInputRef = useRef<HTMLInputElement>(null);
    const ideaTextareaRef = useRef<HTMLTextAreaElement>(null);
    const ideaContentHolderRef = useRef<HTMLElement>(null);
    const linkAreaRef = useRef<HTMLDivElement>(null);
    const checklistTitleRef = useRef<HTMLInputElement>(null);
    const checklistSectionRef = useRef<HTMLElement>(null);
    const checklistItemsRef = useRef<HTMLUListElement>(null);
    const checklistAddRowRef = useRef<HTMLDivElement>(null);
    const noteTitleRef = useRef<HTMLInputElement>(null);
    const noteSectionRef = useRef<HTMLElement>(null);
    const noteContentHolderRef = useRef<HTMLElement>(null);
    const noteBodyRef = useRef<HTMLTextAreaElement>(null);
    const removeTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    // Guards finishAddItem() against double-firing (transitionend AND the
    // fallback timeout both landing) and against a stray Enter mid-press.
    const isPressingRef = useRef(false);
    const pressFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Full, untruncated text last typed into the idea or note fields (the two
    // uncapped/near-uncapped long-form tabs). Checklist title is capped at 100
    // chars and only ever holds a *view* of this — switching into checklist
    // truncates for display, but this ref keeps the original safe so switching
    // back to idea/note restores it instead of the cut version.
    const masterContentRef = useRef('');

    useEffect(() => {
        const timeouts = removeTimeoutsRef.current;
        return () => {
            timeouts.forEach(t => clearTimeout(t));
            timeouts.clear();
            if (pressFallbackTimeoutRef.current) clearTimeout(pressFallbackTimeoutRef.current);
        };
    }, []);

    // Panels are always mounted now (for crossfade), so autoFocus only fires on
    // first mount — focus the active tab's lead field explicitly on every switch.
    useEffect(() => {
        if (activeTab === 'idea') ideaTextareaRef.current?.focus();
        else if (activeTab === 'checklist') checklistTitleRef.current?.focus();
        else noteTitleRef.current?.focus();
    }, [activeTab]);

    // AnimatedOverlay mounts the modal's content on its own effect-driven timing
    // (a render pass after this component's own effects have already fired with
    // refs still null), so the [activeTab] effect above can't catch the initial
    // open — reset() always leaves activeTab as 'idea' before a reopen, so
    // focusing here on actual DOM mount covers the open case.
    const focusIdeaTextarea = useCallback((el: HTMLTextAreaElement | null) => {
        ideaTextareaRef.current = el;
        el?.focus();
    }, []);

    // scrollHeight on a flex:1-stretched element is max(contentHeight, clientHeight)
    // — once the stack has grown, that element's clientHeight is already inflated,
    // so its scrollHeight can never report smaller even after the content shrinks
    // back down. Un-stretch it first (flex: none + height: auto collapses it to its
    // true content size) so the reading reflects only what the content currently
    // needs, then restore the inline overrides — same trick autosizing textareas use.
    // Runs synchronously with no yield to paint in between, so nothing visibly flashes.
    function measureNatural(el: HTMLElement): number {
        const prevFlex = el.style.flex;
        const prevHeight = el.style.height;
        el.style.flex = 'none';
        el.style.height = 'auto';
        const natural = el.scrollHeight;
        el.style.flex = prevFlex;
        el.style.height = prevHeight;
        return natural;
    }

    // Grows the panel stack to fit the active tab's content instead of
    // clipping/scrolling it internally. Checklist sums the title, items list,
    // and add row's natural heights; Idea/Note sum their textarea's natural
    // height with their sibling controls. min-height in CSS floors it back
    // down to the shared default size once the content shrinks back below it.
    // useLayoutEffect (not useEffect) so the measureNatural overrides above
    // are applied and reverted before the browser paints.
    // Pulled out of the layout effect below so it can also be invoked from
    // panelStackMountRef — AnimatedOverlay mounts/unmounts this modal's DOM
    // via its own internal `show` state (a child re-render), which doesn't
    // re-trigger this component's effects, so relying solely on the state
    // deps below misses the actual mount and leaves panelHeight stuck at the
    // CSS fallback (too short for Idea's content, clipping contentHolder's
    // box-shadow against creation-panel's overflow:hidden).
    const recomputePanelHeight = useCallback(() => {
        if (activeTab === 'checklist') {
            const section = checklistSectionRef.current;
            const title = checklistTitleRef.current;
            const items = checklistItemsRef.current;
            const addRow = checklistAddRowRef.current;
            if (!section || !title || !items || !addRow) return;
            const gap = parseFloat(getComputedStyle(section).rowGap) || 0;
            setPanelHeight(title.offsetHeight + measureNatural(items) + addRow.offsetHeight + gap * 2);
        } else if (activeTab === 'idea') {
            const holder = ideaContentHolderRef.current;
            const textarea = ideaTextareaRef.current;
            const linkArea = linkAreaRef.current;
            if (!holder || !textarea || !linkArea) return;
            const holderStyle = getComputedStyle(holder);
            const borderY = parseFloat(holderStyle.borderTopWidth) + parseFloat(holderStyle.borderBottomWidth);
            setPanelHeight(borderY + measureNatural(textarea) + linkArea.offsetHeight);
        } else {
            const section = noteSectionRef.current;
            const title = noteTitleRef.current;
            const holder = noteContentHolderRef.current;
            const body = noteBodyRef.current;
            if (!section || !title || !holder || !body) return;
            const gap = parseFloat(getComputedStyle(section).rowGap) || 0;
            const holderStyle = getComputedStyle(holder);
            const borderY = parseFloat(holderStyle.borderTopWidth) + parseFloat(holderStyle.borderBottomWidth);
            setPanelHeight(title.offsetHeight + borderY + measureNatural(body) + gap);
        }
    }, [activeTab]);

    useLayoutEffect(() => {
        recomputePanelHeight();
        // Checklist rows animate their own height via a grid-template-rows
        // transition, so an immediate measurement can undershoot mid-animation —
        // re-measure once that transition actually settles.
        const items = checklistItemsRef.current;
        if (activeTab === 'checklist' && items) {
            items.addEventListener('transitionend', recomputePanelHeight);
            return () => items.removeEventListener('transitionend', recomputePanelHeight);
        }
    }, [recomputePanelHeight, checklistItems, removingItemIds, modalContent, isLinkBoxShown, link, noteTitle, noteBody]);

    // Fires when AnimatedOverlay actually mounts this modal's DOM (fresh
    // node every open, since it unmounts on close) — the one point where we
    // know the refs above just attached, regardless of whether this
    // component's own state changed to trigger the effect above.
    const panelStackMountRef = useCallback((el: HTMLDivElement | null) => {
        if (el) recomputePanelHeight();
    }, [recomputePanelHeight]);

    function toggleLinkBox() {
        if (isLinkBoxShown) {
            setIsLinkClosing(true);
            setTimeout(() => {
                setisLinkBoxShown(false);
                setIsLinkClosing(false);
            }, 200);
        } else {
            setisLinkBoxShown(true);
        }
    }

    function reset() {
        setActiveTab('idea');
        setisLinkBoxShown(false);
        setIsLinkClosing(false);
        setLink('');
        setModalContent('');
        setChecklistTitle('');
        setChecklistItems([]);
        setItemDraft('');
        setIsPressingActive(false);
        isPressingRef.current = false;
        if (pressFallbackTimeoutRef.current) clearTimeout(pressFallbackTimeoutRef.current);
        setNoteTitle('');
        setNoteBody('');
        setPriority(undefined);
        masterContentRef.current = '';
        removeTimeoutsRef.current.forEach(t => clearTimeout(t));
        removeTimeoutsRef.current.clear();
        setRemovingItemIds(new Set());
    }

    function handleClose() {
        setCreationModalOpen(false);
        reset();
    }

    function handleCreateIdea() {
        handleIdeaCreation(modalContent, rootId, cleanLink(link), priority);
        setCreationModalOpen(false);
        setNewIdeaSwitch(prev => !prev);
        reset();
    }

    function handleCreateChecklist() {
        if (!checklistTitle.trim()) return;
        handleChecklistCreation(checklistTitle.trim(), rootId, checklistItems, priority);
        setCreationModalOpen(false);
        setNewIdeaSwitch(prev => !prev);
        reset();
    }

    function handleCreateNote() {
        if (!noteTitle.trim()) return;
        handleNoteCreation(noteTitle.trim(), rootId, noteBody, priority);
        setCreationModalOpen(false);
        setNewIdeaSwitch(prev => !prev);
        reset();
    }

    // Enter only starts the press-in feedback on the input (same "click" look
    // as a neobrutal box on hover: shadow off, translate 3px/3px) — the
    // actual commit happens once that finishes, in finishAddItem().
    function addItem() {
        if (isPressingRef.current) return;
        const text = itemDraft.trim();
        if (!text) return;
        isPressingRef.current = true;
        setIsPressingActive(true);
        if (pressFallbackTimeoutRef.current) clearTimeout(pressFallbackTimeoutRef.current);
        pressFallbackTimeoutRef.current = setTimeout(finishAddItem, ITEM_PRESS_FALLBACK_MS);
    }

    // Commits the pressed input's text as a real item (landing in the exact
    // spot the pressed input just occupied, same border/shadow/translate —
    // no visible jump) and clears the input for the next entry. Fires once,
    // from whichever comes first: the press transition finishing or the
    // fallback timeout.
    function finishAddItem() {
        if (!isPressingRef.current) return;
        isPressingRef.current = false;
        if (pressFallbackTimeoutRef.current) clearTimeout(pressFallbackTimeoutRef.current);
        setIsPressingActive(false);
        const text = itemDraft.trim();
        if (!text) return;
        const id = String(Date.now());
        setChecklistItems(prev => [...prev, { id, text, checked: false }]);
        setItemDraft('');
        itemInputRef.current?.focus();
    }

    function handlePressTransitionEnd(e: React.TransitionEvent<HTMLInputElement>) {
        if (e.propertyName !== 'box-shadow') return;
        finishAddItem();
    }

    function removeItem(itemId: string) {
        setRemovingItemIds(prev => new Set(prev).add(itemId));
        const timeout = setTimeout(() => {
            setChecklistItems(prev => prev.filter(i => i.id !== itemId));
            setRemovingItemIds(prev => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
            });
            removeTimeoutsRef.current.delete(itemId);
        }, ITEM_REMOVE_ANIM_MS);
        removeTimeoutsRef.current.set(itemId, timeout);
    }

    function handleItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
        }
    }

    function getTabContent(tab: 'idea' | 'checklist' | 'note'): string {
        if (tab === 'idea') return modalContent;
        if (tab === 'checklist') return checklistTitle;
        return noteBody;
    }

    // Idea content, checklist title, and note body all back the same underlying
    // `content` field (see StandardIdea/ChecklistIdea in types.ts) — just shown
    // through a different control per tab. Idea/note are long-form and share
    // masterContentRef (kept live by their own onChange handlers), so switching
    // between them — or into checklist and back — always restores the full
    // text. Checklist's title is capped at 100 chars and is purely a truncated
    // view of the master; it never feeds back into it. If the master is empty
    // (user only ever typed in checklist), the short checklist text is carried
    // over instead, same as before.
    function switchTab(tab: 'idea' | 'checklist' | 'note') {
        if (tab !== activeTab) {
            const source = masterContentRef.current || getTabContent(activeTab);
            if (tab === 'checklist') setChecklistTitle(source.slice(0, CHECKLIST_TITLE_MAX_LENGTH));
            else if (tab === 'note') setNoteBody(source.slice(0, NOTE_BODY_MAX_LENGTH));
            else setModalContent(source);
        }
        setActiveTab(tab);
    }

    return (
        <AnimatedOverlay open={creationModalOpen} scrollable>
            <div className="modal neobrutal creationModal">
                        <div className="creation-tabs">
                            <button
                                className={`creation-tab creation-tab--idea${activeTab === 'idea' ? ' creation-tab--active' : ''}`}
                                onClick={() => switchTab('idea')}
                            >
                                Idea
                            </button>
                            <button
                                className={`creation-tab creation-tab--checklist${activeTab === 'checklist' ? ' creation-tab--active' : ''}`}
                                onClick={() => switchTab('checklist')}
                            >
                                Checklist
                            </button>
                            <button
                                className={`creation-tab creation-tab--note${activeTab === 'note' ? ' creation-tab--active' : ''}`}
                                onClick={() => switchTab('note')}
                            >
                                Note
                            </button>
                        </div>

                        <div
                            className="creation-panel-stack"
                            ref={panelStackMountRef}
                            style={panelHeight !== undefined ? { height: panelHeight } : undefined}
                        >
                            <div className={`creation-panel${activeTab === 'idea' ? ' creation-panel--active' : ''}`}>
                                <section className="contentHolder" ref={ideaContentHolderRef}>
                                    <textarea ref={focusIdeaTextarea} className="ideaContent" placeholder='Whats your idea?' value={modalContent} onChange={(e) => { setModalContent(e.target.value); masterContentRef.current = e.target.value; }}></textarea>
                                    <div className="linkArea" ref={linkAreaRef}>
                                        <button className="linkButton neobrutal-button" onClick={toggleLinkBox}>
                                            Add Link
                                        </button>
                                        {isLinkBoxShown && (
                                            <input type="text" className={`linkInput neobrutal-input${isLinkClosing ? ' closing' : ''}`} placeholder='Add a link...' onClick={(e) => e.stopPropagation()} onChange={(e) => setLink(e.target.value)} value={link} />
                                        )}
                                    </div>
                                </section>
                            </div>

                            <div className={`creation-panel${activeTab === 'checklist' ? ' creation-panel--active' : ''}`}>
                                <section className="checklist-creation" ref={checklistSectionRef}>
                                    <input
                                        ref={checklistTitleRef}
                                        className="checklist-creation-title neobrutal-input"
                                        placeholder="Checklist title"
                                        maxLength={CHECKLIST_TITLE_MAX_LENGTH}
                                        value={checklistTitle}
                                        onChange={e => setChecklistTitle(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && itemInputRef.current?.focus()}
                                    />
                                    <ul className="checklist-creation-items" ref={checklistItemsRef}>
                                        {checklistItems.map(item => (
                                            <li
                                                key={item.id}
                                                className={`checklist-creation-item-wrap${removingItemIds.has(item.id) ? ' checklist-creation-item-wrap--collapsed' : ''}`}
                                            >
                                                <div className="checklist-creation-item">
                                                    <span>☐ {item.text}</span>
                                                    <button className="checklist-creation-remove" onClick={() => removeItem(item.id)}>✕</button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="checklist-creation-add" ref={checklistAddRowRef}>
                                        <input
                                            ref={itemInputRef}
                                            className={`checklist-creation-item-input neobrutal-input${isPressingActive ? ' checklist-creation-item-input--pressing' : ''}`}
                                            placeholder="Add an item (Enter to add)"
                                            value={itemDraft}
                                            onChange={e => setItemDraft(e.target.value)}
                                            onKeyDown={handleItemKeyDown}
                                            onTransitionEnd={handlePressTransitionEnd}
                                            maxLength={200}
                                        />
                                    </div>
                                </section>
                            </div>

                            <div className={`creation-panel${activeTab === 'note' ? ' creation-panel--active' : ''}`}>
                                <section className="note-creation" ref={noteSectionRef}>
                                    <input
                                        ref={noteTitleRef}
                                        className="note-creation-title neobrutal-input"
                                        placeholder="Note title"
                                        maxLength={100}
                                        value={noteTitle}
                                        onChange={e => setNoteTitle(e.target.value)}
                                    />
                                    <section className="contentHolder" ref={noteContentHolderRef}>
                                        <textarea ref={noteBodyRef} className="ideaContent note-body" placeholder="Write your note..." value={noteBody} onChange={(e) => { setNoteBody(e.target.value); masterContentRef.current = e.target.value; }} maxLength={NOTE_BODY_MAX_LENGTH}></textarea>
                                    </section>
                                </section>
                            </div>
                        </div>

                        <div className="priority-picker">
                            <span className="priority-picker-label">Priority</span>
                            <div className="priority-picker-btns">
                                {([1, 2, 3] as const).map(p => (
                                    <button
                                        key={p}
                                        className={`priority-picker-btn neobrutal-button${priority === p ? ' priority-picker-btn--active' : ''}`}
                                        onClick={() => setPriority(prev => prev === p ? undefined : p)}
                                        type="button"
                                    >
                                        P{p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <section className="modalButtons">
                            <button className="modalButton cancel neobrutal-button" onClick={handleClose}>Cancel</button>
                            {activeTab === 'idea' && (
                                <button className="modalButton continue neobrutal-button" onClick={handleCreateIdea}>Create</button>
                            )}
                            {activeTab === 'checklist' && (
                                <button
                                    className="modalButton continue neobrutal-button"
                                    onClick={handleCreateChecklist}
                                    disabled={!checklistTitle.trim()}
                                >
                                    Create
                                </button>
                            )}
                            {activeTab === 'note' && (
                                <button
                                    className="modalButton continue neobrutal-button"
                                    onClick={handleCreateNote}
                                    disabled={!noteTitle.trim()}
                                >
                                    Create
                                </button>
                            )}
                        </section>
                    </div>
        </AnimatedOverlay>
    );
}

export default CreationModal;
