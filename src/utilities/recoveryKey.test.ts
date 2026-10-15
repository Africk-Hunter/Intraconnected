import { describe, expect, it } from "vitest";
import { RECOVERY_KEY_ID, RECOVERY_PUBLIC_KEY_SPKI_BASE64 } from "./recoveryKey";
import { generateDEK, wrapDEKForRecovery } from "./crypto";

// Guards the shipped Cloud KMS public key: a typo or truncation would make
// every sign-up fail, and a wrong key size would break the server's decrypt.
describe("shipped recovery public key", () => {
    it("is a 3072-bit RSA-OAEP SHA-256 key and wraps with the format recover-key.ts parses", async () => {
        const wrap = await wrapDEKForRecovery(await generateDEK(), "uid-with-28-characters-xxxx");

        // Same pattern as netlify/functions/recover-key.ts.
        const match = /^kms1:(?:([a-z][a-z0-9_-]{0,31}):)?([^:]+)$/.exec(wrap);
        expect(match?.[1]).toBe(RECOVERY_KEY_ID);
        // RSA-3072 ciphertext is 384 bytes.
        expect(Buffer.from(match![2], "base64")).toHaveLength(384);
        expect(RECOVERY_PUBLIC_KEY_SPKI_BASE64).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
});
