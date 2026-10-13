// A card that is picked up on desktop shrinks to at most this many pixels on
// its longest side, so a big note is as easy to carry (and to drop on the
// trash) as a small idea. Idea.tsx sizes the trash/last-idea hit box to match.
export const DRAG_PREVIEW_MAX_PX = 240;

export function dragPreviewScale(width: number, height: number): number {
    const longest = Math.max(width, height);
    return longest > DRAG_PREVIEW_MAX_PX ? DRAG_PREVIEW_MAX_PX / longest : 1;
}
