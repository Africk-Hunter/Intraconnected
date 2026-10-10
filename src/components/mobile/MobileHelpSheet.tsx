import React, { useLayoutEffect, useRef, useState } from 'react';
import { useSheetSwipeDown } from './useSheetSwipeDown';
import MoreDotsIcon from './MoreDotsIcon';

interface Props {
    onClose: () => void;
    onOpenPatchNotes: () => void;
    hasNewPatchNotes: boolean;
    style?: React.CSSProperties;
}

// Display order; each is one screen of the sheet.
const SCREENS: React.FC[] = [
    () => (
        <>
            <div className="help-one-title-row">
                <h2 className="mmobile-help-title">Welcome to<br />Intraconnected</h2>
                <svg
                    className="help-one-anim"
                    viewBox="0 0 95 76"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    <line x1="24" y1="37" x2="66" y2="18" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="24" y1="37" x2="66" y2="58" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />

                    <rect x="2" y="27" width="22" height="22" rx="4" fill="#A3703E" stroke="#111" strokeWidth="2" className="help-one-root-pulse" />
                    <rect x="66" y="8" width="24" height="20" rx="4" fill="#41BC28" stroke="#111" strokeWidth="2" />
                    <rect x="66" y="48" width="24" height="20" rx="4" fill="#00A9D8" stroke="#111" strokeWidth="2" />

                    <circle r="4" fill="#41BC28" stroke="#111" strokeWidth="1.5">
                        <animateMotion dur="1.6s" repeatCount="indefinite" begin="0s" path="M 24 37 L 66 18" />
                    </circle>
                    <circle r="4" fill="#00A9D8" stroke="#111" strokeWidth="1.5">
                        <animateMotion dur="1.6s" repeatCount="indefinite" begin="0.8s" path="M 24 37 L 66 58" />
                    </circle>
                </svg>
            </div>
            <p className="mmobile-help-text">Intraconnected is like a visual canvas for your ideas.</p>
            <p className="mmobile-help-text">Everything starts with a root idea. From there, build and explore related ideas as a growing network. Tap any node to dive in and make it the new root.</p>
            <p className="mmobile-help-text">It's all about building connections that you can explore intuitively, not just keeping track of scattered notes.</p>
        </>
    ),
    () => (
        <>
            <h2 className="mmobile-help-title">How Do I Use This?</h2>
            <p className="mmobile-help-subtext">The controls you'll use the most</p>
            <div className="mmobile-help-grid">
                <span className="mmobile-help-badge mmobile-help-badge--root">Root</span>
                <p className="mmobile-help-text">The large card at the top is the current root. All nodes below belong to it.</p>
                <span className="mmobile-help-badge mmobile-help-badge--add"><img src="/images/Plus.svg" className="mmobile-help-badge-icon" alt="+" /></span>
                <p className="mmobile-help-text">Tap + at the bottom to create a new idea under the current root.</p>
                <span className="mmobile-help-badge mmobile-help-badge--back"><img src="/images/ArrowBack.svg" className="mmobile-help-badge-icon" alt="Back" /></span>
                <p className="mmobile-help-text">Tap Back at the bottom, or use your phone's back gesture, to go up one level.</p>
                <span className="mmobile-help-badge mmobile-help-badge--delete"><img src="/images/Trash.svg" className="mmobile-help-badge-icon" alt="Delete" /></span>
                <p className="mmobile-help-text">Tap <span className="mmobile-help-inline-icon"><MoreDotsIcon size={16} /></span> on a node (or press and hold it) for Edit, Move, Priority and Delete. Deleted something by mistake? Tap <strong>Undo</strong>.</p>
            </div>
        </>
    ),
    () => (
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
                <span className="mmobile-help-badge mmobile-help-badge--checklist-node">
                    <span className="mmobile-checklist-inline-cb mmobile-checklist-inline-cb--checked" />
                </span>
                <p className="mmobile-help-text">Indigo nodes are checklists. Tap the count to open the items inline; once open, tap Full view to edit, reorder or link them.</p>
            </div>
        </>
    ),
    () => (
        <>
            <h2 className="mmobile-help-title">Priority &amp; Sorting</h2>
            <p className="mmobile-help-subtext">Put your most important ideas first</p>
            <div className="mmobile-help-node-demo">
                <span className="mmobile-help-node-demo-text">Idea</span>
                <div className="mmobile-help-rib-anim" />
                <span className="mmobile-help-node-demo-arrow">›</span>
            </div>
            <div className="mmobile-help-grid">
                <span className="mmobile-help-badge mmobile-help-badge--p1">P1</span>
                <p className="mmobile-help-text">Each idea has a <strong>priority ribbon</strong>. Tap it to cycle: <strong>High (red)</strong>, <strong>Medium (orange)</strong>, <strong>Low (yellow)</strong>, then none, or pick one directly from <span className="mmobile-help-inline-icon"><MoreDotsIcon size={16} /></span> or Edit. The ribbon height shows urgency at a glance.</p>
                <span className="mmobile-help-badge mmobile-help-badge--sort"><img src="/images/sort.svg" className="mmobile-help-badge-icon" alt="Sort" /></span>
                <p className="mmobile-help-text">Tap the <strong>Sort</strong> button in the idea count row to reorder by priority. Tap again to switch back to Age (creation) order.</p>
            </div>
        </>
    ),
    () => (
        <>
            <h2 className="mmobile-help-title">The Full Picture</h2>
            <p className="mmobile-help-subtext">Jump anywhere in your tree instantly</p>
            <div className="mmobile-help-vtree-demo">
                <div className="mmobile-help-vtree-root">My Ideas</div>
                <div className="mmobile-help-vtree-row">
                    <div className="mmobile-help-vtree-conn" />
                    <div className="mmobile-help-vtree-chip mmobile-help-vtree-chip--parent">Work</div>
                </div>
                <div className="mmobile-help-vtree-row">
                    <div className="mmobile-help-vtree-gap mmobile-help-vtree-gap--line" />
                    <div className="mmobile-help-vtree-conn mmobile-help-vtree-conn--last" />
                    <div className="mmobile-help-vtree-chip mmobile-help-vtree-chip--leaf">Task A</div>
                </div>
                <div className="mmobile-help-vtree-row">
                    <div className="mmobile-help-vtree-conn mmobile-help-vtree-conn--last" />
                    <div className="mmobile-help-vtree-chip mmobile-help-vtree-chip--leaf">Home</div>
                </div>
            </div>
            <div className="mmobile-help-grid">
                <span className="mmobile-help-badge mmobile-help-badge--nav"><img src="/images/MindMapBlack.svg" className="mmobile-help-badge-icon" alt="Navigate" /></span>
                <p className="mmobile-help-text">The <strong>Mind Map</strong> button opens a full tree of all your ideas. Tap any node to jump there, or use ▸ / ▾ to expand and collapse branches.</p>
            </div>
        </>
    ),
    () => (
        <>
            <h2 className="mmobile-help-title">More Tools</h2>
            <p className="mmobile-help-subtext">Shortcuts and what's new</p>
            <div className="mmobile-help-grid">
                <span className="mmobile-help-badge mmobile-help-badge--edit" aria-hidden="true">
                    <span className="mmobile-help-swipe-seg mmobile-help-swipe-seg--rename"><img src="/images/Pen.svg" alt="" /></span>
                    <span className="mmobile-help-swipe-seg mmobile-help-swipe-seg--move"><img src="/images/Move.svg" alt="" /></span>
                    <span className="mmobile-help-swipe-seg mmobile-help-swipe-seg--delete"><img src="/images/Trash.svg" alt="" /></span>
                </span>
                <p className="mmobile-help-text">Swipe a node <strong>left</strong> for quick Edit, Move and Delete. To move by dragging, press and hold, then drag it onto another node.</p>
                <span className="mmobile-help-badge mmobile-help-badge--patchnotes"><img src="/images/PatchNotesIconSkinny.svg" className="mmobile-help-badge-icon" alt="Patch notes" /></span>
                <p className="mmobile-help-text">Tap <strong>What's new</strong> at the top of this menu for a running log of new features and changes. Want to see a new feature? Recommend it from there!</p>
            </div>
        </>
    )
];
const LAST = SCREENS.length - 1;
const SWIPE_MIN_PX = 50;

function MobileHelpSheet({ onClose, onOpenPatchNotes, hasNewPatchNotes, style }: Props) {
    const [screen, setScreen] = useState(0);
    const [direction, setDirection] = useState<'forward' | 'back'>('forward');
    const [contentHeight, setContentHeight] = useState<number>();
    const contentRef = useRef<HTMLDivElement>(null);
    const screenRef = useRef<HTMLDivElement>(null);
    const touchStart = useRef<{ x: number; y: number } | null>(null);
    const swipe = useSheetSwipeDown(onClose);

    function goTo(index: number) {
        if (index < 0 || index > LAST || index === screen) return;
        setDirection(index > screen ? 'forward' : 'back');
        setScreen(index);
    }

    // Tween the sheet's height between screens: measure the new screen and
    // hand it to the content wrapper as px (CSS can't animate to `auto`). The
    // sheet's max-height still caps it, and the wrapper scrolls past that.
    useLayoutEffect(() => {
        const el = screenRef.current;
        if (!el) return;
        if (contentRef.current) contentRef.current.scrollTop = 0;
        setContentHeight(el.offsetHeight);
        const observer = new ResizeObserver(() => setContentHeight(el.offsetHeight));
        observer.observe(el);
        return () => observer.disconnect();
    }, [screen]);

    function onTouchStart(e: React.TouchEvent) {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
    }

    // Horizontal swipes page; mostly-vertical ones are scrolling.
    function onTouchEnd(e: React.TouchEvent) {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        goTo(screen + (dx < 0 ? 1 : -1));
    }

    const Screen = SCREENS[screen];

    return (
        <div className="mmobile-scrim mmobile-helpmenu-scrim" onClick={onClose}>
            <div ref={swipe.sheetRef} className="mmobile-help-sheet mmobile-helpmenu-sheet" style={style} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Help">
                <div className="mmobile-sheet-grab mmobile-sheet-grab--panel" aria-hidden="true" {...swipe.dragProps} />
                <div className="mmobile-help-header" {...swipe.dragProps}>
                    <div className="mmobile-help-dots">
                        {SCREENS.map((_, i) => (
                            <button
                                key={i}
                                className={`mmobile-help-dot${i === screen ? ' mmobile-help-dot--active' : ''}`}
                                onClick={() => goTo(i)}
                                aria-label={`Page ${i + 1} of ${SCREENS.length}`}
                                aria-current={i === screen ? 'step' : undefined}
                            />
                        ))}
                    </div>
                    <div className="mmobile-help-header-actions">
                        <button className="mmobile-help-whatsnew" onClick={onOpenPatchNotes} aria-label="What's new">
                            <img src="/images/PatchNotesIconSkinny.svg" alt="" />
                            <span className="mmobile-help-whatsnew-label">What's new</span>
                            {hasNewPatchNotes && <span className="mmobile-help-whatsnew-dot" aria-label="(new)" />}
                        </button>
                        <button className="mmobile-help-close" onClick={onClose} aria-label="Close help">✕</button>
                    </div>
                </div>

                <div
                    className="mmobile-help-content"
                    ref={contentRef}
                    style={contentHeight ? { height: `${contentHeight}px` } : undefined}
                    onTouchStart={onTouchStart}
                    onTouchEnd={onTouchEnd}
                >
                    <div key={screen} ref={screenRef} className={`mmobile-help-screen mmobile-help-screen--${direction}`}>
                        <Screen />
                    </div>
                </div>

                <div className="mmobile-help-nav">
                    <button className="mmobile-help-nav-btn" onClick={() => goTo(screen - 1)} disabled={screen === 0}>‹ Back</button>
                    {screen === LAST ? (
                        <button className="mmobile-help-nav-btn mmobile-help-nav-btn--next" onClick={onClose}>Got it</button>
                    ) : (
                        <button className="mmobile-help-nav-btn mmobile-help-nav-btn--next" onClick={() => goTo(screen + 1)}>Next ›</button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MobileHelpSheet;
