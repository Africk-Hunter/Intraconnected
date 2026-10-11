import React from 'react';
import HelpTreeAnim from './HelpTreeAnim';

const HelpMenuOne: React.FC = () => {
    return (
        <section className="textSection">
            <div className="help-one-title-row">
                <h1 className="header">
                    Welcome to<br />
                    Intraconnected
                </h1>
                <HelpTreeAnim />
            </div>
            <p className="details">
                Intraconnected is like a visual canvas for your ideas.
            </p>
            <p className="details">
                Start with one big idea, then add smaller ideas inside it. Click any idea to open it and add more inside.
            </p>
            <p className="details">
                Related ideas stay connected, so they're easy to find again.
            </p>
        </section>
    );
};

export default HelpMenuOne;