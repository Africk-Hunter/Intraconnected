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
                    These <strong>depth dots</strong> in the right sidebar appear as you navigate deeper. Each dot is one level. Hover to see the name, then click to jump back to that level instantly.
                </p>
                <div className="helpGridIcon help-patchnotes-icon">
                    <img src="/images/PatchNotesIcon.svg" alt="Patch notes" className="helpImg" />
                </div>
                <p className="details">
                    This button in the top-right opens <strong>Patch Notes</strong>, a running log of new features and changes. Worth checking after any update!
                </p>
            </section>
        </section>
    );
};

export default HelpMenuFive;
