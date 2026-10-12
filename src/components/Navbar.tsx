import React from 'react';
import TooltipButton from './TooltipButton';
import { useIdeaContext } from '../context/IdeaContext';
import { canCreateIdea } from '../utilities/index';


const SEARCH_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘F' : 'Ctrl+F';

interface NavbarProps {
    side: string;
    setShowHelp: () => void;
    showHelp: boolean;
    setShowPatchNotes: () => void;
    showPatchNotes: boolean;
    showMindMap: boolean;
    isNewPatchNotes?: boolean;
    hasNewHelp?: boolean;
    onSearch: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ side, setShowHelp, showHelp, setShowPatchNotes, showPatchNotes, showMindMap, isNewPatchNotes, hasNewHelp, onSearch }) => {

    const { setCreationModalOpen, rootId, navigateToId, profileModalOpen, setProfileModalOpen, setUpgradeModalOpen, setUpgradeModalReason } = useIdeaContext();

    function handleCreateClick() {
        if (canCreateIdea()) {
            setCreationModalOpen(true);
        } else {
            setUpgradeModalReason('limit');
            setUpgradeModalOpen(true);
        }
    }


    return (
        <>
            {side === 'right' ?

                <nav className="navbar rightSide">
                    <section className="rightSideButtons">
                        <TooltipButton tooltip="Profile" tooltipSide="left" className={`mediumSideButton neobrutal-button navButton${profileModalOpen ? ' navButton--active' : ' neutral'}`} onClick={() => setProfileModalOpen(true)}><img src="/images/Profile.svg" alt="" className="buttonImg" /></TooltipButton>
                        <TooltipButton tooltip="Help & instructions" shortcut="?" tooltipSide="left" wrapperClassName={hasNewHelp ? 'tooltip-wrapper--badged' : ''} className={`smallSideButton neobrutal-button navButton${showHelp ? ' navButton--active' : ' neutral'}`} onClick={setShowHelp}><img src="/images/QuestionMark.svg" alt="Help" className="buttonImg" /></TooltipButton>
                        <TooltipButton tooltip="Patch notes" tooltipSide="left" alwaysVisible={isNewPatchNotes} className={`smallSideButton neobrutal-button navButton patchNotesBtn${showPatchNotes ? ' navButton--active' : ' neutral'}`} onClick={setShowPatchNotes}><img src="/images/PatchNotesIconSkinny.svg" alt="Patch notes" className="buttonImg" /></TooltipButton>
                    </section>
                </nav>

                :

                <nav className="navbar">
                    <TooltipButton tooltip="Create new idea" shortcut="C" tooltipSide="right" wrapperClassName={showMindMap ? 'nav-btn--hidden' : ''} className="largeSideButton leaf neobrutal-button navButton" onClick={handleCreateClick}><img src="/images/Plus.svg" alt="Create new idea" className="buttonImg buttonImg--large" /></TooltipButton>
                    <TooltipButton tooltip="Return to root" tooltipSide="right" wrapperClassName={`nav-btn--return-root${rootId === 1 ? ' nav-btn--at-root' : ''}${showMindMap ? ' nav-btn--hidden' : ''}`} className="medLargeSideButton burnt-orange neobrutal-button navButton" onClick={rootId === 1 ? undefined : () => navigateToId(1)}><img src="/images/Home.svg" alt="Return to root" className="buttonImg buttonImg--boost" /></TooltipButton>
                    <TooltipButton tooltip="Search ideas" shortcut={SEARCH_KEY} tooltipSide="right" className="mediumSideButton neutral neobrutal-button navButton" onClick={onSearch}>
                        <svg className="buttonImg" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /></svg>
                    </TooltipButton>
                </nav>
            }
        </>
    );
};

export default Navbar;
