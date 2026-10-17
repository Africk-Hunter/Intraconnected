import { BG_TYPE_BY_KEY, KIND_OPTIONS, newLayer, type BgLayer, type BgType } from './theme';

// Background-layer helpers shared by the desktop BackgroundEditor and the touch UI's theme sheet.

export type LayerColorParam = 'color' | 'color2' | 'color3';

const COLOR_PARAMS = ['color', 'color2', 'color3'] as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The closed row's little picture: the layer's own colors. */
export function layerThumb(l: BgLayer): string {
    if (l.type === 'pattern') return `repeating-linear-gradient(45deg, ${l.color} 0 3px, #fff 3px 7px)`;
    if (l.type === 'gradient' && l.kind === 'radial') return `radial-gradient(circle, ${l.color}, ${l.color2}, ${l.color3})`;
    return `linear-gradient(135deg, ${l.color}, ${l.color2}, ${l.color3})`;
}

/** One line under the layer's name: its shape or whether it moves, and how strong it is. */
export function layerSummary(l: BgLayer): string {
    const meta = BG_TYPE_BY_KEY[l.type];
    const what = KIND_OPTIONS[l.type] ? cap(l.kind) : meta.params.includes('speed') ? (l.speed ? 'Moving' : 'Still') : '';
    return [what, `${l.opacity}% strength`].filter(Boolean).join(' · ');
}

/** The colors a layer has, with the names its style gives them. */
export function layerColorFields(l: BgLayer): { param: LayerColorParam; label: string }[] {
    const meta = BG_TYPE_BY_KEY[l.type];
    const colors = COLOR_PARAMS.filter((p) => meta.params.includes(p));
    return colors.map((p, i) => ({ param: p, label: meta.names?.[p] ?? (colors.length > 1 ? `Color ${i + 1}` : 'Color') }));
}

/** Colors that come with the theme's layers, offered inside each picker. */
export const layerPalette = (layers: BgLayer[]) => Array.from(new Set(layers.flatMap((l) => [l.color, l.color2, l.color3])));

/** Swaps the layer at i (0 = bottom) with its neighbour; +1 draws it over the layer above. */
export function moveLayer(layers: BgLayer[], i: number, dir: -1 | 1): BgLayer[] {
    const next = [...layers];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    return next;
}

/** A new layer of another style in the same place. */
export const retypeLayer = (layers: BgLayer[], id: string, type: BgType) =>
    layers.map((x) => (x.id === id ? { ...newLayer(type), id } : x));

export { cap as capitalize };
