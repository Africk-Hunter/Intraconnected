import type { Context } from "@netlify/functions";
import type Stripe from "stripe";
import { firestore } from "./lib/firebaseAdmin";
import { stripe } from "./lib/stripe";
import { deriveBillingUpdate } from "./lib/billingEvents";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function jsonError(status: number, message: string) {
    return Response.json({ error: message }, { status });
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

    const result = deriveBillingUpdate(event);
    if (result) {
        const db = firestore();
        const ref = db.collection("users").doc(result.uid).collection("meta").doc("billing");
        await ref.set(result.update, { merge: true });
    }

    return Response.json({ received: true });
};
