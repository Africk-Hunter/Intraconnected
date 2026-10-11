import React from 'react';
import { LinkOutIcon } from '../Icons';

const HelpMenuFour: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">The Mind Map</h1>
            <p className="subHeader">See all your ideas at once</p>
            <div className="help-mm-demo">
                <div className="mm-node-col">
                    <button className="mm-node-btn mm-node-btn--current" style={{ pointerEvents: 'none' }}>My Ideas</button>
                    <div className="mm-connector-v"></div>
                    <div className="mm-children-row">
                        <div className="mm-child-wrap">
                            <div className="mm-node-col">
                                <button className="mm-node-btn mm-node-btn--parent" style={{ pointerEvents: 'none' }}>Work</button>
                                <div className="mm-connector-v"></div>
                                <div className="mm-children-row">
                                    <div className="mm-child-wrap">
                                        <button className="mm-node-btn mm-node-btn--leaf" style={{ pointerEvents: 'none' }}>Task A</button>
                                    </div>
                                    <div className="mm-child-wrap">
                                        <button className="mm-node-btn mm-node-btn--leaf" style={{ pointerEvents: 'none' }}>Task B</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mm-child-wrap">
                            <button className="mm-node-btn mm-node-btn--leaf" style={{ pointerEvents: 'none' }}>Home</button>
                        </div>
                        <div className="mm-child-wrap">
                            <button className="mm-node-btn mm-node-btn--link" style={{ pointerEvents: 'none' }}>Docs <LinkOutIcon /></button>
                        </div>
                    </div>
                </div>
            </div>
            <p className="details">
                Open it with <strong>G</strong> or the <span className="detailsBox help-logo-chip"><img src="/images/MindMapBlack.svg" alt="mind map" className="help-logo-img" /></span> button next to the breadcrumb. Click any idea to jump to it, or drag one onto another to move it. The <span className="detailsBox help-mm-current-chip">brown node</span> is where you are now.
            </p>
            <p className="details">
                <strong>Priority</strong> (P) and <strong>Newest</strong> (N) show only ideas with a priority, or ideas added in the last 30 days.
            </p>
        </section>
    );
};

export default HelpMenuFour;
