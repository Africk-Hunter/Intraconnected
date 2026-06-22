import React from 'react';

const HelpMenuOne: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">The Nitty Gritty</h1>
            <p className="subHeader">Some core ideas that may be helpful for new users</p>
            <br />
            <section className="helpGrid">
                <div className="helpGridIcon helpLeaf">Leaf</div><p className="details">If an idea is green, that means its a leaf. Leaves have no related ideas currently, but you can always change that by clicking into them and creating some!</p>
                <div className="helpGridIcon helpParent">Parent</div><p className="details">Blue ideas are called parents. Aptly so, as parent ideas have other ideas related to them which can be viewed by clicking on the parent idea.</p>
                <div className="helpGridIcon helpChecklist">Checklist</div><p className="details">Indigo nodes are check lists. Click the header to open the full check list view, or manage items directly on the card. Check lists cannot have child ideas.</p>
                <div className="helpGridIcon helpLink">Link</div><p className="details">Finally, we have Link Ideas. Links are just that: links to other web pages. When creating an idea, just embed a link using the 'Add Link' button. Remember though, link ideas cannot become parent nodes!</p>
            </section>
        </section>
    );
};

export default HelpMenuOne;