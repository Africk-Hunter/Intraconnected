import type { Context } from "@netlify/functions";
import { verifyIdToken, firestore, adminAuth } from "./lib/firebaseAdmin";
import { preflightResponse, jsonResponse } from "./lib/cors";

// Testing-only endpoint for the Profile → Developer Testing tab: lists accounts
// (email + current plan) and grants any of them Lifetime without a Stripe
// payment. Gated by ALLOW_TEST_RESET exactly like set-plan-test.ts (local .env
// only, never Netlify site env vars), so it 404s on every deployed instance.
// Writes no Stripe objects; "Reset to Free" only resets the caller's own doc.
export default async (req: Request, _context: Context) => {
    if (process.env.ALLOW_TEST_RESET !== "true") {
        return new Response(null, { status: 404 });
    }

    const preflight = preflightResponse(req);
    if (preflight) return preflight;

    function jsonError(status: number, message: string) {
        return jsonResponse(req, { error: message }, status);
    }

    if (req.method !== "POST") {
        return jsonError(405, "Method not allowed.");
    }

    const callerUid = await verifyIdToken(req);
    if (!callerUid) {
        return jsonError(401, "You must be signed in.");
    }

    let body: { action?: unknown; uid?: unknown; email?: unknown };
    try {
        body = (await req.json()) as { action?: unknown; uid?: unknown; email?: unknown };
    } catch {
        return jsonError(400, "Invalid request body.");
    }

    const db = firestore();
    const billingRef = (uid: string) =>
        db.collection("users").doc(uid).collection("meta").doc("billing");

    if (body.action === "list") {
        // One page (up to 1000 accounts) is plenty for a dev project.
        const { users } = await adminAuth().listUsers(1000);
        const snaps = users.length ? await db.getAll(...users.map(u => billingRef(u.uid))) : [];
        const result = users.map((u, i) => ({
            uid: u.uid,
            email: u.email ?? null,
            plan: (snaps[i]?.data()?.plan as string | undefined) ?? "free",
        }));
        return jsonResponse(req, { users: result });
    }

    if (body.action === "lookup") {
        if (typeof body.email !== "string" || !body.email.trim()) {
            return jsonError(400, "email is required.");
        }
        try {
            const user = await adminAuth().getUserByEmail(body.email.trim());
            return jsonResponse(req, { uid: user.uid, email: user.email ?? null });
        } catch {
            return jsonError(404, "No account with that email.");
        }
    }

    if (body.action === "grant") {
        if (typeof body.uid !== "string" || !body.uid) {
            return jsonError(400, "uid is required.");
        }
        try {
            await adminAuth().getUser(body.uid);
        } catch {
            return jsonError(404, "No such user.");
        }
        await billingRef(body.uid).set(
            {
                plan: "lifetime",
                stripeSubscriptionId: null,
                subscriptionStatus: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                previousPlan: null,
                // No purchase behind a grant, so nothing for refund-lifetime to refund.
                lifetimePaymentIntentId: null,
                updatedAt: Date.now(),
            },
            { merge: true }
        );
        return jsonResponse(req, { success: true });
    }

    return jsonError(400, "action must be 'list', 'lookup' or 'grant'.");
};
