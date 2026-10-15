import React from 'react';

const HelpMenuOne: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">The Nitty Gritty</h1>
            <p className="subHeader">What each color means</p>
            <section className="helpGrid">
                <div className="helpGridIcon helpLeaf">Leaf</div><p className="details">Green ideas have nothing inside them yet. Click one to open it and start adding related ideas.</p>
                <div className="helpGridIcon helpParent">Parent</div><p className="details">Blue ideas already have other ideas inside them. Click one to open it and see what's in there.</p>
                <div className="helpGridIcon helpChecklist">Checklist</div><p className="details">Indigo cards are to-do lists. Add items and tick them off as you go. A checklist can't hold other ideas.</p>
                <div className="helpGridIcon helpLink">Link</div><p className="details">Yellow ideas open a web page when you click them. Add the address with the 'Add Link' button. A link can't hold other ideas.</p>
                <div className="helpGridIcon helpNote">Note</div><p className="details">Dark green cards are notes: a title plus space for longer writing. A note can't hold other ideas.</p>
                <div className="helpGridIcon helpVault">Vault</div><p className="details">Slate cards are vault notes, for passwords and other secrets. They are locked with a passphrase only you know. Set it up in Profile, under Vault.</p>
            </section>
        </section>
    );
};

export default HelpMenuOne;
