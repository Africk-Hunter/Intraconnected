import { useState } from 'react';

const STORAGE_KEY = 'onboarding_v1_seen';

function OnboardingModal() {
    const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'true');

    if (!open) return null;

    function dismiss() {
        localStorage.setItem(STORAGE_KEY, 'true');
        setOpen(false);
    }

    return (
        <section className="overlay" onClick={dismiss}>
            <div className="modal neobrutal onboarding-modal" onClick={e => e.stopPropagation()}>

                <h2 className="onboarding-title">
                    Welcome to<br />
                    <span className="onboarding-title__intra">Intra</span><span className="onboarding-title__connected">connected.</span>
                </h2>

                <div className="onboarding-tips">

                    <div className="onboarding-tip onboarding-tip--1">
                        <span className="onboarding-tip__num">1</span>
                        <p className="onboarding-tip__text">
                            Your ideas form a <strong>tree</strong>. This grid shows the children of whatever idea you're currently inside.
                        </p>
                        <div className="oa oa--tree">
                            <div className="oa-tree-root" />
                            <div className="oa-tree-trunk" />
                            <div className="oa-tree-children">
                                <div className="oa-tree-child oa-tree-child--1" />
                                <div className="oa-tree-child oa-tree-child--2" />
                            </div>
                        </div>
                    </div>

                    <div className="onboarding-tip onboarding-tip--2">
                        <span className="onboarding-tip__num">2</span>
                        <p className="onboarding-tip__text">
                            <strong>Click any card</strong> to go deeper. Hit <strong>Back</strong> to go up a level.
                        </p>
                        <div className="oa oa--nav">
                            <div className="oa-nav-card">
                                <div className="oa-nav-line" />
                                <div className="oa-nav-line oa-nav-line--sm" />
                            </div>
                            <div className="oa-nav-cursor" />
                        </div>
                    </div>

                    <div className="onboarding-tip onboarding-tip--3">
                        <span className="onboarding-tip__num">3</span>
                        <p className="onboarding-tip__text oa-tip-text--drag">
                            <strong>Drag</strong> a card onto another to nest it, or onto the trash to delete.
                        </p>
                        <p className="onboarding-tip__text oa-tip-text--lp">
                            <strong>Long-press</strong> any card to rename, move, or delete it.
                        </p>
                        <div className="oa oa--drag">
                            <div className="oa-drag-card" />
                            <div className="oa-drag-target" />
                        </div>
                        <div className="oa oa--lp">
                            <div className="oa-lp-card">
                                <div className="oa-lp-ring oa-lp-ring--1" />
                                <div className="oa-lp-ring oa-lp-ring--2" />
                            </div>
                        </div>
                    </div>

                </div>

                <section className="modalButtons" style={{ justifyContent: 'center' }}>
                    <button className="modalButton continue neobrutal-button onboarding-cta" onClick={dismiss}>
                        Let's go!
                    </button>
                </section>
            </div>
        </section>
    );
}

export default OnboardingModal;
