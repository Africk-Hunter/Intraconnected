import { useEffect, useRef, useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { getDEK } from '../../utilities/dekStore';
import { wrapDEKWithEmail } from '../../utilities/crypto';
import { fetchEncryptedDEK, storeEmailWrap } from '../../utilities/firebase/encryptionKeys';
import { syncBillingEmail } from '../../utilities/firebase/authFirebase';
import AnimatedOverlay from '../AnimatedOverlay';
import '../../styles/sessionEndedModal.scss';

// Shown when Firebase ends this tab's session behind its back (the account's
// email was changed from another tab, a password reset, etc.). It can't be
// dismissed: either sign in again here, or leave for the sign-in page. The
// encryption key is independent of the Auth session and is still in memory,
// so a plain sign-in is enough; local ideas and unsent changes are untouched.
function SessionEndedModal() {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSigningIn, setIsSigningIn] = useState(false);
    const signedInUid = useRef<string | null>(null);
    // Set while this modal's own sign-in is in flight, so the auth listener
    // doesn't treat a wrong-account sign-out as a second session loss.
    const handlingSignIn = useRef(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            if (user) {
                signedInUid.current = user.uid;
            } else if (signedInUid.current && !handlingSignIn.current) {
                // A deliberate sign-out or account deletion clears the key
                // first; only an unexpected session loss leaves it in memory.
                try { getDEK(); setOpen(true); } catch { /* deliberate sign-out */ }
            }
        });
        return () => unsubscribe();
    }, []);

    async function handleSignIn(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || !password || isSigningIn) return;
        setIsSigningIn(true);
        setError('');
        handlingSignIn.current = true;

        try {
            const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);

            // A different account would have the wrong key and ideas here.
            if (user.uid !== signedInUid.current) {
                await auth.signOut();
                setError('That is a different account. Sign in with the account you were using.');
                return;
            }

            // Re-wrap the email recovery key for the (possibly new) address,
            // same as Auth.tsx does on sign-in.
            try {
                const encData = await fetchEncryptedDEK();
                if (encData && user.email && (!encData.emailEncryptedDEK || encData.emailWrapFor !== user.email)) {
                    await storeEmailWrap(await wrapDEKWithEmail(getDEK(), user.email, user.uid), user.email);
                    if (encData.emailEncryptedDEK) syncBillingEmail().catch(() => { /* non-critical */ });
                }
            } catch { /* non-critical — Auth.tsx repeats this on the next sign-in */ }

            // Reload so every Firestore listener restarts under the new
            // session. The key comes back from sessionStorage and the outbox
            // from localStorage, so nothing is lost.
            window.location.reload();
        } catch {
            setError('Invalid email or password. Please try again.');
        } finally {
            handlingSignIn.current = false;
            setIsSigningIn(false);
        }
    }

    return (
        <AnimatedOverlay open={open}>
            <form className="modal neobrutal session-ended" onSubmit={handleSignIn}>
                <header className="session-ended-header">
                    <span className="session-ended-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="11" width="16" height="10" rx="2" />
                            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                        </svg>
                    </span>
                    <h2 className="session-ended-title">You've been signed out</h2>
                </header>

                <div className="session-ended-body">
                    <p className="session-ended-text">
                        Your session ended, most likely because your email or password was changed. Sign in again to keep syncing.
                    </p>

                    <label className="session-ended-field">
                        Email
                        <input
                            type="email"
                            className="input neobrutal-input"
                            placeholder="email@domain.com"
                            autoComplete="username"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </label>
                    <label className="session-ended-field">
                        Password
                        <input
                            type="password"
                            className="input neobrutal-input"
                            placeholder="Password"
                            autoComplete="current-password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </label>
                    {error && <p className="session-ended-error">{error}</p>}

                    <button
                        type="submit"
                        className="session-ended-submit neobrutal-button leaf"
                        disabled={!email.trim() || !password || isSigningIn}
                    >
                        {isSigningIn ? 'Signing in…' : 'Sign in'}
                    </button>
                    <button
                        type="button"
                        className="session-ended-leave"
                        onClick={() => { window.location.href = '/login'; }}
                    >
                        Go to the sign in page instead
                    </button>
                </div>
            </form>
        </AnimatedOverlay>
    );
}

export default SessionEndedModal;
