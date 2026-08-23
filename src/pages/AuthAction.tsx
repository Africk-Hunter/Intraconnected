import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../firebaseConfig";
import {
    applyActionCode,
    checkActionCode,
    confirmPasswordReset,
    verifyPasswordResetCode,
} from "firebase/auth";

type Status = "working" | "verified" | "resetForm" | "resetDone" | "recovered" | "error";

// Firebase's default action-handler page (the one its emails link to unless
// the project's Console > Authentication > Templates > "Customize action
// URL" is pointed here) is a generic, unbranded Google page. This route
// replaces it — it reads the same mode/oobCode query params Firebase would
// have handled itself and performs the equivalent Auth SDK calls directly.
const AuthAction: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");

    const [status, setStatus] = useState<Status>("working");
    const [errorMessage, setErrorMessage] = useState("");
    const [resetEmail, setResetEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [formError, setFormError] = useState("");

    useEffect(() => {
        document.title = "Intraconnected";
    }, []);

    useEffect(() => {
        if (!mode || !oobCode) {
            setStatus("error");
            setErrorMessage("This link is missing information and can't be used.");
            return;
        }

        if (mode === "verifyEmail") {
            applyActionCode(auth, oobCode)
                .then(() => setStatus("verified"))
                .catch(() => {
                    setStatus("error");
                    setErrorMessage("This verification link is invalid or has expired. You can request a new one from Profile once you're signed in.");
                });
        } else if (mode === "resetPassword") {
            verifyPasswordResetCode(auth, oobCode)
                .then((email) => {
                    setResetEmail(email);
                    setStatus("resetForm");
                })
                .catch(() => {
                    setStatus("error");
                    setErrorMessage("This password reset link is invalid or has expired. Request a new one from the sign-in screen.");
                });
        } else if (mode === "recoverEmail") {
            checkActionCode(auth, oobCode)
                .then(() => applyActionCode(auth, oobCode))
                .then(() => setStatus("recovered"))
                .catch(() => {
                    setStatus("error");
                    setErrorMessage("This link is invalid or has expired.");
                });
        } else {
            setStatus("error");
            setErrorMessage("This link isn't recognized.");
        }
    }, [mode, oobCode]);

    async function handleResetPassword(e: React.FormEvent) {
        e.preventDefault();
        setFormError("");

        // Same length policy as sign-up (see Auth.tsx checkPassword).
        if (newPassword.length < 8) {
            setFormError("Password must be at least 8 characters long");
            return;
        } else if (newPassword.length > 128) {
            setFormError("Password must be less than 128 characters long");
            return;
        } else if (newPassword !== confirmNewPassword) {
            setFormError("Passwords do not match");
            return;
        }

        try {
            await confirmPasswordReset(auth, oobCode!, newPassword);
            setStatus("resetDone");
        } catch {
            setFormError("Could not reset your password. The link may have expired — request a new one.");
        }
    }

    return (
        <div className="auth authAction">
            <div className="largeLogo"><img src="/images/MainLargerLogo.svg" alt="" className="largeLogoImg" /></div>

            <div className="authActionCard neobrutal">
                {status === "working" && (
                    <p className="authActionText">One moment…</p>
                )}

                {status === "verified" && (
                    <>
                        <h1 className="authActionTitle">Email verified</h1>
                        <p className="authActionText">Your email address is confirmed. You're all set.</p>
                        <button className="authActionBtn neobrutal-button leaf" onClick={() => navigate("/main")}>
                            Go to Intraconnected
                        </button>
                    </>
                )}

                {status === "resetForm" && (
                    <form className="authActionForm" onSubmit={handleResetPassword}>
                        <h1 className="authActionTitle">Reset your password</h1>
                        <p className="authActionText">for {resetEmail}</p>
                        <input
                            type="password"
                            className="input neobrutal-input"
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <input
                            type="password"
                            className="input neobrutal-input"
                            placeholder="Confirm new password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                        />
                        {formError && <p className="authActionError">{formError}</p>}
                        <button type="submit" className="authActionBtn neobrutal-button leaf">
                            Set new password
                        </button>
                    </form>
                )}

                {status === "resetDone" && (
                    <>
                        <h1 className="authActionTitle">Password updated</h1>
                        <p className="authActionText">You can now sign in with your new password.</p>
                        <button className="authActionBtn neobrutal-button leaf" onClick={() => navigate("/")}>
                            Go to sign in
                        </button>
                    </>
                )}

                {status === "recovered" && (
                    <>
                        <h1 className="authActionTitle">Email restored</h1>
                        <p className="authActionText">Your email address has been reverted. If you didn't request this change, reset your password right away.</p>
                        <button className="authActionBtn neobrutal-button leaf" onClick={() => navigate("/")}>
                            Go to sign in
                        </button>
                    </>
                )}

                {status === "error" && (
                    <>
                        <h1 className="authActionTitle">Link not valid</h1>
                        <p className="authActionText">{errorMessage}</p>
                        <button className="authActionBtn neobrutal-button neutral" onClick={() => navigate("/")}>
                            Back to sign in
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default AuthAction;
