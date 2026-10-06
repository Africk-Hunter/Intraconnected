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

// Stripe rejects a trial_end that's already (or about to be) in the past;
// anything this close to the original renewal isn't worth restoring anyway.
const MIN_RESTORE_SECONDS = 60;

// Undoes the "canceled immediately" half of an Annual→Lifetime upgrade once
// that specific upgrade is refunded (see deriveLifetimeRefundUpdate's docs)
// — reverting `plan` to "annual" is meaningless on its own, since the
// subscription that plan used to describe was already canceled at upgrade
// time, not left to expire.
//
// Restores exactly what the user had before upgrading, without charging
// them again: a new subscription on the same Customer whose trial runs to
// the end of the year they'd already paid for (read off the superseded,
// now-canceled subscription), so it's `trialing` — which already grants
// Annual — and first bills on the original renewal date with the same saved
// card. Their cancel_at_period_end choice carries over too, so someone who'd
// already cancelled isn't silently renewed. If that year has already run
// out there's nothing left to restore, so this lands on "free" rather than
// charging someone off-session right after they asked for a refund.
//
// (An earlier version created the subscription with
// payment_behavior: "default_incomplete" and no trial — that first invoice
// needs client-side confirmation nothing ever performed, so the restore
// always ended up `incomplete` → "free".)
//
// Reuses deriveBillingUpdate's own customer.subscription.updated mapping —
// by synthesizing the event Stripe would otherwise send for this same
// subscription object — rather than duplicating its status-gating logic.
// Falls back to "free" — never to an ungated "annual" — if there's no
// customer/price/prior subscription to restore from, or if Stripe rejects
// the attempt outright.
async function resumeAnnualSubscription(uid: string, refundResult: BillingEventResult): Promise<BillingEventResult> {
    const toFree: BillingEventResult = { uid, update: { ...refundResult.update, plan: "free" } };
    const customerId = refundResult.update.stripeCustomerId;
    if (!customerId || !STRIPE_PRICE_ANNUAL) {
        console.error("stripe-webhook: cannot restore Annual subscription on refund — missing customer or price env var", {
            uid,
            hasCustomer: Boolean(customerId),
        });
        return toFree;
    }
    try {
        // Most recent canceled subscription — the one the upgrade superseded
        // (lists are newest-first).
        const canceled = await stripe().subscriptions.list({ customer: customerId, status: "canceled", limit: 1 });
        const previous = canceled.data[0];
        const periodEnd = previous?.items.data[0]?.current_period_end;
        if (!previous || !periodEnd || periodEnd <= Math.floor(Date.now() / 1000) + MIN_RESTORE_SECONDS) {
            return toFree;
        }
        const paymentMethod = previous.default_payment_method;
        const subscription = await stripe().subscriptions.create({
            customer: customerId,
            items: [{ price: STRIPE_PRICE_ANNUAL }],
            trial_end: periodEnd,
            cancel_at_period_end: previous.cancel_at_period_end,
            ...(paymentMethod ? { default_payment_method: typeof paymentMethod === "string" ? paymentMethod : paymentMethod.id } : {}),
            // No card left on file → end cleanly at the original renewal
            // date instead of generating an invoice that can never be paid.
            trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
            metadata: { firebaseUid: uid },
        });
        const resumedEvent = { type: "customer.subscription.updated", data: { object: subscription } } as unknown as Stripe.Event;
        return deriveBillingUpdate(resumedEvent, refundResult.update) ?? toFree;
    } catch (err) {
        console.error("stripe-webhook: failed to restore Annual subscription on refund", uid, err);
        return toFree;
    }
}

// Called by Stripe, not a signed-in user — auth is the signature check
// below, not verifyIdToken.
const CLAIM_STALE_MS = 2 * 60 * 1000;
const FIRESTORE_ALREADY_EXISTS = 6;

// True when this delivery now owns the event and should process it.
async function claimEvent(
    eventRef: FirebaseFirestore.DocumentReference,
    type: string
): Promise<boolean> {
    const claim = { type, status: "processing", claimedAt: Date.now() };
    try {
        await eventRef.create(claim);
        return true;
    } catch (err) {
        if ((err as { code?: number }).code !== FIRESTORE_ALREADY_EXISTS) throw err;
    }
    const existing = (await eventRef.get()).data();
    if (existing?.status === "processed") return false;
    if (existing?.status === "processing" && Date.now() - (existing.claimedAt ?? 0) < CLAIM_STALE_MS) return false;
    await eventRef.set(claim);
    return true;
}

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
    //
    // The event is claimed atomically (create() fails if the doc exists)
    // before any work starts, not just checked: duplicate deliveries often
    // overlap in time, and a plain get-then-process lets every one of them
    // through. Several overlapping refund deliveries each created their own
    // restored Annual subscription that way. A "failed" or long-stale
    // "processing" claim is taken over so Stripe's retry can still heal it.
    if (!(await claimEvent(eventRef, event.type))) {
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
        // (see programmer-docs/artifacts/shipping-readiness.md, E5), so this is
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
