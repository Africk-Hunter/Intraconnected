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

const { refundsCreate } = vi.hoisted(() => ({ refundsCreate: vi.fn() }));
vi.mock("./lib/stripe", () => ({
    stripe: () => ({ refunds: { create: refundsCreate } }),
}));

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock("./lib/rateLimit", () => ({ checkRateLimit }));

import handler from "./refund-lifetime";

const DAY_MS = 24 * 60 * 60 * 1000;

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

describe("refund-lifetime", () => {
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
        expect(refundsCreate).not.toHaveBeenCalled();
    });

    it("rejects when the account isn't on Lifetime", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockBilling({ plan: "annual" });
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(400);
        expect(refundsCreate).not.toHaveBeenCalled();
    });

    it("rejects when there's no billing doc at all", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockBilling(null);
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(400);
    });

    it("rejects a legacy doc with no recorded payment intent", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockBilling({ plan: "lifetime", updatedAt: Date.now(), lifetimePaymentIntentId: null });
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(400);
        expect(refundsCreate).not.toHaveBeenCalled();
    });

    it("rejects a purchase older than the 14-day window", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockBilling({
            plan: "lifetime",
            updatedAt: Date.now() - 15 * DAY_MS,
            lifetimePaymentIntentId: "pi_123",
        });
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(400);
        expect(refundsCreate).not.toHaveBeenCalled();
    });

    it("refunds a Lifetime purchase within the window", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockBilling({
            plan: "lifetime",
            updatedAt: Date.now() - 1 * DAY_MS,
            lifetimePaymentIntentId: "pi_123",
        });
        refundsCreate.mockResolvedValue({ id: "re_123" });

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(refundsCreate).toHaveBeenCalledWith({ payment_intent: "pi_123" });
    });

    it("allows a refund right at the edge of the window", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockBilling({
            plan: "lifetime",
            updatedAt: Date.now() - 13.9 * DAY_MS,
            lifetimePaymentIntentId: "pi_123",
        });
        refundsCreate.mockResolvedValue({ id: "re_123" });

        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(200);
    });

    it("returns 502 when Stripe rejects the refund", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockBilling({
            plan: "lifetime",
            updatedAt: Date.now(),
            lifetimePaymentIntentId: "pi_123",
        });
        refundsCreate.mockRejectedValue(new Error("already refunded"));

        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(502);
    });
});
