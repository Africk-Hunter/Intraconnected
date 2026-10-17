import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useIdeaContext } from "../../context/IdeaContext";
import { cleanLink } from "../../utilities";
import { ChecklistItem } from "../../utilities/types";
import AnimatedOverlay from "../AnimatedOverlay";
import VaultCreateCard, { type VaultCardFooter } from "../vault/VaultCreateCard";
import type { VaultDraft } from "../vault/VaultSecretFields";
import { useVaultState } from "../../utilities/vault/useVaultState";
import { useOpenVaultSettings } from "../vault/vaultUi";

type Tab = 'idea' | 'checklist' | 'note' | 'vault';
const EMPTY_VAULT: VaultDraft = { label: '', secret: '', link: '' };
// The locked Vault tab's passphrase form; the modal's Unlock button submits it.
const VAULT_UNLOCK_FORM_ID = 'creation-vault-unlock';

const ITEM_REMOVE_ANIM_MS = 300;
// Checklist title is a single-line input; note body mirrors the 20000-char cap
// enforced on already-created notes (IdeaNode.tsx's contentEditable body).
const CHECKLIST_TITLE_MAX_LENGTH = 100;
const NOTE_BODY_MAX_LENGTH = 20000;
// How long the add input stays visually "pressed" after Enter.
const ITEM_PRESS_MS = 120;

interface CreationModalProps {
    handleIdeaCreation: (content: string, parentId: number, link: string, priority?: 1 | 2 | 3) => void;
    handleChecklistCreation: (title: string, parentId: number, items: ChecklistItem[], priority?: 1 | 2 | 3) => void;
    handleNoteCreation: (title: string, parentId: number, body: string, priority?: 1 | 2 | 3) => void;
    handleVaultCreation: (label: string, parentId: number, secret: string, link: string, priority?: 1 | 2 | 3) => Promise<boolean>;
}

function CreationModal({ handleIdeaCreation, handleChecklistCreation, handleNoteCreation, handleVaultCreation }: CreationModalProps) {
    const { rootId, creationModalOpen, setCreationModalOpen, modalContent, setModalContent, setNewIdeaSwitch } = useIdeaContext();

    const [activeTab, setActiveTab] = useState<Tab>('idea');
    const [isLinkBoxShown, setisLinkBoxShown] = useState(false);
    const [isLinkClosing, setIsLinkClosing] = useState(false);
    const [link, setLink] = useState('');
    const [checklistTitle, setChecklistTitle] = useState('');
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [itemDraft, setItemDraft] = useState('');
    // True for a blink after Enter, so the add input looks pressed.
    const [isPressingActive, setIsPressingActive] = useState(false);
    const [noteTitle, setNoteTitle] = useState('');
    const [noteBody, setNoteBody] = useState('');
    const [priority, setPriority] = useState<1 | 2 | 3 | undefined>(undefined);
    // The vault tab's text is kept apart from the other tabs on purpose: a secret must never carry over into an ordinary idea.
    const [vaultDraft, setVaultDraft] = useState<VaultDraft>(EMPTY_VAULT);
    const [vaultCreating, setVaultCreating] = useState(false);
    // Reported by the Vault tab: whether the main button creates, unlocks or sets up.
    const [vaultFooter, setVaultFooter] = useState<VaultCardFooter>({ action: 'wait', canSubmit: false, busy: false });
    const { unlocked: vaultUnlocked } = useVaultState();
    const openVaultSettings = useOpenVaultSettings('desktop');
    const { profileModalOpen, createReturn, setCreateReturn } = useIdeaContext();

    // Profile → Vault was opened from this modal: come back to the Vault tab once Profile closes.
    useEffect(() => {
        if (createReturn !== 'desktop' || profileModalOpen) return;
        setCreateReturn(null);
        setActiveTab('vault');
        setCreationModalOpen(true);
    }, [createReturn, profileModalOpen, setCreateReturn, setCreationModalOpen]);
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
    const vaultSectionRef = useRef<HTMLDivElement>(null);
    const tabsRef = useRef<HTMLDivElement>(null);
    const createBtnRef =useRef<HTMLButtonElement>(null);
    const cancelBtnRef = useRef<HTMLButtonElement>(null);
    const removeTimeoutsRef =useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
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
        else if (activeTab === 'note') noteTitleRef.current?.focus();
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
        } else if (activeTab === 'vault') {
            const section = vaultSectionRef.current;
            if (!section) return;
            setPanelHeight(Math.max(measureNatural(section), 0));
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
            // New rows grow in via a keyframe animation (animationend), removed
            // rows collapse via a transition (transitionend) — both change height.
            items.addEventListener('transitionend', recomputePanelHeight);
            items.addEventListener('animationend', recomputePanelHeight);
            return () => {
                items.removeEventListener('transitionend', recomputePanelHeight);
                items.removeEventListener('animationend', recomputePanelHeight);
            };
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only when the listed deps change, by design
    }, [recomputePanelHeight, checklistItems, removingItemIds, modalContent, isLinkBoxShown, link, noteTitle, noteBody, vaultUnlocked, vaultDraft]);

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
        if (pressFallbackTimeoutRef.current) clearTimeout(pressFallbackTimeoutRef.current);
        setNoteTitle('');
        setNoteBody('');
        setPriority(undefined);
        setVaultDraft(EMPTY_VAULT);
        setVaultCreating(false);
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
        if (!modalContent.trim()) return;
        handleIdeaCreation(modalContent, rootId, cleanLink(link), priority);
        setCreationModalOpen(false);
        setNewIdeaSwitch(prev => !prev);
        reset();
    }

    function handleCreateChecklist() {
        if (!checklistTitle.trim()) return;
        // Text still sitting in the add field counts as one more item.
        const pending = itemDraft.trim();
        const items = pending
            ? [...checklistItems, { id: `${Date.now()}-${checklistItems.length}`, text: pending, checked: false }]
            : checklistItems;
        handleChecklistCreation(checklistTitle.trim(), rootId, items, priority);
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

    async function handleCreateVault() {
        if (!vaultDraft.label.trim() || !vaultDraft.secret.trim() || !vaultUnlocked || vaultCreating) return;
        setVaultCreating(true);
        try {
            const created = await handleVaultCreation(vaultDraft.label.trim(), rootId, vaultDraft.secret, vaultDraft.link, priority);
            if (!created) { setVaultCreating(false); return; }
            setCreationModalOpen(false);
            setNewIdeaSwitch(prev => !prev);
            reset();
        } catch {
            setVaultCreating(false);
        }
    }

    // "Set up vault" / "Forgot passphrase?": leave this modal, open Profile → Vault.
    function openVaultSettingsFromCreate() {
        handleClose();
        openVaultSettings();
    }

    function addItem() {
        const text = itemDraft.trim();
        if (!text) return;
        // Commit right away — waiting on the press animation made adding feel laggy.
        const id = `${Date.now()}-${checklistItems.length}`;
        setChecklistItems(prev => [...prev, { id, text, checked: false }]);
        setItemDraft('');
        // Brief cosmetic press on the input; never gates the add.
        setIsPressingActive(true);
        if (pressFallbackTimeoutRef.current) clearTimeout(pressFallbackTimeoutRef.current);
        pressFallbackTimeoutRef.current = setTimeout(() => setIsPressingActive(false), ITEM_PRESS_MS);
    }

    function editItem(itemId: string, text: string) {
        setChecklistItems(prev => prev.map(i => i.id === itemId ? { ...i, text } : i));
    }

    // An item left blank after editing is dropped, same as removing it.
    function commitItemEdit(itemId: string) {
        const item = checklistItems.find(i => i.id === itemId);
        if (!item) return;
        if (!item.text.trim()) removeItem(itemId);
        else if (item.text !== item.text.trim()) editItem(itemId, item.text.trim());
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

    // Ctrl/Cmd+Enter creates from the long-form fields, where plain Enter is a line break.
    function handleCreateShortcut(e: React.KeyboardEvent, create: () => void) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            create();
        }
    }

    function handleItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
        }
    }

    // Tab walks a short ring instead of the DOM order: the fields still open
    // (required ones that are empty) -> Create -> Cancel -> back round. With
    // nothing open it starts at the tab's main field. Tabs, Add Link, priority and
    // item rows are skipped; Alt+1-4 / Alt+L / Alt+P reach them from the keyboard.
    // The vault tab keeps the default order (its fields live in VaultCreateCard).
    function tabRing(): (HTMLElement | null)[] {
        const createEnabled =
            activeTab === 'idea' ? !!modalContent.trim()
            : activeTab === 'checklist' ? !!checklistTitle.trim()
            : !!noteTitle.trim();
        let fields: (HTMLElement | null)[];
        if (activeTab === 'idea') {
            fields = [ideaTextareaRef.current];
        } else if (activeTab === 'checklist') {
            const open: (HTMLElement | null)[] = [];
            if (!checklistTitle.trim()) open.push(checklistTitleRef.current);
            if (checklistItems.length === 0 && !itemDraft.trim()) open.push(itemInputRef.current);
            fields = open.length ? open : [itemInputRef.current];
        } else {
            const open: (HTMLElement | null)[] = [];
            if (!noteTitle.trim()) open.push(noteTitleRef.current);
            if (!noteBody.trim()) open.push(noteBodyRef.current);
            fields = open.length ? open : [noteBodyRef.current];
        }
        // Nothing typed anywhere yet: walk the four tabs before leaving the form.
        const pristine =
            activeTab === 'idea' ? !modalContent.trim() && !link.trim()
            : activeTab === 'checklist' ? !checklistTitle.trim() && !itemDraft.trim() && checklistItems.length === 0
            : !noteTitle.trim() && !noteBody.trim();
        const tabButtons = pristine ? Array.from(tabsRef.current?.querySelectorAll<HTMLElement>('.creation-tab') ?? []) : [];
        return [...fields, ...tabButtons, ...(createEnabled ? [createBtnRef.current] : []), cancelBtnRef.current].filter(Boolean);
    }

    function handleModalKeyDown(e: React.KeyboardEvent) {
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
            const tabs: Tab[] = ['idea', 'checklist', 'note', 'vault'];
            const n = Number(e.key);
            if (n >= 1 && n <= 4) {
                e.preventDefault();
                switchTab(tabs[n - 1]);
            } else if (e.key.toLowerCase() === 'l' && activeTab === 'idea') {
                e.preventDefault();
                toggleLinkBox();
            } else if (e.key.toLowerCase() === 'p') {
                e.preventDefault();
                setPriority(prev => (prev === undefined ? 1 : prev === 3 ? undefined : (prev + 1) as 2 | 3));
            }
            return;
        }
        if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey || activeTab === 'vault') return;
        const ring = tabRing();
        if (ring.length === 0) return;
        const at = ring.indexOf(document.activeElement as HTMLElement);
        let next: number;
        if (at === -1) next = e.shiftKey ? ring.length - 1 : 0;
        else next = (at + (e.shiftKey ? -1 : 1) + ring.length) % ring.length;
        e.preventDefault();
        // The modal's focus trap also listens for Tab on document; it would re-wrap
        // from the last button, so this one must not reach it.
        e.stopPropagation();
        ring[next]!.focus();
    }

    function getTabContent(tab: Tab): string {
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
    function switchTab(tab: Tab) {
        if (tab !== activeTab && tab !== 'vault' && activeTab !== 'vault') {
            const source = masterContentRef.current || getTabContent(activeTab);
            if (tab === 'checklist') setChecklistTitle(source.slice(0, CHECKLIST_TITLE_MAX_LENGTH));
            else if (tab === 'note') setNoteBody(source.slice(0, NOTE_BODY_MAX_LENGTH));
            else setModalContent(source);
        }
        setActiveTab(tab);
    }

    return (
        <AnimatedOverlay open={creationModalOpen} scrollable onEscape={handleClose}>
            <div className="modal neobrutal creationModal" onKeyDown={handleModalKeyDown}>
                        <div className="creation-tabs" ref={tabsRef}>
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
                            <button
                                className={`creation-tab creation-tab--vault${activeTab === 'vault' ? ' creation-tab--active' : ''}`}
                                onClick={() => switchTab('vault')}
                            >
                                Vault
                            </button>
                        </div>

                        <div
                            className="creation-panel-stack"
                            ref={panelStackMountRef}
                            style={panelHeight !== undefined ? { height: panelHeight } : undefined}
                        >
                            <div className={`creation-panel${activeTab === 'idea' ? ' creation-panel--active' : ''}`}>
                                <section className="contentHolder" ref={ideaContentHolderRef}>
                                    <textarea ref={focusIdeaTextarea} className="ideaContent" placeholder='Whats your idea?' onKeyDown={(e) => handleCreateShortcut(e, handleCreateIdea)} value={modalContent} onChange={(e) => { setModalContent(e.target.value); masterContentRef.current = e.target.value; }}></textarea>
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
                                        onChange={e => {
                                            const next = e.target.value;
                                            const master = masterContentRef.current;
                                            // Keep the shared text in step with title edits; if the title
                                            // was a truncated view of the master, keep the cut-off tail.
                                            masterContentRef.current = next && master.startsWith(checklistTitle)
                                                ? next + master.slice(checklistTitle.length)
                                                : next;
                                            setChecklistTitle(next);
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && itemInputRef.current?.focus()}
                                    />
                                    <ul className="checklist-creation-items" ref={checklistItemsRef}>
                                        {checklistItems.map(item => (
                                            <li
                                                key={item.id}
                                                className={`checklist-creation-item-wrap${removingItemIds.has(item.id) ? ' checklist-creation-item-wrap--collapsed' : ''}`}
                                            >
                                                <div className="checklist-creation-item">
                                                    <span className="checklist-creation-box" aria-hidden="true" />
                                                    <input
                                                        className="checklist-creation-text"
                                                        aria-label="Edit item"
                                                        value={item.text}
                                                        maxLength={200}
                                                        onChange={e => editItem(item.id, e.target.value)}
                                                        onBlur={() => commitItemEdit(item.id)}
                                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); itemInputRef.current?.focus(); } }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="checklist-creation-remove"
                                                        aria-label={`Remove ${item.text}`}
                                                        onClick={() => removeItem(item.id)}
                                                    >
                                                        ✕
                                                    </button>
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
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); noteBodyRef.current?.focus(); } }}
                                    />
                                    <section className="contentHolder" ref={noteContentHolderRef}>
                                        <textarea ref={noteBodyRef} className="ideaContent note-body" placeholder="Write your note..." onKeyDown={(e) => handleCreateShortcut(e, handleCreateNote)} value={noteBody} onChange={(e) => { setNoteBody(e.target.value); masterContentRef.current = e.target.value; }} maxLength={NOTE_BODY_MAX_LENGTH}></textarea>
                                    </section>
                                </section>
                            </div>

                            <div className={`creation-panel${activeTab === 'vault' ? ' creation-panel--active' : ''}`}>
                                <div ref={vaultSectionRef} className="vault-creation">
                                    <VaultCreateCard
                                        draft={vaultDraft}
                                        onChange={setVaultDraft}
                                        active={creationModalOpen && activeTab === 'vault'}
                                        formId={VAULT_UNLOCK_FORM_ID}
                                        onSubmit={handleCreateVault}
                                        onOpenSettings={openVaultSettingsFromCreate}
                                        onFooter={setVaultFooter}
                                    />
                                </div>
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
                            <button ref={cancelBtnRef} className="modalButton cancel neobrutal-button" onClick={handleClose}>Cancel</button>
                            {activeTab === 'idea' && (
                                <button
                                    ref={createBtnRef}
                                    className="modalButton continue neobrutal-button"
                                    onClick={handleCreateIdea}
                                    disabled={!modalContent.trim()}
                                >
                                    Create
                                </button>
                            )}
                            {activeTab === 'checklist' && (
                                <button
                                    ref={createBtnRef}
                                    className="modalButton continue neobrutal-button"
                                    onClick={handleCreateChecklist}
                                    disabled={!checklistTitle.trim()}
                                >
                                    Create
                                </button>
                            )}
                            {activeTab === 'note' && (
                                <button
                                    ref={createBtnRef}
                                    className="modalButton continue neobrutal-button"
                                    onClick={handleCreateNote}
                                    disabled={!noteTitle.trim()}
                                >
                                    Create
                                </button>
                            )}
                            {activeTab === 'vault' && vaultFooter.action === 'unlock' && (
                                <button
                                    type="submit"
                                    form={VAULT_UNLOCK_FORM_ID}
                                    className="modalButton continue neobrutal-button"
                                    disabled={!vaultFooter.canSubmit || vaultFooter.busy}
                                >
                                    {vaultFooter.busy ? 'Unlocking…' : 'Unlock'}
                                </button>
                            )}
                            {activeTab === 'vault' && vaultFooter.action === 'setup' && (
                                <button className="modalButton continue neobrutal-button" onClick={openVaultSettingsFromCreate}>
                                    Set up vault
                                </button>
                            )}
                            {activeTab === 'vault' && (vaultFooter.action === 'create' || vaultFooter.action === 'wait') && (
                                <button
                                    className="modalButton continue neobrutal-button"
                                    onClick={handleCreateVault}
                                    disabled={!vaultDraft.label.trim() || !vaultDraft.secret.trim() || !vaultUnlocked || vaultCreating}
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
