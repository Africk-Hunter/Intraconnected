import { useEffect, useState } from 'react';
import type { LifetimePricePreview } from './billing';

export interface LifetimePriceState {
    preview: LifetimePricePreview | null;
    // True from the moment an Annual user is detected until the discounted
    // price has resolved (or failed) — callers show a placeholder instead of
    // the flat price so it never flashes before the credit is applied.
    loading: boolean;
}

// Only Annual subscribers are eligible for the Lifetime-upgrade credit — skip
// the request otherwise. billing.tsx pulls in Firebase Auth, so it's loaded
// lazily to keep it out of the marketing bundle. A failed fetch falls back to
// the flat price, same as create-payment-intent.ts does server-side.
export function useLifetimePrice(enabled: boolean, isAnnual: boolean): LifetimePriceState {
    const [preview, setPreview] = useState<LifetimePricePreview | null>(null);
    const [settled, setSettled] = useState(false);
    const active = enabled && isAnnual;

    useEffect(() => {
        if (!active) {
            setPreview(null);
            setSettled(false);
            return;
        }
        let cancelled = false;
        setSettled(false);
        import('./billing')
            .then(({ getLifetimePricePreview }) => getLifetimePricePreview())
            .then(result => {
                if (!cancelled) setPreview(result);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setSettled(true);
            });
        return () => {
            cancelled = true;
        };
    }, [active]);

    return { preview, loading: active && !settled };
}
