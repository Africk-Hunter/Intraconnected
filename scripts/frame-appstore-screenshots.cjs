// Frames your own phone captures for the stores: headline chips + phone (status bar, home
// indicator) on the brand grid, rendered by scripts/appstore-screenshots/frame.html in headless
// Chrome (real site fonts). Captures live in assets/app-store/raw/ under the names in SHOTS.
// Output: assets/app-store/framed/ (App Store 6.9" 1320x2868), framed/iphone-6.1/ (6.1"/6.3"
// 1179x2556) and framed/play/ (Google Play 1080x2160, Play refuses anything longer than 2:1). Run `node scripts/frame-appstore-screenshots.cjs`.
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));

const base = path.join(__dirname, '..', 'assets', 'app-store');
const page = path.join(__dirname, 'appstore-screenshots', 'frame.html');

// Store order. [raw file, output name, headline line 1, line 2, tag line, chip colours]
const SHOTS = [
  ['Main View.png', '01-plant-an-idea', 'Plant an idea.', '', 'Every idea branches into the next', 'leaf', 'sky', -2, 0, 0, 0],
  ['Idea creation.png', '02-capture', 'Catch it', 'in seconds.', 'Ideas, checklists and notes', 'leaf', 'link', 1.5, -1.5, -18, 18],
  ['Checklist and Note.png', '03-expand', 'Expand it with', 'notes and lists.', 'Break it down, tick things off', 'indigo', 'leaf', -2.5, 2, 16, -16],
  ['Dragging Idea.png', '04-reorganize', 'Hold and drag', 'to reorganize.', 'Shape your idea tree your way', 'orange', 'sky', 2, -2, -14, 14],
  ['Search.png', '05-search', 'Find any idea.', 'Instantly.', 'Search every branch at once', 'pink', 'leaf', -1, 2.5, 20, -12],
  ['Mind Map.png', '06-mind-map', 'Your whole map,', 'one screen.', 'Jump to any branch in a tap', 'pink', 'link', 2.5, -1, -16, 14],
];
const SIZES = [['', 1320, 2868], ['iphone-6.1', 1179, 2556], ['play', 1080, 2160]];

const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
async function edgeColour(file, fromBottom) {
  const { width, height } = await sharp(file).metadata();
  // The commonest colour a few rows in from the edge (the app background, not its grid lines).
  // stats() would ignore the extract and average the whole image, so count raw pixels instead.
  const data = await sharp(file).flatten({ background: '#E9F9E5' }).extract({ left: 0, top: fromBottom ? height - 10 : 6, width, height: 4 }).raw().toBuffer();
  const counts = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const top = [...counts].sort((x, y) => y[1] - x[1])[0][0];
  return hex([top >> 16, (top >> 8) & 255, top & 255]);
}

(async () => {
  if (!CHROME) throw new Error('Chrome or Edge not found');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-'));
  for (const [dir] of SIZES) fs.mkdirSync(path.join(base, 'framed', dir), { recursive: true });
  for (const [raw, name, a, b, sub, ca, cb, ra, rb, xa, xb] of SHOTS) {
    let src = path.join(base, 'raw', raw);
    if (!fs.existsSync(src)) { console.log(`Missing ${raw}, skipped`); continue; }
    const meta = await sharp(src).metadata();
    if (meta.width < 1100) {
      // A low-resolution capture is scaled up here so Chrome doesn't blur it further; recapture at 3x if you can.
      console.log(`${raw} is only ${meta.width}px wide: upscaling, it will look softer than the others`);
      const up = path.join(tmp, 'up-' + raw);
      await sharp(src).resize({ width: 1179, kernel: 'lanczos3' }).sharpen({ sigma: 0.8 }).png().toFile(up);
      src = up;
    }
    const q = new URLSearchParams({
      shot: 'file:///' + src.replace(/\\/g, '/'), a, b, sub, ca, cb, ra, rb, xa, xb,
      top: await edgeColour(src, false), bottom: await edgeColour(src, true),
    });
    for (const [dir, w, h] of SIZES) {
      const shot = path.join(tmp, `${name}-${w}.png`);
      execFileSync(CHROME, [
        '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1', '--disable-gpu', '--allow-file-access-from-files',
        `--window-size=${w},${h}`, '--virtual-time-budget=15000', `--screenshot=${shot}`, `file:///${page.replace(/\\/g, '/')}?${q}&h=${h}`,
      ], { stdio: 'ignore' });
      const file = path.join(base, 'framed', dir, `${name}-${w}x${h}.png`);
      // Apple rejects screenshots with an alpha channel.
      await sharp(shot).resize(w, h, { fit: 'cover', position: 'top' }).flatten({ background: '#E9F9E5' }).removeAlpha().png().toFile(file);
      console.log(path.relative(base, file));
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
})();
