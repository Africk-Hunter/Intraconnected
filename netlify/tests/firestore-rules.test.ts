import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { FREE_NODE_LIMIT } from "../../shared/limits";

describe("firestore.rules", () => {
    // Rules can't import anything, so the cap is a literal there.
    it("enforces the same free-plan cap as FREE_NODE_LIMIT", () => {
        const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
        expect(rules).toContain(`.data.count < ${FREE_NODE_LIMIT}`);
    });

    it("lets users read only their recovery audit records and never write them", () => {
        const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
        expect(rules).toMatch(
            /match \/recoveryAudit\/\{auditId\}\s*\{\s*allow read: if request\.auth != null && resource\.data\.uid == request\.auth\.uid;\s*allow write: if false;\s*\}/
        );
    });

    it("leaves meta/vault under the owner-only meta rule (it is the user's own wrapped key, written from the browser)", () => {
        const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
        expect(rules).not.toContain("'vault'");
        expect(rules).toMatch(/match \/meta\/\{metaDocId\}/);
    });
});
