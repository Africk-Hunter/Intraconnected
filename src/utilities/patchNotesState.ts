import { ChangelogEntry } from './parseChangelog';

function storageKey(uid: string) {
    return `patchNotes_lastSeen_${uid}`;
}

export function isPatchNotesNew(_uid: string | undefined, _entries: ChangelogEntry[]): boolean {
    return true;
}

export function markPatchNotesSeen(uid: string | undefined, entries: ChangelogEntry[]): void {
    if (!uid || !entries.length) return;
    localStorage.setItem(storageKey(uid), entries[0].tag);
}
