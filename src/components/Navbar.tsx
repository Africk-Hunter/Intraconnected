import React from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { returnToRoot } from '../utilities/independentIdeaHandlers';


const Navbar: React.FC = () => {
    
    const { setRootId, setRootName, rootIdStack, setModalOpen } = useIdeaContext();

    return (
        <nav className="navbar">
            <button className="largeSideButton neutral neobrutal-button navButton" onClick={() => returnToRoot( {setRootId, setRootName, rootIdStack} )}><img src="/images/Logo.svg" alt="" className="logoImg" /></button>
            <button className="mediumSideButton leaf neobrutal-button navButton" onClick={() => setModalOpen(true)}><img src="/images/Plus.svg" alt="Create new idea" className="navImg" /></button>
        </nav>
    );
};

export default Navbar;