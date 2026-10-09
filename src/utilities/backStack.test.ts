import { describe, expect, it } from 'vitest';
import { createBackStack, TRAP_KEY, type BackStack } from './backStack';

// A history whose back() is asynchronous like a browser's: the traversal
// only happens (and popstate only fires) when the test calls deliverBack().
function fakeHistory() {
    const entries: unknown[] = [{ idx: 0 }];
    let index = 0;
    let pendingBacks = 0;
    let stack: BackStack | null = null;
    const history = {
        get state() { return entries[index]; },
        pushState(data: unknown) {
            entries.splice(index + 1);
            entries.push(data);
            index++;
        },
        back() { pendingBacks++; },
    };
    return {
        history,
        attach(s: BackStack) { stack = s; },
        get length() { return index + 1; },
        get pendingBacks() { return pendingBacks; },
        // The browser carrying out a back() we (or the user) asked for.
        deliverBack() {
            pendingBacks--;
            index = Math.max(0, index - 1);
            stack!.handlePop();
        },
        // The user pressing Back / swiping back.
        userBack() {
            index = Math.max(0, index - 1);
            stack!.handlePop();
        },
    };
}

function setup() {
    const h = fakeHistory();
    const stack = createBackStack(h.history);
    h.attach(stack);
    return { h, stack };
}

describe('backStack', () => {
    it('pushes one trap entry while any handler is active, keeping router state', () => {
        const { h, stack } = setup();
        stack.register({ priority: 0, onBack: () => {} });
        stack.register({ priority: 1, onBack: () => {} });
        expect(h.length).toBe(2);
        expect(h.history.state).toEqual({ idx: 0, [TRAP_KEY]: true });
    });

    it('runs the topmost handler on Back and re-pushes the trap while still needed', () => {
        const { h, stack } = setup();
        const calls: string[] = [];
        stack.register({ priority: 0, onBack: () => calls.push('level') });
        const offSheet = stack.register({ priority: 1, onBack: () => calls.push('sheet') });

        h.userBack();
        expect(calls).toEqual(['sheet']);
        expect(h.length).toBe(2); // re-pushed: the level handler still wants Back

        offSheet(); // the sheet closed in response
        expect(h.length).toBe(2);
        h.userBack();
        expect(calls).toEqual(['sheet', 'level']);
    });

    it('among equal priorities, the most recently registered wins', () => {
        const { h, stack } = setup();
        const calls: string[] = [];
        stack.register({ priority: 1, onBack: () => calls.push('first') });
        stack.register({ priority: 1, onBack: () => calls.push('second') });
        h.userBack();
        expect(calls).toEqual(['second']);
    });

    it('pops its own trap when the last handler goes away through the UI', () => {
        const { h, stack } = setup();
        const off = stack.register({ priority: 0, onBack: () => {} });
        off();
        expect(h.pendingBacks).toBe(1);
        h.deliverBack();
        expect(h.length).toBe(1);
    });

    it('does not run a handler for its own back()', () => {
        const { h, stack } = setup();
        const calls: string[] = [];
        const off = stack.register({ priority: 0, onBack: () => calls.push('a') });
        off();
        stack.register({ priority: 0, onBack: () => calls.push('b') }); // before the traversal lands
        expect(h.length).toBe(2); // no push yet: it would race the pending back()
        h.deliverBack();
        expect(calls).toEqual([]);
        expect(h.length).toBe(2); // pushed once the traversal finished
        expect(h.history.state).toMatchObject({ [TRAP_KEY]: true });
    });

    it('a handler that unregisters after Back leaves history at the real entry', () => {
        const { h, stack } = setup();
        const off = stack.register({ priority: 0, onBack: () => {} });
        h.userBack();      // trap popped, handler ran, trap re-pushed (still registered)
        off();             // its state change lands: nothing wants Back any more
        h.deliverBack();
        expect(h.length).toBe(1);
        expect(h.pendingBacks).toBe(0);
    });

    it('does nothing on Back when no handler is active', () => {
        const { h, stack } = setup();
        stack.handlePop();
        expect(h.length).toBe(1);
        expect(h.pendingBacks).toBe(0);
    });
});
