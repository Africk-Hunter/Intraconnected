import type { Config } from "@netlify/functions";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./lib/firebaseAdmin";

// Runs once a day and deletes the signed-out rate-limit docs (`rateLimits`,
// keyed by a hash of the caller's IP, see checkIpRateLimit) whose window has
// passed. The privacy policy promises these go automatically. A Firestore TTL
// policy on `expireAt` would do the same, but it can't be set up on this
// project, so this does it instead. Admin SDK only, like the docs themselves.

const PAGE = 500;

export default async (): Promise<Response> => {
    const db = firestore();
    const now = Timestamp.now();
    let deleted = 0;

    for (;;) {
        const snap = await db.collection("rateLimits").where("expireAt", "<", now).limit(PAGE).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        deleted += snap.size;
        if (snap.size < PAGE) break;
    }

    return new Response(`Deleted ${deleted} expired rate-limit docs.`);
};

export const config: Config = { schedule: "@daily" };
