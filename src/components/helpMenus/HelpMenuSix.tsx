import React from 'react';

const HelpMenuSix: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">Priority &amp; Sorting</h1>
            <p className="subHeader">Put your most important ideas first</p>

            <div className="help-priority-demo">
                {/* Left: ribbon cycling */}
                <div className="help-rib-demo">
                    <div className="help-rib-card">
                        <div className="help-rib-anim" />
                        <span className="help-rib-card-text">Idea</span>
                    </div>
                    <span className="help-rib-caption">Corner ribbon</span>
                </div>

                {/* Right: sort reorder animation */}
                <div className="help-sort-stage-group">
                    <div className="help-sort-stage">
                        <div className="help-sort-card help-sort-card--tasks">
                            <span>Tasks</span>
                        </div>
                        <div className="help-sort-card help-sort-card--notes">
                            <div className="help-sort-ribbon help-sort-ribbon--p2" />
                            <span>Notes</span>
                        </div>
                        <div className="help-sort-card help-sort-card--alerts">
                            <div className="help-sort-ribbon help-sort-ribbon--p1" />
                            <span>Alerts</span>
                        </div>
                    </div>
                    <div className="help-sort-stage-labels">
                        <span className="help-sort-stage-label help-sort-stage-label--age">Age order</span>
                        <span className="help-sort-stage-label help-sort-stage-label--prio">Priority order</span>
                    </div>
                </div>
            </div>

            <section className="helpGrid">
                <div className="helpGridIcon help-chip-prio-anim">
                    <span className="help-chip-lbl-ghost" aria-hidden>P1</span>
                    <span className="help-chip-lbl help-chip-lbl--p0">P0</span>
                    <span className="help-chip-lbl help-chip-lbl--p1">P1</span>
                    <span className="help-chip-lbl help-chip-lbl--p2">P2</span>
                    <span className="help-chip-lbl help-chip-lbl--p3">P3</span>
                </div>
                <p className="details">
                    Each idea has a <strong>priority ribbon</strong> in its top-left corner. Click it to cycle: <strong>High (red)</strong>, <strong>Medium (orange)</strong>, <strong>Low (yellow)</strong>, then none. The ribbon height shows urgency at a glance.
                </p>
                <div className="helpGridIcon helpSort">
                    <img src="/images/sort.svg" className="helpSortImg" alt="" />
                    Sort
                </div>
                <p className="details">
                    The <strong>Sort</strong> button below Back reorders your ideas by priority: P1 first, then P2, P3, then unprioritized. Toggle it to sort by <strong>Age</strong> (creation order) instead.
                </p>
            </section>
        </section>
    );
};

export default HelpMenuSix;
