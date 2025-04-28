import React from 'react';
import { useIdeaContext } from '../context/IdeaContext';

interface HelpProps {
    showHelp: boolean;
}

const Help: React.FC<HelpProps> = ({ showHelp }) => {

    const { rootName } = useIdeaContext();

    return (
        <>
            <section className={`howToUsePopup neutral ${showHelp ? 'show' : ''}`}>
                <h1 className="header">So How Do I Use <br />This?</h1>
                <p className="details">Intraconnected is pretty simple. You're looking at the root node
                    <span className="detailsBox roots"> {rootName} </span><br />
                    You can create a related idea by clicking <span className="detailsBox leaf square"><img src="/images/Plus.svg" alt="" className="detailsImg" /></span><br />

                    Clicking any idea will turn it into the new root node. You can navigate back to the previous root node by clicking <span className="detailsBox backColor">Back</span> <br />

                    Oh, you can also delete ideas by clicking and dragging them in to the <span className="detailsBox danger square"><img src="/images/Trash.svg" alt="" className="detailsImg" /></span><br />


                </p>
            </section>
        </>
    );
};

export default Help;