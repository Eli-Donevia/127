// The member's colors and voice for shop files: their own color input first, then what the brand
// pack saved (brain.packs.brand), then the colors on their own store, then a warm default.
// Also small text helpers the launch, drop, section and stockist tools share.

const { brain, color, text } = require('../../_kit');

const hex = (v) => (color.isHex(v) ? color.rgbToHex(color.hexToRgb(v)) : '');

function brandColors(ctx, input = {}, storeColors = null) {
  const mem = brain.packMemory(ctx, 'brand') || {};
  const primary = hex(input.color) || hex(mem.primary) || hex(mem.colors && mem.colors.primary) || hex(mem.palette && mem.palette.primary) || hex(storeColors && storeColors.primary) || '';
  const accent = hex(input.accent) || hex(mem.accent) || hex(mem.colors && mem.colors.accent) || hex(storeColors && storeColors.accent) || '';
  const source = hex(input.color) ? 'yours' : primary && (hex(mem.primary) || hex(mem.colors && mem.colors.primary) || hex(mem.palette && mem.palette.primary)) ? 'brand kit' : primary ? 'your store' : 'default';
  return { primary: primary || '#3f5b4a', accent: accent || '', source };
}

// "Lavender candle | 32 | note" / "Lavender candle, 32" / "Lavender candle $32" -> { name, price, note }
function parseProductLines(s, { max = 40 } = {}) {
  return String(s || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((l) => {
      const parts = l.split(/\s*\|\s*/);
      let name = parts[0];
      let price = null;
      let note = parts.slice(2).join(' ').trim();
      if (parts.length > 1) price = Number(String(parts[1]).replace(/[^0-9.]/g, '')) || null;
      else {
        const m = l.match(/^(.*?)[,\s:]+\$?\s?(\d{1,6}(?:\.\d{1,2})?)\s*(?:usd)?\s*(?:[,|]\s*(.*))?$/i);
        if (m) {
          name = m[1];
          price = Number(m[2]);
          note = (m[3] || '').trim();
        }
      }
      name = text.clip(text.oneLine(String(name).replace(/[,:|]+$/, '')), 90);
      return name ? { name, price: Number.isFinite(price) && price > 0 ? price : null, note: text.clip(text.oneLine(note || ''), 160) } : null;
    })
    .filter(Boolean);
}

// Lines like "Name: note", "Name - note" or "Name, note" -> [{ name, note }]
function parsePairs(s, { max = 20 } = {}) {
  return String(s || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((l) => {
      const m = l.match(/^(.+?)\s*(?::|\s-\s|,)\s*(.+)$/);
      const cap = (x) => String(x).replace(/^([a-z])/, (ch) => ch.toUpperCase());
      return m ? { name: cap(text.clip(text.oneLine(m[1]), 60)), note: cap(text.clip(text.oneLine(m[2]), 140)) } : { name: cap(text.clip(text.oneLine(l), 60)), note: '' };
    });
}

// "Question? Answer." per line -> [{ q, a }]
function parseFaq(s, { max = 12 } = {}) {
  return String(s || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((l) => {
      const i = l.indexOf('?');
      if (i < 3 || i >= l.length - 2) return null;
      return { q: text.clip(text.oneLine(l.slice(0, i + 1)), 120), a: text.clip(text.oneLine(l.slice(i + 1)), 400) };
    })
    .filter(Boolean);
}

const sentence = (s) => {
  const t = text.oneLine(s || '');
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
};
const lowerFirst = (s) => String(s || '').replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase());

module.exports = { brandColors, parseProductLines, parsePairs, parseFaq, sentence, lowerFirst, hex };
