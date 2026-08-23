import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDocRef, fakeRequest } from "./lib/testUtils";

const { verifyIdToken, firestoreMock } = vi.hoisted(() => ({
    verifyIdToken: vi.fn(),
    firestoreMock: vi.fn(),
}));
vi.mock("./lib/firebaseAdmin", () => ({
    verifyIdToken,
    firestore: firestoreMock,
}));

const { subscriptionsUpdate } = vi.hoisted(() => ({ subscriptionsUpdate: vi.fn() }));
vi.mock("./lib/stripe", () => ({
    stripe: () => ({ subscriptions: { update: subscriptionsUpdate } }),
}));

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock("./lib/rateLimit", () => ({ checkRateLimit }));

import handler from "./cancel-subscription";

function mockBilling(data: Record<string, unknown> | null) {
    const ref = fakeDocRef(data);
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

describe("cancel-subscription", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        checkRateLimit.mockResolvedValue(true);
    });

    it("rejects non-POST requests", async () => {
        const res = await handler(fakeRequest(undefined, { method: "GET" }), {} as never);
        expect(res.status).toBe(405);
    });

    it("rejects unauthenticated callers", async () => {
        verifyIdToken.mockResolvedValue(null);
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(401);
    });

    it("rejects once the rate limit is hit", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        checkRateLimit.mockResolvedValue(false);
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(429);
        expect(subscriptionsUpdate).not.toHaveBeenCalled();
    });

    it("rejects when there is no subscription on file", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockBilling({ stripeSubscriptionId: null });
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(400);
    });

    it("sets cancel_at_period_end rather than cancelling immediately", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockBilling({ stripeSubscriptionId: "sub_123" });
        subscriptionsUpdate.mockResolvedValue({});

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_123", { cancel_at_period_end: true });
    });

    it("returns 502 when the Stripe call fails", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockBilling({ stripeSubscriptionId: "sub_123" });
        subscriptionsUpdate.mockRejectedValue(new Error("stripe down"));

        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(502);
    });
});
