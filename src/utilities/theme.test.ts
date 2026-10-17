import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    DEFAULT_COLORS, EDITOR_SECTIONS, colorName, NET_HEADS, nestedMembers, PRESETS, TOKENS, TOKEN_BY_KEY, cssVar, effectiveColor, isOverridden, resolveToken, themeVars,
    type ThemeColors, type TokenKey,
} from './theme';

const stylesDir = join(__dirname, '..', 'styles');
const kebab = (key: string) => cssVar(key).slice('--t-'.length);

describe('token registry', () => {
    it('has unique keys and kebab names', () => {
        expect(new Set(TOKENS.map((t) => t.key)).size).toBe(TOKENS.length);
        expect(new Set(TOKENS.map((t) => kebab(t.key))).size).toBe(TOKENS.length);
    });

    it('points every net at a head that exists and shares its stock color', () => {
        for (const t of TOKENS) {
            if (!t.net) continue;
            const head = TOKEN_BY_KEY[t.net as TokenKey];
            expect(head, `${t.key} -> ${t.net}`).toBeDefined();
            expect(head.net, `${t.net} must head its own net`).toBe(head.key);
            expect(t.def.toLowerCase(), `${t.key} vs head ${head.key}`).toBe(head.def.toLowerCase());
        }
    });

    it('places every token in the editor exactly once', () => {
        const rows = EDITOR_SECTIONS.flatMap((s) => s.rows.map((r) => r.key));
        const tucked = rows.flatMap((k) => nestedMembers(k).map((t) => t.key));
        const placed = [...rows, ...tucked];
        expect(new Set(placed).size, 'a token is placed twice').toBe(placed.length);
        expect(new Set(placed)).toEqual(new Set(TOKENS.map((t) => t.key)));
    });

    it('lists a head for every Simple control', () => {
        expect(NET_HEADS.length).toBeGreaterThan(0);
        expect(NET_HEADS.every((h) => h.net === h.key)).toBe(true);
    });
});

describe('stylesheet tokens', () => {
    it('only uses t(<token>, ...) names that are in the registry', () => {
        const known = new Set(TOKENS.map((t) => kebab(t.key)));
        const missing: string[] = [];
        for (const f of readdirSync(stylesDir).filter((x) => x.endsWith('.scss'))) {
            const src = readFileSync(join(stylesDir, f), 'utf8');
            for (const m of src.matchAll(/(?<![\w-])(?:t\(|@include t-(?:shift|alpha)\(\s*[\w-]+,\s*)([a-z][a-z-]*)\s*,/g)) {
                if (!known.has(m[1])) missing.push(`${f}: ${m[1]}`);
            }
        }
        expect(missing).toEqual([]);
    });

    it('uses every token somewhere, or it is dead weight', () => {
        const all = readdirSync(stylesDir).filter((x) => x.endsWith('.scss')).map((f) => readFileSync(join(stylesDir, f), 'utf8')).join('\n');
        // Net heads can be unused when their members cover the whole net (the head only recolors).
        const unused = TOKENS.filter((t) => !all.includes(kebab(t.key)) && !(t.net === t.key && TOKENS.some((m) => m.net === t.key && m.key !== t.key && all.includes(kebab(m.key)))));
        expect(unused.map((t) => t.key)).toEqual([]);
    });
});

describe('resolution', () => {
    const theme = (values: ThemeColors['values']): ThemeColors => ({ values });

    it('gives the stock look when nothing is set', () => {
        expect(themeVars(DEFAULT_COLORS)).toEqual({});
        expect(effectiveColor(DEFAULT_COLORS, 'btnConfirm')).toBe('#41BC28');
    });

    it('lets a head recolor its whole net', () => {
        const c = theme({ btnConfirm: '#112233' });
        expect(resolveToken(c, 'btnPrimary')).toBe('#112233');
        expect(themeVars(c)['--t-btn-primary']).toBe('#112233');
    });

    it('keeps a member override when its head changes', () => {
        const c = theme({ btnConfirm: '#112233', btnPrimary: '#445566' });
        expect(resolveToken(c, 'btnPrimary')).toBe('#445566');
        expect(isOverridden(c, 'btnPrimary')).toBe(true);
        expect(isOverridden(c, 'btnConfirm')).toBe(false);
    });

    it('does not leak across nets', () => {
        const c = theme({ btnCancel: '#abcdef' });
        expect(resolveToken(c, 'btnSecondary')).toBeUndefined();
        expect(resolveToken(c, 'btnBack')).toBe('#abcdef');
    });

    it('only uses known keys in presets', () => {
        for (const p of PRESETS) {
            for (const k of Object.keys(p.colors.values)) expect(TOKEN_BY_KEY[k as TokenKey], `${p.id}.${k}`).toBeDefined();
        }
    });
});

describe('built-in themes', () => {
    const lum = (hex: string) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
            .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrastWithInk = (hex: string) => (lum(hex) + 0.05) / (lum('#111111') + 0.05);

    // Text, borders and shadows are fixed at #111, so these must stay light enough to read it.
    const READABLE: TokenKey[] = ['surface', 'panel', 'btnConfirm', 'btnSecondary', 'highlight'];

    it('keeps surfaces and buttons readable under dark text', () => {
        for (const p of PRESETS.filter((x) => x.id !== 'default')) {
            for (const k of READABLE) {
                const hex = effectiveColor(p.colors, k);
                expect(contrastWithInk(hex), `${p.id}.${k} ${hex}`).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

    it('themes every group, not just the six node colors', () => {
        for (const p of PRESETS.filter((x) => x.id !== 'default')) {
            for (const h of NET_HEADS.filter((x) => !['pageBg', 'nodeRoot', 'nodeChecklist'].includes(x.key))) {
                expect(p.colors.values[h.key as TokenKey], `${p.id}.${h.key}`).toBeDefined();
            }
        }
    });
});

describe('colorName', () => {
    it('names the stock node colors the way the help used to', () => {
        expect(colorName('#41BC28')).toBe('green');
        expect(colorName('#00A9D8')).toBe('sky blue');
        expect(colorName('#2049C5')).toBe('indigo');
        expect(colorName('#E8E879')).toBe('yellow');
        expect(colorName('#2B701D')).toBe('dark green');
        expect(colorName('#C80000')).toBe('red');
        expect(colorName('#EC8A13')).toBe('orange');
        expect(colorName('#A3703E')).toBe('brown');
    });
});
