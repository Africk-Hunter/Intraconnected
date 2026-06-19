import { useRef, useState } from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import {
    IdeaType,
    fetchFullIdeaList,
    appendToLocalStorageFromFrontend,
    addIdeaToFirebase,
    updateIdeaName,
    updateIdeaNameInFirebase,
    updateIdeaLink,
    updateIdeaLinkInFirebase,
    updateIdeaParentId,
    recursivelyDeleteChildren,
    cleanLink,
    signUserOut,
} from '../utilities';
import MobileHelpSheet from './MobileHelpSheet';
import MobileMoveSheet from './MobileMoveSheet';
import MobileNavigateSheet from './MobileNavigateSheet';

type SheetState =
    | { type: 'actions'; nodeId: number }
    | { type: 'rename'; nodeId: number; isNew?: boolean }
    | { type: 'move'; nodeId: number }
    | { type: 'link'; nodeId: number }
    | { type: 'confirmDelete'; nodeId: number }
    | { type: 'navigate' };

function MobileMindMap() {
    const { setNewIdeaSwitch } = useIdeaContext();

    const [currentId, setCurrentId] = useState(1);
    const [sheet, setSheet] = useState<SheetState | null>(null);
    const [draft, setDraft] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressActive = useRef(false);
    const touchMoved = useRef(false);

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
            setSheet({ type: 'actions', nodeId });
            setEditMode(false);
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
        if (editMode) {
            setSheet({ type: 'actions', nodeId });
            return;
        }
        const node = allIdeas.find(i => i.id === nodeId);
        if (node?.link) {
            window.open(node.link, '_blank', 'noopener,noreferrer');
            return;
        }
        setCurrentId(nodeId);
        setSheet(null);
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
    const sheetTitle =
        sheet?.type === 'navigate' ? 'Navigate to…' :
        sheet?.type === 'move' ? 'Move under…' :
        sheet?.type === 'rename' ? (sheet.isNew ? 'Name your idea' : 'Rename idea') :
        sheet?.type === 'link' ? (sheetNode?.link ? 'Change link' : 'Add link') :
        sheet?.type === 'confirmDelete' ? 'Delete idea?' :
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
                    const colorClass = child.link
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
                    className={`mmobile-navigate-btn${sheet?.type === 'navigate' ? ' mmobile-navigate-btn--active' : ''}`}
                    onClick={() => setSheet({ type: 'navigate' })}
                >
                    ◎
                </button>
                <button className="mmobile-fab" onClick={addChild}>+</button>
                <button
                    className={`mmobile-edit-btn${editMode ? ' mmobile-edit-btn--active' : ''}`}
                    onClick={() => setEditMode(e => !e)}
                >
                    <img src="/images/Pen.svg" alt="Edit" />
                </button>
            </div>

            {sheet && (
                <>
                    <div className="mmobile-scrim" onClick={closeSheet} />
                    <div className="mmobile-sheet">
                        <div className="mmobile-sheet-title">
                            {sheetTitle}
                            {(sheet.type === 'move' || sheet.type === 'navigate') && (
                                <button className="mmobile-sheet-close" onClick={closeSheet}>✕</button>
                            )}
                        </div>

                        {sheet.type === 'actions' && sheetNode && (
                            <div className="mmobile-actions">
                                {!editMode && sheetNode.id !== currentId && (
                                    sheetNode.link ? (
                                        <button className="mmobile-action-btn mmobile-action-btn--open" onClick={() => { window.open(sheetNode.link, '_blank', 'noopener,noreferrer'); closeSheet(); }}>
                                            <img src="/images/LinkBlack.svg" alt="" className="mmobile-action-icon" />Visit Link
                                        </button>
                                    ) : (
                                        <button className="mmobile-action-btn mmobile-action-btn--open" onClick={() => tapNode(sheetNode.id)}>
                                            <img src="/images/RightArrow.svg" alt="" className="mmobile-action-icon" />Open
                                        </button>
                                    )
                                )}
                                <button
                                    className="mmobile-action-btn mmobile-action-btn--rename"
                                    onClick={() => { setDraft(sheetNode.content); setSheet({ type: 'rename', nodeId: sheetNode.id }); }}
                                >
                                    <img src="/images/Pen.svg" alt="" className="mmobile-action-icon" />Rename
                                </button>
                                <button
                                    className="mmobile-action-btn mmobile-action-btn--link"
                                    onClick={() => { setDraft(sheetNode.link ?? ''); setSheet({ type: 'link', nodeId: sheetNode.id }); }}
                                >
                                    <img src="/images/LinkBlack.svg" alt="" className="mmobile-action-icon" />{sheetNode.link ? 'Change link' : 'Add link'}
                                </button>
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
                                <input
                                    autoFocus
                                    className="mmobile-rename-input"
                                    value={draft}
                                    onChange={e => setDraft(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && commitRename()}
                                    placeholder="Idea name"
                                    maxLength={100}
                                />
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
                    </div>
                </>
            )}
        </div>
    );
}

export default MobileMindMap;
