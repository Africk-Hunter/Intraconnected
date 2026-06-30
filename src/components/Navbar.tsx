import React, { JSX, useEffect, useState } from 'react';
import DepthIndicator from './DepthIndicator';
import TooltipButton from './TooltipButton';
import { useIdeaContext } from '../context/IdeaContext';
import { getNameFromID } from '../utilities/index';
import { returnToRoot } from '../utilities/idea/helpers';


interface NavbarProps {
    side: string;
    signUserOut: () => void;
    setShowHelp: () => void;
    showHelp: boolean;
    setShowPatchNotes: () => void;
    showPatchNotes: boolean;
    setShowMindMap: React.Dispatch<React.SetStateAction<boolean>>;
    showMindMap: boolean;
    isNewPatchNotes?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ side, signUserOut, setShowHelp, showHelp, setShowPatchNotes, showPatchNotes, setShowMindMap, showMindMap, isNewPatchNotes }) => {

    const { rootIdStack, setCreationModalOpen, rootId, setRootId, setRootName, setNodesVisible } = useIdeaContext();

    function handleReturnToRootWithFade() {
        setNodesVisible(false);
        setTimeout(() => {
            returnToRoot({ setRootId, setRootName, rootIdStack });
        }, 65);
        setTimeout(() => setNodesVisible(true), 90);
    }


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
                        <TooltipButton tooltip="Help & instructions" tooltipSide="left" className={`smallSideButton neobrutal-button navButton${showHelp ? ' navButton--active' : ' neutral'}`} onClick={setShowHelp}><img src="/images/QuestionMark.svg" alt="Help" className="buttonImg" /></TooltipButton>
                        <TooltipButton tooltip="Patch notes" tooltipSide="left" alwaysVisible={isNewPatchNotes} className={`smallSideButton neobrutal-button navButton patchNotesBtn${showPatchNotes ? ' navButton--active' : ' neutral'}`} onClick={setShowPatchNotes}><img src="/images/PatchNotesIconSkinny.svg" alt="Patch notes" className="buttonImg" /></TooltipButton>
                    </section>
                    <section className={`howDeepHolder${showMindMap ? ' howDeepHolder--hidden' : ''}`}>{depthElements}</section>
                </nav>

                :

                <nav className="navbar">
                    <TooltipButton tooltip="Create new idea" tooltipSide="right" wrapperClassName={showMindMap ? 'nav-btn--hidden' : ''} className="largeSideButton leaf neobrutal-button navButton" onClick={() => setCreationModalOpen(true)}><img src="/images/Plus.svg" alt="Create new idea" className="buttonImg buttonImg--large" /></TooltipButton>
                    <TooltipButton tooltip="Return to root" tooltipSide="right" wrapperClassName={`nav-btn--return-root${rootId === 1 ? ' nav-btn--at-root' : ''}${showMindMap ? ' nav-btn--hidden' : ''}`} className="medLargeSideButton burnt-orange neobrutal-button navButton" onClick={rootId === 1 ? undefined : handleReturnToRootWithFade}><img src="/images/Home.svg" alt="Return to root" className="buttonImg buttonImg--boost" /></TooltipButton>
                    <div className={`nav-btn-group${showMindMap ? ' nav-btn-group--active' : ''}`}>
                        <TooltipButton tooltip="Toggle mind map" tooltipSide="right" className="mediumSideButton neo-pink neobrutal-button navButton" onClick={() => setShowMindMap(prev => !prev)}><img src="/images/MindMapBlack.svg" alt="" className="buttonImg logoButton" /></TooltipButton>
                    </div>
                </nav>
            }
        </>
    );
};

export default Navbar;
