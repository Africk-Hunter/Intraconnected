import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SUPPORT_EMAIL } from "../utilities/support";

const Terms: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'Terms of Service | Intraconnected';
    }, []);

    return (
        <div className="legalPage">
            <div className="legalContainer">
                <button className="legalBack neobrutal-button" onClick={() => navigate("/")}>
                    ← Back
                </button>
                <h1 className="legalTitle">Terms of Service</h1>
                <p className="legalMeta">Intraconnected &mdash; Last updated August 10, 2026</p>

                <section className="legalSection">
                    <h2>1. Who We Are</h2>
                    <p>
                        Intraconnected (the "Service") is operated by Hunter Africk, an individual,
                        not a company ("we", "us", "our"). By creating an account or using the
                        Service, you agree to these Terms of Service ("Terms") and to our{" "}
                        <a href="/privacy">Privacy Policy</a>. If you don't agree, don't use the
                        Service.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>2. Eligibility</h2>
                    <p>
                        You must be at least 13 years old to use Intraconnected. By using the
                        Service, you confirm that you meet this requirement.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>3. Your Account</h2>
                    <p>
                        You're responsible for keeping your password and any device you stay signed
                        in on secure, and for keeping the email address on your account current and
                        accessible, since it's also used for account recovery (see Section 4). You're
                        responsible for all activity that happens under your account. Tell us right
                        away if you believe your account has been compromised.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>4. Encryption and Data Loss (Please Read)</h2>
                    <p>
                        Your idea content is encrypted on your device before it's sent to our
                        servers, and we do not hold a copy of your password. This is a deliberate
                        design choice that protects your privacy, but it has a real consequence:
                    </p>
                    <ul>
                        <li>
                            If you forget your password, use "Forgot password" to reset it by email.
                            As long as you still control the email address on your account, resetting
                            your password automatically restores access to your content. No recovery
                            code or separate backup is needed.
                        </li>
                        <li>
                            If you lose access to both your password and the email address on your
                            account, your content is permanently and irrecoverably lost. There is no
                            other way to recover it, not for us, and not for anyone else.
                        </li>
                        <li>
                            We are not liable for data loss resulting from losing access to both your
                            password and your email account, device failure, accidental deletion, or
                            account deletion. Keep the email address on your account current and
                            secure.
                        </li>
                    </ul>
                </section>

                <section className="legalSection">
                    <h2>5. Your Content</h2>
                    <p>
                        You own the ideas, notes, and content you create in Intraconnected. We don't
                        claim any ownership over it, and because it's end-to-end encrypted, we can't
                        read it. You're solely responsible for what you store in the Service.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>6. Acceptable Use</h2>
                    <p>You agree not to:</p>
                    <ul>
                        <li>Use the Service for anything illegal, or to store or transmit content you don't have the right to.</li>
                        <li>Attempt to access another user's account or data, or to bypass or interfere with the Service's security, encryption, or infrastructure.</li>
                        <li>Abuse, overload, or attempt to scrape or automate interactions with the Service in a way that degrades it for other users.</li>
                    </ul>
                    <p>
                        We may suspend or terminate accounts that violate this section.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>7. Feature Requests</h2>
                    <p>
                        If you submit a feature request through the app, its title and description
                        are posted as a public GitHub issue, as described in our{" "}
                        <a href="/privacy">Privacy Policy</a>. By submitting a feature request, you
                        agree it can be published in this way, and you grant us permission to use,
                        adapt, and implement the idea in the Service without any obligation or
                        compensation owed to you.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>8. Paid Features</h2>
                    <p>
                        Intraconnected is currently free to use. We may introduce paid plans or
                        paid features in the future. If we do, the applicable price, billing
                        frequency, and cancellation and refund terms will be shown to you before you
                        pay for anything, and those terms will apply in addition to this section. You
                        can cancel a paid plan at any time; unless stated otherwise when you
                        subscribe, cancellation stops future billing but does not refund amounts
                        already paid.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>9. Termination</h2>
                    <p>
                        You can delete your account at any time from Profile → Delete Account in the
                        app, which permanently and immediately deletes your data. See our{" "}
                        <a href="/privacy">Privacy Policy</a> for details. We may suspend or
                        terminate your access to the Service if you violate these Terms, or
                        discontinue the Service entirely, with notice where reasonably possible.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>10. The Service Is Provided "As Is"</h2>
                    <p>
                        Intraconnected is provided on an "as is" and "as available" basis, without
                        warranties of any kind, whether express or implied, including warranties of
                        merchantability, fitness for a particular purpose, or non-infringement. We
                        don't guarantee the Service will be uninterrupted, error-free, or that any
                        data will be preserved indefinitely, though we take reasonable steps to keep
                        the Service running and your data intact.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>11. Limitation of Liability</h2>
                    <p>
                        To the fullest extent permitted by law, we are not liable for any indirect,
                        incidental, special, consequential, or punitive damages, or any loss of data,
                        arising out of or related to your use of the Service, even if advised of the
                        possibility of such damages. Our total liability to you for any claim arising
                        from the Service will not exceed the greater of (a) the amount you paid us in
                        the twelve months before the claim, or (b) $50 USD.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>12. Changes to These Terms</h2>
                    <p>
                        If we make material changes to these Terms, we'll update the date at the top
                        of this page. Continued use of the Service after changes take effect
                        constitutes acceptance of the updated Terms.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>13. Governing Law</h2>
                    <p>
                        These Terms are governed by the laws of the State of Nevada, USA, without
                        regard to conflict-of-law principles, regardless of where you access the
                        Service from.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>14. Contact</h2>
                    <p>
                        Questions about these Terms? Reach us at{" "}
                        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default Terms;
