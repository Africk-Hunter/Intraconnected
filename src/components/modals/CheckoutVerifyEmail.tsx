import { useState } from "react";
import { auth } from "../../firebaseConfig";
import { resendVerificationEmail, refreshEmailVerified } from "../../utilities/firebase/authFirebase";
import { isGmailAddress, gmailVerifySearchUrl } from "../../utilities/gmail";

interface Props {
    onVerified: () => void;
}

// Shown in place of the checkout form when create-payment-intent refuses an
// unverified account. Mirrors the Profile → Verify Your Email actions so the
// person can finish verifying without leaving checkout.
function CheckoutVerifyEmail({ onVerified }: Props) {
    const email = auth.currentUser?.email ?? '';
    const [sent, setSent] = useState(false);
    const [checking, setChecking] = useState(false);
    const [message, setMessage] = useState('');

    async function handleSend() {
        setMessage('');
        try {
            await resendVerificationEmail();
            setSent(true);
        } catch {
            setMessage("Couldn't send the email. Please try again in a moment.");
        }
    }

    async function handleCheck() {
        setChecking(true);
        setMessage('');
        try {
            if (await refreshEmailVerified()) {
                onVerified();
                return;
            }
            setMessage("Not verified yet. Click the link in the email, then try again.");
        } catch {
            setMessage("Couldn't check right now. Please try again.");
        } finally {
            setChecking(false);
        }
    }

    return (
        <div className="checkoutVerify">
            <div className="checkoutVerify-icon" aria-hidden="true">✉️</div>
            <h2 className="checkoutVerify-title">One quick step first</h2>
            <p className="checkoutVerify-text">
                Confirm your email address and you're ready to upgrade.
                {email && <> We sent a link to <strong>{email}</strong>.</>}
            </p>
            <div className="checkoutVerify-actions">
                {email && isGmailAddress(email) && (
                    <a
                        className="checkoutVerify-btn neobrutal-button"
                        href={gmailVerifySearchUrl(email)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open Gmail
                    </a>
                )}
                <button className="checkoutVerify-btn neobrutal-button" onClick={handleCheck} disabled={checking}>
                    {checking ? 'Checking…' : "I've verified, continue"}
                </button>
                <button className="checkoutVerify-btn neutral neobrutal-button" onClick={handleSend} disabled={sent}>
                    {sent ? 'Email sent' : "Didn't get it? Resend"}
                </button>
            </div>
            {message && <p className="checkoutVerify-message">{message}</p>}
        </div>
    );
}

export default CheckoutVerifyEmail;
