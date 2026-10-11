import { describe, it, expect } from 'vitest';
import { buildApiUrl, WEB_ORIGIN } from './platform';

describe('buildApiUrl', () => {
    const path = '/.netlify/functions/delete-account';

    it('keeps the path relative on the web', () => {
        expect(buildApiUrl(path, false)).toBe(path);
    });

    it('prefixes the production origin inside the app', () => {
        expect(buildApiUrl(path, true)).toBe(`${WEB_ORIGIN}${path}`);
    });

    it('uses an override origin and ignores trailing slashes on it', () => {
        expect(buildApiUrl(path, true, 'https://deploy-preview-3--intraconnected.netlify.app/')).toBe(
            `https://deploy-preview-3--intraconnected.netlify.app${path}`
        );
    });

    it('never applies the override on the web', () => {
        expect(buildApiUrl(path, false, 'https://example.com')).toBe(path);
    });
});
