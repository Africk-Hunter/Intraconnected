// A Content-Security-Policy for the app (Capacitor) build only.
//
// The website gets its policy from netlify.toml response headers, which never
// reach files bundled into the app, so the same allowlist is mirrored here as a
// <meta> tag, minus everything the app doesn't load (Stripe: the app has no
// checkout) plus the server the app's function calls go to. `frame-ancestors`
// is left out because browsers ignore it in a <meta> tag. Keep this in step
// with netlify.toml.
//
// 'unsafe-inline' stays on scripts and styles for the same reason as the web
// policy (see CLAUDE.md, "Security Headers & CSP").

export const DEFAULT_API_ORIGIN = 'https://intraconnected.app';

export function nativeCsp(apiOrigin: string = DEFAULT_API_ORIGIN): string {
    const origin = apiOrigin.replace(/\/+$/, '');
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        `connect-src 'self' ${origin} https://fonts.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ');
}

// Vite plugin: adds the policy to index.html when building with --mode native.
export function nativeCspPlugin(mode: string, apiOrigin?: string) {
    return {
        name: 'native-csp',
        transformIndexHtml() {
            if (mode !== 'native') return undefined;
            return [
                {
                    tag: 'meta',
                    attrs: { 'http-equiv': 'Content-Security-Policy', content: nativeCsp(apiOrigin) },
                    injectTo: 'head-prepend' as const,
                },
            ];
        },
    };
}
