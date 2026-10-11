const KEY = 'recent_idea_visits';
const MAX_VISITS = 10;

export function readRecentVisits(): number[] {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
        return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [];
    } catch {
        return [];
    }
}

// Most recent first; opening the same idea again moves it to the front.
export function recordVisit(id: number): void {
    if (id === 1) return;
    try {
        const next = [id, ...readRecentVisits().filter((v) => v !== id)].slice(0, MAX_VISITS);
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // Storage unavailable: the list just stays as it was.
    }
}
