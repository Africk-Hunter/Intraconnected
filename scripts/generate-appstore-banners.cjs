// Renders the App Store "Header" and "Search Results" art from
// scripts/appstore-banners/banner.html with headless Chrome (real site fonts and
// card styles), then flattens each to an opaque PNG (Apple rejects alpha channels).
// Output: assets/app-store/banners/. Run `node scripts/generate-appstore-banners.cjs`.
// Add `--debug` to outline Apple's centred safe area in red.
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

const page = path.join(__dirname, 'appstore-banners', 'banner.html');
const out = path.join(__dirname, '..', 'assets', 'app-store', 'banners');
const debug = process.argv.includes('--debug');

const jobs = [
  ['header', 'header', 3840, 1646],
  ['search', 'search-results', 3840, 2560],
  ['search', 'search-results', 1920, 1280],
  ['universal', 'universal', 5244, 2950],
];

(async () => {
  if (!CHROME) throw new Error('Chrome or Edge not found');
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) fs.unlinkSync(path.join(out, f));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'banner-'));
  for (const [format, name, w, h] of jobs) {
    const shot = path.join(tmp, `${name}-${w}.png`);
    const url = `file:///${page.replace(/\\/g, '/')}?f=${format}&h=${h}${debug ? '&debug' : ''}`;
    execFileSync(CHROME, [
      '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1', '--disable-gpu',
      `--window-size=${w},${h}`, '--virtual-time-budget=15000', `--screenshot=${shot}`, url,
    ], { stdio: 'ignore' });
    const file = path.join(out, `${name}-${w}x${h}${debug ? '-debug' : ''}.png`);
    await sharp(shot).resize(w, h, { fit: 'cover', position: 'top' }).flatten({ background: '#E9F9E5' }).removeAlpha().png().toFile(file);
    const m = await sharp(file).metadata();
    console.log(`${path.basename(file)}  ${m.width}x${m.height}  channels=${m.channels}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
})();
