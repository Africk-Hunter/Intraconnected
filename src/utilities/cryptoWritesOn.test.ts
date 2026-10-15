import { describe, expect, it } from "vitest";
import { decryptField, encryptField, generateDEK, needsPasswordWrapUpgrade, wrapDEK } from "./crypto";

describe("default encryption writes", () => {
    it("writes the enc2 field format and the Argon2id password wrap", async () => {
        const dek = await generateDEK();
        const encrypted = await encryptField("new format", dek, "uid-1|42|content");
        const passwordWrap = await wrapDEK(dek, "correct horse", "uid-1");

        expect(encrypted.startsWith("enc2:")).toBe(true);
        expect(await decryptField(encrypted, dek, "uid-1|42|content")).toBe("new format");
        expect(passwordWrap.startsWith("v3:")).toBe(true);
        expect(needsPasswordWrapUpgrade(passwordWrap)).toBe(false);
    });
});
