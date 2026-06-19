import React, { JSX, useEffect, useState } from 'react';
import DepthIndicator from './DepthIndicator';
import { useIdeaContext } from '../context/IdeaContext';
import { getNameFromID } from '../utilities/index';


interface NavbarProps {
    side: string;
    signUserOut: () => void;
    setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
    setShowMindMap: React.Dispatch<React.SetStateAction<boolean>>;
    showMindMap: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ side, signUserOut, setShowHelp, setShowMindMap, showMindMap }) => {

    const { rootIdStack, setCreationModalOpen } = useIdeaContext();

    const [depthElements, setDepthElements] = useState<JSX.Element[]>([]);


    useEffect(() => {
        const updatedDepthElements: JSX.Element[] = rootIdStack.current.map((id, i) => (
            <DepthIndicator key={i} index={i} rootId={id} rootName={getNameFromID(id)}/>
        ));

        setDepthElements(updatedDepthElements);
    }, [rootIdStack.current.length]);

    return (
        <>
            {side == 'right' ?

                <nav className="navbar rightSide">
                    <section className="rightSideButtons">
                        <button className="mediumSideButton neutral neobrutal-button navButton" onClick={() => signUserOut()}><img src="/images/LogOut.svg" alt="" className="buttonImg" /></button>
                        <button className="smallSideButton neutral neobrutal-button navButton" onClick={() => setShowHelp((prev: boolean) => !prev)}><img src="/images/QuestionMark.svg" alt="Help" className="buttonImg" /></button>
                    </section>
                    {!showMindMap && <section className="howDeepHolder">{depthElements}</section>}
                </nav>

                :

                <nav className="navbar">
                    <div className={showMindMap ? 'logo-map-box' : ''}>
                        <button className="largeSideButton neutral neobrutal-button navButton" onClick={() => setShowMindMap(prev => !prev)}><img src="/images/Logo.svg" alt="" className="buttonImg logoButton" /></button>
                    </div>
                    {!showMindMap && <button className="mediumSideButton leaf neobrutal-button navButton" onClick={() => setCreationModalOpen(true)}><img src="/images/Plus.svg" alt="Create new idea" className="buttonImg" /></button>}
                </nav>
            }
        </>
    );
};

export default Navbar;