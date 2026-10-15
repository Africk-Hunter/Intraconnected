import type { Context } from "@netlify/functions";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "./lib/firebaseAdmin";
import { checkRateLimit } from "./lib/rateLimit";
import { authed } from "./lib/handler";
import { corsHeaders } from "./lib/cors";

const RECOVERY_RATE_LIMIT = 5;
const RECOVERY_RATE_WINDOW_MS = 60 * 60 * 1000;

function noStore(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

const authenticatedHandler = authed(
    {
        signInMessage: "Sign in again before recovering your encryption key.",
        recentSignIn: {
            maxAgeSeconds: 10 * 60,
            message: "Sign in again before recovering your encryption key.",
        },
    },
    async ({ req, uid, fail }) => {
        const allowed = await checkRateLimit({
            uid,
            key: "recoverKey",
            limit: RECOVERY_RATE_LIMIT,
            windowMs: RECOVERY_RATE_WINDOW_MS,
        });
        if (!allowed) return fail(429, "Too many recovery attempts. Please wait before trying again.");

        const db = firestore();
        const encryptionRef = db.collection("users").doc(uid).collection("meta").doc("encryption");
        const encryptionSnap = await encryptionRef.get();
        const recoveryWrap = encryptionSnap.data()?.recoveryWrap;
        if (!encryptionSnap.exists || typeof recoveryWrap !== "string" || !recoveryWrap.startsWith("kms1:")) {
            return fail(404, "No KMS recovery key is available for this account.");
        }

        const wrapMatch = /^kms1:(?:([a-z][a-z0-9_-]{0,31}):)?([^:]+)$/.exec(recoveryWrap);
        if (!wrapMatch) return fail(400, "The encryption recovery data is invalid.");
        const keyId = wrapMatch[1];
        const ciphertext = wrapMatch[2];
        const keyVersionName = keyId
            ? process.env[`KMS_KEY_VERSION_NAME_${keyId.toUpperCase()}`]
            : process.env.KMS_KEY_VERSION_NAME;
        const credentialsJson = process.env.KMS_SERVICE_ACCOUNT_JSON;
        if (!keyVersionName || !credentialsJson) {
            console.error(`recover-key: KMS key version for ${keyId ?? "legacy"} or KMS_SERVICE_ACCOUNT_JSON is not configured.`);
            return fail(503, "Encryption-key recovery is temporarily unavailable.");
        }

        let plaintext: Uint8Array;
        try {
            const credentials = JSON.parse(Buffer.from(credentialsJson, "base64").toString("utf8"));
            const client = new KeyManagementServiceClient({ credentials });
            const [result] = await client.asymmetricDecrypt({
                name: keyVersionName,
                ciphertext,
            });
            if (!result.plaintext) throw new Error("KMS returned an empty plaintext.");
            plaintext = typeof result.plaintext === "string"
                ? new Uint8Array(Buffer.from(result.plaintext, "base64"))
                : new Uint8Array(result.plaintext);
        } catch (error) {
            console.error("recover-key: Cloud KMS decryption failed.", error);
            return fail(502, "The encryption key could not be recovered. Please try again.");
        }

        const uidBytes = new TextEncoder().encode(uid);
        if (plaintext.length !== 32 + uidBytes.length || !uidBytes.every((byte, index) => plaintext[32 + index] === byte)) {
            console.error("recover-key: KMS payload did not match the authenticated account.", uid);
            return fail(403, "The recovery key does not belong to this account.");
        }

        await db.collection("recoveryAudit").add({
            uid,
            at: FieldValue.serverTimestamp(),
            result: "success",
        });

        const dek = Buffer.from(plaintext.slice(0, 32)).toString("base64");
        return new Response(JSON.stringify({ dek }), {
            status: 200,
            headers: {
                ...corsHeaders(req),
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
            },
        });
    }
);

export default async function handler(req: Request, context: Context): Promise<Response> {
    return noStore(await authenticatedHandler(req, context));
}
