import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDocRef } from "./lib/testUtils";

vi.hoisted(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_PRICE_ANNUAL = "price_annual_test";
});

const { firestoreMock } = vi.hoisted(() => ({ firestoreMock: vi.fn() }));
vi.mock("./lib/firebaseAdmin", () => ({ firestore: firestoreMock }));

const { constructEvent, paymentIntentsRetrieve, subscriptionsCancel, subscriptionsCreate, subscriptionsList } = vi.hoisted(() => ({
    constructEvent: vi.fn(),
    paymentIntentsRetrieve: vi.fn(),
    subscriptionsCancel: vi.fn(),
    subscriptionsCreate: vi.fn(),
    subscriptionsList: vi.fn(),
}));
vi.mock("./lib/stripe", () => ({
    stripe: () => ({
        webhooks: { constructEvent },
        paymentIntents: { retrieve: paymentIntentsRetrieve },
        subscriptions: { cancel: subscriptionsCancel, create: subscriptionsCreate, list: subscriptionsList },
    }),
}));

const { deriveBillingUpdate, deriveLifetimeRefundUpdate, extractUidFromEvent } = vi.hoisted(() => ({
    deriveBillingUpdate: vi.fn(),
    deriveLifetimeRefundUpdate: vi.fn(),
    extractUidFromEvent: vi.fn(),
}));
vi.mock("./lib/billingEvents", () => ({ deriveBillingUpdate, deriveLifetimeRefundUpdate, extractUidFromEvent }));

const { getBillingDoc } = vi.hoisted(() => ({ getBillingDoc: vi.fn() }));
vi.mock("./lib/lifetimePricing", () => ({ getBillingDoc }));

import handler from "./stripe-webhook";

function fakeWebhookRequest(): Request {
    return new Request("https://example.test/.netlify/functions/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body: JSON.stringify({ id: "evt_1" }),
    });
}

function mockDb({ eventData = null, billingSetImpl }: { eventData?: Record<string, unknown> | null; billingSetImpl?: () => void }) {
    const eventRef = fakeDocRef(eventData);
    const billingSet = vi.fn(async (..._args: unknown[]) => {
        billingSetImpl?.();
    });

    firestoreMock.mockReturnValue({
        collection: vi.fn((name: string) => {
            if (name === "webhookEvents") {
                return { doc: vi.fn(() => eventRef) };
            }
            if (name === "users") {
                return {
                    doc: vi.fn(() => ({
                        collection: vi.fn(() => ({
                            doc: vi.fn(() => ({ set: billingSet })),
                        })),
                    })),
                };
            }
            throw new Error(`unexpected collection: ${name}`);
        }),
    });

    return { eventRef, billingSet };
}

describe("stripe-webhook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getBillingDoc.mockResolvedValue(null);
        extractUidFromEvent.mockReturnValue(null);
    });

    it("rejects non-POST requests", async () => {
        const res = await handler(new Request("https://example.test/x", { method: "GET" }), {} as never);
        expect(res.status).toBe(405);
    });

    it("rejects a request with no Stripe signature header", async () => {
        const res = await handler(new Request("https://example.test/x", { method: "POST" }), {} as never);
        expect(res.status).toBe(400);
    });

    it("rejects a request with an invalid signature", async () => {
        constructEvent.mockImplementation(() => {
            throw new Error("bad signature");
        });
        const res = await handler(fakeWebhookRequest(), {} as never);
        expect(res.status).toBe(400);
    });

    it("is a no-op on a redelivered event already marked processed", async () => {
        constructEvent.mockReturnValue({ id: "evt_1", type: "customer.subscription.updated", data: { object: {} } });
        mockDb({ eventData: { status: "processed" } });

        const res = await handler(fakeWebhookRequest(), {} as never);
        const body = (await res.json()) as { duplicate: boolean };

        expect(res.status).toBe(200);
        expect(body.duplicate).toBe(true);
        expect(deriveBillingUpdate).not.toHaveBeenCalled();
    });

    it("is a no-op when another delivery of the same event is still processing", async () => {
        constructEvent.mockReturnValue({ id: "evt_1", type: "charge.refunded", data: { object: {} } });
        mockDb({ eventData: { status: "processing", claimedAt: Date.now() } });

        const res = await handler(fakeWebhookRequest(), {} as never);
        const body = (await res.json()) as { duplicate: boolean };

        expect(body.duplicate).toBe(true);
        expect(deriveBillingUpdate).not.toHaveBeenCalled();
        expect(deriveLifetimeRefundUpdate).not.toHaveBeenCalled();
    });

    it("lets only one of several simultaneous deliveries of an event do the work", async () => {
        constructEvent.mockReturnValue({ id: "evt_9", type: "customer.subscription.updated", data: { object: {} } });
        extractUidFromEvent.mockReturnValue("uid-1");
        deriveBillingUpdate.mockReturnValue({ uid: "uid-1", update: { plan: "annual" } });
        const { billingSet } = mockDb({ eventData: null });

        await Promise.all([1, 2, 3, 4].map(() => handler(fakeWebhookRequest(), {} as never)));

        expect(deriveBillingUpdate).toHaveBeenCalledTimes(1);
        expect(billingSet).toHaveBeenCalledTimes(1);
    });

    it("takes over a failed or long-stale claim so Stripe's retry can finish the work", async () => {
        constructEvent.mockReturnValue({ id: "evt_8", type: "customer.subscription.updated", data: { object: {} } });
        extractUidFromEvent.mockReturnValue("uid-1");
        deriveBillingUpdate.mockReturnValue({ uid: "uid-1", update: { plan: "annual" } });

        mockDb({ eventData: { status: "failed", error: "boom" } });
        await handler(fakeWebhookRequest(), {} as never);
        expect(deriveBillingUpdate).toHaveBeenCalledTimes(1);

        mockDb({ eventData: { status: "processing", claimedAt: Date.now() - 10 * 60 * 1000 } });
        await handler(fakeWebhookRequest(), {} as never);
        expect(deriveBillingUpdate).toHaveBeenCalledTimes(2);
    });

    it("processes a new event and marks it processed", async () => {
        constructEvent.mockReturnValue({ id: "evt_2", type: "customer.subscription.updated", data: { object: {} } });
        extractUidFromEvent.mockReturnValue("uid-1");
        deriveBillingUpdate.mockReturnValue({ uid: "uid-1", update: { plan: "annual" } });
        const { eventRef, billingSet } = mockDb({ eventData: null });

        const res = await handler(fakeWebhookRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(billingSet).toHaveBeenCalledWith({ plan: "annual" }, { merge: true });
        expect(eventRef.set).toHaveBeenCalledWith(
            expect.objectContaining({ status: "processed" }),
            { merge: true }
        );
    });

    it("marks the event processed even when nothing needs to change", async () => {
        constructEvent.mockReturnValue({ id: "evt_3", type: "invoice.payment_failed", data: { object: {} } });
        deriveBillingUpdate.mockReturnValue(null);
        const { eventRef } = mockDb({ eventData: null });

        const res = await handler(fakeWebhookRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(eventRef.set).toHaveBeenCalledWith(
            expect.objectContaining({ status: "processed" }),
            { merge: true }
        );
    });

    it("cancels a superseded subscription best-effort without failing the request", async () => {
        constructEvent.mockReturnValue({ id: "evt_4", type: "payment_intent.succeeded", data: { object: {} } });
        extractUidFromEvent.mockReturnValue(null);
        deriveBillingUpdate.mockReturnValue({ uid: "uid-1", update: { plan: "lifetime" }, cancelSubscriptionId: "sub_old" });
        mockDb({ eventData: null });
        subscriptionsCancel.mockRejectedValue(new Error("already gone"));

        const res = await handler(fakeWebhookRequest(), {} as never);

        expect(res.status).toBe(200);
        expect(subscriptionsCancel).toHaveBeenCalledWith("sub_old");
    });

    describe("charge.refunded", () => {
        it("does nothing on a partial refund", async () => {
            constructEvent.mockReturnValue({
                id: "evt_refund_partial",
                type: "charge.refunded",
                data: { object: { refunded: false, payment_intent: "pi_1" } },
            });
            mockDb({ eventData: null });

            const res = await handler(fakeWebhookRequest(), {} as never);

            expect(res.status).toBe(200);
            expect(paymentIntentsRetrieve).not.toHaveBeenCalled();
            expect(deriveLifetimeRefundUpdate).not.toHaveBeenCalled();
        });

        it("reverts to free without attempting to resume anything when the refunded purchase was a free→lifetime purchase", async () => {
            constructEvent.mockReturnValue({
                id: "evt_refund_free",
                type: "charge.refunded",
                data: { object: { refunded: true, payment_intent: "pi_1" } },
            });
            paymentIntentsRetrieve.mockResolvedValue({ metadata: { firebaseUid: "uid-1", plan: "lifetime" } });
            deriveLifetimeRefundUpdate.mockReturnValue({ uid: "uid-1", update: { plan: "free", stripeCustomerId: null } });
            const { billingSet } = mockDb({ eventData: null });

            const res = await handler(fakeWebhookRequest(), {} as never);

            expect(res.status).toBe(200);
            expect(subscriptionsCreate).not.toHaveBeenCalled();
            expect(billingSet).toHaveBeenCalledWith({ plan: "free", stripeCustomerId: null }, { merge: true });
        });

        // The case this fix is for: refunding a Lifetime purchase that was
        // itself an Annual→Lifetime upgrade must actually restore the Annual
        // year already paid for, not just flip a Firestore label with no
        // live subscription behind it — and must not charge again to do it.
        // See resumeAnnualSubscription's own docs in stripe-webhook.ts.
        describe("refunding an annual→lifetime upgrade", () => {
            const futureEnd = () => Math.floor(Date.now() / 1000) + 200 * 24 * 60 * 60;

            function setUpRefund() {
                constructEvent.mockReturnValue({
                    id: "evt_refund_annual",
                    type: "charge.refunded",
                    data: { object: { refunded: true, payment_intent: "pi_1" } },
                });
                paymentIntentsRetrieve.mockResolvedValue({ metadata: { firebaseUid: "uid-1", plan: "lifetime" } });
                deriveLifetimeRefundUpdate.mockReturnValue({
                    uid: "uid-1",
                    update: { plan: "annual", stripeCustomerId: "cus_abc", previousPlan: null },
                });
            }

            function canceledSub(overrides: Record<string, unknown> = {}) {
                return {
                    id: "sub_old",
                    default_payment_method: "pm_card",
                    cancel_at_period_end: false,
                    items: { data: [{ current_period_end: futureEnd() }] },
                    ...overrides,
                };
            }

            it("restores Annual as a trial to the original period end, with the saved card and no charge now", async () => {
                setUpRefund();
                const periodEnd = futureEnd();
                subscriptionsList.mockResolvedValue({ data: [canceledSub({ items: { data: [{ current_period_end: periodEnd }] } })] });
                subscriptionsCreate.mockResolvedValue({ id: "sub_new", status: "trialing", customer: "cus_abc" });
                deriveBillingUpdate.mockReturnValue({
                    uid: "uid-1",
                    update: { plan: "annual", stripeSubscriptionId: "sub_new", subscriptionStatus: "trialing" },
                });
                const { billingSet } = mockDb({ eventData: null });

                const res = await handler(fakeWebhookRequest(), {} as never);

                expect(res.status).toBe(200);
                expect(subscriptionsList).toHaveBeenCalledWith({ customer: "cus_abc", status: "canceled", limit: 1 });
                expect(subscriptionsCreate).toHaveBeenCalledWith(
                    expect.objectContaining({
                        customer: "cus_abc",
                        items: [{ price: "price_annual_test" }],
                        trial_end: periodEnd,
                        default_payment_method: "pm_card",
                        cancel_at_period_end: false,
                    })
                );
                // Never the old default_incomplete flow, which needed a
                // client-side confirmation nothing ever performed.
                expect(subscriptionsCreate.mock.calls[0][0]).not.toHaveProperty("payment_behavior");
                // Reuses deriveBillingUpdate's own status-gating by synthesizing
                // the customer.subscription.updated event Stripe would otherwise
                // send for the newly created subscription, rather than
                // duplicating that logic here.
                expect(deriveBillingUpdate).toHaveBeenCalledWith(
                    expect.objectContaining({ type: "customer.subscription.updated", data: { object: expect.objectContaining({ id: "sub_new" }) } }),
                    expect.objectContaining({ plan: "annual" })
                );
                expect(billingSet).toHaveBeenCalledWith(
                    expect.objectContaining({ plan: "annual", stripeSubscriptionId: "sub_new" }),
                    { merge: true }
                );
            });

            it("carries over a pending cancellation instead of silently renewing", async () => {
                setUpRefund();
                subscriptionsList.mockResolvedValue({ data: [canceledSub({ cancel_at_period_end: true, default_payment_method: null })] });
                subscriptionsCreate.mockResolvedValue({ id: "sub_new", status: "trialing" });
                deriveBillingUpdate.mockReturnValue({ uid: "uid-1", update: { plan: "annual" } });
                mockDb({ eventData: null });

                await handler(fakeWebhookRequest(), {} as never);

                const params = subscriptionsCreate.mock.calls[0][0];
                expect(params.cancel_at_period_end).toBe(true);
                expect(params).not.toHaveProperty("default_payment_method");
            });

            it("goes to free without creating anything when the paid year has already ended", async () => {
                setUpRefund();
                subscriptionsList.mockResolvedValue({
                    data: [canceledSub({ items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) - 10 }] } })],
                });
                const { billingSet } = mockDb({ eventData: null });

                const res = await handler(fakeWebhookRequest(), {} as never);

                expect(res.status).toBe(200);
                expect(subscriptionsCreate).not.toHaveBeenCalled();
                expect(billingSet).toHaveBeenCalledWith(expect.objectContaining({ plan: "free" }), { merge: true });
            });

            it("goes to free when there's no prior subscription to restore from", async () => {
                setUpRefund();
                subscriptionsList.mockResolvedValue({ data: [] });
                const { billingSet } = mockDb({ eventData: null });

                await handler(fakeWebhookRequest(), {} as never);

                expect(subscriptionsCreate).not.toHaveBeenCalled();
                expect(billingSet).toHaveBeenCalledWith(expect.objectContaining({ plan: "free" }), { merge: true });
            });
        });

        it("falls back to free when Stripe rejects the restore", async () => {
            constructEvent.mockReturnValue({
                id: "evt_refund_declined",
                type: "charge.refunded",
                data: { object: { refunded: true, payment_intent: "pi_1" } },
            });
            paymentIntentsRetrieve.mockResolvedValue({ metadata: { firebaseUid: "uid-1", plan: "lifetime" } });
            deriveLifetimeRefundUpdate.mockReturnValue({ uid: "uid-1", update: { plan: "annual", stripeCustomerId: "cus_abc" } });
            subscriptionsList.mockResolvedValue({
                data: [{ items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] }, cancel_at_period_end: false }],
            });
            subscriptionsCreate.mockRejectedValue(new Error("No such price."));
            const { billingSet } = mockDb({ eventData: null });

            const res = await handler(fakeWebhookRequest(), {} as never);

            // A restore failure is never a processing failure of the refund
            // event itself — the refund already happened in Stripe — so
            // this still succeeds overall, just with a safe "free" outcome
            // instead of an ungated "annual".
            expect(res.status).toBe(200);
            expect(deriveBillingUpdate).not.toHaveBeenCalled();
            expect(billingSet).toHaveBeenCalledWith(expect.objectContaining({ plan: "free" }), { merge: true });
        });

        it("falls back to free without calling Stripe when there's no customer to restore against", async () => {
            constructEvent.mockReturnValue({
                id: "evt_refund_no_customer",
                type: "charge.refunded",
                data: { object: { refunded: true, payment_intent: "pi_1" } },
            });
            paymentIntentsRetrieve.mockResolvedValue({ metadata: { firebaseUid: "uid-1", plan: "lifetime" } });
            deriveLifetimeRefundUpdate.mockReturnValue({ uid: "uid-1", update: { plan: "annual", stripeCustomerId: null } });
            const { billingSet } = mockDb({ eventData: null });

            const res = await handler(fakeWebhookRequest(), {} as never);

            expect(res.status).toBe(200);
            expect(subscriptionsCreate).not.toHaveBeenCalled();
            expect(billingSet).toHaveBeenCalledWith(expect.objectContaining({ plan: "free" }), { merge: true });
        });
    });

    // This is the fix for "a charge can succeed while the upgrade silently
    // fails" — a failure here must be both logged and persisted, and must
    // make Stripe retry rather than swallow the event.
    it("records a failure and returns 500 so Stripe retries when the billing write throws", async () => {
        constructEvent.mockReturnValue({ id: "evt_5", type: "customer.subscription.updated", data: { object: {} } });
        extractUidFromEvent.mockReturnValue("uid-1");
        deriveBillingUpdate.mockReturnValue({ uid: "uid-1", update: { plan: "annual" } });
        const { eventRef } = mockDb({
            eventData: null,
            billingSetImpl: () => {
                throw new Error("firestore is down");
            },
        });

        const res = await handler(fakeWebhookRequest(), {} as never);

        expect(res.status).toBe(500);
        expect(eventRef.set).toHaveBeenCalledWith(
            expect.objectContaining({ status: "failed", error: "firestore is down" }),
            { merge: true }
        );
    });
});
