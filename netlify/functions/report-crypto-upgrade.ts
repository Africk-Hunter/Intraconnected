import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "./lib/firebaseAdmin";
import { jsonResponse } from "./lib/cors";
import { checkRateLimit } from "./lib/rateLimit";
import { authed } from "./lib/handler";

const REPORT_RATE_LIMIT = 20;
const REPORT_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

// The sign-in upgrade steps in Auth.tsx that can fail without blocking sign-in.
const STEPS = ["recovery-wrap", "recovery-store", "legacy-removal", "password-wrap"] as const;
type Step = (typeof STEPS)[number];

function isStep(value: unknown): value is Step {
    return typeof value === "string" && (STEPS as readonly string[]).includes(value);
}

// `cryptoUpgradeFailures/{uid}` lists the accounts whose key-protection upgrade
// is stuck: a failure creates or updates the doc, a clean upgrade deletes it, so
// the collection is the current set of stuck accounts. Diagnostic only, no
// email, no free text. Admin-SDK only (firestore.rules denies clients), and
// delete-account removes it.
export default authed(
    { signInMessage: "You must be signed in." },
    async ({ req, uid, fail }) => {
        let body: { step?: unknown; resolved?: unknown };
        try {
            body = (await req.json()) as typeof body;
        } catch {
            return fail(400, "Invalid request.");
        }

        const allowed = await checkRateLimit({ uid, key: "reportCryptoUpgrade", limit: REPORT_RATE_LIMIT, windowMs: REPORT_RATE_WINDOW_MS });
        if (!allowed) return fail(429, "Too many reports.");

        const ref = firestore().collection("cryptoUpgradeFailures").doc(uid);
        if (body.resolved === true) {
            await ref.delete();
            return jsonResponse(req, { success: true });
        }
        if (!isStep(body.step)) return fail(400, "Unknown step.");

        await ref.set({
            uid,
            lastStep: body.step,
            steps: FieldValue.arrayUnion(body.step),
            count: FieldValue.increment(1),
            lastAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return jsonResponse(req, { success: true });
    }
);
