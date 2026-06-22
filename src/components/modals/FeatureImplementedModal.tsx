import React, { useEffect, useRef } from 'react';

const COLORS = ['#41BC28', '#00A9D8', '#E8E879', '#DB44A4', '#7322C3', '#EC8A13', '#1EB899'];

interface Props {
    titles: string[];
    onClose: () => void;
}

const FeatureImplementedModal: React.FC<Props> = ({ titles, onClose }) => {
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
            // Autoplay blocked — play on first user interaction (e.g. clicking "Sweet!")
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

    return (
        <section className="overlay feature-impl-overlay" onClick={onClose}>
            <canvas ref={canvasRef} className="confetti-canvas" />
            <div className="modal neobrutal confirmModal feature-impl-modal" onClick={e => e.stopPropagation()}>
                <p className="feature-impl-trophy">🎉</p>
                {titles.length === 1 ? (
                    <p className="confirmText">
                        Your feature request <strong className="confirmName">"{titles[0]}"</strong> was implemented!
                    </p>
                ) : (
                    <p className="confirmText">
                        <strong>{titles.length} feature requests</strong> you submitted were implemented!
                    </p>
                )}
                <section className="modalButtons" style={{ justifyContent: 'center' }}>
                    <button className="modalButton continue neobrutal-button" onClick={onClose}>
                        Sweet!
                    </button>
                </section>
            </div>
        </section>
    );
};

export default FeatureImplementedModal;
