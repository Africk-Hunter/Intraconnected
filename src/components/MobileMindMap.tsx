import { useRef, useState } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import {
    IdeaType,
    ChecklistItem,
    fetchFullIdeaList,
    appendToLocalStorageFromFrontend,
    addIdeaToFirebase,
    updateIdeaName,
    updateIdeaNameInFirebase,
    updateIdeaLink,
    updateIdeaLinkInFirebase,
    updateIdeaParentId,
    updateChecklistItems,
    recursivelyDeleteChildren,
    cleanLink,
    signUserOut,
    getIdeaLink,
} from '../utilities';
import MobileHelpSheet from './MobileHelpSheet';
import MobileMoveSheet from './MobileMoveSheet';
import MobileNavigateSheet from './MobileNavigateSheet';
import MobilePatchNotesSheet from './MobilePatchNotesSheet';

type SheetState =
    | { type: 'actions'; nodeId: number }
    | { type: 'rename'; nodeId: number; isNew?: boolean }
    | { type: 'move'; nodeId: number }
    | { type: 'link'; nodeId: number }
    | { type: 'confirmDelete'; nodeId: number }
    | { type: 'navigate' }
    | { type: 'checklist'; nodeId: number };

function MobileMindMap() {
    const { setNewIdeaSwitch } = useIdeaContext();

    const [currentId, setCurrentId] = useState(1);
    const [sheet, setSheet] = useState<SheetState | null>(null);
    const [draft, setDraft] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showPatchNotes, setShowPatchNotes] = useState(false);
    const [expandedChecklists, setExpandedChecklists] = useState<Set<number>>(new Set());
    const [inlineDrafts, setInlineDrafts] = useState<Record<number, string>>({});
    const [sheetItems, setSheetItems] = useState<ChecklistItem[]>([]);
    const [sheetItemDraft, setSheetItemDraft] = useState('');

    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressActive = useRef(false);
    const touchMoved = useRef(false);
    const lastLongPressTime = useRef(0);

    const allIdeas: IdeaType[] = fetchFullIdeaList();
    const currentIdea = allIdeas.find(i => i.id === currentId);
    const children = allIdeas.filter(i => i.parentID === currentId);

    function getBreadcrumbs(): IdeaType[] {
        const path: IdeaType[] = [];
        let id = currentId;
        const visited = new Set<number>();
        while (id && !visited.has(id)) {
            visited.add(id);
            const idea = allIdeas.find(i => i.id === id);
            if (!idea) break;
            path.unshift(idea);
            if (!idea.parentID) break;
            id = idea.parentID;
        }
        return path;
    }

    const breadcrumbs = getBreadcrumbs();
    const canGoBack = !!(currentIdea?.parentID);

    function closeSheet() {
        setSheet(null);
        setEditMode(false);
    }

    function startPress(nodeId: number) {
        longPressActive.current = false;
        touchMoved.current = false;
        if (pressTimer.current) clearTimeout(pressTimer.current);
        pressTimer.current = setTimeout(() => {
            longPressActive.current = true;
            lastLongPressTime.current = Date.now();
            setSheet({ type: 'actions', nodeId });
            setEditMode(false);
            const blockGhostClick = (e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
                document.removeEventListener('click', blockGhostClick, true);
            };
            document.addEventListener('click', blockGhostClick, true);
        }, 360);
    }

    function endPress() {
        if (pressTimer.current) clearTimeout(pressTimer.current);
    }

    function handleTouchMove() {
        touchMoved.current = true;
        endPress();
    }

    function tapNode(nodeId: number) {
        endPress();
        if (longPressActive.current) {
            longPressActive.current = false;
            return;
        }
        if (Date.now() - lastLongPressTime.current < 400) return;
        if (editMode) {
            setSheet({ type: 'actions', nodeId });
            return;
        }
        const node = allIdeas.find(i => i.id === nodeId);
        if (node?.type === 'checklist') {
            setExpandedChecklists(prev => {
                const next = new Set(prev);
                if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
                return next;
            });
            return;
        }
        const nodeLink = getIdeaLink(node);
        if (nodeLink) {
            window.open(nodeLink, '_blank', 'noopener,noreferrer');
            return;
        }
        setCurrentId(nodeId);
        setSheet(null);
    }

    function openChecklistSheet(nodeId: number) {
        const fresh = fetchFullIdeaList().find(i => i.id === nodeId);
        setSheetItems(fresh?.type === 'checklist' ? fresh.items : []);
        setSheetItemDraft('');
        setSheet({ type: 'checklist', nodeId });
    }

    function toggleInlineItem(nodeId: number, itemId: string, currentItems: ChecklistItem[]) {
        const newItems = currentItems.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        updateChecklistItems(nodeId, newItems);
        setNewIdeaSwitch(prev => !prev);
    }

    function addInlineItem(nodeId: number, currentItems: ChecklistItem[]) {
        const text = (inlineDrafts[nodeId] ?? '').trim();
        if (!text) return;
        const newItems = [...currentItems, { id: String(Date.now()), text, checked: false }];
        updateChecklistItems(nodeId, newItems);
        setInlineDrafts(prev => ({ ...prev, [nodeId]: '' }));
        setNewIdeaSwitch(prev => !prev);
    }

    function toggleSheetItem(itemId: string, nodeId: number) {
        const newItems = sheetItems.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        );
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
    }

    function deleteSheetItem(itemId: string, nodeId: number) {
        const newItems = sheetItems.filter(item => item.id !== itemId);
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
    }

    function addSheetItem(nodeId: number) {
        const text = sheetItemDraft.trim();
        if (!text) return;
        const newItems = [...sheetItems, { id: String(Date.now()), text, checked: false }];
        setSheetItems(newItems);
        setSheetItemDraft('');
        updateChecklistItems(nodeId, newItems);
    }

    function goBack() {
        if (!currentIdea?.parentID) return;
        setCurrentId(currentIdea.parentID);
        setSheet(null);
        setEditMode(false);
    }

    function addChild() {
        setDraft('');
        setSheet({ type: 'rename', nodeId: -1, isNew: true });
        setEditMode(false);
    }

    function commitRename() {
        if (!sheet || sheet.type !== 'rename') return;
        const name = draft.trim() || 'Untitled';

        if (sheet.isNew) {
            const newId = Date.now();
            const newIdea: IdeaType = { id: newId, content: name, parentID: currentId, link: '' };
            appendToLocalStorageFromFrontend(newIdea);
            addIdeaToFirebase(newIdea);
            setNewIdeaSwitch(prev => !prev);
        } else {
            updateIdeaName(sheet.nodeId, name);
            updateIdeaNameInFirebase(sheet.nodeId, name).then(() => {
                setNewIdeaSwitch(prev => !prev);
            });
        }
        closeSheet();
    }

    function deleteNode(nodeId: number) {
        if (currentId === nodeId && currentIdea?.parentID) {
            setCurrentId(currentIdea.parentID);
        }
        recursivelyDeleteChildren(nodeId);
        setNewIdeaSwitch(prev => !prev);
        closeSheet();
    }

    function doMove(nodeId: number, targetId: number) {
        updateIdeaParentId(nodeId, targetId);
        setNewIdeaSwitch(prev => !prev);
        closeSheet();
    }

    function commitLink() {
        if (!sheet || sheet.type !== 'link') return;
        const url = cleanLink(draft.trim());
        updateIdeaLink(sheet.nodeId, url);
        updateIdeaLinkInFirebase(sheet.nodeId, url).then(() => {
            setNewIdeaSwitch(prev => !prev);
        });
        closeSheet();
    }

    const sheetNode = sheet && sheet.type !== 'navigate' ? allIdeas.find(i => i.id === sheet.nodeId) : null;
    const sheetNodeLink = getIdeaLink(sheetNode ?? undefined);
    const sheetTitle =
        sheet?.type === 'navigate' ? 'Navigate to…' :
        sheet?.type === 'move' ? 'Move under…' :
        sheet?.type === 'rename' ? (sheet.isNew ? 'Name your idea' : sheetNode?.type === 'checklist' ? 'Rename checklist' : allIdeas.some(i => i.parentID === sheetNode?.id) ? 'Rename idea' : 'Rewrite idea') :
        sheet?.type === 'link' ? (sheetNodeLink ? 'Change link' : 'Add link') :
        sheet?.type === 'confirmDelete' ? 'Delete idea?' :
        sheet?.type === 'checklist' ? (sheetNode?.content ?? '') :
        (sheetNode?.content ?? '');

    return (
        <div className="mmobile">
            <div className="mmobile-nav">
                <button className="mmobile-help" onClick={() => setShowHelp(h => !h)}>
                    <img src="/images/QuestionMark.svg" alt="Help" />
                </button>
                {canGoBack && (
                    <button className="mmobile-back" onClick={goBack}>‹</button>
                )}
                {currentId === 1 ? (
                    <img src="/images/MainLargerLogo.svg" alt="Intraconnected" className="mmobile-nav-logo" />
                ) : (
                    <div className="mmobile-crumbs">
                        {breadcrumbs.map((idea, i) => (
                            <button
                                key={idea.id}
                                className={`mmobile-crumb${idea.id === currentId ? ' mmobile-crumb--active' : ''}`}
                                onClick={() => { setCurrentId(idea.id); setSheet(null); setEditMode(false); }}
                            >
                                {i > 0 ? '› ' : ''}{idea.content}
                            </button>
                        ))}
                    </div>
                )}
                <button className="mmobile-logout" onClick={signUserOut}>
                    <img src="/images/LogOut.svg" alt="Sign out" />
                </button>
            </div>

            {showHelp && <MobileHelpSheet onClose={() => setShowHelp(false)} />}
            {showPatchNotes && <MobilePatchNotesSheet onClose={() => setShowPatchNotes(false)} />}

            <div
                className="mmobile-header"
                onMouseDown={() => startPress(currentId)}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                onTouchStart={() => startPress(currentId)}
                onTouchEnd={endPress}
            >
                <div className="mmobile-header-title">{currentIdea?.content ?? 'Ideas'}</div>
                <div className="mmobile-header-count">
                    {children.length} {children.length === 1 ? 'idea' : 'ideas'}
                </div>
            </div>

            {editMode && (
                <div className="mmobile-select-hint">Tap a node to edit it</div>
            )}

            <div className="mmobile-list">
                {children.length === 0 ? (
                    <div className="mmobile-empty">No ideas here yet.<br />Tap + to plant one.</div>
                ) : children.map(child => {
                    const hasKids = allIdeas.some(i => i.parentID === child.id);
                    const childLink = getIdeaLink(child);

                    if (child.type === 'checklist') {
                        const isExpanded = expandedChecklists.has(child.id);
                        const items = child.items;
                        const checkedCount = items.filter(i => i.checked).length;
                        return (
                            <div
                                key={child.id}
                                className={`mmobile-node mmobile-node--checklist${isExpanded ? ' mmobile-node--expanded' : ''}${editMode ? ' mmobile-node--selectable' : ''}`}
                                onMouseDown={() => startPress(child.id)}
                                onMouseUp={endPress}
                                onMouseLeave={endPress}
                                onTouchStart={() => startPress(child.id)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={(e) => { e.preventDefault(); if (!touchMoved.current) tapNode(child.id); }}
                                onClick={() => tapNode(child.id)}
                            >
                                <div className="mmobile-node-header-row">
                                    <span className="mmobile-node-title">{child.content}</span>
                                    <span className="mmobile-node-count">{checkedCount}/{items.length}</span>
                                    <button
                                        className="mmobile-checklist-open-btn"
                                        onClick={e => { e.stopPropagation(); openChecklistSheet(child.id); }}
                                        onTouchEnd={e => e.stopPropagation()}
                                        onMouseDown={e => e.stopPropagation()}
                                    >
                                        <img src="/images/OpenIcon.svg" alt="Open full view" />
                                    </button>
                                    <span className="mmobile-node-arrow">{editMode ? '✎' : isExpanded ? '▾' : '▸'}</span>
                                </div>
                                {isExpanded && (
                                    <div
                                        className="mmobile-checklist-inline"
                                        onClick={e => e.stopPropagation()}
                                        onTouchStart={e => e.stopPropagation()}
                                        onTouchEnd={e => e.stopPropagation()}
                                        onMouseDown={e => e.stopPropagation()}
                                        onMouseUp={e => e.stopPropagation()}
                                    >
                                        <ul className="mmobile-checklist-inline-items">
                                            {items.map(item => (
                                                <li
                                                    key={item.id}
                                                    className={`mmobile-checklist-inline-item${item.checked ? ' mmobile-checklist-inline-item--checked' : ''}`}
                                                    onClick={e => { e.stopPropagation(); toggleInlineItem(child.id, item.id, items); }}
                                                >
                                                    <span className="mmobile-checklist-inline-cb">{item.checked ? '☑' : '☐'}</span>
                                                    <span className="mmobile-checklist-inline-text">{item.text}</span>
                                                </li>
                                            ))}
                                            {items.length === 0 && (
                                                <li className="mmobile-checklist-inline-empty">No items yet</li>
                                            )}
                                        </ul>
                                        <input
                                            className="mmobile-checklist-inline-input"
                                            placeholder="+ Add item"
                                            value={inlineDrafts[child.id] ?? ''}
                                            onChange={e => setInlineDrafts(prev => ({ ...prev, [child.id]: e.target.value }))}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.stopPropagation();
                                                    addInlineItem(child.id, items);
                                                }
                                            }}
                                            maxLength={200}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const colorClass = childLink
                        ? 'mmobile-node--link'
                        : hasKids
                        ? 'mmobile-node--parent'
                        : 'mmobile-node--leaf';
                    return (
                        <div
                            key={child.id}
                            className={`mmobile-node ${colorClass}${editMode ? ' mmobile-node--selectable' : ''}`}
                            onMouseDown={() => startPress(child.id)}
                            onMouseUp={endPress}
                            onMouseLeave={endPress}
                            onTouchStart={() => startPress(child.id)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={(e) => { e.preventDefault(); if (!touchMoved.current) tapNode(child.id); }}
                            onClick={() => tapNode(child.id)}
                        >
                            <span className="mmobile-node-title">{child.content}</span>
                            {hasKids && (
                                <span className="mmobile-node-count">
                                    {allIdeas.filter(i => i.parentID === child.id).length}
                                </span>
                            )}
                            <span className="mmobile-node-arrow">
                                {editMode ? '✎' : '›'}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="mmobile-fab-area">
                <button className="mmobile-patchnotes-btn" onClick={() => setShowPatchNotes(p => !p)}><img src="/images/PatchNotesIcon.svg" alt="Patch notes" /></button>
                <button
                    className={`mmobile-navigate-btn${sheet?.type === 'navigate' ? ' mmobile-navigate-btn--active' : ''}`}
                    onClick={() => setSheet({ type: 'navigate' })}
                >
                    <img src="/images/MindMapIcon.svg" alt="Navigate" />
                </button>
                <button className="mmobile-fab" onClick={addChild}><img src="/images/MobileCreationArrow.svg" alt="Create" /></button>
                <button
                    className={`mmobile-edit-btn${editMode ? ' mmobile-edit-btn--active' : ''}`}
                    onClick={() => setEditMode(e => !e)}
                >
                    <img src="/images/Pen.svg" alt="Edit" />
                </button>
            </div>

            {sheet && (
                <>
                    <div className="mmobile-scrim" onClick={() => { if (Date.now() - lastLongPressTime.current < 400) return; closeSheet(); }} />
                    <div className="mmobile-sheet">
                        <div className="mmobile-sheet-title">
                            {sheetTitle}
                            {(sheet.type === 'move' || sheet.type === 'navigate' || sheet.type === 'checklist') && (
                                <button className="mmobile-sheet-close" onClick={closeSheet}>✕</button>
                            )}
                        </div>

                        {sheet.type === 'actions' && sheetNode && (
                            <div className="mmobile-actions">
                                {!editMode && sheetNode.id !== currentId && sheetNode.type !== 'checklist' && (
                                    sheetNodeLink ? (
                                        <button className="mmobile-action-btn mmobile-action-btn--open" onClick={() => { window.open(sheetNodeLink, '_blank', 'noopener,noreferrer'); closeSheet(); }}>
                                            <img src="/images/LinkBlack.svg" alt="" className="mmobile-action-icon" />Visit Link
                                        </button>
                                    ) : (
                                        <button className="mmobile-action-btn mmobile-action-btn--open" onClick={() => { setCurrentId(sheetNode.id); closeSheet(); setEditMode(false); }}>
                                            <img src="/images/OpenIcon.svg" alt="" className="mmobile-action-icon" />Open
                                        </button>
                                    )
                                )}
                                <button
                                    className="mmobile-action-btn mmobile-action-btn--rename"
                                    onClick={() => { setDraft(sheetNode.content); setSheet({ type: 'rename', nodeId: sheetNode.id }); }}
                                >
                                    <img src="/images/Pen.svg" alt="" className="mmobile-action-icon" />{sheetNode.type === 'checklist' ? 'Rename Checklist' : allIdeas.some(i => i.parentID === sheetNode.id) ? 'Rename Idea' : 'Rewrite Idea'}
                                </button>
                                {sheetNode.type !== 'checklist' && (
                                    <button
                                        className="mmobile-action-btn mmobile-action-btn--link"
                                        onClick={() => { setDraft(sheetNodeLink); setSheet({ type: 'link', nodeId: sheetNode.id }); }}
                                    >
                                        <img src="/images/LinkBlack.svg" alt="" className="mmobile-action-icon" />{sheetNodeLink ? 'Change link' : 'Add link'}
                                    </button>
                                )}
                                <button className="mmobile-action-btn mmobile-action-btn--move" onClick={() => setSheet({ type: 'move', nodeId: sheetNode.id })}>
                                    <img src="/images/Arrow.svg" alt="" className="mmobile-action-icon" />Move under…
                                </button>
                                {sheetNode.id !== 1 && (
                                    <button className="mmobile-action-btn mmobile-action-btn--delete" onClick={() => setSheet({ type: 'confirmDelete', nodeId: sheetNode.id })}>
                                        <img src="/images/Trash.svg" alt="" className="mmobile-action-icon" />Delete
                                    </button>
                                )}
                            </div>
                        )}

                        {sheet.type === 'rename' && (
                            <>
                                {sheet.isNew ? (
                                    <textarea
                                        autoFocus
                                        className="mmobile-rename-input mmobile-rename-input--grow"
                                        value={draft}
                                        onChange={e => {
                                            setDraft(e.target.value);
                                            const el = e.target;
                                            el.style.height = 'auto';
                                            el.style.height = el.scrollHeight + 'px';
                                        }}
                                        placeholder="Idea name"
                                        rows={1}
                                    />
                                ) : (
                                    <input
                                        autoFocus
                                        className="mmobile-rename-input"
                                        value={draft}
                                        onChange={e => setDraft(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && commitRename()}
                                        placeholder="Idea name"
                                        maxLength={100}
                                    />
                                )}
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--save" onClick={commitRename}>Save</button>
                                </div>
                            </>
                        )}

                        {sheet.type === 'link' && (
                            <>
                                <input
                                    autoFocus
                                    className="mmobile-rename-input"
                                    value={draft}
                                    onChange={e => setDraft(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && commitLink()}
                                    placeholder="https://..."
                                    type="url"
                                    maxLength={500}
                                />
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--save" onClick={commitLink}>Save</button>
                                </div>
                            </>
                        )}

                        {sheet.type === 'move' && (
                            <MobileMoveSheet
                                nodeId={sheet.nodeId}
                                allIdeas={allIdeas}
                                onMove={doMove}
                            />
                        )}

                        {sheet.type === 'navigate' && (
                            <MobileNavigateSheet
                                currentId={currentId}
                                allIdeas={allIdeas}
                                onNavigate={(id) => { setCurrentId(id); closeSheet(); }}
                            />
                        )}

                        {sheet.type === 'confirmDelete' && (
                            <>
                                <p className="mmobile-confirm-text">
                                    This will permanently delete <strong>{sheetNode?.content}</strong> and all its children.
                                </p>
                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--delete" onClick={() => deleteNode(sheet.nodeId)}>Delete</button>
                                </div>
                            </>
                        )}

                        {sheet.type === 'checklist' && (
                            <div className="mmobile-checklist-sheet">
                                <ul className="mmobile-checklist-sheet-items">
                                    {sheetItems.map(item => (
                                        <li
                                            key={item.id}
                                            className={`mmobile-checklist-sheet-item${item.checked ? ' mmobile-checklist-sheet-item--checked' : ''}`}
                                        >
                                            <button className="mmobile-checklist-sheet-cb" onClick={() => toggleSheetItem(item.id, sheet.nodeId)}>
                                                {item.checked ? '☑' : '☐'}
                                            </button>
                                            <span className="mmobile-checklist-sheet-text">{item.text}</span>
                                            <button className="mmobile-checklist-sheet-del" onClick={() => deleteSheetItem(item.id, sheet.nodeId)}>
                                                <img src="/images/Trash.svg" alt="Delete" />
                                            </button>
                                        </li>
                                    ))}
                                    {sheetItems.length === 0 && (
                                        <li className="mmobile-checklist-sheet-empty">No items yet.</li>
                                    )}
                                </ul>
                                <div className="mmobile-checklist-sheet-add">
                                    <input
                                        className="mmobile-checklist-sheet-input"
                                        placeholder="Add item…"
                                        value={sheetItemDraft}
                                        onChange={e => setSheetItemDraft(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); addSheetItem(sheet.nodeId); } }}
                                        maxLength={200}
                                    />
                                    <button className="mmobile-checklist-sheet-add-btn" onClick={() => addSheetItem(sheet.nodeId)}>+</button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default MobileMindMap;
