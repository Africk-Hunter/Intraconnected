import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
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
    handleChecklistCreation,
    recursivelyDeleteChildren,
    cleanLink,
    signUserOut,
    getIdeaLink,
} from '../utilities';
import MobileHelpSheet from './MobileHelpSheet';
import MobileMoveSheet from './MobileMoveSheet';
import MobileMindMapSheet from './MobileMindMapSheet';
import MobilePatchNotesSheet from './MobilePatchNotesSheet';
import changelog from '../CHANGELOG.md?raw';
import { parseChangelog } from '../utilities/parseChangelog';
import { isPatchNotesNew, markPatchNotesSeen, syncPatchNotesFromFirebase } from '../utilities/patchNotesState';
import { auth } from '../firebaseConfig';

const _changelogEntries = parseChangelog(changelog);

const lastPointer = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', (e) => {
        lastPointer.x = e.clientX;
        lastPointer.y = e.clientY;
    }, { passive: true });
}

type SheetState =
    | { type: 'actions'; nodeId: number }
    | { type: 'rename'; nodeId: number; isNew?: boolean }
    | { type: 'move'; nodeId: number }
    | { type: 'link'; nodeId: number }
    | { type: 'confirmDelete'; nodeId: number }
    | { type: 'checklist'; nodeId: number };

interface SortableMobileItemProps {
    item: ChecklistItem;
    nodeId: number;
    onToggle: (id: string, nodeId: number) => void;
    onDelete: (id: string, nodeId: number) => void;
    onEdit: (id: string, newText: string, nodeId: number) => void;
}

function SortableMobileChecklistItem({ item, nodeId, onToggle, onDelete, onEdit }: SortableMobileItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const [isEditing, setIsEditing] = useState(false);
    const [editDraft, setEditDraft] = useState('');
    const editInputRef = useRef<HTMLTextAreaElement>(null);

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

    function startEdit() {
        setEditDraft(item.text);
        setIsEditing(true);
    }

    function commitEdit() {
        const text = editDraft.trim();
        if (text && text !== item.text) onEdit(item.id, text, nodeId);
        setIsEditing(false);
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
                <span className="mmobile-checklist-sheet-text">{item.text}</span>
            )}
            {!isEditing && (
                <button className="mmobile-checklist-sheet-edit" onClick={startEdit}>
                    <img src="/images/Pen.svg" alt="Edit" />
                </button>
            )}
            <button className="mmobile-checklist-sheet-del" onClick={() => onDelete(item.id, nodeId)}>
                <img src="/images/Trash.svg" alt="Delete" />
            </button>
        </li>
    );
}

function MobileMindMap() {
    const { setNewIdeaSwitch } = useIdeaContext();

    const [currentId, setCurrentId] = useState(1);
    const [sheet, setSheet] = useState<SheetState | null>(null);
    const [draft, setDraft] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showPatchNotes, setShowPatchNotes] = useState(false);
    const [showMindMap, setShowMindMap] = useState(false);
    const [isNewPatchNotes, setIsNewPatchNotes] = useState(() =>
        isPatchNotesNew(auth.currentUser?.uid, _changelogEntries)
    );
    const [expandedChecklists, setExpandedChecklists] = useState<Set<number>>(new Set());
    const [inlineDrafts, setInlineDrafts] = useState<Record<number, string>>({});
    const [sheetItems, setSheetItems] = useState<ChecklistItem[]>([]);
    const [sheetItemDraft, setSheetItemDraft] = useState('');
    const [createTab, setCreateTab] = useState<'idea' | 'checklist'>('idea');
    const [checklistTitle, setChecklistTitle] = useState('');
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
    const [checklistItemDraft, setChecklistItemDraft] = useState('');
    const [newIdeaLink, setNewIdeaLink] = useState('');
    const [headerDraft, setHeaderDraft] = useState('');
    const [sheetOrigin, setSheetOrigin] = useState({ dx: 0, dy: 0 });
    const [helpOrigin, setHelpOrigin] = useState({ dx: 0, dy: 0 });

    const headerTextareaRef = useRef<HTMLTextAreaElement>(null);
    const sheetWasNullRef = useRef(true);

    const sheetSensors = useSensors(useSensor(PointerSensor));

    function handleSheetDragEnd(event: DragEndEvent, nodeId: number) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = sheetItems.findIndex(i => i.id === active.id);
        const newIndex = sheetItems.findIndex(i => i.id === over.id);
        const newItems = arrayMove(sheetItems, oldIndex, newIndex);
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
    }

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        syncPatchNotesFromFirebase(uid, _changelogEntries).then(isNew => setIsNewPatchNotes(isNew));
    }, []);

    useEffect(() => {
        const isOpen = sheet !== null;
        if (isOpen && sheetWasNullRef.current) {
            setSheetOrigin({
                dx: lastPointer.x - window.innerWidth / 2,
                dy: lastPointer.y - (window.innerHeight - 10),
            });
        }
        sheetWasNullRef.current = !isOpen;
    }, [sheet]);

    useEffect(() => {
        const idea = fetchFullIdeaList().find(i => i.id === currentId);
        setHeaderDraft(idea?.content ?? 'Ideas');
    }, [currentId]);

    useLayoutEffect(() => {
        const el = headerTextareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }, [headerDraft]);

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
        setNewIdeaLink('');
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

    function editSheetItem(itemId: string, newText: string, nodeId: number) {
        const newItems = sheetItems.map(item =>
            item.id === itemId ? { ...item, text: newText } : item
        );
        setSheetItems(newItems);
        updateChecklistItems(nodeId, newItems);
        setNewIdeaSwitch(prev => !prev);
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
        setCreateTab('idea');
        setChecklistTitle('');
        setChecklistItems([]);
        setChecklistItemDraft('');
        setSheet({ type: 'rename', nodeId: -1, isNew: true });
        setEditMode(false);
    }

    function addChecklistItem() {
        const text = checklistItemDraft.trim();
        if (!text) return;
        setChecklistItems(prev => [...prev, { id: String(Date.now()), text, checked: false }]);
        setChecklistItemDraft('');
    }

    function removeChecklistItem(itemId: string) {
        setChecklistItems(prev => prev.filter(i => i.id !== itemId));
    }

    function saveHeaderDraft() {
        const trimmed = headerDraft.trim() || 'Untitled';
        const currentIdea = fetchFullIdeaList().find(i => i.id === currentId);
        if (trimmed === currentIdea?.content) return;
        updateIdeaName(currentId, trimmed);
        updateIdeaNameInFirebase(currentId, trimmed).then(() => {
            setNewIdeaSwitch(prev => !prev);
        });
    }

    function commitRename() {
        if (!sheet || sheet.type !== 'rename') return;

        if (sheet.isNew && createTab === 'checklist') {
            const title = checklistTitle.trim() || 'Untitled';
            handleChecklistCreation(title, currentId, checklistItems);
            setNewIdeaSwitch(prev => !prev);
            closeSheet();
            return;
        }

        const name = draft.trim() || 'Untitled';
        if (sheet.isNew) {
            const newId = Date.now();
            const newIdea: IdeaType = { id: newId, content: name, parentID: currentId, link: cleanLink(newIdeaLink.trim()) };
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

    const sheetNode = sheet ? allIdeas.find(i => i.id === sheet.nodeId) : null;
    const sheetNodeLink = getIdeaLink(sheetNode ?? undefined);
    const sheetTitle =
        sheet?.type === 'move' ? 'Move under…' :
        sheet?.type === 'rename' ? (sheet.isNew ? (createTab === 'checklist' ? 'New checklist' : 'New idea') : sheetNode?.type === 'checklist' ? 'Rename checklist' : allIdeas.some(i => i.parentID === sheetNode?.id) ? 'Rename idea' : 'Rewrite idea') :
        sheet?.type === 'link' ? (sheetNodeLink ? 'Change link' : 'Add link') :
        sheet?.type === 'confirmDelete' ? 'Delete idea?' :
        sheet?.type === 'checklist' ? (sheetNode?.content ?? '') :
        (sheetNode?.content ?? '');

    return (
        <div className="mmobile">
            <div className="mmobile-nav">
                <button className="mmobile-help" onClick={() => {
                    if (!showHelp) setHelpOrigin({ dx: lastPointer.x - window.innerWidth / 2, dy: lastPointer.y - window.innerHeight / 2 });
                    setShowHelp(h => !h);
                }}>
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
                                {i > 0 ? '› ' : ''}{idea.content.split('\n')[0]}
                            </button>
                        ))}
                    </div>
                )}
                <button className="mmobile-logout" onClick={signUserOut}>
                    <img src="/images/LogOut.svg" alt="Sign out" />
                </button>
            </div>

            {showHelp && <MobileHelpSheet onClose={() => setShowHelp(false)} style={{ '--origin-dx': `${helpOrigin.dx}px`, '--origin-dy': `${helpOrigin.dy}px` } as React.CSSProperties} />}
            {showPatchNotes && <MobilePatchNotesSheet onClose={() => setShowPatchNotes(false)} style={{ '--origin-dx': `${helpOrigin.dx}px`, '--origin-dy': `${helpOrigin.dy}px` } as React.CSSProperties} />}
            {showMindMap && (
                <MobileMindMapSheet
                    currentId={currentId}
                    allIdeas={allIdeas}
                    onNavigate={(id) => { setCurrentId(id); setShowMindMap(false); setSheet(null); setEditMode(false); }}
                    onClose={() => setShowMindMap(false)}
                />
            )}

            <div
                className="mmobile-header"
                onMouseDown={() => startPress(currentId)}
                onMouseUp={endPress}
                onMouseLeave={endPress}
                onTouchStart={() => startPress(currentId)}
                onTouchEnd={endPress}
            >
                <textarea
                    ref={headerTextareaRef}
                    className="mmobile-header-title"
                    value={headerDraft}
                    rows={1}
                    onChange={e => {
                        setHeaderDraft(e.target.value);
                        const el = e.target;
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                    }}
                    onBlur={saveHeaderDraft}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                />
                <div className="mmobile-header-count">
                    {children.length} {children.length === 1 ? 'idea' : 'ideas'}
                </div>
            </div>

            {editMode && (
                <div className="mmobile-select-hint">Tap a node to edit it</div>
            )}

            <div className="mmobile-list">
                {children.length === 0 ? (
                    <div className="mmobile-empty">No ideas here yet.<br />Tap + to create one.</div>
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
                                        <img src="/images/OpenIconSkinny.svg" alt="Open full view" />
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
                                                    <span className="mmobile-checklist-inline-cb" />
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
                <button
                    className={`mmobile-patchnotes-btn${isNewPatchNotes ? ' mmobile-patchnotes-btn--new' : ''}`}
                    onClick={() => {
                        if (!showPatchNotes) {
                            setHelpOrigin({ dx: lastPointer.x - window.innerWidth / 2, dy: lastPointer.y - window.innerHeight / 2 });
                            markPatchNotesSeen(auth.currentUser?.uid, _changelogEntries);
                            setIsNewPatchNotes(false);
                        }
                        setShowPatchNotes(p => !p);
                    }}
                ><img src="/images/PatchNotesIconSkinny.svg" alt="Patch notes" /></button>
                <button
                    className={`mmobile-navigate-btn${showMindMap ? ' mmobile-navigate-btn--active' : ''}`}
                    onClick={() => setShowMindMap(m => !m)}
                >
                    <img src="/images/MindMapIconSkinny.svg" alt="Navigate" />
                </button>
                <button className="mmobile-fab" onClick={addChild}><img src="/images/SkinnyPlus.svg" alt="Create" /></button>
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
                    <div className="mmobile-sheet" style={{ '--origin-dx': `${sheetOrigin.dx}px`, '--origin-dy': `${sheetOrigin.dy}px` } as React.CSSProperties}>
                        <div className="mmobile-sheet-title">
                            {sheetTitle}
                            {(sheet.type === 'move' || sheet.type === 'checklist') && (
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
                                            <img src="/images/OpenIconSkinny.svg" alt="" className="mmobile-action-icon" />Open
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
                                {sheet.isNew && (
                                    <div className="mmobile-create-tabs">
                                        <button
                                            className={`mmobile-create-tab${createTab === 'idea' ? ' mmobile-create-tab--active' : ''}`}
                                            onClick={() => setCreateTab('idea')}
                                        >
                                            Idea
                                        </button>
                                        <button
                                            className={`mmobile-create-tab${createTab === 'checklist' ? ' mmobile-create-tab--active' : ''}`}
                                            onClick={() => setCreateTab('checklist')}
                                        >
                                            Checklist
                                        </button>
                                    </div>
                                )}

                                {(!sheet.isNew || createTab === 'idea') && (
                                    sheet.isNew ? (
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
                                            onFocus={e => { const el = e.target; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitRename(); } }}
                                            placeholder="Idea name"
                                            maxLength={100}
                                            rows={1}
                                        />
                                    )
                                )}

                                {sheet.isNew && createTab === 'idea' && (
                                    <input
                                        className="mmobile-rename-input mmobile-link-input"
                                        placeholder="Link (optional)"
                                        value={newIdeaLink}
                                        onChange={e => setNewIdeaLink(e.target.value)}
                                        type="url"
                                        maxLength={500}
                                    />
                                )}

                                {sheet.isNew && createTab === 'checklist' && (
                                    <div className="mmobile-sheet-cl-create">
                                        <input
                                            autoFocus
                                            className="mmobile-rename-input"
                                            placeholder="Checklist title"
                                            value={checklistTitle}
                                            onChange={e => setChecklistTitle(e.target.value)}
                                            maxLength={100}
                                        />
                                        {checklistItems.length > 0 && (
                                            <ul className="mmobile-sheet-cl-items">
                                                {checklistItems.map(item => (
                                                    <li key={item.id} className="mmobile-sheet-cl-item">
                                                        <span className="mmobile-sheet-cl-item-text">☐ {item.text}</span>
                                                        <button className="mmobile-sheet-cl-item-del" onClick={() => removeChecklistItem(item.id)}>✕</button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <input
                                            className="mmobile-rename-input"
                                            placeholder="Add item (Enter to add)"
                                            value={checklistItemDraft}
                                            onChange={e => setChecklistItemDraft(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
                                            maxLength={200}
                                        />
                                    </div>
                                )}

                                <div className="mmobile-sheet-btns">
                                    <button className="mmobile-sheet-btn mmobile-sheet-btn--cancel" onClick={closeSheet}>Cancel</button>
                                    <button
                                        className="mmobile-sheet-btn mmobile-sheet-btn--save"
                                        onClick={commitRename}
                                        disabled={sheet.isNew && createTab === 'checklist' && !checklistTitle.trim()}
                                    >
                                        {sheet.isNew ? 'Create' : 'Save'}
                                    </button>
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
                                <DndContext
                                    sensors={sheetSensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={(e) => handleSheetDragEnd(e, sheet.nodeId)}
                                    modifiers={[restrictToVerticalAxis]}
                                >
                                    <SortableContext items={sheetItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                        <ul className="mmobile-checklist-sheet-items">
                                            {sheetItems.map(item => (
                                                <SortableMobileChecklistItem
                                                    key={item.id}
                                                    item={item}
                                                    nodeId={sheet.nodeId}
                                                    onToggle={toggleSheetItem}
                                                    onDelete={deleteSheetItem}
                                                    onEdit={editSheetItem}
                                                />
                                            ))}
                                            {sheetItems.length === 0 && (
                                                <li className="mmobile-checklist-sheet-empty">No items yet.</li>
                                            )}
                                        </ul>
                                    </SortableContext>
                                </DndContext>
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
