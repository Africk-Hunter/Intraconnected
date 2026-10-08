import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { FREE_NODE_LIMIT } from "../../shared/limits";

describe("firestore.rules", () => {
    // Rules can't import anything, so the cap is a literal there.
    it("enforces the same free-plan cap as FREE_NODE_LIMIT", () => {
        const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
        expect(rules).toContain(`.data.count < ${FREE_NODE_LIMIT}`);
    });
});
