// Draws the Google Play graphics into assets/play-store/: the 512px app icon
// (from assets/icon-only.png) and the 1024x500 feature graphic, a small zoomable
// mind map in the app's card style (colours from src/styles/variables.scss).
// Run `node scripts/generate-play-graphics.cjs`. `sharp` comes with @capacitor/assets.
const sharp = require('sharp');
const path = require('path');

const MINT = '#E9F9E5', INK = '#111111', MUTED = '#4A5A47';
const ROOT = '#A3703E', LEAF = '#41BC28', SKY = '#00A9D8', LINK = '#E8E879', INDIGO = '#2049C5', DANGER = '#C80000';
const out = (n) => path.join(__dirname, '..', 'assets', 'play-store', n);
const HEAVY = "font-family=\"Arial Black, Arial, sans-serif\"";
const BODY = "font-family=\"Arial, sans-serif\" font-weight=\"700\"";

// A card with the app's hard shadow. (x, y) is the centre.
function card(x, y, w, h, fill, inner) {
  const l = x - w / 2, t = y - h / 2;
  return `<rect x="${l + 7}" y="${t + 7}" width="${w}" height="${h}" rx="6" fill="${INK}"/>
  <rect x="${l}" y="${t}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${INK}" stroke-width="4"/>${inner}`;
}
const label = (x, y, text, size, fill = INK) =>
  `<text x="${x}" y="${y + size * 0.35}" ${BODY} font-size="${size}" fill="${fill}" text-anchor="middle">${text}</text>`;
const line = (x1, y1, x2, y2) =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${INK}" stroke-width="6" stroke-linecap="round" fill="none"/>`;

const R = { x: 740, y: 250 };
const kids = [
  { x: 610, y: 95 },   // leaf
  { x: 880, y: 105 },  // link
  { x: 600, y: 405 },  // checklist
  { x: 880, y: 352 },  // parent with a child
];

function featureSvg() {
  // Dot grid like the app's background.
  const dots = [];
  for (let gx = 20; gx < 1024; gx += 32) for (let gy = 20; gy < 500; gy += 32) dots.push(`<circle cx="${gx}" cy="${gy}" r="2.2" fill="#BFD9BA"/>`);

  const lines = [
    line(R.x, R.y, kids[0].x, kids[0].y), line(R.x, R.y, kids[1].x, kids[1].y),
    line(R.x, R.y, kids[2].x, kids[2].y), line(R.x, R.y, kids[3].x, kids[3].y),
    line(kids[3].x, kids[3].y, 905, 440),
  ].join('');

  const root = card(R.x, R.y, 190, 78, ROOT, label(R.x, R.y, 'My big idea', 27, '#FFFFFF'));
  const leaf = card(kids[0].x, kids[0].y, 150, 60, LEAF, label(kids[0].x, kids[0].y, 'Sketch it', 25));
  const link = card(kids[1].x, kids[1].y, 170, 60, LINK, label(kids[1].x - 12, kids[1].y, 'Read this', 25) +
    `<path d="M${kids[1].x + 52} ${kids[1].y + 9} L${kids[1].x + 70} ${kids[1].y - 9} M${kids[1].x + 56} ${kids[1].y - 9} L${kids[1].x + 70} ${kids[1].y - 9} L${kids[1].x + 70} ${kids[1].y + 5}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  // Checklist: indigo, three rows, first ticked.
  const cx = kids[2].x, cy = kids[2].y;
  const rows = [0, 1, 2].map((i) => {
    const ry = cy - 25 + i * 25;
    const box = `<rect x="${cx - 66}" y="${ry - 9}" width="18" height="18" rx="3" fill="${i === 0 ? LEAF : '#FFFFFF'}" stroke="${INK}" stroke-width="3"/>` +
      (i === 0 ? `<path d="M${cx - 62} ${ry} l4 4 l8 -9" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : '');
    return box + `<rect x="${cx - 38}" y="${ry - 3}" width="${[88, 70, 80][i]}" height="6" rx="3" fill="#FFFFFF" opacity="0.85"/>`;
  }).join('');
  const checklist = card(cx, cy, 176, 100, INDIGO, rows);
  // Parent card with a child count and a priority ribbon.
  const px = kids[3].x, py = kids[3].y;
  const parent = card(px, py, 160, 64, SKY, label(px - 10, py, 'Plan', 26) +
    `<circle cx="${px + 50}" cy="${py}" r="15" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/>${label(px + 50, py, '3', 20)}`) +
    `<path d="M${px - 80} ${py - 32} L${px - 48} ${py - 32} L${px - 80} ${py}" fill="${DANGER}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  const child = card(905, 440, 104, 42, LEAF, label(905, 440, 'Step 1', 20));

  // Left: wordmark and the zoom idea. 
  const markTile = `<rect x="57" y="127" width="92" height="92" rx="20" fill="${INK}"/><rect x="50" y="120" width="92" height="92" rx="20" fill="${ROOT}" stroke="${INK}" stroke-width="5"/>
    <g transform="translate(96 166) scale(0.9) translate(-52 -52)">
      <circle cx="54" cy="30" r="12" fill="${INK}"/><circle cx="50" cy="26" r="12" fill="${LEAF}" stroke="${INK}" stroke-width="6"/>
      <rect x="41" y="50" width="26" height="40" rx="11" fill="${INK}"/><rect x="37" y="46" width="26" height="40" rx="11" fill="${LEAF}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/></g>`;
  const title = `<text x="48" y="285" ${HEAVY} font-size="46" fill="${INK}" textLength="400" lengthAdjust="spacingAndGlyphs">Intraconnected</text>`;
  const tag = `<rect x="46" y="320" width="372" height="58" fill="${INK}"/><rect x="40" y="314" width="372" height="58" fill="${LINK}" stroke="${INK}" stroke-width="4"/>
    <text x="226" y="351" ${BODY} font-size="27" fill="${INK}" text-anchor="middle">Zoom into any idea</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="${MINT}"/>${dots.join('')}
  ${markTile}${title}${tag}
  ${lines}${root}${leaf}${link}${checklist}${parent}${child}
</svg>`;
}

(async () => {
  await sharp(path.join(__dirname, '..', 'assets', 'icon-only.png')).resize(512, 512).png().toFile(out('app-icon-512.png'));
  await sharp(Buffer.from(featureSvg())).png().toFile(out('feature-graphic-1024x500.png'));
})();
