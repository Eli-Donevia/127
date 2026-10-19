// Flyer copy as plain text the member can edit in an approve step, and back again.
//   Headline: Your car, detailed in your driveway.
//   Line: Mobile detailing around Austin, on your schedule.
//   - Hand wash, wax and tire shine
//   Offer: First visit $20 off
//   Button: Scan to book

const { text } = require('../../_kit');

function toText(c) {
  return [
    `Headline: ${c.headline}`,
    c.sub ? `Line: ${c.sub}` : '',
    ...(c.bullets || []).map((b) => `- ${b}`),
    c.offerText ? `Offer: ${c.offerText}` : '',
    c.cta ? `Button: ${c.cta}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function fromText(s) {
  const c = { headline: '', sub: '', bullets: [], offerText: '', cta: '' };
  for (const raw of String(s || '').split(/\n+/)) {
    const l = raw.trim();
    if (!l) continue;
    let m;
    if ((m = l.match(/^headline\s*:\s*(.+)$/i))) c.headline = m[1];
    else if ((m = l.match(/^(line|sub|subhead)\s*:\s*(.+)$/i))) c.sub = m[2];
    else if ((m = l.match(/^offer\s*:\s*(.*)$/i))) c.offerText = m[1];
    else if ((m = l.match(/^(button|cta)\s*:\s*(.+)$/i))) c.cta = m[2];
    else if ((m = l.match(/^[-*]\s*(.+)$/))) c.bullets.push(m[1]);
    else if (!c.headline) c.headline = l;
    else if (!c.sub) c.sub = l;
    else c.bullets.push(l);
  }
  c.headline = text.clip(text.plain(c.headline), 90);
  c.sub = text.clip(text.plain(c.sub), 140);
  c.bullets = c.bullets.map((b) => text.clip(text.plain(b), 70)).slice(0, 3);
  c.offerText = text.clip(text.plain(c.offerText), 60);
  c.cta = text.clip(text.plain(c.cta), 28);
  return c;
}

// "First visit $20 off" -> { top: 'First visit', big: '$20 off', bottom: '' }
function offerParts(s) {
  const t = text.plain(s || '').trim();
  if (!t) return null;
  const m = t.match(/(\$\s?\d+(?:\.\d\d)?(?:\s?off)?|\d{1,2}\s?% off|free)/i);
  if (m) {
    const before = t.slice(0, m.index).replace(/[\s:,-]+$/, '').trim();
    const after = t.slice(m.index + m[0].length).replace(/^[\s:,-]+/, '').trim();
    const big = /^free$/i.test(m[0]) ? 'FREE' : m[0].replace(/\s+/g, ' ');
    return { top: text.clip(before, 26), big, bottom: text.clip(after, 30) };
  }
  const words = t.split(/\s+/);
  return { top: '', big: words.slice(0, 2).join(' '), bottom: text.clip(words.slice(2).join(' '), 30) };
}

// Accepts the approve output, an item, a list of items, an object with headline, or edited text.
function normalize(copy) {
  let c = copy;
  if (c && Array.isArray(c.chosen) && c.chosen.length) c = c.chosen[0];
  else if (c && Array.isArray(c.items) && c.items.length) c = c.items[0];
  if (Array.isArray(c)) c = c[0];
  if (typeof c === 'string') return fromText(c);
  if (c && typeof c === 'object') {
    if (typeof c.text === 'string' && c.text.trim()) return fromText(c.text);
    if (c.headline) return fromText(toText({ ...c, offerText: c.offerText || c.offer || '' }));
  }
  return null;
}

module.exports = { toText, fromText, offerParts, normalize };
