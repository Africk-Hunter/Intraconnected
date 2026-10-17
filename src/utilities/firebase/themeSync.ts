import { applyTheme, getThemeSavedAt, loadSavedTheme, parseThemeColors, saveTheme, type ThemeColors } from "../theme";
import { fetchActiveTheme, pushActiveTheme } from "./preferences";

// Keeps the active theme the same on every device: a change is pushed to the
// account after a short pause, and the newer of (this device, account) wins
// when the app opens or the tab comes back.

let pushTimer = 0;

/** Call after saveTheme() for a user's own change. */
export function pushThemeSoon(colors: ThemeColors | null): void {
    window.clearTimeout(pushTimer);
    const at = getThemeSavedAt();
    pushTimer = window.setTimeout(() => {
        pushActiveTheme(colors ? JSON.stringify(colors) : "", at).catch(() => { /* offline: the next pull pushes it */ });
    }, 800);
}

/** Adopts the account's theme if it is newer; pushes this device's if that is newer. Returns true if the page theme changed. */
export async function syncActiveTheme(): Promise<boolean> {
    let remote;
    try { remote = await fetchActiveTheme(); } catch { return false; }
    const localAt = getThemeSavedAt();
    if (!remote) {
        if (localAt) pushThemeSoon(loadSavedTheme());
        return false;
    }
    if (remote.at > localAt) {
        let colors: ThemeColors | null = null;
        try { colors = remote.json ? parseThemeColors(JSON.parse(remote.json)) : null; } catch { return false; }
        saveTheme(colors, remote.at);
        applyTheme(colors);
        return true;
    }
    if (localAt > remote.at) pushThemeSoon(loadSavedTheme());
    return false;
}
