import React from 'react';

interface NavbarProps {
    setModalOpen: (open: boolean) => void;
}   

const Navbar: React.FC<NavbarProps> = ({ setModalOpen }) => {
    return (
        <nav className="navbar">
            <button className="logoButton neobrutal-button navButton"><img src="/images/Logo.svg" alt="" className="logoImg" /></button>
            <button className="createIdea neobrutal-button navButton" onClick={() => setModalOpen(true)}><img src="/images/Plus.svg" alt="Create new idea" className="navImg" /></button>
            <button className="help neobrutal-button navButton"><img src="/images/QuestionMark.svg" alt="Help" className="navImg" /></button>
        </nav>
    );
};

export default Navbar;