import React from 'react';

const HelpMenuFive: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">Staying Oriented</h1>
            <p className="subHeader">Where you are and what's new</p>
            <section className="helpGrid">
                <div className="helpGridIcon helpRoot">Ideas ›</div>
                <p className="details">
                    The <strong>breadcrumb</strong> above the title shows the path to where you are. Click any step to jump back to it. Refreshing the page keeps your place.
                </p>
                <button className="smallSideButton neutral neobrutal-button navButton" type="button" tabIndex={-1}>
                    <img src="/images/PatchNotesIconSkinny.svg" alt="Patch notes" className="buttonImg" />
                </button>
                <p className="details">
                    <strong>Patch Notes</strong> lists new features and changes. Want a feature? Suggest it from there!
                </p>
            </section>
        </section>
    );
};

export default HelpMenuFive;
