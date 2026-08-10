import React from 'react';
import HelpMenuOne from './helpMenus/HelpMenuOne';
import HelpMenuTwo from './helpMenus/HelpMenuTwo';
import HelpMenuThree from './helpMenus/HelpMenuThree';
import HelpMenuFour from './helpMenus/HelpMenuFour';
import HelpMenuFive from './helpMenus/HelpMenuFive';
import HelpMenuSix from './helpMenus/HelpMenuSix';

interface HelpProps {
    showHelp: boolean;
}

const Help: React.FC<HelpProps> = ({ showHelp }) => {

    const [helpScreen, setHelpScreen] = React.useState(1);
    const [popupHeight, setPopupHeight] = React.useState<number>();
    const popupRef = React.useRef<HTMLElement>(null);

    // Each screen sizes to its own content — but instead of snapping between
    // heights, measure the new screen's natural height and hand it to the popup
    // as an explicit px value, so the existing `transition: all` on
    // .howToUsePopup animates the resize smoothly. Release the height clamp,
    // read the browser's own natural total (border-box) size, then restore.
    // .howToUsePopup is content-box (default, unset), so the `height` property
    // only accepts the content portion — subtract padding/border (read live,
    // so it stays correct across the mobile/large-desktop breakpoints) before
    // assigning, or every screen change would inflate the box by that amount.
    React.useLayoutEffect(() => {
        if (!showHelp || !popupRef.current) return;
        const popup = popupRef.current;
        const prevHeight = popup.style.height;
        popup.style.height = 'auto';
        const total = popup.getBoundingClientRect().height;
        popup.style.height = prevHeight;

        const style = getComputedStyle(popup);
        const verticalExtras = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
            + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);

        setPopupHeight(total - verticalExtras);
    }, [helpScreen, showHelp]);

    function decrementHelpScreen() {
        if (helpScreen > 1) {
            setHelpScreen(helpScreen - 1);
        }
    }

    function incrementHelpScreen() {
        if (helpScreen < 6) {
            setHelpScreen(helpScreen + 1);
        }
    }

    function chooseHelpScreen() {
        switch (helpScreen) {
            case 1:
                return <HelpMenuOne />;
            case 2:
                return <HelpMenuTwo />;
            case 3:
                return <HelpMenuThree />;
            case 4:
                return <HelpMenuSix />;
            case 5:
                return <HelpMenuFour />;
            case 6:
                return <HelpMenuFive />;
            default:
                return <HelpMenuOne />;
        }
    }

    return (
        <>
            <section
                ref={popupRef}
                className={`howToUsePopup neutral ${showHelp ? 'show' : ''}`}
                style={popupHeight ? { height: `${popupHeight}px` } : undefined}
            >
                <div className={`moveArrow ${helpScreen != 1 && 'show'}`} onClick={decrementHelpScreen}><img src="images/LeftArrow.svg" alt="" /></div>

                {chooseHelpScreen()}

                <div className={`moveArrow ${helpScreen != 6 && 'show'}`} onClick={incrementHelpScreen}><img src="images/RightArrow.svg" alt="" /></div>
            </section>
        </>
    );
};

export default Help;
