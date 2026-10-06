// Generates the animated SVGs used by README.md.  Run: node docs/readme/build.cjs
// Pure SVG + CSS keyframes (no JS, no external fonts) so GitHub renders them inside <img>.
const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const C = {
  bg: '#E9F9E5', neutral: '#D3DED1', sky: '#00A9D8', leaf: '#41BC28', link: '#E8E879',
  indigo: '#2049C5', danger: '#C80000', pink: '#DB44A4', orange: '#EC8A13',
  burnt: '#CC5500', deepYellow: '#D4A000', white: '#FFFFFF', ink: '#000000',
};

class Doc {
  constructor(w, h, D, title) {
    this.w = w; this.h = h; this.D = D; this.title = title;
    this.css = []; this.n = 0; this.defs = '';
  }
  pct(t) { return +((t / this.D) * 100).toFixed(3); }
  // Wrap `inner` in a <g> animated by keyframe steps [[seconds, 'css'], ...].
  g(steps, inner, extra = '') {
    steps = steps.map(([t, s]) => [Math.max(0, Math.min(this.D, t)), s]).sort((a, b) => a[0] - b[0]);
    if (steps[0][0] > 0) steps.unshift([0, steps[0][1]]);
    if (steps[steps.length - 1][0] < this.D) steps.push([this.D, steps[steps.length - 1][1]]);
    const name = 'k' + ++this.n;
    this.css.push(`@keyframes ${name}{${steps.map(([t, s]) => `${this.pct(t)}%{${s}}`).join('')}}`);
    this.css.push(`.${name}{transform-box:fill-box;transform-origin:center;animation:${name} ${this.D}s ease-in-out infinite;${extra}}`);
    return `<g class="${name}">${inner}</g>`;
  }
  // Pop in at t0, hold, vanish at t1.
  pop(t0, t1, inner) {
    const hide = 'opacity:0;transform:scale(.6)';
    return this.g([
      [0, hide], [t0, hide],
      [t0 + 0.35, 'opacity:1;transform:scale(1.08)'], [t0 + 0.55, 'opacity:1;transform:scale(1)'],
      [t1, 'opacity:1;transform:scale(1)'], [t1 + 0.3, 'opacity:0;transform:scale(.9)'],
    ], inner);
  }
  // Fade in at t0, out at t1 (no scaling).
  fade(t0, t1, inner) {
    return this.g([
      [0, 'opacity:0'], [t0, 'opacity:0'], [t0 + 0.25, 'opacity:1'], [t1, 'opacity:1'], [t1 + 0.25, 'opacity:0'],
    ], inner);
  }
  svg(body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" role="img" aria-label="${this.title}">
<title>${this.title}</title>
<defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.6" fill="${C.neutral}"/></pattern>${this.defs}</defs>
<style>
text{font-family:'Segoe UI',system-ui,-apple-system,Helvetica,Arial,sans-serif;font-weight:700;dominant-baseline:central}
.bob{animation:bob 3s ease-in-out infinite alternate}
@keyframes bob{to{transform:translateY(-4px)}}
${this.css.join('\n')}
</style>
${body}
</svg>
`;
  }
}

const T = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" font-size="${o.size || 22}" fill="${o.fill || C.ink}" text-anchor="${o.anchor || 'middle'}"${o.weight ? ` font-weight="${o.weight}"` : ''}>${s}</text>`;

function node(x, y, w, h, fill, label, o = {}) {
  const tc = o.text || C.ink;
  return `<g><rect x="${x + 5}" y="${y + 5}" width="${w}" height="${h}" rx="12" fill="${C.ink}"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${C.ink}" stroke-width="3"/>` +
    (label ? T(x + w / 2, y + h / 2 + (o.dy !== undefined ? o.dy : o.sub ? -10 : 0), label, { size: o.size || 24, fill: tc }) : '') +
    (o.sub ? T(x + w / 2, y + h / 2 + 19, o.sub, { size: 14, fill: tc, weight: 600 }) : '') +
    `</g>`;
}

function windowFrame(d, titleLeft) {
  return `<rect width="${d.w}" height="${d.h}" rx="18" fill="${C.bg}"/>` +
    `<rect x="46" y="30" width="720" height="372" rx="14" fill="${C.ink}"/>` +
    `<rect x="40" y="24" width="720" height="372" rx="14" fill="${C.bg}"/>` +
    `<rect x="40" y="80" width="720" height="316" rx="14" fill="url(#dots)"/>` +
    `<rect x="40" y="24" width="720" height="56" rx="14" fill="${C.white}"/><rect x="40" y="60" width="720" height="20" fill="${C.white}"/>` +
    `<rect x="40" y="24" width="720" height="372" rx="14" fill="none" stroke="${C.ink}" stroke-width="4"/>` +
    `<line x1="40" y1="80" x2="760" y2="80" stroke="${C.ink}" stroke-width="3"/>` + (titleLeft || '');
}

const CURSOR = `<path d="M0 0 L0 22 L6 17 L10 26 L14 24 L10 15 L18 15 Z" fill="${C.white}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>`;
const tr = (x, y) => `transform:translate(${x}px,${y}px)`;
const dragTr = (x, y, r, s) => `transform:translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;

/* ------------------------------------------------------------------ hero */
function hero() {
  const d = new Doc(900, 340, 9, 'Intraconnected: a node-based mind map that grows as you add ideas');
  const root = [700, 170];
  const kids = [
    { x: 590, y: 78, c: C.sky, l: 'Travel', t0: 1.0 },
    { x: 810, y: 78, c: C.sky, l: 'Work', t0: 1.2 },
    { x: 590, y: 262, c: C.link, l: 'Reading', t0: 1.4 },
    { x: 810, y: 262, c: C.indigo, l: 'Packing', t0: 1.6, text: C.white },
    { x: 700, y: 30, c: C.leaf, l: 'New idea', t0: 3.4, w: 110 },
  ];
  const END = 8.1;
  let lines = '', nodes = '';
  kids.forEach((k, i) => {
    const len = Math.hypot(k.x - root[0], k.y - root[1]).toFixed(1);
    const step = (t, off, op) => [t, `stroke-dashoffset:${off};opacity:${op}`];
    lines += d.g([
      step(0, len, 1), step(k.t0 - 0.3, len, 1), step(k.t0 + 0.3, 0, 1), step(END, 0, 1), step(END + 0.3, 0, 0),
    ], `<line x1="${root[0]}" y1="${root[1]}" x2="${k.x}" y2="${k.y}" stroke="${C.ink}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${len}"/>`);
    const w = k.w || 104;
    nodes += d.pop(k.t0, END, `<g class="bob" style="animation-delay:-${i * 0.7}s">${node(k.x - w / 2, k.y - 22, w, 44, k.c, k.l, { size: 18, text: k.text })}</g>`);
  });
  const rootNode = d.pop(0.3, END, `<g class="bob">${node(root[0] - 60, root[1] - 27, 120, 54, C.pink, 'Ideas', { size: 24, text: C.white })}</g>`);

  const chip = (x, w, fill, label, t, text) => d.pop(t, END, node(x, 256, w, 36, fill, label, { size: 16, text }));
  const chips = chip(46, 110, C.sky, 'Mind map', 0.6) + chip(172, 120, C.indigo, 'Checklists', 0.9, C.white) + chip(308, 80, C.leaf, 'Notes', 1.2);

  const body =
    `<rect width="900" height="340" rx="18" fill="${C.bg}"/><rect width="900" height="340" rx="18" fill="url(#dots)"/>` +
    `<rect x="2" y="2" width="896" height="336" rx="16" fill="none" stroke="${C.ink}" stroke-width="4"/>` +
    `<text x="48" y="124" font-size="52" font-weight="800" fill="${C.ink}" text-anchor="start">Intraconnected</text>` +
    `<text x="44" y="120" font-size="52" font-weight="800" fill="${C.sky}" text-anchor="start">Intraconnected</text>` +
    T(46, 176, 'Map your thinking as a tree of ideas.', { size: 19, anchor: 'start', weight: 600 }) +
    T(46, 208, 'Zoom in. Drag to reorganize. Repeat.', { size: 19, anchor: 'start', weight: 600 }) +
    lines + rootNode + nodes + chips;
  fs.writeFileSync(path.join(OUT, 'hero.svg'), d.svg(body));
}

/* ------------------------------------------------------------------ zoom */
function zoom() {
  const d = new Doc(800, 420, 10, 'Clicking a node zooms into it, and Home takes you back out');
  const label = (txt, home) =>
    `<rect x="60" y="38" width="104" height="34" rx="8" fill="${home ? C.burnt : C.neutral}" stroke="${C.ink}" stroke-width="3"/>` +
    T(112, 55, 'Home', { size: 17, fill: home ? C.white : '#7a857a' }) + txt;
  const labelA = d.g([[0, 'opacity:1'], [2.9, 'opacity:1'], [3.3, 'opacity:0'], [6.9, 'opacity:0'], [7.3, 'opacity:1']],
    label(T(190, 55, 'Ideas', { size: 24, anchor: 'start' }), false));
  const labelB = d.g([[0, 'opacity:0'], [2.9, 'opacity:0'], [3.3, 'opacity:1'], [6.5, 'opacity:1'], [6.9, 'opacity:0']],
    label(T(190, 55, 'Ideas  ›  <tspan fill="#00789a">Travel</tspan>', { size: 24, anchor: 'start' }), true));

  const A = d.g(
    [[0, 'opacity:1;transform:scale(1)'], [2.9, 'opacity:1;transform:scale(1)'], [3.4, 'opacity:0;transform:scale(1.3)'],
     [6.9, 'opacity:0;transform:scale(.8)'], [7.4, 'opacity:1;transform:scale(1)']],
    node(80, 120, 280, 90, C.sky, 'Travel', { sub: '3 ideas' }) + node(440, 120, 280, 90, C.sky, 'Work', { sub: '5 ideas' }) +
    node(80, 250, 280, 90, C.link, 'Reading list') + node(440, 250, 280, 90, C.leaf, 'Buy milk'));

  const bKids = [
    node(70, 160, 190, 90, C.sky, 'Japan', { sub: '2 ideas' }),
    node(305, 160, 190, 90, C.leaf, 'Book flights'),
    node(540, 160, 190, 90, C.indigo, 'Packing', { text: C.white }),
  ];
  const B = d.g(
    [[0, 'opacity:0;transform:scale(.7)'], [3.0, 'opacity:0;transform:scale(.7)'], [3.5, 'opacity:1;transform:scale(1)'],
     [6.4, 'opacity:1;transform:scale(1)'], [6.9, 'opacity:0;transform:scale(.7)']],
    bKids.map((k, i) => d.pop(3.3 + i * 0.15, 6.3, k)).join(''));

  const ring = d.g([[0, 'opacity:0'], [2.4, 'opacity:0'], [2.5, 'opacity:1'], [3.0, 'opacity:0'], [5.9, 'opacity:0'], [6.0, 'opacity:1'], [6.5, 'opacity:0']],
    `<circle cx="0" cy="0" r="20" fill="none" stroke="${C.pink}" stroke-width="5"/>`);
  const cursor = d.g([
    [0, tr(620, 360)], [2.0, tr(220, 175)], [3.1, tr(220, 175)], [5.5, tr(116, 58)], [6.6, tr(116, 58)], [9.3, tr(620, 360)],
  ], ring + CURSOR);

  fs.writeFileSync(path.join(OUT, 'zoom.svg'), d.svg(windowFrame(d) + labelA + labelB + A + B + cursor));
}

/* ------------------------------------------------------------------ drag */
function drag() {
  const d = new Doc(800, 420, 9.5, 'Drag a node onto another to move it, or onto the trash to delete it');
  const title = T(64, 52, 'Ideas', { size: 24, anchor: 'start' });

  const cooking = node(480, 120, 240, 90, C.sky, 'Cooking', { dy: -18 }) +
    d.g([[0, 'opacity:1'], [3.0, 'opacity:1'], [3.1, 'opacity:0'], [8.6, 'opacity:0'], [8.9, 'opacity:1']], T(600, 190, '2 ideas', { size: 14, weight: 600 })) +
    d.g([[0, 'opacity:0'], [3.0, 'opacity:0'], [3.1, 'opacity:1'], [8.6, 'opacity:1'], [8.9, 'opacity:0']], T(600, 190, '3 ideas', { size: 14, weight: 600 }));
  const cookingRing = d.g([[0, 'opacity:0'], [1.7, 'opacity:0'], [2.0, 'opacity:1'], [3.0, 'opacity:1'], [3.3, 'opacity:0']],
    `<rect x="472" y="112" width="256" height="106" rx="16" fill="none" stroke="${C.pink}" stroke-width="6" stroke-dasharray="14 8"/>`);

  const bin = `<g transform="translate(582 310)" fill="none" stroke="${C.white}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">` +
    `<path d="M-16 -22 H16 M-6 -28 H6 V-22 M-12 -14 L-10 18 H10 L12 -14 Z"/></g>`;
  const trash = d.g([[0, 'transform:scale(1)'], [5.9, 'transform:scale(1)'], [6.1, 'transform:scale(1.1)'], [6.4, 'transform:scale(1)']],
    node(540, 260, 190, 100, C.danger, '') + bin + T(614, 310, 'Delete', { size: 24, anchor: 'start', fill: C.white }));
  const trashRing = d.g([[0, 'opacity:0'], [4.9, 'opacity:0'], [5.2, 'opacity:1'], [6.0, 'opacity:1'], [6.3, 'opacity:0']],
    `<rect x="532" y="252" width="206" height="116" rx="16" fill="none" stroke="${C.ink}" stroke-width="5" stroke-dasharray="14 8"/>`);

  const hidden = (x, y) => `${dragTr(x, y, 0, 0.1)};opacity:0`;
  const recipes = d.g([
    [0, `${dragTr(0, 0, 0, 1)};opacity:1`], [1.0, `${dragTr(0, 0, 0, 1)};opacity:1`],
    [1.15, `${dragTr(0, 0, -3, 0.72)};opacity:1`], [2.7, `${dragTr(440, 40, -3, 0.72)};opacity:1`],
    [3.1, hidden(440, 40)], [8.6, hidden(440, 40)], [8.7, hidden(0, 0)], [9.2, `${dragTr(0, 0, 0, 1)};opacity:1`],
  ], node(80, 120, 240, 80, C.leaf, 'Recipes'));
  const oldDraft = d.g([
    [0, `${dragTr(0, 0, 0, 1)};opacity:1`], [4.0, `${dragTr(0, 0, 0, 1)};opacity:1`],
    [4.15, `${dragTr(0, 0, 3, 0.72)};opacity:1`], [5.7, `${dragTr(440, 30, 3, 0.72)};opacity:1`],
    [6.1, hidden(440, 30)], [8.6, hidden(440, 30)], [8.7, hidden(0, 0)], [9.2, `${dragTr(0, 0, 0, 1)};opacity:1`],
  ], node(80, 250, 240, 80, C.link, 'Old draft'));

  const ring = d.g([[0, 'opacity:0'], [1.05, 'opacity:0'], [1.15, 'opacity:1'], [3.0, 'opacity:1'], [3.1, 'opacity:0'],
    [4.05, 'opacity:0'], [4.15, 'opacity:1'], [6.0, 'opacity:1'], [6.1, 'opacity:0']],
    `<circle cx="0" cy="0" r="20" fill="none" stroke="${C.pink}" stroke-width="5"/>`);
  const cursor = d.g([
    [0, tr(430, 385)], [0.9, tr(200, 160)], [1.1, tr(200, 160)], [2.7, tr(640, 200)], [3.1, tr(640, 200)],
    [3.9, tr(200, 290)], [4.1, tr(200, 290)], [5.7, tr(640, 320)], [6.1, tr(640, 320)], [7.0, tr(720, 390)], [9.5, tr(430, 385)],
  ], ring + CURSOR);

  fs.writeFileSync(path.join(OUT, 'drag.svg'),
    d.svg(windowFrame(d, title) + cooking + cookingRing + trash + trashRing + oldDraft + recipes + cursor));
}

/* ----------------------------------------------------------------- types */
function types() {
  const D = 9;
  const d = new Doc(800, 420, D, 'Four kinds of nodes: ideas, parents, links and checklists, with priority tags');
  const title = T(64, 52, 'Node types', { size: 24, anchor: 'start' });
  const END = 8.2, Y = 130, W = 140, H = 140;
  const xs = [75, 245, 415, 585];
  const cap = (i, a, b) => T(xs[i] + W / 2, 297, a, { size: 17 }) + T(xs[i] + W / 2, 320, b, { size: 14, weight: 600, fill: '#3d473b' });
  const tag = (x, y, fill, txt, tc) => `<rect x="${x}" y="${y}" width="40" height="24" rx="6" fill="${fill}" stroke="${C.ink}" stroke-width="3"/>` + T(x + 20, y + 12, txt, { size: 13, fill: tc });

  const n1 = node(xs[0], Y, W, H, C.leaf, 'Idea');
  const n2 = node(xs[1], Y, W, H, C.sky, 'Project', { sub: '3 ideas' });
  const n3 = node(xs[2], Y, W, H, C.link, 'Docs') + T(xs[2] + W - 22, Y + 24, '↗', { size: 22 });

  const rows = ['Passport', 'Charger', 'Tickets'];
  const ticks = rows.map((r, i) => {
    const ry = Y + 66 + i * 26, tx = xs[3] + 20;
    return `<rect x="${tx}" y="${ry - 9}" width="18" height="18" rx="4" fill="${C.white}" stroke="${C.ink}" stroke-width="2.5"/>` +
      d.g([[0, 'opacity:0'], [4.4 + i * 0.8, 'opacity:0'], [4.65 + i * 0.8, 'opacity:1'], [END, 'opacity:1'], [END + 0.3, 'opacity:0']],
        `<path d="M${tx + 4} ${ry} l4 4 l7 -9" fill="none" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`) +
      T(tx + 28, ry, r, { size: 15, anchor: 'start', fill: C.white });
  }).join('');
  const n4 = node(xs[3], Y, W, H, C.indigo, '', {}) + T(xs[3] + W / 2, Y + 30, 'Packing', { size: 22, fill: C.white }) + ticks;

  const slide = (t0, inner) => d.g([[0, 'opacity:0;transform:translateY(-10px)'], [t0, 'opacity:0;transform:translateY(-10px)'], [t0 + 0.35, 'opacity:1;transform:translateY(0)'],
    [END, 'opacity:1;transform:translateY(0)'], [END + 0.3, 'opacity:0;transform:translateY(0)']], inner);

  const body = windowFrame(d, title) +
    d.pop(0.5, END, n1 + cap(0, 'Idea', 'a single thought')) +
    d.pop(1.0, END, n2 + cap(1, 'Parent', 'click to zoom in')) +
    d.pop(1.5, END, n3 + cap(2, 'Link', 'opens a URL')) +
    d.pop(2.0, END, n4 + cap(3, 'Checklist', 'tick things off')) +
    slide(3.0, tag(xs[0] - 10, Y - 12, C.danger, 'P1', C.white)) +
    slide(3.4, tag(xs[1] - 10, Y - 12, C.orange, 'P2', C.ink)) +
    slide(3.8, tag(xs[2] - 10, Y - 12, C.deepYellow, 'P3', C.ink));
  fs.writeFileSync(path.join(OUT, 'types.svg'), d.svg(body));
}

hero(); zoom(); drag(); types();
console.log('wrote', fs.readdirSync(OUT).filter((f) => f.endsWith('.svg')).join(', '));
