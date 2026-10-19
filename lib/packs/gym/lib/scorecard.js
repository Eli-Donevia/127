// The free Video Scorecard: one image (and a web page) the member sends a gym owner with the sample
// Reel. A lead magnet that works reveals a problem the owner didn't know they had, gives real value
// even if they never buy, and makes the next step obvious. Every line is a fact we checked on their
// public website or Instagram, or it says "not checked". No prices, no promises.

const { plain } = require('./util');
const { CATEGORY_LABEL } = require('./gaps');

const LABELS = { Strong: 'Strong', Okay: 'Solid', Weak: 'Room to grow' };

// A card's accent: the gym's own brand color when its website shows one, else one per kind of gym.
const ACCENTS = { gym: '#b9a8ff', crossfit: '#ff8a3d', yoga: '#9ad0b5', pilates: '#f2b8c6', boxing: '#ff5a5a', martial_arts: '#ffcf4a', climbing: '#7cc4ff', cycling: '#c08bff', dance: '#ff7ad9', other: '#b9a8ff' };
const accentFor = (row = {}) => (row.site && row.site.colors && row.site.colors.primary) || ACCENTS[(row.gym || row).category] || ACCENTS.other;

function checksFor(row) {
  const s = row.site && row.site.reachable !== false && row.site.url ? row.site : null;
  const own = s && !s.brandSite ? s : null;
  const ig = row.insta && !row.insta.unavailable ? row.insta : null;
  const gapIds = new Set((row.gaps || []).map((g) => g.id));
  const contact = row.contact || {};
  const out = [];
  if (own) {
    out.push({ label: 'Video on your website', status: own.video && own.video.onSite ? 'yes' : own.video && own.video.unknown ? 'unknown' : 'no' });
    out.push({ label: 'Instagram linked from your website', status: own.socials && own.socials.instagram ? 'yes' : 'no' });
  }
  if (ig && Number.isFinite(ig.daysSinceLastPost)) out.push({ label: 'Posted in the last 2 weeks', status: ig.daysSinceLastPost <= 14 ? 'yes' : 'no', note: `last post ${ig.daysSinceLastPost} day${ig.daysSinceLastPost === 1 ? '' : 's'} ago` });
  else out.push({ label: 'Posted in the last 2 weeks', status: 'unknown', note: 'not checked' });
  if (ig && Number.isFinite(ig.reelsShare)) {
    const n = ig.sampled || 12;
    out.push({ label: 'Mostly Reels, not photos', status: ig.reelsShare >= 0.5 ? 'yes' : 'no', note: `${Math.round(ig.reelsShare * n)} of your last ${n} posts` });
  }
  const tiktok = contact.tiktok || (own && own.socials && own.socials.tiktok);
  if (tiktok || own) out.push({ label: 'On TikTok', status: tiktok ? 'yes' : 'no' });
  if (own) out.push({ label: 'Member stories on your website', status: own.testimonials ? 'yes' : 'no' });
  if (gapIds.has('coaches')) out.push({ label: 'Coaches on video', status: 'no', note: 'team page has names, no videos' });
  if (gapIds.has('offer') && own && own.offer && own.offer.text) out.push({ label: 'Your intro offer on video', status: 'no', note: `"${own.offer.text}" is only text` });
  return out.slice(0, 7);
}

// row: one ranked gym from gym.find_gaps. Returns plain data for the image and the page.
function scorecardData(row, { member = {}, business = {}, date, madeWith127 = true } = {}) {
  const g = row.gym || {};
  const c = row.content || {};
  const comps = (row.competitors || []).filter((x) => typeof x.video === 'boolean');
  const withVideo = comps.filter((x) => x.video);
  return {
    gym: g.name || row.name,
    kind: CATEGORY_LABEL[g.category] || 'gym',
    score: Number.isFinite(c.strength) ? c.strength : null,
    label: LABELS[c.label] || 'Not checked',
    basis: c.basis ? `From ${String(c.basis).replace(/\btheir\b/g, 'your').replace(/your screenshots/, 'screenshots')}` : 'From your public pages',
    checks: checksFor(row),
    compare: comps.length
      ? {
          text: withVideo.length
            ? `${withVideo.length} of the ${comps.length} nearest gyms we checked ${withVideo.length === 1 ? 'has' : 'have'} video on ${withVideo.length === 1 ? 'its' : 'their'} website.`
            : `None of the ${comps.length} nearest gyms we checked has a website video yet. Be the first.`,
          dots: comps.map((x) => x.video),
          names: withVideo.slice(0, 3).map((x) => x.name),
        }
      : null,
    ideas: (row.ideas || []).slice(0, 3).map((i) => ({ title: i.title, hook: i.hook })),
    cta: plain(`Want these made for you? Reply to ${member.firstName || 'me'}.`),
    ctaNoIdeas: plain(`Want more like the sample? Reply to ${member.firstName || 'me'}.`),
    footer: plain(`Prepared for ${g.name || row.name} by ${member.firstName || 'a local video editor'}${business.name ? ` of ${business.name}` : ''}. Checked ${date} from public pages.`),
    madeWith127,
  };
}

// ---------- the image (SVG, rendered to PNG by ffmpeg's librsvg decoder) ----------

const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Greedy wrap by an estimated text width (average glyph about 0.55 of the font size for Inter).
function wrap(text, fontSize, maxWidth, factor = 0.55) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const perLine = Math.max(4, Math.floor(maxWidth / (fontSize * factor)));
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= perLine) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function hexOk(h) {
  return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
}

// Lift a dark brand color so it reads on near-black.
function readable(hex) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum < 0.35) {
    const k = 0.35 / Math.max(lum, 0.05);
    r = Math.min(255, Math.round(r * k + 40));
    g = Math.min(255, Math.round(g * k + 40));
    b = Math.min(255, Math.round(b * k + 40));
  }
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function svgCard(d, { accent = '#b9a8ff', width = 1080, height = 1350 } = {}) {
  const A = hexOk(accent) ? readable(accent) : '#b9a8ff';
  const W = width;
  const pad = 72;
  const maxW = W - pad * 2;
  const font = "'Inter', 'DejaVu Sans', sans-serif";
  const parts = [];
  const text = (x, y, size, weight, fill, t, extra = '') => parts.push(`<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}"${extra}>${esc(t)}</text>`);
  let y = 110;
  text(pad, y, 24, 600, '#9a9aa3', 'VIDEO SCORECARD', ' letter-spacing="6"');
  text(W - pad, y, 24, 600, '#6f6f78', String(d.kind).toUpperCase(), ' letter-spacing="3" text-anchor="end"');
  // Name: one line if it fits at a big size, else two; squeezed with textLength if the estimate runs long.
  let size = 72;
  let lines = wrap(d.gym, size, maxW, 0.56);
  while (lines.length > 2 && size > 44) {
    size -= 6;
    lines = wrap(d.gym, size, maxW, 0.56);
  }
  y += 40;
  for (const l of lines.slice(0, 2)) {
    y += size + 6;
    const est = l.length * size * 0.56;
    text(pad, y, size, 900, '#f4f4f6', l, est > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '');
  }
  // Score and bar
  y += 46;
  if (d.score != null) {
    text(pad - 4, y + 104, 140, 900, A, String(d.score));
    text(pad + String(d.score).length * 92 + 12, y + 104, 46, 900, '#5d5d66', '/100');
    text(W - pad, y + 52, 38, 700, '#f4f4f6', d.label, ' text-anchor="end"');
    text(W - pad, y + 96, 24, 400, '#8c8c95', d.basis, ' text-anchor="end"');
    y += 128;
    parts.push(`<rect x="${pad}" y="${y}" width="${maxW}" height="10" rx="5" fill="#26262b"/>`);
    parts.push(`<rect x="${pad}" y="${y}" width="${Math.max(10, Math.round((maxW * d.score) / 100))}" height="10" rx="5" fill="${A}"/>`);
    y += 34;
  } else {
    text(pad, y + 50, 38, 700, '#f4f4f6', 'What we found');
    y += 70;
  }
  // Checks: the "no" ones matter most; keep room for the comparison and at least two ideas.
  const maxChecks = d.compare ? 5 : 6;
  let checks = d.checks;
  if (checks.length > maxChecks) {
    const keep = new Set(checks.filter((c) => c.status !== 'yes').slice(0, maxChecks));
    for (const c of checks) if (keep.size < maxChecks && !keep.has(c)) keep.add(c);
    checks = checks.filter((c) => keep.has(c));
  }
  for (const c of checks) {
    y += 58;
    const color = c.status === 'yes' ? '#4ade80' : c.status === 'no' ? '#ff7a6b' : '#6f6f78';
    const mark = c.status === 'yes' ? 'M -9 0 L -3 6 L 9 -7' : c.status === 'no' ? 'M -7 -7 L 7 7 M 7 -7 L -7 7' : null;
    parts.push(`<circle cx="${pad + 18}" cy="${y - 11}" r="18" fill="none" stroke="${color}" stroke-width="3"/>`);
    if (mark) parts.push(`<path d="${mark}" transform="translate(${pad + 18} ${y - 11})" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    else text(pad + 18, y - 2, 24, 700, color, '?', ' text-anchor="middle"');
    text(pad + 56, y, 32, 600, '#ececf0', c.label);
    if (c.note) text(W - pad, y, 23, 400, '#8c8c95', c.note.length > 34 ? `${c.note.slice(0, 33)}...` : c.note, ' text-anchor="end"');
  }
  // Comparison with the nearest gyms we checked
  if (d.compare) {
    y += 70;
    const lines2 = wrap(d.compare.text, 28, maxW - 250);
    lines2.forEach((l, i) => text(pad, y + i * 36, 28, 600, '#ececf0', l));
    const dotsY = y + ((lines2.length - 1) * 36) / 2 - 26;
    d.compare.dots.forEach((on, i) => {
      parts.push(`<rect x="${W - pad - (d.compare.dots.length - i) * 44 + 8}" y="${dotsY}" width="32" height="32" rx="8" fill="${on ? A : 'none'}" stroke="${on ? A : '#4a4a52'}" stroke-width="3"/>`);
    });
    y += (lines2.length - 1) * 36;
  }
  // Ideas: as many as fit above the call to action.
  const ctaY = height - 134;
  const room = Math.floor((ctaY - 60 - (y + 72)) / 48);
  const ideas = d.ideas.slice(0, Math.max(0, Math.min(3, room)));
  if (ideas.length) {
    y += 72;
    text(pad, y, 24, 600, '#9a9aa3', `${ideas.length === 1 ? 'THE VIDEO' : `${ideas.length} VIDEOS`} I'D MAKE YOU FIRST`, ' letter-spacing="5"');
    ideas.forEach((idea, i) => {
      y += 48;
      text(pad, y, 30, 900, A, String(i + 1));
      text(pad + 44, y, 31, 600, '#f4f4f6', idea.title);
    });
  }
  // Call to action and footer, pinned to the bottom
  text(pad, ctaY, 32, 700, '#f4f4f6', ideas.length ? d.cta : d.ctaNoIdeas);
  const foot = wrap(d.footer, 21, maxW - (d.madeWith127 ? 230 : 0));
  foot.slice(0, 2).forEach((l, i) => text(pad, ctaY + 48 + i * 28, 21, 400, '#6f6f78', l));
  if (d.madeWith127) text(W - pad, ctaY + 76, 21, 600, '#6f6f78', 'MADE WITH 127', ' letter-spacing="2" text-anchor="end"');
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

// ---------- the web page (self-contained, for email or a link) ----------

function htmlPage(d, { accent = '#b9a8ff' } = {}) {
  const A = hexOk(accent) ? readable(accent) : '#b9a8ff';
  const icon = (s) => (s === 'yes' ? '&#10003;' : s === 'no' ? '&#10005;' : '?');
  const color = (s) => (s === 'yes' ? '#4ade80' : s === 'no' ? '#ff7a6b' : '#8c8c95');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.gym)}: Video Scorecard</title>
<style>
body{margin:0;background:#0c0c0e;color:#ececf0;font:16px/1.5 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:640px;margin:0 auto;padding:32px 20px 48px}
.label{font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#9a9aa3;font-weight:600}
h1{font-size:40px;line-height:1.05;margin:10px 0 24px;color:#f4f4f6;font-weight:800}
.score{display:flex;align-items:baseline;gap:12px;margin-bottom:6px}
.score b{font-size:96px;line-height:1;color:${A};font-weight:900}.score span{font-size:28px;color:#5d5d66;font-weight:800}
.bar{height:8px;border-radius:4px;background:#26262b;margin:12px 0 4px}.bar i{display:block;height:8px;border-radius:4px;background:${A}}
.muted{color:#8c8c95;font-size:14px}
ul{list-style:none;padding:0;margin:24px 0}li{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #1e1e23}
li .i{width:28px;height:28px;border-radius:50%;border:2px solid;display:grid;place-items:center;font-weight:800;flex:none}
li .n{margin-left:auto;color:#8c8c95;font-size:14px;text-align:right}
.card{border:1px solid #24242a;border-radius:16px;padding:16px 18px;margin:20px 0}
ol{padding-left:20px}ol li{display:list-item;border:0;padding:4px 0}
.cta{font-size:20px;font-weight:700;margin:28px 0 8px}
footer{margin-top:28px;color:#6f6f78;font-size:13px}
</style></head><body><main>
<div class="label">Video scorecard · ${esc(d.kind)}</div>
<h1>${esc(d.gym)}</h1>
${d.score != null ? `<div class="score"><b>${d.score}</b><span>/100</span></div><div><strong>${esc(d.label)}</strong> <span class="muted">${esc(d.basis)}</span></div><div class="bar"><i style="width:${Math.max(2, d.score)}%"></i></div>` : ''}
<ul>${d.checks
    .map((c) => `<li><span class="i" style="color:${color(c.status)};border-color:${color(c.status)}">${icon(c.status)}</span><span>${esc(c.label)}</span>${c.note ? `<span class="n">${esc(c.note)}</span>` : ''}</li>`)
    .join('')}</ul>
${d.compare ? `<div class="card">${esc(d.compare.text)}${d.compare.names.length ? `<div class="muted">With video: ${esc(d.compare.names.join(', '))}</div>` : ''}</div>` : ''}
${d.ideas.length ? `<div class="label">3 videos I'd make you first</div><ol>${d.ideas.map((i) => `<li><strong>${esc(i.title)}</strong><br><span class="muted">Opens with: "${esc(i.hook)}"</span></li>`).join('')}</ol>` : ''}
<p class="cta">${esc(d.cta)}</p>
<footer>${esc(d.footer)}${d.madeWith127 ? ' Made with 127.' : ''}</footer>
</main></body></html>`;
}

module.exports = { scorecardData, svgCard, htmlPage, checksFor, wrap, readable, accentFor, ACCENTS };
