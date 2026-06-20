import { useState } from 'react';

interface Props {
    onClose: () => void;
}

function MobileHelpSheet({ onClose }: Props) {
    const [helpScreen, setHelpScreen] = useState(1);

    return (
        <>
            <div className="mmobile-scrim" onClick={onClose} />
            <div className="mmobile-help-sheet">
                <div className="mmobile-help-header">
                    <span className="mmobile-help-pager">{helpScreen} / 5</span>
                    <button className="mmobile-help-close" onClick={onClose}>✕</button>
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
                                <span className="mmobile-help-badge mmobile-help-badge--checklist-node">☑</span>
                                <p className="mmobile-help-text">Indigo nodes are checklists. Tap to expand items inline, or tap the icon in the header to open the full view.</p>
                            </div>
                        </>
                    )}

                    {helpScreen === 4 && (
                        <>
                            <h2 className="mmobile-help-title">The Full Picture</h2>
                            <p className="mmobile-help-subtext">Jump anywhere in your tree instantly</p>
                            <div className="mmobile-help-mini-map">
                                <div className="mmobile-mm-node mmobile-mm-node--current">My Ideas</div>
                                <div className="mmobile-mm-trunk"></div>
                                <div className="mmobile-mm-row">
                                    <div className="mmobile-mm-branch">
                                        <div className="mmobile-mm-v"></div>
                                        <div className="mmobile-mm-node mmobile-mm-node--parent">Work</div>
                                        <div className="mmobile-mm-v mmobile-mm-v--short"></div>
                                        <div className="mmobile-mm-node mmobile-mm-node--leaf">Task A</div>
                                    </div>
                                    <div className="mmobile-mm-branch">
                                        <div className="mmobile-mm-v"></div>
                                        <div className="mmobile-mm-node mmobile-mm-node--leaf">Home</div>
                                    </div>
                                </div>
                            </div>
                            <div className="mmobile-help-grid">
                                <span className="mmobile-help-badge mmobile-help-badge--nav"><img src="/images/MindMapIcon.svg" className="mmobile-help-badge-icon" alt="Navigate" /></span>
                                <p className="mmobile-help-text">Tap this button in the bottom bar to open Navigate, a full tree of all your ideas. Tap any node to jump there.</p>
                            </div>
                        </>
                    )}

                    {helpScreen === 5 && (
                        <>
                            <h2 className="mmobile-help-title">More Tools</h2>
                            <div className="mmobile-help-grid">
                                <span className="mmobile-help-badge mmobile-help-badge--edit"><img src="/images/Pen.svg" className="mmobile-help-badge-icon" alt="Edit" /></span>
                                <p className="mmobile-help-text">Tap the <strong>pencil</strong> to enter edit mode. In edit mode, tapping a node opens its action sheet instead of navigating into it.</p>
                                <span className="mmobile-help-badge mmobile-help-badge--patchnotes"><img src="/images/PatchNotesIcon.svg" className="mmobile-help-badge-icon" alt="Patch notes" /></span>
                                <p className="mmobile-help-text">Tap the <strong>patch notes</strong> button in the bottom bar to see what's new in the latest updates.</p>
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
                        onClick={() => setHelpScreen(s => Math.min(5, s + 1))}
                        disabled={helpScreen === 5}
                    >Next ›</button>
                </div>
            </div>
        </>
    );
}

export default MobileHelpSheet;
