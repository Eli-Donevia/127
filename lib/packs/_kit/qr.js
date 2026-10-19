// QR Code encoder (ISO/IEC 18004), written from the spec with no dependencies. Owner: local agent.
//
//   qrSvg('https://g.page/r/abc/review', { ecc: 'M', margin: 4, dark: '#111', light: '#fff', size: 240 })
//   qrMatrix('HELLO WORLD', { ecc: 'Q' })  -> { version, ecc, mask, mode, size, modules: [[true, false, ...], ...] }
//
// What it does: numeric, alphanumeric and byte (UTF-8) modes, picked automatically; versions 1 to 40;
// error correction L, M, Q and H (raised for free when the higher level fits the same size); Reed-Solomon
// over GF(256); block interleaving; all function patterns; all 8 masks scored with the 4 penalty rules
// (lowest wins, ties go to the lower mask number); format and version information.
// Proven in packs/local/test: a separate matrix-level decoder reads every code back (format bits,
// unmasking, codewords, Reed-Solomon syndromes, payload), and thonky.com's published tables, codewords
// and its finished HELLO WORLD 1-Q symbol are matched module for module.
//
// Printing rules that keep phone cameras happy (callers can rely on them): dark modules on a light
// background (never inverted), at least 4 modules of quiet zone by default, and a contrast check that
// falls back to black on white when the colors are too close.

const ECC_LEVELS = ['L', 'M', 'Q', 'H'];
// Format information bits for each level (spec table 12): L 01, M 00, Q 11, H 10.
const ECC_FORMAT = { L: 1, M: 0, Q: 3, H: 2 };

// Error correction codewords per block and number of blocks, by level and version (spec table 9).
// Index 0 is unused so the version number is the index.
const EC_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

const MODES = {
  numeric: { bits: 0b0001, count: [10, 12, 14] },
  alphanumeric: { bits: 0b0010, count: [9, 11, 13] },
  byte: { bits: 0b0100, count: [8, 16, 16] },
};
const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function countBits(mode, version) {
  return MODES[mode].count[version <= 9 ? 0 : version <= 26 ? 1 : 2];
}

// ---------- capacity ----------

// Modules left for data and error correction once every function pattern is drawn (spec 7.3.4).
function rawDataModules(version) {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (version >= 7) n -= 36;
  }
  return n;
}

function totalCodewords(version) {
  return Math.floor(rawDataModules(version) / 8);
}

function dataCodewords(version, ecc) {
  return totalCodewords(version) - EC_PER_BLOCK[ecc][version] * BLOCKS[ecc][version];
}

// Block layout for a version and level: [{ data, ec }] in order (short blocks first).
function blockLayout(version, ecc) {
  const blocks = BLOCKS[ecc][version];
  const ec = EC_PER_BLOCK[ecc][version];
  const total = totalCodewords(version);
  const shortLen = Math.floor(total / blocks);
  const longCount = total % blocks;
  const out = [];
  for (let i = 0; i < blocks; i++) out.push({ data: shortLen - ec + (i >= blocks - longCount ? 1 : 0), ec });
  return out;
}

// ---------- data encoding ----------

function pickMode(text, bytes) {
  if (/^[0-9]*$/.test(text)) return 'numeric';
  if ([...text].every((ch) => ALNUM.includes(ch))) return 'alphanumeric';
  return 'byte';
}

function pushBits(out, value, len) {
  for (let i = len - 1; i >= 0; i--) out.push((value >>> i) & 1);
}

// The data bits after the mode and count indicators.
function payloadBits(mode, text, bytes) {
  const out = [];
  if (mode === 'numeric') {
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3);
      pushBits(out, Number(chunk), chunk.length * 3 + 1);
    }
  } else if (mode === 'alphanumeric') {
    for (let i = 0; i < text.length; i += 2) {
      if (i + 1 < text.length) pushBits(out, ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
      else pushBits(out, ALNUM.indexOf(text[i]), 6);
    }
  } else {
    for (const b of bytes) pushBits(out, b, 8);
  }
  return out;
}

function charCount(mode, text, bytes) {
  return mode === 'byte' ? bytes.length : text.length;
}

// ---------- Reed-Solomon over GF(256), primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 ----------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

const generators = new Map();
// Generator polynomial (x - a^0)(x - a^1)...(x - a^(n-1)), coefficients highest degree first,
// leading 1 dropped: n numbers.
function generator(n) {
  if (generators.has(n)) return generators.get(n);
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  const g = poly.slice(1);
  generators.set(n, g);
  return g;
}

// Remainder of data(x) * x^n divided by the generator: the n error correction codewords.
function rsRemainder(data, n) {
  const g = generator(n);
  const rem = new Array(n).fill(0);
  for (const b of data) {
    const factor = b ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < n; i++) rem[i] ^= gfMul(g[i], factor);
  }
  return rem;
}

// ---------- codewords ----------

function toCodewords(bits, version, ecc) {
  const capacity = dataCodewords(version, ecc) * 8;
  const out = bits.slice();
  out.push(...new Array(Math.min(4, capacity - out.length)).fill(0));
  while (out.length % 8) out.push(0);
  const bytes = [];
  for (let i = 0; i < out.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | out[i + j];
    bytes.push(v);
  }
  for (let pad = 0xec; bytes.length < capacity / 8; pad ^= 0xec ^ 0x11) bytes.push(pad);
  return bytes;
}

// Splits data codewords into blocks, adds each block's error correction and interleaves them.
function interleave(data, version, ecc) {
  const layout = blockLayout(version, ecc);
  const blocks = [];
  let k = 0;
  for (const b of layout) {
    const d = data.slice(k, k + b.data);
    k += b.data;
    blocks.push({ d, e: rsRemainder(d, b.ec) });
  }
  const out = [];
  const maxData = Math.max(...layout.map((b) => b.data));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < layout[0].ec; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}

// ---------- the matrix ----------

function alignmentCenters(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}

function bchFormat(ecc, mask) {
  const data = (ECC_FORMAT[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function bchVersion(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

class Grid {
  constructor(version) {
    this.version = version;
    this.size = version * 4 + 17;
    this.dark = new Uint8Array(this.size * this.size);
    this.fixed = new Uint8Array(this.size * this.size);
  }
  get(r, c) {
    return this.dark[r * this.size + c] === 1;
  }
  set(r, c, on, fixed = true) {
    this.dark[r * this.size + c] = on ? 1 : 0;
    if (fixed) this.fixed[r * this.size + c] = 1;
  }
  isFixed(r, c) {
    return this.fixed[r * this.size + c] === 1;
  }
}

function drawFinder(g, row, col) {
  // 7x7 finder plus its one-module light separator (clipped at the edges).
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= g.size || c >= g.size) continue;
      const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const ring = inside && (dr === 0 || dr === 6 || dc === 0 || dc === 6);
      const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      g.set(r, c, ring || core);
    }
  }
}

function drawFunctionPatterns(g) {
  const n = g.size;
  drawFinder(g, 0, 0);
  drawFinder(g, 0, n - 7);
  drawFinder(g, n - 7, 0);
  for (let i = 8; i < n - 8; i++) {
    g.set(6, i, i % 2 === 0);
    g.set(i, 6, i % 2 === 0);
  }
  const centers = alignmentCenters(g.version);
  for (const r of centers) {
    for (const c of centers) {
      // Skip the three corners where finders sit.
      if ((r === 6 && c === 6) || (r === 6 && c === n - 7) || (r === n - 7 && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) g.set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }
  // Reserve the format areas (real bits are drawn per mask) and draw the dark module.
  drawFormat(g, 'L', 0);
  if (g.version >= 7) {
    const bits = bchVersion(g.version);
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) === 1;
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      g.set(b, a, on); // top right: rows 0..5, columns n-11..n-9
      g.set(a, b, on); // bottom left: rows n-11..n-9, columns 0..5
    }
  }
}

// Format bits around the finders. Bit 14 is the most significant (spec 7.9.1, figure 25).
function drawFormat(g, ecc, mask) {
  const n = g.size;
  const bits = bchFormat(ecc, mask);
  const bit = (i) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) g.set(i, 8, bit(i));
  g.set(7, 8, bit(6));
  g.set(8, 8, bit(7));
  g.set(8, 7, bit(8));
  for (let i = 9; i < 15; i++) g.set(8, 14 - i, bit(i));
  for (let i = 0; i < 8; i++) g.set(8, n - 1 - i, bit(i));
  for (let i = 8; i < 15; i++) g.set(n - 15 + i, 8, bit(i));
  g.set(n - 8, 8, true); // the dark module
}

// Places codeword bits in the zigzag order: two-column strips from the right, up then down.
function drawCodewords(g, codewords) {
  const n = g.size;
  const total = codewords.length * 8;
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let v = 0; v < n; v++) {
      const r = upward ? n - 1 - v : v;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (g.isFixed(r, c)) continue;
        const on = i < total ? ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1 : false;
        g.set(r, c, on, false);
        i++;
      }
    }
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(g, mask) {
  const f = MASKS[mask];
  for (let r = 0; r < g.size; r++) {
    for (let c = 0; c < g.size; c++) {
      if (!g.isFixed(r, c) && f(r, c)) g.dark[r * g.size + c] ^= 1;
    }
  }
}

// ---------- mask penalty (spec 7.8.3) ----------

// Runs of one line as [color, length] pairs.
function runsOf(line) {
  const runs = [];
  for (const v of line) {
    if (runs.length && runs[runs.length - 1][0] === v) runs[runs.length - 1][1]++;
    else runs.push([v, 1]);
  }
  return runs;
}

// N3: a 1:1:3:1:1 dark-light-dark-light-dark pattern (any unit width u) with 4u of light on one
// side and at least u on the other. Outside the symbol counts as light (it is the quiet zone).
// Counted once per side that qualifies, the way Nayuki's reference implementation scores it.
function finderLikeCount(runs) {
  let count = 0;
  for (let i = 0; i < runs.length; i++) {
    if (runs[i][0] !== 1 || i + 4 >= runs.length) continue;
    const u = runs[i][1];
    if (runs[i + 1][1] !== u || runs[i + 2][1] !== 3 * u || runs[i + 3][1] !== u || runs[i + 4][1] !== u) continue;
    const before = i === 0 ? Infinity : runs[i - 1][1];
    const after = i + 5 >= runs.length ? Infinity : runs[i + 5][1];
    if (before >= 4 * u && after >= u) count++;
    if (after >= 4 * u && before >= u) count++;
  }
  return count;
}

function penalty(g) {
  const n = g.size;
  let score = 0;
  let dark = 0;
  for (let k = 0; k < n; k++) {
    const row = [];
    const col = [];
    for (let j = 0; j < n; j++) {
      row.push(g.dark[k * n + j]);
      col.push(g.dark[j * n + k]);
    }
    for (const line of [row, col]) {
      const runs = runsOf(line);
      for (const [, len] of runs) if (len >= 5) score += 3 + (len - 5);
      score += 40 * finderLikeCount(runs);
    }
  }
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = g.dark[r * n + c];
      if (v === g.dark[r * n + c + 1] && v === g.dark[(r + 1) * n + c] && v === g.dark[(r + 1) * n + c + 1]) score += 3;
    }
  }
  for (let i = 0; i < n * n; i++) dark += g.dark[i];
  const total = n * n;
  const k = Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1);
  score += 10 * k;
  return score;
}

// ---------- public API ----------

function normalizeEcc(ecc) {
  const e = String(ecc || 'M').toUpperCase();
  if (!ECC_LEVELS.includes(e)) throw new Error(`QR error correction must be L, M, Q or H (got ${ecc}).`);
  return e;
}

// Encodes text into a QR matrix. opts: { ecc: 'L'|'M'|'Q'|'H' (default 'M'), mode: 'auto'|'byte'|
// 'alphanumeric'|'numeric', minVersion: 1, maxVersion: 40, mask: 0..7 to force one (default: lowest
// penalty), boostEcc: true (use a higher level when it fits the same version) }.
function qrMatrix(text, opts = {}) {
  const value = text == null ? '' : String(text);
  if (!value) throw new Error('A QR code needs some text or a link.');
  let ecc = normalizeEcc(opts.ecc);
  const bytes = Buffer.from(value, 'utf8');
  const mode = !opts.mode || opts.mode === 'auto' ? pickMode(value, bytes) : opts.mode;
  if (!MODES[mode]) throw new Error(`Unknown QR mode ${opts.mode}.`);
  if (mode === 'numeric' && !/^[0-9]*$/.test(value)) throw new Error('Numeric mode takes digits only.');
  if (mode === 'alphanumeric' && ![...value].every((ch) => ALNUM.includes(ch))) throw new Error('Alphanumeric mode takes 0-9, A-Z, space and $%*+-./: only.');
  const minVersion = Math.max(1, Math.min(40, opts.minVersion || 1));
  const maxVersion = Math.max(minVersion, Math.min(40, opts.maxVersion || 40));
  const body = payloadBits(mode, value, bytes);
  const count = charCount(mode, value, bytes);
  let version = 0;
  let bits = null;
  for (let v = minVersion; v <= maxVersion; v++) {
    const cb = countBits(mode, v);
    if (count >= 2 ** cb) continue;
    const need = 4 + cb + body.length;
    if (need <= dataCodewords(v, ecc) * 8) {
      version = v;
      bits = [];
      pushBits(bits, MODES[mode].bits, 4);
      pushBits(bits, count, cb);
      bits.push(...body);
      break;
    }
  }
  if (!version) throw new Error('That text is too long for a QR code. Use a shorter link.');
  if (opts.boostEcc !== false) {
    for (const higher of ECC_LEVELS.slice(ECC_LEVELS.indexOf(ecc) + 1)) if (bits.length <= dataCodewords(version, higher) * 8) ecc = higher;
  }
  const codewords = interleave(toCodewords(bits, version, ecc), version, ecc);
  const g = new Grid(version);
  drawFunctionPatterns(g);
  drawCodewords(g, codewords);
  let mask = opts.mask;
  if (mask == null) {
    let best = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(g, m);
      drawFormat(g, ecc, m);
      const p = penalty(g);
      if (p < best) {
        best = p;
        mask = m;
      }
      applyMask(g, m);
    }
  } else if (!(Number.isInteger(mask) && mask >= 0 && mask <= 7)) throw new Error('QR mask must be 0 to 7.');
  applyMask(g, mask);
  drawFormat(g, ecc, mask);
  const modules = [];
  for (let r = 0; r < g.size; r++) {
    const row = [];
    for (let c = 0; c < g.size; c++) row.push(g.get(r, c));
    modules.push(row);
  }
  return { version, ecc, mask, mode, size: g.size, modules, penalty: penalty(g) };
}

// ---------- SVG ----------

function hexToRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((x) => x + x).join('');
  return /^[0-9a-f]{6}$/i.test(h) ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) : null;
}
function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Dark modules must be clearly darker than the background, or phones won't read the code.
// Returns colors that scan: the caller's when they pass, black on white (or black on their light)
// when they don't. 'none' for light means a transparent background: then dark must be dark.
function safeColors(dark = '#000000', light = '#ffffff') {
  const ld = luminance(dark);
  const ll = light === 'none' ? 1 : luminance(light);
  const okDark = ld != null && ld <= 0.18;
  if (ld != null && ll != null && okDark && (ll + 0.05) / (ld + 0.05) >= 4.5) return { dark, light };
  const fixedLight = light === 'none' || (ll != null && ll >= 0.7) ? light : '#ffffff';
  return { dark: '#000000', light: fixedLight };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// One path for all dark modules: each horizontal run is one rectangle, in module units.
function pathData(modules, margin = 4) {
  const parts = [];
  modules.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < row.length && row[c]) c++;
      parts.push(`M${start + margin} ${r + margin}h${c - start}v1h-${c - start}z`);
    }
  });
  return parts.join('');
}

// A QR code as a standalone SVG, or nested inside another SVG when x/y are given.
// opts: everything qrMatrix takes, plus { margin: 4 (quiet zone in modules, minimum 2), dark, light
// ('none' for transparent), size (number = px, or a CSS length like '1.25in'), x, y, title }.
function qrSvg(text, opts = {}) {
  const q = qrMatrix(text, opts);
  const margin = Math.max(2, Number.isFinite(opts.margin) ? Math.round(opts.margin) : 4);
  const { dark, light } = safeColors(opts.dark, opts.light);
  const n = q.size + margin * 2;
  const size = opts.size == null ? n * 8 : opts.size;
  const pos = opts.x != null || opts.y != null ? ` x="${Number(opts.x) || 0}" y="${Number(opts.y) || 0}"` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg"${pos} width="${esc(size)}" height="${esc(size)}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">` +
    (opts.title ? `<title>${esc(opts.title)}</title>` : '') +
    (light === 'none' ? '' : `<rect width="${n}" height="${n}" fill="${esc(light)}"/>`) +
    `<path fill="${esc(dark)}" d="${pathData(q.modules, margin)}"/></svg>`
  );
}

// How much fits: the most characters (or bytes) of a mode at a version and level.
function capacity(version, ecc = 'M', mode = 'byte') {
  const e = normalizeEcc(ecc);
  const bits = dataCodewords(version, e) * 8 - 4 - countBits(mode, version);
  if (mode === 'numeric') return Math.floor(bits / 10) * 3 + (bits % 10 >= 7 ? 2 : bits % 10 >= 4 ? 1 : 0);
  if (mode === 'alphanumeric') return Math.floor(bits / 11) * 2 + (bits % 11 >= 6 ? 1 : 0);
  return Math.floor(bits / 8);
}

// The smallest a printed code should be, in inches, for a phone held about `distanceIn` away:
// a common print rule of thumb is code width at least a tenth of the scanning distance, and at
// least 0.4 mm per module so cheap printers keep the modules crisp.
function minPrintInches(text, { ecc = 'M', margin = 4, distanceIn = 8 } = {}) {
  const q = qrMatrix(text, { ecc });
  const modules = q.size + margin * 2;
  return Math.max(distanceIn / 10, (modules * 0.4) / 25.4, 0.8);
}

module.exports = {
  qrMatrix,
  qrSvg,
  pathData,
  safeColors,
  capacity,
  minPrintInches,
  // Internals, exported for tests and for anyone checking the encoder against the spec.
  _internal: { EC_PER_BLOCK, BLOCKS, ECC_FORMAT, ALNUM, rawDataModules, totalCodewords, dataCodewords, blockLayout, alignmentCenters, bchFormat, bchVersion, rsRemainder, interleave, toCodewords, payloadBits, countBits, penalty, finderLikeCount, runsOf, MASKS, GF_EXP, GF_LOG },
};
