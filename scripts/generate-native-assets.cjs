// Draws the app icon and splash sources into assets/ from the in-app logo mark
// (src/components/BrandLogo.tsx): one idea branching into two, on mint. Then:
//   npx capacitor-assets generate --android --ios \
//     --iconBackgroundColor "#E9F9E5" --splashBackgroundColor "#E9F9E5"
// `sharp` comes with @capacitor/assets. It also writes the website's icons
// (public/icon-*.png, apple-touch-icon.png, favicon.ico) from the same mark.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const MINT = '#E9F9E5', INK = '#111111', ROOT = '#A3703E', SKY = '#00A9D8', LEAF = '#41BC28';
const out = (name) => path.join(__dirname, '..', 'assets', name);

// The mark in its own 52x44 coordinates; its drawn extent is x 2..52, y 2..44
// (shadows included), centre (27, 23), about 50 wide and 42 tall.
const CX = 27, CY = 23;
function node(x, y, w, h, fill) {
  return `<rect x="${x + 2}" y="${y + 2}" width="${w}" height="${h}" rx="4.5" fill="${INK}"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4.5" fill="${fill}" stroke="${INK}" stroke-width="3"/>`;
}
const MARK = `
  <g fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M26 15.5V21H12.5V27"/><path d="M26 15.5V21H39.5V27"/>
  </g>
  ${node(15.5, 2, 21, 13, ROOT)}${node(2, 27, 19, 13, SKY)}${node(31, 27, 19, 13, LEAF)}`;

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
  // mark is 80% of the width.
  await sharp(svg(1024, mark(1024, 1024 * 0.8 / 50), MINT)).png().toFile(out('icon-only.png'));
  // Android adaptive icon: the OS masks to a circle, squircle or other shape,
  // and only the centre 66/108 is guaranteed to show. The mark's corners must
  // stay inside that circle (626px of 1024), so its diagonal is capped there.
  await sharp(svg(1024, mark(1024, 9.4))).png().toFile(out('icon-foreground.png'));
  await sharp(svg(1024, '', MINT)).png().toFile(out('icon-background.png'));
  // iOS launch image (and the Android pre-12 fallback). A portrait phone shows
  // only the middle ~46% of this square, so the mark is about 40% of that.
  await sharp(svg(2732, mark(2732, 10.1), MINT)).png().toFile(out('splash.png'));
  // Android 12+ launch icon: drawn at 288dp (1152px at xxxhdpi) and clipped to
  // a circle two thirds of that wide, so the mark's diagonal must fit in 768px.
  const res = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'drawable-xxxhdpi');
  fs.mkdirSync(res, { recursive: true });
  await sharp(svg(1152, mark(1152, 11.2))).png().toFile(path.join(res, 'splash_icon.png'));
  // The website's icons (public/), so the site and the app match. Same mark.
  const pub = (name) => path.join(__dirname, '..', 'public', name);
  const any = (px) => sharp(svg(1024, mark(1024, 1024 * 0.8 / 50), MINT)).resize(px).png();
  await any(192).toFile(pub('icon-192.png'));
  await any(512).toFile(pub('icon-512.png'));
  await any(180).toFile(pub('apple-touch-icon.png'));
  // Maskable: browsers crop to a shape, keeping only the middle 80%.
  await sharp(svg(1024, mark(1024, 1024 * 0.55 / 50), MINT)).resize(512).png().toFile(pub('icon-maskable-512.png'));
  // favicon.ico: PNGs of 16, 32 and 48px inside an ICO container. Small sizes
  // use a larger mark so it stays readable.
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map((px) => sharp(svg(1024, mark(1024, 1024 * 0.92 / 50), MINT)).resize(px).png().toBuffer()));
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
