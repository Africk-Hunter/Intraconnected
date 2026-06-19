import React, { useEffect, useRef, useState } from "react";
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, sendPasswordResetEmail } from "firebase/auth";
import AuthOptionMessage from "./AuthOptionMessage";
import MessageBox from "./MessageBox";
import { useIdeaContext } from "../context/IdeaContext";
import { generateDEK, generateRecoveryCode, wrapDEK, wrapDEKWithRecovery, unwrapDEK, unwrapDEKWithRecovery, wrapDEKWithEmail, unwrapDEKWithEmail } from "../utilities/crypto";
import { setDEK, loadDEKFromSession } from "../utilities/dekStore";
import { storeEncryptedDEK, fetchEncryptedDEK, markRecoveryCodeAcknowledged, addEmailEncryptedDEK } from "../utilities/firebase/firebaseHelpers";
import { signUserOut } from "../utilities/firebase/authFirebase";

const Auth: React.FC = () => {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [pendingRecoveryCode, setPendingRecoveryCode] = useState("");
    const [showRecoveryInput, setShowRecoveryInput] = useState(false);
    const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
    const [copied, setCopied] = useState(false);
    const [recoveryCodeContext, setRecoveryCodeContext] = useState<'signup' | 'migration' | 'restore'>('signup');

    const isShowingRecoveryCode = useRef(false);
    const isSigningIn = useRef(false);
    const pendingPasswordRef = useRef("");
    const pendingUidRef = useRef("");
    const pendingEncDataRef = useRef<{ encryptedDEK: string; recoveryEncryptedDEK: string; emailEncryptedDEK?: string } | null>(null);

    const { setMessageBoxMessage, setMessageType, messageBoxMessage } = useIdeaContext();

    useEffect(() => {
        setPersistence(auth, browserLocalPersistence).catch((error) => {
            console.error("Error setting persistence:", error);
        });

        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user && !isShowingRecoveryCode.current && !isSigningIn.current && !showRecoveryInput) {
                const dekLoaded = await loadDEKFromSession();
                if (dekLoaded) window.location.href = '/main';
            }
        });
        return () => unsubscribe();
    });

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
        if (password.length < 6) {
            displayMessage("Password must be at least 6 characters long", "bad");
            console.log(messageBoxMessage);
            return false;
        } else if (password.length > 20) {
            displayMessage("Password must be less than 20 characters long", "bad");
            console.log(messageBoxMessage);
            return false;
        } else if (/\s/.test(password)) {
            displayMessage("Password cannot contain spaces", "bad");
            return false;
        }
        setMessageBoxMessage("");
        return true;
    }

    function defaultSignUp(e: React.MouseEvent<HTMLButtonElement>): void {
        e.preventDefault();
        if (password !== confirmPassword) {
            displayMessage("Passwords do not match", "bad");
            console.log(messageBoxMessage);
            return;
        }
        if (checkPassword(password)) {
            handleSignUp();
            return;
        }
        console.log('Password did not meet requirements.');
    }

    function handleSignUp() {
        isSigningIn.current = true;
        createUserWithEmailAndPassword(auth, email.trim(), password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                const capturedPassword = password;

                const dek = await generateDEK();
                const recoveryCode = generateRecoveryCode();
                const encryptedDEK = await wrapDEK(dek, capturedPassword, user.uid);
                const recoveryEncryptedDEK = await wrapDEKWithRecovery(dek, recoveryCode, user.uid);
                const emailEncryptedDEK = await wrapDEKWithEmail(dek, user.email!, user.uid);

                await storeEncryptedDEK(encryptedDEK, recoveryEncryptedDEK, emailEncryptedDEK);
                await setDEK(dek);

                isShowingRecoveryCode.current = true;
                isSigningIn.current = false;
                setRecoveryCodeContext('signup');
                setPendingRecoveryCode(recoveryCode);

                displayMessage("Successfully created account!", "good");
                setEmail("");
                setPassword("");
            })
            .catch((error) => {
                isSigningIn.current = false;
                console.log(error.message);
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
        } catch {
            displayMessage('Could not send reset email. Check your address.', 'bad');
        }
    }

    async function handleSignIn(e: React.MouseEvent<HTMLButtonElement>): Promise<void> {
        e.preventDefault();
        const capturedPassword = password;
        isSigningIn.current = true;

        let userCredential;
        try {
            userCredential = await signInWithEmailAndPassword(auth, email, capturedPassword);
        } catch (error) {
            isSigningIn.current = false;
            displayMessage('Invalid email or password. Please try again', 'bad');
            console.log(error);
            return;
        }

        try {
            const user = userCredential.user;
            const encData = await fetchEncryptedDEK();

            if (encData) {
                try {
                    const dek = await unwrapDEK(encData.encryptedDEK, capturedPassword, user.uid);
                    await setDEK(dek);

                    // Derive email DEK — use stored one or generate fresh if account predates email recovery
                    const emailForDEK = user.email!;
                    const emailEncryptedDEK = encData.emailEncryptedDEK
                        ?? await wrapDEKWithEmail(dek, emailForDEK, user.uid);

                    if (!encData.recoveryCodeAcknowledged) {
                        // Isolated try/catch: failures here must not fall into the unwrapDEK catch below
                        try {
                            const newRecoveryCode = generateRecoveryCode();
                            const newRecoveryEncryptedDEK = await wrapDEKWithRecovery(dek, newRecoveryCode, user.uid);
                            await storeEncryptedDEK(encData.encryptedDEK, newRecoveryEncryptedDEK, emailEncryptedDEK);

                            // Verify we won the concurrent-login race — another device may have written last
                            const verify = await fetchEncryptedDEK();
                            if (verify?.recoveryEncryptedDEK !== newRecoveryEncryptedDEK) {
                                isSigningIn.current = false;
                                window.location.href = '/main';
                                return;
                            }

                            isShowingRecoveryCode.current = true;
                            isSigningIn.current = false;
                            setRecoveryCodeContext('migration');
                            setPendingRecoveryCode(newRecoveryCode);
                        } catch {
                            // Write failed — proceed to app, will prompt again next login
                            isSigningIn.current = false;
                            window.location.href = '/main';
                        }
                    } else {
                        // Silently backfill emailEncryptedDEK for accounts that predate email recovery
                        if (!encData.emailEncryptedDEK) {
                            try { await addEmailEncryptedDEK(emailEncryptedDEK); } catch { /* non-critical */ }
                        }
                        isSigningIn.current = false;
                        window.location.href = '/main';
                    }
                } catch {
                    // DEK decryption failed — password was reset via email, recovery code needed
                    pendingPasswordRef.current = capturedPassword;
                    pendingUidRef.current = user.uid;
                    pendingEncDataRef.current = encData;
                    isSigningIn.current = false;
                    setShowRecoveryInput(true);
                }
            } else {
                // No DEK yet — account predates encryption
                const dek = await generateDEK();
                const recoveryCode = generateRecoveryCode();
                const encryptedDEK = await wrapDEK(dek, capturedPassword, user.uid);
                const recoveryEncryptedDEK = await wrapDEKWithRecovery(dek, recoveryCode, user.uid);
                const emailEncryptedDEK = await wrapDEKWithEmail(dek, user.email!, user.uid);
                await storeEncryptedDEK(encryptedDEK, recoveryEncryptedDEK, emailEncryptedDEK);
                await setDEK(dek);

                isShowingRecoveryCode.current = true;
                isSigningIn.current = false;
                setRecoveryCodeContext('migration');
                setPendingRecoveryCode(recoveryCode);
            }
        } catch (error) {
            isSigningIn.current = false;
            console.error('Encryption setup error:', error);
            displayMessage('Login error — please try again.', 'bad');
        }
    }

    async function handleRecoveryRestore() {
        const encData = pendingEncDataRef.current;
        const uid = pendingUidRef.current;
        const newPassword = pendingPasswordRef.current;
        if (!encData) return;

        // Normalize: strip non-hex characters, reformat to original XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX
        const stripped = recoveryCodeInput.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        const normalized = [0, 10, 20, 30].map(i => stripped.slice(i, i + 10)).join('-');

        let dek: CryptoKey;
        try {
            dek = await unwrapDEKWithRecovery(encData.recoveryEncryptedDEK, normalized, uid);
        } catch {
            displayMessage('Invalid recovery code. Please try again.', 'bad');
            return;
        }

        try {
            const newEncryptedDEK = await wrapDEK(dek, newPassword, uid);
            const newRecoveryCode = generateRecoveryCode();
            const newRecoveryEncryptedDEK = await wrapDEKWithRecovery(dek, newRecoveryCode, uid);
            const newEmailEncryptedDEK = await wrapDEKWithEmail(dek, auth.currentUser!.email!, uid);
            await storeEncryptedDEK(newEncryptedDEK, newRecoveryEncryptedDEK, newEmailEncryptedDEK);
            await setDEK(dek);

            setShowRecoveryInput(false);
            setRecoveryCodeInput("");
            isShowingRecoveryCode.current = true;
            setRecoveryCodeContext('restore');
            setPendingRecoveryCode(newRecoveryCode);
        } catch {
            displayMessage('Could not save your new keys. Please try again.', 'bad');
        }
    }

    async function handleEmailRecovery() {
        const encData = pendingEncDataRef.current;
        const uid = pendingUidRef.current;
        const newPassword = pendingPasswordRef.current;
        const userEmail = auth.currentUser?.email;

        if (!encData?.emailEncryptedDEK || !userEmail) {
            displayMessage('Email recovery is not set up for this account. Use your recovery code.', 'bad');
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
            const newRecoveryCode = generateRecoveryCode();
            const newRecoveryEncryptedDEK = await wrapDEKWithRecovery(dek, newRecoveryCode, uid);
            const newEmailEncryptedDEK = await wrapDEKWithEmail(dek, userEmail, uid);
            await storeEncryptedDEK(newEncryptedDEK, newRecoveryEncryptedDEK, newEmailEncryptedDEK);
            await setDEK(dek);

            setShowRecoveryInput(false);
            isShowingRecoveryCode.current = true;
            setRecoveryCodeContext('restore');
            setPendingRecoveryCode(newRecoveryCode);
        } catch {
            displayMessage('Could not save your new keys. Please try again.', 'bad');
        }
    }

    async function handleRecoveryAcknowledged() {
        isShowingRecoveryCode.current = false;
        setPendingRecoveryCode("");
        try {
            await markRecoveryCodeAcknowledged();
        } catch {
            // Navigate anyway — worst case they're prompted again next login
        }
        window.location.href = '/main';
    }

    function handleCopyRecoveryCode() {
        navigator.clipboard.writeText(pendingRecoveryCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function handleDownloadRecoveryCode() {
        const content = `Intraconnected Recovery Code\n\n${pendingRecoveryCode}\n\nKeep this file safe. It is the only way to recover your data if you lose your password.`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'intraconnected-recovery-code.txt';
        a.click();
        URL.revokeObjectURL(url);
    }

    // Recovery code entry screen (after password reset)
    if (showRecoveryInput) {
        return (
            <div className="recoveryOverlay">
                <div className="recoveryModal neobrutal">
                    <h2 className="recoveryTitle">Restore Encrypted Data</h2>
                    <p className="recoveryWarning">
                        Your password was reset, so your encryption key needs to be restored. Enter your recovery code to regain access to your ideas.
                    </p>
                    <input
                        type="text"
                        className="input neobrutal-input recoveryInput"
                        placeholder="XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX"
                        value={recoveryCodeInput}
                        onChange={(e) => setRecoveryCodeInput(e.target.value)}
                        spellCheck={false}
                    />
                    <div className="recoveryActions">
                        <button className="recoveryCopyBtn neobrutal-button" onClick={signUserOut}>
                            Sign Out
                        </button>
                        <button className="recoveryConfirmBtn neobrutal-button" onClick={handleRecoveryRestore}>
                            Restore Access
                        </button>
                    </div>
                    <button className="recoveryEmailBtn neobrutal-button" onClick={handleEmailRecovery}>
                        Recover via email
                    </button>
                    <MessageBox />
                </div>
            </div>
        );
    }

    // New recovery code display screen (after signup or after successful restore)
    if (pendingRecoveryCode) {
        return (
            <div className="recoveryOverlay">
                <div className="recoveryModal neobrutal">
                    <h2 className="recoveryTitle">Save Your Recovery Code</h2>
                    <p className="recoveryWarning">
                        {recoveryCodeContext === 'signup' && <>Welcome to Intraconnected! Your ideas are encrypted end-to-end. Not even we can read them. Save this recovery code somewhere safe. If you ever forget your password, it's the <strong>only</strong> way to get your data back. It won't be shown again.</>}
                        {recoveryCodeContext === 'migration' && <>We've added end-to-end encryption to Intraconnected. A recovery code has been generated for your account. Save it somewhere safe. If you ever forget your password, it's the <strong>only</strong> way to recover your ideas. It won't be shown again.</>}
                        {recoveryCodeContext === 'restore' && <>Your encryption key has been restored and a new recovery code has been generated. Save it somewhere safe. It won't be shown again.</>}
                    </p>
                    <div className="recoveryCodeBox">
                        <span className="recoveryCodeText">{pendingRecoveryCode}</span>
                    </div>
                    <div className="recoveryActions">
                        <button className="recoveryCopyBtn neobrutal-button" onClick={handleCopyRecoveryCode}>
                            {copied ? "Copied!" : "Copy"}
                        </button>
                        <button className="recoveryDownloadBtn neobrutal-button" onClick={handleDownloadRecoveryCode}>
                            Download .txt
                        </button>
                    </div>
                    <button className="recoveryConfirmBtn neobrutal-button" onClick={handleRecoveryAcknowledged}>
                        I've saved my recovery code
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="auth">
            <MessageBox />
            <div className="largeLogo"><img src="/images/MainLargerLogo.svg" alt="" className="largeLogoImg" /></div>
            <section className="authForm">
                <section className="authInputs">
                    <input type="text" className="input neobrutal-input" placeholder="email@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <div className="passwordField">
                        <input type="password" className="input neobrutal-input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <button className={`forgotPassword ${showConfirmPassword ? "hidden" : ""}`} onClick={handleForgotPassword}>
                            Forgot password?
                        </button>
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
        </div>
    );
};

export default Auth;
