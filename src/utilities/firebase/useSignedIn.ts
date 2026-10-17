import { useEffect, useState } from 'react';

// Whether someone is signed in, for the marketing pages (navbar, pricing).
// Firebase is a dynamic import so it stays out of their initial bundle; until
// it answers, the visitor is treated as signed out.
export function useSignedIn(): boolean {
    const [signedIn, setSignedIn] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let stop: (() => void) | undefined;
        import('../../firebaseConfig').then(({ auth }) => {
            if (cancelled) return;
            stop = auth.onAuthStateChanged(user => setSignedIn(!!user));
        });
        return () => {
            cancelled = true;
            stop?.();
        };
    }, []);

    return signedIn;
}
