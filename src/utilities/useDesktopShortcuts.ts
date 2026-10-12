import { useEffect, useRef } from 'react';
import { useIdeaActions } from './idea/useIdeaActions';

interface Options {
    // Off on the touch UI.
    enabled: boolean;
    // The mind map has its own keys; only search still works over it.
    mapOpen: boolean;
    onToggleMap: () => void;
    onNewIdea: () => void;
    onGoUp: () => void;
    onShowShortcuts: () => void;
    onSearch: () => void;
}

export function isTypingTarget(target: EventTarget | null) {
    return target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

type Direction = 'left' | 'right' | 'up' | 'down';

function visibleCards(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-idea-id]'))
        .filter((el) => el.offsetParent !== null && !el.closest('.ideaNodes--fade'));
}

// The card in the given direction from `from`: the nearest one whose centre is
// on that side, preferring cards lined up with it over ones far off to the side.
function neighbour(from: HTMLElement, cards: HTMLElement[], dir: Direction): HTMLElement | null {
    const a = from.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const card of cards) {
        if (card === from) continue;
        const b = card.getBoundingClientRect();
        const dx = b.left + b.width / 2 - ax;
        const dy = b.top + b.height / 2 - ay;
        const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
        const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
        if (along <= 1) continue;
        const score = along + across * 2;
        if (score < bestScore) { best = card; bestScore = score; }
    }
    return best;
}

function focusCard(id: number) {
    // The list re-renders after a change; wait a beat for the card to exist.
    setTimeout(() => {
        // A confirm modal may have opened (D on a branch); it keeps the focus.
        if (document.querySelector('.overlay')) return;
        document.querySelector<HTMLElement>(`[data-idea-id="${id}"]`)?.focus({ preventScroll: false });
    }, 60);
}

// Keyboard control of the idea grid: arrows move between cards, Enter opens
// (handled on the card), F2 or R renames, D deletes, M moves, C creates, Backspace
// goes up a level, / or ? lists these. Never fires while typing, with a modal or
// menu open, or with Ctrl/Cmd/Alt held, so browser and text shortcuts keep working.
export function useDesktopShortcuts({ enabled, mapOpen, onToggleMap, onNewIdea, onGoUp, onShowShortcuts, onSearch }: Options) {
    const actions = useIdeaActions();
    const latest = useRef({ actions, mapOpen, onToggleMap, onNewIdea, onGoUp, onShowShortcuts, onSearch });
    latest.current = { actions, mapOpen, onToggleMap, onNewIdea, onGoUp, onShowShortcuts, onSearch };

    useEffect(() => {
        if (!enabled) return;

        // Whichever input moved last decides the target: the card under the
        // pointer after mouse movement, the focused card after an arrow key.
        let hoveredId: number | null = null;
        let mode: 'mouse' | 'key' = 'key';

        function onMouseMove(e: MouseEvent) {
            // The browser also fires mousemove when a card moves or scrolls under a
            // resting pointer (e.g. the focus lift); that must not steal the target.
            if (e.movementX === 0 && e.movementY === 0) return;
            const card = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-idea-id]') : null;
            hoveredId = card ? Number(card.dataset.ideaId) : null;
            mode = 'mouse';
        }

        function targetCard(): HTMLElement | null {
            if (mode === 'mouse') {
                // The browser's own hover state follows the pointer even when a card
                // moves under it (after a delete) without any mouse movement.
                const live = document.querySelectorAll<HTMLElement>('[data-idea-id]:hover');
                if (live.length > 0) return live[live.length - 1];
                if (hoveredId !== null) {
                    const hovered = document.querySelector<HTMLElement>(`[data-idea-id="${hoveredId}"]`);
                    if (hovered) return hovered;
                    hoveredId = null;
                }
            }
            const active = document.activeElement as HTMLElement | null;
            return active?.closest<HTMLElement>('[data-idea-id]') ?? null;
        }

        function onKeyDown(e: KeyboardEvent) {
            if (e.defaultPrevented || e.isComposing) return;
            const { actions: act, mapOpen: map, onToggleMap: toggleMap, onNewIdea: newIdea, onGoUp: goUp, onShowShortcuts: showKeys, onSearch: search } = latest.current;

            // Ctrl/Cmd+F opens search from anywhere that isn't already a modal (replaces the browser's find).
            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
                if (document.querySelector('.overlay, .card-menu')) return;
                e.preventDefault();
                search();
                return;
            }

            // G opens and closes the mind map. Like N, it leaves other focused controls alone.
            if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                if (isTypingTarget(e.target)) return;
                if (document.querySelector('.overlay, .card-menu, .howToUsePopup.show')) return;
                const focused = document.activeElement as HTMLElement | null;
                if (focused && focused !== document.body && !focused.closest('[data-idea-id]') && !focused.closest('.mm-wrap')) return;
                e.preventDefault();
                toggleMap();
                return;
            }

            // / and ? (Shift+/) open the shortcut list, even over the mind map.
            if ((e.key === '/' || e.key === '?') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (isTypingTarget(e.target)) return;
                if (document.querySelector('.overlay, .card-menu, .howToUsePopup.show')) return;
                const focused = document.activeElement as HTMLElement | null;
                if (focused && focused !== document.body && !focused.closest('[data-idea-id]') && !focused.closest('.mm-wrap')) return;
                e.preventDefault();
                showKeys();
                return;
            }

            if (map) return;

            // Ctrl/Cmd+C copies the targeted card, unless text is selected.
            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'c') {
                if (isTypingTarget(e.target)) return;
                if (document.querySelector('.overlay, .card-menu')) return;
                if (!window.getSelection()?.isCollapsed) return;
                const card = targetCard();
                if (!card) return;
                e.preventDefault();
                act.copyIdea(Number(card.dataset.ideaId));
                return;
            }

            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (isTypingTarget(e.target)) return;
            // The help panel uses the arrow keys and Esc for its own pages.
            if (document.querySelector('.overlay, .card-menu, .howToUsePopup.show')) return;

            const active = document.activeElement as HTMLElement | null;
            const cardEl = targetCard();
            // Other focused controls (buttons, links) keep their own keys.
            const onBody = !active || active === document.body;
            const focusedId = cardEl ? Number(cardEl.dataset.ideaId) : null;

            switch (e.key) {
                case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
                    if (!cardEl && !onBody) return;
                    const cards = visibleCards();
                    if (cards.length === 0) return;
                    e.preventDefault();
                    mode = 'key';
                    if (!cardEl) { cards[0].focus(); return; }
                    const dir = e.key.replace('Arrow', '').toLowerCase() as Direction;
                    if (dir === 'left' || dir === 'right') {
                        // Reading order (the grid fills in DOM order), so the end of
                        // a row continues on the next one instead of guessing by position.
                        const i = cards.indexOf(cardEl);
                        cards[i + (dir === 'right' ? 1 : -1)]?.focus();
                    } else {
                        neighbour(cardEl, cards, dir)?.focus();
                    }
                    return;
                }
                case 'r': case 'R':
                    if (focusedId === null || e.shiftKey) return;
                    e.preventDefault();
                    act.renameIdea(focusedId);
                    return;
                case 'F2':
                    e.preventDefault();
                    act.renameIdea(focusedId ?? undefined);
                    return;
                case 'd': case 'D': {
                    if (focusedId === null || e.shiftKey) return;
                    e.preventDefault();
                    const cards = visibleCards();
                    const at = cards.indexOf(cardEl!);
                    const next = cards[at + 1] ?? cards[at - 1];
                    const rect = cardEl!.getBoundingClientRect();
                    act.requestDelete(focusedId, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                    // Hand focus to the neighbour only if the deleted card had it; deleting a
                    // hovered card must not select (orange) an unrelated one.
                    if (next && cardEl!.contains(active)) focusCard(Number(next.dataset.ideaId));
                    // Deleting a hovered card while another one still holds focus (from an earlier
                    // click): using the keyboard makes that one show its orange ring, so drop it.
                    else if (active?.closest('[data-idea-id]') && !cardEl!.contains(active)) active.blur();
                    return;
                }
                case 'm': case 'M':
                    if (focusedId === null || e.shiftKey) return;
                    e.preventDefault();
                    act.openMovePicker(focusedId);
                    return;
                case 'c': case 'C':
                    if (!cardEl && !onBody) return;
                    if (e.shiftKey) return;
                    e.preventDefault();
                    newIdea();
                    return;
                case 'Backspace':
                    if (!cardEl && !onBody) return;
                    e.preventDefault();
                    goUp();
                    return;
            }
        }

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('mousemove', onMouseMove, { passive: true });
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('mousemove', onMouseMove);
        };
    }, [enabled]);
}
