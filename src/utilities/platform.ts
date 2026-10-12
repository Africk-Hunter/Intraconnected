import { Capacitor } from '@capacitor/core';

// The one place that knows whether this is the web app or the Capacitor
// shell (see capacitor.config.ts). Everything else asks here, so the native
// differences stay easy to find.

export type NativePlatform = 'ios' | 'android' | 'web';

export const WEB_ORIGIN = 'https://intraconnected.app';

export function isNative(): boolean {
    return Capacitor.isNativePlatform();
}

export function nativePlatform(): NativePlatform {
    const platform = Capacitor.getPlatform();
    return platform === 'ios' || platform === 'android' ? platform : 'web';
}

// Pure half of apiUrl, split out so it can be tested without Capacitor.
export function buildApiUrl(path: string, native: boolean, origin: string = WEB_ORIGIN): string {
    return native ? origin.replace(/\/+$/, '') + path : path;
}

// Netlify Functions are same-origin on the web ("/.netlify/functions/…"), but
// inside the app that path would resolve against the bundled files, so it
// needs the full address. VITE_API_ORIGIN points a device build at a deploy
// preview instead of production. Use this for every function call.
export function apiUrl(path: string): string {
    const override = import.meta.env.VITE_API_ORIGIN as string | undefined;
    return buildApiUrl(path, isNative(), override || WEB_ORIGIN);
}

// capacitor.config.ts keeps the native splash up until the app knows where to
// go (NativeEntry, the sign-in page or the map). Safe to call anywhere,
// any number of times; does nothing on the web.
export function hideSplash(): void {
    if (!isNative()) return;
    import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide())
        .catch(() => { /* already hidden */ });
}

// Opens a web address outside the app: a new tab on the web, the system
// browser sheet (Custom Tabs / Safari View Controller) inside the app, where
// window.open from a WebView is unreliable.
export function openExternal(url: string): void {
    if (!isNative()) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }
    import('@capacitor/browser')
        .then(({ Browser }) => Browser.open({ url }))
        .catch(() => { /* nothing to open it with */ });
}

export type HapticKind = 'hold' | 'warn';

// A short physical tap. navigator.vibrate on the web (Android browsers only;
// iOS Safari has none), the system haptic engine inside the app, which also
// covers iPhone.
export function haptic(kind: HapticKind): void {
    if (!isNative()) {
        navigator.vibrate?.(kind === 'hold' ? 25 : 40);
        return;
    }
    import('@capacitor/haptics')
        .then(({ Haptics, ImpactStyle, NotificationType }) =>
            kind === 'hold'
                ? Haptics.impact({ style: ImpactStyle.Medium })
                : Haptics.notification({ type: NotificationType.Warning })
        )
        .catch(() => { /* device has no haptics */ });
}

// Reports the software keyboard's height in CSS pixels as it opens, and 0 as
// it closes. Inside the app the WebView is not resized for the keyboard
// (edge-to-edge on Android, `resize: 'none'` on iOS), so visualViewport alone
// can miss it. Does nothing on the web. Returns a function that stops listening.
export function onKeyboardHeight(callback: (height: number) => void): () => void {
    if (!isNative()) return () => {};
    let cancelled = false;
    let remove: (() => void) | null = null;
    import('@capacitor/keyboard')
        .then(({ Keyboard }) => Promise.all([
            Keyboard.addListener('keyboardWillShow', info => callback(info.keyboardHeight)),
            Keyboard.addListener('keyboardDidShow', info => callback(info.keyboardHeight)),
            Keyboard.addListener('keyboardWillHide', () => callback(0)),
        ]))
        .then(handles => {
            const removeAll = () => handles.forEach(h => void h.remove());
            if (cancelled) removeAll();
            else remove = removeAll;
        })
        .catch(() => { /* no keyboard plugin */ });
    return () => {
        cancelled = true;
        remove?.();
    };
}

// Runs `callback` each time the app comes back to the foreground (the
// WebView's own visibilitychange is not reliable for this on every device).
// Does nothing on the web, where tabs have visibilitychange. Returns a
// function that stops listening.
export function onAppResume(callback: () => void): () => void {
    if (!isNative()) return () => {};
    let cancelled = false;
    let remove: (() => void) | null = null;
    import('@capacitor/app')
        .then(({ App }) => App.addListener('resume', callback))
        .then(handle => {
            if (cancelled) void handle.remove();
            else remove = () => void handle.remove();
        })
        .catch(() => { /* no app lifecycle to listen to */ });
    return () => {
        cancelled = true;
        remove?.();
    };
}
