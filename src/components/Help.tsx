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
            <section className={`howToUsePopup neutral ${showHelp ? 'show' : ''}`}>
                <div className={`moveArrow ${helpScreen != 1 && 'show'}`} onClick={decrementHelpScreen}><img src="images/LeftArrow.svg" alt="" /></div>

                {chooseHelpScreen()}

                <div className={`moveArrow ${helpScreen != 6 && 'show'}`} onClick={incrementHelpScreen}><img src="images/RightArrow.svg" alt="" /></div>
            </section>
        </>
    );
};

export default Help;