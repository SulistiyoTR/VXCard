// Renders the VX Card app icon (newsprint direction) to the PNGs the PWA needs.
// Run: node scripts/make-icons.mjs   (requires the `sharp` devDependency)
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const CREAM = "#f4f1e9";
const INK = "#131313";
const RULE = "#b7a57c";

// Full-bleed square — iOS and Android apply their own corner mask.
function render(size) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${CREAM}"/>
    <text x="256" y="330" text-anchor="middle"
      font-family="'Bodoni 72','Didot','Playfair Display',Georgia,'Times New Roman',serif"
      font-weight="700" font-size="246" letter-spacing="4" fill="${INK}">VX</text>
    <rect x="168" y="360" width="176" height="3.5" rx="1.75" fill="${RULE}"/>
    <text x="261" y="444" text-anchor="middle"
      font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
      font-weight="500" font-size="55" letter-spacing="16" fill="#1a1a1a">CARD</text>
  </svg>`;
  return sharp(Buffer.from(doc)).png();
}

mkdirSync("public", { recursive: true });

const targets = [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["src/app/icon.png", 256],
  ["src/app/apple-icon.png", 180],
];

for (const [path, size] of targets) {
  writeFileSync(path, await render(size).toBuffer());
  console.log("wrote", path, `${size}×${size}`);
}
