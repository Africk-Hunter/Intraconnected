import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { nativeCsp, nativeCspPlugin, DEFAULT_API_ORIGIN } from './nativeCsp';

function directive(csp: string, name: string): string[] {
    const found = csp.split(';').map(d => d.trim()).find(d => d.startsWith(name + ' '));
    return found ? found.split(/\s+/).slice(1) : [];
}

describe('nativeCsp', () => {
    const csp = nativeCsp();

    it('lets the app call its server and Firebase', () => {
        const connect = directive(csp, 'connect-src');
        expect(connect).toContain(DEFAULT_API_ORIGIN);
        for (const host of ['firestore', 'identitytoolkit', 'securetoken']) {
            expect(connect).toContain(`https://${host}.googleapis.com`);
        }
    });

    it('does not allow Stripe, frames or plugins: the app has no checkout', () => {
        expect(csp).not.toContain('stripe');
        expect(csp).not.toContain('frame-src');
        expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    });

    it('follows a different API origin and ignores a trailing slash', () => {
        expect(directive(nativeCsp('https://deploy-preview-3--x.netlify.app/'), 'connect-src')).toContain('https://deploy-preview-3--x.netlify.app');
    });

    it("allows only app scripts and the runtime features needed by crypto", () => {
        expect(directive(csp, 'script-src')).toEqual(["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"]);
    });

    it('stays within the website policy: no host here that netlify.toml does not allow', () => {
        const toml = readFileSync('netlify.toml', 'utf8');
        const hosts = (csp.match(/https:\/\/[a-z0-9.*-]+/g) ?? []).filter(h => h !== DEFAULT_API_ORIGIN);
        for (const host of hosts) expect(toml).toContain(host);
    });
});

describe('nativeCspPlugin', () => {
    it('injects the tag only for native builds', () => {
        const tags = nativeCspPlugin('native').transformIndexHtml();
        expect(tags).toHaveLength(1);
        expect(tags?.[0].attrs['http-equiv']).toBe('Content-Security-Policy');
        expect(nativeCspPlugin('production').transformIndexHtml()).toBeUndefined();
        expect(nativeCspPlugin('development').transformIndexHtml()).toBeUndefined();
    });
});
