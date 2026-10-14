import type { Config } from "@netlify/functions";
import { adminAuth, firestore } from "./lib/firebaseAdmin";
import { evaluateUsage, type UsageFlagReason } from "./lib/usageWatch";

// Runs once a day. Paid accounts have no idea cap, so this counts each one's
// ideas (a Firestore count() aggregation: about one read per 1,000 ideas) and
// flags any that are huge or grew suddenly. It never blocks or changes an
// account; a flag is for a person to look at. Admin SDK only, so no
// firestore.rules entry is needed (clients are denied by default).
//
// Each flag is stored in `usageFlags` (with the account's uid and email) and,
// when GITHUB_TOKEN is set, opened as an issue holding only the counts and the
// flag id, so GitHub's notification email is the alert. The repository is
// public, so the uid stays out of the issue too.

const GITHUB_REPO = process.env.GITHUB_REPO ?? "Africk-Hunter/Intraconnected";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
// The schedule is the only caller; this stops a stray request re-running it.
const MIN_GAP_MS = 12 * 60 * 60 * 1000;
const PAID_PLANS = new Set(["annual", "lifetime"]);

interface WatchDoc {
    count: number;
    checkedAt: number;
    lastFlaggedCount: number | null;
}

async function openIssue(reason: UsageFlagReason, count: number, previousCount: number | null, flagId: string): Promise<void> {
    if (!GITHUB_TOKEN) return;
    const what = reason === "growth" ? `grew by ${count - (previousCount ?? 0)} ideas in a day` : `has ${count} ideas`;
    try {
        await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
            method: "POST",
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
            body: JSON.stringify({
                title: `[Usage] A paid account ${what}`,
                body: [`Reason: ${reason}`, `Ideas: ${count}`, `Previous check: ${previousCount ?? "none"}`, `Flag ID: ${flagId} (usageFlags collection, names the account)`].join("\n"),
                labels: ["usage"],
            }),
        });
    } catch {
        // The flag is already stored.
    }
}

export default async (): Promise<Response> => {
    const db = firestore();
    const now = Date.now();

    const runRef = db.collection("usageWatch").doc("_lastRun");
    const lastRun = (await runRef.get()).data()?.at;
    if (typeof lastRun === "number" && now - lastRun < MIN_GAP_MS) return new Response("Skipped: ran recently.");
    await runRef.set({ at: now });

    let checked = 0;
    let flagged = 0;
    let pageToken: string | undefined;
    do {
        const page = await adminAuth().listUsers(1000, pageToken);
        pageToken = page.pageToken;

        const billingRefs = page.users.map((u) => db.doc(`users/${u.uid}/meta/billing`));
        const watchRefs = page.users.map((u) => db.collection("usageWatch").doc(u.uid));
        const billingDocs = billingRefs.length ? await db.getAll(...billingRefs) : [];
        const watchDocs = watchRefs.length ? await db.getAll(...watchRefs) : [];

        for (let i = 0; i < page.users.length; i++) {
            const user = page.users[i]!;
            if (!PAID_PLANS.has(billingDocs[i]!.data()?.plan)) continue;

            const counted = await db.collection(`users/${user.uid}/ideas`).count().get();
            const count = counted.data().count;
            const before = watchDocs[i]!.data() as WatchDoc | undefined;
            const reason = evaluateUsage({ count, previousCount: before?.count ?? null, lastFlaggedCount: before?.lastFlaggedCount ?? null });

            let lastFlaggedCount = before?.lastFlaggedCount ?? null;
            if (reason) {
                const flagRef = db.collection("usageFlags").doc();
                await flagRef.set({ uid: user.uid, email: user.email ?? null, reason, count, previousCount: before?.count ?? null, flaggedAt: now });
                await openIssue(reason, count, before?.count ?? null, flagRef.id);
                if (reason === "size") lastFlaggedCount = count;
                flagged++;
            }
            await watchRefs[i]!.set({ count, checkedAt: now, lastFlaggedCount } satisfies WatchDoc);
            checked++;
        }
    } while (pageToken);

    return new Response(`Checked ${checked} paid accounts, flagged ${flagged}.`);
};

export const config: Config = { schedule: "@daily" };
