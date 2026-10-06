import React from "react";
import { Link } from "react-router-dom";
import LandingNavbar from "../components/landing/LandingNavbar";
import SupportIcon, { type SupportIconName } from "../components/landing/SupportIcons";
import { SUPPORT_EMAIL } from "../utilities/support";

// Mirrors FREE_NODE_LIMIT (utilities/billing/limits.tsx), which is not
// imported here because that module pulls Firebase into the marketing bundle.
const FREE_NODE_LIMIT = 50;

interface Topic {
    icon: SupportIconName;
    title: string;
    body: string;
    href: string;
}

const TOPICS: Topic[] = [
    {
        icon: "account",
        title: "Account & sign-in",
        body: "Passwords, signing in and deleting your account.",
        href: "#account",
    },
    {
        icon: "billing",
        title: "Plans & billing",
        body: "Upgrading, cancelling and refunds.",
        href: "#billing",
    },
    {
        icon: "sync",
        title: "Sync & devices",
        body: "Using your map on more than one device.",
        href: "#sync",
    },
    {
        icon: "export",
        title: "Import & export",
        body: "Bring your ideas in, or take them with you.",
        href: "#data",
    },
];

interface Faq {
    q: string;
    a: React.ReactNode;
}

interface FaqGroup {
    id: string;
    title: string;
    items: Faq[];
}

const GROUPS: FaqGroup[] = [
    {
        id: "account",
        title: "Account & sign-in",
        items: [
            {
                q: "I forgot my password.",
                a: (
                    <>
                        Choose "Forgot password" on the <Link to="/login">sign-in page</Link> and we'll
                        email you a reset link. Your ideas come back with you: signing in with the new
                        password restores access to them automatically. If the email never arrives,
                        check your spam folder, and make sure you're using the address the account was created with.
                    </>
                ),
            },
            {
                q: "I can't sign in and I no longer have access to my email.",
                a: (
                    <>
                        Your ideas are encrypted on your device, and resetting by email is how access
                        to them is restored. If you have lost both your password and the email address
                        on the account, we can't recover your ideas for you. Write to{" "}
                        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll tell you what
                        options there are.
                    </>
                ),
            },
            {
                q: "How do I delete my account?",
                a: (
                    <>
                        Open your profile and go to Account. Deleting asks for your password, then
                        permanently removes your ideas and account, and cancels any subscription
                        immediately. It can't be undone, so export first if you want a copy.
                    </>
                ),
            },
        ],
    },
    {
        id: "billing",
        title: "Plans & billing",
        items: [
            {
                q: "What does the free plan include?",
                a: (
                    <>
                        Everything, up to {FREE_NODE_LIMIT} nodes. No card needed. Annual and Lifetime
                        remove the limit. See <Link to="/pricing">pricing</Link>.
                    </>
                ),
            },
            {
                q: "How do I cancel Annual?",
                a: (
                    <>
                        Profile, then Account, then cancel. You keep full access until the end of the
                        period you already paid for, and the plan simply doesn't renew.
                    </>
                ),
            },
            {
                q: "Can I get a refund on Lifetime?",
                a: (
                    <>
                        Yes. Within 14 days of purchase you can request a full refund yourself from
                        Profile, then Account, no questions asked. After that, email{" "}
                        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll look at it
                        case by case.
                    </>
                ),
            },
            {
                q: "I paid, but my plan still says Free.",
                a: (
                    <>
                        Plan changes arrive a few seconds after payment. Give it a moment and refresh.
                        If it hasn't updated after a few minutes, email us the address on your account
                        and we'll sort it out.
                    </>
                ),
            },
        ],
    },
    {
        id: "sync",
        title: "Sync & devices",
        items: [
            {
                q: "Can I use Intraconnected on more than one device?",
                a: (
                    <>
                        Yes. Sign in with the same account and your map follows you. Changes made on
                        one device show up on the others while the app is open.
                    </>
                ),
            },
            {
                q: "I made changes offline. Are they safe?",
                a: (
                    <>
                        Yes. Edits are saved on your device first and sent to the server in order as
                        soon as you're back online. If a change is ever refused, the app shows a
                        banner with the choice to try again or discard it. Nothing is thrown away
                        without asking.
                    </>
                ),
            },
            {
                q: "Something I deleted is still showing on another device.",
                a: (
                    <>
                        Keep the other device open and online for a few seconds and it will catch up.
                        A refresh forces it.
                    </>
                ),
            },
        ],
    },
    {
        id: "data",
        title: "Import & export",
        items: [
            {
                q: "How do I export my ideas?",
                a: (
                    <>
                        Profile, then Data. You can export to Markdown, OPML or JSON. Export is
                        available on every plan, including free, and always will be.
                    </>
                ),
            },
            {
                q: "What can I import?",
                a: (
                    <>
                        OPML, Markdown, Notion exports (zip), plain text, FreeMind, XMind and
                        Intraconnected JSON. Everything lands under one new top-level idea, so it
                        never mixes into what you already have. A single import is limited to 2,000
                        ideas, and on the free plan it must fit within your remaining {FREE_NODE_LIMIT}-node
                        allowance.
                    </>
                ),
            },
        ],
    },
];

const Support: React.FC = () => (
    <div className="marketingPage">
        <LandingNavbar page="support" />

        <div className="supportPage">
            <section className="supportHero">
                <h1 className="supportHeroTitle">How can we help?</h1>
                <p className="supportHeroSubline">
                    Find a quick answer below, or write to us. A real person reads every message.
                </p>
            </section>

            <section className="supportTopics" aria-label="Support topics">
                {TOPICS.map((topic) => (
                    <a key={topic.href} href={topic.href} className="supportTopic neobrutal">
                        <SupportIcon name={topic.icon} />
                        <h2 className="supportTopicTitle">{topic.title}</h2>
                        <p className="supportTopicBody">{topic.body}</p>
                    </a>
                ))}
            </section>

            <div className="supportFaq">
                {GROUPS.map((group) => (
                    <section key={group.id} id={group.id} className="supportGroup">
                        <h2 className="supportGroupTitle">{group.title}</h2>
                        <div className="supportQuestions">
                            {group.items.map((item) => (
                                <details key={item.q} className="supportQuestion neobrutal">
                                    <summary>
                                        <span>{item.q}</span>
                                        <svg
                                            className="supportChevron"
                                            width="18"
                                            height="18"
                                            viewBox="0 0 18 18"
                                            fill="none"
                                            aria-hidden="true"
                                        >
                                            <path
                                                d="M 4 7 L 9 12 L 14 7"
                                                stroke="#111"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </summary>
                                    <div className="supportAnswer">{item.a}</div>
                                </details>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            <section className="supportContact neobrutal" aria-labelledby="supportContactTitle">
                <SupportIcon name="mail" />
                <div className="supportContactText">
                    <h2 id="supportContactTitle" className="supportContactTitle">Still stuck?</h2>
                    <p className="supportContactBody">
                        Email us from the address on your account and tell us what you were doing when
                        it went wrong. Never send your password.
                    </p>
                </div>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="supportContactCta neobrutal-button">
                    {SUPPORT_EMAIL}
                </a>
            </section>

            <p className="supportLegal">
                <Link to="/terms">Terms</Link>
                <span aria-hidden="true">|</span>
                <Link to="/privacy">Privacy</Link>
            </p>
        </div>
    </div>
);

export default Support;
