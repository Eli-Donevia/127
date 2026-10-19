// A 1080 x 1350 card for the missed-call plan: the business name, what a caller can't find on the
// website, and the text their number would send. Sent as a picture in the follow-up message.

const kit = require('../../_kit');
const svg = kit.svg;
const { colorsFor } = require('./pages');

function auditCard({ name, rows, text, checked, domain, hex, inside = [] }) {
  const W = 1080;
  const H = 1350;
  const p = colorsFor(name, hex);
  const parts = [];
  parts.push(svg.rect({ x: 0, y: 0, w: W, h: 16, fill: p.primary }));
  parts.push(svg.text({ x: 72, y: 110, lines: ['MISSED-CALL PLAN'], size: 28, weight: 700, fill: p.primary, letterSpacing: 3 }));
  const head = svg.fit(`When ${name} misses a call`, { width: W - 144, height: 200, maxSize: 76, minSize: 40, maxLines: 3, weight: 800 });
  parts.push(svg.text({ x: 72, y: 110 + 30 + head.size, lines: head.lines, size: head.size, weight: 800, fill: p.ink, lineHeight: 1.08 }));
  let y = 110 + 30 + head.size + head.lines.length * Math.round(head.size * 1.08) + 30;
  const missing = rows.filter((r) => !r.ok).slice(0, 3);
  const found = rows.filter((r) => r.ok).slice(0, Math.max(0, 3 - missing.length));
  for (const r of [...missing, ...found]) {
    const mark = r.ok ? 'Yes' : 'Fix';
    const pl = svg.pill({ x: 72, y: y - 34, label: mark, size: 24, fill: r.ok ? '#14632f' : '#a12a1a', color: '#ffffff' });
    parts.push(pl.svg);
    const line = svg.fit(`${r.item}: ${r.ok ? 'on your website' : r.found}`, { width: W - 144 - pl.width - 24, height: 90, maxSize: 34, minSize: 24, maxLines: 2, weight: 500 });
    parts.push(svg.text({ x: 72 + pl.width + 24, y, lines: line.lines, size: line.size, weight: 500, fill: p.ink }));
    y += Math.max(70, line.lines.length * Math.round(line.size * 1.15) + 34);
  }
  y += 10;
  parts.push(svg.text({ x: 72, y, lines: ['The text your number would send:'], size: 30, weight: 600, fill: p.muted }));
  y += 28;
  const bubble = svg.fit(text, { width: W - 144 - 170, height: 420, maxSize: 38, minSize: 24, maxLines: 9, weight: 500 });
  const bh = bubble.lines.length * Math.round(bubble.size * 1.25) + 56;
  parts.push(svg.rect({ x: 72, y, w: W - 144, h: bh, r: 28, fill: p.primary }));
  parts.push(svg.text({ x: 104, y: y + 28 + bubble.size, lines: bubble.lines, size: bubble.size, weight: 500, fill: p.onPrimary, lineHeight: 1.25 }));
  y += bh + 64;
  if (inside.length) {
    parts.push(svg.text({ x: 72, y, lines: ['Also in the full plan:'], size: 30, weight: 600, fill: p.muted }));
    y += 50;
    for (const line of inside.slice(0, 4)) {
      if (y > H - 110) break;
      parts.push(svg.circle({ cx: 86, cy: y - 10, r: 9, fill: p.primary }));
      parts.push(svg.text({ x: 112, y, lines: [line], size: 30, weight: 500, fill: p.ink }));
      y += 48;
    }
  }
  parts.push(svg.text({ x: 72, y: H - 56, lines: [`Written from ${domain || 'your website'} on ${checked}.`], size: 24, weight: 400, fill: p.muted }));
  return svg.doc({ width: W, height: H, background: p.paper, body: parts.join(''), title: `Missed-call plan for ${name}` });
}

module.exports = { auditCard };
