import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { getActiveLayers, subscribeLayers, type BgLayer } from '../utilities/theme';
import '../styles/themeBackground.scss';

// ── Small helpers ────────────────────────────────────────────────────────────

// Deterministic pseudo-random so a layer looks the same on every render.
function rng(seed: number) {
    let a = seed + 0x6d2b79f5;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const hashId = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

type Rgb = [number, number, number];
const hexToRgb = (h: string): Rgb => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const frac = (x: number) => x - Math.floor(x);
const smoothstep = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

/** 256-entry cyclic palette: color -> color2 -> color3 -> back to color. */
function makeLut(l: BgLayer): Uint8ClampedArray {
    const cs = [hexToRgb(l.color), hexToRgb(l.color2), hexToRgb(l.color3)];
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
        const p = (i / 256) * 3;
        const k = Math.floor(p);
        const f = p - k;
        const a = cs[k % 3], b = cs[(k + 1) % 3];
        for (let j = 0; j < 3; j++) lut[i * 3 + j] = a[j] + (b[j] - a[j]) * f;
    }
    return lut;
}
const lutIndex = (p: number) => ((frac(p) * 256) | 0) * 3;
// CSS strings for each palette entry, built once per palette instead of once per call.
const rgbStrings = new WeakMap<Uint8ClampedArray, string[]>();
const rgbAt = (lut: Uint8ClampedArray, p: number) => {
    let strs = rgbStrings.get(lut);
    if (!strs) {
        strs = [];
        for (let i = 0; i < 256; i++) strs.push(`rgb(${lut[i * 3]} ${lut[i * 3 + 1]} ${lut[i * 3 + 2]})`);
        rgbStrings.set(lut, strs);
    }
    return strs[(frac(p) * 256) | 0];
};

// ── Per-pixel shaders (drawn small, scaled up by the browser) ────────────────
// Each fills `d` (RGBA, W*H) for time `t` in seconds-ish units.

type Shader = (d: Uint8ClampedArray, W: number, H: number, t: number, l: BgLayer, lut: Uint8ClampedArray) => void;

/** Sum of four travelling sines, mapped through the palette (classic demoscene plasma). */
const plasma: Shader = (d, W, H, t, l, lut) => {
    const s = 2 + l.size * 0.9;
    const bands = 0.5 + l.density * 0.25;
    const asp = H / W;
    let o = 0;
    for (let y = 0; y < H; y++) {
        const v = (y / H - 0.5) * s * asp;
        for (let x = 0; x < W; x++) {
            const u = (x / W - 0.5) * s;
            const sum = Math.sin(u * 1.7 + t) + Math.sin(v * 2.1 - t * 0.8) + Math.sin((u + v) * 1.2 + t * 1.3) + Math.sin(Math.sqrt(u * u + v * v) * 2.2 - t * 0.9);
            const i = lutIndex(((sum + 4) / 8) * bands);
            d[o++] = lut[i]; d[o++] = lut[i + 1]; d[o++] = lut[i + 2]; d[o++] = 255;
        }
    }
};

/** Three drifting point sources each emitting cos(k*r - wt): their interference is the picture. */
const ripples: Shader = (d, W, H, t, l, lut) => {
    const k = 90 / (1 + l.size * 0.35);
    const asp = H / W;
    const src = [0, 1, 2].map((i) => [0.5 + 0.38 * Math.cos(t * 0.17 * (i + 1) + i * 2.1), asp * (0.5 + 0.38 * Math.sin(t * 0.13 * (i + 2) + i * 1.3))]);
    let o = 0;
    for (let y = 0; y < H; y++) {
        const py = y / W;
        for (let x = 0; x < W; x++) {
            const px = x / W;
            let sum = 0;
            for (let i = 0; i < 3; i++) { const dx = px - src[i][0], dy = py - src[i][1]; sum += Math.cos(k * Math.sqrt(dx * dx + dy * dy) - t * 2.2); }
            const i = lutIndex((sum / 3 + 1) / 2);
            d[o++] = lut[i]; d[o++] = lut[i + 1]; d[o++] = lut[i + 2]; d[o++] = 255;
        }
    }
};

/** Julia set z -> z^2 + c, with c orbiting slowly so the shape morphs. */
const fractal: Shader = (d, W, H, t, l, lut) => {
    const span = 3.2 / (1 + l.size * 0.12);
    // c sweeps a small arc around the "rabbit" Julia set (c ~ -0.12+0.75i), morphing it.
    const a = 1.75 + 0.3 * Math.sin(t * 0.12);
    const cr = 0.76 * Math.cos(a), ci = 0.76 * Math.sin(a);
    const asp = H / W;
    const MAX = 28;
    let o = 0;
    for (let y = 0; y < H; y++) {
        const y0 = (y / H - 0.5) * span * asp;
        for (let x = 0; x < W; x++) {
            let zr = (x / W - 0.5) * span, zi = y0, n = 0, r2 = 0;
            while (n < MAX) {
                const nr = zr * zr - zi * zi + cr;
                zi = 2 * zr * zi + ci;
                zr = nr;
                r2 = zr * zr + zi * zi;
                if (r2 > 256) break;
                n++;
            }
            if (n === MAX) {
                d[o++] = lut[0] * 0.3; d[o++] = lut[1] * 0.3; d[o++] = lut[2] * 0.3; d[o++] = 255;
            } else {
                const mu = n + 1 - Math.log2(Math.log2(r2) / 2); // smooth iteration count
                const i = lutIndex(mu * 0.045);
                d[o++] = lut[i]; d[o++] = lut[i + 1]; d[o++] = lut[i + 2]; d[o++] = 255;
            }
        }
    }
};

/**
 * Topographic map: a smooth height field h(x, y) drawn as iso-lines h = k / bands. Line width is
 * divided by |grad h| (estimated from neighbouring pixels), so lines stay even on steep and flat
 * ground alike; every fifth line is an index line, drawn heavier like on a real map.
 */
let field = new Float32Array(0);
const contours: Shader = (d, W, H, t, l) => {
    const s = 1.5 + l.size * 0.45;
    const bands = 4 + l.density * 1.6;
    const asp = H / W;
    if (field.length < W * H) field = new Float32Array(W * H);
    for (let y = 0, o = 0; y < H; y++) {
        const v = (y / H - 0.5) * s * asp;
        for (let x = 0; x < W; x++, o++) {
            const u = (x / W - 0.5) * s;
            field[o] = 0.5 + 0.22 * Math.sin(u * 1.3 + t * 0.3) * Math.cos(v * 1.1 - t * 0.2)
                + 0.14 * Math.sin((u - v) * 2.1 + t * 0.25) + 0.1 * Math.sin(Math.hypot(u + 1, v - 0.5) * 3 - t * 0.4);
        }
    }
    const line = hexToRgb(l.color), lo = hexToRgb(l.color2), hi = hexToRgb(l.color3);
    for (let y = 0, o = 0; y < H; y++) {
        for (let x = 0; x < W; x++, o++) {
            const h = field[o];
            const gx = (field[x < W - 1 ? o + 1 : o] - field[x > 0 ? o - 1 : o]) / 2;
            const gy = (field[y < H - 1 ? o + W : o] - field[y > 0 ? o - W : o]) / 2;
            const f = h * bands;
            const px = Math.min(frac(f), 1 - frac(f)) / Math.max(1e-4, Math.hypot(gx, gy) * bands); // distance to the nearest line, in pixels
            const index = Math.round(f) % 5 === 0;
            const a = 1 - smoothstep(index ? 0.55 : 0.2, index ? 1.3 : 0.9, px);
            const k = Math.min(1, Math.max(0, (h - 0.15) / 0.7));
            const p = o * 4;
            for (let j = 0; j < 3; j++) {
                const ground = lo[j] + (hi[j] - lo[j]) * k;
                d[p + j] = ground + (line[j] - ground) * a * (index ? 0.95 : 0.6);
            }
            d[p + 3] = 255;
        }
    }
};

const SHADERS: Partial<Record<BgLayer['type'], Shader>> = { plasma, ripples, fractal, contours };
/** Render width in pixels; thin lines need more than the default. */
const SHADER_WIDTH: Partial<Record<BgLayer['type'], number>> = { contours: 260 };

// ── Vector drawings (full size 2D canvas) ────────────────────────────────────

type Painter = (ctx: CanvasRenderingContext2D, W: number, H: number, t: number, l: BgLayer, lut: Uint8ClampedArray) => void;

/** Phyllotaxis: dot i sits at radius c*sqrt(i), angle i*137.5deg (the golden angle). */
const spiral: Painter = (ctx, W, H, t, l, lut) => {
    const N = 120 + l.density * 80;
    const maxR = Math.hypot(W, H) / 2 * 1.05;
    const c = maxR / Math.sqrt(N);
    const rot = t * 0.05;
    for (let i = 1; i < N; i++) {
        const r = c * Math.sqrt(i);
        const th = i * 2.399963 + rot;
        ctx.fillStyle = rgbAt(lut, i / N + t * 0.01);
        ctx.beginPath();
        ctx.arc(W / 2 + r * Math.cos(th), H / 2 + r * Math.sin(th), 0.8 + l.size * 0.5 * (0.3 + r / maxR), 0, 6.2832);
        ctx.fill();
    }
};

/** Stacked, rotated hypotrochoids (spirograph curves) whose pen offset slowly breathes. */
const mandala: Painter = (ctx, W, H, t, l, lut) => {
    const K = 3 + l.density * 2;
    const R = 5, r = 3, d = 3.5 + Math.sin(t * 0.18) * 1.5;
    const scale = (Math.min(W, H) * 0.46) / (R - r + d);
    ctx.lineWidth = 0.8 + l.size * 0.25;
    ctx.lineJoin = 'round';
    for (let k = 0; k < K; k++) {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate((k * 2 * Math.PI) / K / 2 + t * 0.06);
        const s = 1 - (k / K) * 0.55;
        ctx.strokeStyle = rgbAt(lut, k / K);
        ctx.beginPath();
        for (let i = 0; i <= 360; i++) {
            const a = (i / 360) * Math.PI * 6;
            const x = ((R - r) * Math.cos(a) + d * Math.cos(((R - r) / r) * a)) * scale * s;
            const y = ((R - r) * Math.sin(a) - d * Math.sin(((R - r) / r) * a)) * scale * s;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
    }
};

/** Layered hills: each ridge is a sum of three sines, tinted from far (color2) to near (color). */
const ridges: Painter = (ctx, W, H, t, l) => {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, l.color3);
    sky.addColorStop(1, mix(l.color3, '#ffffff', 0.45));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const N = l.density + 2;
    const r = rng(hashId(l.id));
    for (let i = 0; i < N; i++) {
        const f = N === 1 ? 1 : i / (N - 1);
        const base = H * (0.3 + 0.6 * f);
        const amp = H * (0.07 + 0.05 * (1 - f));
        const p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
        const k = 1 + r() * 0.8;
        ctx.fillStyle = mix(l.color2, l.color, f);
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W + 8; x += 8) {
            const u = (x / W) * k * 6.28;
            const y = base + amp * (0.5 * Math.sin(u * 0.9 + p1 + t * 0.12) + 0.3 * Math.sin(u * 1.9 + p2 - t * 0.09) + 0.2 * Math.sin(u * 3.7 + p3 + t * 0.15));
            ctx.lineTo(x, y);
        }
        ctx.lineTo(W + 8, H);
        ctx.closePath();
        ctx.fill();
    }
};

function mix(a: string, b: string, f: number): string {
    const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b);
    return `rgb(${Math.round(r1 + (r2 - r1) * f)} ${Math.round(g1 + (g2 - g1) * f)} ${Math.round(b1 + (b2 - b1) * f)})`;
}

/**
 * Truchet tiles: each square holds two quarter circles joining opposite edges, so any rotation
 * still meets its neighbours and the arcs form endless winding paths. Every tile turns 90 degrees
 * now and then, briefly breaking and re-forming the paths around it.
 */
const truchet: Painter = (ctx, W, H, t, l, lut) => {
    const cell = 26 + l.size * 9;
    const h = cell / 2;
    const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    const r = rng(hashId(l.id));
    ctx.lineWidth = 1 + l.density * 0.7;
    ctx.lineCap = 'round';
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            const u = t * 0.06 + r() * 40;
            const turn = (r() < 0.5 ? 0 : 1) + Math.floor(u) + smoothstep(0.82, 1, frac(u));
            const a = turn * Math.PI / 2, cs = Math.cos(a), sn = Math.sin(a);
            ctx.setTransform(cs, sn, -sn, cs, (i + 0.5) * cell, (j + 0.5) * cell);
            ctx.strokeStyle = rgbAt(lut, (i + j) / (cols + rows) + t * 0.015);
            ctx.beginPath();
            ctx.arc(-h, -h, h, 0, Math.PI / 2);
            ctx.moveTo(0, h);
            ctx.arc(h, h, h, Math.PI, Math.PI * 1.5);
            ctx.stroke();
        }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
};

/**
 * Harmonograph: a pen moved by two pendulums per axis, each a decaying sine
 * x(s) = e^(-ds) (sin(2s + p) + sin(3.01s + q)). Near-whole frequency ratios give the
 * looping figure; the slow phase drift makes it re-draw itself as it moves.
 */
const harmonograph: Painter = (ctx, W, H, t, l, lut) => {
    const S = 50 + l.density * 14; // how far the pendulums swing down
    const steps = Math.round(S * 22);
    const decay = 3 / S;
    const p = t * 0.05;
    const rx = W * 0.23, ry = H * 0.23;
    const at = (s: number): [number, number] => {
        const e = Math.exp(-decay * s);
        return [
            W / 2 + rx * e * (Math.sin(2 * s + p) + Math.sin(3.01 * s + 1.7)),
            H / 2 + ry * e * (Math.sin(3 * s + 0.5 + p * 0.7) + Math.sin(2.005 * s + 2.9)),
        ];
    };
    ctx.lineWidth = 0.5 + l.size * 0.2;
    ctx.lineJoin = 'round';
    const CHUNKS = 30; // one color per chunk, walking the palette along the trace
    let prev = at(0);
    for (let c = 0; c < CHUNKS; c++) {
        ctx.strokeStyle = rgbAt(lut, c / CHUNKS);
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        const end = Math.round(((c + 1) / CHUNKS) * steps);
        for (let i = Math.round((c / CHUNKS) * steps) + 1; i <= end; i++) {
            prev = at((i / steps) * S);
            ctx.lineTo(prev[0], prev[1]);
        }
        ctx.stroke();
    }
};

/**
 * 3D wave grid: a height field y = f(x, z) sampled on a grid and drawn with a pinhole camera
 * (screen = center + world * focal / depth). The camera moves forward through world z, so the
 * landscape itself stays put and rolls toward the viewer; far lines fade into the horizon.
 */
const terrain: Painter = (ctx, W, H, t, l, lut) => {
    const rows = 12 + l.density * 2, cols = 14 + l.density * 3;
    const dz = 0.5, zMax = rows * dz;
    const amp = 0.05 + l.size * 0.035;
    const horizon = H * 0.46, focal = H * 0.9, camY = 0.9;
    const X = ((W / 2) * zMax) / focal; // half-width that fills the screen at the far row
    const camZ = t * 0.5;
    const k0 = Math.floor(camZ / dz);
    const height = (x: number, z: number) => amp * (Math.sin(x * 1.1 + z * 0.7) * 0.6 + Math.sin(x * 0.45 - z * 1.3 + 1) * 0.4 + Math.sin(z * 0.35) * 0.5);
    const pts: [number, number][][] = [];
    const depth: number[] = [];
    for (let j = rows; j >= 1; j--) { // far to near
        const zw = (k0 + j) * dz;
        const zr = Math.max(0.05, zw - camZ); // the nearest row passes the camera; keep it off zero depth
        const row: [number, number][] = [];
        for (let i = 0; i <= cols; i++) {
            const x = -X + (2 * X * i) / cols;
            row.push([W / 2 + (x * focal) / zr, horizon + ((camY - height(x, zw)) * focal) / zr]);
        }
        pts.push(row);
        depth.push(zr);
    }
    ctx.lineWidth = 1 + l.size * 0.08;
    for (let r = 0; r < pts.length; r++) {
        const zr = depth[r];
        ctx.globalAlpha = smoothstep(0, dz * 1.5, zr) * (1 - zr / (zMax + dz)) ** 0.7;
        ctx.strokeStyle = rgbAt(lut, (zr / zMax) * 0.66); // near = color, through color2, far = color3
        ctx.beginPath();
        pts[r].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        // Lines toward the viewer, from this row to the next nearer one.
        if (r + 1 < pts.length) {
            for (let i = 0; i <= cols; i++) {
                ctx.moveTo(pts[r][i][0], pts[r][i][1]);
                ctx.lineTo(pts[r + 1][i][0], pts[r + 1][i][1]);
            }
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
};

// Floating shapes: convex solids, each a vertex list plus faces given as vertex indices.
type Vec = [number, number, number];
interface Solid { v: Vec[]; f: number[][] }

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec): Vec => { const m = Math.hypot(...a) || 1; return [a[0] / m, a[1] / m, a[2] / m]; };

/** Faces of a solid made of equilateral triangles: every vertex triple whose three sides are all the edge length. */
function triFaces(v: Vec[]): number[][] {
    const d = (a: number, b: number) => Math.hypot(...sub(v[a], v[b]));
    let edge = Infinity;
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) edge = Math.min(edge, d(i, j));
    const adj = (a: number, b: number) => Math.abs(d(a, b) - edge) < 1e-6;
    const f: number[][] = [];
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) for (let k = j + 1; k < v.length; k++)
        if (adj(i, j) && adj(j, k) && adj(i, k)) f.push([i, j, k]);
    return f;
}

/** Scales to a circumradius of 1 and winds each face so (b - a) x (c - a) points outward. */
function solid(v: Vec[], f: number[][]): Solid {
    const r = Math.max(...v.map((p) => Math.hypot(...p)));
    const s = v.map((p) => [p[0] / r, p[1] / r, p[2] / r] as Vec);
    return {
        v: s,
        f: f.map((face) => {
            const [a, b, c] = face.map((i) => s[i]);
            return dot(cross(sub(b, a), sub(c, a)), a) < 0 ? [...face].reverse() : face;
        }),
    };
}

const PHI = (1 + Math.sqrt(5)) / 2;
const TETRA: Vec[] = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
const OCTA: Vec[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const ICOSA: Vec[] = [];
for (const a of [-1, 1]) for (const b of [-PHI, PHI]) ICOSA.push([0, a, b], [a, b, 0], [b, 0, a]);
// Vertex i has x, y, z = +1 where bit 0, 1, 2 of i is set; each face lists its four corners in order around it.
const CUBE: Vec[] = Array.from({ length: 8 }, (_, i) => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
const CUBE_FACES = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]];

const SOLIDS: Solid[] = [
    solid(CUBE, CUBE_FACES),
    solid(TETRA, triFaces(TETRA)),
    solid(OCTA, triFaces(OCTA)),
    solid(ICOSA, triFaces(ICOSA)),
    // A tall crystal: the octahedron stretched along y (faces found before stretching, while its edges are equal).
    solid(OCTA.map(([x, y, z]) => [x * 0.62, y, z * 0.62] as Vec), triFaces(OCTA)),
];

/** Direction toward the light: upper left and in front (screen y points down, the camera looks along +z). */
const LIGHT = unit([-0.45, -0.75, -0.5]);

/**
 * Floating shapes: flat-shaded solids that spin on two axes and bob on a sine, seen through a
 * pinhole camera (screen = center + world * focal / depth). Faces turned away from the camera are
 * skipped and the shapes are drawn far to near, which is enough for convex solids that never touch.
 * Each face is lit by how directly it faces the light (Lambert), plus a small highlight; far shapes fade.
 */
const shapes: Painter = (ctx, W, H, t, l) => {
    const r = rng(hashId(l.id));
    const n = 3 + l.density;
    const focal = Math.min(W, H) * 1.15;
    const palette = [hexToRgb(l.color), hexToRgb(l.color2), hexToRgb(l.color3)];
    const Z0 = 3, Z1 = 9;
    const k0 = Math.floor(r() * SOLIDS.length);
    const items = Array.from({ length: n }, (_, i) => ({
        // One slot of the width each, so they spread out, at a random height and depth.
        u: (i + 0.15 + 0.7 * r()) / n,
        v: 0.14 + 0.72 * r(),
        z: Z0 + (Z1 - Z0) * r(),
        solid: SOLIDS[(i + k0) % SOLIDS.length],
        rad: (0.22 + l.size * 0.055) * (0.75 + 0.5 * r()),
        spinX: (0.3 + 0.6 * r()) * (r() < 0.5 ? -1 : 1),
        spinY: (0.4 + 0.7 * r()) * (r() < 0.5 ? -1 : 1),
        p1: r() * 6.28,
        p2: r() * 6.28,
        bobRate: 0.9 + 0.8 * r(),
        bobPhase: r() * 6.28,
        color: palette[i % 3],
    })).sort((a, b) => b.z - a.z);

    ctx.lineJoin = 'round';
    for (const s of items) {
        const ca = Math.cos(s.p1 + t * s.spinX), sa = Math.sin(s.p1 + t * s.spinX);
        const cb = Math.cos(s.p2 + t * s.spinY), sb = Math.sin(s.p2 + t * s.spinY);
        // Spin about y, then about x.
        const rot = s.solid.v.map(([x, y, z]): Vec => {
            const x1 = x * cb + z * sb, z1 = z * cb - x * sb;
            return [x1, y * ca - z1 * sa, y * sa + z1 * ca];
        });
        const cx = ((s.u - 0.5) * W * s.z) / focal;
        const cy = ((s.v - 0.5) * H * s.z) / focal + Math.sin(t * s.bobRate + s.bobPhase) * 0.3;
        const world = rot.map(([x, y, z]): Vec => [cx + x * s.rad, cy + y * s.rad, s.z + z * s.rad]);
        const screen = world.map(([x, y, z]) => [W / 2 + (x * focal) / z, H / 2 + (y * focal) / z]);

        ctx.globalAlpha = 1 - 0.55 * ((s.z - Z0) / (Z1 - Z0));
        ctx.lineWidth = Math.max(1, (s.rad * focal) / s.z / 80);
        for (const face of s.solid.f) {
            const [a, b, c] = face.map((i) => rot[i]);
            const nrm = unit(cross(sub(b, a), sub(c, a)));
            if (dot(nrm, world[face[0]]) >= 0) continue; // faces away from the camera
            const lam = Math.max(0, dot(nrm, LIGHT));
            const k = 0.45 + 0.6 * lam, spec = lam ** 12 * 0.45;
            const [R, G, B] = s.color.map((ch) => {
                const lit = ch * k;
                return Math.round(lit + (255 - lit) * spec);
            });
            ctx.fillStyle = `rgb(${R} ${G} ${B})`;
            // Edges a little lighter than the face; they also cover the seams between faces.
            ctx.strokeStyle = `rgb(${Math.round(R + (255 - R) * 0.35)} ${Math.round(G + (255 - G) * 0.35)} ${Math.round(B + (255 - B) * 0.35)})`;
            ctx.beginPath();
            face.forEach((i, j) => (j ? ctx.lineTo(screen[i][0], screen[i][1]) : ctx.moveTo(screen[i][0], screen[i][1])));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }
    ctx.globalAlpha = 1;
};

/** Stylized aquarium: fish on looping paths with wagging tails, rising bubbles, swaying weed. */
const aquarium: Painter = (ctx, W, H, t, l) => {
    const water = ctx.createLinearGradient(0, 0, 0, H);
    water.addColorStop(0, mix(l.color3, '#ffffff', 0.3));
    water.addColorStop(1, mix(l.color3, '#000000', 0.35));
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, W, H);

    // Light shafts from the surface.
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.07;
    for (let k = 0; k < 5; k++) {
        const x0 = W * (0.1 + 0.2 * k) + 40 * Math.sin(t * 0.25 + k * 1.7);
        ctx.beginPath();
        ctx.moveTo(x0 - 25, 0);
        ctx.lineTo(x0 + 25, 0);
        ctx.lineTo(x0 + 140, H);
        ctx.lineTo(x0 + 40, H);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    const r = rng(hashId(l.id));
    const sandTop = H * 0.9;
    // Weed: each strand is a polyline whose sideways sway grows toward the tip.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const strands = 5 + Math.floor(W / 180);
    for (let s = 0; s < strands; s++) {
        const bx = r() * W, tall = H * (0.18 + r() * 0.25), ph = r() * 6.28;
        ctx.strokeStyle = mix(l.color3, '#1f7a3a', 0.65 + r() * 0.3);
        ctx.lineWidth = 5 + r() * 4;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
            const f = i / 10;
            const x = bx + Math.sin(f * 3 + t * 0.9 + ph) * f * 22;
            const y = sandTop + 6 - f * tall;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
    }
    // Sand.
    ctx.fillStyle = mix(l.color3, '#f1dfae', 0.75);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, sandTop + 6 * Math.sin(x * 0.02));
    ctx.lineTo(W + 20, H);
    ctx.fill();

    // Fish swim across and wrap around; the bob and tail wag are sines.
    const n = 2 + l.density;
    for (let i = 0; i < n; i++) {
        const y0 = H * (0.12 + 0.65 * r()), dir = r() < 0.5 ? 1 : -1, spd = 25 + 35 * r();
        const len = (20 + l.size * 6) * (0.65 + 0.6 * r()), off = r() * 4000, ph = r() * 6.28;
        const span = W + len * 4;
        let x = ((off + t * spd) % span) - len * 2;
        if (dir < 0) x = W - x;
        const y = y0 + Math.sin(t * 0.6 + ph) * 16;
        drawFish(ctx, x, y, len, dir, Math.sin(t * 7 + ph), i % 3 === 2 ? mix(l.color, l.color2, 0.5) : i % 2 ? l.color2 : l.color);
    }

    // Bubbles rise and wobble.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
        const bx = r() * W, sp = 30 + 40 * r(), ry = r() * H, rad = 2 + 3 * r();
        const y = H - ((ry + t * sp) % (H + 20));
        ctx.beginPath();
        ctx.arc(bx + 5 * Math.sin(t * 2 + i), y, rad, 0, 6.2832);
        ctx.stroke();
    }
};

function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, dir: number, wag: number, color: string) {
    const h = len * 0.38;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = Math.max(1.5, len / 22);
    ctx.lineJoin = 'round';
    // Tail, then body over it.
    ctx.beginPath();
    ctx.moveTo(-len * 0.4, 0);
    ctx.lineTo(-len * 0.82, -h * 0.85 + wag * h * 0.35);
    ctx.lineTo(-len * 0.82, h * 0.85 + wag * h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, len * 0.5, h, 0, 0, 6.2832);
    ctx.fill();
    ctx.stroke();
    // Stripe and eye.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(len * 0.05, 0, h * 0.75, -1.1, 1.1);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(len * 0.26, -h * 0.2, h * 0.24, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(len * 0.29, -h * 0.2, h * 0.12, 0, 6.2832);
    ctx.fill();
    ctx.restore();
}

const PAINTERS: Partial<Record<BgLayer['type'], Painter>> = { spiral, mandala, ridges, truchet, harmonograph, terrain, shapes, aquarium };

// ── Canvas layer ─────────────────────────────────────────────────────────────

const REDUCED = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SHADER_W = 160;
// Slider speed N advances animation time at N / SPEED_DIVISOR per second. Applies to every layer,
// including saved themes, since most presets already sit at the slider's slowest non-zero step (1).
const SPEED_DIVISOR = 5;
const timeOf = new Map<string, number>(); // keeps animation phase when a slider restarts the loop

function MathCanvas({ layer }: { layer: BgLayer }) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        const box = canvas?.parentElement;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !box || !ctx) return;

        const shader = SHADERS[layer.type];
        const painter = PAINTERS[layer.type];
        const lut = makeLut(layer);
        let img: ImageData | null = null;
        let raf = 0;
        let last = 0;
        let t = timeOf.get(layer.id) ?? 0;

        const fit = () => {
            const w = Math.max(1, box.clientWidth), h = Math.max(1, box.clientHeight);
            // Shaders render ~160px wide and are smoothly scaled up; drawings use real size.
            const sw = SHADER_WIDTH[layer.type] ?? SHADER_W;
            const cw = shader ? sw : w;
            const ch = shader ? Math.max(1, Math.round((h / w) * sw)) : h;
            if (canvas.width !== cw || canvas.height !== ch) {
                canvas.width = cw;
                canvas.height = ch;
                img = null;
            }
        };

        const draw = () => {
            const started = performance.now();
            fit();
            const { width: W, height: H } = canvas;
            if (shader) {
                img ??= ctx.createImageData(W, H);
                shader(img.data, W, H, t, layer, lut);
                ctx.putImageData(img, 0, 0);
            } else if (painter) {
                ctx.clearRect(0, 0, W, H);
                painter(ctx, W, H, t, layer, lut);
            }
            // Adaptive throttle: keep the layer to ~10% of main-thread time so the app stays responsive.
            frameMs = Math.min(250, Math.max(baseMs, (performance.now() - started) * 10));
        };

        // Faster animation needs more frames or it strobes: 15/20 fps when slow, up to 30/40 fps at speed 10.
        const baseMs = 1000 / ((shader ? 15 : 20) * (1 + Math.min(10, layer.speed) / 10));
        let frameMs = baseMs;
        const tick = (now: number) => {
            raf = requestAnimationFrame(tick);
            if (now - last < frameMs) return;
            t += ((last ? now - last : frameMs) / 1000) * (layer.speed / SPEED_DIVISOR);
            last = now;
            draw();
        };

        draw();
        const still = layer.speed === 0 || REDUCED();
        if (!still) raf = requestAnimationFrame(tick);
        const ro = new ResizeObserver(() => draw());
        ro.observe(box);

        return () => {
            // A still copy (the editor's preview) reads the running phase but must not reset it.
            if (!still) timeOf.set(layer.id, t);
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    }, [layer]);

    return <canvas ref={ref} className="tbg-canvas" />;
}

// ── CSS-only layers ──────────────────────────────────────────────────────────

function patternBackground(l: BgLayer): CSSProperties {
    const s = 12 + l.size * 6; // px
    const c = l.color;
    switch (l.kind) {
        case 'dots':
            return { backgroundImage: `radial-gradient(${c} ${Math.max(1, l.size / 2)}px, transparent ${Math.max(1, l.size / 2) + 0.5}px)`, backgroundSize: `${s}px ${s}px` };
        case 'stripes':
            return { backgroundImage: `repeating-linear-gradient(${l.angle}deg, ${c} 0 ${s / 3}px, transparent ${s / 3}px ${s}px)` };
        case 'checker':
            return { backgroundImage: `conic-gradient(${c} 25%, transparent 0 50%, ${c} 0 75%, transparent 0)`, backgroundSize: `${s * 2}px ${s * 2}px` };
        case 'hatch':
            return { backgroundImage: `repeating-linear-gradient(${l.angle}deg, ${c} 0 2px, transparent 2px ${s}px), repeating-linear-gradient(${l.angle + 90}deg, ${c} 0 2px, transparent 2px ${s}px)` };
        default: // grid
            return { backgroundImage: `linear-gradient(${c} 2px, transparent 2px), linear-gradient(to right, ${c} 2px, transparent 2px)`, backgroundSize: `${s}px ${s}px` };
    }
}

function gradientBackground(l: BgLayer): CSSProperties {
    const stops = `${l.color}, ${l.color2}, ${l.color3}`;
    const image = l.kind === 'radial' ? `radial-gradient(circle at 50% 40%, ${stops})`
        : l.kind === 'conic' ? `conic-gradient(from ${l.angle}deg at 50% 50%, ${l.color}, ${l.color2}, ${l.color3}, ${l.color})`
            : `linear-gradient(${l.angle}deg, ${stops})`;
    return { backgroundImage: image };
}

function LayerView({ layer }: { layer: BgLayer }) {
    const opacity = layer.opacity / 100;
    if (layer.type === 'gradient') return <div className="tbg" style={{ opacity, ...gradientBackground(layer) }} />;
    if (layer.type === 'pattern') return <div className="tbg" style={{ opacity, ...patternBackground(layer) }} />;
    return (
        <div className="tbg" style={{ opacity }}>
            <MathCanvas layer={layer} />
        </div>
    );
}

/** The layer stack. `contained` fills its parent (editor preview) instead of the page. */
export function BackgroundLayers({ layers, contained }: { layers: BgLayer[]; contained?: boolean }) {
    return (
        <div className={`tbg-stack${contained ? ' tbg-stack--contained' : ''}`} aria-hidden="true">
            {layers.map((l) => <LayerView key={l.id} layer={l} />)}
        </div>
    );
}

/** The user's background inside a full panel (mind map), under its content. The panel must set `isolation: isolate`. */
export function PanelBackground() {
    const layers = useSyncExternalStore(subscribeLayers, getActiveLayers);
    if (!layers.length) return null;
    return (
        <div className="tbg-stack tbg-stack--contained tbg-stack--behind" aria-hidden="true">
            {layers.map((l) => <LayerView key={l.id} layer={l} />)}
        </div>
    );
}

/** Mount once on the app page: draws the active theme's layers behind everything. */
export default function ThemeBackgroundHost() {
    const layers = useSyncExternalStore(subscribeLayers, getActiveLayers);
    const active = layers.length > 0;
    // The touch UI paints its own opaque grid over the page; this flag lets it step aside.
    useEffect(() => {
        document.documentElement.classList.toggle('has-theme-bg', active);
        return () => document.documentElement.classList.remove('has-theme-bg');
    }, [active]);
    if (!active) return null;
    return createPortal(<BackgroundLayers layers={layers} />, document.body);
}
