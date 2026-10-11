import { describe, it, expect, vi, beforeEach } from "vitest";
import { canUndo, clearUndo, dismissUndoToast, getUndoToast, pushUndo, subscribeUndo, undoLast } from "./undoStack";

describe("undoStack", () => {
    beforeEach(() => clearUndo());

    it("undoes the most recent change first", () => {
        const order: string[] = [];
        pushUndo({ label: "a", undo: () => order.push("a") });
        pushUndo({ label: "b", undo: () => order.push("b") });
        expect(undoLast()).toBe(true);
        expect(undoLast()).toBe(true);
        expect(order).toEqual(["b", "a"]);
        expect(undoLast()).toBe(false);
        expect(canUndo()).toBe(false);
    });

    it("shows a toast with Undo for a push and an Undone note after", () => {
        pushUndo({ label: 'Deleted "Plan"', undo: () => {} });
        expect(getUndoToast()).toMatchObject({ message: 'Deleted "Plan"', canUndo: true });
        undoLast();
        expect(getUndoToast()).toMatchObject({ message: 'Undone: Deleted "Plan"', canUndo: false });
    });

    it("gives every toast a new key so a repeated message restarts its timer", () => {
        pushUndo({ label: "x", undo: () => {} });
        const first = getUndoToast()!.key;
        pushUndo({ label: "x", undo: () => {} });
        expect(getUndoToast()!.key).not.toBe(first);
    });

    it("keeps only the latest 20 entries", () => {
        for (let i = 0; i < 25; i++) pushUndo({ label: String(i), undo: () => {} });
        let count = 0;
        while (undoLast()) count++;
        expect(count).toBe(20);
    });

    it("notifies subscribers and stops after unsubscribe", () => {
        const listener = vi.fn();
        const off = subscribeUndo(listener);
        pushUndo({ label: "x", undo: () => {} });
        dismissUndoToast();
        expect(listener).toHaveBeenCalledTimes(2);
        off();
        pushUndo({ label: "y", undo: () => {} });
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
