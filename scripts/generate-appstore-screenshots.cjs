// Draws the App Store screenshots into assets/app-store/: five 6.9-inch iPhone
// images (1320x2868) in the app's neobrutal card style (colours from
// src/styles/variables.scss), plus the 1024px app icon copy.
// Run `node scripts/generate-appstore-screenshots.cjs`. `sharp` comes with @capacitor/assets.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const MINT = '#E9F9E5', INK = '#111111';
const ROOT = '#A3703E', LEAF = '#41BC28', SKY = '#00A9D8', LINK = '#E8E879', INDIGO = '#2049C5', DANGER = '#C80000';
const ORANGE = '#EC8A13', PINK = '#DB44A4', NEUTRAL = '#D3DED1', BURNT = '#CC5500';
const dir = path.join(__dirname, '..', 'assets', 'app-store');
const HEAVY = 'font-family="Arial Black, Arial, sans-serif"';
const BODY = 'font-family="Arial, sans-serif" font-weight="700"';
const MONO = 'font-family="Courier New, monospace" font-weight="700"';

const W = 1320, H = 2868;
const PX = 130, PY = 640, PW = 1060, PH = 2400;     // phone frame
const SX = PX + 14, SY = PY + 14, SW = PW - 28;     // screen origin and width

const text = (x, y, t, size, fill = INK, anchor = 'start', font = BODY) =>
  `<text x="${x}" y="${y + size * 0.35}" ${font} font-size="${size}" fill="${fill}" text-anchor="${anchor}">${t}</text>`;

function box(x, y, w, h, fill, inner = '', { rx = 14, sw = 6, off = 10 } = {}) {
  return `<rect x="${x + off}" y="${y + off}" width="${w}" height="${h}" rx="${rx}" fill="${INK}"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${INK}" stroke-width="${sw}"/>${inner}`;
}
const badge = (cx, cy, n) =>
  `<circle cx="${cx}" cy="${cy}" r="30" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>${text(cx, cy, n, 34, INK, 'middle')}`;
const chevron = (x, y) =>
  `<path d="M${x} ${y - 20} L${x + 20} ${y} L${x} ${y + 20}" stroke="${INK}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const ribbon = (x, y, c) =>
  `<path d="M${x} ${y} L${x + 54} ${y} L${x} ${y + 54}" fill="${c}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
const tick = (x, y) =>
  `<path d="M${x - 9} ${y} l7 8 l13 -17" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const arrowOut = (x, y) =>
  `<path d="M${x - 14} ${y + 14} L${x + 14} ${y - 14} M${x - 8} ${y - 14} L${x + 14} ${y - 14} L${x + 14} ${y + 8}" stroke="${INK}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

// A list row. kind: leaf | parent | link | checklist | note
function row(y, name, kind, { count, pri, x = 28, w = SW - 56, h = 150 } = {}) {
  const fill = { leaf: LEAF, parent: SKY, link: LINK, checklist: INDIGO, note: '#FFFFFF' }[kind];
  const fg = kind === 'checklist' ? '#FFFFFF' : INK;
  let inner = text(x + 52, y + h / 2, name, 52, fg);
  if (kind === 'parent') inner += badge(x + w - 110, y + h / 2, count) + chevron(x + w - 52, y + h / 2);
  if (kind === 'link') inner += arrowOut(x + w - 62, y + h / 2);
  if (pri) inner += ribbon(x, y, pri);
  return box(x, y, w, h, fill, inner);
}

function topBar(title, sub) {
  return `<rect x="0" y="0" width="${SW}" height="150" fill="${MINT}"/>
  <path d="M0 150 H${SW}" stroke="${INK}" stroke-width="6"/>
  <circle cx="80" cy="75" r="36" fill="${LINK}" stroke="${INK}" stroke-width="6"/>${text(80, 75, '?', 44, INK, 'middle')}
  ${text(SW / 2, 56, sub, 28, '#4A5A47', 'middle')}${text(SW / 2, 100, title + ' ▾', 48, INK, 'middle')}
  <circle cx="${SW - 80}" cy="75" r="36" fill="${PINK}" stroke="${INK}" stroke-width="6"/><circle cx="${SW - 80}" cy="64" r="11" fill="${INK}"/><path d="M${SW - 102} 96 Q${SW - 80} 70 ${SW - 58} 96" fill="${INK}"/>`;
}

function bottomBar() {
  const y = H - SY - 190;
  const item = (cx, label, active) => text(cx, y + 118, label, 34, active ? INK : '#8A978A', 'middle');
  return `<rect x="0" y="${y}" width="${SW}" height="190" fill="#FFFFFF"/><path d="M0 ${y} H${SW}" stroke="${INK}" stroke-width="6"/>
  ${item(130, 'Back', false)}${item(340, 'Home', false)}${item(550, 'Search', true)}
  ${box(790, y + 36, 130, 110, LEAF, text(855, y + 91, '+', 90, INK, 'middle'), { rx: 18, off: 8 })}`;
}

const dotsBg = (() => {
  const d = [];
  for (let gx = 22; gx < W; gx += 40) for (let gy = 22; gy < H; gy += 40) d.push(`<circle cx="${gx}" cy="${gy}" r="2.6" fill="#BFD9BA"/>`);
  return d.join('');
})();

function frame(headline1, headline2, tagText, tagFill, screen) {
  const tw = Math.min(1080, tagText.length * 30 + 90);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><clipPath id="scr"><rect x="${SX}" y="${SY}" width="${SW}" height="${PH - 28}" rx="92"/></clipPath></defs>
  <rect width="${W}" height="${H}" fill="${MINT}"/>${dotsBg}
  ${text(W / 2, 150, headline1, 112, INK, 'middle', HEAVY)}${text(W / 2, 285, headline2, 112, INK, 'middle', HEAVY)}
  <rect x="${W / 2 - tw / 2 + 9}" y="${389}" width="${tw}" height="82" fill="${INK}"/>
  <rect x="${W / 2 - tw / 2}" y="${380}" width="${tw}" height="82" fill="${tagFill}" stroke="${INK}" stroke-width="5"/>
  ${text(W / 2, 421, tagText, 40, INK, 'middle')}
  <rect x="${PX + 22}" y="${PY + 22}" width="${PW}" height="${PH}" rx="110" fill="${INK}"/>
  <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="110" fill="${INK}"/>
  <rect x="${SX}" y="${SY}" width="${SW}" height="${PH - 28}" rx="92" fill="${MINT}"/>
  <g clip-path="url(#scr)"><g transform="translate(${SX} ${SY})">${screen}</g></g>
  <rect x="${W / 2 - 100}" y="${SY + 20}" width="200" height="56" rx="28" fill="${INK}"/>
</svg>`;
}

const bgDots = () => {
  const d = [];
  for (let gx = 20; gx < SW; gx += 40) for (let gy = 160; gy < 2400; gy += 40) d.push(`<circle cx="${gx}" cy="${gy}" r="2.4" fill="#BFD9BA"/>`);
  return d.join('');
};

// 1. A level of the map.
const s1 = () => `${bgDots()}${topBar('Launch plan', 'in')}
  ${row(220, 'Product', 'parent', { count: 4 })}
  ${row(420, 'Marketing', 'parent', { count: 3, pri: DANGER })}
  ${row(620, 'Read the brief', 'link')}
  ${row(820, 'Write the pitch', 'leaf', { pri: ORANGE })}
  ${row(1020, 'Pricing ideas', 'leaf')}
  ${row(1220, 'Launch checklist', 'checklist')}
  ${row(1420, 'Press list', 'parent', { count: 6 })}
  ${row(1620, 'Name options', 'leaf')}
  ${bottomBar()}`;

// 2. The mind map sheet.
const s2 = () => {
  const lines = (a, list) => list.map((b) => `<path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`).join('');
  const R = [516, 800];
  const A = [250, 480], B = [790, 460], C = [250, 1130], D = [800, 1130];
  const A1 = [110, 300], A2 = [380, 270], D1 = [660, 1330], D2 = [900, 1370], B1 = [880, 640];
  const n = (p, w, h, fill, t, fg = INK, size = 40) => box(p[0] - w / 2, p[1] - h / 2, w, h, fill, text(p[0], p[1], t, size, fg, 'middle'), { sw: 6, off: 8 });
  return `${bgDots()}${topBar('Mind map', 'Launch plan')}
  <g>${lines(R, [A, B, C, D])}${lines(A, [A1, A2])}${lines(D, [D1, D2])}${lines(B, [B1])}</g>
  ${n(R, 290, 120, ROOT, 'Launch plan', '#FFFFFF', 46)}
  ${n(A, 230, 100, SKY, 'Product')}${n(B, 270, 100, SKY, 'Marketing')}
  ${n(C, 280, 100, INDIGO, 'Checklist', '#FFFFFF')}${n(D, 230, 100, LINK, 'Brief')}
  ${n(A1, 170, 80, LEAF, 'Specs', INK, 34)}${n(A2, 190, 80, LEAF, 'Design', INK, 34)}
  ${n(D1, 180, 80, LEAF, 'Quotes', INK, 34)}${n(D2, 170, 80, LEAF, 'Stats', INK, 34)}${n(B1, 210, 80, LEAF, 'Socials', INK, 34)}
  ${bottomBar()}`;
};

// 3. The Create sheet.
const s3 = () => {
  const sy = 740, sh = 2400 - 28 - sy;
  const tabs = ['Idea', 'Checklist', 'Note'].map((t, i) => {
    const x = 60 + i * 300;
    return box(x, sy + 150, 270, 100, i === 0 ? LEAF : '#FFFFFF', text(x + 135, sy + 200, t, 42, INK, 'middle'), { rx: 14, off: 8 });
  }).join('');
  const chips = [['High', DANGER, '#FFFFFF'], ['Med', ORANGE, INK], ['Low', LINK, INK], ['None', '#FFFFFF', INK]].map(([t, f, fg], i) => {
    const x = 60 + i * 235;
    return box(x, sy + 640, 210, 96, f, text(x + 105, sy + 688, t, 38, fg, 'middle'), { rx: 14, off: 7 });
  }).join('');
  return `${bgDots()}${topBar('Launch plan', 'in')}
  ${row(220, 'Product', 'parent', { count: 4 })}${row(420, 'Marketing', 'parent', { count: 3 })}${row(620, 'Read the brief', 'link')}
  <rect x="0" y="150" width="${SW}" height="${2400}" fill="#111111" opacity="0.45"/>
  <rect x="0" y="${sy}" width="${SW}" height="${sh}" rx="50" fill="#FFFFFF" stroke="${INK}" stroke-width="8"/>
  <rect x="${SW / 2 - 70}" y="${sy + 28}" width="140" height="14" rx="7" fill="${NEUTRAL}"/>
  ${text(60, sy + 100, 'New idea', 56)}
  ${tabs}
  <rect x="60" y="${sy + 290}" width="${SW - 120}" height="260" rx="14" fill="${MINT}" stroke="${INK}" stroke-width="6"/>
  ${text(96, sy + 350, 'Record a 30 second demo', 48)}<rect x="96" y="${sy + 400}" width="6" height="56" fill="${INK}"/>
  ${text(60, sy + 600, 'Priority', 36, '#4A5A47')}
  ${chips}
  ${box(60, sy + 800, SW - 120, 120, LEAF, text(SW / 2, sy + 860, 'Create', 52, INK, 'middle'), { rx: 16, off: 9 })}`;
};

// 4. Checklist and note cards.
const s4 = () => {
  const items = [['Draft the announcement', true], ['Book the screenshots', true], ['Email the beta list', false], ['Post to the forum', false]];
  const cy = 220;
  const rows = items.map(([t, done], i) => {
    const ry = cy + 150 + i * 105;
    return `<rect x="70" y="${ry - 32}" width="64" height="64" rx="10" fill="${done ? LEAF : '#FFFFFF'}" stroke="${INK}" stroke-width="6"/>${done ? tick(102, ry) : ''}
      ${text(166, ry, t, 44, '#FFFFFF')}${done ? `<path d="M166 ${ry} H${166 + t.length * 24}" stroke="#FFFFFF" stroke-width="5" opacity="0.8"/>` : ''}`;
  }).join('');
  const checklist = box(28, cy, SW - 56, 640,
    INDIGO, text(70, cy + 65, 'Launch checklist', 52, '#FFFFFF') + `<path d="M50 ${cy + 110} H${SW - 78}" stroke="#FFFFFF" stroke-width="4" opacity="0.5"/>` + rows +
    box(70, cy + 560, 290, 56, '#FFFFFF', text(215, cy + 588, '+ Add item', 32, INK, 'middle'), { rx: 10, sw: 4, off: 5 }));
  const ny = 920;
  const note = box(28, ny, SW - 56, 560, '#FFFFFF',
    `<rect x="28" y="${ny}" width="${SW - 56}" height="96" rx="14" fill="${ORANGE}" stroke="${INK}" stroke-width="6"/>` + text(70, ny + 48, 'Pitch notes', 46) +
    `${text(70, ny + 170, 'One map for the whole plan.', 40, INK, 'start', MONO)}${text(70, ny + 235, 'Start with the big idea,', 40, INK, 'start', MONO)}
     ${text(70, ny + 300, 'then zoom into each part.', 40, INK, 'start', MONO)}${text(70, ny + 400, 'Keep it short. Keep it bright.', 40, INK, 'start', MONO)}`);
  return `${bgDots()}${topBar('Launch plan', 'in')}${checklist}${note}${row(1580, 'Pricing ideas', 'leaf', { pri: DANGER })}${bottomBar()}`;
};

// 5. Dragging an idea.
const s5 = () => `${bgDots()}${topBar('Product', 'in Launch plan')}
  ${box(28, 190, SW - 56, 120, LINK, text(SW / 2, 250, '↑ Move to parent', 46, INK, 'middle'), { rx: 14, sw: 6, off: 8 })}
  ${row(380, 'Specs', 'leaf')}
  ${row(580, 'Design', 'parent', { count: 2 })}
  ${row(780, 'Roadmap', 'leaf')}
  <g transform="rotate(-4 400 1100)">${row(1040, 'Release notes', 'leaf', { x: 90, w: SW - 200 })}</g>
  <circle cx="860" cy="1150" r="46" fill="${INK}" opacity="0.18"/>
  ${row(1300, 'Open questions', 'leaf')}
  ${row(1500, 'Support docs', 'parent', { count: 5 })}
  ${bottomBar()}`;

const shots = [
  ['01-branch-ideas', 'Branch every', 'idea', 'Start with one idea, keep going', LEAF, s1],
  ['02-mind-map', 'See the whole', 'map', 'Your ideas as a mind map', SKY, s2],
  ['03-capture', 'Capture in', 'seconds', 'Ideas, checklists and notes', LINK, s3],
  ['04-checklists', 'Checklists and', 'notes', 'Tick things off as you go', INDIGO, s4],
  ['05-reorganize', 'Drag to', 'reorganize', 'Hold, drag and drop to move', ORANGE, s5],
];

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, a, b, tag, fill, screen] of shots) {
    const tagFg = fill === INDIGO ? '#FFFFFF' : INK;
    let svg = frame(a, b, tag, fill, screen());
    if (tagFg !== INK) svg = svg.replace(`>${tag}</text>`, ` fill-opacity="1">${tag}</text>`).replace(new RegExp(`(<text[^>]*?)fill="${INK}"([^>]*>${tag}</text>)`), `$1fill="${tagFg}"$2`);
    await sharp(Buffer.from(svg)).png().toFile(path.join(dir, `${name}-1320x2868.png`));
  }
  await sharp(path.join(__dirname, '..', 'assets', 'icon-only.png')).resize(1024, 1024).flatten({ background: MINT }).png().toFile(path.join(dir, 'app-icon-1024.png'));
})();
