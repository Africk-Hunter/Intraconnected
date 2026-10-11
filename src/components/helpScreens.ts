import React from 'react';
import HelpMenuOne from './helpMenus/HelpMenuOne';
import HelpMenuTwo from './helpMenus/HelpMenuTwo';
import HelpMenuThree from './helpMenus/HelpMenuThree';
import HelpMenuFour from './helpMenus/HelpMenuFour';
import HelpMenuFive from './helpMenus/HelpMenuFive';
import HelpMenuSix from './helpMenus/HelpMenuSix';
import HelpMenuSeven from './helpMenus/HelpMenuSeven';

// Display order — the file names predate the current order. `id` is what the
// "new" dot remembers, so it must never change once shipped; a page added later
// gets a fresh id and lights the dot until it has been viewed.
export const HELP_SCREENS: { id: string; Component: React.FC }[] = [
    { id: 'welcome', Component: HelpMenuOne },
    { id: 'ideas', Component: HelpMenuTwo },
    { id: 'navigating', Component: HelpMenuThree },
    { id: 'desktop-tools', Component: HelpMenuSix },
    { id: 'organizing', Component: HelpMenuFour },
    { id: 'shortcuts', Component: HelpMenuSeven },
    { id: 'more', Component: HelpMenuFive },
];

function storageKey(uid: string) {
    return `help_seen_${uid}`;
}

function readSeen(uid: string): string[] | null {
    try {
        const raw = localStorage.getItem(storageKey(uid));
        return raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
        return null;
    }
}

// A device with no record yet (first run, or the first session after this
// shipped) counts every current page as seen: the dot is for pages added later.
function seenOrAll(uid: string): string[] {
    const seen = readSeen(uid);
    if (seen) return seen;
    const all = HELP_SCREENS.map(s => s.id);
    try { localStorage.setItem(storageKey(uid), JSON.stringify(all)); } catch { /* storage unavailable */ }
    return all;
}

/** Index of the first help page the user hasn't viewed, or -1. */
export function firstUnseenHelpScreen(uid: string | undefined): number {
    if (!uid) return -1;
    const seen = seenOrAll(uid);
    return HELP_SCREENS.findIndex(s => !seen.includes(s.id));
}

export function markHelpScreenSeen(uid: string | undefined, id: string): void {
    if (!uid) return;
    const seen = seenOrAll(uid);
    if (seen.includes(id)) return;
    try { localStorage.setItem(storageKey(uid), JSON.stringify([...seen, id])); } catch { /* storage unavailable */ }
}
