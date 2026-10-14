// Sheets unmount the moment they close, so the exit is played by a throwaway
// copy of the last-rendered sheet (and scrim) that fades out and removes itself.
// Mirrors the desktop overlay's 150ms pop-out (AnimatedOverlay).
export const SHEET_EXIT_MS = 150;

export function playSheetExit(sheet: HTMLElement) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const host = document.querySelector('.mmobile') ?? document.body;

    const wrap = document.createElement('div');
    wrap.className = 'mmobile-exit-ghost';
    wrap.setAttribute('aria-hidden', 'true');

    const scrim = document.createElement('div');
    scrim.className = 'mmobile-scrim mmobile-scrim--out';

    const copy = sheet.cloneNode(true) as HTMLElement;
    copy.classList.add('mmobile-sheet--out');
    copy.removeAttribute('role');
    copy.removeAttribute('aria-modal');
    copy.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));

    wrap.append(scrim, copy);
    host.append(wrap);
    window.setTimeout(() => wrap.remove(), SHEET_EXIT_MS + 30);
}
