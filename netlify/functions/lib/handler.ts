import type { Context } from "@netlify/functions";
import { verifyIdToken, verifyIdTokenWithAuthTime } from "./firebaseAdmin";
import { preflightResponse, jsonResponse } from "./cors";

export type Fail = (status: number, message: string) => Response;

interface AuthedCall {
    req: Request;
    uid: string;
    // A JSON `{ error }` response with the right CORS headers.
    fail: Fail;
}

interface AuthedOptions {
    // Defaults to POST.
    method?: "GET" | "POST";
    // The 401 body when there is no valid ID token.
    signInMessage: string;
    // For destructive actions: also require the caller's last real sign-in to
    // be recent (see verifyIdTokenWithAuthTime), answering 403 otherwise.
    recentSignIn?: { maxAgeSeconds: number; message: string };
}

// The setup every user-invoked function repeats, in the order they all had it:
// CORS preflight, method check, ID-token check. `run` only sees a verified
// uid. Functions that need more from the token (create-payment-intent reads
// the email claims) or aren't called by a signed-in user (stripe-webhook)
// don't use this.
export function authed(options: AuthedOptions, run: (call: AuthedCall) => Promise<Response>) {
    return async (req: Request, _context: Context): Promise<Response> => {
        const preflight = preflightResponse(req);
        if (preflight) return preflight;

        const fail: Fail = (status, message) => jsonResponse(req, { error: message }, status);

        if (req.method !== (options.method ?? "POST")) {
            return fail(405, "Method not allowed.");
        }

        let uid: string | null;
        if (options.recentSignIn) {
            const caller = await verifyIdTokenWithAuthTime(req);
            if (!caller) return fail(401, options.signInMessage);
            if (Date.now() / 1000 - caller.authTime > options.recentSignIn.maxAgeSeconds) {
                return fail(403, options.recentSignIn.message);
            }
            uid = caller.uid;
        } else {
            uid = await verifyIdToken(req);
            if (!uid) return fail(401, options.signInMessage);
        }

        return run({ req, uid, fail });
    };
}
