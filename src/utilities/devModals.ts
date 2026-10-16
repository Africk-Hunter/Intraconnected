import { useEffect, useRef } from 'react';

// Dev builds only: lets Profile -> Developer Testing -> Modal testing open a
// modal that keeps its open state to itself. Nothing listens in production.
const EVENT = 'dev:open-modal';

export type DevModalName = 'onboarding' | 'session-ended';

export function requestDevModal(name: DevModalName): void {
    window.dispatchEvent(new CustomEvent<DevModalName>(EVENT, { detail: name }));
}

export function useDevModalRequest(name: DevModalName, onOpen: () => void): void {
    const latest = useRef(onOpen);
    latest.current = onOpen;
    useEffect(() => {
        if (!import.meta.env.DEV) return;
        const handler = (e: Event) => {
            if ((e as CustomEvent<DevModalName>).detail === name) latest.current();
        };
        window.addEventListener(EVENT, handler);
        return () => window.removeEventListener(EVENT, handler);
    }, [name]);
}
