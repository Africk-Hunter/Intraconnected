import React from 'react';
import HelpMenuOne from './helpMenus/HelpMenuOne';
import HelpMenuTwo from './helpMenus/HelpMenuTwo';
import HelpMenuThree from './helpMenus/HelpMenuThree';

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
        if (helpScreen < 3) {
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
            default:
                return <HelpMenuOne />;
        }
    }

    return (
        <>
            <section className={`howToUsePopup neutral ${showHelp ? 'show' : ''}`}>
                {helpScreen != 1 && <div className="moveArrow" onClick={decrementHelpScreen}><img src="images/LeftArrow.svg" alt="" /></div>}

                {chooseHelpScreen()}

                {helpScreen != 3 && <div className="moveArrow" onClick={incrementHelpScreen}><img src="images/RightArrow.svg" alt="" /></div>}
            </section>
        </>
    );
};

export default Help;



{/* <h1 className="header">So How Do I Use<br />This?</h1><br />
                    <section className="helpGrid">
                        <div className="helpGridIcon helpRoot">Ideas</div><p className="details">This is the root idea, any ideas you create here will become this ideas child.</p>
                        <div className="helpGridIcon helpPlus"><img src="images/Plus.svg" className='helpImg' alt="" /></div><p className="details">You can create a new idea by clicking this icon.</p>
                        <div className="helpGridIcon helpBack">Back</div><p className="details">If you want to navigate back to a previous root, just click the back button.</p>
                        <div className="helpGridIcon helpTrash"><img src="images/Trash.svg" className='helpImg trash' alt="" /></div><p className="details">If you want to delete an idea, just drag and drop it into the trash icon. Just be careful as this will delete all the ideas related to it as well!</p>
                    </section> */}


{/* <h1 className="header">Welcome to<br />Intraconnected</h1><br />
                    <p className="details">Intraconnected is like a visual canvas for your ideas. <br /><br />

                        Everything starts with a root idea, from there you can build and explore related ideas as a growing network. Click to dive into any idea and make it the new root. <br /><br />

                        It's all about building connections that you can explore intuitively, not just keeping track of scattered notes.
                    </p> */}



{/* <p className="details">Intraconnected is pretty simple. You're looking at the root node
                    <span className="detailsBox roots"> {rootName} </span><br />
                    You can create a related idea by clicking <span className="detailsBox leaf square"><img src="/images/Plus.svg" alt="" className="detailsImg" /></span><br />

                    Clicking any idea will turn it into the new root node. You can navigate back to the previous root node by clicking <span className="detailsBox backColor">Back</span> <br />

                    Oh, you can also delete ideas by clicking and dragging them in to the <span className="detailsBox danger square"><img src="/images/Trash.svg" alt="" className="detailsImg" /></span><br />


                </p> */}