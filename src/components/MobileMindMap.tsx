import { useEffect, useRef, useState } from 'react';
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
    signUserOut,
} from '../utilities';

type SheetState =
    | { type: 'actions'; nodeId: number }
    | { type: 'rename'; nodeId: number; isNew?: boolean }
    | { type: 'move'; nodeId: number }
    | { type: 'link'; nodeId: number }
    | { type: 'confirmDelete'; nodeId: number };

function MobileMindMap() {
    const { setNewIdeaSwitch } = useIdeaContext();

    const [currentId, setCurrentId] = useState(1);
    const [sheet, setSheet] = useState<SheetState | null>(null);
    const [draft, setDraft] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [helpScreen, setHelpScreen] = useState(1);
    const [expandedMoveNodes, setExpandedMoveNodes] = useState<Set<number>>(new Set());

    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressActive = useRef(false);
    const touchMoved = useRef(false);
    const moveListRef = useRef<HTMLDivElement>(null);
    const moveParentBtnRef = useRef<HTMLButtonElement | null>(null);

    const moveSheetKey = sheet?.type === 'move' ? sheet.nodeId : null;
    useEffect(() => {
        if (moveSheetKey === null) return;
        const ideas: IdeaType[] = fetchFullIdeaList();
        const movingNode = ideas.find((i: IdeaType) => i.id === moveSheetKey);
        const expanded = new Set<number>();
        let id: number | undefined = movingNode?.parentID;
        while (id) {
            expanded.add(id);
            const parent = ideas.find((i: IdeaType) => i.id === id);
            id = parent?.parentID || undefined;
        }
        setExpandedMoveNodes(expanded);
        const timer = setTimeout(() => {
            const container = moveListRef.current;
            const btn = moveParentBtnRef.current;
            if (container && btn) {
                const containerRect = container.getBoundingClientRect();
                const btnRect = btn.getBoundingClientRect();
                container.scrollTop += btnRect.top - containerRect.top;
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [moveSheetKey]);

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
        endPress(); // always cancel pending long-press timer
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

    function getDescendants(nodeId: number): Set<number> {
        const result = new Set<number>();
        const walk = (id: number) => {
            allIdeas.filter(i => i.parentID === id).forEach(child => {
                result.add(child.id);
                walk(child.id);
            });
        };
        walk(nodeId);
        return result;
    }


    function doMove(nodeId: number, targetId: number) {
        updateIdeaParentId(nodeId, targetId);
        setNewIdeaSwitch(prev => !prev);
        closeSheet();
    }

    function cleanLink(userLink: string): string {
        if (userLink === '') return '';
        if (!userLink.includes('https://')) userLink = 'https://' + userLink;
        if (!userLink.includes('.')) userLink = userLink + '.com';
        return userLink;
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

    function renderMoveTree(parentId: number, depth: number, hidden: Set<number>, disabled: Set<number>, currentParentId: number | undefined): React.ReactNode[] {
        return allIdeas
            .filter(i => i.parentID === parentId && !hidden.has(i.id))
            .flatMap(child => {
                const visibleKids = allIdeas.filter(i => i.parentID === child.id && !hidden.has(i.id));
                const isDisabled = disabled.has(child.id);
                const isExpanded = expandedMoveNodes.has(child.id);
                const isCurrentParent = child.id === currentParentId;
                const hasKids = allIdeas.some(i => i.parentID === child.id);
                const colorClass = child.link
                    ? 'mmobile-move-btn--link'
                    : hasKids ? 'mmobile-move-btn--parent'
                    : 'mmobile-move-btn--leaf';
                return [
                    <div key={child.id} className="mmobile-move-row" style={{ paddingLeft: `${depth * 16}px` }}>
                        <button
                            ref={isCurrentParent ? (el) => { moveParentBtnRef.current = el; } : undefined}
                            className={`mmobile-move-btn ${colorClass}${isDisabled ? ' mmobile-move-btn--disabled' : ''}`}
                            disabled={isDisabled}
                            onClick={isDisabled ? undefined : () => doMove(sheet!.nodeId, child.id)}
                        >
                            {child.content}
                        </button>
                        {visibleKids.length > 0 && (
                            <button
                                className="mmobile-move-toggle"
                                onClick={() => setExpandedMoveNodes(prev => {
                                    const next = new Set(prev);
                                    if (next.has(child.id)) next.delete(child.id);
                                    else next.add(child.id);
                                    return next;
                                })}
                            >
                                {isExpanded ? '▾' : '▸'}
                            </button>
                        )}
                    </div>,
                    ...(visibleKids.length > 0 && isExpanded
                        ? renderMoveTree(child.id, depth + 1, hidden, disabled, currentParentId)
                        : [])
                ];
            });
    }

    const sheetNode = sheet ? allIdeas.find(i => i.id === sheet.nodeId) : null;
    const sheetTitle =
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
            {showHelp && (
                <>
                    <div className="mmobile-scrim" onClick={() => setShowHelp(false)} />
                    <div className="mmobile-help-sheet">
                        <div className="mmobile-help-header">
                            <span className="mmobile-help-pager">{helpScreen} / 3</span>
                            <button className="mmobile-help-close" onClick={() => setShowHelp(false)}>✕</button>
                        </div>

                        <div className="mmobile-help-content">
                            {helpScreen === 1 && (
                                <>
                                    <h2 className="mmobile-help-title">Welcome to<br />Intraconnected</h2>
                                    <p className="mmobile-help-text">
                                        Intraconnected is like a visual canvas for your ideas.
                                        <br /><br />
                                        Everything starts with a root idea. From there, build and explore related ideas as a growing network. Tap any node to dive in and make it the new root.
                                        <br /><br />
                                         It's all about building connections that you can explore intuitively, not just keeping track of scattered notes.
                                    </p>
                                </>
                            )}

                            {helpScreen === 2 && (
                                <>
                                    <h2 className="mmobile-help-title">How Do I Use This?</h2>
                                    <div className="mmobile-help-grid">
                                        <span className="mmobile-help-badge mmobile-help-badge--root">Root</span>
                                        <p className="mmobile-help-text">The large card at the top is the current root. All nodes below belong to it.</p>
                                        <span className="mmobile-help-badge mmobile-help-badge--add"><img src="/images/Plus.svg" className="mmobile-help-badge-icon" alt="+" /></span>
                                        <p className="mmobile-help-text">Tap + at the bottom to create a new idea under the current root.</p>
                                        <span className="mmobile-help-badge mmobile-help-badge--back"><img src="/images/LeftArrow.svg" className="mmobile-help-badge-icon" alt="Back" /></span>
                                        <p className="mmobile-help-text">Tap Back to navigate up to the previous root.</p>
                                        <span className="mmobile-help-badge mmobile-help-badge--delete"><img src="/images/Trash.svg" className="mmobile-help-badge-icon" alt="Delete" /></span>
                                        <p className="mmobile-help-text">Long-press a node, then tap Delete to remove it and all its children.</p>
                                    </div>
                                </>
                            )}

                            {helpScreen === 3 && (
                                <>
                                    <h2 className="mmobile-help-title">The Nitty Gritty</h2>
                                    <p className="mmobile-help-subtext">Node colours tell you what's inside</p>
                                    <div className="mmobile-help-grid">
                                        <span className="mmobile-help-badge mmobile-help-badge--leaf">Leaf</span>
                                        <p className="mmobile-help-text">Green nodes have no children yet. Tap to dive in and add some!</p>
                                        <span className="mmobile-help-badge mmobile-help-badge--parent">Parent</span>
                                        <p className="mmobile-help-text">Blue nodes have related ideas inside. Tap to explore them.</p>
                                        <span className="mmobile-help-badge mmobile-help-badge--link">Link</span>
                                        <p className="mmobile-help-text">Yellow nodes link to external pages. They can't have child ideas.</p>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="mmobile-help-nav">
                            <button
                                className="mmobile-help-nav-btn"
                                onClick={() => setHelpScreen(s => Math.max(1, s - 1))}
                                disabled={helpScreen === 1}
                            >‹ Prev</button>
                            <button
                                className="mmobile-help-nav-btn mmobile-help-nav-btn--next"
                                onClick={() => setHelpScreen(s => Math.min(3, s + 1))}
                                disabled={helpScreen === 3}
                            >Next ›</button>
                        </div>
                    </div>
                </>
            )}

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
                    })
                }
            </div>

            <div className="mmobile-fab-area">
                <div className="mmobile-fab-spacer" />
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
                            {sheet.type === 'move' && (
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

                        {sheet.type === 'move' && (() => {
                            const movingNode = allIdeas.find(i => i.id === sheet.nodeId);
                            const descendants = getDescendants(sheet.nodeId);
                            const hidden = new Set([sheet.nodeId, ...descendants]);
                            const disabled = movingNode?.parentID ? new Set([movingNode.parentID]) : new Set<number>();
                            const root = allIdeas.find(i => i.id === 1);
                            const rootDisabled = disabled.has(1);
                            const rootExpanded = expandedMoveNodes.has(1);
                            return (
                                <div className="mmobile-move-list" ref={moveListRef}>
                                    {root && (
                                        <div className="mmobile-move-row">
                                            <button
                                                ref={movingNode?.parentID === 1 ? (el) => { moveParentBtnRef.current = el; } : undefined}
                                                className={`mmobile-move-btn mmobile-move-btn--parent${rootDisabled ? ' mmobile-move-btn--disabled' : ''}`}
                                                disabled={rootDisabled}
                                                onClick={rootDisabled ? undefined : () => doMove(sheet.nodeId, 1)}
                                            >
                                                {root.content}
                                            </button>
                                            <button
                                                className="mmobile-move-toggle"
                                                onClick={() => setExpandedMoveNodes(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(1)) next.delete(1); else next.add(1);
                                                    return next;
                                                })}
                                            >
                                                {rootExpanded ? '▾' : '▸'}
                                            </button>
                                        </div>
                                    )}
                                    {rootExpanded && renderMoveTree(1, 1, hidden, disabled, movingNode?.parentID)}
                                </div>
                            );
                        })()}

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
