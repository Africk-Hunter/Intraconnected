import { describe, it, expect } from "vitest";
import type { IdeaType } from "../types";
import {
    applyOpLocally,
    classifyError,
    coalesce,
    findOrphans,
    othersChanged,
    othersOnly,
    rebase,
    withoutDependents,
    type QueuedOp,
    type SyncOp,
} from "./ops";

const idea = (id: number, parentID = 1, extra: Partial<IdeaType> = {}): IdeaType =>
    ({ id, content: `idea ${id}`, parentID, link: "", ...extra }) as IdeaType;

const queued = (seq: number, op: SyncOp, notBefore = 0): QueuedOp => ({ seq, op, notBefore, queuedAt: seq });

describe("applyOpLocally", () => {
    it("adds a created idea, and replaces rather than duplicates on replay", () => {
        const op: SyncOp = { kind: "create", idea: idea(2) };
        const once = applyOpLocally([idea(1)], op);
        expect(once.map((i) => i.id)).toEqual([1, 2]);
        expect(applyOpLocally(once, op)).toEqual(once);
    });

    it("patches only the named fields, and a null priority removes it", () => {
        const list = [idea(1, 1, { priority: 2 })];
        const [updated] = applyOpLocally(list, { kind: "update", id: 1, patch: { content: "renamed", priority: null } });
        expect(updated.content).toBe("renamed");
        expect(updated).not.toHaveProperty("priority");
        expect(updated.parentID).toBe(1);
    });

    it("never creates a partial idea from an update to one that isn't there", () => {
        expect(applyOpLocally([idea(1)], { kind: "update", id: 9, patch: { content: "x" } })).toEqual([idea(1)]);
    });

    it("removes every deleted id", () => {
        expect(applyOpLocally([idea(1), idea(2), idea(3)], { kind: "delete", ids: [1, 3] }).map((i) => i.id)).toEqual([2]);
    });
});

describe("rebase", () => {
    it("keeps this device's unsent changes on top of fresh server data", () => {
        const server = [idea(1), idea(2)];
        const ops: SyncOp[] = [
            { kind: "create", idea: idea(3, 1) },
            { kind: "update", id: 1, patch: { content: "local rename" } },
            { kind: "delete", ids: [2] },
        ];
        const result = rebase(server, ops);
        expect(result.map((i) => i.id)).toEqual([1, 3]);
        expect(result.find((i) => i.id === 1)?.content).toBe("local rename");
    });

    it("is safe to apply ops the server already reflects", () => {
        const ops: SyncOp[] = [{ kind: "create", idea: idea(2) }, { kind: "update", id: 2, patch: { content: "b" } }];
        const server = rebase([idea(1)], ops);
        expect(rebase(server, ops)).toEqual(server);
    });
});

describe("othersChanged", () => {
    it("pulls when this device has never pulled for the account", () => {
        expect(othersChanged({ me: 3 }, null, "me")).toBe(true);
    });

    it("ignores this device's own writes", () => {
        expect(othersChanged({ me: 10, phone: 4 }, { phone: 4 }, "me")).toBe(false);
    });

    it("detects another device's write, including a device it has never seen", () => {
        expect(othersChanged({ me: 1, phone: 5 }, { phone: 4 }, "me")).toBe(true);
        expect(othersChanged({ me: 1, tablet: 1 }, {}, "me")).toBe(true);
    });

    it("stores only other devices' counters as the seen state", () => {
        expect(othersOnly({ me: 2, phone: 7 }, "me")).toEqual({ phone: 7 });
    });
});

describe("coalesce", () => {
    const update = (id: number, patch: object): SyncOp => ({ kind: "update", id, patch });

    it("folds a debounced update into the queued update for the same idea", () => {
        const queue = [queued(1, update(5, { priority: 1 }), 100)];
        const result = coalesce(queue, queued(2, update(5, { priority: 3, content: "x" }), 200), null);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ seq: 1, notBefore: 200, queuedAt: 1, op: { patch: { priority: 3, content: "x" } } });
    });

    it("never merges into the update currently being sent", () => {
        const queue = [queued(1, update(5, { priority: 1 }))];
        expect(coalesce(queue, queued(2, update(5, { priority: 2 })), 1)).toHaveLength(2);
    });

    it("never merges past a later create or delete of the same idea", () => {
        const queue = [queued(1, update(5, { priority: 1 })), queued(2, { kind: "delete", ids: [5] })];
        expect(coalesce(queue, queued(3, update(5, { priority: 2 })), null)).toHaveLength(3);
    });
});

describe("withoutDependents", () => {
    it("drops later changes to the discarded idea and anything created or moved under it", () => {
        const queue = [
            queued(1, { kind: "update", id: 7, patch: { content: "rename" } }),
            queued(2, { kind: "create", idea: idea(8, 7) }),
            queued(3, { kind: "create", idea: idea(9, 8) }),
            queued(4, { kind: "update", id: 3, patch: { parentID: 7 } }),
            queued(5, { kind: "update", id: 4, patch: { content: "unrelated" } }),
        ];
        expect(withoutDependents(queue, [7]).map((entry) => entry.seq)).toEqual([5]);
    });
});

describe("classifyError", () => {
    it("pauses on errors retrying can't fix, and drops updates to deleted ideas", () => {
        expect(classifyError("permission-denied")).toBe("permanent");
        expect(classifyError("invalid-argument")).toBe("permanent");
        expect(classifyError("not-found")).toBe("gone");
    });

    it("retries everything else, including errors with no code", () => {
        expect(classifyError("unavailable")).toBe("transient");
        expect(classifyError("resource-exhausted")).toBe("transient");
        expect(classifyError(undefined)).toBe("transient");
    });
});

describe("findOrphans", () => {
    it("finds ideas whose parent is gone, treating 1 as the root", () => {
        const list = [idea(2, 1), idea(3, 2), idea(4, 99)];
        expect(findOrphans(list).map((i) => i.id)).toEqual([4]);
    });
});
