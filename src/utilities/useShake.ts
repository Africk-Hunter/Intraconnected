import { useEffect, useRef } from 'react';

// Sum of per-axis change between two readings (m/s²) that counts as a jolt,
// and how many jolts within JOLT_WINDOW_MS make a shake.
const JOLT_DELTA = 28;
const JOLT_WINDOW_MS = 800;
const JOLTS_NEEDED = 3;
const COOLDOWN_MS = 1500;

type MotionCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

// Calls `onShake` when the device is shaken. iOS only delivers motion events
// after a permission prompt that must come from a tap, so it is requested on
// the first touch; Android needs nothing.
export function useShake(onShake: () => void): void {
    const onShakeRef = useRef(onShake);
    useEffect(() => {
        onShakeRef.current = onShake;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;

        let last: { x: number; y: number; z: number } | null = null;
        let jolts: number[] = [];
        let cooldownUntil = 0;

        const onMotion = (e: DeviceMotionEvent) => {
            const a = e.accelerationIncludingGravity;
            if (!a || a.x == null || a.y == null || a.z == null) return;
            const now = Date.now();
            if (last && now >= cooldownUntil) {
                const delta = Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z);
                if (delta > JOLT_DELTA) {
                    jolts = jolts.filter(t => now - t < JOLT_WINDOW_MS);
                    jolts.push(now);
                    if (jolts.length >= JOLTS_NEEDED) {
                        jolts = [];
                        cooldownUntil = now + COOLDOWN_MS;
                        onShakeRef.current();
                    }
                }
            }
            last = { x: a.x, y: a.y, z: a.z };
        };

        let listening = false;
        const listen = () => {
            if (listening) return;
            listening = true;
            window.addEventListener('devicemotion', onMotion);
        };

        const ctor = DeviceMotionEvent as MotionCtor;
        const onFirstTouch = () => {
            ctor.requestPermission!()
                .then(state => { if (state === 'granted') listen(); })
                .catch(() => { /* denied or unavailable: shake just doesn't work */ });
        };

        if (typeof ctor.requestPermission === 'function') {
            window.addEventListener('touchend', onFirstTouch, { once: true });
        } else {
            listen();
        }

        return () => {
            window.removeEventListener('touchend', onFirstTouch);
            window.removeEventListener('devicemotion', onMotion);
        };
    }, []);
}
