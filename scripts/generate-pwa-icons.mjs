import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const G = [" ### ", "#    ", "# ## ", "#  # ", "#  # ", "#  # ", " ### "];
const N = ["#   #", "##  #", "##  #", "# # #", "#  ##", "#  ##", "#   #"];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function png(size, pixels) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * stride + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function set(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = color[3];
}

function blit(pixels, size, glyph, ox, oy, scale, color) {
  for (let y = 0; y < glyph.length; y++) {
    for (let x = 0; x < glyph[y].length; x++) {
      if (glyph[y][x] !== "#") continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) set(pixels, size, ox + x * scale + dx, oy + y * scale + dy, color);
      }
    }
  }
}

function draw(size, maskable) {
  const pixels = new Uint8Array(size * size * 4);
  const bg = [0x14, 0x14, 0x14, 255];
  const gold = [0xe8, 0xb9, 0x31, 255];
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = bg[0];
    pixels[i + 1] = bg[1];
    pixels[i + 2] = bg[2];
    pixels[i + 3] = 255;
  }
  const center = (size - 1) / 2;
  const radius = size * (maskable ? 0.32 : 0.4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Math.hypot(x - center, y - center) <= radius) set(pixels, size, x, y, gold);
    }
  }
  const scale = Math.max(1, Math.round(size / 32));
  const textW = (5 + 1 + 5) * scale;
  const textH = 7 * scale;
  const ox = Math.round(center - textW / 2);
  const oy = Math.round(center - textH / 2);
  blit(pixels, size, G, ox, oy, scale, bg);
  blit(pixels, size, N, ox + 6 * scale, oy, scale, bg);
  return png(size, pixels);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "icon-192.png"), draw(192, false));
writeFileSync(join(dir, "icon-512.png"), draw(512, false));
writeFileSync(join(dir, "icon-maskable-512.png"), draw(512, true));
writeFileSync(join(dir, "apple-touch-icon.png"), draw(180, false));
