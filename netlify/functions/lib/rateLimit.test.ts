import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDocRef } from "./testUtils";

const { firestoreMock } = vi.hoisted(() => ({ firestoreMock: vi.fn() }));
vi.mock("./firebaseAdmin", () => ({ firestore: firestoreMock }));

import { checkRateLimit } from "./rateLimit";

function mockRateLimitDoc(hits: number[] | null) {
    const ref = fakeDocRef(hits ? { hits } : null);
    firestoreMock.mockReturnValue({
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                collection: vi.fn(() => ({
                    doc: vi.fn(() => ref),
                })),
            })),
        })),
    });
    return ref;
}

describe("checkRateLimit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("allows the first call with no prior history", async () => {
        const ref = mockRateLimitDoc(null);
        const allowed = await checkRateLimit({ uid: "uid-1", key: "checkout", limit: 3, windowMs: 60_000 });
        expect(allowed).toBe(true);
        expect(ref.set).toHaveBeenCalledWith({ hits: [expect.any(Number)] });
    });

    it("allows calls under the limit", async () => {
        mockRateLimitDoc([Date.now() - 1000, Date.now() - 500]);
        const allowed = await checkRateLimit({ uid: "uid-1", key: "checkout", limit: 3, windowMs: 60_000 });
        expect(allowed).toBe(true);
    });

    it("rejects once the limit within the window is reached", async () => {
        const now = Date.now();
        mockRateLimitDoc([now - 1000, now - 2000, now - 3000]);
        const allowed = await checkRateLimit({ uid: "uid-1", key: "checkout", limit: 3, windowMs: 60_000 });
        expect(allowed).toBe(false);
    });

    it("prunes hits older than the window before counting", async () => {
        const now = Date.now();
        const ref = mockRateLimitDoc([now - 120_000, now - 110_000, now - 1000]);
        const allowed = await checkRateLimit({ uid: "uid-1", key: "checkout", limit: 2, windowMs: 60_000 });
        expect(allowed).toBe(true);
        // Only the one still-in-window hit plus this new one should be persisted.
        const setCall = (ref.set as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(setCall.hits).toHaveLength(2);
    });

    it("keys different rate-limit buckets independently", async () => {
        const docSpy = vi.fn((name: string) => {
            const ref = fakeDocRef(name === "rateLimit_checkout" ? { hits: [Date.now(), Date.now(), Date.now()] } : null);
            return ref;
        });
        firestoreMock.mockReturnValue({
            collection: vi.fn(() => ({
                doc: vi.fn(() => ({
                    collection: vi.fn(() => ({
                        doc: docSpy,
                    })),
                })),
            })),
        });

        const checkoutAllowed = await checkRateLimit({ uid: "uid-1", key: "checkout", limit: 3, windowMs: 60_000 });
        const deleteAllowed = await checkRateLimit({ uid: "uid-1", key: "deleteAccount", limit: 3, windowMs: 60_000 });

        expect(checkoutAllowed).toBe(false);
        expect(deleteAllowed).toBe(true);
        expect(docSpy).toHaveBeenCalledWith("rateLimit_checkout");
        expect(docSpy).toHaveBeenCalledWith("rateLimit_deleteAccount");
    });
});
