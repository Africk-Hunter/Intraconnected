const GMAIL_DOMAINS = ['gmail.com', 'googlemail.com'];

export function isGmailAddress(email: string): boolean {
    const domain = email.trim().toLowerCase().split('@')[1];
    return !!domain && GMAIL_DOMAINS.includes(domain);
}

// Opens Gmail on a search for the Firebase email-verification message.
export function gmailVerifySearchUrl(email: string): string {
    const query = 'subject:(verify email) newer_than:1d';
    return `https://mail.google.com/mail/?authuser=${encodeURIComponent(email.trim())}#search/${encodeURIComponent(query)}`;
}

// Opens Gmail on a search for the Firebase password-reset message. `authuser`
// picks the right account when several are signed in.
export function gmailResetSearchUrl(email: string): string {
    const query = 'subject:"reset your Intraconnected password" newer_than:1d';
    return `https://mail.google.com/mail/?authuser=${encodeURIComponent(email.trim())}#search/${encodeURIComponent(query)}`;
}
