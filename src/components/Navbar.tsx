import React from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { returnToRoot } from '../utilities/index';


interface NavbarProps {
    side: string;
    signUserOut: () => void;
    setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
}

const Navbar: React.FC<NavbarProps> = ({side, signUserOut, setShowHelp}) => {

    const { setRootId, setRootName, rootIdStack, setCreationModalOpen } = useIdeaContext();

    return (
        <>
            {side == 'right' ?

                <nav className="navbar rightSide">
                    <button className="mediumSideButton neutral neobrutal-button navButton" onClick={() => signUserOut()}><img src="/images/LogOut.svg" alt="" className="buttonImg" /></button>
                    <button className="smallSideButton neutral neobrutal-button navButton" onClick={() => setShowHelp((prev: boolean) => !prev)}><img src="/images/QuestionMark.svg" alt="Help" className="buttonImg" /></button>
                </nav>

                :

                <nav className="navbar">
                    <button className="largeSideButton neutral neobrutal-button navButton" onClick={() => returnToRoot({ setRootId, setRootName, rootIdStack })}><img src="/images/Logo.svg" alt="" className="buttonImg logoButton" /></button>
                    <button className="mediumSideButton leaf neobrutal-button navButton" onClick={() => setCreationModalOpen(true)}><img src="/images/Plus.svg" alt="Create new idea" className="buttonImg" /></button>
                </nav>
            }
        </>
    );
};

export default Navbar;