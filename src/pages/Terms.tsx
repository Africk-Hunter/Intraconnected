import React from "react";
import { useNavigate } from "react-router-dom";
import { SUPPORT_EMAIL } from "../utilities/support";
import { isNative } from "../utilities/platform";
import { ANNUAL_PRICE_DISPLAY, LIFETIME_PRICE_DISPLAY } from "../utilities/billing/pricingDisplay";

const Terms: React.FC = () => {

    const navigate = useNavigate();

    return (
        <div className="legalPage">
            <div className="legalContainer">
                <button className="legalBack neobrutal-button" onClick={() => navigate(isNative() ? "/login" : "/")}>
                    ← Back
                </button>
                <h1 className="legalTitle">Terms of Service</h1>
                <p className="legalMeta">Intraconnected | Last updated October 14, 2026</p>

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
                    <h2>4. Encryption and Data Loss</h2>
                    <p>
                        Your idea content is encrypted on your device before it's sent to our
                        servers, and we do not hold a copy of your password. To support recovery by
                        email, we also store a recovery copy of your encryption key (see the{" "}
                        <a href="/privacy">Privacy Policy</a>). Older accounts may use a legacy
                        recovery copy encrypted with a key derived from the account email address
                        and ID, neither of which is secret. For accounts enrolled in the new system,
                        a public key wraps the recovery copy and its private counterpart is held in
                        Google Cloud KMS. Our server can ask KMS to unlock it; with Cloud KMS
                        Data Access audit logging enabled, Google records each decryption and the
                        app shows an in-app notice. We can technically decrypt
                        content through this recovery path, though we do not do so in the ordinary
                        course of operating the Service. Scripts or browser extensions running in
                        the page can also use the key while you are signed in, and you must trust the
                        app code delivered to your browser. Idea IDs, map structure, timestamps and
                        ciphertext lengths are visible. No encryption or security measure is
                        perfect, and we don't guarantee that your data will never be accessed by
                        anyone else. This design has real consequences:
                    </p>
                    <ul>
                        <li>
                            If you forget your password, use "Forgot password" to reset it by email.
                            Then sign in with the new password to restore access to your content.
                            Existing accounts move to the new recovery system only after it is
                            enabled and they next sign in; accounts that never do remain on the
                            legacy recovery copy.
                        </li>
                        <li>
                            If you lose access to both your password and the email address on your
                            account, you will not be able to sign in to recover your content, and we
                            do not offer a manual recovery process.
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
                        claim any ownership over it, and we don't access it in the ordinary course of
                        running the Service. You grant us only the limited permission needed to
                        store, encrypt, sync, and display it to you. You're solely responsible for
                        what you store in the Service, and for keeping your own backups (the Profile
                        → Data export is available for this).
                    </p>
                </section>

                <section className="legalSection">
                    <h2>6. Acceptable Use</h2>
                    <p>You agree not to:</p>
                    <ul>
                        <li>Use the Service for anything illegal, or to store or transmit content you don't have the right to.</li>
                        <li>Attempt to access another user's account or data, or to bypass or interfere with the Service's security, encryption, or infrastructure.</li>
                        <li>Abuse, overload, or attempt to scrape or automate interactions with the Service in a way that degrades it for other users.</li>
                        <li>
                            Use a paid plan for far more than normal personal use, such as storing or bulk-importing hundreds of
                            thousands of ideas, or creating ideas by automated means. Paid plans have no fixed idea limit, but
                            the Service has real running costs for every idea you store.
                        </li>
                    </ul>
                    <p>
                        We may suspend or terminate accounts that violate this section. For heavy but good-faith use, we will
                        usually contact you first, and may limit imports or ask you to reduce your usage.
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
                        Intraconnected is free to use up to a limited number of ideas. Beyond that,
                        we offer two paid plans, billed through Stripe, our payment processor (see
                        our <a href="/privacy">Privacy Policy</a> for what Stripe receives):
                    </p>
                    <ul>
                        <li>
                            <strong>Annual ({ANNUAL_PRICE_DISPLAY}/year).</strong> A recurring
                            subscription that renews automatically each year at the then-current
                            price. You can cancel at any time from Profile → Account; cancellation
                            stops future renewal but does not refund the current billing period,
                            you keep full access through the end of the period you already paid
                            for.
                        </li>
                        <li>
                            <strong>Lifetime ({LIFETIME_PRICE_DISPLAY} one time).</strong> A single
                            payment for permanent access, with no recurring charges. If you change
                            your mind, you can request a full, self-serve refund from Profile →
                            Account within 14 days of purchase, no questions asked; after that
                            window, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
                            and we'll take it case by case.
                        </li>
                    </ul>
                    <p>
                        Prices are shown to you before you pay, and may change for future
                        purchases, a change never affects a plan you've already paid for. If we
                        introduce additional paid plans or features, their price and terms will be
                        shown to you before you pay for anything, and will apply in addition to
                        this section.
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
                        the Service running and your data intact. The Service is operated by one
                        person and relies on third-party providers (including Google Firebase,
                        Netlify, and Stripe); we are not responsible for outages, data loss, or
                        changes caused by them or by other events outside our reasonable control.
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
                        the twelve months before the claim, or (b) $50 USD. These limits apply to
                        Hunter Africk personally, as the operator of the Service, as well as to the
                        Service itself.
                        Some places don't allow certain limits or exclusions, so parts of this
                        section may not apply to you; in that case they apply to the fullest extent
                        the law allows.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>12. Indemnification</h2>
                    <p>
                        You agree to defend and hold harmless Hunter Africk and the Service from any
                        claim, loss, or expense (including reasonable legal fees) arising from
                        content you store in the Service, your violation of these Terms, or your
                        violation of any law or third party's rights.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>13. Changes to These Terms</h2>
                    <p>
                        If we make material changes to these Terms, we'll update the date at the top
                        of this page and, where reasonably possible, notify you in the app or by
                        email. Continued use of the Service after changes take effect constitutes
                        acceptance of the updated Terms. If you don't agree, stop using the Service
                        and delete your account.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>14. Governing Law and Disputes</h2>
                    <p>
                        These Terms are governed by the laws of the State of Nevada, USA, without
                        regard to conflict-of-law principles, regardless of where you access the
                        Service from. Before filing a claim, please email{" "}
                        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and give us 30 days to
                        try to resolve it informally. Any dispute that isn't resolved will be
                        brought only in the state or federal courts located in Nevada, and you
                        consent to their jurisdiction. To the extent the law allows, you may bring
                        claims only on your own behalf, not as part of a class or representative
                        action.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>15. Mobile App Stores</h2>
                    <p>
                        If you use the Service through the Apple App Store or Google Play, these
                        Terms are between you and us, not Apple or Google. Apple and Google have no
                        obligation to provide support or maintenance for the app and are not
                        responsible for any claims relating to it. Apple and its subsidiaries are
                        third-party beneficiaries of these Terms as they apply to the iOS app. You
                        must also comply with the store's own terms.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>16. General</h2>
                    <p>
                        These Terms and the Privacy Policy are the entire agreement between you and
                        us about the Service. If any part is found unenforceable, the rest stays in
                        effect. Our not enforcing a provision isn't a waiver of it. You may not
                        transfer your account or these Terms to anyone else; we may transfer ours as
                        part of a sale or restructuring of the Service. Sections that by their
                        nature should survive termination (including 5, 10, 11, 12 and 14) do.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>17. Contact</h2>
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
