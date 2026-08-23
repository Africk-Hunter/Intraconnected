import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeRequest } from "./lib/testUtils";

vi.hoisted(() => {
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";
    process.env.STRIPE_PRICE_LIFETIME = "price_lifetime_test";
});

const { verifyIdTokenDetailed } = vi.hoisted(() => ({ verifyIdTokenDetailed: vi.fn() }));
vi.mock("./lib/firebaseAdmin", () => ({ verifyIdTokenDetailed }));

const { paymentIntentsCreate, customersCreate, subscriptionsCreate } = vi.hoisted(() => ({
    paymentIntentsCreate: vi.fn(),
    customersCreate: vi.fn(),
    subscriptionsCreate: vi.fn(),
}));
vi.mock("./lib/stripe", () => ({
    stripe: () => ({
        paymentIntents: { create: paymentIntentsCreate },
        customers: { create: customersCreate },
        subscriptions: { create: subscriptionsCreate },
    }),
}));

const { getBillingDoc, getLifetimePrice } = vi.hoisted(() => ({
    getBillingDoc: vi.fn(),
    getLifetimePrice: vi.fn(),
}));
vi.mock("./lib/lifetimePricing", () => ({ getBillingDoc, getLifetimePrice }));

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock("./lib/rateLimit", () => ({ checkRateLimit }));

import handler from "./create-payment-intent";

describe("create-payment-intent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        checkRateLimit.mockResolvedValue(true);
        getBillingDoc.mockResolvedValue(null);
    });

    it("rejects non-POST requests", async () => {
        const res = await handler(fakeRequest(undefined, { method: "GET" }), {} as never);
        expect(res.status).toBe(405);
    });

    it("rejects unauthenticated callers", async () => {
        verifyIdTokenDetailed.mockResolvedValue(null);
        const res = await handler(fakeRequest({ plan: "lifetime" }), {} as never);
        expect(res.status).toBe(401);
    });

    // The core fix from the launch-readiness audit: a real, confirmed email
    // is required before any charge can be started — checked server-side so
    // hitting this function directly can't skip the client-side nudge.
    it("blocks checkout for an unverified email even with a valid token", async () => {
        verifyIdTokenDetailed.mockResolvedValue({ uid: "uid-1", emailVerified: false });
        const res = await handler(fakeRequest({ plan: "lifetime" }), {} as never);
        expect(res.status).toBe(403);
        expect(paymentIntentsCreate).not.toHaveBeenCalled();
    });

    it("rejects once the rate limit is hit", async () => {
        verifyIdTokenDetailed.mockResolvedValue({ uid: "uid-1", emailVerified: true });
        checkRateLimit.mockResolvedValue(false);
        const res = await handler(fakeRequest({ plan: "lifetime" }), {} as never);
        expect(res.status).toBe(429);
    });

    it("rejects an invalid plan value", async () => {
        verifyIdTokenDetailed.mockResolvedValue({ uid: "uid-1", emailVerified: true });
        const res = await handler(fakeRequest({ plan: "monthly" }), {} as never);
        expect(res.status).toBe(400);
    });

    it("rejects a second Lifetime purchase for an account that already has it", async () => {
        verifyIdTokenDetailed.mockResolvedValue({ uid: "uid-1", emailVerified: true });
        getBillingDoc.mockResolvedValue({ plan: "lifetime" });
        const res = await handler(fakeRequest({ plan: "lifetime" }), {} as never);
        expect(res.status).toBe(409);
        expect(paymentIntentsCreate).not.toHaveBeenCalled();
    });

    it("rejects a new Annual subscription while one is already active", async () => {
        verifyIdTokenDetailed.mockResolvedValue({ uid: "uid-1", emailVerified: true });
        getBillingDoc.mockResolvedValue({ plan: "annual", subscriptionStatus: "active" });
        const res = await handler(fakeRequest({ plan: "annual" }), {} as never);
        expect(res.status).toBe(409);
        expect(subscriptionsCreate).not.toHaveBeenCalled();
    });

    it("creates a Lifetime PaymentIntent for an eligible verified user, on a newly created Stripe Customer", async () => {
        verifyIdTokenDetailed.mockResolvedValue({ uid: "uid-1", emailVerified: true });
        getLifetimePrice.mockResolvedValue({ amount: 500, currency: "usd" });
        customersCreate.mockResolvedValue({ id: "cus_new" });
        paymentIntentsCreate.mockResolvedValue({ id: "pi_1", client_secret: "secret_abc" });

        const res = await handler(fakeRequest({ plan: "lifetime" }), {} as never);
        const body = (await res.json()) as { clientSecret: string };

        expect(res.status).toBe(200);
        expect(body.clientSecret).toBe("secret_abc");
        expect(paymentIntentsCreate).toHaveBeenCalledWith(
            expect.objectContaining({ metadata: { firebaseUid: "uid-1", plan: "lifetime" }, customer: "cus_new" })
        );
    });

    // The reason this fix exists: a Lifetime PaymentIntent used to carry no
    // `customer` at all, severing the relationship (and saved payment
    // method) a prior Annual subscription had already established — which
    // is exactly what stripe-webhook.ts needs to resume Annual billing if an
    // annual→lifetime upgrade is later refunded.
    it("reuses the existing Stripe Customer for a Lifetime purchase instead of creating a new one", async () => {
        verifyIdTokenDetailed.mockResolvedValue({ uid: "uid-1", emailVerified: true });
        getBillingDoc.mockResolvedValue({ plan: "annual", stripeCustomerId: "cus_existing" });
        getLifetimePrice.mockResolvedValue({ amount: 500, currency: "usd" });
        paymentIntentsCreate.mockResolvedValue({ id: "pi_1", client_secret: "secret_abc" });

        const res = await handler(fakeRequest({ plan: "lifetime" }), {} as never);

        expect(res.status).toBe(200);
        expect(customersCreate).not.toHaveBeenCalled();
        expect(paymentIntentsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_existing" }));
    });
});
