const COLORS = ['#41BC28', '#00A9D8', '#E8E879', '#DB44A4', '#7322C3', '#EC8A13', '#1EB899'];

const GRAVITY = 0.22;
const RAIN_MS = 6000;
// Staggered cannon volleys: [delay ms, particles per cannon]
const VOLLEYS = [[0, 110], [350, 90], [750, 90], [1400, 70]];

interface Particle {
    x: number; y: number; vx: number; vy: number;
    w: number; h: number; color: string;
    angle: number; spin: number; tilt: number; tiltSpeed: number;
    round: boolean; rain: boolean;
}

// Fires a full-screen confetti show on its own canvas appended to <body>, so it
// is independent of whichever component launched it (closing a modal does not
// cut it short). The canvas removes itself once every piece has fallen away.
export function launchConfetti(): void {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.style.zIndex = '9999';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        canvas.remove();
        return;
    }

    const makeParticle = (x: number, y: number, vx: number, vy: number, rain: boolean): Particle => ({
        x, y, vx, vy,
        w: 8 + Math.random() * 10,
        h: 4 + Math.random() * 7,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.3,
        tilt: Math.random() * Math.PI * 2,
        tiltSpeed: 0.08 + Math.random() * 0.15,
        round: Math.random() < 0.25,
        rain,
    });

    // Cannon burst from a bottom corner, fanned toward the screen's centre.
    const burst = (fromLeft: boolean, count: number): Particle[] =>
        Array.from({ length: count }, () => {
            const dir = (fromLeft ? -Math.PI / 3 : (-2 * Math.PI) / 3) + (Math.random() - 0.5) * 0.9;
            const power = 14 + Math.random() * 16;
            return makeParticle(
                fromLeft ? 0 : canvas.width,
                canvas.height,
                Math.cos(dir) * power,
                Math.sin(dir) * power,
                false,
            );
        });

    const particles: Particle[] = [];
    const startTime = Date.now();
    let nextVolley = 0;

    function draw() {
        const elapsed = Date.now() - startTime;
        ctx!.clearRect(0, 0, canvas.width, canvas.height);

        while (nextVolley < VOLLEYS.length && elapsed >= VOLLEYS[nextVolley][0]) {
            const count = VOLLEYS[nextVolley][1];
            particles.push(...burst(true, count), ...burst(false, count));
            nextVolley++;
        }

        // Steady rain from above on top of the cannons
        if (elapsed < RAIN_MS) {
            for (let i = 0; i < 3; i++) {
                particles.push(makeParticle(
                    Math.random() * canvas.width, -20,
                    (Math.random() - 0.5) * 3, 2 + Math.random() * 3, true,
                ));
            }
        }

        let alive = nextVolley < VOLLEYS.length || elapsed < RAIN_MS ? 1 : 0;
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];

            if (p.rain) {
                p.vy = Math.min(p.vy + 0.02, 6);
            } else {
                p.vy += GRAVITY;
                p.vx *= 0.985; // air drag
                p.vy *= 0.985;
            }
            p.x += p.vx + Math.sin(p.tilt) * 1.2; // flutter
            p.y += p.vy;
            p.angle += p.spin;
            p.tilt += p.tiltSpeed;

            if (p.y > canvas.height + 30 || p.x < -60 || p.x > canvas.width + 60) {
                particles.splice(i, 1);
                continue;
            }
            alive++;

            ctx!.save();
            ctx!.translate(p.x, p.y);
            ctx!.rotate(p.angle);
            ctx!.fillStyle = p.color;
            // Fake 3D flip: squash height as the piece tumbles
            const flip = Math.abs(Math.cos(p.tilt));
            if (p.round) {
                ctx!.beginPath();
                ctx!.ellipse(0, 0, p.w / 2, (p.w / 2) * flip + 0.5, 0, 0, Math.PI * 2);
                ctx!.fill();
            } else {
                ctx!.fillRect(-p.w / 2, (-p.h / 2) * flip, p.w, p.h * flip + 0.5);
            }
            ctx!.restore();
        }

        if (alive > 0) {
            requestAnimationFrame(draw);
        } else {
            canvas.remove();
        }
    }

    requestAnimationFrame(draw);
}
