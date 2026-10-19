// Printable pages (no scripts): a batch of scripts to record from, and a one-page media kit for
// sponsors. The media kit is also drawn as a picture to attach to an email.

const { files, svg, color, text, time } = require('../../_kit');

const esc = files.esc;

const BASE_CSS = (accent) => `
  :root { --ink:#111827; --soft:#4b5563; --line:#d9dde5; --accent:${accent}; }
  * { box-sizing: border-box; }
  body { font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: var(--ink); margin: 0; background: #f5f6f8; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; line-height: 1.45; }
  main { max-width: 860px; margin: 0 auto; padding: 32px 28px 48px; background: #fff; }
  h1 { font-size: 30px; line-height: 1.15; margin: 0 0 6px; }
  h2 { font-size: 19px; margin: 28px 0 10px; padding-top: 12px; border-top: 2px solid var(--ink); }
  .meta { color: var(--soft); margin: 0 0 16px; font-size: 15px; }
  .note { background: #f3f6fb; border-left: 4px solid var(--accent); padding: 10px 14px; margin: 12px 0; font-size: 14px; }
  a { color: var(--accent); }
  @media (max-width: 600px) { main { padding: 22px 16px 36px; } h1 { font-size: 25px; } }
  @media print { body { background: #fff; } main { padding: 0; max-width: none; } a { color: var(--ink); } @page { size: letter; margin: 0.5in; } }
`;

// ---------- scripts ----------

// scripts: [{ n, title, topic, hook, lines, cta, cover, description, seconds, url, wiki, evidence, copied }]
function scriptsPage({ title, niche, date, scripts, own }) {
  const accent = color.ensureContrast(niche.color || '#1d3a8a', '#ffffff', 4.5);
  const css = `${BASE_CSS(accent)}
  .card { border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; margin: 14px 0; break-inside: avoid; overflow-wrap: anywhere; }
  .top { display: flex; gap: 12px; align-items: baseline; }
  .n { font-weight: 800; font-size: 20px; color: var(--accent); min-width: 32px; }
  .card h3 { font-size: 18px; margin: 0; flex: 1; }
  .secs { color: var(--soft); font-size: 13px; white-space: nowrap; }
  .src { color: var(--soft); font-size: 13px; margin: 4px 0 10px 44px; }
  .say { margin: 0 0 0 44px; padding: 0; list-style: none; }
  .say li { margin: 6px 0; font-size: 16px; }
  .say li.hook { font-weight: 700; }
  .say li.cta { color: var(--soft); }
  .flag { color: #9a3412; font-size: 13px; margin: 8px 0 0 44px; }
  .extra { margin: 10px 0 0 44px; font-size: 13px; color: var(--soft); }
  .extra b { color: var(--ink); }
  .desc { white-space: pre-wrap; background: #fafbfc; border: 1px dashed var(--line); padding: 8px 10px; margin-top: 4px; font-size: 13px; color: var(--ink); }
  .boxes { margin: 10px 0 0 44px; font-size: 13px; color: var(--soft); }
  .boxes span { display: inline-block; white-space: nowrap; margin: 2px 16px 2px 0; }
  .boxes i { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--ink); border-radius: 3px; vertical-align: -2px; margin-right: 6px; }
  @media (max-width: 600px) { .src, .say, .flag, .extra, .boxes { margin-left: 0; } .top { flex-wrap: wrap; } }
  `;
  const cards = scripts
    .map(
      (s) => `<section class="card">
<div class="top"><span class="n">${s.n}</span><h3>${esc(s.title)}</h3><span class="secs">about ${s.seconds} seconds</span></div>
<p class="src">${esc(s.topic)}${s.evidence ? ` · ${esc(s.evidence)}` : ''}</p>
<ul class="say"><li class="hook">${esc(s.hook)}</li>${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}<li class="cta">${esc(s.cta)}</li></ul>
${s.copied ? `<p class="flag">Wikipedia's own sentences: say them your own way before you record.</p>` : ''}
<div class="extra"><b>Cover words:</b> ${esc(s.cover)}${s.url ? ` · <b>Facts:</b> <a href="${esc(s.url)}">Wikipedia, ${esc(s.wiki || s.topic)}</a>` : ''}<div class="desc">${esc(s.description)}</div></div>
<p class="boxes"><span><i></i>Recorded</span><span><i></i>Posted on YouTube</span><span><i></i>Posted on TikTok</span></p>
</section>`,
    )
    .join('\n');
  const copiedCount = scripts.filter((s) => s.copied).length;
  const body = `<main>
<h1>${esc(title)}</h1>
<p class="meta">${esc([niche.label, `${scripts.length} scripts`, `written ${time.longDate(date)}`].join(' · '))}</p>
<div class="note">Read each one out loud once before you record. To turn one into a video, paste its lines into Make one video, or record yourself reading it and add the recording there.${copiedCount ? ` ${copiedCount === scripts.length ? (scripts.length === 1 ? 'This is a draft' : `All ${scripts.length} are drafts`) : `${copiedCount} of these ${copiedCount === 1 ? 'is a draft' : 'are drafts'}`} in Wikipedia's own words: YouTube doesn't pay for videos that only read out text someone else wrote, so say ${copiedCount === 1 ? 'it' : 'them'} your own way.` : ''}</div>
${own ? '' : '<p class="meta">Each topic is one people looked up on Wikipedia last month. The number shows interest in the topic, not the views a video will get.</p>'}
${cards}
</main>`;
  return files.htmlDoc({ title, css, body, description: `${scripts.length} short video scripts for ${niche.label}` });
}

// ---------- media kit ----------

const fmt = (n) => Number(n).toLocaleString('en-US');

// kit: { channel, about, handles: [{ label, value }], numbers: [{ label, value, note }], audience,
//        countries, formats: [], rate, packages: [{ label, price }], email, asOf, accent }
function mediaKitHtml(kit) {
  const accent = color.ensureContrast(kit.accent || '#1d3a8a', '#ffffff', 4.5);
  const css = `${BASE_CSS(accent)}
  .hero { background: ${accent}; color: #fff; border-radius: 12px; padding: 26px 26px 22px; }
  .hero h1 { color: #fff; }
  .hero p { margin: 4px 0 0; font-size: 17px; opacity: .95; }
  .handles { margin-top: 12px; font-size: 14px; }
  .handles span { display: inline-block; background: rgba(255,255,255,.16); border-radius: 99px; padding: 3px 10px; margin: 4px 6px 0 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 18px 0 6px; }
  .stat { border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
  .stat b { display: block; font-size: 28px; color: var(--accent); }
  .stat span { font-size: 13px; color: var(--soft); }
  ul { padding-left: 20px; } li { margin: 6px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 15px; } td { padding: 8px 6px; border-bottom: 1px solid var(--line); } td.p { text-align: right; font-weight: 700; white-space: nowrap; }
  .contact { font-size: 17px; }
  @media print { .hero { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  `;
  const stats = kit.numbers.map((x) => `<div class="stat"><b>${esc(fmt(x.value))}</b><span>${esc(x.label)}</span></div>`).join('');
  const body = `<main>
<div class="hero"><h1>${esc(kit.channel)}</h1><p>${esc(kit.about)}</p>${kit.handles.length ? `<div class="handles">${kit.handles.map((h) => `<span>${esc(h.label)} ${esc(h.value)}</span>`).join('')}</div>` : ''}</div>
${kit.numbers.length ? `<div class="grid">${stats}</div><p class="meta">From ${esc(kit.sources)}, as of ${esc(time.longDate(kit.asOf))}.</p>` : '<p class="note">[Add your numbers from YouTube Studio or TikTok Studio]</p>'}
${kit.audience || kit.countries ? `<h2>Who watches</h2><ul>${kit.audience ? `<li>${esc(kit.audience)}</li>` : ''}${kit.countries ? `<li>Top countries: ${esc(kit.countries)}</li>` : ''}</ul>` : ''}
<h2>Ways to work together</h2><ul>${kit.formats.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
${kit.rate ? `<h2>Rates</h2><table>${kit.packages.map((p) => `<tr><td>${esc(p.label)}</td><td class="p">${esc(p.price)}</td></tr>`).join('')}</table>` : ''}
<h2>Every sponsored video</h2><ul><li>Says it's sponsored out loud and on screen, near the start.</li><li>Is marked as paid promotion on YouTube and as branded content on TikTok.</li><li>Gets your OK on the script before it's made.</li></ul>
<h2>Contact</h2><p class="contact">${esc(kit.email || '[your email]')}</p>
</main>`;
  return files.htmlDoc({ title: `${kit.channel}: media kit`, css, body, description: `Media kit for ${kit.channel}` });
}

// The same kit as a 1080 x 1350 picture.
function mediaKitSvg(kit) {
  const W = 1080;
  const H = 1350;
  const accent = color.ensureContrast(kit.accent || '#1d3a8a', '#ffffff', 4.5);
  const deep = color.darken(accent, 0.35);
  const F = 'Inter';
  const t = (x, y, s, size, weight, fill, anchor = 'start') => `<text x="${x}" y="${y}" font-family="${F}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${svg.esc(s)}</text>`;
  const name = svg.fit(kit.channel, { width: W - 160, maxSize: 96, minSize: 52, maxLines: 2, weight: 800 });
  const about = svg.wrap(kit.about, { width: W - 160, size: 34, weight: 500 }).slice(0, 3);
  let y = 150;
  let out = `<rect width="${W}" height="${H}" fill="#ffffff"/><rect width="${W}" height="${470}" fill="${accent}"/><rect y="440" width="${W}" height="30" fill="${deep}" opacity="0.25"/>`;
  out += t(80, 110, 'MEDIA KIT', 28, 800, '#ffffff');
  name.lines.forEach((l) => {
    y += name.size * 1.05;
    out += t(80, y, l, name.size, 800, '#ffffff');
  });
  y += 20;
  about.forEach((l) => {
    y += 44;
    out += t(80, y, l, 34, 500, '#ffffff');
  });
  if (kit.handles.length) out += t(80, Math.min(430, y + 62), kit.handles.map((h) => h.value).join('   '), 30, 700, '#ffffff');
  // Numbers: up to 4, two per row.
  const nums = kit.numbers.slice(0, 4);
  nums.forEach((x, i) => {
    const cx = 80 + (i % 2) * 470;
    const cy = 560 + Math.floor(i / 2) * 190;
    const big = svg.fit(fmt(x.value), { width: 420, maxSize: 88, minSize: 48, maxLines: 1, weight: 800 });
    out += t(cx, cy + 70, big.lines[0], big.size, 800, accent);
    svg.wrap(x.label, { width: 420, size: 28, weight: 500 }).slice(0, 2).forEach((l, k) => (out += t(cx, cy + 115 + k * 34, l, 28, 500, '#4b5563')));
  });
  let fy = 560 + Math.ceil(nums.length / 2) * 190 + (nums.length ? 10 : 0);
  if (!nums.length) out += t(80, (fy += 40), '[Add your numbers from YouTube Studio or TikTok Studio]', 30, 600, '#9a3412');
  if (kit.numbers.length) out += t(80, (fy += 10), `From ${kit.sources}, as of ${time.longDate(kit.asOf)}`, 24, 500, '#6b7280');
  // Who watches, when typed, in the space above the rate.
  const who = [kit.audience, kit.countries ? `Top countries: ${kit.countries}` : ''].filter(Boolean);
  if (who.length && fy < H - 330) {
    fy += 70;
    out += t(80, fy, 'Who watches', 30, 800, '#111827');
    who.forEach((w) => svg.wrap(w, { width: W - 160, size: 30, weight: 500 }).slice(0, 2).forEach((l) => (out += t(80, (fy += 42), l, 30, 500, '#374151'))));
  }
  fy += 70;
  if (kit.rate && fy < H - 140) out += t(80, fy, `From ${kit.packages[0].price} a video`, 40, 800, '#111827');
  out += t(80, H - 80, kit.email || '[your email]', 34, 700, accent);
  out += `<rect x="0" y="${H - 24}" width="${W}" height="24" fill="${accent}"/>`;
  return { svg: svg.doc({ width: W, height: H, body: out }), W, H };
}

module.exports = { scriptsPage, mediaKitHtml, mediaKitSvg, fmt };
