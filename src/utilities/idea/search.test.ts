import { describe, it, expect } from "vitest";
import type { IdeaType } from "../types";
import { searchIdeas, suggestedIdeas } from "./search";

const ideas: IdeaType[] = [
    { id: 1, content: "Ideas", parentID: 0, link: "" },
    { id: 10, content: "Garden plan", parentID: 1, link: "" },
    { id: 11, content: "Buy tomato seeds", parentID: 10, link: "" },
    { id: 12, content: "Tomato blight reading", parentID: 10, link: "https://example.com/blight" },
    { id: 13, type: "checklist", content: "Spring jobs", parentID: 10, items: [
        { id: "a", text: "Order tomato cages", checked: false },
        { id: "b", text: "Prune roses", checked: true },
    ] },
    { id: 14, content: "Watering log with a rather long body about tomato plants and when they were last fed", parentID: 10, link: "", isNote: true, noteTitle: "Watering" } as IdeaType,
    { id: 20, content: "Work", parentID: 1, link: "" },
];

describe("searchIdeas", () => {
    it("returns nothing for an empty or blank query", () => {
        expect(searchIdeas(ideas, "")).toEqual([]);
        expect(searchIdeas(ideas, "   ")).toEqual([]);
    });

    it("finds ideas, links, checklist items and note bodies, ignoring the top level", () => {
        const found = searchIdeas(ideas, "tomato").map((r) => r.id).sort();
        expect(found).toEqual([11, 12, 13, 14]);
        expect(searchIdeas(ideas, "ideas")).toEqual([]);
    });

    it("requires every word and ignores case", () => {
        expect(searchIdeas(ideas, "TOMATO seeds").map((r) => r.id)).toEqual([11]);
        expect(searchIdeas(ideas, "tomato zebra")).toEqual([]);
    });

    it("ranks a title match above a body or item match", () => {
        const found = searchIdeas(ideas, "tomato");
        const titleHits = found.filter((r) => r.score <= 0).map((r) => r.id);
        expect(titleHits.slice().sort()).toEqual([11, 12]);
        expect(found.slice(0, 2).map((r) => r.id).sort()).toEqual([11, 12]);
    });

    it("puts a title that starts with the word first", () => {
        const found = searchIdeas(ideas, "tomato");
        expect(found[0].id).toBe(12);
        expect(found[0].score).toBe(-1);
    });

    it("reports the kind, the level it sits in and the path above it", () => {
        const [seeds] = searchIdeas(ideas, "seeds");
        expect(seeds).toMatchObject({ id: 11, kind: "idea", parentID: 10, path: ["Garden plan"] });
        expect(searchIdeas(ideas, "blight")[0].kind).toBe("link");
        expect(searchIdeas(ideas, "cages")[0].kind).toBe("checklist");
        expect(searchIdeas(ideas, "watering")[0].kind).toBe("note");
        expect(searchIdeas(ideas, "work")[0].path).toEqual([]);
    });

    it("shows a snippet only when the match is not in the label", () => {
        const cages = searchIdeas(ideas, "cages")[0];
        expect(cages.snippet).toContain("cages");
        const seeds = searchIdeas(ideas, "seeds")[0];
        expect(seeds.snippet).toBe("");
    });

    it("finds a misspelled or half-remembered name", () => {
        expect(searchIdeas(ideas, "gardin")[0].id).toBe(10);
        expect(searchIdeas(ideas, "tomatto seeds").map((r) => r.id)).toEqual([11]);
        expect(searchIdeas(ideas, "grdnpln")[0].id).toBe(10);
    });

    it("lists the ideas under a match, indented, and marks them as context", () => {
        const found = searchIdeas(ideas, "garden");
        expect(found.map((r) => [r.id, r.depth, r.isMatch])).toEqual([
            [10, 0, true], [11, 1, false], [12, 1, false], [13, 1, false], [14, 1, false],
        ]);
        expect(found[0].hasChildren).toBe(true);
    });

    it("matches a word through the names above the idea", () => {
        expect(searchIdeas(ideas, "garden prune").map((r) => r.id)).toEqual([13]);
    });

    it("respects the limit", () => {
        expect(searchIdeas(ideas, "tomato", 2)).toHaveLength(2);
    });

    it("does not loop on a parent cycle", () => {
        const looped: IdeaType[] = [
            { id: 2, content: "A", parentID: 3, link: "" },
            { id: 3, content: "B", parentID: 2, link: "" },
        ];
        expect(() => searchIdeas(looped, "a")).not.toThrow();
    });
});

describe("suggestedIdeas", () => {
    it("offers recently opened ideas first, skipping ones that are gone", () => {
        const { title, results } = suggestedIdeas(ideas, [12, 999, 20]);
        expect(title).toBe("Recent");
        expect(results.map((r) => r.id)).toEqual([12, 20]);
    });

    it("falls back to the newest ideas when nothing was opened", () => {
        const { title, results } = suggestedIdeas(ideas, [], 2);
        expect(title).toBe("Newest");
        expect(results.map((r) => r.id)).toEqual([20, 14]);
    });
});

describe("vault notes", () => {
    const vault = { id: 30, content: "vault1:0a1b2c3d:c2VjcmV0", noteTitle: "vault1:0a1b2c3d:dGl0bGU=", parentID: 1, link: "vault1:0a1b2c3d:bGluaw==", isNote: true, isVault: true } as IdeaType;
    const withVault = [...ideas, vault];

    it("never match, even on their stored text", () => {
        expect(searchIdeas(withVault, "vault1")).toEqual([]);
        expect(searchIdeas(withVault, "vault note")).toEqual([]);
        expect(searchIdeas(withVault, "c2VjcmV0")).toEqual([]);
    });

    it("never appear as suggestions", () => {
        expect(suggestedIdeas(withVault, [30]).results.map((r) => r.id)).not.toContain(30);
        expect(suggestedIdeas(withVault, []).results.map((r) => r.id)).not.toContain(30);
    });
});
