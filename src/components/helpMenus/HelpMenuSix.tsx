import React from 'react';
import ColorName from './ColorName';

const HelpMenuSix: React.FC = () => {
    return (
        <section className="textSection">
            <h1 className="header">Priority &amp; Sorting</h1>
            <p className="subHeader">Put your most important ideas first</p>

            <div className="help-priority-demo">
                {/* Left: the ribbon growing through the levels */}
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
                    Mark how important an idea is with the <strong>ribbon</strong> in its top-left corner: <strong>High (<ColorName token="prioHigh" />)</strong>, <strong>Medium (<ColorName token="prioMedium" />)</strong> or <strong>Low (<ColorName token="prioLow" />)</strong>. The more important, the longer the ribbon.
                </p>
                <div className="helpGridIcon helpSort">
                    <img src="/images/sort.svg" className="helpSortImg" alt="" />
                    Sort
                </div>
                <p className="details">
                    The <strong>Sort</strong> button below Back puts the most important ideas first. Click again to go back to <strong>Oldest</strong> first.
                </p>
            </section>
        </section>
    );
};

export default HelpMenuSix;
