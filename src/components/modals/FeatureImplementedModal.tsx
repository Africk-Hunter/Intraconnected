import React, { useEffect, useRef } from 'react';
import { launchConfetti } from '../../utilities/confetti';
import { RaysBackdrop, Sparkles } from './UpgradeCelebrationModal';

interface Props {
    titles: string[];
    onClose: () => void;
}

// A leaf node (same green, 4px black border and hard shadow as .ideaNode)
// cheering, with a gold star over its head. Colors mirror $leaf / $deep-yellow / $link.
const ShippedNode: React.FC = () => (
    <svg
        className="crowned-node"
        viewBox="0 0 120 112"
        width="112"
        height="104"
        aria-hidden="true"
        strokeLinejoin="round"
        strokeLinecap="round"
    >
        <rect x="23" y="56" width="80" height="50" rx="8" fill="#000" />
        <rect x="18" y="51" width="80" height="50" rx="8" fill="#41BC28" stroke="#000" strokeWidth="4" />
        <path d="M37 72 Q44 64 51 72" fill="none" stroke="#000" strokeWidth="4" />
        <path d="M65 72 Q72 64 79 72" fill="none" stroke="#000" strokeWidth="4" />
        <path d="M46 83 Q58 98 70 83 Z" fill="#000" stroke="#000" strokeWidth="3" />
        <path d="M18 70 L6 54" fill="none" stroke="#000" strokeWidth="4" />
        <path d="M98 70 L110 54" fill="none" stroke="#000" strokeWidth="4" />
        <g className="feature-impl-star">
            <path
                d="M58 6 L63 19 L77 20 L66 29 L70 43 L58 35 L46 43 L50 29 L39 20 L53 19 Z"
                fill="#E8E879"
                stroke="#000"
                strokeWidth="4"
            />
        </g>
    </svg>
);

// Same confetti show and badge sound as the upgrade celebration, for the moment
// someone opens the app after a feature they asked for has shipped.
const FeatureImplementedModal: React.FC<Props> = ({ titles, onClose }) => {
    const launchedRef = useRef(false);

    useEffect(() => {
        const audio = new Audio('/sounds/roblox-badge.mp3');
        audio.volume = 0.7;
        const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;

        const stopListening = () => {
            GESTURES.forEach(type => document.removeEventListener(type, tryPlay, true));
        };
        const tryPlay = () => {
            audio.play().then(stopListening).catch(() => {});
        };

        audio.play().catch(() => {
            // Autoplay blocked: play on the first tap/click/key (e.g. "Sweet!")
            GESTURES.forEach(type => document.addEventListener(type, tryPlay, true));
        });

        // The ref guard stops StrictMode's dev double-mount from firing it twice.
        if (!launchedRef.current) {
            launchedRef.current = true;
            launchConfetti();
        }

        return stopListening;
    }, []);

    const single = titles.length === 1;

    return (
        <section className="overlay upgrade-celebration-overlay" onClick={onClose}>
            <div
                className="modal neobrutal confirmModal upgrade-celebration-modal upgrade-celebration-modal--feature"
                role="dialog"
                aria-modal="true"
                aria-labelledby="feature-impl-title"
                onClick={e => e.stopPropagation()}
            >
                <div className="upgrade-celebration-hero">
                    <div className="upgrade-celebration-backdrop">
                        <RaysBackdrop />
                        <Sparkles />
                    </div>
                    <div className="upgrade-celebration-icon"><ShippedNode /></div>
                    <span className="upgrade-celebration-sticker">Shipped</span>
                </div>
                <div className="upgrade-celebration-body">
                    <h2 className="upgrade-celebration-title" id="feature-impl-title">
                        {single ? 'Your idea shipped!' : `${titles.length} of your ideas shipped!`}
                    </h2>
                    {single ? (
                        <p className="feature-impl-name">{titles[0]}</p>
                    ) : (
                        <ul className="feature-impl-list">
                            {titles.map((title, i) => (
                                <li key={i} className="feature-impl-name">{title}</li>
                            ))}
                        </ul>
                    )}
                    <p className="upgrade-celebration-subtitle">
                        {single
                            ? 'You asked for it and now it exists. Thanks for helping build Intraconnected!'
                            : 'You asked for them and now they exist. Thanks for helping build Intraconnected!'}
                    </p>
                    <section className="modalButtons upgrade-celebration-buttons">
                        <button className="modalButton continue neobrutal-button" onClick={onClose} autoFocus>
                            Sweet!
                        </button>
                    </section>
                </div>
            </div>
        </section>
    );
};

export default FeatureImplementedModal;
