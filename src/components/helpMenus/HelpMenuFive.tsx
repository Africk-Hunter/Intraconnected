import React from 'react';

const HelpMenuFive: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">Staying Oriented</h1>
            <p className="subHeader">Where you are and what's new</p>
            <section className="helpGrid">
                <div className="helpGridIcon helpRoot">Ideas ›</div>
                <p className="details">
                    The <strong>breadcrumb</strong> above the title lists the ideas you are inside, from the top down. Click any of them to jump straight back to that level. The address bar follows along too, so Back, refresh and copied links all keep your place.
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
