import React, { useEffect, useRef } from 'react';
import type { CheckoutPlan } from '../../utilities/billing/billing';
import { launchConfetti } from '../../utilities/confetti';
import { getCelebrationSound } from '../../utilities/celebrationSound';

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

// Flat light rays fanning out from behind the mascot; the hero rotates them slowly.
export const RaysBackdrop: React.FC = () => (
    <svg className="upgrade-celebration-rays" viewBox="-100 -100 200 200" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M0 0 L-14 -100 L14 -100 Z" transform={`rotate(${i * 30})`} />
        ))}
    </svg>
);

// Confetti-coloured flecks around the mascot (same palette as confetti.ts).
const FLECKS = [
    { x: 12, y: 22, color: '#DB44A4', round: false },
    { x: 86, y: 18, color: '#7322C3', round: true },
    { x: 20, y: 70, color: '#EC8A13', round: true },
    { x: 80, y: 74, color: '#1EB899', round: false },
    { x: 50, y: 8, color: '#FFFFFF', round: true },
    { x: 94, y: 48, color: '#DB44A4', round: true },
    { x: 6, y: 48, color: '#00A9D8', round: false },
];

export const Sparkles: React.FC = () => (
    <>
        {FLECKS.map((f, i) => (
            <span
                key={i}
                className={`upgrade-celebration-fleck${f.round ? ' upgrade-celebration-fleck--round' : ''}`}
                style={{ left: `${f.x}%`, top: `${f.y}%`, background: f.color, animationDelay: `${0.3 + i * 0.17}s` }}
                aria-hidden="true"
            />
        ))}
    </>
);

// Same confetti/audio treatment as FeatureImplementedModal.tsx, for the
// moment a paid upgrade is actually confirmed (see CheckoutModal.tsx, which
// only opens this once the Firestore billing doc reflects the new plan —
// not just on a timer after the card charge succeeds).
const UpgradeCelebrationModal: React.FC<Props> = ({ plan, onClose }) => {
    const launchedRef = useRef(false);

    useEffect(() => {
        // Primed on the Pay tap (CheckoutForm), so this normally plays at once.
        const audio = getCelebrationSound();
        audio.currentTime = 0;
        // touchstart doesn't count as a gesture that unlocks audio on mobile
        // browsers (touchend/click do), so listen for those and keep trying
        // until play() is actually accepted.
        const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;

        const stopListening = () => {
            GESTURES.forEach(type => document.removeEventListener(type, tryPlay, true));
        };

        const tryPlay = () => {
            audio.play().then(stopListening).catch(() => {});
        };

        audio.play().catch(() => {
            // Autoplay blocked — play on the first tap/click/key (e.g. "Let's go!")
            GESTURES.forEach(type => document.addEventListener(type, tryPlay, true));
        });

        // Launched on its own canvas so it keeps going after the modal closes.
        // The ref guard stops StrictMode's dev double-mount from firing it twice.
        if (!launchedRef.current) {
            launchedRef.current = true;
            launchConfetti();
        }

        return stopListening;
    }, []);

    const { icon, label, title, subtitle } = plan === 'lifetime'
        ? {
            icon: <CrownedNode />,
            label: 'Lifetime',
            title: 'Lifetime access unlocked!',
            subtitle: "Unlimited nodes are yours forever. LET'S GOOOO!",
        }
        : {
            icon: <PartyNode />,
            label: 'Annual',
            title: "You're on the Annual plan!",
            subtitle: 'Unlimited nodes are yours for the year. Thanks for upgrading :)',
        };

    return (
        <section className="overlay upgrade-celebration-overlay" onClick={onClose}>
            <div
                className={`modal neobrutal confirmModal upgrade-celebration-modal upgrade-celebration-modal--${plan}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="upgrade-celebration-title"
                onClick={e => e.stopPropagation()}
            >
                <div className="upgrade-celebration-hero">
                    <div className="upgrade-celebration-backdrop">
                        <RaysBackdrop />
                        <Sparkles />
                    </div>
                    <div className="upgrade-celebration-icon">{icon}</div>
                    <span className="upgrade-celebration-sticker">{label}</span>
                </div>
                <div className="upgrade-celebration-body">
                    <h2 className="upgrade-celebration-title" id="upgrade-celebration-title">{title}</h2>
                    <p className="upgrade-celebration-subtitle">{subtitle}</p>
                    <section className="modalButtons upgrade-celebration-buttons">
                        <button className="modalButton continue neobrutal-button" onClick={onClose} autoFocus>
                            Let's go!
                        </button>
                    </section>
                </div>
            </div>
        </section>
    );
};

export default UpgradeCelebrationModal;
