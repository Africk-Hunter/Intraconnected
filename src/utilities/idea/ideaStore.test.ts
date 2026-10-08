import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChecklistIdea, IdeaType, StandardIdea } from "../types";

// The outbox talks to Firestore; here it's just a recorder.
const { enqueue, enqueueMany } = vi.hoisted(() => ({ enqueue: vi.fn(), enqueueMany: vi.fn() }));
vi.mock("../sync/outbox", () => ({ enqueue, enqueueMany }));

import {
    createIdea,
    recursivelyDeleteChildren,
    updateChecklistItems,
    updateIdeaLink,
    updateIdeaName,
    updateIdeaNoteTitle,
    updateIdeaParentId,
    updateIdeaPriority,
} from "./ideaStore";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
});

const idea = (id: number, parentID: number, extra: Partial<StandardIdea> = {}): StandardIdea => ({ id, parentID, content: `idea ${id}`, link: "", ...extra });
const saved = (): IdeaType[] => JSON.parse(store.get("ideas") ?? "[]");
const seed = (...ideas: IdeaType[]) => store.set("ideas", JSON.stringify(ideas));

describe("ideaStore", () => {
    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
    });

    it("createIdea saves locally and queues a create", () => {
        seed(idea(2, 1));
        const created = idea(3, 2);
        createIdea(created);
        expect(saved().map((i) => i.id)).toEqual([2, 3]);
        expect(enqueue).toHaveBeenCalledWith({ kind: "create", idea: created }, undefined);
    });

    it("createIdea works on a device with no saved ideas yet", () => {
        createIdea(idea(5, 1));
        expect(saved().map((i) => i.id)).toEqual([5]);
    });

    it("renaming changes the local copy and queues exactly one update", async () => {
        seed(idea(2, 1), idea(3, 1));
        await updateIdeaName(2, "renamed");
        expect(saved().find((i) => i.id === 2)?.content).toBe("renamed");
        expect(saved().find((i) => i.id === 3)?.content).toBe("idea 3");
        expect(enqueue).toHaveBeenCalledTimes(1);
        expect(enqueue).toHaveBeenCalledWith({ kind: "update", id: 2, patch: { content: "renamed" } }, undefined);
    });

    it("link, note title and parent updates each queue their own patch", async () => {
        seed(idea(2, 1), idea(3, 1));
        await updateIdeaLink(2, "https://x.test");
        await updateIdeaNoteTitle(2, "Title");
        updateIdeaParentId(3, 2);
        expect(saved().find((i) => i.id === 2)).toMatchObject({ link: "https://x.test", noteTitle: "Title" });
        expect(saved().find((i) => i.id === 3)?.parentID).toBe(2);
        expect(enqueue.mock.calls.map((c) => c[0].patch)).toEqual([{ link: "https://x.test" }, { noteTitle: "Title" }, { parentID: 2 }]);
    });

    it("priority and checklist edits are debounced, and clearing a priority removes the field", () => {
        const list: ChecklistIdea = { id: 4, type: "checklist", content: "list", parentID: 1, items: [], priority: 2 };
        seed(idea(2, 1, { priority: 1 }), list);
        updateIdeaPriority(2, undefined);
        updateChecklistItems(4, [{ id: "a", text: "x", checked: true }]);
        expect("priority" in saved().find((i) => i.id === 2)!).toBe(false);
        expect((saved().find((i) => i.id === 4) as ChecklistIdea).items).toHaveLength(1);
        expect(enqueue.mock.calls[0]).toEqual([{ kind: "update", id: 2, patch: { priority: null } }, { debounceMs: 1500 }]);
        expect(enqueue.mock.calls[1][1]).toEqual({ debounceMs: 1500 });
    });

    it("an update to an idea that is not there changes nothing locally (same rule as the server)", async () => {
        seed(idea(2, 1));
        await updateIdeaName(99, "ghost");
        expect(saved()).toEqual([idea(2, 1)]);
    });

    it("deleting removes the idea and everything under it, children before parents, leaving the rest", () => {
        seed(idea(2, 1), idea(3, 2), idea(4, 3), idea(5, 2), idea(6, 1));
        recursivelyDeleteChildren(2);
        expect(saved().map((i) => i.id)).toEqual([6]);
        expect(enqueueMany).toHaveBeenCalledTimes(1);
        const ops = enqueueMany.mock.calls[0][0];
        expect(ops).toHaveLength(1);
        const ids: number[] = ops[0].ids;
        expect([...ids].sort()).toEqual([2, 3, 4, 5]);
        expect(ids.indexOf(4)).toBeLessThan(ids.indexOf(3));
        expect(ids.indexOf(3)).toBeLessThan(ids.indexOf(2));
        expect(ids.indexOf(5)).toBeLessThan(ids.indexOf(2));
    });

    it("splits a very large delete into several queued batches", () => {
        const many = Array.from({ length: 1000 }, (_, n) => idea(100 + n, 2));
        seed(idea(2, 1), ...many);
        recursivelyDeleteChildren(2);
        const ops = enqueueMany.mock.calls[0][0] as { ids: number[] }[];
        expect(ops.length).toBeGreaterThan(1);
        expect(Math.max(...ops.map((o) => o.ids.length))).toBeLessThanOrEqual(450);
        expect(ops.flatMap((o) => o.ids)).toHaveLength(1001);
        expect(saved()).toEqual([]);
    });

    it("survives a parent cycle in bad data instead of looping forever", () => {
        seed(idea(2, 3), idea(3, 2));
        expect(() => recursivelyDeleteChildren(2)).not.toThrow();
    });
});
