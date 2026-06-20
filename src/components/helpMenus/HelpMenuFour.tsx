import React from 'react';

const HelpMenuFour: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">The Mind Map</h1>
            <p className="subHeader">A bird's-eye view of your entire idea tree</p>
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
                            <button className="mm-node-btn mm-node-btn--link" style={{ pointerEvents: 'none' }}>Docs ↗</button>
                        </div>
                    </div>
                </div>
            </div>
            <p className="details">
                Click the <span className="detailsBox help-logo-chip"><img src="/images/Logo.svg" alt="logo" className="help-logo-img" /></span> button to open the Mind Map overlay. Drag to pan, scroll to zoom, click any node to jump there instantly. The <span className="detailsBox help-mm-current-chip">brown node</span> marks where you currently are.
            </p>
        </section>
    );
};

export default HelpMenuFour;
