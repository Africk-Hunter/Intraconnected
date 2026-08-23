import type { Context } from "@netlify/functions";
import type Stripe from "stripe";
import { firestore } from "./lib/firebaseAdmin";
import { stripe } from "./lib/stripe";
import { deriveBillingUpdate, deriveLifetimeRefundUpdate, extractUidFromEvent, type BillingEventResult } from "./lib/billingEvents";
import { getBillingDoc } from "./lib/lifetimePricing";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL;

function jsonError(status: number, message: string) {
    return Response.json({ error: message }, { status });
}

// Undoes the "canceled immediately" half of an Annual→Lifetime upgrade once
// that specific upgrade is refunded (see deriveLifetimeRefundUpdate's docs)
// — reverting `plan` to "annual" is meaningless on its own, since the
// subscription that plan used to describe was already canceled at upgrade
// time, not left to expire. This actually resumes billing: a fresh
// subscription on the same Stripe Customer, off-session, reusing whatever
// payment method that customer already has on file from the original
// subscription (create-payment-intent.ts now keeps the Lifetime purchase on
// the same customer specifically so this has something to reuse).
//
// Reuses deriveBillingUpdate's own customer.subscription.updated mapping —
// by synthesizing the event Stripe would otherwise send for this same
// subscription object — rather than duplicating its status-gating logic, so
// a resume that comes back "incomplete" (a declined card, one that needs
// 3DS, or was removed since) is handled exactly like a brand-new signup:
// not granted access until a real active/trialing/past_due status is
// confirmed, either here or by that subscription's own later webhook
// events. Falls back to "free" — never to an ungated "annual" — if there's
// no customer or price to resume against, or if Stripe rejects the attempt
// outright (e.g. no payment method on file at all).
async function resumeAnnualSubscription(uid: string, refundResult: BillingEventResult): Promise<BillingEventResult> {
    const customerId = refundResult.update.stripeCustomerId;
    if (!customerId || !STRIPE_PRICE_ANNUAL) {
        console.error("stripe-webhook: cannot resume Annual subscription on refund — missing customer or price env var", {
            uid,
            hasCustomer: Boolean(customerId),
        });
        return { uid, update: { ...refundResult.update, plan: "free" } };
    }
    try {
        const subscription = await stripe().subscriptions.create({
            customer: customerId,
            items: [{ price: STRIPE_PRICE_ANNUAL }],
            payment_behavior: "default_incomplete",
            payment_settings: { save_default_payment_method: "on_subscription", payment_method_types: ["card"] },
            metadata: { firebaseUid: uid },
        });
        const resumedEvent = { type: "customer.subscription.updated", data: { object: subscription } } as unknown as Stripe.Event;
        return deriveBillingUpdate(resumedEvent, refundResult.update) ?? { uid, update: { ...refundResult.update, plan: "free" } };
    } catch (err) {
        console.error("stripe-webhook: failed to resume Annual subscription on refund", uid, err);
        return { uid, update: { ...refundResult.update, plan: "free" } };
    }
}

// Called by Stripe, not a signed-in user — auth is the signature check
// below, not verifyIdToken.
export default async (req: Request, _context: Context) => {
    if (req.method !== "POST") {
        return jsonError(405, "Method not allowed.");
    }
    if (!WEBHOOK_SECRET) {
        return jsonError(500, "Server misconfigured.");
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
        return jsonError(400, "Missing Stripe signature.");
    }

    // Must read raw bytes before any JSON parsing — signature verification
    // is computed over the exact wire body.
    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
        event = stripe().webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
    } catch {
        return jsonError(400, "Invalid signature.");
    }

    const db = firestore();
    // Keyed on Stripe's own event.id, not derived from the payload, so it
    // dedupes any event type uniformly. Top-level collection (not nested
    // under a user) since some events — a malformed one, or one whose uid
    // never resolves — have no user to scope it to at the point we receive
    // them; Firestore rules default-deny anything with no matching `match`
    // block, and nothing in firestore.rules mentions this collection, so
    // it's already unreachable from the client without any rules change.
    const eventRef = db.collection("webhookEvents").doc(event.id);

    // Stripe redelivers at-least-once — including after this function 5xxs
    // below on a transient failure — so a redelivered event has to be a
    // safe no-op, not a second write attempt over billing state that may
    // already be newer than what this stale delivery describes.
    const existingEvent = await eventRef.get();
    if (existingEvent.exists && existingEvent.data()?.status === "processed") {
        return Response.json({ received: true, duplicate: true });
    }

    try {
        let result: BillingEventResult | null;

        if (event.type === "charge.refunded") {
            // charge.refunded also fires on partial refunds (e.g. a support
            // goodwill credit) — only a fully refunded charge should revoke
            // access. Charge.metadata is never copied from the PaymentIntent's,
            // so the firebaseUid/plan tag has to be resolved with an extra
            // lookup rather than read straight off the event like the other
            // branch below.
            const charge = event.data.object as Stripe.Charge;
            result = null;
            if (charge.refunded && typeof charge.payment_intent === "string") {
                const paymentIntent = await stripe().paymentIntents.retrieve(charge.payment_intent);
                const uid = paymentIntent.metadata?.firebaseUid;
                if (uid && paymentIntent.metadata?.plan === "lifetime") {
                    const currentBilling = await getBillingDoc(uid);
                    result = deriveLifetimeRefundUpdate(uid, currentBilling);
                    // This refund is undoing an Annual→Lifetime upgrade, not
                    // an original Lifetime purchase — see
                    // resumeAnnualSubscription's docs for why "annual" on
                    // its own isn't enough here.
                    if (result?.update.plan === "annual") {
                        result = await resumeAnnualSubscription(uid, result);
                    }
                }
            }
        } else {
            // deriveBillingUpdate needs the user's *current* billing doc to
            // decide things like "does upgrading to Lifetime need to cancel an
            // existing Annual subscription" — fetched here (not inside
            // deriveBillingUpdate itself) so that function stays a pure,
            // SDK-free mapping that's unit-testable against plain fixture
            // objects.
            const uid = extractUidFromEvent(event);
            const currentBilling = uid ? await getBillingDoc(uid) : null;
            result = deriveBillingUpdate(event, currentBilling);
        }

        if (result) {
            const ref = db.collection("users").doc(result.uid).collection("meta").doc("billing");
            await ref.set(result.update, { merge: true });

            // Best-effort: this must never block or roll back the billing
            // write above, which is what actually grants what was paid for.
            // Redelivery-safe by construction — once this has run once, the
            // billing doc's stripeSubscriptionId is already null, so a
            // retried/duplicate event naturally computes cancelSubscriptionId
            // as null and skips this entirely.
            if (result.cancelSubscriptionId) {
                try {
                    await stripe().subscriptions.cancel(result.cancelSubscriptionId);
                } catch (err) {
                    console.error("stripe-webhook: failed to cancel superseded subscription", result.cancelSubscriptionId, err);
                }
            }
        }

        await eventRef.set({ type: event.type, status: "processed", processedAt: Date.now() }, { merge: true });
        return Response.json({ received: true });
    } catch (err) {
        // The billing write above is what actually grants what was paid
        // for — if it (or anything before it) throws, that can't fail
        // silently. There's no external error-monitoring service wired up
        // (see programmer-docs/launch-readiness-audit.md), so this is
        // logged AND persisted here, which is what makes a stuck charge
        // inspectable instead of surfacing for the first time as a
        // customer's "where's my upgrade" email. Returning 500 makes Stripe
        // retry, so a transient failure still gets a chance to self-heal.
        const message = err instanceof Error ? err.message : String(err);
        console.error("stripe-webhook: failed to process event", event.id, event.type, err);
        await eventRef
            .set({ type: event.type, status: "failed", error: message, failedAt: Date.now() }, { merge: true })
            .catch((logErr) => {
                console.error("stripe-webhook: also failed to record the failure", event.id, logErr);
            });
        return jsonError(500, "Internal error processing webhook.");
    }
};
