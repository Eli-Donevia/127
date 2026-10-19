// A sample week of posts for one restaurant or cafe, built only from what its own website says
// (dishes and prices as printed, hours, offer, colors), dated. Three designed posts (1080 x 1350,
// 4:5), captions with up to 5 hashtags, and one Reel shot list. Every graphic carries a small
// "Sample" tag: it is a sample for the owner, never presented as their account.

const { text, color, files, svg, time } = require('../../_kit');
const niche = require('../data/niche.json');

const GENERIC = /^(home|about|about us|contact|contact us|hours|location|locations|find us|follow us|menu|our menu|order online|order now|gallery|reviews?|testimonials?|catering|careers|gift cards?|events?|reservations?|welcome|news|blog|faq|private events|join our list|newsletter)$/i;

// "Carnitas tacos $13" -> { name: 'Carnitas tacos', price: '$13' } from a scan price, or null.
function dishFrom(p) {
  const ctx = text.oneLine(p.context || '');
  const at = ctx.search(new RegExp(`\\$\\s?${String(p.amount).replace('.', '\\.')}(?![\\d])`));
  if (at < 0) return null;
  const words = ctx.slice(0, at).split(/[.!?:;|,]/).pop().trim().split(/\s+/).slice(-4);
  while (words.length && /^(pricing|prices|menu|our|and|or|the|from|only|just|\$?\d+(\.\d+)?)$/i.test(words[0])) words.shift();
  const from = /\sfrom$/i.test(words.join(' '));
  const name = words.join(' ').replace(/\s+from$/i, '').trim();
  if (name.length < 3 || name.length > 32 || !/^[A-Za-z]/.test(name) || /\b(free|off|delivery|minimum|tax|tip|fee|shipping|gift card)\b/i.test(name)) return null;
  const amt = Number(p.amount);
  return { name: name.replace(/^\w/, (c) => c.toUpperCase()), price: `${from ? 'from ' : ''}$${Number.isInteger(amt) ? amt : amt.toFixed(2)}` };
}

function factsFrom({ lead = {}, scan = null, name = '', city = '', today = '2026-10-19' } = {}) {
  const L = require('../../_kit').leads;
  const s = scan && scan.reachable && !scan.parked ? scan : null;
  const biz = text.oneLine(name || L.exportName(lead) || (s && L.siteName(s)) || '');
  const dishes = [];
  for (const p of (s && s.prices) || []) {
    const d = dishFrom(p);
    if (d && !dishes.some((x) => x.name.toLowerCase() === d.name.toLowerCase())) dishes.push(d);
    if (dishes.length >= 3) break;
  }
  const headings = ((s && s.headings) || []).map((h) => text.oneLine(h).replace(/[:.!]+$/, '')).filter((h) => h.length >= 3 && h.length <= 32 && !GENERIC.test(h) && !/\d{3}|©|@/.test(h) && (!biz || h.toLowerCase() !== biz.toLowerCase()));
  const rawHours = s && s.hours ? text.oneLine(s.hours).replace(/^(our )?hours:?\s*/i, '') : '';
  const hours = /\d/.test(rawHours) && /(\bto\b|-|until|till)/i.test(rawHours) && /(mon|tue|wed|thu|fri|sat|sun|daily|every day)/i.test(rawHours) ? text.clip(rawHours, 70) : '';
  const offer = s && s.offer && s.offer.kind !== 'none' && s.offer.text ? text.clip(text.oneLine(s.offer.text), 70) : '';
  const order = s && s.booking && s.booking.length ? text.oneLine(s.booking[0].name || s.booking[0]) : '';
  const ig = (s && s.socials && s.socials.instagram) || '';
  const place = text.oneLine(city || lead.city || '');
  const town = place.split(',')[0].trim();
  const found = [];
  if (dishes.length) found.push(`Dishes and prices as printed on their site: ${dishes.map((d) => `${d.name} ${d.price}`).join(', ')}.`);
  if (hours) found.push(`Hours: ${hours}.`);
  if (offer) found.push(`Offer on their site: "${offer}"`);
  if (order) found.push(`Takes orders or bookings through ${order}.`);
  if (ig) found.push(`Instagram linked from their site: @${ig}.`);
  if (s && s.colors && s.colors.primary) found.push(`Brand color from their site: ${s.colors.primary}.`);
  return {
    name: biz,
    nameKnown: !!biz,
    town,
    city: place,
    dishes,
    headings: headings.slice(0, 3),
    hours,
    offer,
    order,
    instagram: ig,
    primary: (s && s.colors && s.colors.primary) || null,
    foundOn: time.longDate(today),
    found,
    sample: !!(lead.sample || (scan && scan.sample)),
    website: (s && s.url) || lead.website || '',
  };
}

function paletteOf(f) {
  const p = color.palette(f.primary && color.isHex(f.primary) ? f.primary : 'warm');
  return { ...p, from: f.primary ? 'their website' : 'a warm starter palette (no brand color found on their site)' };
}

const tagOf = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '');

function hashtags(f, extra = []) {
  const t = tagOf(f.town);
  const list = [t && `#${t}Eats`, t && `#${t}Food`, ...extra.map((x) => `#${tagOf(x)}`), f.instagram ? `#${tagOf(f.instagram)}` : f.name ? `#${tagOf(f.name)}` : ''].filter((x) => x && x.length > 2);
  return [...new Set(list)].slice(0, niche.post.hashtags_max);
}

// The 3 posts of the week: facts first, a plain fallback when their site gave us little.
function posts(f) {
  const name = f.name || 'your spot';
  const where = f.town ? ` in ${f.town}` : '';
  const days = niche.post.days;
  const d0 = f.dishes[0];
  const d1 = f.dishes[1];
  const out = [];
  out.push(
    d0
      ? { day: days[0], kind: 'Favorite', title: d0.name, big: d0.name, small: `${d0.price} on our menu`, caption: `${d0.name}, ${d0.price} on our menu. Who are you bringing this week?`, tags: hashtags(f, [d0.name.split(' ')[0]]), shot: `Your ${d0.name.toLowerCase()} from above in window light, on the plate you serve it on.` }
      : { day: days[0], kind: 'Favorite', title: 'Your best seller', big: 'What do you order every time?', small: `Tell us below${f.name ? `, ${name} regulars` : ''}`, caption: `What do you order every time you come in? Tell us below.`, tags: hashtags(f), shot: 'Your best seller from above in window light.', sampleText: true }
  );
  out.push(
    f.hours
      ? { day: days[1], kind: 'Come in', title: 'Open hours', big: 'Come hungry', small: `Open ${f.hours}`, caption: `We're open ${f.hours}. See you soon${where}.`, tags: hashtags(f), shot: 'The front door or the sign, from across the street.' }
      : d1
        ? { day: days[1], kind: 'Save this', title: d1.name, big: d1.name, small: `${d1.price} on our menu`, caption: `${d1.name}, ${d1.price}. Save this for your next visit.`, tags: hashtags(f, [d1.name.split(' ')[0]]), shot: `Hands plating the ${d1.name.toLowerCase()}, close.` }
        : { day: days[1], kind: 'Come in', title: 'Visit', big: `See you${where}`, small: name, caption: `Come see us${where}. Save this for your next night out.`, tags: hashtags(f), shot: 'The room from the door, with people at the tables who agreed to be in it.' }
  );
  out.push(
    f.offer
      ? { day: days[2], kind: 'Reason to come in', title: 'This week', big: f.offer, small: name, caption: `${f.offer}. Tag who you're bringing this weekend.`, tags: hashtags(f), shot: 'The dish the offer is about, with a hand reaching in.' }
      : f.order
        ? { day: days[2], kind: 'Order ahead', title: 'Order ahead', big: 'Skip the wait', small: `Order ahead on ${f.order}`, caption: `Skip the wait this weekend: order ahead through ${f.order}. Link in bio.`, tags: hashtags(f), shot: 'A to-go bag on the counter, the name on the sticker.' }
        : { day: days[2], kind: 'Weekend', title: 'Weekend', big: 'Weekend plans?', small: name, caption: `Weekend plans? Tag who you're bringing${where}.`, tags: hashtags(f), shot: 'A full table from above, plates in, hands reaching.' }
  );
  return out.map((p) => ({ ...p, caption: text.plain(p.caption), text: `${text.plain(p.caption)}\n\n${p.tags.join(' ')}` }));
}

function reel(f) {
  const d = f.dishes[0] ? f.dishes[0].name.toLowerCase() : 'best seller';
  const name = f.name || 'your spot';
  return [
    { at: '0 to 2s', shot: `On screen: "POV: your ${d} at ${name}"`, how: 'Phone at eye level, the plate landing on the table.' },
    { at: '2 to 6s', shot: `Hands plating the ${d}`, how: 'Close, from the side, window light. One cut on the beat.' },
    { at: '6 to 10s', shot: 'The first bite or the pour', how: 'Slow, close, no talking. Ask first; only staff or guests who agreed.' },
    { at: '10 to 13s', shot: 'The room and the sign', how: 'A slow pan from the counter to the door.' },
    { at: '13 to 15s', shot: `End card: ${name}${f.hours ? `, open ${f.hours}` : ''}`, how: 'Their colors, the name big. Use original sound or a Meta Sound Collection track (business accounts).' },
  ].map((r) => ({ at: r.at, shot: text.plain(r.shot), how: text.plain(r.how) }));
}

// One post as SVG, 1080 x 1350, in their colors. Words stay in the middle 3:4 area for the grid.
function postSvg(post, f, p, i) {
  const W = 1080;
  const H = 1350;
  const bg = i === 1 ? p.ink : p.primary;
  const fg = color.readableOn(bg);
  const parts = [];
  parts.push(svg.rect({ x: 0, y: 0, w: W, h: H, fill: bg }));
  parts.push(svg.circle({ cx: W - 120, cy: 210, r: 260, fill: p.accent, opacity: 0.22 }));
  parts.push(svg.circle({ cx: 140, cy: H - 160, r: 200, fill: p.accent, opacity: 0.16 }));
  parts.push(svg.pill({ x: 90, y: 150, label: post.kind.toUpperCase(), size: 28, fill: p.accent, color: p.onAccent }).svg);
  const big = svg.fit(post.big, { width: W - 180, height: 520, maxSize: 132, minSize: 56, maxLines: 4, weight: 800 });
  const top = 330;
  parts.push(svg.text({ x: 90, y: top + big.size, lines: big.lines, size: big.size, weight: 800, fill: fg, lineHeight: 1.05 }));
  const y2 = top + big.size + big.lines.length * Math.round(big.size * 1.05) + 40;
  const small = svg.fit(post.small, { width: W - 180, height: 140, maxSize: 52, minSize: 30, maxLines: 2, weight: 600 });
  parts.push(svg.text({ x: 90, y: y2, lines: small.lines, size: small.size, weight: 600, fill: fg, opacity: 0.92, lineHeight: 1.15 }));
  parts.push(svg.line({ x1: 90, y1: H - 210, x2: W - 90, y2: H - 210, stroke: fg, strokeWidth: 2, opacity: 0.35 }));
  parts.push(svg.text({ x: 90, y: H - 150, lines: [text.clip(f.instagram ? `@${f.instagram}` : f.name || 'Your name here', 34)], size: 40, weight: 700, fill: fg }));
  if (f.town) parts.push(svg.text({ x: 90, y: H - 100, lines: [f.town], size: 30, weight: 500, fill: fg, opacity: 0.8 }));
  parts.push(svg.pill({ x: W - 250, y: 60, label: 'SAMPLE', size: 24, fill: '#ffffff', color: '#111111' }).svg);
  return svg.doc({ width: W, height: H, body: parts.join(''), title: `${f.name || 'Sample'} post ${i + 1}` });
}

// The whole sample week as one page (inline SVG, no scripts).
function weekHtml(f, list, shots, svgs, { by = '' } = {}) {
  const esc = files.esc;
  const p = paletteOf(f);
  const cards = list
    .map((post, i) => `<div class="card"><div class="art">${svgs[i].replace('<svg ', '<svg role="img" aria-label="Sample post" ')}</div><h3>${esc(post.day)}: ${esc(post.kind)}</h3><p class="cap">${esc(post.caption)}</p><p class="tags">${esc(post.tags.join(' '))}</p><p class="small">Photo to shoot: ${esc(post.shot)}</p></div>`)
    .join('');
  const rows = shots.map((r) => `<tr><td>${esc(r.at)}</td><td>${esc(r.shot)}</td><td>${esc(r.how)}</td></tr>`).join('');
  const css = `body{margin:0;font-family:Inter,Arial,sans-serif;color:${p.ink};background:${p.paper}}main{max-width:980px;margin:0 auto;padding:24px 18px}
.banner{background:#111;color:#fff;padding:10px 16px;font-size:14px;text-align:center}h1{font-size:28px;margin:6px 0}h2{font-size:20px;margin:26px 0 10px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.card{background:#fff;border:1px solid ${p.line};border-radius:14px;padding:12px}
.art svg{width:100%;height:auto;border-radius:10px;display:block}.card h3{margin:10px 0 4px;font-size:16px}.cap{margin:0 0 6px}.tags{color:${p.primary};margin:0 0 6px;font-size:14px}
.small{font-size:13px;color:${p.muted}}table{width:100%;border-collapse:collapse;background:#fff}td{border:1px solid ${p.line};padding:8px;vertical-align:top;font-size:14px}@page{size:Letter;margin:0.5in}`;
  const body = `<div class="banner">A sample week made for ${esc(f.name || 'you')} by ${esc(by || 'a local social media manager')} on ${esc(f.foundOn)}, from what your website says. Not posted anywhere.</div>
<main><h1>A week of posts for ${esc(f.name || 'your restaurant')}</h1><p>3 posts and 1 Reel, in your colors, from your own menu and site. Post Monday, Wednesday and Friday.</p>
<div class="grid">${cards}</div><h2>The Reel (15 seconds, shot on a phone)</h2><table>${rows}</table>
<p class="small">Facts used, as found on ${esc(f.foundOn)}: ${esc(f.found.join(' ') || 'Their site gave us little to read, so the posts use plain lines you can fill in.')}</p></main>`;
  return files.htmlDoc({ title: `Sample week for ${f.name || 'your restaurant'}`, css, body });
}

module.exports = { dishFrom, factsFrom, paletteOf, posts, reel, postSvg, weekHtml, hashtags };
