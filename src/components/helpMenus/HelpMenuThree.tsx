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
                <div className="helpGridIcon helpLink">Link</div><p className="details">Finally, we have Link Ideas. Links are just that - links to other web pages. When creating an idea, just embed a link using the chain icon. Remember though link ideas cannot become parent nodes!</p>
            </section>
        </section>
    );
};

export default HelpMenuOne;