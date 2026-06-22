import { ChangelogEntry } from './parseChangelog';
import { fetchLastSeenPatchVersion, updateLastSeenPatchVersion } from './firebase/firebaseHelpers';

function storageKey(uid: string) {
    return `patchNotes_lastSeen_${uid}`;
}

function latestTag(entries: ChangelogEntry[]): string {
    return entries[0]?.tag ?? '';
}

export function isPatchNotesNew(uid: string | undefined, entries: ChangelogEntry[]): boolean {
    if (!uid || !entries.length) return false;
    const seen = localStorage.getItem(storageKey(uid));
    return seen !== latestTag(entries);
}

export function markPatchNotesSeen(uid: string | undefined, entries: ChangelogEntry[]): void {
    if (!uid || !entries.length) return;
    const tag = latestTag(entries);
    localStorage.setItem(storageKey(uid), tag);
    updateLastSeenPatchVersion(tag);
}

/** Fetches the authoritative version from Firebase, syncs localStorage, and returns whether there are unseen notes. */
export async function syncPatchNotesFromFirebase(uid: string | undefined, entries: ChangelogEntry[]): Promise<boolean> {
    if (!uid || !entries.length) return false;
    const cached = localStorage.getItem(storageKey(uid));
    if (cached !== null) {
        return cached !== latestTag(entries);
    }
    const remoteVersion = await fetchLastSeenPatchVersion();
    const latest = latestTag(entries);
    if (remoteVersion !== null) {
        localStorage.setItem(storageKey(uid), remoteVersion);
    }
    return remoteVersion !== latest;
}
