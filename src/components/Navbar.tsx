import React from 'react';
import { useIdeaContext } from '../context/IdeaContext';
import { returnToRoot } from '../utilities/independentIdeaHandlers';


const Navbar: React.FC = () => {
    
    const { setRootId, setRootName, rootIdStack, setModalOpen } = useIdeaContext();

    return (
        <nav className="navbar">
            <button className="logoButton neobrutal-button navButton" onClick={() => returnToRoot( {setRootId, setRootName, rootIdStack} )}><img src="/images/Logo.svg" alt="" className="logoImg" /></button>
            <button className="createIdea neobrutal-button navButton" onClick={() => setModalOpen(true)}><img src="/images/Plus.svg" alt="Create new idea" className="navImg" /></button>
            <button className="help neobrutal-button navButton"><img src="/images/QuestionMark.svg" alt="Help" className="navImg" /></button>
        </nav>
    );
};

export default Navbar;