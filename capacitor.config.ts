import type { CapacitorConfig } from '@capacitor/cli';

// Never set `server.url` to the live site: Apple rejects apps that are just a
// website in a frame (guideline 4.2). The app ships the built `dist/` bundle.
const config: CapacitorConfig = {
    appId: 'com.intraconnected.app',
    appName: 'Intraconnected',
    webDir: 'dist',
    server: {
        androidScheme: 'https',
    },
    plugins: {
        SplashScreen: {
            // NativeEntry / Auth / Idea hide it once they know where to go.
            launchAutoHide: false,
            backgroundColor: '#E9F9E5',
            // Android 12+: a short fade into the first screen instead of a cut.
            launchFadeOutDuration: 250,
        },
        Keyboard: {
            // MobileMindMap already lifts its sheets with visualViewport.
            resize: 'none',
        },
        StatusBar: {
            overlaysWebView: true,
            style: 'LIGHT',
        },
    },
};

export default config;
