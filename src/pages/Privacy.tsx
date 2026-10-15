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
                        Intraconnected is a personal app for growing ideas on a tree, operated by an individual
                        (Hunter Africk), not a company. Hunter Africk is the "controller" of your
                        personal data (the person who decides how it is used), and "we" in this
                        policy means him. We take privacy seriously: the text of your
                        ideas is encrypted on your device before it leaves it. We do not read ideas
                        in the ordinary course of operating the service, but this is not end-to-end
                        encryption: our recovery system can technically unlock your encryption key;
                        see "How Your Data Is Protected" below.
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
                        it in the ordinary course of operating the service. The structure of your tree
                        is stored as plain data so that sync and the app can work: which ideas sit
                        under which, whether each is an idea, note or
                        checklist, their priorities, whether an idea is censored, whether a checklist
                        item is ticked, and when each idea was created and last changed. Idea IDs
                        reflect their creation time, and ciphertext lengths are visible. Because you
                        decide what to write, your ideas may contain any kind of information about
                        you or others, including sensitive information. We do not use it for any
                        purpose other than providing the service to you.
                    </p>
                    <p>
                        <strong>Sync and app settings.</strong> A random identifier for each device you
                        sign in on, so your devices know when to sync with each other, and a few
                        settings such as whether you've seen the welcome tips and which patch notes
                        you've read.
                    </p>
                    <p>
                        <strong>Usage counts, paid accounts only.</strong> Once a day we count the ideas
                        in each paid account, without reading them, and keep the latest count. If an
                        account's count is unusually high or grows suddenly, we record a flag with the
                        account's email so we can look at it, and post a notice containing only the
                        counts (no account details) to our public issue tracker on GitHub. Nothing is
                        blocked or changed as a result, and no decision about you is made by
                        automated means.
                    </p>
                    <p>
                        <strong>Network address, when signed out.</strong> To limit abuse of our
                        problem-report form, which also opens from sign-in errors, we store a keyed
                        one-way hash of your IP address. We cannot reverse it to an address, and it is
                        deleted automatically a few days after your last report.
                    </p>
                    <p>
                        <strong>Hosting logs.</strong> Our hosting and authentication providers
                        (Netlify and Google) necessarily receive your IP address and basic request
                        details whenever your device contacts the service, and they may keep
                        ordinary server logs of them under their own policies (see Third-Party
                        Services).
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
                        marketing or advertising purposes, and we have not done so in the past
                        12 months.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Why We Use Your Data</h2>
                    <p>
                        We use your data only to run the service you asked for: to create and
                        secure your account, store and sync your ideas, process payments and keep
                        your plan accurate, recover your account, answer problem reports, prevent
                        abuse and keep the service running and secure, and meet legal obligations.
                    </p>
                    <p>
                        If you are in the European Economic Area, the United Kingdom or a similar
                        region, the legal bases for this are: performing our contract with you
                        (account, sync, billing, recovery); our legitimate interests in keeping the
                        service secure, preventing abuse and keeping costs sustainable (the
                        abuse-prevention hash, usage counts and logs), which we balance against your
                        rights; compliance with legal obligations (tax and accounting records,
                        responding to valid legal requests); and, where we ask for it, your
                        consent, which you can withdraw at any time.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>How Your Data Is Protected</h2>
                    <p>
                        We use technical safeguards to protect your information. Idea text is
                        encrypted on your device before it is sent to our servers, and connections
                        between the app and our services use HTTPS/TLS. The encryption works as
                        follows:
                    </p>
                    <ul>
                        <li>
                            Idea names, notes, links, and checklist text are encrypted individually
                            with AES-256-GCM before syncing. We store the encrypted text in
                            Firestore. The map's structure, idea IDs, creation and update times,
                            priorities, checklist completion state, and ciphertext lengths are not
                            encrypted.
                        </li>
                        <li>
                            A randomly generated data key encrypts your idea text. Your password
                            protects a wrapped copy of that key; the password itself is not stored.
                            To support account recovery, the service also stores a separate
                            encrypted copy of the data key. For accounts using KMS recovery, that
                            copy is encrypted to a public key, and the corresponding private key is
                            held in Google Cloud KMS. Some older account records may instead
                            contain a legacy recovery copy protected by a key derived from the
                            account email address and ID. Those are not secret values, so a person
                            with a database copy and the associated email address could derive
                            that legacy recovery key.
                        </li>
                        <li>
                            KMS recovery requires an authenticated account and a recent sign-in.
                            When the service requests a key recovery, Google records the KMS
                            decryption in Cloud Audit Logs, and we record the successful recovery
                            in an account audit log and show an in-app notice. These safeguards
                            help protect the stored recovery copy and make its use visible; they do
                            not prevent us, as the service operator, from technically recovering
                            the key and decrypting idea text.
                        </li>
                        <li>
                            The app needs access to the key to display your ideas. Scripts or
                            browser extensions running in the page may be able to use it while you
                            are signed in, and the web app is delivered by us. On a device, a
                            decrypted copy of your ideas is cached for the app to use.
                        </li>
                        <li>
                            If you forget your password, reset it through your email account and
                            sign in with the new password to restore access when a recovery copy is
                            available. If you lose access to both your password and email account,
                            you may not be able to recover your ideas.
                        </li>
                        <li>
                            Vault notes get a second layer of encryption. Their name, text and link
                            are encrypted on your device with a separate vault key before the
                            encryption described above is applied. The vault key is protected by
                            your vault passphrase and by a recovery code that only you are shown. We
                            never receive your vault passphrase, your recovery code or the vault key,
                            and our key recovery system cannot unlock vault notes, so we cannot read
                            them. Which ideas are vault notes, where they sit in your tree, their
                            priority and their approximate size are not hidden. The web app is
                            delivered by our servers each time you open it, so this protection
                            relies on that code working as described; in the mobile apps, the code
                            is fixed when the app is installed or updated. If you forget your vault
                            passphrase and lose your recovery code, no one, including us, can open
                            your vault notes.
                        </li>
                        <li>
                            No system is perfectly secure. If a breach affects your personal data in
                            a way that the law requires us to report, we will notify you and the
                            relevant authorities as required, without undue delay.
                        </li>
                    </ul>
                </section>

                <section className="legalSection">
                    <h2>Third-Party Services</h2>
                    <p>
                        We share personal data only with the service providers below, who process it
                        to run the service, and in the situations described under Legal Requests and
                        Business Transfers. We do not sell your personal data.
                    </p>
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
                        When KMS recovery is enabled for your account, <strong>Google Cloud KMS</strong>
                        holds the private recovery key. With Data Access audit logging enabled,
                        Google records key-decryption operations in Cloud Audit Logs; our service
                        also records successful recoveries so the app can notify you.
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
                    <p>
                        The website and app load their fonts from <strong>Google Fonts</strong>, so your
                        device requests them from Google's servers, which receive your IP address and browser
                        details as part of that request. Google Fonts is subject to{" "}
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                            Google's Privacy Policy
                        </a>
                        .
                    </p>
                </section>

                <section className="legalSection">
                    <h2>International Transfers</h2>
                    <p>
                        We operate from the United States, and our providers process data in the
                        United States and other countries. If you use the service from the EEA, the
                        UK or Switzerland, your data is therefore transferred outside your region.
                        Where required, those transfers rely on the safeguards our providers offer,
                        such as the EU-U.S. Data Privacy Framework or Standard Contractual Clauses.
                        You can ask us for details using the contact address below.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Problem Reports</h2>
                    <p>
                        If you send a problem report, we store what you wrote, the technical details
                        shown in the form (such as the page, your browser and any error text), and any
                        contact address you chose to add. If you were signed in, the report is also
                        linked to your account and email so we can follow up. Reports from verified
                        accounts may also be posted as a <strong>public</strong> issue on our GitHub
                        project, containing your description and those technical details, but not your
                        account or contact details. Reports linked to your account are deleted with it;
                        public GitHub issues are not (you can ask us to remove one by email). A report
                        sent while signed out isn't linked to any account, so to have it deleted, email
                        us. Never include idea content, passwords or anything else private in a report.
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
                        it is held as a non-extractable key in browser storage. Without "Remember me"
                        it is limited to the current tab session; with "Remember me" it can remain
                        available for up to 30 days. After 30 minutes without activity (or 30 days
                        with "Remember me"), you are signed out and the key is removed from the device.
                    </p>
                    <p>
                        In the mobile app, the encryption key is kept in the device's secure storage
                        (the iOS Keychain or Android Keystore). It is not backed up to the cloud and
                        does not leave the device.
                    </p>
                    <p>
                        This browser and device storage is strictly necessary for the service to
                        work and to keep your account secure, and is used for nothing else, so we do
                        not show a cookie banner. It is not used to track you across other sites. We
                        do not sell or share personal data, so there is nothing for an opt-out
                        signal such as Global Privacy Control or "Do Not Track" to change; we treat
                        such a signal as a valid opt-out request regardless.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>How Long We Keep Data</h2>
                    <ul>
                        <li>Your ideas, account details and settings: until you delete your account.</li>
                        <li>The abuse-prevention hash of your IP address: deleted automatically a few days after your last report.</li>
                        <li>Problem reports linked to your account and usage counts and flags: until you delete your account.</li>
                        <li>
                            Billing records: Stripe keeps payment records as long as the law and tax
                            rules require, even after you delete your account.
                        </li>
                        <li>
                            Google Cloud Audit Logs of key recovery: kept by Google under its own
                            retention settings.
                        </li>
                        <li>Public GitHub issues: until we close or remove them on request.</li>
                    </ul>
                </section>

                <section className="legalSection">
                    <h2>Your Rights</h2>
                    <p>
                        You can download a copy of your data at any time from Profile → Data → Export
                        Your Data, on any plan. You can choose Markdown or OPML (your decrypted ideas,
                        for use in other notes, outliner or mind-map apps) or JSON (your decrypted
                        ideas plus basic account information, as a full backup). Vault notes are not
                        included in these exports; you can export them separately from Profile →
                        Vault while your vault is unlocked, and that file is not encrypted.
                    </p>
                    <p>
                        You can permanently delete your account and all associated data at any time,
                        yourself, from Profile → Danger Zone → Delete Account in the app. No need to contact us.
                        Deleting your account permanently erases your ideas and every copy of your
                        encryption key and recovery audit records from our servers, so that data cannot be recovered afterward, along with any problem reports you sent while signed in and any usage counts and flags. Payment records held by our payment processor (Stripe), such as past charges and the email on them, are kept as the processor and tax rules require. Public GitHub issues are not removed (see Problem Reports and Feature Requests). If you'd rather
                        we do it for you, or you can't access the app, email us at the address below.
                    </p>
                    <p>
                        <strong>Other rights.</strong> Depending on where you live (including the
                        EEA, the UK, California and other US states with privacy laws), you may also
                        have the right to: know what personal data we hold about you and get a
                        copy; correct it (you can edit your ideas and your account email in the app);
                        delete it; receive it in a portable format; restrict or object to some uses;
                        withdraw consent you gave; and not be treated differently for using these
                        rights. We do not sell or share personal data and do not use it for
                        targeted advertising or automated decisions about you. We do not use
                        sensitive personal information to infer characteristics about you.
                    </p>
                    <p>
                        <strong>How to use them.</strong> Email us at the address below. We may need
                        to confirm the request comes from the account's email address before
                        acting on it. We respond within one month (45 days for US state requests,
                        extendable once where the law allows). You can also ask an authorized
                        agent to make a request for you. Because your idea text is encrypted, a
                        copy of it comes from the in-app export, which decrypts it on your device. If we decline a request, you can
                        appeal by replying to our answer, and if you are still unhappy you can
                        complain to your data protection authority (in the EU, the authority in your
                        country; in the UK, the Information Commissioner's Office) or, in the US, to
                        your state attorney general.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Legal Requests</h2>
                    <p>
                        We may disclose personal data if a valid legal process requires it, or if
                        needed to protect people from serious harm or to defend our legal rights.
                        Because the recovery system can technically unlock your encryption key, we
                        could be required to use it. We review each request for validity and
                        disclose only what the law requires, and unless the law forbids it, we will
                        tell you before we do.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Business Transfers</h2>
                    <p>
                        If the service is sold, transferred or restructured, your data may move to
                        the new operator. We will tell you before that happens, and the new
                        operator must honor this policy or give you a fresh choice, including the
                        option to export and delete your data.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Children's Privacy</h2>
                    <p>
                        Intraconnected is not directed at children under 13 (or under the higher age
                        of digital consent in your country, up to 16). We do not knowingly collect
                        personal information from them. If you believe a child has given us personal
                        information, contact us and we will delete it.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Changes to This Policy</h2>
                    <p>
                        If we make material changes to this policy, we will update the date at the top
                        of this page and notify you in the app or by email before the change takes
                        effect. We will not use personal data we already hold for a materially
                        different purpose without telling you first and, where the law requires,
                        getting your consent.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>Contact</h2>
                    <p>
                        Questions or privacy requests? Reach us at{" "}
                        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See
                        also our <a href="/terms">Terms of Service</a>.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default Privacy;
