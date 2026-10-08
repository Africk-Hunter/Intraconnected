import React, { useEffect, useRef, useState } from "react";
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail, sendEmailVerification } from "firebase/auth";
import AuthOptionMessage from "./AuthOptionMessage";
import MessageBox from "./MessageBox";
import { useIdeaContext } from "../context/IdeaContext";
import { generateDEK, wrapDEK, unwrapDEK, wrapDEKWithEmail, unwrapDEKWithEmail } from "../utilities/crypto";
import { setDEK, loadDEKFromSession } from "../utilities/dekStore";
import { getMailProvider, resetMailUrl } from "../utilities/mailProvider";
import { storeEncryptedDEK, fetchEncryptedDEK, addEmailEncryptedDEK } from "../utilities/firebase/encryptionKeys";

const Auth: React.FC = () => {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const [resetSentTo, setResetSentTo] = useState('');

    const isSigningIn = useRef(false);
    const pendingPasswordRef = useRef("");
    const pendingUidRef = useRef("");
    const pendingEncDataRef = useRef<{ encryptedDEK: string; emailEncryptedDEK?: string } | null>(null);

    const { setMessageBoxMessage, setMessageType } = useIdeaContext();

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user && !isSigningIn.current) {
                const dekLoaded = await loadDEKFromSession();
                if (dekLoaded) window.location.href = '/main';
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (!showConfirmPassword) {
                    handleSignIn(new MouseEvent("click") as unknown as React.MouseEvent<HTMLButtonElement>);
                } else {
                    defaultSignUp(new MouseEvent("click") as unknown as React.MouseEvent<HTMLButtonElement>);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [showConfirmPassword, email, password, confirmPassword]);

    function displayMessage(message: string, type: string) {
        setMessageBoxMessage(message);
        setMessageType(type);
        setTimeout(() => {
            setMessageBoxMessage("");
            setMessageType("");
        }, 3000);
    }

    function checkPassword(password: string) {
        // Length over arbitrary complexity rules (NIST 800-63B) — a longer
        // minimum stops more real attacks than forcing symbols/digits does,
        // and spaces are allowed rather than banned so a passphrase like
        // "correct horse battery staple" isn't rejected. The upper bound is
        // just a sanity cap against pathologically long input, not a
        // meaningful security control.
        if (password.length < 8) {
            displayMessage("Password must be at least 8 characters long", "bad");
            return false;
        } else if (password.length > 128) {
            displayMessage("Password must be less than 128 characters long", "bad");
            return false;
        }
        setMessageBoxMessage("");
        return true;
    }

    // "Keep me signed in" gates both the Firebase Auth session itself and
    // the encryption key (see setDEK(dek, rememberMe) below) — previously
    // only the DEK honored this, while the Auth session always persisted
    // via a hardcoded browserLocalPersistence regardless of the checkbox,
    // so unchecking it didn't actually end the session on browser close.
    // Must be applied before the sign-in/sign-up call for that call to pick
    // it up.
    async function applyPersistence() {
        try {
            await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        } catch (error) {
            console.error("Error setting persistence:", error);
        }
    }

    function defaultSignUp(e: React.MouseEvent<HTMLButtonElement>): void {
        e.preventDefault();
        if (password !== confirmPassword) {
            displayMessage("Passwords do not match", "bad");
            return;
        }
        if (checkPassword(password)) {
            handleSignUp();
        }
    }

    async function handleSignUp() {
        isSigningIn.current = true;
        await applyPersistence();
        createUserWithEmailAndPassword(auth, email.trim(), password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                const capturedPassword = password;

                // Best-effort — a paying customer needs a real, confirmed
                // email on file (see verifyIdTokenDetailed's check in
                // create-payment-intent.ts), but a failure here shouldn't
                // block account creation. Resend is available from Profile.
                sendEmailVerification(user).catch(() => { /* non-critical */ });

                const dek = await generateDEK();
                const encryptedDEK = await wrapDEK(dek, capturedPassword, user.uid);
                const emailEncryptedDEK = await wrapDEKWithEmail(dek, user.email!, user.uid);

                await storeEncryptedDEK(encryptedDEK, emailEncryptedDEK);
                await setDEK(dek, rememberMe);

                sessionStorage.setItem('new_user', 'true');
                isSigningIn.current = false;
                window.location.href = '/main';
            })
            .catch((error) => {
                isSigningIn.current = false;
                if (error.code === 'auth/email-already-in-use') {
                    displayMessage('An account with that email already exists.', 'bad');
                } else {
                    displayMessage('Could not create account. Please try again.', 'bad');
                }
            });
    }

    async function handleForgotPassword() {
        if (!email.trim()) {
            displayMessage('Enter your email address first', 'bad');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email.trim());
            displayMessage('Password reset email sent!', 'good');
            setResetSentTo(email.trim());
        } catch {
            displayMessage('Could not send reset email. Check your address.', 'bad');
        }
    }

    async function handleSignIn(e: React.MouseEvent<HTMLButtonElement>): Promise<void> {
        e.preventDefault();
        const capturedPassword = password;
        isSigningIn.current = true;
        await applyPersistence();

        let userCredential;
        try {
            userCredential = await signInWithEmailAndPassword(auth, email.trim(), capturedPassword);
        } catch {
            isSigningIn.current = false;
            displayMessage('Invalid email or password. Please try again', 'bad');
            return;
        }

        try {
            const user = userCredential.user;
            const encData = await fetchEncryptedDEK();

            if (encData) {
                try {
                    const dek = await unwrapDEK(encData.encryptedDEK, capturedPassword, user.uid);
                    await setDEK(dek, rememberMe);

                    // Derive email DEK — use stored one or generate fresh if account predates email recovery
                    const emailForDEK = user.email!;
                    const emailEncryptedDEK = encData.emailEncryptedDEK
                        ?? await wrapDEKWithEmail(dek, emailForDEK, user.uid);

                    // Silently backfill emailEncryptedDEK for accounts that predate email recovery
                    if (!encData.emailEncryptedDEK) {
                        try { await addEmailEncryptedDEK(emailEncryptedDEK); } catch { /* non-critical */ }
                    }
                    isSigningIn.current = false;
                    window.location.href = '/main';
                } catch {
                    // DEK decryption failed — password was reset; auto-recover via email
                    pendingPasswordRef.current = capturedPassword;
                    pendingUidRef.current = user.uid;
                    pendingEncDataRef.current = encData;
                    isSigningIn.current = false;
                    await handleEmailRecovery();
                }
            } else {
                // No DEK yet — account predates encryption
                const dek = await generateDEK();
                const encryptedDEK = await wrapDEK(dek, capturedPassword, user.uid);
                const emailEncryptedDEK = await wrapDEKWithEmail(dek, user.email!, user.uid);
                await storeEncryptedDEK(encryptedDEK, emailEncryptedDEK);
                await setDEK(dek, rememberMe);

                isSigningIn.current = false;
                window.location.href = '/main';
            }
        } catch (error) {
            isSigningIn.current = false;
            console.error('Encryption setup error:', error);
            displayMessage('Login error, please try again.', 'bad');
        }
    }

    async function handleEmailRecovery() {
        const encData = pendingEncDataRef.current;
        const uid = pendingUidRef.current;
        const newPassword = pendingPasswordRef.current;
        const userEmail = auth.currentUser?.email;

        if (!encData?.emailEncryptedDEK || !userEmail) {
            displayMessage('Email recovery is not set up for this account. Please contact support.', 'bad');
            return;
        }

        let dek: CryptoKey;
        try {
            dek = await unwrapDEKWithEmail(encData.emailEncryptedDEK, userEmail, uid);
        } catch {
            displayMessage('Email recovery failed. Your email may have changed since setup.', 'bad');
            return;
        }

        try {
            const newEncryptedDEK = await wrapDEK(dek, newPassword, uid);
            const newEmailEncryptedDEK = await wrapDEKWithEmail(dek, userEmail, uid);
            await storeEncryptedDEK(newEncryptedDEK, newEmailEncryptedDEK);
            await setDEK(dek, rememberMe);

            window.location.href = '/main';
        } catch {
            displayMessage('Could not save your new keys. Please try again.', 'bad');
        }
    }

    const resetProvider = resetSentTo && email.trim() === resetSentTo ? getMailProvider(resetSentTo) : null;

    return (
        <div className="auth">
            <MessageBox />
            <div className="largeLogo"><img src="/images/MainLargerLogo.svg" alt="" className="largeLogoImg" /></div>
            <section className="authForm">
                <section className="authInputs">
                    <input type="text" className="input neobrutal-input" placeholder="email@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <div className="passwordField">
                        <input type="password" className="input neobrutal-input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <div className="passwordFieldRow">
                            <label className={`rememberMe ${showConfirmPassword ? "hidden" : ""}`}>
                                <input type="checkbox" className="rememberMeInput" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                                <span className="rememberMeBox" aria-hidden="true" />
                                Keep me signed in
                            </label>
                            {resetProvider ? (
                                <a
                                    className={`openGmail neobrutal-button ${showConfirmPassword ? "hidden" : ""}`}
                                    href={resetMailUrl(resetSentTo, resetProvider)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Open {resetProvider.name} ↗
                                </a>
                            ) : (
                                <button className={`forgotPassword ${showConfirmPassword ? "hidden" : ""}`} onClick={handleForgotPassword}>
                                    Forgot password?
                                </button>
                            )}
                        </div>
                    </div>
                    <input type="password" className={`input neobrutal-input confirmPassword ${showConfirmPassword ? "visible" : "hidden"}`} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </section>
                <button
                    className={`authSubmit neobrutal-button ${showConfirmPassword ? "register" : "login"}`}
                    onClick={(e) => {
                        e.preventDefault();
                        if (!showConfirmPassword) {
                            handleSignIn(e);
                        } else if (showConfirmPassword) {
                            defaultSignUp(e);
                        }
                    }}>
                    Continue
                </button>
                <AuthOptionMessage showConfirmPassword={showConfirmPassword} setShowConfirmPassword={setShowConfirmPassword} />
            </section>
            <a href="/" className="authLearnMore">New here? See what Intraconnected does →</a>
            <div className="legalLinks">
                <a href="/terms" className="legalLink">Terms of Service</a>
                <a href="/privacy" className="legalLink">Privacy Policy</a>
            </div>
        </div>
    );
};

export default Auth;
