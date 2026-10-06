import { auth } from '../../firebaseConfig';
import { loadDEKFromSession } from '../dekStore';

// Sends an already-signed-in visitor on from the landing page (/) into the
// app, the same check Auth.tsx makes on /login. A separate module so the
// marketing pages can load Firebase with a dynamic import after first paint.
export function redirectIfSignedIn(goToApp: () => void): () => void {
    return auth.onAuthStateChanged(async user => {
        if (user && (await loadDEKFromSession())) goToApp();
    });
}
