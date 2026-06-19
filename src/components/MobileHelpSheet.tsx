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
                    <span className="mmobile-help-pager">{helpScreen} / 3</span>
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
    );
}

export default MobileHelpSheet;
