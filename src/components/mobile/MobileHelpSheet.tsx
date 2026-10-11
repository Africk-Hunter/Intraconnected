import React, { useLayoutEffect, useRef, useState } from 'react';
import { useSheetSwipeDown } from './useSheetSwipeDown';
import MoreDotsIcon from './MoreDotsIcon';
import HelpTreeAnim from '../helpMenus/HelpTreeAnim';

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
                <HelpTreeAnim />
            </div>
            <p className="mmobile-help-text">Intraconnected is like a visual canvas for your ideas.</p>
            <p className="mmobile-help-text">Start with one big idea, then add smaller ideas inside it. Tap any idea to open it and add more inside.</p>
            <p className="mmobile-help-text">Related ideas stay connected, so they're easy to find again.</p>
        </>
    ),
    () => (
        <>
            <h2 className="mmobile-help-title">How Do I Use This?</h2>
            <p className="mmobile-help-subtext">The buttons you'll use most</p>
            <div className="mmobile-help-grid">
                <span className="mmobile-help-badge mmobile-help-badge--root">Root</span>
                <p className="mmobile-help-text">The big card at the top is the idea you're inside. The ideas below belong to it.</p>
                <span className="mmobile-help-badge mmobile-help-badge--add"><img src="/images/Plus.svg" className="mmobile-help-badge-icon" alt="+" /></span>
                <p className="mmobile-help-text">Tap + at the bottom to add a new idea.</p>
                <span className="mmobile-help-badge mmobile-help-badge--back"><img src="/images/ArrowBack.svg" className="mmobile-help-badge-icon" alt="Back" /></span>
                <p className="mmobile-help-text">Tap Back, or use your phone's back gesture, to go up one level.</p>
                <span className="mmobile-help-badge mmobile-help-badge--delete"><img src="/images/Trash.svg" className="mmobile-help-badge-icon" alt="Delete" /></span>
                <p className="mmobile-help-text">Tap <span className="mmobile-help-inline-icon"><MoreDotsIcon size={16} /></span> on an idea (or press and hold it) to edit, move, set a priority or delete. Made a mistake? Tap <strong>Undo</strong>.</p>
            </div>
        </>
    ),
    () => (
        <>
            <h2 className="mmobile-help-title">The Nitty Gritty</h2>
            <p className="mmobile-help-subtext">What each color means</p>
            <div className="mmobile-help-grid">
                <span className="mmobile-help-badge mmobile-help-badge--leaf">Leaf</span>
                <p className="mmobile-help-text">Green ideas have nothing inside them yet. Tap one to open it and start adding related ideas.</p>
                <span className="mmobile-help-badge mmobile-help-badge--parent">Parent</span>
                <p className="mmobile-help-text">Blue ideas already have other ideas inside them. Tap one to open it and see what's in there.</p>
                <span className="mmobile-help-badge mmobile-help-badge--link">Link</span>
                <p className="mmobile-help-text">Yellow ideas open a web page when you tap them. A link can't hold other ideas.</p>
                <span className="mmobile-help-badge mmobile-help-badge--checklist-node">
                    <span className="mmobile-checklist-inline-cb mmobile-checklist-inline-cb--checked" />
                </span>
                <p className="mmobile-help-text">Indigo cards are to-do lists. Tap one to see its items and tick them off, or tap Full view to edit them. A checklist can't hold other ideas.</p>
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
                <p className="mmobile-help-text">Mark how important an idea is with its <strong>ribbon</strong>. Tap it to switch between <strong>High (red)</strong>, <strong>Medium (orange)</strong>, <strong>Low (yellow)</strong> and none. The more important, the longer the ribbon.</p>
                <span className="mmobile-help-badge mmobile-help-badge--sort"><img src="/images/sort.svg" className="mmobile-help-badge-icon" alt="Sort" /></span>
                <p className="mmobile-help-text">Tap <strong>Sort</strong> to put the most important ideas first. Tap again to go back to oldest first.</p>
            </div>
        </>
    ),
    () => (
        <>
            <h2 className="mmobile-help-title">The Full Picture</h2>
            <p className="mmobile-help-subtext">See all your ideas at once</p>
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
                <p className="mmobile-help-text">The <strong>Mind Map</strong> button shows all your ideas as a tree. Tap one to jump to it, or tap ▸ / ▾ to open and close branches.</p>
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
                <p className="mmobile-help-text">Swipe an idea <strong>left</strong> for quick Edit, Move and Delete. To move it by dragging, press and hold, then drop it onto another idea.</p>
                <span className="mmobile-help-badge mmobile-help-badge--patchnotes"><img src="/images/PatchNotesIconSkinny.svg" className="mmobile-help-badge-icon" alt="Patch notes" /></span>
                <p className="mmobile-help-text">Tap <strong>What's new</strong> at the top of this menu to see new features. Want a feature? Suggest it from there!</p>
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
