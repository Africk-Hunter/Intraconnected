import React, { JSX, useEffect, useState } from 'react';
import DepthIndicator from './DepthIndicator';
import TooltipButton from './TooltipButton';
import { useIdeaContext } from '../context/IdeaContext';
import { getNameFromID } from '../utilities/index';


interface NavbarProps {
    side: string;
    signUserOut: () => void;
    setShowHelp: () => void;
    setShowPatchNotes: () => void;
    setShowMindMap: React.Dispatch<React.SetStateAction<boolean>>;
    showMindMap: boolean;
    isNewPatchNotes?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ side, signUserOut, setShowHelp, setShowPatchNotes, setShowMindMap, showMindMap, isNewPatchNotes }) => {

    const { rootIdStack, setCreationModalOpen, rootId } = useIdeaContext();

    const [depthElements, setDepthElements] = useState<JSX.Element[]>([]);


    useEffect(() => {
        const updatedDepthElements: JSX.Element[] = rootIdStack.current.map((id, i) => (
            <DepthIndicator key={i} index={i} rootId={id} rootName={getNameFromID(id)}/>
        ));

        setDepthElements(updatedDepthElements);
    }, [rootIdStack.current.length, rootId]);

    return (
        <>
            {side === 'right' ?

                <nav className="navbar rightSide">
                    <section className="rightSideButtons">
                        <TooltipButton tooltip="Log out" tooltipSide="left" className="mediumSideButton neutral neobrutal-button navButton" onClick={() => signUserOut()}><img src="/images/LogOut.svg" alt="" className="buttonImg" /></TooltipButton>
                        <TooltipButton tooltip="Help & instructions" tooltipSide="left" className="smallSideButton neutral neobrutal-button navButton" onClick={setShowHelp}><img src="/images/QuestionMark.svg" alt="Help" className="buttonImg" /></TooltipButton>
                        <TooltipButton tooltip="Patch notes" tooltipSide="left" alwaysVisible={isNewPatchNotes} className="smallSideButton neutral neobrutal-button navButton patchNotesBtn" onClick={setShowPatchNotes}><img src="/images/PatchNotesIcon.svg" alt="Patch notes" className="buttonImg" /></TooltipButton>
                    </section>
                    {!showMindMap && <section className="howDeepHolder">{depthElements}</section>}
                </nav>

                :

                <nav className="navbar">
                    <div className={showMindMap ? 'logo-map-box' : ''}>
                        <TooltipButton tooltip="Toggle mind map" tooltipSide="right" className="largeSideButton neutral neobrutal-button navButton" onClick={() => setShowMindMap(prev => !prev)}><img src="/images/Logo.svg" alt="" className="buttonImg logoButton" /></TooltipButton>
                    </div>
                    {!showMindMap && <TooltipButton tooltip="Create new idea" tooltipSide="right" className="mediumSideButton leaf neobrutal-button navButton" onClick={() => setCreationModalOpen(true)}><img src="/images/Plus.svg" alt="Create new idea" className="buttonImg" /></TooltipButton>}
                </nav>
            }
        </>
    );
};

export default Navbar;
