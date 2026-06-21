import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Privacy: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'Privacy Policy — Intraconnected';
    }, []);

    return (
        <div className="privacyPage">
            <div className="privacyContainer">
                <button className="privacyBack neobrutal-button" onClick={() => navigate("/")}>
                    ← Back
                </button>
                <h1 className="privacyTitle">Privacy Policy</h1>
                <p className="privacyMeta">Intraconnected &mdash; Last updated June 19, 2026</p>

                <section className="privacySection">
                    <h2>Overview</h2>
                    <p>
                        Intraconnected is a personal mind-mapping app. We take privacy seriously:
                        your ideas are encrypted on your device before they ever leave it, which means
                        we cannot read your ideas even if we wanted to.
                    </p>
                </section>

                <section className="privacySection">
                    <h2>What We Collect</h2>
                    <p>
                        <strong>Email address</strong> — used solely to create and identify your account.
                        It is never sold, shared with third parties, or used for marketing.
                    </p>
                    <p>
                        <strong>Your ideas</strong> — encrypted on your device before being stored.
                        We cannot read them.
                    </p>
                    <p>
                        <strong>Nothing else.</strong> We do not use analytics, advertising trackers,
                        cookies, or any third-party tracking services beyond Firebase.
                    </p>
                </section>

                <section className="privacySection">
                    <h2>How Your Data Is Protected</h2>
                    <p>
                        Your ideas are encrypted on your device before being sent to our servers.
                        This means:
                    </p>
                    <ul>
                        <li>Only you can decrypt your ideas.</li>
                        <li>If you forget your password, your recovery code is the only way to restore access. We cannot recover your data for you.</li>
                        <li>Even in the event of a data breach, your ideas remain unreadable without your password or recovery code.</li>
                    </ul>
                </section>

                <section className="privacySection">
                    <h2>Third-Party Services</h2>
                    <p>
                        Intraconnected uses <strong>Firebase</strong> (Google LLC) for authentication and
                        encrypted data storage. Firebase is subject to{" "}
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                            Google's Privacy Policy
                        </a>
                        . Your email address is handled by Firebase Authentication. Your encrypted idea
                        data is stored in Firebase Firestore.
                    </p>
                </section>

                <section className="privacySection">
                    <h2>Local Storage</h2>
                    <p>
                        Intraconnected caches data in your browser for performance. This data stays on
                        your device and is cleared when you sign out.
                    </p>
                </section>

                <section className="privacySection">
                    <h2>Your Rights</h2>
                    <p>
                        You may delete your account and all associated data at any time by contacting us
                        at the email below. Because your idea content is end-to-end encrypted, deleting
                        your account permanently destroys any possibility of recovering that data.
                    </p>
                </section>

                <section className="privacySection">
                    <h2>Children's Privacy</h2>
                    <p>
                        Intraconnected is not directed at children under 13. We do not knowingly collect
                        personal information from children under 13.
                    </p>
                </section>

                <section className="privacySection">
                    <h2>Changes to This Policy</h2>
                    <p>
                        If we make material changes to this policy, we will update the date at the top
                        of this page. Continued use of the app after changes constitutes acceptance of
                        the updated policy.
                    </p>
                </section>

                <section className="privacySection">
                    <h2>Contact</h2>
                    <p>
                        Questions? Reach us at{" "}
                        <a href="mailto:gamehunter5879@gmail.com">gamehunter5879@gmail.com</a>.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default Privacy;
