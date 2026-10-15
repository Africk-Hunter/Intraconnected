import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeRequest } from "../functions/lib/testUtils";

const { verifyIdToken, firestoreMock, set, del } = vi.hoisted(() => ({
    verifyIdToken: vi.fn(),
    firestoreMock: vi.fn(),
    set: vi.fn(async (..._args: unknown[]) => {}),
    del: vi.fn(async (..._args: unknown[]) => {}),
}));
vi.mock("../functions/lib/firebaseAdmin", () => ({ verifyIdToken, firestore: firestoreMock }));

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock("../functions/lib/rateLimit", () => ({ checkRateLimit }));

import handler from "../functions/report-crypto-upgrade";

describe("report-crypto-upgrade", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        checkRateLimit.mockResolvedValue(true);
        verifyIdToken.mockResolvedValue("uid-1");
        firestoreMock.mockReturnValue({
            collection: vi.fn((name: string) => {
                if (name !== "cryptoUpgradeFailures") throw new Error(`unexpected collection: ${name}`);
                return { doc: vi.fn((id: string) => ({ set: (data: unknown, opts: unknown) => set(id, data, opts), delete: () => del(id) })) };
            }),
        });
    });

    it("rejects unauthenticated callers", async () => {
        verifyIdToken.mockResolvedValue(null);
        const res = await handler(fakeRequest({ step: "recovery-wrap" }), {} as never);
        expect(res.status).toBe(401);
        expect(set).not.toHaveBeenCalled();
    });

    it("rejects an unknown step", async () => {
        const res = await handler(fakeRequest({ step: "anything" }), {} as never);
        expect(res.status).toBe(400);
        expect(set).not.toHaveBeenCalled();
    });

    it("rejects once the rate limit is hit", async () => {
        checkRateLimit.mockResolvedValue(false);
        const res = await handler(fakeRequest({ step: "recovery-wrap" }), {} as never);
        expect(res.status).toBe(429);
        expect(set).not.toHaveBeenCalled();
    });

    it("records a failure under the caller's own uid", async () => {
        const res = await handler(fakeRequest({ step: "recovery-store" }), {} as never);
        expect(res.status).toBe(200);
        expect(set).toHaveBeenCalledWith("uid-1", expect.objectContaining({ uid: "uid-1", lastStep: "recovery-store" }), { merge: true });
    });

    it("removes the record once the upgrade is resolved", async () => {
        const res = await handler(fakeRequest({ resolved: true }), {} as never);
        expect(res.status).toBe(200);
        expect(del).toHaveBeenCalledWith("uid-1");
    });
});
