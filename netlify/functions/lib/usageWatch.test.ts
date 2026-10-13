import { describe, it, expect } from "vitest";
import { evaluateUsage, GROWTH_FLAG, SIZE_FLAG } from "./usageWatch";

describe("evaluateUsage", () => {
    it("leaves an ordinary account alone", () => {
        expect(evaluateUsage({ count: 400, previousCount: 380, lastFlaggedCount: null })).toBeNull();
    });

    it("flags a big jump in one day, however small the account was", () => {
        expect(evaluateUsage({ count: GROWTH_FLAG + 10, previousCount: 10, lastFlaggedCount: null })).toBe("growth");
    });

    it("does not call a first sighting growth", () => {
        expect(evaluateUsage({ count: GROWTH_FLAG + 10, previousCount: null, lastFlaggedCount: null })).toBeNull();
    });

    it("flags a very large account once, then waits for it to get much bigger", () => {
        expect(evaluateUsage({ count: SIZE_FLAG, previousCount: SIZE_FLAG - 5, lastFlaggedCount: null })).toBe("size");
        expect(evaluateUsage({ count: SIZE_FLAG + 100, previousCount: SIZE_FLAG, lastFlaggedCount: SIZE_FLAG })).toBeNull();
        expect(evaluateUsage({ count: SIZE_FLAG * 1.5, previousCount: SIZE_FLAG * 1.4, lastFlaggedCount: SIZE_FLAG })).toBe("size");
    });

    it("reports growth ahead of size", () => {
        expect(evaluateUsage({ count: SIZE_FLAG + GROWTH_FLAG, previousCount: SIZE_FLAG, lastFlaggedCount: null })).toBe("growth");
    });
});
