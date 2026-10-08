import React from 'react';
import HelpMenuOne from './helpMenus/HelpMenuOne';
import HelpMenuTwo from './helpMenus/HelpMenuTwo';
import HelpMenuThree from './helpMenus/HelpMenuThree';
import HelpMenuFour from './helpMenus/HelpMenuFour';
import HelpMenuFive from './helpMenus/HelpMenuFive';
import HelpMenuSix from './helpMenus/HelpMenuSix';

// Display order — the file names predate the current order.
const SCREENS: React.FC[] = [HelpMenuOne, HelpMenuTwo, HelpMenuThree, HelpMenuSix, HelpMenuFour, HelpMenuFive];
const LAST = SCREENS.length - 1;

// Matches the popup's fade-out in help.scss.
const CLOSE_TRANSITION_MS = 300;

interface HelpProps {
    showHelp: boolean;
    onClose: () => void;
}

function isTypingTarget(target: EventTarget | null) {
    return target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

const Help: React.FC<HelpProps> = ({ showHelp, onClose }) => {

    const [screen, setScreen] = React.useState(0);
    const [direction, setDirection] = React.useState<'forward' | 'back'>('forward');
    const [popupHeight, setPopupHeight] = React.useState<number>();
    const popupRef = React.useRef<HTMLElement>(null);
    const bodyRef = React.useRef<HTMLDivElement>(null);
    const screenRef = React.useRef<HTMLDivElement>(null);
    const footerRef = React.useRef<HTMLElement>(null);

    function goTo(index: number) {
        if (index < 0 || index > LAST || index === screen) return;
        setDirection(index > screen ? 'forward' : 'back');
        setScreen(index);
    }

    // Each screen sizes to its own content. The popup gets that natural height
    // as an explicit px value so `transition: height` can tween between
    // screens (CSS can't animate to `auto`). The popup is border-box, so
    // padding, border and the body/footer gap are added back in. A
    // ResizeObserver keeps it right when fonts/images load late or the window
    // crosses a breakpoint; the popup itself is observed too, since its own
    // padding/border can change without the content resizing. That can't
    // loop: the result never depends on the popup's current height.
    // `max-height` in CSS caps it on short windows, and the body scrolls.
    React.useLayoutEffect(() => {
        const popup = popupRef.current;
        const content = screenRef.current;
        const footer = footerRef.current;
        if (!popup || !content || !footer) return;

        if (bodyRef.current) bodyRef.current.scrollTop = 0;

        const measure = () => {
            const style = getComputedStyle(popup);
            const extras = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
                + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
                + (parseFloat(style.rowGap) || 0);
            setPopupHeight(content.offsetHeight + footer.offsetHeight + extras);
        };
        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(popup);
        observer.observe(content);
        observer.observe(footer);
        return () => observer.disconnect();
    }, [screen]);

    // Once the last screen has been read and the popup closed, the next open
    // starts from the beginning — after the fade-out, so it doesn't visibly jump.
    React.useEffect(() => {
        if (showHelp || screen !== LAST) return;
        const timer = setTimeout(() => {
            setDirection('forward');
            setScreen(0);
        }, CLOSE_TRANSITION_MS);
        return () => clearTimeout(timer);
    }, [showHelp, screen]);

    React.useEffect(() => {
        if (!showHelp) return;
        function handleKeyDown(e: KeyboardEvent) {
            if (e.defaultPrevented || isTypingTarget(e.target)) return;
            if (e.key === 'ArrowRight') goTo(screen + 1);
            else if (e.key === 'ArrowLeft') goTo(screen - 1);
            else if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    });

    const Screen = SCREENS[screen];

    return (
        <section
            ref={popupRef}
            className={`howToUsePopup neutral ${showHelp ? 'show' : ''}`}
            style={popupHeight ? { height: `${popupHeight}px` } : undefined}
            role="dialog"
            aria-label="Help"
            aria-hidden={!showHelp}
            inert={!showHelp}
        >
            <button className="help-close neobrutal-button" onClick={onClose} aria-label="Close help">✕</button>

            <div className="help-body" ref={bodyRef}>
                <div key={screen} ref={screenRef} className={`help-screen help-screen--${direction}`}>
                    <Screen />
                </div>
            </div>

            <footer className="help-footer" ref={footerRef}>
                <div className="help-dots">
                    {SCREENS.map((_, i) => (
                        <button
                            key={i}
                            className={`help-dot${i === screen ? ' help-dot--active' : ''}`}
                            onClick={() => goTo(i)}
                            aria-label={`Page ${i + 1} of ${SCREENS.length}`}
                            aria-current={i === screen ? 'step' : undefined}
                        />
                    ))}
                </div>
                <div className="help-nav">
                    <button className="help-nav-btn neobrutal-button neutral" onClick={() => goTo(screen - 1)} disabled={screen === 0}>
                        ← Back
                    </button>
                    {screen === LAST ? (
                        <button className="help-nav-btn help-nav-btn--primary neobrutal-button" onClick={onClose}>
                            Got it
                        </button>
                    ) : (
                        <button className="help-nav-btn help-nav-btn--primary neobrutal-button" onClick={() => goTo(screen + 1)}>
                            Next →
                        </button>
                    )}
                </div>
            </footer>
        </section>
    );
};

export default Help;
