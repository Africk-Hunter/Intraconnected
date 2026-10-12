import type { Context } from "@netlify/functions";
import { firestore, verifyIdTokenDetailed } from "./lib/firebaseAdmin";
import { preflightResponse, jsonResponse } from "./lib/cors";
import { checkIpRateLimit, checkRateLimit } from "./lib/rateLimit";
import {
    REPORT_CONTACT_MAX,
    REPORT_FIELD_MAX,
    REPORT_MESSAGE_MAX,
    isReportArea,
    type ReportDiagnostics,
} from "../../shared/bugReports";

const GITHUB_REPO = process.env.GITHUB_REPO ?? "Africk-Hunter/Intraconnected";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const RATE_LIMIT_PER_DAY = 10;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Control characters and anything past `max`; the text is only ever displayed.
function clean(value: unknown, max: number): string {
    if (typeof value !== "string") return "";
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}

function cleanDiagnostics(raw: unknown): ReportDiagnostics {
    const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const out: ReportDiagnostics = {};
    for (const key of ["error", "route", "platform", "userAgent", "plan", "syncFailure"] as const) {
        const value = clean(d[key], REPORT_FIELD_MAX);
        if (value) out[key] = value;
    }
    if (typeof d.pendingChanges === "number" && Number.isFinite(d.pendingChanges)) out.pendingChanges = Math.max(0, Math.floor(d.pendingChanges));
    if (typeof d.online === "boolean") out.online = d.online;
    return out;
}

// A fence the reporter's text can't close, so it can't inject markdown or
// @-mention anyone in the issue.
function fenced(text: string): string {
    return "~~~~text\n" + text.replace(/~~~~/g, "~~~") + "\n~~~~";
}

export default async (req: Request, context: Context) => {
    const preflight = preflightResponse(req);
    if (preflight) return preflight;

    const jsonError = (status: number, message: string) => jsonResponse(req, { error: message }, status);

    if (req.method !== "POST") return jsonError(405, "Method not allowed.");

    let payload: Record<string, unknown>;
    try {
        payload = (await req.json()) as Record<string, unknown>;
    } catch {
        return jsonError(400, "Invalid request body.");
    }

    const message = clean(payload.message, REPORT_MESSAGE_MAX);
    if (!message) return jsonError(400, "Tell us what happened.");
    const area = isReportArea(payload.area) ? payload.area : "other";
    const diagnostics = cleanDiagnostics(payload.diagnostics);
    const contact = clean(payload.contact, REPORT_CONTACT_MAX);

    // Signed-in reports are tied to the account (limit per user); signed-out
    // ones to the caller's address. A bad token is treated as signed out
    // rather than refused: a session that has just expired is a common reason
    // to be reporting in the first place.
    const user = await verifyIdTokenDetailed(req);
    try {
        const allowed = user
            ? await checkRateLimit({ uid: user.uid, key: "bugReport", limit: RATE_LIMIT_PER_DAY, windowMs: RATE_LIMIT_WINDOW_MS })
            : await checkIpRateLimit({
                  ip: context.ip || req.headers.get("x-nf-client-connection-ip") || "unknown",
                  key: "bugReport",
                  limit: RATE_LIMIT_PER_DAY,
                  windowMs: RATE_LIMIT_WINDOW_MS,
              });
        if (!allowed) return jsonError(429, "You've sent a lot of reports today. Please try again tomorrow.");
    } catch {
        return jsonError(500, "Couldn't send your report. Try again later.");
    }

    // Saved first: the report must survive GitHub being down or the token
    // being unset. Account details live only here, never in the issue.
    const ref = firestore().collection("bugReports").doc();
    const reportId = ref.id;
    try {
        await ref.set({
            area,
            message,
            diagnostics,
            uid: user?.uid ?? null,
            accountEmail: user?.email ?? null,
            contact: contact || null,
            createdAt: Date.now(),
            issueNumber: null,
        });
    } catch {
        return jsonError(500, "Couldn't send your report. Try again later.");
    }

    if (GITHUB_TOKEN) {
        try {
            const diagLines = Object.entries(diagnostics).map(([k, v]) => `- ${k}: ${String(v)}`);
            const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    "Content-Type": "application/json",
                    Accept: "application/vnd.github+json",
                },
                body: JSON.stringify({
                    title: `[Bug Report] ${area}: ${message.split("\n")[0]!.slice(0, 80)}`,
                    body: [
                        fenced(message),
                        "",
                        `Area: ${area}`,
                        `Report ID: ${reportId}`,
                        user ? "Signed in: yes" : "Signed in: no",
                        contact ? "Contact given: yes (see the report document)" : "Contact given: no",
                        "",
                        "Diagnostics",
                        ...diagLines,
                    ].join("\n"),
                    labels: ["bug"],
                }),
            });
            if (res.ok) {
                const data = (await res.json()) as { number: number };
                await ref.update({ issueNumber: data.number }).catch(() => {});
            }
        } catch {
            // The report is already stored; the issue can be made from it.
        }
    }

    return jsonResponse(req, { reportId });
};
