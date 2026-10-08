import type { Context } from "@netlify/functions";
import { firestore, verifyIdTokenDetailed } from "./lib/firebaseAdmin";
import { containsProfanity } from "./lib/profanityFilter";
import { preflightResponse, jsonResponse } from "./lib/cors";
import { checkRateLimit } from "./lib/rateLimit";
import type { TrackedIssue } from "../../shared/featureRequests";

const GITHUB_REPO = process.env.GITHUB_REPO ?? "Africk-Hunter/Intraconnected";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const TITLE_MAX_LENGTH = 100;
const BODY_MAX_LENGTH = 1000;
const RATE_LIMIT_PER_DAY = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;


export default async (req: Request, _context: Context) => {
    const preflight = preflightResponse(req);
    if (preflight) return preflight;

    function jsonError(status: number, message: string) {
        return jsonResponse(req, { error: message }, status);
    }

    if (req.method !== "POST") {
        return jsonError(405, "Method not allowed.");
    }
    if (!GITHUB_TOKEN) {
        return jsonError(500, "Server misconfigured.");
    }

    const user = await verifyIdTokenDetailed(req);
    if (!user) {
        return jsonError(401, "You must be signed in to submit a feature request.");
    }
    // Every request opens a GitHub issue with the server's token, and sign-up
    // is open — without this, throwaway accounts are free issue spam.
    if (!user.emailVerified) {
        return jsonError(403, "Please verify your email address before submitting a feature request.");
    }
    const uid = user.uid;

    let payload: { title?: unknown; body?: unknown };
    try {
        payload = (await req.json()) as { title?: unknown; body?: unknown };
    } catch {
        return jsonError(400, "Invalid request body.");
    }

    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const body = typeof payload.body === "string" ? payload.body.trim() : "";

    if (!title) return jsonError(400, "Title is required.");
    if (title.length > TITLE_MAX_LENGTH) return jsonError(400, `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`);
    if (body.length > BODY_MAX_LENGTH) return jsonError(400, `Description must be ${BODY_MAX_LENGTH} characters or fewer.`);
    if (containsProfanity(title) || containsProfanity(body)) return jsonError(400, "Please keep your request respectful.");

    // Claimed before the GitHub call (and atomically — see checkRateLimit),
    // so simultaneous requests can't all slip under the limit. A request that
    // then fails at GitHub still uses up its slot; that's the cheap side to
    // err on.
    const allowed = await checkRateLimit({ uid, key: "featureRequest", limit: RATE_LIMIT_PER_DAY, windowMs: RATE_LIMIT_WINDOW_MS });
    if (!allowed) {
        return jsonError(429, "You've reached the daily limit for feature requests. Try again tomorrow.");
    }

    const db = firestore();
    const ref = db.collection("users").doc(uid).collection("meta").doc("featureRequests");
    const snap = await ref.get();
    const existing: TrackedIssue[] = snap.exists ? (snap.data()?.issues ?? []) : [];

    let issueNumber: number;
    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                "Content-Type": "application/json",
                Accept: "application/vnd.github+json",
            },
            body: JSON.stringify({
                title: `[Feature Request] ${title}`,
                body: body || undefined,
            }),
        });
        if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
        const data = (await res.json()) as { number: number };
        issueNumber = data.number;
    } catch {
        return jsonError(502, "Failed to create the feature request. Try again later.");
    }

    await ref.set({
        issues: [...existing, { issueNumber, title, seenClosed: false, createdAt: Date.now() }],
    });

    return jsonResponse(req, { issueNumber });
};
