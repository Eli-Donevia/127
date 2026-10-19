// The before-and-after card for a client gym: average views on its Reels before the member's videos
// and on the first ones the member made, read from one screenshot of the gym's Reels tab (the newest
// Reels sit first) or typed in. Only numbers that were read or given; no money, no promises. It names
// the gym only when the owner said yes; otherwise it's "a CrossFit gym in Des Moines".

const { plain } = require('./util');
const { CATEGORY_LABEL } = require('./gaps');
const { wrap, readable } = require('./scorecard');

// What AI reads from the screenshot. Pinned Reels sit first whatever their date, so they're marked.
const READ_SCHEMA = {
  type: 'object',
  properties: {
    handle: { type: ['string', 'null'] },
    tiles: {
      type: 'array',
      maxItems: 30,
      description: 'Every Reel tile in reading order (left to right, top to bottom)',
      items: {
        type: 'object',
        properties: {
          views: { type: ['integer', 'null'], description: 'The view count printed on the tile, or null if you cannot read it' },
          pinned: { type: 'boolean', description: 'True if the tile shows a pin icon' },
        },
        required: ['views', 'pinned'],
      },
    },
  },
  required: ['tiles'],
};

const READ_SYSTEM = `You read one screenshot of an Instagram or TikTok Reels tab. List every Reel tile in reading order (left to right, top to bottom), with the view count printed on it.
Report only what is visible: if a tile's count is cut off or unreadable, use null. "1.2K" means 1200 and "3.4M" means 3400000. Mark tiles that show a pin icon as pinned.`;

const avg = (a) => Math.round(a.reduce((s, x) => s + x, 0) / a.length);

// views: newest first, pinned tiles already removed. mine: how many of the newest are the member's.
function compare(views, mine, { maxBefore = 12 } = {}) {
  const v = (views || []).filter((x) => Number.isFinite(x) && x >= 0);
  const k = Math.max(1, Math.round(Number(mine) || 0));
  const after = v.slice(0, k);
  const before = v.slice(k, k + maxBefore);
  if (after.length < k || before.length < 2) return null;
  const a = avg(after);
  const b = avg(before);
  return { before: { avg: b, n: before.length }, after: { avg: a, n: after.length }, change: b > 0 ? Math.round(((a - b) / b) * 100) : null, up: a > b };
}

// From the AI read: newest first, pinned and unreadable tiles left out.
function viewsFromRead(data) {
  const tiles = (data && Array.isArray(data.tiles) ? data.tiles : []).filter((t) => t && !t.pinned);
  const unreadable = tiles.filter((t) => !Number.isFinite(t.views)).length;
  return { views: tiles.filter((t) => Number.isFinite(t.views)).map((t) => t.views), unreadable };
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');

function cardData({ gym = {}, permission = 'anonymous', result, date, member = {}, business = {}, madeWith127 = true }) {
  const named = permission === 'named';
  const kind = CATEGORY_LABEL[gym.category] || 'gym';
  const who = named ? gym.name : `A ${kind}${gym.city ? ` in ${gym.city}` : ''}`;
  const big = result.change != null && result.change >= 10 ? `+${result.change}%` : null;
  return {
    named,
    who,
    kind,
    big,
    headline: big ? `${big} views per Reel` : 'More views per Reel',
    before: { label: `Before: their last ${result.before.n} Reels`, value: result.before.avg },
    after: { label: `After: the first ${result.after.n} Reel${result.after.n > 1 ? 's' : ''} ${member.firstName ? `${member.firstName} made` : 'I made'}`, value: result.after.avg },
    fine: 'Average views per Reel. The new Reels are the newest, so they have had the least time to collect views.',
    footer: plain(`${member.firstName ? `Made by ${member.firstName}` : 'Made'}${business.name ? ` of ${business.name}` : ''}. Counted from ${named ? `${gym.name}'s` : 'the gym’s'} Reels tab on ${date}.`).replace('’', "'"),
    madeWith127,
  };
}

const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function svgCard(d, { accent = '#b9a8ff', width = 1080, height = 1350 } = {}) {
  const A = /^#[0-9a-f]{6}$/i.test(accent) ? readable(accent) : '#b9a8ff';
  const W = width;
  const pad = 72;
  const maxW = W - pad * 2;
  const font = "'Inter', 'DejaVu Sans', sans-serif";
  const parts = [];
  const text = (x, y, size, weight, fill, t, extra = '') => parts.push(`<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}"${extra}>${esc(t)}</text>`);
  let y = 110;
  text(pad, y, 24, 600, '#9a9aa3', 'BEFORE AND AFTER', ' letter-spacing="6"');
  text(W - pad, y, 24, 600, '#6f6f78', d.kind.toUpperCase(), ' letter-spacing="3" text-anchor="end"');
  let size = 64;
  let lines = wrap(d.who, size, maxW, 0.56);
  while (lines.length > 2 && size > 40) {
    size -= 6;
    lines = wrap(d.who, size, maxW, 0.56);
  }
  y += 34;
  for (const l of lines.slice(0, 2)) {
    y += size + 6;
    const est = l.length * size * 0.56;
    text(pad, y, size, 900, '#f4f4f6', l, est > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '');
  }
  // The headline number
  y += 200;
  if (d.big) {
    text(pad - 6, y, 190, 900, A, d.big);
    text(pad, y + 64, 40, 700, '#ececf0', 'views per Reel');
    y += 64;
  } else text(pad, y - 40, 72, 900, A, d.headline);
  // Two bars, scaled to the bigger number, centered between the headline and the fine print
  const ctaY = height - 150;
  const barH = 84;
  const block = 2 * (30 + barH) + 90;
  y += Math.max(110, Math.round((ctaY - 40 - y - block) / 2)) + 30;
  const top = Math.max(d.before.value, d.after.value, 1);
  const bars = [
    { label: d.before.label, value: d.before.value, fill: '#3a3a42', valueFill: '#c9c9d1' },
    { label: d.after.label, value: d.after.value, fill: A, valueFill: '#f4f4f6' },
  ];
  for (const b of bars) {
    text(pad, y, 30, 600, '#ececf0', b.label);
    y += 30;
    const w = Math.max(16, Math.round(((maxW - 240) * b.value) / top));
    parts.push(`<rect x="${pad}" y="${y}" width="${w}" height="${barH}" rx="16" fill="${b.fill}"/>`);
    text(pad + w + 24, y + 60, 56, 900, b.valueFill, fmt(b.value));
    y += barH + 90;
  }
  // The fine print and the footer, pinned to the bottom
  wrap(d.fine, 24, maxW).slice(0, 2).forEach((l, i) => text(pad, ctaY + i * 32, 24, 400, '#8c8c95', l));
  const foot = wrap(d.footer, 21, maxW - (d.madeWith127 ? 230 : 0));
  foot.slice(0, 2).forEach((l, i) => text(pad, ctaY + 76 + i * 28, 21, 400, '#6f6f78', l));
  if (d.madeWith127) text(W - pad, ctaY + 104, 21, 600, '#6f6f78', 'MADE WITH 127', ' letter-spacing="2" text-anchor="end"');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">`,
    '<defs>',
    `<radialGradient id="glow" cx="0.92" cy="0.05" r="0.75"><stop offset="0" stop-color="${A}" stop-opacity="0.32"/><stop offset="1" stop-color="${A}" stop-opacity="0"/></radialGradient>`,
    '</defs>',
    `<rect width="${W}" height="${height}" fill="#0c0c0e"/>`,
    `<rect width="${W}" height="${height}" fill="url(#glow)"/>`,
    `<rect x="24" y="24" width="${W - 48}" height="${height - 48}" rx="36" fill="none" stroke="#24242a" stroke-width="2"/>`,
    ...parts,
    '</svg>',
  ].join('\n');
}

module.exports = { READ_SCHEMA, READ_SYSTEM, compare, viewsFromRead, cardData, svgCard };
