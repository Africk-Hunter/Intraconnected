import { describe, it, expect } from 'vitest';
import { getMailProvider, resetMailUrl, verifyMailUrl } from './mailProvider';

describe('getMailProvider', () => {
    it('recognizes common webmail domains, case-insensitively', () => {
        expect(getMailProvider('a@gmail.com')?.name).toBe('Gmail');
        expect(getMailProvider(' A@Yahoo.com ')?.name).toBe('Yahoo Mail');
        expect(getMailProvider('a@hotmail.com')?.name).toBe('Outlook');
        expect(getMailProvider('a@icloud.com')?.name).toBe('iCloud Mail');
        expect(getMailProvider('a@proton.me')?.name).toBe('Proton Mail');
    });

    it('returns null for unknown or malformed addresses', () => {
        expect(getMailProvider('a@company.com')).toBeNull();
        expect(getMailProvider('not-an-email')).toBeNull();
        expect(getMailProvider('')).toBeNull();
    });
});

describe('mail urls', () => {
    it('searches Gmail for the message and opens other inboxes directly', () => {
        const gmail = getMailProvider('a@gmail.com')!;
        expect(resetMailUrl('a@gmail.com', gmail)).toContain('#search/');
        expect(verifyMailUrl('a@gmail.com', gmail)).toContain('authuser=a%40gmail.com');
        const yahoo = getMailProvider('a@yahoo.com')!;
        expect(resetMailUrl('a@yahoo.com', yahoo)).toBe('https://mail.yahoo.com/');
    });
});
