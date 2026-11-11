/**
 * Gera os PNGs do manifesto a partir da mesma arte do assets/icon.svg.
 *
 * Escreve o PNG na mão (zlib + chunks) para o projeto continuar sem nenhuma
 * dependência: `node scripts/build-icons.mjs` e pronto.
 */

import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets");

// Arte em coordenadas de 512x512, igual ao SVG.
const ART = {
  background: [
    [99, 102, 241], // #6366f1
    [67, 56, 202], // #4338ca
  ],
  corner: 112,
  bars: [
    { x: 124, y: 286, w: 56, h: 112, r: 20, alpha: 0.55 },
    { x: 228, y: 224, w: 56, h: 174, r: 20, alpha: 0.8 },
    { x: 332, y: 142, w: 56, h: 256, r: 20, alpha: 1 },
  ],
};

/** Distância assinada de (px,py) a um retângulo de cantos arredondados. */
function insideRoundedRect(px, py, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  const cx = Math.max(x + radius, Math.min(px, x + w - radius));
  const cy = Math.max(y + radius, Math.min(py, y + h - radius));
  if (px >= x + radius && px <= x + w - radius) return py >= y && py <= y + h;
  if (py >= y + radius && py <= y + h - radius) return px >= x && px <= x + w;
  return Math.hypot(px - cx, py - cy) <= radius;
}

/** Cobertura 0..1 com 3x3 amostras por pixel, para a borda não serrilhar. */
function coverage(px, py, rect) {
  let hits = 0;
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const x = px + (sx + 0.5) / 3;
      const y = py + (sy + 0.5) / 3;
      if (insideRoundedRect(x, y, rect.x, rect.y, rect.w, rect.h, rect.r)) hits++;
    }
  }
  return hits / 9;
}

function render(size, { maskable = false } = {}) {
  const scale = size / 512;
  const pixels = Buffer.alloc(size * size * 4);

  // O ícone maskable é quadrado e com a arte menor: o sistema recorta as
  // bordas em círculo, losango ou squircle conforme o aparelho.
  const background = maskable
    ? { x: 0, y: 0, w: 512, h: 512, r: 0 }
    : { x: 0, y: 0, w: 512, h: 512, r: ART.corner };
  const k = maskable ? 0.72 : 1;

  const bars = ART.bars.map((bar) => ({
    ...bar,
    x: 256 + (bar.x - 256) * k,
    y: 256 + (bar.y - 256) * k,
    w: bar.w * k,
    h: bar.h * k,
    r: bar.r * k,
  }));

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const ax = px / scale;
      const ay = py / scale;
      const offset = (py * size + px) * 4;

      const bgAlpha = coverage(ax, ay, background);
      if (bgAlpha === 0) continue;

      // Gradiente diagonal do canto superior esquerdo ao inferior direito.
      const t = Math.min(1, Math.max(0, (ax + ay) / 1024));
      const [from, to] = ART.background;
      let r = from[0] + (to[0] - from[0]) * t;
      let g = from[1] + (to[1] - from[1]) * t;
      let b = from[2] + (to[2] - from[2]) * t;

      for (const bar of bars) {
        const cover = coverage(ax, ay, bar) * bar.alpha;
        if (!cover) continue;
        r += (255 - r) * cover;
        g += (255 - g) * cover;
        b += (255 - b) * cover;
      }

      pixels[offset] = Math.round(r);
      pixels[offset + 1] = Math.round(g);
      pixels[offset + 2] = Math.round(b);
      pixels[offset + 3] = Math.round(bgAlpha * 255);
    }
  }
  return pixels;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  // 10..12 = compressão, filtro e entrelaçamento padrão (0)

  // Cada linha é precedida pelo byte de filtro (0 = nenhum).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const from = y * size * 4;
    pixels.copy(raw, y * (size * 4 + 1) + 1, from, from + size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const TARGETS = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-180.png", 180, {}],
  ["icon-maskable-512.png", 512, { maskable: true }],
];

mkdirSync(OUT, { recursive: true });
for (const [name, size, options] of TARGETS) {
  const file = join(OUT, name);
  writeFileSync(file, encodePng(size, render(size, options)));
  console.log(`✓ ${name} (${size}×${size})`);
}

/**
 * Impressão digital da ARTE, não dos arquivos.
 *
 * Os PNGs não são reproduzíveis byte a byte: o zlib comprime diferente
 * entre versões e sistemas, então o mesmo desenho gera arquivos de
 * tamanhos levemente diferentes no macOS e no Linux do CI. Comparar
 * bytes nunca passaria.
 *
 * Este hash depende só da definição da arte, então responde exatamente
 * à pergunta que interessa: alguém mexeu no desenho e esqueceu de
 * rodar `npm run icons`?
 */
const fingerprint = createHash("sha256")
  .update(JSON.stringify({ ART, TARGETS }))
  .digest("hex");

writeFileSync(
  join(OUT, "icons.lock"),
  `${fingerprint}\n` +
    "# Hash da arte em scripts/build-icons.mjs. Gerado por 'npm run icons'.\n"
);
console.log(`✓ icons.lock (${fingerprint.slice(0, 12)}…)`);
