import { vi } from "vitest";

// Minimal stand-in for a Firestore DocumentReference — just enough of
// get()/set() for the handlers under test, backed by a plain in-memory
// value instead of a real Firestore connection. Shared across the
// Netlify function test files since every one of them touches at least
// one doc in roughly this shape.
export function fakeDocRef(initialData: Record<string, unknown> | null = null) {
    let data = initialData;
    return {
        get: vi.fn(async () => ({
            exists: data !== null,
            data: () => data,
        })),
        set: vi.fn(async (next: Record<string, unknown>, opts?: { merge?: boolean }) => {
            data = opts?.merge && data ? { ...data, ...next } : next;
        }),
        _getData: () => data,
    };
}

export function fakeRequest(body?: unknown, init?: RequestInit): Request {
    return new Request("https://example.test/.netlify/functions/fn", {
        method: "POST",
        headers: { authorization: "Bearer test-token", "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        ...init,
    });
}
