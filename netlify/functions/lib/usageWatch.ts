// Pure decision logic for the daily usage check (usage-watch.ts). Paid plans
// have no idea cap, so the only protection against a runaway account is to
// notice it: the function counts each paid account's ideas once a day and
// asks this whether anything is worth a look.

// An account this big costs real money to sync (every pull reads every idea).
export const SIZE_FLAG = 20_000;
// More new ideas than any person writes by hand in a day.
export const GROWTH_FLAG = 5_000;
// After a size flag, the next one waits until the account is this much bigger.
export const SIZE_REFLAG_FACTOR = 1.5;

export interface UsageSnapshot {
    count: number;
    // Count at the previous check, or null the first time an account is seen.
    previousCount: number | null;
    // Count when this account was last flagged for size, or null.
    lastFlaggedCount: number | null;
}

export type UsageFlagReason = "growth" | "size";

export function evaluateUsage({ count, previousCount, lastFlaggedCount }: UsageSnapshot): UsageFlagReason | null {
    if (previousCount !== null && count - previousCount >= GROWTH_FLAG) return "growth";
    if (count >= SIZE_FLAG && (lastFlaggedCount === null || count >= lastFlaggedCount * SIZE_REFLAG_FACTOR)) return "size";
    return null;
}
