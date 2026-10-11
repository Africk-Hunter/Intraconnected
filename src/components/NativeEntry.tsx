import { useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { loadPersistedDEK } from '../utilities/dekStore';

// The app's front door (route "/" inside the Capacitor shell; the website
// shows the landing page there instead). It never renders anything: the
// native splash stays up while it works out whether this device still has a
// session AND the encryption key, then replaces itself with the map or the
// sign-in page, so a signed-in user never sees the login form flash by.
//
// If Firebase never answers (a WebView that can't finish auth setup) the
// sign-in page takes over after a few seconds rather than leaving the splash
// up forever.
const GIVE_UP_MS = 8000;

function NativeEntry() {
    useEffect(() => {
        let done = false;
        const go = (path: string) => {
            if (done) return;
            done = true;
            window.location.replace(path);
        };

        const unsubscribe = auth.onAuthStateChanged(async user => {
            unsubscribe();
            const hasKey = user ? await loadPersistedDEK() : false;
            go(user && hasKey ? '/main' : '/login');
        });
        const timer = window.setTimeout(() => go('/login'), GIVE_UP_MS);

        return () => {
            window.clearTimeout(timer);
            unsubscribe();
        };
    }, []);

    return null;
}

export default NativeEntry;
