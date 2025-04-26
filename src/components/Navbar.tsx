import React from 'react';
import { addIdeaToFirebase } from '../utilities/firebaseHelpers';

const idea = { id: Date.now(), content: 'Test', parentID: 1 }

const Navbar: React.FC = () => {
    return (
        <nav className="navbar">
            <button className="logoButton neobrutal-button navButton"><img src="/images/Logo.svg" alt="" className="logoImg" /></button>
            <button className="createIdea neobrutal-button navButton" onClick={() => addIdeaToFirebase(idea)}><img src="/images/Plus.svg" alt="Create new idea" className="navImg" /></button>
            <button className="help neobrutal-button navButton"><img src="/images/QuestionMark.svg" alt="Help" className="navImg" /></button>
        </nav>
    );
};

export default Navbar;