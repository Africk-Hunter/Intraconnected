import React, { useEffect, useRef } from 'react';
import type { CheckoutPlan } from '../../utilities/billing/billing';
import { launchConfetti } from '../../utilities/confetti';

interface Props {
    plan: CheckoutPlan;
    onClose: () => void;
}

// A leaf node (same green, 4px black border and hard shadow as .ideaNode)
// wearing a crown. Colors mirror $leaf / $deep-yellow / $link in variables.scss.
const CrownedNode: React.FC = () => (
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
        <circle cx="44" cy="74" r="5" fill="#000" />
        <circle cx="72" cy="74" r="5" fill="#000" />
        <path d="M46 86 Q58 95 70 86" fill="none" stroke="#000" strokeWidth="4" />
        <g transform="rotate(-9 58 52)">
            <path
                d="M34 54 L29 22 L46 36 L58 14 L70 36 L87 22 L82 54 Z"
                fill="#D4A000"
                stroke="#000"
                strokeWidth="4"
            />
            <rect x="33" y="44" width="50" height="10" fill="#E8E879" stroke="#000" strokeWidth="4" />
            <circle cx="29" cy="20" r="4.5" fill="#E8E879" stroke="#000" strokeWidth="3" />
            <circle cx="58" cy="12" r="4.5" fill="#E8E879" stroke="#000" strokeWidth="3" />
            <circle cx="87" cy="20" r="4.5" fill="#E8E879" stroke="#000" strokeWidth="3" />
        </g>
    </svg>
);

// Annual counterpart: a blue parent node (same $sky) in a party hat.
const PartyNode: React.FC = () => (
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
        <rect x="18" y="51" width="80" height="50" rx="8" fill="#00A9D8" stroke="#000" strokeWidth="4" />
        <circle cx="44" cy="72" r="5" fill="#000" />
        <circle cx="72" cy="72" r="5" fill="#000" />
        <path d="M46 83 Q58 98 70 83 Z" fill="#000" stroke="#000" strokeWidth="3" />
        <g transform="rotate(9 58 52)">
            <path d="M58 12 L82 54 L34 54 Z" fill="#EC8A13" stroke="#000" strokeWidth="4" />
            <path d="M48 36 L68 36" stroke="#E8E879" strokeWidth="5" fill="none" />
            <path d="M41 49 L75 49" stroke="#E8E879" strokeWidth="5" fill="none" />
            <circle cx="58" cy="11" r="6" fill="#DB44A4" stroke="#000" strokeWidth="3" />
        </g>
    </svg>
);

// Same confetti/audio treatment as FeatureImplementedModal.tsx, for the
// moment a paid upgrade is actually confirmed (see CheckoutModal.tsx, which
// only opens this once the Firestore billing doc reflects the new plan —
// not just on a timer after the card charge succeeds).
const UpgradeCelebrationModal: React.FC<Props> = ({ plan, onClose }) => {
    const launchedRef = useRef(false);

    useEffect(() => {
        const audio = new Audio('/sounds/roblox-badge.mp3');
        audio.volume = 0.7;
        let played = false;

        const tryPlay = () => {
            if (played) return;
            played = true;
            audio.play().catch(() => {});
        };

        audio.play().catch(() => {
            // Autoplay blocked — play on first user interaction (e.g. clicking "Let's go!")
            document.addEventListener('mousedown', tryPlay, { once: true });
            document.addEventListener('touchstart', tryPlay, { once: true });
        });

        // Launched on its own canvas so it keeps going after the modal closes.
        // The ref guard stops StrictMode's dev double-mount from firing it twice.
        if (!launchedRef.current) {
            launchedRef.current = true;
            launchConfetti();
        }

        return () => {
            document.removeEventListener('mousedown', tryPlay);
            document.removeEventListener('touchstart', tryPlay);
        };
    }, []);

    const { icon, title, subtitle } = plan === 'lifetime'
        ? {
            icon: <CrownedNode />,
            title: 'Lifetime access unlocked!',
            subtitle: "Unlimited nodes are yours forever. LET'S GOOOO!",
        }
        : {
            icon: <PartyNode />,
            title: "You're on the Annual plan!",
            subtitle: 'Unlimited nodes are yours for the year. Thanks for upgrading :)',
        };

    return (
        <section className="overlay upgrade-celebration-overlay" onClick={onClose}>
            <div className="modal neobrutal confirmModal upgrade-celebration-modal" onClick={e => e.stopPropagation()}>
                <p className="upgrade-celebration-icon">{icon}</p>
                <p className="confirmText">
                    <strong className="confirmName">{title}</strong>
                    <br />
                    {subtitle}
                </p>
                <section className="modalButtons" style={{ justifyContent: 'center' }}>
                    <button className="modalButton continue neobrutal-button" onClick={onClose}>
                        Let's go!
                    </button>
                </section>
            </div>
        </section>
    );
};

export default UpgradeCelebrationModal;
