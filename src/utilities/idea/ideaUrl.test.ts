import { describe, it, expect } from "vitest";
import { buildIdeaUrl, parseIdeaParam } from "./ideaUrl";

describe("parseIdeaParam", () => {
    it("reads a positive whole number", () => {
        expect(parseIdeaParam("?idea=1700000000000")).toBe(1700000000000);
        expect(parseIdeaParam("?other=1&idea=42")).toBe(42);
    });

    it("returns null when missing or not a plain number", () => {
        expect(parseIdeaParam("")).toBeNull();
        expect(parseIdeaParam("?idea=")).toBeNull();
        expect(parseIdeaParam("?idea=abc")).toBeNull();
        expect(parseIdeaParam("?idea=-5")).toBeNull();
        expect(parseIdeaParam("?idea=1.5")).toBeNull();
        expect(parseIdeaParam("?idea=0")).toBeNull();
        expect(parseIdeaParam("?idea=1e3")).toBeNull();
        expect(parseIdeaParam("?idea=99999999999999999999")).toBeNull();
    });
});

describe("buildIdeaUrl", () => {
    it("uses the bare path for the top level", () => {
        expect(buildIdeaUrl(1)).toBe("/main");
    });

    it("puts any other level in the query", () => {
        expect(buildIdeaUrl(123)).toBe("/main?idea=123");
    });

    it("round-trips through the parser", () => {
        const url = buildIdeaUrl(1700000000123);
        expect(parseIdeaParam(url.slice(url.indexOf("?")))).toBe(1700000000123);
    });
});
