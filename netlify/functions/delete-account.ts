import type { Firestore } from "firebase-admin/firestore";
import { firestore, adminAuth } from "./lib/firebaseAdmin";
import { stripe } from "./lib/stripe";
import { jsonResponse } from "./lib/cors";
import { checkRateLimit } from "./lib/rateLimit";
import { authed } from "./lib/handler";
import { getBillingDoc } from "./lib/lifetimePricing";

// Destructive and effectively one-shot per account (the account is gone
// after the first success) — this only needs to absorb a handful of retries
// after a transient failure, not support repeated real usage.
const DELETE_RATE_LIMIT = 3;
const DELETE_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

// The client re-checks the password right before calling this (see
// deleteUserAccount in authFirebase.ts), which mints a token with a fresh
// auth_time. Enforcing the same thing here is what makes it a real gate: a
// merely valid ID token (a borrowed session, a script on the origin) can't
// wipe the account on its own.
const MAX_SIGN_IN_AGE_SECONDS = 10 * 60;

async function deleteCollection(db: Firestore, uid: string, subcollection: string) {
    const snap = await db.collection("users").doc(uid).collection(subcollection).get();
    const docs = snap.docs;
    // Firestore batches cap at 500 writes — an unlimited-plan user's idea
    // tree can easily exceed that, so chunk it.
    for (let i = 0; i < docs.length; i += 500) {
        const batch = db.batch();
        docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

// Terminal statuses that never charge again and that Stripe refuses to
// cancel. incomplete_expired is what an abandoned Annual checkout becomes,
// and the webhook still records its id on meta/billing.
const NOT_BILLING_STATUSES = ["canceled", "incomplete_expired"];

// True when the subscription is certainly not billing any more. A failed
// cancel is only ignorable if Stripe says it's already gone or in a terminal
// state; anything else (network, rate limit, outage) leaves it live and charging.
async function subscriptionIsGone(subscriptionId: string): Promise<boolean> {
    try {
        const subscription = await stripe().subscriptions.retrieve(subscriptionId);
        return NOT_BILLING_STATUSES.includes(subscription.status);
    } catch (err) {
        return (err as { code?: string }).code === "resource_missing";
    }
}

// Runs the whole account deletion server-side via the Admin SDK, instead of
// the client deleting its own Firestore docs and Auth record. Two reasons:
// this is the only place that can reach Stripe to cancel a subscription
// before the billing doc naming it is gone, and doing the Firestore/Auth
// deletion here too means it doesn't depend on whatever the client happens
// to be allowed to touch under Firestore rules.
export default authed(
    {
        signInMessage: "You must be signed in to delete your account.",
        recentSignIn: { maxAgeSeconds: MAX_SIGN_IN_AGE_SECONDS, message: "Please confirm your password again to delete your account." },
    },
    async ({ req, uid, fail }) => {
        const allowed = await checkRateLimit({ uid, key: "deleteAccount", limit: DELETE_RATE_LIMIT, windowMs: DELETE_RATE_WINDOW_MS });
        if (!allowed) {
            return fail(429, "Too many attempts. Please wait a bit and try again.");
        }

        // Deleting the account means there's no one left to keep paying for or
        // to grant access to — this is a hard, immediate cancel, unlike the
        // self-serve cancel-subscription.ts flow (cancel_at_period_end), which
        // exists precisely because that user is still around to use out what
        // they already paid for.
        const subscriptionId = (await getBillingDoc(uid))?.stripeSubscriptionId;
        if (subscriptionId) {
            try {
                await stripe().subscriptions.cancel(subscriptionId);
            } catch (err) {
                // Already canceled is fine. Anything else must stop here: once
                // the billing doc and Auth user are gone nothing can cancel the
                // subscription, and it would keep charging the card every year.
                if (!(await subscriptionIsGone(subscriptionId))) {
                    console.error("delete-account: failed to cancel subscription", subscriptionId, err);
                    return fail(502, "Couldn't cancel your subscription, so your account was not deleted. Please try again.");
                }
            }
        }

        const db = firestore();
        await deleteCollection(db, uid, "ideas");
        await deleteCollection(db, uid, "meta");

        await adminAuth().deleteUser(uid);

        return jsonResponse(req, { success: true });
    }
);
