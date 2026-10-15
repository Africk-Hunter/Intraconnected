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
                        You must be at least 13 years old to use Intraconnected, and old enough in
                        your country to enter into a contract or to consent to the processing of
                        your data (in some countries that age is higher than 13, up to 16). If you
                        are under that age, don't use the Service. By using it, you confirm that
                        you meet these requirements. If we learn that someone doesn't, we may close
                        the account.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>3. Your Account</h2>
                    <p>
                        You're responsible for keeping your password and any device you stay signed
                        in on secure, and for keeping the email address on your account current and
                        accessible, since it's also used for account recovery (see Section 4). You're
                        responsible for all activity that happens under your account. Tell us right
                        away if you believe your account has been compromised. Give us accurate
                        information when you sign up and keep it up to date.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>4. Encryption and Data Loss</h2>
                    <p>
                        Your idea content is encrypted on your device before it's sent to our
                        servers, and we do not hold a copy of your password. This is not end-to-end
                        encryption: to support recovery by
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
                    <p>
                        <strong>Vault notes.</strong> Vault notes are encrypted with a key protected
                        by a passphrase and a recovery code that we never receive. We cannot recover
                        vault notes or reset a vault passphrase for you. If you lose both your vault
                        passphrase and your recovery code, your vault notes cannot be opened again,
                        and the only option is to delete them with Reset vault. You are responsible
                        for keeping your recovery code safe.
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
                            To the extent the law allows (see Section 12), we are not liable for data
                            loss resulting from losing access to both your password and your email
                            account, device failure, accidental deletion, or account deletion. Keep
                            the email address on your account current and secure, and keep your own
                            backups.
                        </li>
                    </ul>
                </section>

                <section className="legalSection">
                    <h2>5. Your Content</h2>
                    <p>
                        You own the ideas, notes, and content you create in Intraconnected. We don't
                        claim any ownership over it, and we don't access it in the ordinary course of
                        running the Service. You grant us only the limited permission needed to
                        store, encrypt, sync, back up, and display it to you, and to run the Service.
                        You're solely responsible for what you store in the Service, and for
                        keeping your own backups (the Profile → Data export is available for this,
                        on any plan). You confirm that you have the right to store your content in
                        the Service.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>6. Our Service and Your License</h2>
                    <p>
                        The Service, including the website, the apps, their code, design and
                        branding, belongs to us (or our licensors) and is protected by intellectual
                        property law. While you comply with these Terms, we give you a personal,
                        non-exclusive, non-transferable, revocable license to use the Service for
                        your own purposes. You may not copy, resell, sublicense, or reverse
                        engineer the Service or extract its source code, except where the law
                        allows it despite this restriction or where code is offered to you under an
                        open-source license.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>7. Acceptable Use</h2>
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
                        <li>
                            Use the Service if you are located in a country under a comprehensive
                            United States embargo, or if you appear on a United States list of
                            restricted parties. You also agree to follow export laws that apply to
                            software containing encryption.
                        </li>
                    </ul>
                    <p>
                        We may suspend or terminate accounts that violate this section. For heavy but good-faith use, we will
                        usually contact you first, and may limit imports or ask you to reduce your usage.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>8. Feature Requests</h2>
                    <p>
                        If you submit a feature request through the app, its title and description
                        are posted as a public GitHub issue, as described in our{" "}
                        <a href="/privacy">Privacy Policy</a>. By submitting a feature request, you
                        agree it can be published in this way, and you grant us a permanent,
                        worldwide, royalty-free permission to use, adapt, and implement the idea in
                        the Service without any obligation or compensation owed to you.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>9. Paid Features</h2>
                    <p>
                        Intraconnected is free to use up to a limited number of ideas. Beyond that,
                        we offer two paid plans, billed through Stripe, our payment processor (see
                        our <a href="/privacy">Privacy Policy</a> for what Stripe receives):
                    </p>
                    <ul>
                        <li>
                            <strong>Annual ({ANNUAL_PRICE_DISPLAY}/year).</strong> A recurring
                            subscription that renews automatically every year until you cancel. By
                            buying it, you authorize us, through Stripe, to charge your payment
                            method the then-current price at the start of each year. We will tell
                            you about any price change before it applies to your next renewal. You can
                            cancel at any time from Profile → Account, the same place you
                            subscribed; cancellation stops future renewal but does not refund the
                            current billing period (except as set out below), and you keep full
                            access through the end of the period you already paid for.
                        </li>
                        <li>
                            <strong>Lifetime ({LIFETIME_PRICE_DISPLAY} one time).</strong> A single
                            payment for access to the Service for as long as we operate it, with no
                            recurring charges. "Lifetime" means the lifetime of the Service, not
                            your lifetime and not a fixed number of years. If we permanently shut
                            the Service down, we will give you at least 60 days' notice and keep
                            export available during that time. If you change your mind, you can
                            request a full, self-serve refund from Profile → Account within 14 days
                            of purchase, no questions asked; after that window, email{" "}
                            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll take it
                            case by case.
                        </li>
                    </ul>
                    <p>
                        <strong>Right to withdraw (EEA and UK consumers).</strong> If you are a
                        consumer in the European Economic Area or the United Kingdom, you have a
                        legal right to withdraw from a paid purchase within 14 days, without giving
                        a reason. For Lifetime, the full refund described above covers this. For
                        Annual, email{" "}
                        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> within 14 days of
                        buying. If you asked us to start your plan immediately and have already
                        used the Service, we may deduct an amount proportionate to the time you
                        used it before you withdrew, and we refund the rest.
                    </p>
                    <p>
                        <strong>Prices and taxes.</strong> Prices are shown to you before you pay.
                        If we begin collecting VAT or sales tax where the law requires it, the
                        amount will be shown before you pay. Prices may change for future purchases; a change never
                        affects a plan you've already paid for. If we introduce additional paid
                        plans or features, their price and terms will be shown to you before you pay
                        for anything, and will apply in addition to this section.
                    </p>
                    <p>
                        <strong>Failed payments.</strong> If a renewal payment fails, Stripe may
                        retry it, and your account may return to the free plan if it is not
                        resolved. We do not delete your existing ideas for that reason, but you may
                        be unable to add new ones beyond the free limit until you restore a paid
                        plan or delete ideas.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>10. Termination and Changes to the Service</h2>
                    <p>
                        You can delete your account at any time from Profile → Delete Account in the
                        app, which permanently and immediately deletes your data. See our{" "}
                        <a href="/privacy">Privacy Policy</a> for details. We may suspend or
                        terminate your access to the Service if you violate these Terms, with notice
                        where reasonably possible; in that case we are not required to refund
                        amounts already paid. We may also change the Service or discontinue it
                        entirely, with reasonable notice where possible. If we end your access
                        without your having violated these Terms, or discontinue an Annual plan
                        before its term ends, we will refund the unused part of what you paid for
                        that term. If we change the Service in a way that materially reduces what
                        you pay for, you may cancel an Annual plan and receive a refund of the
                        unused part of the term.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>11. The Service Is Provided "As Is"</h2>
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
                        Nothing in this section takes away rights you have by law that cannot be
                        waived, including, if you are a consumer in the EEA or UK, your statutory
                        rights that digital content and digital services conform to the contract.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>12. Limitation of Liability</h2>
                    <p>
                        To the fullest extent permitted by law, we are not liable for any indirect,
                        incidental, special, consequential, or punitive damages, or any loss of data,
                        arising out of or related to your use of the Service, even if advised of the
                        possibility of such damages. Our total liability to you for any claim arising
                        from the Service will not exceed the greater of (a) the amount you paid us in
                        the twelve months before the claim, or (b) $50 USD. These limits apply to
                        Hunter Africk personally, as the operator of the Service, as well as to the
                        Service itself.
                    </p>
                    <p>
                        Nothing in these Terms excludes or limits liability that the law does not
                        allow to be excluded or limited, including liability for death or personal
                        injury, for fraud, for intentional misconduct or gross negligence, or for
                        breach of consumer rights that cannot be waived. Some places don't allow
                        certain limits or exclusions, so parts of this section may not apply to you;
                        in that case they apply to the fullest extent the law allows.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>13. Indemnification</h2>
                    <p>
                        To the extent the law allows, you agree to defend and hold harmless Hunter
                        Africk and the Service from any third-party claim, and resulting loss or
                        expense (including reasonable legal fees), arising from content you store in
                        the Service, your violation of these Terms, or your violation of any law or
                        third party's rights. This section does not apply to the extent the law
                        gives you a right that cannot be waived.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>14. Changes to These Terms</h2>
                    <p>
                        We may update these Terms. For material changes, we'll update the date at
                        the top of this page and give you at least 30 days' notice in the app or by
                        email before the change takes effect (sooner only if the law requires it or
                        to address a security or legal problem). A change to the price of a plan
                        you've already paid for never applies to that plan. If you don't agree to a
                        change, you can stop using the Service and delete your account before it
                        takes effect, and if you have an Annual plan, we'll refund the unused part
                        of the term. Using the Service after the change takes effect means you
                        accept the updated Terms. Changes don't apply to a dispute that began
                        before they took effect.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>15. Governing Law and Disputes</h2>
                    <p>
                        These Terms are governed by the laws of the State of Nevada, USA, without
                        regard to conflict-of-law principles, regardless of where you access the
                        Service from. If you are a consumer, you keep the protection of the
                        mandatory consumer laws of the country where you live, and you may bring a
                        claim in the courts of that country. Before filing a claim, please email{" "}
                        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and give us 30 days to
                        try to resolve it informally. Subject to the previous paragraph, any
                        dispute that isn't resolved will be brought only in the state or federal
                        courts located in Nevada, and you consent to their jurisdiction. Either of
                        us may instead bring an individual claim in small-claims court if it
                        qualifies. To the extent the law allows, you may bring claims only on your
                        own behalf, not as part of a class or representative action.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>16. Mobile App Stores</h2>
                    <p>
                        If you use the Service through the Apple App Store or Google Play, these
                        Terms are between you and us, not Apple or Google. Apple and Google have no
                        obligation to provide support or maintenance for the app and are not
                        responsible for any claims relating to it, such as product liability,
                        legal or regulatory compliance, or intellectual property claims. Apple and
                        its subsidiaries are third-party beneficiaries of these Terms as they apply
                        to the iOS app and may enforce them against you. You must also comply with
                        the store's own terms.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>17. General</h2>
                    <p>
                        These Terms and the Privacy Policy are the entire agreement between you and
                        us about the Service. If any part is found unenforceable, the rest stays in
                        effect. Our not enforcing a provision isn't a waiver of it. You may not
                        transfer your account or these Terms to anyone else; we may transfer ours as
                        part of a sale or restructuring of the Service, and will tell you if that
                        happens. You agree that we may give you notices by email to the address on
                        your account or inside the app. Sections that by their nature should survive
                        termination (including 5, 6, 9 as to amounts owed, 11, 12, 13 and 15) do.
                    </p>
                </section>

                <section className="legalSection">
                    <h2>18. Contact</h2>
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
