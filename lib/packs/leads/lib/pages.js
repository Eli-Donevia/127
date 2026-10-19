// Files a member hands over or works from: the one-page website check for a business (HTML plus a
// share image), and the "Your first 25" workbook (plan, every business, every message). No scripts,
// inline CSS, prints on Letter, reads on a phone. Only facts from the business's own website and
// the member's own words appear; Google listing content never does (Places terms).

const { files, color, svg, text } = require('../../_kit');
const FIX = require('../data/fixes.json');

const esc = files.esc;
const THIN_DEP = new Set(['no_video', 'no_pixel', 'no_booking', 'no_form', 'no_signup', 'few_images', 'no_reviews_shown', 'no_tap_to_call', 'no_prices', 'no_offer', 'no_hours', 'no_map', 'no_h1', 'no_email', 'no_analytics']);

// Every website check for a lead: { id, check, status: 'pass' | 'fix' | 'unknown', why, matters, fix }.
function checksOf(lead) {
  const s = lead.site;
  if (!s) return [];
  const thin = (s.words || 0) < 120;
  const found = new Map((lead.gaps || []).filter((g) => g.source === 'website').map((g) => [g.id, g]));
  const out = [];
  for (const id of FIX.order) {
    if (id === 'site_down' || id === 'parked') continue;
    const f = FIX.fixes[id];
    let status = found.has(id) ? 'fix' : 'pass';
    if (status === 'pass') {
      if (thin && THIN_DEP.has(id)) status = 'unknown';
      if (id === 'stale_footer' && !s.copyrightYear) status = 'unknown';
      if (id === 'missing_alt' && (s.imageCount || 0) < 4) status = 'unknown';
      if (id === 'thin_site' && thin) status = 'unknown';
      if (id === 'no_video' && s.video && s.video.unknown) status = 'unknown';
      if (id === 'no_pixel' && !(s.tracking && s.tracking.metaPixel)) status = 'unknown';
    }
    out.push({ id, check: f.check, status, why: found.has(id) ? found.get(id).why : '', matters: f.matters, fix: f.fix });
  }
  return out;
}

// The fixes to lead with: this service's gaps first, then the usual order. Max n.
function topFixes(lead, service, n = 4) {
  const w = (service && service.gaps) || {};
  return checksOf(lead)
    .filter((c) => c.status === 'fix')
    .sort((a, b) => (w[b.id] || 0) - (w[a.id] || 0) || FIX.order.indexOf(a.id) - FIX.order.indexOf(b.id))
    .slice(0, n);
}

function paletteFor(lead) {
  const c = lead.site && lead.site.colors && lead.site.colors.primary;
  return color.palette(color.isHex(c) ? c : 'clean');
}

function baseCss(p) {
  return `@page{size:Letter;margin:14mm}*{box-sizing:border-box}body{overflow-wrap:anywhere;margin:0;background:${p.paper};color:${p.ink};font:16px/1.5 Inter,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wrap{max-width:860px;margin:0 auto;padding:28px 20px 40px}.band{background:${p.primary};color:${p.onPrimary};border-radius:18px;padding:28px 26px}.eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;margin:0 0 6px}
h1{font-size:34px;line-height:1.1;margin:0 0 6px}h2{font-size:20px;margin:30px 0 12px}h3{font-size:17px;margin:0 0 4px}.muted{color:${p.muted}}.band .muted{color:${p.onPrimary};opacity:.85}
.card{background:#fff;border:1px solid ${p.line};border-radius:14px;padding:16px 18px;margin:0 0 12px;break-inside:avoid}.chip{display:inline-block;border-radius:999px;padding:3px 10px;font-size:13px;margin:0 6px 6px 0;background:${p.surface};color:${p.ink};border:1px solid ${p.line}}
.chip.fix{background:#fff4f2;border-color:#f3c7bf;color:#8a2a17}.chip.ok{background:#eef8f1;border-color:#bfe3cb;color:#1d5c34}.small{font-size:13px}a{color:${p.primary}}
.score{display:flex;gap:18px;align-items:center;margin:18px 0 0}.big{font-size:44px;font-weight:800;line-height:1}.bar{flex:1;height:10px;border-radius:99px;background:rgba(255,255,255,.3);overflow:hidden}.bar i{display:block;height:100%;background:${p.onPrimary}}
.num{display:inline-flex;width:28px;height:28px;border-radius:50%;background:${p.primary};color:${p.onPrimary};align-items:center;justify-content:center;font-weight:700;font-size:14px;margin-right:10px;flex:none}.row{display:flex;align-items:flex-start}
.offer{background:${p.surface};border-left:5px solid ${p.accent};border-radius:12px;padding:18px 20px;margin-top:26px}pre{white-space:pre-wrap;font:14px/1.5 Inter,Arial,sans-serif;background:${p.paper};border:1px solid ${p.line};border-radius:10px;padding:12px;margin:6px 0 10px}
details{margin:6px 0}summary{cursor:pointer;font-weight:600}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:8px 6px;border-bottom:1px solid ${p.line};vertical-align:top}footer{margin-top:28px;font-size:12px;color:${p.muted}}
@media (max-width:560px){h1{font-size:26px}.big{font-size:34px}.wrap{padding:18px 14px}}@media print{.wrap{padding:0}a{color:${p.ink}}}`;
}

// The one-page website check a member sends or prints for one business.
function auditHtml({ lead, service, sender = {}, offer, date }) {
  const p = paletteFor(lead);
  const biz = lead.siteName || (lead.source === 'google' ? '' : lead.name) || 'Your business';
  const site = lead.site;
  const checks = checksOf(lead);
  const known = checks.filter((c) => c.status !== 'unknown');
  const passed = known.filter((c) => c.status === 'pass');
  const fixes = topFixes(lead, service, 5);
  const domain = site ? site.domain : lead.website ? String(lead.website).replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : '';
  const pct = known.length ? Math.round((passed.length / known.length) * 100) : 0;
  let main;
  if (lead.siteStatus === 'ok') {
    main = `<div class="score"><div class="big">${passed.length}/${known.length}</div><div style="flex:1"><div>checks passed on ${esc(domain)}</div><div class="bar"><i style="width:${pct}%"></i></div></div></div>`;
  } else {
    const what = lead.siteStatus === 'none' ? 'We could not find a website for this business.' : lead.siteStatus === 'down' ? "The website didn't load when we checked." : lead.siteStatus === 'parked' ? 'The website shows a placeholder page.' : "We couldn't read the website from here, so this check is short.";
    main = `<p style="margin:14px 0 0;font-size:18px">${esc(what)}</p>`;
  }
  const fixBlock = fixes.length
    ? `<h2>Fix these first</h2>${fixes.map((f, i) => `<div class="card"><div class="row"><span class="num">${i + 1}</span><div><h3>${esc(f.check)}</h3><div>${esc(f.why)}</div><div class="muted small" style="margin-top:6px">Why it matters: ${esc(f.matters)}</div><div style="margin-top:6px"><strong>The fix:</strong> ${esc(f.fix)}</div></div></div></div>`).join('')}`
    : lead.siteStatus === 'none'
      ? `<h2>What a first website needs</h2><div class="card">One page is enough to start: what you do, where you work, your hours, a tap-to-call button, a way to book or ask a question, and a few recent photos.</div>`
      : '';
  const okBlock = passed.length ? `<h2>Working well</h2><div>${passed.map((c) => `<span class="chip ok">${esc(c.check)}</span>`).join('')}</div>` : '';
  const unknown = checks.filter((c) => c.status === 'unknown');
  const unk = unknown.length ? `<p class="muted small">Not checked (the page loads its content with scripts, or there was nothing to check): ${esc(unknown.map((c) => c.check).join(', '))}.</p>` : '';
  const who = [sender.first, sender.business].filter(Boolean).join(', ');
  const offerBlock = `<div class="offer"><h3>${esc(sender.first ? `From ${who}` : 'A free first step')}</h3><div>${esc(offer || '')}</div><div class="muted small" style="margin-top:8px">${esc(sender.first ? `${sender.first}${sender.city ? `, ${sender.city}` : ''}` : '[your name]')}. Reply to the message this came with, or [your phone or email].</div></div>`;
  const body = `<div class="wrap"><div class="band"><p class="eyebrow">Website check${date ? ` | ${esc(date)}` : ''}</p><h1>${esc(biz)}</h1><div class="muted">${esc(domain || 'No website listed')}</div>${main}</div>${fixBlock}${okBlock}${unk}${offerBlock}<footer>Read from the public pages of ${esc(domain || 'this business')} on ${esc(date || 'the date above')}. Things change: if something here is already fixed, ignore it.${lead.sample ? ' Sample business: made up to show how this works.' : ''}</footer></div>`;
  return files.htmlDoc({ title: `Website check: ${biz}`, css: baseCss(p), body });
}

// A 1080x1350 image for a DM: "3 quick fixes for {biz}".
function shareSvg({ lead, service, sender = {} }) {
  const p = paletteFor(lead);
  const W = 1080;
  const H = 1350;
  const biz = lead.siteName || (lead.source === 'google' ? '' : lead.name) || 'your website';
  const fixes = topFixes(lead, service, 3);
  const items = fixes.length ? fixes.map((f) => [f.check, f.fix]) : [['A website', 'One page with services, hours, area and a call button.'], ['Book or ask online', 'A button that opens a booking page or a short form.'], ['Recent photos', 'Six to ten photos of the work, space and team.']];
  const title = svg.fit(`${items.length} quick ${items.length === 1 ? 'fix' : 'fixes'} for ${biz}`, { width: W - 160, maxSize: 76, minSize: 40, maxLines: 3, weight: 800 });
  let body = svg.rect({ x: 0, y: 0, w: W, h: 420, fill: p.primary });
  body += svg.text({ x: 80, y: 120, lines: ['WEBSITE CHECK'], size: 30, weight: 700, fill: p.onPrimary, letterSpacing: 3, opacity: 0.85 });
  body += svg.text({ x: 80, y: 200, lines: title.lines, size: title.size, weight: 800, fill: p.onPrimary, lineHeight: 1.1 });
  let y = 500;
  items.forEach(([head, fix], i) => {
    body += svg.rect({ x: 60, y: y - 60, w: W - 120, h: 230, r: 28, fill: '#ffffff', stroke: p.line, strokeWidth: 2 });
    body += svg.circle({ cx: 130, cy: y + 4, r: 34, fill: p.primary });
    body += svg.text({ x: 130, y: y + 16, lines: [String(i + 1)], size: 34, weight: 800, fill: p.onPrimary, anchor: 'middle' });
    const h = svg.wrap(head, { width: W - 320, size: 40, weight: 700 }).slice(0, 1);
    body += svg.text({ x: 190, y: y + 16, lines: h, size: 40, weight: 700, fill: p.ink });
    const f = svg.wrap(fix, { width: W - 320, size: 30, weight: 400 }).slice(0, 3);
    body += svg.text({ x: 190, y: y + 66, lines: f, size: 30, weight: 400, fill: p.muted, lineHeight: 1.3 });
    y += 260;
  });
  const sign = sender.first ? `From ${sender.first}${sender.business ? `, ${sender.business}` : ''}` : 'Checked from their public website';
  body += svg.text({ x: 80, y: H - 70, lines: [text.clip(sign, 60)], size: 30, weight: 600, fill: p.ink });
  return svg.doc({ width: W, height: H, background: p.paper, body, title: `Quick fixes for ${biz}` });
}

// The workbook: plan, every business with its messages, the replies and the send rules.
function workbookHtml({ title, subtitle, days, rows, replies, rules, attribution, credit, sample }) {
  const p = color.palette('clean');
  const plan = `<table><tr><th>Day</th><th>Date</th><th>To do</th></tr>${days.map((d) => `<tr><td>${d.day}</td><td>${esc(d.label)}</td><td>${esc(d.todo)}</td></tr>`).join('')}</table>`;
  const cards = rows
    .map((r) => {
      const links = [r.website && `<a href="${esc(r.website)}">Website</a>`, r.maps && `<a href="${esc(r.maps)}">Map</a>`, r.instagram && `<a href="https://www.instagram.com/${esc(r.instagram.replace(/^@/, ''))}/">${esc(r.instagram)}</a>`, r.email && `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`, r.phone && esc(r.phone)].filter(Boolean).join(' | ');
      const msg = (label, t) => (t ? `<details><summary>${esc(label)}</summary><pre>${esc(t)}</pre></details>` : '');
      return `<div class="card"><div class="row"><span class="num">${r.rank}</span><div style="flex:1"><h3>${esc(r.name || 'Open the map link')}</h3><div class="muted small">Fit ${esc(r.score)} | send on ${esc(r.send_label || r.send_on)}</div><div style="margin:8px 0">${(r.chips || []).map((c) => `<span class="chip fix">${esc(c)}</span>`).join('')}</div><div class="small">${links}</div>${msg('Instagram DM', r.dm)}${msg(`Email: ${r.subject || ''}`, r.email_body)}${msg('Call opener', r.call)}${msg('Walk-in line', r.walk_in)}${msg('Follow-up day 3', r.follow_up_1)}${msg('Follow-up day 7', r.follow_up_2)}</div></div></div>`;
    })
    .join('');
  const rep = replies.map((r) => `<div class="card"><h3>${esc(r.label)}</h3><div>${esc(r.text)}</div></div>`).join('');
  const body = `<div class="wrap"><div class="band"><p class="eyebrow">Your first 25</p><h1>${esc(title)}</h1><div class="muted">${esc(subtitle)}</div></div><h2>Your next 7 working days</h2>${plan}<h2>The list</h2>${cards}<h2>When they reply</h2>${rep}<h2>Before you send</h2><ul>${rules.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><footer>${esc(attribution || '')}${credit || ''}${sample ? ' Sample businesses: made up to show how it works.' : ''}</footer></div>`;
  return files.htmlDoc({ title: `Your first 25: ${title}`, css: baseCss(p), body });
}

module.exports = { checksOf, topFixes, auditHtml, shareSvg, workbookHtml, paletteFor };
