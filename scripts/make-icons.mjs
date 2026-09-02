// Generates simple placeholder PWA icons (solid background + "VX" wordmark grid).
// No image deps — hand-rolls a PNG. Replace with real art later.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function png(size, draw) {
  const bpp = 4;
  const raw = Buffer.alloc((size * bpp + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * bpp + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y);
      const o = y * (size * bpp + 1) + 1 + x * bpp;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A dark rounded field with an accent diagonal — distinctive enough at small sizes.
function draw(size) {
  const radius = size * 0.22;
  return (x, y) => {
    // rounded-corner mask
    const cx = Math.min(x, size - 1 - x);
    const cy = Math.min(y, size - 1 - y);
    if (cx < radius && cy < radius) {
      const dx = radius - cx;
      const dy = radius - cy;
      if (dx * dx + dy * dy > radius * radius) return [0, 0, 0, 0];
    }
    const onBar = Math.abs((x - y) - 0) < size * 0.13 || Math.abs(x + y - size) < size * 0.13;
    return onBar ? [79, 140, 255, 255] : [17, 17, 19, 255];
  };
}

mkdirSync("public", { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, png(size, draw(size)));
  console.log(`wrote public/icon-${size}.png`);
}
