import { describe, it, expect } from "vitest";
import type { IdeaType } from "../types";
import { computeLens } from "./mapLens";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

const ideas: IdeaType[] = [
    { id: 1, content: "Ideas", parentID: 0, link: "" },
    { id: NOW - 2 * 60 * 60 * 1000, content: "Today", parentID: 1, link: "", priority: 1 },
    { id: NOW - 3 * DAY, content: "Branch", parentID: 1, link: "" },
    { id: NOW - 40 * DAY, content: "Old leaf", parentID: NOW - 3 * DAY, link: "", priority: 3 },
    { id: NOW - 50 * DAY, content: "Old plain", parentID: 1, link: "" },
];

describe("computeLens", () => {
    it("returns nothing when the lens is off", () => {
        expect(computeLens(ideas, "off", NOW).size).toBe(0);
    });

    it("marks ideas with a priority and keeps the path to them", () => {
        const info = computeLens(ideas, "priority", NOW);
        expect(info.get(ideas[1].id as number)).toMatchObject({ badge: "P1", tone: "p1" });
        expect(info.get(ideas[3].id as number)).toMatchObject({ badge: "P3", tone: "p3" });
        expect(info.get(ideas[2].id as number)).toMatchObject({ badge: null, onPath: true });
        expect(info.get(ideas[4].id as number)).toMatchObject({ badge: null, onPath: false });
        expect(info.get(1)?.onPath).toBe(true);
    });

    it("buckets ideas by how recently they were created", () => {
        const info = computeLens(ideas, "recent", NOW);
        expect(info.get(ideas[1].id as number)?.tone).toBe("today");
        expect(info.get(ideas[2].id as number)?.tone).toBe("week");
        expect(info.get(ideas[3].id as number)?.tone).toBeNull();
        expect(info.get(ideas[4].id as number)?.tone).toBeNull();
    });

    it("narrows the matches to the chosen tones", () => {
        const info = computeLens(ideas, "priority", NOW, new Set(["p3"]));
        expect(info.get(ideas[1].id as number)).toMatchObject({ badge: null, onPath: false });
        expect(info.get(ideas[3].id as number)?.tone).toBe("p3");
        expect(computeLens(ideas, "priority", NOW, new Set()).get(ideas[1].id as number)?.tone).toBe("p1");
    });

    it("treats the root as undated", () => {
        expect(computeLens(ideas, "recent", NOW).get(1)?.tone).toBeNull();
    });

    it("does not loop on a parent cycle", () => {
        const cyclic: IdeaType[] = [
            { id: 1, content: "Ideas", parentID: 0, link: "" },
            { id: 2, content: "A", parentID: 3, link: "", priority: 2 },
            { id: 3, content: "B", parentID: 2, link: "" },
        ];
        expect(computeLens(cyclic, "priority", NOW).size).toBe(1);
    });
});
