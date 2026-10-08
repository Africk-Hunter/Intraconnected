import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDocRef, fakeRequest } from "../functions/lib/testUtils";

const { verifyIdTokenWithAuthTime, firestoreMock, deleteUser } = vi.hoisted(() => ({
    verifyIdTokenWithAuthTime: vi.fn(),
    firestoreMock: vi.fn(),
    deleteUser: vi.fn(),
}));
vi.mock("../functions/lib/firebaseAdmin", () => ({
    verifyIdTokenWithAuthTime,
    firestore: firestoreMock,
    adminAuth: () => ({ deleteUser }),
}));

const { subscriptionsCancel, subscriptionsRetrieve } = vi.hoisted(() => ({
    subscriptionsCancel: vi.fn(),
    subscriptionsRetrieve: vi.fn(),
}));
vi.mock("../functions/lib/stripe", () => ({
    stripe: () => ({ subscriptions: { cancel: subscriptionsCancel, retrieve: subscriptionsRetrieve } }),
}));

// A caller who signed in (or re-entered their password) a moment ago.
const freshCaller = (uid = "uid-1") => ({ uid, authTime: Math.floor(Date.now() / 1000) - 5 });

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock("../functions/lib/rateLimit", () => ({ checkRateLimit }));

import handler from "../functions/delete-account";

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
        verifyIdTokenWithAuthTime.mockResolvedValue(null);
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(401);
        expect(deleteUser).not.toHaveBeenCalled();
    });

    it("rejects once the rate limit is hit", async () => {
        verifyIdTokenWithAuthTime.mockResolvedValue(freshCaller());
        checkRateLimit.mockResolvedValue(false);
        mockDb({ billingData: null });
        const res = await handler(fakeRequest(), {} as never);
        expect(res.status).toBe(429);
        expect(deleteUser).not.toHaveBeenCalled();
    });

    it("cancels a live subscription immediately, wipes ideas, and deletes the Auth user", async () => {
        verifyIdTokenWithAuthTime.mockResolvedValue(freshCaller());
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

    it("rejects a token whose sign-in is too old, without touching anything", async () => {
        verifyIdTokenWithAuthTime.mockResolvedValue({ uid: "uid-1", authTime: Math.floor(Date.now() / 1000) - 3600 });
        mockDb({ billingData: { stripeSubscriptionId: "sub_123" } });

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(403);
        expect(subscriptionsCancel).not.toHaveBeenCalled();
        expect(deleteUser).not.toHaveBeenCalled();
    });

    it("still deletes the account if the subscription turns out to be already canceled", async () => {
        verifyIdTokenWithAuthTime.mockResolvedValue(freshCaller());
        mockDb({ billingData: { stripeSubscriptionId: "sub_123" } });
        subscriptionsCancel.mockRejectedValue(new Error("already canceled"));
        subscriptionsRetrieve.mockResolvedValue({ status: "canceled" });
        deleteUser.mockResolvedValue(undefined);

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(deleteUser).toHaveBeenCalledWith("uid-1");
    });

    it("still deletes the account if the subscription is an expired, never-paid checkout", async () => {
        verifyIdTokenWithAuthTime.mockResolvedValue(freshCaller());
        mockDb({ billingData: { stripeSubscriptionId: "sub_123" } });
        subscriptionsCancel.mockRejectedValue(new Error("subscription is incomplete_expired"));
        subscriptionsRetrieve.mockResolvedValue({ status: "incomplete_expired" });
        deleteUser.mockResolvedValue(undefined);

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(deleteUser).toHaveBeenCalledWith("uid-1");
    });

    it("still deletes the account if Stripe no longer knows the subscription", async () => {
        verifyIdTokenWithAuthTime.mockResolvedValue(freshCaller());
        mockDb({ billingData: { stripeSubscriptionId: "sub_123" } });
        subscriptionsCancel.mockRejectedValue(new Error("no such subscription"));
        subscriptionsRetrieve.mockRejectedValue(Object.assign(new Error("missing"), { code: "resource_missing" }));
        deleteUser.mockResolvedValue(undefined);

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(200);
    });

    // The point of the fix: deleting the billing doc and Auth user while the
    // subscription is still live would leave it charging the card forever.
    it("does NOT delete anything when the cancel fails and the subscription may still be live", async () => {
        verifyIdTokenWithAuthTime.mockResolvedValue(freshCaller());
        const { batchDelete } = mockDb({ billingData: { stripeSubscriptionId: "sub_123" }, ideaCount: 2 });
        subscriptionsCancel.mockRejectedValue(new Error("stripe is down"));
        subscriptionsRetrieve.mockRejectedValue(new Error("stripe is down"));

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(502);
        expect(batchDelete).not.toHaveBeenCalled();
        expect(deleteUser).not.toHaveBeenCalled();
    });

    it("skips the Stripe call entirely when there's no subscription on file", async () => {
        verifyIdTokenWithAuthTime.mockResolvedValue(freshCaller());
        mockDb({ billingData: null });
        deleteUser.mockResolvedValue(undefined);

        const res = await handler(fakeRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(subscriptionsCancel).not.toHaveBeenCalled();
    });
});
