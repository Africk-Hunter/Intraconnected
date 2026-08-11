import type { Context } from "@netlify/functions";
import { firestore, verifyIdToken } from "./lib/firebaseAdmin";

const GITHUB_REPO = process.env.GITHUB_REPO ?? "Africk-Hunter/Intraconnected";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

interface TrackedIssue {
    issueNumber: number;
    title: string;
    seenClosed: boolean;
    createdAt: number;
}

function jsonError(status: number, message: string) {
    return Response.json({ error: message }, { status });
}

export default async (req: Request, _context: Context) => {
    if (!GITHUB_TOKEN) {
        return jsonError(500, "Server misconfigured.");
    }

    const uid = await verifyIdToken(req);
    if (!uid) {
        return jsonError(401, "You must be signed in.");
    }

    const db = firestore();
    const ref = db.collection("users").doc(uid).collection("meta").doc("featureRequests");
    const snap = await ref.get();
    if (!snap.exists) return Response.json(null);

    const issues: TrackedIssue[] = snap.data()?.issues ?? [];
    const pending = issues.filter((i) => !i.seenClosed);
    if (pending.length === 0) return Response.json(null);

    const implemented: TrackedIssue[] = [];

    await Promise.all(
        pending.map(async (issue) => {
            try {
                const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues/${issue.issueNumber}`, {
                    headers: {
                        Authorization: `Bearer ${GITHUB_TOKEN}`,
                        Accept: "application/vnd.github+json",
                    },
                });
                if (!res.ok) return;
                const data = (await res.json()) as { state?: string; state_reason?: string };
                if (data.state === "closed" && data.state_reason === "completed") {
                    implemented.push(issue);
                }
            } catch {
                // ignore network errors
            }
        })
    );

    if (implemented.length === 0) return Response.json(null);

    const updated = issues.map((i) =>
        implemented.some((impl) => impl.issueNumber === i.issueNumber) ? { ...i, seenClosed: true } : i
    );
    await ref.set({ issues: updated });

    return Response.json(implemented.map((i) => i.title));
};
