import React, { useEffect, useRef, useState } from "react";
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail, sendEmailVerification } from "firebase/auth";
import AuthOptionMessage from "./AuthOptionMessage";
import MessageBox from "./MessageBox";
import ReportLink from "./ReportLink";
import NodeLoader from "./modals/NodeLoader";
import { LinkOutIcon } from "./Icons";
import { useIdeaContext } from "../context/IdeaContext";
import { generateDEK, wrapDEK, unwrapDEK, unwrapDEKWithEmail, wrapDEKForRecovery, importDEK, needsPasswordWrapUpgrade } from "../utilities/crypto";
import { takeLoginEmail } from "../utilities/loginPrefill";
import { flagCryptoUpgradeProblem, clearCryptoUpgradeProblem, hasCryptoUpgradeProblem, reportCryptoUpgradeResolved } from "../utilities/cryptoUpgradeNotice";
import { setDEK, loadPersistedDEK } from "../utilities/dekStore";
import { getMailProvider, resetMailUrl } from "../utilities/mailProvider";
import { storeEncryptedDEK, fetchEncryptedDEK, storePasswordWrap, storeRecoveryWrap, removeLegacyEmailWrap, type EncryptionDoc } from "../utilities/firebase/encryptionKeys";
import { syncBillingEmail } from "../utilities/firebase/authFirebase";
import { apiUrl, isNative, hideSplash } from "../utilities/platform";
import { discardForeignIdeas } from "../utilities/sync/syncEngine";

const Auth: React.FC = () => {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    // The app always keeps you signed in (the key goes to the Keychain / Keystore),
    // so it has no "Keep me signed in" choice.
    const native = isNative();
    const [rememberMe, setRememberMe] = useState(native);

    const [resetSentTo, setResetSentTo] = useState('');

    const isSigningIn = useRef(false);
    const pendingPasswordRef = useRef("");
    const pendingUidRef = useRef("");
    const pendingEncDataRef = useRef<EncryptionDoc | null>(null);

    const { setMessageBoxMessage, setMessageType } = useIdeaContext();
    const [reportableFailure, setReportableFailure] = useState<string | null>(null);
    // True from pressing Continue on sign-in until it fails or the page moves on.
    const [signingIn, setSigningIn] = useState(false);

    useEffect(() => { hideSplash(); }, []);

    // After a password reset the email is already known: fill it in and put the
    // cursor in the password field.
    const passwordRef = useRef<HTMLInputElement>(null);
    const submitRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const prefilled = takeLoginEmail();
        if (!prefilled) return;
        setEmail(prefilled);
        passwordRef.current?.focus();
    }, []);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) discardForeignIdeas(user.uid);
            if (user && !isSigningIn.current) {
                const dekLoaded = await loadPersistedDEK();
                if (dekLoaded) window.location.replace('/main');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs only when the listed deps change, by design
    }, [showConfirmPassword, email, password, confirmPassword, signingIn]);

    // `reportable` marks a failure of ours (not a wrong password or a bad
    // field): the toast vanishes after 3s, so the "Send a report" link below
    // the form stays until the next attempt.
    function displayMessage(message: string, type: string, reportable = false) {
        setReportableFailure(reportable ? message : null);
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

    // Throws when the KMS wrap can't be made (public key missing, WebCrypto
    // failure). There is no email-derived fallback any more, so a new key is
    // never stored without a recovery path.
    async function createRecoveryWrap(dek: CryptoKey, uid: string): Promise<string> {
        try {
            return await wrapDEKForRecovery(dek, uid);
        } catch (error) {
            console.error("KMS recovery wrap could not be created.", error);
            flagCryptoUpgradeProblem(uid, "recovery-wrap");
            throw error;
        }
    }

    async function storeInitialKey(dek: CryptoKey, password: string, uid: string): Promise<void> {
        const encryptedDEK = await wrapDEK(dek, password, uid);
        await storeEncryptedDEK(encryptedDEK, await createRecoveryWrap(dek, uid));
    }

    // "Keep me signed in" gates both the Firebase Auth session itself and
    // the encryption key (see setDEK(dek, rememberMe) below) — previously
    // only the DEK honored this, while the Auth session always persisted
    // via a hardcoded browserLocalPersistence regardless of the checkbox,
    // so unchecking it didn't actually end the session on browser close.
    // Must be applied before the sign-in/sign-up call for that call to pick
    // it up.
    async function applyPersistence() {
        // The app's auth is already set up with persistent storage (firebaseConfig.ts).
        if (native) return;
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
        if (!connectionIsSecure()) return;
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

                try {
                    const dek = await generateDEK();
                    await storeInitialKey(dek, capturedPassword, user.uid);
                    await setDEK(dek, rememberMe);
                } catch (error) {
                    // The account exists but has no key yet. Signing in finishes
                    // the setup (the "no key yet" branch of handleSignIn).
                    console.error("Encryption setup failed after sign-up.", error);
                    await auth.signOut().catch(() => { /* non-critical */ });
                    isSigningIn.current = false;
                    displayMessage('Your account was created, but its encryption setup did not finish. Sign in to try again.', 'bad', true);
                    return;
                }

                sessionStorage.setItem('new_user', 'true');
                isSigningIn.current = false;
                window.location.replace('/main');
            })
            .catch((error) => {
                isSigningIn.current = false;
                if (error.code === 'auth/email-already-in-use') {
                    displayMessage('An account with that email already exists.', 'bad');
                } else {
                    displayMessage('Could not create account. Please try again.', 'bad', true);
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
            displayMessage('Could not send reset email. Check your address.', 'bad', true);
        }
    }

    async function handleSignIn(e: React.MouseEvent<HTMLButtonElement>): Promise<void> {
        e.preventDefault();
        if (signingIn) return;
        setSigningIn(true);
        try {
            await runSignIn();
        } finally {
            setSigningIn(false);
        }
    }

    // Encryption needs a secure connection (https, or localhost). Over a plain
    // http address such as a phone reaching a dev PC by IP, the browser hides
    // the crypto tools and every later step would fail with a cryptic error.
    function connectionIsSecure(): boolean {
        if (typeof crypto !== 'undefined' && crypto.subtle) return true;
        isSigningIn.current = false;
        displayMessage("This page isn't on a secure connection, so your browser won't let it unlock your ideas. Open the https:// version of the site and try again.", 'bad');
        return false;
    }

    async function runSignIn(): Promise<void> {
        if (!connectionIsSecure()) return;
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
                let dek: CryptoKey;
                try {
                    dek = await unwrapDEK(encData.encryptedDEK, capturedPassword, user.uid);
                } catch (error) {
                    if ((error as { code?: string }).code === "crypto/argon2-unavailable") {
                        isSigningIn.current = false;
                        displayMessage("This account's encryption could not be unlocked because the security module failed to load. Please reload and try again.", "bad", true);
                        return;
                    }
                    // DEK decryption failed — password may have been reset; try the configured recovery path.
                    pendingPasswordRef.current = capturedPassword;
                    pendingUidRef.current = user.uid;
                    pendingEncDataRef.current = encData;
                    isSigningIn.current = false;
                    await handleEmailRecovery();
                    return;
                }

                await setDEK(dek, rememberMe);
                // Anything below still to do means an upgrade is attempted this
                // sign-in; a failure re-flags, a clean pass clears the record.
                const hasLegacyFields = Boolean(encData.emailEncryptedDEK || encData.emailWrapFor || encData.pendingEmailEncryptedDEK || encData.pendingEmail);
                const upgradeAttempted = !encData.recoveryWrap || hasLegacyFields || needsPasswordWrapUpgrade(encData.encryptedDEK);
                clearCryptoUpgradeProblem(user.uid);

                // An account still on the old email-derived recovery wrap gets a
                // KMS one now; only then is the old wrap removed. If any step
                // fails the account keeps working and we try again next sign-in.
                let hasRecoveryWrap = Boolean(encData.recoveryWrap);
                if (!hasRecoveryWrap) {
                    let recoveryWrap: string | null = null;
                    try {
                        recoveryWrap = await createRecoveryWrap(dek, user.uid);
                    } catch { /* already logged and flagged */ }
                    if (recoveryWrap) {
                        try {
                            await storeRecoveryWrap(recoveryWrap);
                            hasRecoveryWrap = true;
                        } catch (error) {
                            console.error("Could not save the KMS recovery wrap.", error);
                            flagCryptoUpgradeProblem(user.uid, "recovery-store");
                        }
                    }
                }
                if (hasRecoveryWrap) {
                    if (hasLegacyFields) {
                        try {
                            await removeLegacyEmailWrap();
                        } catch (error) {
                            console.error("Could not remove the migrated legacy email recovery fields.", error);
                            flagCryptoUpgradeProblem(user.uid, "legacy-removal");
                        }
                    }
                    syncBillingEmail().catch(() => { /* non-critical */ });
                }
                if (needsPasswordWrapUpgrade(encData.encryptedDEK)) {
                    try {
                        await storePasswordWrap(await wrapDEK(dek, capturedPassword, user.uid));
                    } catch (error) {
                        console.error("Could not upgrade the password wrap; the existing wrap remains usable.", error);
                        flagCryptoUpgradeProblem(user.uid, "password-wrap");
                    }
                }
                // A clean upgrade pass takes the account off the server's stuck list.
                if (upgradeAttempted && !hasCryptoUpgradeProblem(user.uid)) {
                    reportCryptoUpgradeResolved();
                }
                isSigningIn.current = false;
                window.location.replace('/main');
            } else {
                // No DEK yet — account predates encryption
                const dek = await generateDEK();
                const hadUpgradeProblem = hasCryptoUpgradeProblem(user.uid);
                await storeInitialKey(dek, capturedPassword, user.uid);
                await setDEK(dek, rememberMe);
                if (hadUpgradeProblem) {
                    clearCryptoUpgradeProblem(user.uid);
                    reportCryptoUpgradeResolved();
                }

                isSigningIn.current = false;
                window.location.replace('/main');
            }
        } catch (error) {
            isSigningIn.current = false;
            console.error('Encryption setup error:', error);
            displayMessage('Login error, please try again.', 'bad', true);
        }
    }

    async function handleEmailRecovery() {
        const encData = pendingEncDataRef.current;
        const uid = pendingUidRef.current;
        const newPassword = pendingPasswordRef.current;
        const user = auth.currentUser;
        const userEmail = user?.email;

        if (!encData || !user) {
            displayMessage('Key recovery is not set up for this account. Please contact support.', 'bad', true);
            return;
        }

        // Recovery asks the server to release the key and then re-wraps it, which
        // can take a while. displayMessage (any failure below) replaces this.
        setMessageBoxMessage('Restoring access to your ideas. This can take up to a minute, so please keep this page open.');
        setMessageType('good');

        let dek: CryptoKey;
        try {
            if (encData.recoveryWrap) {
                const idToken = await user.getIdToken();
                const response = await fetch(apiUrl("/.netlify/functions/recover-key"), {
                    method: "POST",
                    headers: { Authorization: `Bearer ${idToken}` },
                    cache: "no-store",
                });
                if (!response.ok) {
                    const body = await response.json().catch(() => ({})) as { error?: string };
                    throw new Error(body.error ?? "The encryption key could not be recovered.");
                }
                const body = await response.json() as { dek: string };
                dek = await importDEK(Uint8Array.from(atob(body.dek), c => c.charCodeAt(0)));
            } else if (encData.emailEncryptedDEK && userEmail) {
                try {
                    dek = await unwrapDEKWithEmail(encData.emailEncryptedDEK, userEmail, uid);
                } catch (error) {
                    // The email changed but no password sign-in has happened
                    // since; use the pending wrap for the new address.
                    if (!encData.pendingEmailEncryptedDEK || encData.pendingEmail !== userEmail) throw error;
                    dek = await unwrapDEKWithEmail(encData.pendingEmailEncryptedDEK, userEmail, uid);
                }
            } else {
                throw new Error("No recovery wrap is available.");
            }
        } catch (error) {
            console.error("Encryption-key recovery failed.", error);
            displayMessage(error instanceof Error ? error.message : 'Encryption-key recovery failed. Please try again.', 'bad', true);
            return;
        }

        try {
            const newEncryptedDEK = await wrapDEK(dek, newPassword, uid);
            // A full overwrite: the old email-derived fields, if any, go too.
            const recoveryWrap = encData.recoveryWrap ?? await createRecoveryWrap(dek, uid);
            await storeEncryptedDEK(newEncryptedDEK, recoveryWrap);
            await setDEK(dek, rememberMe);
            await syncBillingEmail().catch(() => { /* non-critical */ });

            window.location.replace('/main');
        } catch (error) {
            console.error("Could not save the recovered encryption key.", error);
            displayMessage('Could not save your new keys. Please try again.', 'bad', true);
        }
    }

    const resetProvider = resetSentTo && email.trim() === resetSentTo ? getMailProvider(resetSentTo) : null;

    return (
        <div className="auth">
            <MessageBox />
            {reportableFailure && (
                <p className="authReport">Not a mistake on your side? <ReportLink area="sign-in" error={reportableFailure} /></p>
            )}
            <div className="largeLogo"><img src="/images/MainLargerLogo.svg" alt="" className="largeLogoImg" /></div>
            <section className="authForm">
                <section className="authInputs" onFocus={() => {
                    // The keyboard covers the button; once it is up, scroll the page so Continue is visible.
                    setTimeout(() => submitRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350);
                }}>
                    <input type="text" className="input neobrutal-input" placeholder="email@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <div className="passwordField">
                        <input type="password" ref={passwordRef} className="input neobrutal-input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <div className={`passwordFieldRow${native ? " nativeRow" : ""}`}>
                            {!native && <label className={`rememberMe ${showConfirmPassword ? "hidden" : ""}`} inert={showConfirmPassword}>
                                <input type="checkbox" className="rememberMeInput" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                                <span className="rememberMeBox" aria-hidden="true" />
                                Keep me signed in
                            </label>}
                            {resetProvider ? (
                                <a
                                    className={`openGmail neobrutal-button ${showConfirmPassword ? "hidden" : ""}`}
                                    inert={showConfirmPassword}
                                    href={resetMailUrl(resetSentTo, resetProvider)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Open {resetProvider.name} <LinkOutIcon />
                                </a>
                            ) : (
                                <button className={`forgotPassword ${showConfirmPassword ? "hidden" : ""}`} inert={showConfirmPassword} onClick={handleForgotPassword}>
                                    Forgot password?
                                </button>
                            )}
                        </div>
                    </div>
                    <input type="password" className={`input neobrutal-input confirmPassword ${showConfirmPassword ? "visible" : "hidden"}`} inert={!showConfirmPassword} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </section>
                <button
                    ref={submitRef}
                    className={`authSubmit neobrutal-button ${showConfirmPassword ? "register" : "login"}`}
                    onClick={(e) => {
                        e.preventDefault();
                        if (!showConfirmPassword) {
                            handleSignIn(e);
                        } else if (showConfirmPassword) {
                            defaultSignUp(e);
                        }
                    }}
                    aria-disabled={signingIn}
                    aria-busy={signingIn}>
                    {signingIn && !showConfirmPassword
                        ? <span role="status" aria-label="Please wait"><NodeLoader className="mono small dark" /></span>
                        : "Continue"}
                </button>
                <AuthOptionMessage showConfirmPassword={showConfirmPassword} setShowConfirmPassword={(show) => { setConfirmPassword(""); setShowConfirmPassword(show); }} />
            </section>
            <footer className="authFooter">
                {!native && <a href="/" className="authLearnMore">New here? See what Intraconnected does →</a>}
                <div className="legalLinks">
                    <a href="/terms" className="legalLink">Terms of Service</a>
                    <a href="/privacy" className="legalLink">Privacy Policy</a>
                </div>
            </footer>
        </div>
    );
};

export default Auth;
