import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fakeDocRef, fakeRequest } from "./lib/testUtils";

const { verifyIdToken, firestoreMock } = vi.hoisted(() => ({
    verifyIdToken: vi.fn(),
    firestoreMock: vi.fn(),
}));
vi.mock("./lib/firebaseAdmin", () => ({ verifyIdToken, firestore: firestoreMock }));

const { subscriptionsCancel } = vi.hoisted(() => ({ subscriptionsCancel: vi.fn() }));
vi.mock("./lib/stripe", () => ({
    stripe: () => ({ subscriptions: { cancel: subscriptionsCancel } }),
}));

import handler from "./reset-subscription-test";

describe("reset-subscription-test", () => {
    const originalEnv = process.env.ALLOW_TEST_RESET;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (originalEnv === undefined) delete process.env.ALLOW_TEST_RESET;
        else process.env.ALLOW_TEST_RESET = originalEnv;
    });

    // This is the fix for "any signed-in user can cancel their own
    // subscription outright" — the endpoint must 404 on every deployed
    // instance (production, deploy previews, branch deploys), since
    // ALLOW_TEST_RESET is only ever set in a local .env.
    it("404s when ALLOW_TEST_RESET is unset, before even checking auth", async () => {
        delete process.env.ALLOW_TEST_RESET;
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(404);
        expect(verifyIdToken).not.toHaveBeenCalled();
    });

    it("404s when ALLOW_TEST_RESET is set to something other than 'true'", async () => {
        process.env.ALLOW_TEST_RESET = "1";
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(404);
    });

    it("still requires auth once explicitly opted in locally", async () => {
        process.env.ALLOW_TEST_RESET = "true";
        verifyIdToken.mockResolvedValue(null);
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(401);
    });

    it("cancels the subscription and resets billing to free when opted in", async () => {
        process.env.ALLOW_TEST_RESET = "true";
        verifyIdToken.mockResolvedValue("uid-1");
        const billingRef = fakeDocRef({ stripeSubscriptionId: "sub_123" });
        firestoreMock.mockReturnValue({
            collection: vi.fn(() => ({
                doc: vi.fn(() => ({
                    collection: vi.fn(() => ({
                        doc: vi.fn(() => billingRef),
                    })),
                })),
            })),
        });
        subscriptionsCancel.mockResolvedValue({});

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(subscriptionsCancel).toHaveBeenCalledWith("sub_123");
        expect(billingRef.set).toHaveBeenCalledWith(
            expect.objectContaining({ plan: "free" }),
            { merge: true }
        );
    });
});
