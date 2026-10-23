// Reduz o HDR de céu (Poly Haven "autumn_field_puresky", CC0, 4096×2048, 16 MB) para um equirretangular pequeno que o jogo usa
// como luz ambiente nos perfis com materiais realistas: assets/brackeys/sky/sky.hdr (256×128, uns 130 KB).
// O sol é cortado (valores limitados a MAX), porque a luz direcional do jogo já faz o papel dele e o céu só deve iluminar por igual.
// Uso: node tools/sky/convert.mjs <autumn_field_puresky_4k.hdr> [saida.hdr]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = process.argv[2];
const OUT = path.resolve(process.argv[3] || path.join(ROOT, 'assets', 'brackeys', 'sky', 'sky.hdr'));
const OW = 256, OH = 128, MAX = 3.0;
if (!SRC) { console.error('Uso: node tools/sky/convert.mjs <arquivo.hdr> [saida.hdr]'); process.exit(1); }

const buf = fs.readFileSync(SRC);
let p = 0;
const line = () => { let s = ''; while (buf[p] !== 10) s += String.fromCharCode(buf[p++]); p++; return s; };
if (!line().startsWith('#?')) throw new Error('não é um .hdr (Radiance)');
let l;
while ((l = line()) !== '') { /* cabeçalho */ }
const m = line().match(/^-Y (\d+) \+X (\d+)$/);
if (!m) throw new Error('orientação não suportada');
const H = +m[1], W = +m[2];

// decodifica as linhas (RLE novo ou sem compressão) para floats RGB
const rgb = new Float32Array(W * H * 3);
const row = new Uint8Array(W * 4);
for (let y = 0; y < H; y++) {
  if (buf[p] === 2 && buf[p + 1] === 2 && !(buf[p + 2] & 0x80)) {
    p += 4;
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < W) {
        let n = buf[p++];
        if (n > 128) { n -= 128; const v = buf[p++]; while (n--) row[(x++) * 4 + c] = v; }
        else while (n--) row[(x++) * 4 + c] = buf[p++];
      }
    }
  } else {
    for (let i = 0; i < W * 4; i++) row[i] = buf[p++];
  }
  for (let x = 0; x < W; x++) {
    const e = row[x * 4 + 3], k = e ? 2 ** (e - 136) : 0;
    const o = (y * W + x) * 3;
    rgb[o] = row[x * 4] * k; rgb[o + 1] = row[x * 4 + 1] * k; rgb[o + 2] = row[x * 4 + 2] * k;
  }
}

// reduz em blocos (média) e limita o brilho
const bw = W / OW, bh = H / OH;
const out = Buffer.alloc(OW * OH * 4);
let peak = 0;
for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let yy = Math.floor(y * bh); yy < Math.floor((y + 1) * bh); yy++) for (let xx = Math.floor(x * bw); xx < Math.floor((x + 1) * bw); xx++) {
    const o = (yy * W + xx) * 3;
    r += rgb[o]; g += rgb[o + 1]; b += rgb[o + 2]; n++;
  }
  r /= n; g /= n; b /= n;
  const mx = Math.max(r, g, b);
  peak = Math.max(peak, mx);
  const k = mx > MAX ? MAX / mx : 1;
  r *= k; g *= k; b *= k;
  const mm = Math.max(r, g, b);
  const o = (y * OW + x) * 4;
  if (mm < 1e-32) continue;
  let e = Math.ceil(Math.log2(mm)) ; let f = 2 ** e;
  if (mm / f >= 1) { e++; f *= 2; }
  const s = 256 / f;
  out[o] = Math.min(255, Math.floor(r * s)); out[o + 1] = Math.min(255, Math.floor(g * s)); out[o + 2] = Math.min(255, Math.floor(b * s)); out[o + 3] = e + 128;
}

// grava com linhas RLE "só literais" (formato que o RGBELoader do three exige)
const parts = [Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${OH} +X ${OW}\n`, 'latin1')];
for (let y = 0; y < OH; y++) {
  const bytes = [2, 2, OW >> 8, OW & 255];
  for (let c = 0; c < 4; c++) {
    for (let x = 0; x < OW; x += 128) {
      const n = Math.min(128, OW - x);
      bytes.push(n);
      for (let i = 0; i < n; i++) bytes.push(out[(y * OW + x + i) * 4 + c]);
    }
  }
  parts.push(Buffer.from(bytes));
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat(parts));
console.log(`${W}×${H} -> ${OW}×${OH}, pico original ${peak.toFixed(1)}, limite ${MAX}, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
