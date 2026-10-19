// The shot list for one local business: what the photos on its own homepage show today (read from
// each photo's alt text and file name, dated), what's missing, the shots to take first, and a mood
// board described in words (drawn as tiles in their colors). Nothing is claimed about a photo we
// couldn't read: unknown photos are counted as unknown.

const { text, color, files, svg, time } = require('../../_kit');
const niche = require('../data/niche.json');

const SUBJECT = [
  ['people', /team|staff|owner|chef|barber|stylist|doctor|\bdr[-_ ]|crew|founder|portrait|headshot|about|family|our-people|employee|agent/i],
  ['outside', /exterior|storefront|store-front|front|building|outside|sign|patio|street|facade/i],
  ['space', /interior|dining|room|inside|counter|lobby|studio|salon|office|shop-floor|space|bar-area|seating|gym-floor/i],
  ['action', /making|prep|kitchen|cooking|pour|working|process|install|repair|in-action|behind|bts|training|class/i],
  ['product', /dish|food|plate|menu|pizza|taco|burger|coffee|latte|cake|pastry|bread|product|haircut|color|nails|car|kitchen-remodel|listing|home|cocktail|drink|dessert|salad|bowl|sandwich|wings|sushi|steak/i],
];

function imgsFrom(html) {
  const out = [];
  for (const tag of String(html || '').match(/<img\b[^>]*>/gi) || []) {
    const src = (tag.match(/\ssrc=["']([^"']+)["']/i) || [])[1] || '';
    const alt = (tag.match(/\salt=["']([^"']*)["']/i) || [])[1] || '';
    if (!src || /logo|icon|sprite|favicon|badge|avatar|pixel|1x1|blank|placeholder/i.test(`${src} ${alt}`)) continue;
    out.push({ src, alt: text.oneLine(alt) });
  }
  return out;
}

function subjectOf(img) {
  const hay = `${img.alt} ${String(img.src).split('/').pop()}`;
  for (const [id, re] of SUBJECT) if (re.test(hay)) return id;
  return 'unknown';
}

function familyOf(words) {
  return /restaurant|cafe|bakery|bar|food|coffee|pizza|taco|grill|kitchen|bistro|diner|eats/i.test(String(words || '')) ? 'food' : 'other';
}

function analyze({ lead = {}, scan = null, html = '', name = '', city = '', today = '2026-10-19' } = {}) {
  const L = require('../../_kit').leads;
  const s = scan && scan.reachable && !scan.parked ? scan : null;
  const biz = text.oneLine(name || L.exportName(lead) || (s && L.siteName(s)) || '');
  const imgs = imgsFrom(html);
  const counts = { people: 0, product: 0, action: 0, space: 0, outside: 0, unknown: 0 };
  for (const im of imgs) counts[subjectOf(im)] += 1;
  const total = s ? s.imageCount || imgs.length : 0;
  const fam = familyOf(`${(lead.category && lead.category.id) || ''} ${(lead.category && lead.category.what) || ''} ${biz} ${(s && s.title) || ''}`);
  const known = imgs.length - counts.unknown;
  const shows = [];
  if (!s) shows.push(lead.website ? "We couldn't read the website, so this list covers the shots most places like this one use." : 'No website on the listing, so every shot on this list is new.');
  else {
    shows.push(`The homepage has ${total} image${total === 1 ? '' : 's'}${s.imagesWithoutAlt ? `, ${s.imagesWithoutAlt} without alt text` : ''}.`);
    if (known) shows.push(`From the photo names and alt text: ${Object.entries(counts).filter(([k, n]) => k !== 'unknown' && n).map(([k, n]) => `${n} of ${niche.subjects[k]}`).join(', ')}.`);
    if (counts.unknown) shows.push(`${counts.unknown} photo${counts.unknown === 1 ? ' has' : 's have'} no name or alt text that says what ${counts.unknown === 1 ? 'it shows' : 'they show'}.`);
    if (s.video && !s.video.onSite && !s.video.unknown) shows.push('No video on the homepage.');
  }
  const lacks = s && known >= 2 ? Object.keys(niche.subjects).filter((k) => !counts[k]) : [];
  const list = niche.shots[fam] || niche.shots.other;
  const ordered = [...list.filter((x) => lacks.includes(x[0])), ...list.filter((x) => !lacks.includes(x[0]))].slice(0, 10);
  const shots = ordered.map(([subject, shot, how, use], i) => ({ n: i + 1, shot: text.plain(shot), how: text.plain(how), use: text.plain(use), fills: lacks.includes(subject) ? `Missing today: ${niche.subjects[subject]}` : '' }));
  const place = text.oneLine(city || lead.city || '');
  return {
    name: biz,
    nameKnown: !!biz,
    family: fam,
    town: place.split(',')[0].trim(),
    total,
    counts,
    shows,
    lacks: lacks.map((k) => niche.subjects[k]),
    shots,
    primary: (s && s.colors && s.colors.primary) || null,
    foundOn: time.longDate(today),
    sample: !!(lead.sample || (scan && scan.sample)),
  };
}

function paletteOf(a) {
  const p = color.palette(a.primary && color.isHex(a.primary) ? a.primary : 'earthy');
  return { ...p, from: a.primary ? 'their website' : 'a starter palette (no brand color found on their site)' };
}

// The mood board: 6 tiles, each a shot described in words, in their colors (1080 x 1350).
function boardSvg(a, p) {
  const W = 1080;
  const H = 1350;
  const parts = [svg.rect({ x: 0, y: 0, w: W, h: H, fill: p.paper })];
  const head = svg.fit(`Shot list for ${a.name || 'your business'}`, { width: W - 120, height: 120, maxSize: 60, minSize: 34, maxLines: 2, weight: 800 });
  parts.push(svg.text({ x: 60, y: 60 + head.size, lines: head.lines, size: head.size, weight: 800, fill: p.ink, lineHeight: 1.08 }));
  const top = 60 + head.size + head.lines.length * Math.round(head.size * 1.08) + 20;
  parts.push(svg.text({ x: 60, y: top, lines: [`Mood board in words. Made ${a.foundOn}.`], size: 26, weight: 500, fill: p.muted }));
  const tiles = a.shots.slice(0, 6);
  const cols = 2;
  const gap = 24;
  const tw = (W - 120 - gap) / cols;
  const th = (H - top - 60 - gap * 2) / 3;
  const fills = [p.primary, p.accent, p.ink, p.surface, color.mix(p.primary, '#ffffff', 0.35), color.mix(p.accent, '#000000', 0.25)];
  tiles.forEach((t, i) => {
    const x = 60 + (i % cols) * (tw + gap);
    const y = top + 30 + Math.floor(i / cols) * (th + gap);
    const bg = fills[i % fills.length];
    const fg = color.readableOn(bg);
    parts.push(svg.rect({ x, y, w: tw, h: th, r: 22, fill: bg }));
    parts.push(svg.text({ x: x + 28, y: y + 56, lines: [String(t.n).padStart(2, '0')], size: 34, weight: 800, fill: fg, opacity: 0.7 }));
    const title = svg.fit(t.shot, { width: tw - 56, height: 120, maxSize: 40, minSize: 24, maxLines: 3, weight: 800 });
    parts.push(svg.text({ x: x + 28, y: y + 80 + title.size, lines: title.lines, size: title.size, weight: 800, fill: fg, lineHeight: 1.08 }));
    const howY = y + 80 + title.size + title.lines.length * Math.round(title.size * 1.08) + 14;
    const how = svg.wrap(t.how, { width: tw - 56, size: 22 }).slice(0, 3);
    parts.push(svg.text({ x: x + 28, y: howY, lines: how, size: 22, weight: 500, fill: fg, opacity: 0.9, lineHeight: 1.25 }));
    if (t.fills) parts.push(svg.text({ x: x + 28, y: y + th - 26, lines: ['Missing on their site today'], size: 20, weight: 700, fill: fg }));
  });
  return svg.doc({ width: W, height: H, body: parts.join(''), title: `Shot list for ${a.name || 'your business'}` });
}

function pageHtml(a, boardSvgText, { by = '' } = {}) {
  const esc = files.esc;
  const p = paletteOf(a);
  const rows = a.shots.map((s) => `<tr><td>${s.n}</td><td><b>${esc(s.shot)}</b>${s.fills ? `<br><span class="miss">${esc(s.fills)}</span>` : ''}</td><td>${esc(s.how)}</td><td>${esc(s.use)}</td></tr>`).join('');
  const css = `body{margin:0;font-family:Inter,Arial,sans-serif;color:${p.ink};background:${p.paper}}main{max-width:900px;margin:0 auto;padding:24px 18px}
.banner{background:#111;color:#fff;padding:10px 16px;font-size:14px;text-align:center}h1{font-size:28px;margin:6px 0}h2{font-size:20px;margin:24px 0 10px}
.box{background:${p.surface};border-radius:14px;padding:14px 16px}table{width:100%;border-collapse:collapse;background:#fff}td{border:1px solid ${p.line};padding:8px;vertical-align:top;font-size:14px}
.miss{color:${p.primary};font-size:13px;font-weight:600}.board svg{width:100%;height:auto;border-radius:12px}@page{size:Letter;margin:0.5in}`;
  const body = `<div class="banner">A shot list made for ${esc(a.name || 'you')} by ${esc(by || 'a local photographer')} on ${esc(a.foundOn)}, from what your website shows today. Nothing here is posted anywhere.</div>
<main><h1>Shot list for ${esc(a.name || 'your business')}</h1><h2>What your site shows today</h2><div class="box">${a.shows.map((x) => `<p>${esc(x)}</p>`).join('')}${a.lacks.length ? `<p><b>Missing:</b> ${esc(a.lacks.join(', '))}.</p>` : ''}</div>
<h2>The ${a.shots.length} shots I'd take, in order</h2><table>${rows}</table><h2>Mood board</h2><div class="board">${boardSvgText}</div></main>`;
  return files.htmlDoc({ title: `Shot list for ${a.name || 'your business'}`, css, body });
}

module.exports = { imgsFrom, subjectOf, analyze, paletteOf, boardSvg, pageHtml, familyOf };
