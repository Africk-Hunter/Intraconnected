// Which idea you are inside is part of the address: /main for the top level,
// /main?idea=<id> for anywhere else. That is what makes refresh keep your place,
// browser Back step back through the levels you visited, and a copied link open
// the same level.

const MAIN_PATH = '/main';

// The idea id in a query string like "?idea=123", or null when absent or not a number.
export function parseIdeaParam(search: string): number | null {
    const raw = new URLSearchParams(search).get('idea');
    if (raw === null || !/^\d+$/.test(raw)) return null;
    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function buildIdeaUrl(id: number): string {
    return id === 1 ? MAIN_PATH : `${MAIN_PATH}?idea=${id}`;
}

export function readIdeaFromUrl(): number | null {
    return parseIdeaParam(window.location.search);
}

// Records a level in the address bar. 'push' adds a history entry (so Back
// returns here), 'replace' fixes the current one (used when a level vanished).
// Only on the app screen, and never twice for the same level.
export function writeIdeaToUrl(id: number, mode: 'push' | 'replace'): void {
    if (window.location.pathname !== MAIN_PATH) return;
    if ((readIdeaFromUrl() ?? 1) === id) return;
    const url = buildIdeaUrl(id);
    if (mode === 'push') window.history.pushState(window.history.state, '', url);
    else window.history.replaceState(window.history.state, '', url);
}
