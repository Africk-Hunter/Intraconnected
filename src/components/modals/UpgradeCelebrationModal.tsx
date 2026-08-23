import React, { useEffect, useRef } from 'react';
import type { CheckoutPlan } from '../../utilities/billing/billing';

const COLORS = ['#41BC28', '#00A9D8', '#E8E879', '#DB44A4', '#7322C3', '#EC8A13', '#1EB899'];

interface Props {
    plan: CheckoutPlan;
    onClose: () => void;
}

// Same confetti/audio treatment as FeatureImplementedModal.tsx, for the
// moment a paid upgrade is actually confirmed (see CheckoutModal.tsx, which
// only opens this once the Firestore billing doc reflects the new plan —
// not just on a timer after the card charge succeeds).
const UpgradeCelebrationModal: React.FC<Props> = ({ plan, onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);

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

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = Array.from({ length: 90 }, () => ({
            x: Math.random() * canvas.width,
            y: -(Math.random() * canvas.height * 0.6),
            w: 7 + Math.random() * 9,
            h: 3 + Math.random() * 5,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            speed: 3 + Math.random() * 5,
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.15,
            drift: (Math.random() - 0.5) * 1.5,
        }));

        const startTime = Date.now();

        function draw() {
            const elapsed = Date.now() - startTime;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let alive = 0;
            for (const p of particles) {
                // Respawn from top for the first 4 seconds
                if (elapsed < 4000 && p.y > canvas.height) {
                    p.y = -p.h;
                    p.x = Math.random() * canvas.width;
                }

                p.y += p.speed;
                p.x += p.drift;
                p.angle += p.spin;

                if (p.y < canvas.height + 20) alive++;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }

            if (alive > 0) {
                rafRef.current = requestAnimationFrame(draw);
            }
        }

        rafRef.current = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(rafRef.current);
            document.removeEventListener('mousedown', tryPlay);
            document.removeEventListener('touchstart', tryPlay);
        };
    }, []);

    const { icon, title, subtitle } = plan === 'lifetime'
        ? {
            icon: '👑',
            title: 'Lifetime access unlocked!',
            subtitle: 'Unlimited nodes, yours forever. LETS GOOOO!',
        }
        : {
            icon: '🎉',
            title: "You're on the Annual plan!",
            subtitle: 'Unlimited nodes are yours for the year. Thanks for upgrading :)',
        };

    return (
        <section className="overlay upgrade-celebration-overlay" onClick={onClose}>
            <canvas ref={canvasRef} className="confetti-canvas" />
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
