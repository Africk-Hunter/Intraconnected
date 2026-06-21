import React from 'react';

const HelpMenuFive: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">Staying Oriented</h1>
            <p className="subHeader">Navigation history and what's new</p>
            <section className="helpGrid">
                <div className="help-depth-dots">
                    <div className="help-depth-dot"></div>
                    <div className="help-depth-dot"></div>
                    <div className="help-depth-dot"></div>
                </div>
                <p className="details">
                    <strong>Depth dots</strong>, in the right sidebar, appear as you navigate deeper. Each dot is one level. Hover to see the name of the idea, then click to jump back to that level instantly.
                </p>
                <button className="smallSideButton neutral neobrutal-button navButton" type="button" tabIndex={-1}>
                    <img src="/images/PatchNotesIconSkinny.svg" alt="Patch notes" className="buttonImg" />
                </button>
                <p className="details">
                    The <strong>Patch Notes</strong> are a running log of new features and changes. Want to see a new feature? Recommend it using the button in the patch notes!
                </p>
            </section>
        </section>
    );
};

export default HelpMenuFive;
