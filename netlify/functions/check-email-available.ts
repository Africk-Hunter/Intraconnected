import { jsonResponse } from "./lib/cors";
import { checkRateLimit } from "./lib/rateLimit";
import { authed } from "./lib/handler";
import { adminAuth } from "./lib/firebaseAdmin";

// Generous enough for someone retrying typos, tight enough that the endpoint
// is no use for working through a list of addresses.
const CHECK_RATE_LIMIT = 10;
const CHECK_RATE_WINDOW_MS = 60 * 60 * 1000;

// Whether an email is free to move an account to. The client can't ask
// Firebase itself: with email enumeration protection on (the default for new
// projects) `fetchSignInMethodsForEmail` always answers "none" and
// `verifyBeforeUpdateEmail` quietly sends the link anyway, so the user would
// find out only after clicking it. Signed-in callers only, and rate limited,
// because this does reveal whether an address has an account.
export default authed({ signInMessage: "You must be signed in to change your email." }, async ({ req, uid, fail }) => {
    let email = "";
    try {
        const body = (await req.json()) as { email?: unknown };
        if (typeof body.email === "string") email = body.email.trim().toLowerCase();
    } catch {
        // Falls through to the validation below.
    }
    if (!email || email.length > 254 || !email.includes("@")) {
        return fail(400, "Enter a valid email address.");
    }

    const allowed = await checkRateLimit({ uid, key: "checkEmailAvailable", limit: CHECK_RATE_LIMIT, windowMs: CHECK_RATE_WINDOW_MS });
    if (!allowed) {
        return fail(429, "Too many attempts. Please wait a bit and try again.");
    }

    try {
        const existing = await adminAuth().getUserByEmail(email);
        // Their own address isn't "taken" — the client rejects that case with
        // its own message, but don't report it as someone else's account.
        return jsonResponse(req, { available: existing.uid === uid });
    } catch (err) {
        if ((err as { code?: string }).code === "auth/user-not-found") {
            return jsonResponse(req, { available: true });
        }
        console.error("Failed to check email availability:", err);
        return fail(502, "Could not check that email address. Please try again.");
    }
});
