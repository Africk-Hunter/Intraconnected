import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDocRef, fakeRequest } from "./lib/testUtils";

const { verifyIdToken, firestoreMock, deleteUser } = vi.hoisted(() => ({
    verifyIdToken: vi.fn(),
    firestoreMock: vi.fn(),
    deleteUser: vi.fn(),
}));
vi.mock("./lib/firebaseAdmin", () => ({
    verifyIdToken,
    firestore: firestoreMock,
    adminAuth: () => ({ deleteUser }),
}));

const { subscriptionsCancel } = vi.hoisted(() => ({ subscriptionsCancel: vi.fn() }));
vi.mock("./lib/stripe", () => ({
    stripe: () => ({ subscriptions: { cancel: subscriptionsCancel } }),
}));

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock("./lib/rateLimit", () => ({ checkRateLimit }));

import handler from "./delete-account";

function mockDb({
    billingData,
    ideaCount = 0,
}: {
    billingData: Record<string, unknown> | null;
    ideaCount?: number;
}) {
    const billingRef = fakeDocRef(billingData);
    const batchDelete = vi.fn();
    const batchCommit = vi.fn(async () => {});

    firestoreMock.mockReturnValue({
        collection: vi.fn((top: string) => {
            if (top !== "users") throw new Error(`unexpected top-level collection: ${top}`);
            return {
                doc: vi.fn(() => ({
                    collection: vi.fn((sub: string) => {
                        if (sub === "meta") {
                            return {
                                doc: vi.fn((docName: string) => {
                                    if (docName === "billing") return billingRef;
                                    throw new Error(`unexpected meta doc: ${docName}`);
                                }),
                                get: vi.fn(async () => ({ docs: [] })),
                            };
                        }
                        if (sub === "ideas") {
                            return {
                                get: vi.fn(async () => ({
                                    docs: Array.from({ length: ideaCount }, (_, i) => ({ ref: { id: `idea-${i}` } })),
                                })),
                            };
                        }
                        throw new Error(`unexpected subcollection: ${sub}`);
                    }),
                })),
            };
        }),
        batch: vi.fn(() => ({ delete: batchDelete, commit: batchCommit })),
    });

    return { batchDelete, batchCommit };
}

describe("delete-account", () => {
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
        expect(deleteUser).not.toHaveBeenCalled();
    });

    it("rejects once the rate limit is hit", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        checkRateLimit.mockResolvedValue(false);
        mockDb({ billingData: null });
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(429);
        expect(deleteUser).not.toHaveBeenCalled();
    });

    it("cancels a live subscription immediately, wipes ideas, and deletes the Auth user", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        const { batchDelete, batchCommit } = mockDb({
            billingData: { stripeSubscriptionId: "sub_123" },
            ideaCount: 3,
        });
        subscriptionsCancel.mockResolvedValue({});
        deleteUser.mockResolvedValue(undefined);

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(subscriptionsCancel).toHaveBeenCalledWith("sub_123");
        expect(batchDelete).toHaveBeenCalledTimes(3);
        expect(batchCommit).toHaveBeenCalled();
        expect(deleteUser).toHaveBeenCalledWith("uid-1");
    });

    it("still deletes the account even if the Stripe cancel call fails", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockDb({ billingData: { stripeSubscriptionId: "sub_123" } });
        subscriptionsCancel.mockRejectedValue(new Error("already canceled"));
        deleteUser.mockResolvedValue(undefined);

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(deleteUser).toHaveBeenCalledWith("uid-1");
    });

    it("skips the Stripe call entirely when there's no subscription on file", async () => {
        verifyIdToken.mockResolvedValue("uid-1");
        mockDb({ billingData: null });
        deleteUser.mockResolvedValue(undefined);

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(subscriptionsCancel).not.toHaveBeenCalled();
    });
});
