import React from 'react';
import ColorName from './ColorName';

const HelpMenuOne: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">The Nitty Gritty</h1>
            <p className="subHeader">What each color means</p>
            <section className="helpGrid">
                <div className="helpGridIcon helpLeaf">Leaf</div><p className="details"><ColorName token="nodeLeaf" cap /> ideas have nothing inside them yet. Click one to open it and start adding related ideas.</p>
                <div className="helpGridIcon helpParent">Parent</div><p className="details"><ColorName token="nodeParent" cap /> ideas already have other ideas inside them. Click one to open it and see what's in there.</p>
                <div className="helpGridIcon helpChecklist">Checklist</div><p className="details"><ColorName token="nodeChecklist" cap /> cards are to-do lists. Add items and tick them off as you go. A checklist can't hold other ideas.</p>
                <div className="helpGridIcon helpLink">Link</div><p className="details"><ColorName token="nodeLink" cap /> ideas open a web page when you click them. Add the address with the 'Add Link' button. A link can't hold other ideas.</p>
                <div className="helpGridIcon helpNote">Note</div><p className="details"><ColorName token="nodeNote" cap /> cards are notes: a title plus space for longer writing. A note can't hold other ideas.</p>
                <div className="helpGridIcon helpVault">Vault</div><p className="details"><ColorName token="nodeVault" cap /> cards are vault notes, for passwords and other secrets. They are locked with a passphrase only you know. Set it up in Profile, under Vault.</p>
            </section>
        </section>
    );
};

export default HelpMenuOne;
