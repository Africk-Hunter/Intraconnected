import React from "react";
import { useNavigate } from "react-router-dom";
import { SUPPORT_EMAIL } from "../utilities/support";
import { isNative } from "../utilities/platform";

const Privacy: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="legalPage">
            <div className="legalContainer">
                <button className="legalBack neobrutal-button" onClick={() => navigate(isNative() ? "/login" : "/")}>
                    ← Back
                </button>
                <h1 className="legalTitle">Privacy Policy</h1>
                <p className="legalMeta">Intraconnected | Last updated October 14, 2026</p>

                <section className="legalSection">
                    <h2>Overview</h2>
                    <p>
                        Intraconnected is a personal mind-mapping app, operated by an individual
                        (Hunter Africk), not a company. We take privacy seriously: the text of your
                        ideas is encrypted on your device before it ever leaves it, and we do not look
                        at your ideas. Because we also let you recover your ideas by email if you
                        forget your password, this is not strict end-to-end encryption; see "How
                        Your Data Is Protected" below for exactly what that means.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>What We Collect</h2>
                    <p>
                        <strong>Email address.</strong> Used to create and identify your account, and
                        to send billing receipts through Stripe if you upgrade. We never sell it or use
                        it for marketing.
                    </p>
                    <p>
                        <strong>Your ideas.</strong> The text of each idea (its name, notes, links, and
                        checklist items) is encrypted on your device before being stored. We do not read
                        it. The structure of your map is stored as plain data so that sync and the app
                        can work: which ideas sit under which, their priorities, whether a checklist item
                        is ticked, and when each idea was last changed.
                    </p>
                    <p>
                        <strong>Usage counts, paid accounts only.</strong> Once a day we count the ideas
                        in each paid account, without reading them. If an account's count is unusually
                        high or grows suddenly, we record a flag with the account's email so we can look
                        at it. Nothing is blocked or changed as a result.
                    </p>
                    <p>
                        <strong>Network address, when signed out.</strong> To limit abuse of our
                        sign-in-error and problem-report forms, we store a one-way hash of your IP
                        address for a short time. We cannot reverse it to an address.
                    </p>
                    <p>
                        <strong>Payment information, if you upgrade.</strong> If you choose a paid
                        plan, your card details are collected and processed directly by Stripe, our
                        payment processor, we never see or store your card number. Stripe shares
                        back with us only what's needed to run your account: your plan, purchase
                        date, subscription status, and the Stripe customer and subscription
                        identifiers that link your account to your payments.
                    </p>
                    <p>
                        <strong>Nothing else.</strong> We do not use analytics, advertising trackers,
                        or cookies of our own. We do not sell or share any of the above for
                        marketing purposes.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>How Your Data Is Protected</h2>
                    <p>
                        The text of your ideas is encrypted on your device before being sent to our
                        servers. This means:
                    </p>
                    <ul>
                        <li>What we store on our servers is encrypted, not the readable text of your ideas. The map's structure and timestamps are not encrypted, as described above.</li>
                        <li>If you forget your password, use "Forgot password" to reset it by email. As long as you still control the email address on your account, your ideas are automatically recovered when you reset your password.</li>
                        <li>To make that email recovery possible, we also store a recovery copy of your encryption key, locked with information tied to your account (your email address and account ID) rather than your password. This is a trade-off: it means someone with access to both our database and your account details, including us, could technically decrypt your ideas. We do not do this, and we will not do so unless required by law.</li>
                        <li>If you lose access to both your password and your email account, you will not be able to sign in to recover your ideas yourself.</li>
                    </ul>
                </section>

                <section className="legalSection">
                    <h2>Third-Party Services</h2>
                    <p>
                        Intraconnected uses <strong>Netlify</strong> to host the website and run the
                        server functions that handle billing, account deletion and reports. Every
                        request to the service passes through Netlify. Netlify is subject to{" "}
                        <a href="https://www.netlify.com/privacy/" target="_blank" rel="noopener noreferrer">
                            Netlify's Privacy Policy
                        </a>
                        .
                    </p>
                    <p>
                        Intraconnected uses <strong>Firebase</strong> (Google LLC) for authentication and
                        encrypted data storage. Firebase is subject to{" "}
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                            Google's Privacy Policy
                        </a>
                        . Your email address is handled by Firebase Authentication. Your encrypted idea
                        data is stored in Firebase Firestore.
                    </p>
                    <p>
                        If you upgrade to a paid plan, we use <strong>Stripe</strong> to process your
                        payment. Stripe is subject to{" "}
                        <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
                            Stripe's Privacy Policy
                        </a>
                        . Your card details go directly to Stripe, we never see or store them. The email
                        address on your account is also sent to Stripe, where it is attached to your
                        customer record and used for receipts and payment notices, and it is updated
                        there if you change your email. Stripe also uses cookies and device information
                        of its own for fraud prevention while checkout is open; that's Stripe's
                        processing, not ours, and is covered by their policy above.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Problem Reports</h2>
                    <p>
                        If you send a problem report, we store what you wrote, the technical details
                        shown in the form (such as the page, your browser and any error text), and any
                        contact address you chose to add. If you were signed in, the report is also
                        linked to your account and email so we can follow up. Reports from verified
                        accounts may also be opened as a GitHub issue that contains your description
                        and those technical details, but not your account or contact details. Reports
                        linked to your account are deleted with it. Never include idea content or
                        passwords in a report.
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
                        private as described above. Deleting your account does not remove public
                        GitHub issues that were already posted; you can ask us to close one by email.
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
                    <p>
                        To keep you signed in, your device holds your encryption key: in the browser
                        it is held in the browser's storage, and if you choose "Remember me" it stays
                        for up to 30 days. After 30 minutes without activity (or 30 days with "Remember
                        me"), you are signed out and the key is removed from the device.
                    </p>
                    <p>
                        In the mobile app, the encryption key is kept in the device's secure storage
                        (the iOS Keychain or Android Keystore). It is not backed up to the cloud and
                        does not leave the device.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Your Rights</h2>
                    <p>
                        You can download a copy of your data at any time from Profile → Export Your
                        Data, on any plan. You can choose Markdown or OPML (your decrypted ideas,
                        for use in other notes, outliner or mind-map apps) or JSON (your decrypted
                        ideas plus basic account information, as a full backup).
                    </p>
                    <p>
                        You can permanently delete your account and all associated data at any time,
                        yourself, from Profile → Delete Account in the app. No need to contact us.
                        Deleting your account permanently erases your ideas and every copy of your
                        encryption key from our servers, so that data cannot be recovered afterward, along with any problem reports you sent while signed in. Payment records held by our payment processor (Stripe), such as past charges and the email on them, are kept as the processor and tax rules require. Public GitHub issues are not removed (see Feature Requests). If you'd rather
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
