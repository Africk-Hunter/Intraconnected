// Draws the app icon and splash sources into assets/: an "i" whose dot is a node
// (green dot and stem, black outline and hard shadow) on a brown ground. Then:
//   npx capacitor-assets generate --android --ios //     --iconBackgroundColor "#A3703E" --splashBackgroundColor "#E9F9E5"
// `sharp` comes with @capacitor/assets. It also writes the website's icons
// (public/icon-*.png, apple-touch-icon.png, favicon.ico) from the same mark.
// The in-app logo (BrandLogo.tsx, public/images/Logo.svg) is deliberately separate.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const MINT = '#E9F9E5', INK = '#111111', ROOT = '#A3703E', LEAF = '#41BC28';
const out = (name) => path.join(__dirname, '..', 'assets', name);

// The mark in a 100x100 box; its drawn extent (outline and shadow included) is
// x 34..70, y 11..93, centre (52, 52), 36 wide and 82 tall.
const CX = 52, CY = 52;
const MARK = `
  <circle cx="54" cy="30" r="12" fill="${INK}"/>
  <circle cx="50" cy="26" r="12" fill="${LEAF}" stroke="${INK}" stroke-width="6"/>
  <rect x="41" y="50" width="26" height="40" rx="11" fill="${INK}"/>
  <rect x="37" y="46" width="26" height="40" rx="11" fill="${LEAF}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`;

// The mark scaled by `s` (canvas pixels per mark unit), centred on a size×size canvas.
function mark(size, s) {
  const t = size / 2;
  return `<g transform="translate(${t} ${t}) scale(${s}) translate(${-CX} ${-CY})">${MARK}</g>`;
}
function svg(size, body, bg) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}${body}</svg>`);
}

(async () => {
  // iOS icon: full bleed, no transparency (the OS rounds the corners). The
  // mark is 82% of the height.
  await sharp(svg(1024, mark(1024, 10.24), ROOT)).png().toFile(out('icon-only.png'));
  // Android adaptive icon: the OS masks to a circle, squircle or other shape,
  // and only the centre 66/108 is guaranteed to show. The mark's corners must
  // stay inside that circle (626px of 1024), so its diagonal is capped there.
  await sharp(svg(1024, mark(1024, 6.9))).png().toFile(out('icon-foreground.png'));
  await sharp(svg(1024, '', ROOT)).png().toFile(out('icon-background.png'));
  // iOS launch image (and the Android pre-12 fallback). A portrait phone shows
  // only the middle ~46% of this square, so the icon tile is about 20% of it.
  const tile = 560, t0 = (2732 - tile) / 2;
  const tileSvg = `<rect x="${t0}" y="${t0}" width="${tile}" height="${tile}" rx="${tile * 0.22}" fill="${ROOT}"/>${mark(2732, tile / 100)}`;
  await sharp(svg(2732, tileSvg, MINT)).png().toFile(out('splash.png'));
  // Android 12+ launch icon: drawn at 288dp (1152px at xxxhdpi) and clipped to
  // a circle two thirds of that wide (768px), so it is drawn as a brown disc that size.
  const res = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'drawable-xxxhdpi');
  fs.mkdirSync(res, { recursive: true });
  await sharp(svg(1152, `<circle cx="576" cy="576" r="384" fill="${ROOT}"/>${mark(1152, 6.4)}`)).png().toFile(path.join(res, 'splash_icon.png'));
  // The website's icons (public/), so the site and the app match. Same mark.
  const pub = (name) => path.join(__dirname, '..', 'public', name);
  const any = (px) => sharp(svg(1024, mark(1024, 10.24), ROOT)).resize(px).png();
  await any(192).toFile(pub('icon-192.png'));
  await any(512).toFile(pub('icon-512.png'));
  await any(180).toFile(pub('apple-touch-icon.png'));
  // Maskable: browsers crop to a shape, keeping only the middle 80%.
  await sharp(svg(1024, mark(1024, 8.5), ROOT)).resize(512).png().toFile(pub('icon-maskable-512.png'));
  // favicon.ico: PNGs of 16, 32 and 48px inside an ICO container. Small sizes
  // use a larger mark so it stays readable.
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map((px) => sharp(svg(1024, mark(1024, 11.5), ROOT)).resize(px).png().toBuffer()));
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = pngs.map((png, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i], 0); e.writeUInt8(sizes[i], 1); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8); e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  fs.writeFileSync(pub('favicon.ico'), Buffer.concat([head, ...entries, ...pngs]));
  console.log('assets written');
})();
