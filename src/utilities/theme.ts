// Customization themes (premium). A theme sets some of the app's color roles
// ("tokens"), written onto :root as --t-* custom properties; the stylesheets read
// them as t(<token>, $stock) = var(--t-<token>, stock), so a token the theme
// leaves alone is the stock look.
// Tokens come in nets: one head token (Simple tab) recolors every token in its
// net at once, and any member can be overridden on its own (Advanced tab).
// On top of the page color sits a stack of background layers (gradients,
// patterns, animated effects) drawn by ThemeBackground. No uploaded images:
// a layer is a small bag of parameters, so a theme is plain shareable JSON.
// Stored per device in localStorage for now (cloud sync / marketplace later).

export type BgType = 'gradient' | 'pattern' | 'plasma' | 'ripples' | 'fractal' | 'spiral' | 'mandala'
    | 'contours' | 'truchet' | 'harmonograph' | 'ridges' | 'terrain' | 'shapes' | 'aquarium';
export type BgParam = 'kind' | 'color' | 'color2' | 'color3' | 'angle' | 'size' | 'density' | 'speed';

export interface BgLayer {
    id: string;
    type: BgType;
    /** gradient: linear | radial | conic. pattern: grid | dots | stripes | checker | hatch. */
    kind: string;
    color: string;
    color2: string;
    color3: string;
    angle: number;   // 0-360
    size: number;    // 1-10 (scale)
    density: number; // 1-10 (detail)
    speed: number;   // 0-10 (0 = still)
    opacity: number; // 0-100
}

export const MAX_BG_LAYERS = 3;

export type BgGroup = 'Basic' | 'Math' | 'Scenes';

export interface BgTypeDef {
    type: BgType;
    label: string;
    group: BgGroup;
    /** One line on what it is (the math behind it, for the math styles). */
    hint: string;
    params: BgParam[];
    /** What a control means for this style, where the generic name ("Color 2", "Detail") says too little. */
    names?: Partial<Record<BgParam, string>>;
}

const ALL: BgParam[] = ['color', 'color2', 'color3', 'size', 'density', 'speed'];

// The math styles are drawn per frame on a canvas (see ThemeBackground.tsx).
export const BG_TYPES: BgTypeDef[] = [
    { type: 'gradient', label: 'Gradient', group: 'Basic', hint: 'A smooth blend of three colors', params: ['kind', 'color', 'color2', 'color3', 'angle'] },
    { type: 'pattern', label: 'Pattern', group: 'Basic', hint: 'A repeating grid, dots, stripes or checks', params: ['kind', 'color', 'size', 'angle'] },
    { type: 'plasma', label: 'Plasma', group: 'Math', hint: 'Four travelling sine waves added together', params: ALL },
    { type: 'ripples', label: 'Ripples', group: 'Math', hint: 'Three wave sources interfering', params: ['color', 'color2', 'color3', 'size', 'speed'] },
    { type: 'fractal', label: 'Julia set', group: 'Math', hint: 'A fractal that slowly changes shape', params: ['color', 'color2', 'color3', 'size', 'speed'] },
    { type: 'spiral', label: 'Sunflower', group: 'Math', hint: 'Dots placed 137.5 degrees apart (the golden angle)', params: ALL, names: { size: 'Dot size', density: 'Dots' } },
    { type: 'mandala', label: 'Spirograph', group: 'Math', hint: 'Rotated hypotrochoid curves', params: ALL, names: { size: 'Line width', density: 'Rings' } },
    { type: 'contours', label: 'Contours', group: 'Math', hint: 'Height lines of a slowly drifting landscape', params: ALL, names: { color: 'Lines', color2: 'Low ground', color3: 'High ground', density: 'Lines' } },
    { type: 'truchet', label: 'Truchet tiles', group: 'Math', hint: 'Quarter-circle tiles that turn now and then', params: ALL, names: { size: 'Tile size', density: 'Line width' } },
    { type: 'harmonograph', label: 'Harmonograph', group: 'Math', hint: 'The trace of two swinging, slowing pendulums', params: ALL, names: { size: 'Line width', density: 'Length' } },
    { type: 'ridges', label: 'Hills', group: 'Scenes', hint: 'Layered ridges, each a sum of three sines', params: ['color', 'color2', 'color3', 'density', 'speed'], names: { color: 'Near hills', color2: 'Far hills', color3: 'Sky', density: 'Ridges' } },
    { type: 'terrain', label: 'Wave grid (3D)', group: 'Scenes', hint: 'A rolling wireframe landscape you fly over', params: ALL, names: { color: 'Near', color2: 'Middle', color3: 'Far', size: 'Wave height', density: 'Grid' } },
    { type: 'shapes', label: 'Floating shapes (3D)', group: 'Scenes', hint: 'Lit solids that spin and bob in space', params: ALL, names: { color: 'Shape color', color2: 'Shape color 2', color3: 'Shape color 3', size: 'Shape size', density: 'Shapes' } },
    { type: 'aquarium', label: 'Aquarium', group: 'Scenes', hint: 'Fish, bubbles and swaying weed', params: ALL, names: { color: 'Fish', color2: 'Fish 2', color3: 'Water', size: 'Fish size', density: 'Fish' } },
];

export const BG_TYPE_BY_KEY = Object.fromEntries(BG_TYPES.map((t) => [t.type, t])) as Record<BgType, BgTypeDef>;

export const KIND_OPTIONS: Partial<Record<BgType, string[]>> = {
    gradient: ['linear', 'radial', 'conic'],
    pattern: ['grid', 'dots', 'stripes', 'checker', 'hatch'],
};

let layerSeq = 0;
export function newLayer(type: BgType): BgLayer {
    const base: BgLayer = {
        id: `l${Date.now().toString(36)}${layerSeq++}`,
        type,
        kind: KIND_OPTIONS[type]?.[0] ?? '',
        color: '#ff5fa2',
        color2: '#6a8cff',
        color3: '#7cf0c9',
        angle: 180,
        size: 5,
        density: 5,
        speed: 3,
        opacity: 100,
    };
    switch (type) {
        case 'gradient': return { ...base, color: '#4fb3ee', color2: '#9ed8f7', color3: '#ddf3ff' };
        case 'pattern': return { ...base, color: '#41bc28', opacity: 25, angle: 45 };
        case 'ripples': return { ...base, color: '#ffffff', color2: '#8fd3ff', color3: '#2a8fe0', size: 4 };
        case 'ridges': return { ...base, color: '#2b6f8f', color2: '#8fd0e8', color3: '#f6e7c1', speed: 2 };
        case 'mandala': return { ...base, color: '#ffffff', color2: '#ffd36b', color3: '#ff6b9a', opacity: 90 };
        case 'contours': return { ...base, color: '#7a5a3a', color2: '#efe4cc', color3: '#cfe0bf', speed: 1 };
        case 'truchet': return { ...base, color: '#ff6b9a', color2: '#4f8fe0', color3: '#3dba7a', size: 4, density: 4, speed: 2, opacity: 70 };
        case 'harmonograph': return { ...base, color: '#ffffff', color2: '#ffd36b', color3: '#ff7ac8', size: 3, speed: 2 };
        case 'terrain': return { ...base, color: '#ff4fd8', color2: '#8f6bff', color3: '#4fd8ff', speed: 2 };
        case 'shapes': return { ...base, color: '#5fb8ff', color2: '#b07bff', color3: '#7cf0c9', density: 4, speed: 2 };
        case 'aquarium': return { ...base, color: '#ff8a3d', color2: '#ffd23f', color3: '#2a8fc0', density: 4, speed: 3 };
        default: return base;
    }
}

export type Area = 'Page' | 'Ideas' | 'Buttons' | 'Status' | 'Priority' | 'Accents';

export interface TokenDef {
    key: string;
    label: string;
    area: Area;
    /** Stock color (what the stylesheet falls back to). */
    def: string;
    /**
     * The net this token belongs to. A net is headed by one token whose own key is
     * its `net`: that head is what the Simple tab edits, and every other token in
     * the net follows it until it is overridden in Advanced. null = Advanced only.
     */
    net: string | null;
    hint?: string;
}

const tok = (key: string, label: string, area: Area, def: string, net: string | null, hint?: string): TokenDef =>
    ({ key, label, area, def, net: net === 'self' ? key : net, hint });

// One entry per themeable role. The stylesheets read these as t(<kebab-key>, $stock),
// i.e. var(--t-<kebab-key>, stock). Keys are stored in saved themes: never rename one.
// A net's tokens share a stock color, so recoloring the head changes them all together.
export const TOKENS = [
    tok('pageBg', 'Page background', 'Page', '#E9F9E5', 'self'),
    tok('surface', 'Modals and cards', 'Page', '#E9F9E5', 'self', 'Cards and any surface without its own entry'),
    tok('modalBg', 'Modal window', 'Page', '#E9F9E5', 'surface'),
    tok('menuBg', 'Card menu and popups', 'Page', '#E9F9E5', 'surface'),
    tok('toastBg', 'Toasts', 'Page', '#E9F9E5', 'surface'),
    // Follows the page, not the surfaces: with layers the phone already shows the page color under them.
    tok('mobileBg', 'Phone screen', 'Page', '#E9F9E5', 'pageBg'),
    tok('mapPanelBg', 'Mind map panels', 'Page', '#E9F9E5', 'surface'),
    tok('panel', 'Panels and sheets', 'Page', '#D3DED1', 'self', 'Mobile sheets, side panels, banners'),
    tok('hoverBg', 'Row hover and selected', 'Page', '#D3DED1', 'panel'),
    tok('chipBg', 'Chips and code blocks', 'Page', '#D3DED1', 'panel'),
    tok('inputBg', 'Text inputs', 'Page', '#D3DED1', 'self'),

    tok('nodeRoot', 'Root idea', 'Ideas', '#A3703E', 'self', 'Also the mobile header and the current level'),
    tok('nodeLeaf', 'Leaf ideas', 'Ideas', '#41BC28', 'self'),
    tok('nodeParent', 'Parent ideas', 'Ideas', '#00A9D8', 'self'),
    tok('nodeLink', 'Link ideas', 'Ideas', '#E8E879', 'self'),
    tok('nodeChecklist', 'Checklists', 'Ideas', '#2049C5', 'self', 'Also checklist bars, boxes and buttons'),
    tok('nodeNote', 'Notes', 'Ideas', '#2B701D', 'self'),
    tok('nodeVault', 'Vault notes', 'Ideas', '#4B1F8F', 'self'),
    tok('nodeVaultSlot', 'Vault secret slot', 'Ideas', '#2A1052', null),

    tok('btnConfirm', 'Confirm buttons', 'Buttons', '#41BC28', 'self', 'Create, Save, Continue in modals'),
    tok('btnPrimary', 'Main action buttons', 'Buttons', '#41BC28', 'btnConfirm', 'Profile, sign-in, floating add'),
    tok('btnCancel', 'Cancel buttons', 'Buttons', '#C84600', 'self'),
    tok('btnBack', 'Back button', 'Buttons', '#C84600', 'btnCancel'),
    tok('btnClear', 'Clear and close', 'Buttons', '#C84600', 'btnCancel'),
    tok('btnSecondary', 'Secondary buttons', 'Buttons', '#E8E879', 'self'),
    tok('btnNeutral', 'Neutral buttons', 'Buttons', '#D3DED1', 'self', 'Close, controls, plain actions'),
    tok('btnDanger', 'Delete buttons', 'Buttons', '#C80000', 'self'),
    tok('btnSwipeDelete', 'Swipe delete (mobile)', 'Buttons', '#C80000', 'btnDanger'),

    tok('highlight', 'Highlights', 'Status', '#E8E879', 'self', 'Selection, tags, badges, hover accents'),
    tok('active', 'Active and focus', 'Status', '#00A9D8', 'self'),
    tok('focusRing', 'Focus outline', 'Status', '#00A9D8', 'active'),
    tok('navActive', 'Active navigation', 'Status', '#00A9D8', 'active'),
    tok('statusSuccess', 'Success', 'Status', '#41BC28', 'self'),
    tok('statusError', 'Error', 'Status', '#C80000', 'self'),
    tok('unreadDot', 'Unread dots', 'Status', '#C80000', 'statusError'),
    tok('statusWarning', 'Warning', 'Status', '#CC5500', 'self'),
    tok('btnHome', 'Home button', 'Status', '#CC5500', 'statusWarning'),

    tok('prioHigh', 'High priority', 'Priority', '#C80000', 'self'),
    tok('prioMedium', 'Medium priority', 'Priority', '#EC8A13', 'self'),
    tok('prioLow', 'Low priority', 'Priority', '#D4A000', 'self'),

    tok('accentPink', 'Pink accent', 'Accents', '#DB44A4', null, 'Mind map buttons and icons'),
    tok('accentPurple', 'Purple accent', 'Accents', '#7322C3', null, 'Selected priority'),
    tok('accentOrange', 'Orange accent', 'Accents', '#EC8A13', null),
    tok('accentGold', 'Gold accent', 'Accents', '#D4A000', null, 'Sort button, swipe move'),
    tok('textLink', 'Link text', 'Accents', '#2B701D', null),
] as const satisfies readonly TokenDef[];

export type TokenKey = (typeof TOKENS)[number]['key'];
export const TOKEN_BY_KEY = Object.fromEntries(TOKENS.map((t) => [t.key, t])) as Record<TokenKey, TokenDef>;
export const AREAS: Area[] = ['Page', 'Ideas', 'Buttons', 'Status', 'Priority', 'Accents'];
/** Tokens the Simple tab edits: the head of each net. */
export const NET_HEADS: TokenDef[] = TOKENS.filter((t) => t.net === t.key);

export interface EditorRow {
    key: TokenKey;
    /** Replaces the registry label where the section gives the role a plainer name. */
    label?: string;
    hint?: string;
    /** The touch UI's wording, where the desktop one names desktop-only things (the sidebar). */
    touch?: { label?: string; hint?: string };
}

export interface EditorSection {
    id: string;
    title: string;
    /** Title on the touch UI, when the desktop one doesn't fit it. */
    touchTitle?: string;
    rows: EditorRow[];
}

// The theme editor's sections, most noticed first: the idea colors are always
// shown, every later section is a dropdown, ordered by how often it is on screen.
// Each token is a row in exactly one section, or sits under its net head when
// that head is a row (theme.test.ts). A member can be a row of its own where
// users meet it (Create under Sidebar, though it follows Confirm buttons).
export const EDITOR_SECTIONS: EditorSection[] = [
    { id: 'ideas', title: 'Idea colors', rows: [
        { key: 'nodeRoot', label: 'Root' },
        { key: 'nodeParent', label: 'Parent' },
        { key: 'nodeLeaf', label: 'Leaf' },
        { key: 'nodeLink', label: 'Link' },
        { key: 'nodeChecklist', label: 'Checklist' },
        { key: 'nodeNote', label: 'Note' },
        { key: 'nodeVault', label: 'Vault' },
    ] },
    { id: 'sidebar', title: 'Sidebar', touchTitle: 'Main buttons', rows: [
        { key: 'btnPrimary', label: 'Create button', hint: 'Also Save in Profile and sign-in', touch: { label: '+ button', hint: 'Also Save in sheets and sign-in' } },
        { key: 'btnHome', label: 'Home button' },
        { key: 'btnNeutral', label: 'Side buttons', hint: 'Search, Profile, Help, and plain buttons elsewhere', touch: { label: 'Plain buttons', hint: 'Help, Profile, the path button and row actions' } },
        { key: 'navActive', label: 'Open panel button', hint: 'A side button while its panel is open', touch: { hint: 'A button while its panel is open' } },
    ] },
    { id: 'background', title: 'Background', rows: [{ key: 'pageBg' }] },
    { id: 'priority', title: 'Priority', rows: [{ key: 'prioHigh' }, { key: 'prioMedium' }, { key: 'prioLow' }] },
    { id: 'windows', title: 'Windows and menus', rows: [{ key: 'surface' }, { key: 'panel' }, { key: 'inputBg' }] },
    { id: 'buttons', title: 'Window buttons', rows: [{ key: 'btnConfirm' }, { key: 'btnCancel' }, { key: 'btnSecondary' }, { key: 'btnDanger' }] },
    { id: 'status', title: 'Highlights and alerts', rows: [
        { key: 'highlight' }, { key: 'active' }, { key: 'statusSuccess' }, { key: 'statusError' }, { key: 'statusWarning' },
    ] },
    { id: 'details', title: 'Small details', rows: [
        { key: 'accentPink' }, { key: 'accentPurple' }, { key: 'accentOrange' }, { key: 'accentGold' }, { key: 'textLink' }, { key: 'nodeVaultSlot' },
    ] },
];

// How the editors lay the sections out: idea colors first, Background on its own
// (it holds the layers, so it is more than a color), the rest as "More colors".
export const IDEA_SECTION = EDITOR_SECTIONS[0];
export const BG_SECTION = EDITOR_SECTIONS.find((s) => s.id === 'background')!;
export const MORE_SECTIONS = EDITOR_SECTIONS.slice(1).filter((s) => s !== BG_SECTION);

/** A row's name and hint, with the touch UI's wording where the desktop one names desktop-only things. */
export function editorRowText(row: EditorRow, touch = false): { label: string; hint?: string } {
    const def = TOKEN_BY_KEY[row.key];
    return {
        label: (touch ? row.touch?.label : undefined) ?? row.label ?? def.label,
        hint: (touch ? row.touch?.hint : undefined) ?? row.hint ?? def.hint,
    };
}

const EDITOR_ROW_KEYS = new Set(EDITOR_SECTIONS.flatMap((s) => s.rows.map((r) => r.key)));

/** Net members tucked under a head's row: those that are not a row themselves. */
export const nestedMembers = (head: TokenKey): TokenDef[] =>
    TOKENS.filter((t) => t.net === head && t.key !== head && !EDITOR_ROW_KEYS.has(t.key));

export interface ThemeColors {
    /** Only what the theme sets. A head sets its whole net; any other key overrides just itself. */
    values: Partial<Record<TokenKey, string>>;
    /** Background layers drawn over the page color, bottom first. */
    layers?: BgLayer[];
}

export interface Theme {
    id: string;
    name: string;
    colors: ThemeColors;
}

export const DEFAULT_COLORS: ThemeColors = { values: {} };

export const isHead = (key: TokenKey) => TOKEN_BY_KEY[key].net === key;

/** The color a token takes in this theme, or undefined when the stock look applies. */
export function resolveToken(colors: ThemeColors, key: TokenKey): string | undefined {
    const own = colors.values[key];
    if (own) return own;
    const net = TOKEN_BY_KEY[key].net;
    return net && net !== key ? colors.values[net as TokenKey] : undefined;
}

/** What the token looks like right now (theme color or stock). */
export const effectiveColor = (colors: ThemeColors, key: TokenKey) => resolveToken(colors, key) ?? TOKEN_BY_KEY[key].def;

/** True when a non-head token is set on its own, so a change to its net no longer reaches it. */
export const isOverridden = (colors: ThemeColors, key: TokenKey) => !isHead(key) && !!colors.values[key];

export const cssVar = (key: string) => `--t-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

export function sameValues(a: ThemeColors, b: ThemeColors): boolean {
    const keys = Object.keys(a.values) as TokenKey[];
    return keys.length === Object.keys(b.values).length
        && keys.every((k) => a.values[k]?.toLowerCase() === b.values[k]?.toLowerCase());
}

// Presets are written with the six original colors; they become the matching heads.
interface PresetColors { bg: string; root: string; leaf: string; parent: string; link: string; checklist: string; layers?: BgLayer[] }
const PRESET_KEYS: Record<Exclude<keyof PresetColors, 'layers'>, TokenKey> = {
    bg: 'pageBg', root: 'nodeRoot', leaf: 'nodeLeaf', parent: 'nodeParent', link: 'nodeLink', checklist: 'nodeChecklist',
};

const L = (type: BgType, id: string, over: Partial<BgLayer>): BgLayer => ({ ...newLayer(type), id, ...over });

// Built-in themes. Each (except Classic) is built from the background layers.
const RAW_PRESETS: { id: string; name: string; colors: PresetColors }[] = [
    { id: 'aero', name: 'Frutiger Aero', colors: { bg: '#A8DCF8', root: '#1E7FD6', leaf: '#3CC43C', parent: '#27B5E8', link: '#FFB02E', checklist: '#0B5FC4', layers: [
        L('ripples', 'aero-sky', { kind: '', color: '#ffffff', color2: '#8fd3ff', color3: '#2a8fe0', angle: 180, size: 4, density: 5, speed: 3, opacity: 47 }),
        L('plasma', 'aero-ripples', { kind: '', color: '#ff5fa2', color2: '#6a8cff', color3: '#7cf0c9', angle: 180, size: 5, density: 5, speed: 3, opacity: 24 }),
        L('gradient', 'aero-glow', { kind: 'radial', color: '#64ee4f', color2: '#10a345', color3: '#e5ffdd', angle: 180, size: 5, density: 5, speed: 3, opacity: 25 }),
    ] } },
    { id: 'sunset', name: 'Sunset', colors: { bg: '#FFE0C2', root: '#8A4B2A', leaf: '#F2994A', parent: '#D6456B', link: '#F2E35A', checklist: '#6A2C91', layers: [
        L('gradient', 'sun-sky', { kind: 'linear', color: '#ffd9a8', color2: '#ff9a76', color3: '#c9508f', angle: 0 }),
        L('ridges', 'sun-ridges', { color: '#7a2e5c', color2: '#f2994a', color3: '#ffd9a8', density: 4, speed: 1, opacity: 85 }),
    ] } },
    { id: 'midnight', name: 'Midnight', colors: { bg: '#1B2238', root: '#7A5C3E', leaf: '#3FB68B', parent: '#4C7BE0', link: '#D9B84A', checklist: '#8E5BD9', layers: [
        L('plasma', 'mid-plasma', { color: '#0d1330', color2: '#2a1b6d', color3: '#12466e', size: 3, density: 3, speed: 2 }),
        L('spiral', 'mid-spiral', { color: '#ffffff', color2: '#9ab4ff', color3: '#d7a8ff', size: 2, density: 4, speed: 1, opacity: 55 }),
    ] } },
    { id: 'cosmos', name: 'Cosmos', colors: { bg: '#120B26', root: '#8A6A44', leaf: '#46C7A0', parent: '#5B8CF0', link: '#E8C94F', checklist: '#B063E8', layers: [
        L('fractal', 'co-fractal', { color: '#120b26', color2: '#5b2bb5', color3: '#ff7ac8', size: 4, speed: 1 }),
        L('spiral', 'co-spiral', { color: '#ffffff', color2: '#ffd36b', color3: '#9ab4ff', size: 2, density: 6, speed: 1, opacity: 45 }),
    ] } },
    { id: 'blueprint', name: 'Blueprint', colors: { bg: '#1E4FA3', root: '#A3703E', leaf: '#3FBF73', parent: '#4FA8E8', link: '#EBDD6A', checklist: '#16357A', layers: [
        L('gradient', 'bp-base', { kind: 'radial', color: '#2d68c4', color2: '#1e4fa3', color3: '#143a80' }),
        L('pattern', 'bp-grid', { kind: 'grid', color: '#ffffff', size: 4, angle: 0, opacity: 22 }),
    ] } },
    { id: 'zen', name: 'Zen Garden', colors: { bg: '#F1ECE0', root: '#8A6A44', leaf: '#6FA85A', parent: '#4F9AA8', link: '#E3CE6B', checklist: '#4B5FA8', layers: [
        L('mandala', 'zen-mandala', { color: '#b9a98a', color2: '#d8cdb4', color3: '#9bb58a', size: 6, density: 4, speed: 1, opacity: 57 }),
    ] } },
    { id: 'tiles', name: 'Truchet', colors: { bg: '#1F3D2B', root: '#8A5A34', leaf: '#8DBF5A', parent: '#E0A33A', link: '#F2D77A', checklist: '#B5502F', layers: [
        L('truchet', 'tr-tiles', { color: '#d9744a', color2: '#e8b84a', color3: '#9fca78', size: 5, density: 4, speed: 1, opacity: 70 }),
    ] } },
    { id: 'pendulum', name: 'Pendulum', colors: { bg: '#141A2E', root: '#7A5C3E', leaf: '#3FB68B', parent: '#4C7BE0', link: '#D9B84A', checklist: '#8E5BD9', layers: [
        L('gradient', 'pe-glow', { kind: 'radial', color: '#26305a', color2: '#18203c', color3: '#0e1324' }),
        L('harmonograph', 'pe-trace', { color: '#ffffff', color2: '#ffd36b', color3: '#ff7ac8', size: 2, density: 6, speed: 1, opacity: 75 }),
        L('spiral', 'pe-spiral', { kind: '', color: '#ff5fa2', color2: '#6a8cff', color3: '#7cf0c9', angle: 180, size: 10, density: 3, speed: 3, opacity: 100 }),
    ] } },
    { id: 'synthwave', name: 'Synthwave', colors: { bg: '#1A0B33', root: '#8A5A44', leaf: '#3FD6A8', parent: '#5B8CF0', link: '#FFD34F', checklist: '#C04FE0', layers: [
        L('gradient', 'sw-sky', { kind: 'linear', color: '#140628', color2: '#6a1f7a', color3: '#140628', angle: 180 }),
        L('terrain', 'sw-grid', { color: '#ff4fd8', color2: '#b06bff', color3: '#4fd8ff', size: 4, density: 5, speed: 2, opacity: 85 }),
    ] } },
    { id: 'polygon', name: 'Polygon', colors: { bg: '#0E1430', root: '#8A6A44', leaf: '#46C7A0', parent: '#5B8CF0', link: '#E8C94F', checklist: '#B063E8', layers: [
        L('gradient', 'pg-void', { kind: 'radial', color: '#24357a', color2: '#121a45', color3: '#070a1f' }),
        L('shapes', 'pg-shapes', { color: '#5fb8ff', color2: '#b07bff', color3: '#7cf0c9', size: 5, density: 4, speed: 2, opacity: 90 }),
    ] } },
    { id: 'aquarium', name: 'Aquarium', colors: { bg: '#1F6F94', root: '#8C6A3F', leaf: '#3CC79A', parent: '#2F9FE0', link: '#FFD23F', checklist: '#6C4FD6', layers: [
        L('aquarium', 'aq-tank', { color: '#ff8a3d', color2: '#ffd23f', color3: '#2a8fc0', size: 5, density: 4, speed: 2 }),
    ] } },
];

// Everything beyond the six node/page colors: surfaces, buttons, status and accents.
// Text, borders and shadows stay black, so surfaces and buttons stay light enough to read it.
interface Look {
    surface: string; panel: string;
    confirm: string; cancel: string; secondary: string; danger: string;
    highlight: string; active: string; success: string; warning: string;
    prio: [high: string, medium: string, low: string];
    pink: string; purple: string; orange: string; gold: string;
    note: string; vault: string; vaultSlot: string;
    /** Link text on the sign-in and legal pages, which sit on the page color. */
    textLink: string;
}

const fromLook = (l: Look): ThemeColors['values'] => ({
    surface: l.surface, panel: l.panel, inputBg: l.panel, btnNeutral: l.panel,
    btnConfirm: l.confirm, btnCancel: l.cancel, btnSecondary: l.secondary, btnDanger: l.danger,
    highlight: l.highlight, active: l.active, statusSuccess: l.success, statusError: l.danger, statusWarning: l.warning,
    prioHigh: l.prio[0], prioMedium: l.prio[1], prioLow: l.prio[2],
    accentPink: l.pink, accentPurple: l.purple, accentOrange: l.orange, accentGold: l.gold,
    nodeNote: l.note, nodeVault: l.vault, nodeVaultSlot: l.vaultSlot, textLink: l.textLink,
});

const LOOKS: Record<string, Look> = {
    aero: { surface: '#F1FAFF', panel: '#CFE9F7', confirm: '#3CC43C', cancel: '#E0662F', secondary: '#FFD36B', danger: '#D93A3A', highlight: '#FFE27A', active: '#27B5E8', success: '#3CC43C', warning: '#E08A1E', prio: ['#E0392B', '#FFA21F', '#E8C21A'], pink: '#F06BB0', purple: '#6C5CE7', orange: '#FF9A2E', gold: '#E8B100', note: '#1F8F4D', vault: '#2D3FA8', vaultSlot: '#1B2A73', textLink: '#0B5FC4' },
    sunset: { surface: '#FFF4E8', panel: '#FFDCC0', confirm: '#E8863A', cancel: '#C2452D', secondary: '#F6D96B', danger: '#B5223A', highlight: '#F6D96B', active: '#D6456B', success: '#5FA84A', warning: '#C45A1F', prio: ['#C4252F', '#F2994A', '#E3B52B'], pink: '#D6456B', purple: '#6A2C91', orange: '#F2994A', gold: '#D9A21B', note: '#7A3F22', vault: '#5A2A7A', vaultSlot: '#351646', textLink: '#8A3F1F' },
    midnight: { surface: '#E8ECF8', panel: '#C9D2EC', confirm: '#3FB68B', cancel: '#D96A4C', secondary: '#D9B84A', danger: '#D64560', highlight: '#D9B84A', active: '#4C7BE0', success: '#3FB68B', warning: '#D98B3A', prio: ['#E0475F', '#E8A23A', '#D9C24A'], pink: '#D96BC0', purple: '#8E5BD9', orange: '#E8A23A', gold: '#D9B84A', note: '#2F7F6E', vault: '#5B3FB5', vaultSlot: '#2D1D66', textLink: '#9AB4FF' },
    ocean: { surface: '#E4F3FA', panel: '#BCDDEE', confirm: '#34C79A', cancel: '#E07A4F', secondary: '#F0D264', danger: '#D8484F', highlight: '#F0D264', active: '#2F8FE0', success: '#34C79A', warning: '#E0883A', prio: ['#E4454F', '#F0A03A', '#E3C94F'], pink: '#E26BAE', purple: '#6C4FD6', orange: '#F0A03A', gold: '#E3C04A', note: '#1F7A63', vault: '#3F3FA8', vaultSlot: '#25256B', textLink: '#9CD3F5' },
    glass: { surface: '#FBF5FF', panel: '#E6D3F7', confirm: '#35B86B', cancel: '#E0568A', secondary: '#F2D44A', danger: '#D43D5C', highlight: '#F2D44A', active: '#3D8FE0', success: '#35B86B', warning: '#E08A3A', prio: ['#D43D5C', '#F29A3A', '#E8C83A'], pink: '#E0568A', purple: '#7A3FC8', orange: '#F29A3A', gold: '#E8C83A', note: '#258A55', vault: '#5A2FA0', vaultSlot: '#341766', textLink: '#5A2FA0' },
    cosmos: { surface: '#EEE8FA', panel: '#D3C8EE', confirm: '#46C7A0', cancel: '#E06A8A', secondary: '#E8C94F', danger: '#D8456A', highlight: '#E8C94F', active: '#5B8CF0', success: '#46C7A0', warning: '#E58C3E', prio: ['#E04A6E', '#EBA43A', '#E4CC4A'], pink: '#E86BC0', purple: '#B063E8', orange: '#EBA43A', gold: '#E8C94F', note: '#2E8B77', vault: '#6A3FC0', vaultSlot: '#3A1D80', textLink: '#C9B3FF' },
    blueprint: { surface: '#E6EEFB', panel: '#BFD1F0', confirm: '#3FBF73', cancel: '#E0703F', secondary: '#EBDD6A', danger: '#D8454A', highlight: '#EBDD6A', active: '#4FA8E8', success: '#3FBF73', warning: '#E5883A', prio: ['#E0454A', '#EBA33A', '#E4D14F'], pink: '#E26BAE', purple: '#7A6AE0', orange: '#EBA33A', gold: '#E4C94A', note: '#1F7F55', vault: '#3A3FB0', vaultSlot: '#222672', textLink: '#CFE3FF' },
    zen: { surface: '#FAF6EC', panel: '#E3DBC6', confirm: '#6FA85A', cancel: '#C9663F', secondary: '#E3CE6B', danger: '#B8483C', highlight: '#E3CE6B', active: '#4F9AA8', success: '#6FA85A', warning: '#C9803F', prio: ['#B8483C', '#D98E3F', '#D4B84A'], pink: '#C9738F', purple: '#6B5A9A', orange: '#D98E3F', gold: '#CDB04A', note: '#55803F', vault: '#5A4A8A', vaultSlot: '#342A55', textLink: '#55803F' },
};

// The newer themes start from the closest look above and change what reads differently.
Object.assign(LOOKS, {
    tiles: { ...LOOKS.zen, surface: '#F6F1DF', panel: '#E2DCB8', confirm: '#7FB04E', cancel: '#D2623B', secondary: '#E8B84A', active: '#E0A33A', textLink: '#F2D77A' },
    pendulum: { ...LOOKS.midnight },
    synthwave: { ...LOOKS.cosmos, pink: '#FF4FD8', active: '#B06BFF' },
    polygon: { ...LOOKS.cosmos, active: '#5FB8FF', textLink: '#9CD3FF' },
    aquarium: { ...LOOKS.ocean, orange: '#FF8A3D', gold: '#FFD23F' },
} satisfies Record<string, Look>);

export const PRESETS: Theme[] = [
    { id: 'default', name: 'Classic', colors: DEFAULT_COLORS },
    ...RAW_PRESETS.map(({ id, name, colors: { layers, ...flat } }): Theme => ({
        id,
        name,
        colors: {
            values: {
                ...(LOOKS[id] ? fromLook(LOOKS[id]) : {}),
                ...Object.fromEntries((Object.keys(PRESET_KEYS) as (keyof typeof PRESET_KEYS)[]).map((k) => [PRESET_KEYS[k], flat[k]])),
            },
            ...(layers ? { layers } : {}),
        },
    })),
];

const KEY = 'custom_theme';

/** Reads a stored theme (current shape, or the earlier flat six-color one) into ThemeColors. */
export function parseThemeColors(parsed: { values?: Record<string, unknown>; layers?: BgLayer[] } & Record<string, unknown>): ThemeColors {
    {
        const values: Partial<Record<TokenKey, string>> = {};
        if (parsed.values && typeof parsed.values === 'object') {
            for (const [k, v] of Object.entries(parsed.values)) {
                if (k in TOKEN_BY_KEY && typeof v === 'string') values[k as TokenKey] = v;
            }
        } else {
            // Earlier builds saved the six colors flat; they become values of the matching heads.
            for (const [old, key] of Object.entries(PRESET_KEYS)) {
                if (typeof parsed[old] === 'string') values[key] = parsed[old] as string;
            }
        }
        const layers = Array.isArray(parsed.layers) ? parsed.layers.filter((l) => BG_TYPES.some((t) => t.type === l?.type)) : null;
        return { values, ...(layers ? { layers } : {}) };
    }
}

export function loadSavedTheme(): ThemeColors | null {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? parseThemeColors(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

/** The --t-* properties a theme sets; tokens it leaves alone are absent (stock look). */
export function themeVars(colors: ThemeColors): Record<string, string> {
    const out: Record<string, string> = {};
    for (const t of TOKENS) {
        const v = resolveToken(colors, t.key);
        if (v) out[cssVar(t.key)] = v;
    }
    return out;
}

const SAVED_AT_KEY = 'custom_theme_at';

/** When the active theme was last changed on this device (or pulled from the account), ms; 0 if never. */
export function getThemeSavedAt(): number {
    try { return Number(localStorage.getItem(SAVED_AT_KEY)) || 0; } catch { return 0; }
}

/** `at` is only passed when adopting a theme pulled from the account, so it keeps the account's timestamp. */
export function saveTheme(colors: ThemeColors | null, at: number = Date.now()): void {
    try {
        if (colors) localStorage.setItem(KEY, JSON.stringify(colors));
        else localStorage.removeItem(KEY);
        localStorage.setItem(SAVED_AT_KEY, String(at));
    } catch { /* storage unavailable */ }
}

// The active layers, read by ThemeBackgroundHost via useSyncExternalStore.
let activeLayers: BgLayer[] = [];
const listeners = new Set<() => void>();
export const subscribeLayers = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getActiveLayers = () => activeLayers;

// The colors last applied, so the help text can name them as they are right now.
let activeColors: ThemeColors | null = null;

/** The color a token has right now, as a hex string. */
export const getActiveColor = (key: TokenKey) => effectiveColor(activeColors ?? DEFAULT_COLORS, key);

// A name per slice of the color wheel (degrees); each slice runs to the next entry.
const HUE_NAMES: [number, string][] = [
    [0, 'red'], [12, 'orange'], [38, 'amber'], [52, 'yellow'], [70, 'lime'], [95, 'green'],
    [150, 'mint'], [165, 'teal'], [180, 'sky blue'], [205, 'blue'], [222, 'indigo'],
    [255, 'violet'], [280, 'purple'], [305, 'magenta'], [330, 'pink'], [348, 'red'],
];

/** A plain-English name for a #rrggbb color: hue slice, with dark/light/pale/gray/brown adjustments. */
export function colorName(hex: string): string {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
    if (!m) return 'custom';
    const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (l < 0.1) return 'black';
    if (l > 0.95) return 'white';
    if (s < 0.12) return l < 0.3 ? 'dark gray' : l > 0.8 ? 'light gray' : 'gray';
    let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    let base = HUE_NAMES[0][1];
    for (const [from, name] of HUE_NAMES) if (h >= from) base = name;
    if ((base === 'orange' || base === 'amber') && l < 0.5) return 'brown';
    if (s < 0.3 && l < 0.45) return `slate ${base}`;
    if (l < 0.3) return `dark ${base}`;
    if (l > 0.85) return `pale ${base}`;
    return base;
}

/** Writes the colors onto :root and publishes the layers; null removes them (stock look). */
export function applyTheme(colors: ThemeColors | null): void {
    const style = document.documentElement.style;
    const vars = colors ? themeVars(colors) : {};
    for (const t of TOKENS) {
        const name = cssVar(t.key);
        if (vars[name]) style.setProperty(name, vars[name]);
        else style.removeProperty(name);
    }
    activeLayers = colors?.layers ?? [];
    activeColors = colors;
    // The layer stack is opaque and sits over the body's grid, so the grid
    // needs no switching off: the stack fades in over it (themeBackground.scss).
    listeners.forEach((fn) => fn());
}

// Remembers (per device) that the last signed-in account could use themes, so
// the next load can paint the theme before the plan has come back from Firestore.
const ENTITLED_KEY = 'theme_entitled';

export function rememberThemeEntitlement(entitled: boolean): void {
    try {
        if (entitled) localStorage.setItem(ENTITLED_KEY, '1');
        else localStorage.removeItem(ENTITLED_KEY);
    } catch { /* storage unavailable */ }
}

/** Called from Index.tsx before React renders: applies the saved theme for the app page. */
export function applyEarlyTheme(): void {
    try {
        if (location.pathname !== '/main' || !localStorage.getItem(ENTITLED_KEY)) return;
    } catch {
        return;
    }
    applyTheme(loadSavedTheme());
}
