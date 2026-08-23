import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SUPPORT_EMAIL } from "../utilities/support";

const Privacy: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'Privacy Policy | Intraconnected';
    }, []);

    return (
        <div className="legalPage">
            <div className="legalContainer">
                <button className="legalBack neobrutal-button" onClick={() => navigate("/")}>
                    ← Back
                </button>
                <h1 className="legalTitle">Privacy Policy</h1>
                <p className="legalMeta">Intraconnected &mdash; Last updated August 10, 2026</p>

                <section className="legalSection">
                    <h2>Overview</h2>
                    <p>
                        Intraconnected is a personal mind-mapping app, operated by an individual
                        (Hunter Africk), not a company. We take privacy seriously: your ideas are
                        encrypted on your device before they ever leave it, which means we cannot
                        read your ideas even if we wanted to.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>What We Collect</h2>
                    <p>
                        <strong>Email address.</strong> Used solely to create and identify your account.
                        It is never sold, shared with third parties, or used for marketing.
                    </p>
                    <p>
                        <strong>Your ideas.</strong> Encrypted on your device before being stored.
                        We cannot read them.
                    </p>
                    <p>
                        <strong>Nothing else.</strong> We do not use analytics, advertising trackers,
                        cookies, or any third-party tracking services beyond Firebase.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>How Your Data Is Protected</h2>
                    <p>
                        Your ideas are encrypted on your device before being sent to our servers.
                        This means:
                    </p>
                    <ul>
                        <li>Only you can decrypt your ideas.</li>
                        <li>If you forget your password, use "Forgot password" to reset it by email. As long as you still control the email address on your account, your ideas are automatically recovered when you reset your password.</li>
                        <li>If you lose access to both your password and your email account, your ideas cannot be recovered, by you or by us.</li>
                        <li>Even in the event of a data breach, your ideas remain unreadable without your password or access to your email account.</li>
                    </ul>
                </section>

                <section className="legalSection">
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

                <section className="legalSection">
                    <h2>Feature Requests</h2>
                    <p>
                        If you submit a feature request through the app's "Recommend a feature" form,
                        the title and description you write are posted as a <strong>public</strong>{" "}
                        GitHub issue on our project repository so we can track and prioritize it. Do
                        not include personal information in a feature request that you don't want made
                        public. This is unrelated to your idea content, which stays encrypted and
                        private as described above.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Local Storage</h2>
                    <p>
                        Intraconnected caches a decrypted copy of your ideas in your browser for
                        performance. This cache stays on your device and is not sent anywhere. It's
                        refreshed the next time your device syncs with your account, and it's fully
                        cleared if you delete your account. If you use a shared or public computer,
                        clear your browser's site data when you're done.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Your Rights</h2>
                    <p>
                        You can permanently delete your account and all associated data at any time,
                        yourself, from Profile → Delete Account in the app. No need to contact us.
                        Because your idea content is end-to-end encrypted, deleting your account
                        permanently destroys any possibility of recovering that data. If you'd rather
                        we do it for you, or you can't access the app, email us at the address below.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Children's Privacy</h2>
                    <p>
                        Intraconnected is not directed at children under 13. We do not knowingly collect
                        personal information from children under 13.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Changes to This Policy</h2>
                    <p>
                        If we make material changes to this policy, we will update the date at the top
                        of this page. Continued use of the app after changes constitutes acceptance of
                        the updated policy.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Contact</h2>
                    <p>
                        Questions? Reach us at{" "}
                        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See
                        also our <a href="/terms">Terms of Service</a>.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default Privacy;
