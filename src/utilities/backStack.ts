import { useEffect, useRef } from 'react';

// Makes the phone's Back button / back gesture work inside the mobile UI
// (close the open sheet, else go up one level) instead of leaving the app.
//
// Whatever wants Back registers a handler while it's "active" (a sheet is
// open, the view isn't the top level). While any handler is active, exactly
// one extra history entry (the "trap") sits on top of the real one. Back pops
// the trap, the topmost handler runs, and the trap is pushed again if
// something still wants Back. When the last handler goes away through the UI
// instead (a sheet closed with its button), the trap is popped by us, so
// history never fills up with dead entries and Back at the top level leaves
// the app as usual.

export interface HistoryLike {
    readonly state: unknown;
    pushState(data: unknown, unused: string): void;
    back(): void;
}

export interface BackHandler {
    // Higher runs first; among equals, the most recently registered.
    priority: number;
    onBack: () => void;
}

export interface BackStack {
    register(handler: BackHandler): () => void;
    handlePop(): void;
}

export const TRAP_KEY = 'icBackTrap';

export function createBackStack(history: HistoryLike): BackStack {
    const handlers: BackHandler[] = [];
    let trapPushed = false;
    // We called history.back() ourselves and its popstate hasn't arrived yet.
    // Pushing in the meantime would race that traversal, so wait for it.
    let ownBackPending = false;

    function sync() {
        if (ownBackPending) return;
        if (handlers.length > 0 && !trapPushed) {
            // Keep the router's state (React Router stores its entry index
            // there) so the trap looks like the entry it sits on.
            const prev = history.state && typeof history.state === 'object' ? history.state : {};
            history.pushState({ ...prev, [TRAP_KEY]: true }, '');
            trapPushed = true;
        } else if (handlers.length === 0 && trapPushed) {
            trapPushed = false;
            ownBackPending = true;
            history.back();
        }
    }

    function top(): BackHandler | undefined {
        let best: BackHandler | undefined;
        for (const h of handlers) {
            if (!best || h.priority >= best.priority) best = h;
        }
        return best;
    }

    return {
        register(handler) {
            handlers.push(handler);
            sync();
            return () => {
                const i = handlers.indexOf(handler);
                if (i !== -1) handlers.splice(i, 1);
                sync();
            };
        },
        handlePop() {
            if (ownBackPending) {
                ownBackPending = false;
                sync();
                return;
            }
            // Not our entry (nothing registered when it was popped).
            if (!trapPushed) return;
            trapPushed = false;
            top()?.onBack();
            // The handler's own state change usually unregisters it a moment
            // later; if it hasn't yet, the trap is re-pushed now and popped
            // again by that unregister. Correct either way.
            sync();
        },
    };
}

let windowStack: BackStack | null = null;

function getWindowStack(): BackStack {
    if (!windowStack) {
        const stack = createBackStack(window.history);
        window.addEventListener('popstate', () => stack.handlePop());
        windowStack = stack;
    }
    return windowStack;
}

// While `active`, Back calls `onBack` (if it's the topmost active handler)
// instead of leaving the page. Mount only in the mobile UI.
export function useBackHandler(active: boolean, onBack: () => void, priority = 0): void {
    const onBackRef = useRef(onBack);
    useEffect(() => {
        onBackRef.current = onBack;
    });

    useEffect(() => {
        if (!active) return;
        return getWindowStack().register({ priority, onBack: () => onBackRef.current() });
    }, [active, priority]);
}
