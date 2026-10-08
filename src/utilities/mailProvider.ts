// Maps an email address to its webmail provider so "Open <provider>" buttons
// can be shown only when we know where the inbox is. Gmail gets a search URL
// for the specific message; the others open the inbox.
export interface MailProvider {
    name: string;
    inboxUrl: string;
}

const PROVIDERS: { name: string; inboxUrl: string; domains: string[] }[] = [
    { name: 'Gmail', inboxUrl: 'https://mail.google.com/mail/', domains: ['gmail.com', 'googlemail.com'] },
    { name: 'Outlook', inboxUrl: 'https://outlook.live.com/mail/', domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'] },
    { name: 'Yahoo Mail', inboxUrl: 'https://mail.yahoo.com/', domains: ['yahoo.com', 'ymail.com', 'rocketmail.com'] },
    { name: 'iCloud Mail', inboxUrl: 'https://www.icloud.com/mail/', domains: ['icloud.com', 'me.com', 'mac.com'] },
    { name: 'Proton Mail', inboxUrl: 'https://mail.proton.me/', domains: ['proton.me', 'protonmail.com', 'pm.me'] },
    { name: 'AOL Mail', inboxUrl: 'https://mail.aol.com/', domains: ['aol.com'] },
];

export function getMailProvider(email: string): MailProvider | null {
    const domain = email.trim().toLowerCase().split('@')[1];
    if (!domain) return null;
    const match = PROVIDERS.find((p) => p.domains.includes(domain));
    return match ? { name: match.name, inboxUrl: match.inboxUrl } : null;
}

function isGmail(provider: MailProvider): boolean {
    return provider.name === 'Gmail';
}

function gmailSearchUrl(email: string, query: string): string {
    return `https://mail.google.com/mail/?authuser=${encodeURIComponent(email.trim())}#search/${encodeURIComponent(query)}`;
}

// Where to send the user to find the Firebase email-verification message.
// Gmail's `authuser` picks the right account when several are signed in.
export function verifyMailUrl(email: string, provider: MailProvider): string {
    return isGmail(provider) ? gmailSearchUrl(email, 'subject:(verify email) newer_than:1d') : provider.inboxUrl;
}

// Same, for the password-reset message.
export function resetMailUrl(email: string, provider: MailProvider): string {
    return isGmail(provider) ? gmailSearchUrl(email, 'subject:"reset your Intraconnected password" newer_than:1d') : provider.inboxUrl;
}
