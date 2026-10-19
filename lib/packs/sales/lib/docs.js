// The printable look shared by quotes, invoices, proposals, call sheets, flashcards and referral
// cards: one self-contained HTML file each, inline CSS, no scripts, in the member's colors.
// Screen: a paper sheet on a tinted background that reflows on a phone. Print: @page set to Letter
// or A4 from the member's country, colors kept, nothing split across pages that shouldn't be.

const { files, color } = require('../../_kit');

const esc = files.esc;
const SANS = `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const SERIF = `Charter, "Bitstream Charter", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif`;

// CSS variables from a kit palette.
function vars(pal) {
  const brand = pal.primary;
  return [
    `--brand:${brand}`,
    `--on-brand:${pal.onPrimary}`,
    `--brand-soft:${color.mix(brand, '#ffffff', 0.9)}`,
    `--brand-softer:${color.mix(brand, '#ffffff', 0.955)}`,
    `--brand-ink:${color.ensureContrast(brand, '#ffffff', 4.6)}`,
    `--accent:${pal.accent}`,
    `--ink:${pal.ink}`,
    `--muted:${pal.muted}`,
    `--line:${pal.line}`,
    `--tint:${color.mix(pal.surface, '#ffffff', 0.35)}`,
  ].join(';');
}

function baseCss(pal, { paper = 'letter' } = {}) {
  const size = paper === 'A4' ? 'A4' : 'letter';
  return `
:root{${vars(pal)}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--tint);color:var(--ink);font:14px/1.55 ${SANS};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;max-width:816px;margin:28px auto;background:#fff;border-radius:14px;padding:52px 56px 40px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 12px 40px rgba(0,0,0,.07);overflow:hidden}
.sheet::before{content:"";position:absolute;left:0;right:0;top:0;height:6px;background:var(--brand)}
h1,h2,h3,h4{margin:0;color:var(--ink);font-weight:600}
p{margin:0 0 8px}
a{color:var(--brand-ink)}
.serif{font-family:${SERIF}}
.muted{color:var(--muted)}
.small{font-size:12px}
.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:22px;border-bottom:1px solid var(--line)}
.brand{display:flex;gap:14px;align-items:center;min-width:0}
.mark{flex:0 0 auto;width:46px;height:46px;border-radius:12px;background:var(--brand);color:var(--on-brand);display:flex;align-items:center;justify-content:center;font:700 17px/1 ${SANS};letter-spacing:.02em}
.biz{font:600 21px/1.2 ${SERIF};color:var(--ink)}
.tag{font-size:12.5px;color:var(--muted);margin-top:3px;max-width:340px}
.contact{text-align:right;font-size:12.5px;line-height:1.6;color:var(--muted);white-space:nowrap}
.contact b{color:var(--ink);font-weight:600}
.kicker{display:inline-block;font:700 11px/1 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:var(--brand-ink);background:var(--brand-soft);padding:6px 10px;border-radius:999px}
.title{display:flex;justify-content:space-between;gap:28px;align-items:flex-start;margin:30px 0 26px}
.title h1{font:600 30px/1.18 ${SERIF};margin:12px 0 14px;letter-spacing:-.005em}
.meta{display:flex;flex-wrap:wrap;gap:8px 28px;margin:0}
.meta div{min-width:96px}
.meta dt{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.meta dd{margin:2px 0 0;font-weight:600;font-variant-numeric:tabular-nums}
.total-card{flex:0 0 auto;min-width:220px;background:var(--brand);color:var(--on-brand);border-radius:14px;padding:18px 22px;text-align:right}
.total-card .label{font-size:11px;text-transform:uppercase;letter-spacing:.12em;opacity:.85}
.total-card .amount{font:700 34px/1.1 ${SANS};margin-top:6px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.total-card .sub{font-size:12.5px;margin-top:6px;opacity:.92}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:0 0 26px}
.party{background:var(--brand-softer);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.party h3,.box h3,.section h2{font:700 11px/1 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:var(--brand-ink);margin-bottom:9px}
.party p{margin:0;line-height:1.6}
.party strong{font-size:15px}
table.items{width:100%;border-collapse:collapse;margin:0 0 6px}
table.items th{font:700 11px/1 ${SANS};letter-spacing:.1em;text-transform:uppercase;color:var(--muted);text-align:left;padding:0 10px 10px;border-bottom:2px solid var(--ink)}
table.items td{padding:13px 10px;border-bottom:1px solid var(--line);vertical-align:top}
table.items tr{break-inside:avoid}
table.items .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
table.items th.num{text-align:right}
table.items td:first-child,table.items th:first-child{padding-left:0}
table.items td:last-child,table.items th:last-child{padding-right:0}
.item{font-weight:600}
.detail{color:var(--muted);font-size:12.5px;margin-top:2px}
.neg{color:var(--brand-ink)}
.totals{margin:14px 0 0 auto;width:min(340px,100%);break-inside:avoid}
.sum{display:grid;grid-template-columns:1fr minmax(260px,340px);gap:28px;align-items:start;margin-top:14px}
.sum .totals{margin:0;width:100%}
.sum-left{min-width:0}
.sum-left .box{margin:0}
.accept{display:grid;grid-template-columns:minmax(180px,1fr) 2fr;gap:24px;align-items:end}
.accept .sign{margin-top:0}
.totals .row{display:flex;justify-content:space-between;gap:16px;padding:6px 0;font-variant-numeric:tabular-nums}
.totals .row span:last-child{text-align:right}
.totals .grand{border-top:2px solid var(--ink);margin-top:6px;padding-top:12px;font-size:18px;font-weight:700}
.totals .due{background:var(--brand-soft);color:var(--brand-ink);border-radius:10px;padding:10px 12px;margin-top:8px;font-weight:700}
.totals .soft{color:var(--muted);font-size:13px}
.boxes{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:28px}
.box{border:1px solid var(--line);border-radius:12px;padding:16px 18px;break-inside:avoid}
.box.full{grid-column:1/-1}
.box p:last-child{margin-bottom:0}
.box.tinted{background:var(--brand-softer);border-color:var(--brand-soft)}
.pay{display:flex;gap:18px;align-items:center;justify-content:space-between}
.btn{display:inline-block;background:var(--brand);color:var(--on-brand);text-decoration:none;font-weight:700;padding:11px 18px;border-radius:10px;margin:4px 0 6px}
.link{font-size:12px;color:var(--muted);word-break:break-all}
.qr{flex:0 0 auto;text-align:center}
.qr svg{display:block;width:104px;height:104px}
.qr .cap{font-size:11px;color:var(--muted);margin-top:4px}
.paynote{margin-top:8px;font-size:13px}
ol.steps{margin:0;padding:0;list-style:none;counter-reset:s}
ol.steps li{counter-increment:s;position:relative;padding:1px 0 10px 34px;min-height:32px}
ol.steps li:last-child{padding-bottom:0}
ol.steps li::before{content:counter(s);position:absolute;left:0;top:0;width:22px;height:22px;border-radius:50%;background:var(--brand);color:var(--on-brand);font:700 12px/22px ${SANS};text-align:center}
ul.ticks{margin:0;padding:0;list-style:none}
ul.ticks li{position:relative;padding:0 0 6px 24px}
ul.ticks li::before{content:"";position:absolute;left:3px;top:5px;width:6px;height:11px;border:solid var(--brand);border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}
ul.crosses{margin:0;padding:0;list-style:none}
ul.crosses li{position:relative;padding:0 0 6px 24px;color:var(--muted)}
ul.crosses li::before,ul.crosses li::after{content:"";position:absolute;left:4px;top:10px;width:11px;height:2px;background:var(--muted);transform:rotate(45deg)}
ul.crosses li::after{transform:rotate(-45deg)}
.terms{font-size:12px;color:var(--muted);line-height:1.55;margin:0;padding-left:18px}
.terms li{margin-bottom:3px}
.sign{display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-top:22px}
.sign div{border-top:1.5px solid var(--ink);padding-top:6px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.foot{margin-top:30px;padding-top:16px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:16px;font-size:12.5px;color:var(--muted)}
.foot b{color:var(--ink)}
.note{font-size:12px;color:var(--muted)}
.section{margin-top:30px;break-inside:auto}
.section > h2{margin-bottom:12px}
.lead{font:400 17px/1.55 ${SERIF};color:var(--ink)}
.chip{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:999px;background:var(--brand);color:var(--on-brand)}
.chip.soft{background:var(--brand-soft);color:var(--brand-ink)}
.check{display:inline-block;width:16px;height:16px;border:1.5px solid var(--ink);border-radius:4px;vertical-align:-3px;margin-right:8px}
@media (max-width:680px){
  body{font-size:15px}
  .sheet{margin:0;border-radius:0;padding:28px 18px 24px;box-shadow:none}
  .top{flex-direction:column;gap:14px}
  .contact{text-align:left;white-space:normal}
  .title{flex-direction:column;gap:16px;margin:22px 0 20px}
  .title h1{font-size:25px}
  .total-card{width:100%;text-align:left}
  .parties,.boxes{grid-template-columns:1fr}
  .sum{grid-template-columns:1fr;gap:18px}
  .sum .totals{order:-1}
  .accept{grid-template-columns:1fr;gap:14px}
  .accept .sign{margin-top:8px}
  table.items thead{display:none}
  table.items,table.items tbody,table.items tr,table.items td{display:block;width:100%}
  table.items tr{padding:12px 0;border-bottom:1px solid var(--line)}
  table.items td{border:0;padding:0}
  table.items td.num{display:inline-block;width:auto;text-align:left;margin-right:14px;color:var(--muted);font-size:13px}
  table.items td.amt{float:right;margin:0;color:var(--ink);font-weight:700;font-size:15px}
  .pay{flex-direction:column;align-items:flex-start}
  .foot{flex-direction:column}
}
@page{size:${size};margin:0.5in}
@media print{
  body{background:#fff;font-size:9.5pt;line-height:1.45}
  .sheet{max-width:none;margin:0;padding:0;border-radius:0;box-shadow:none;overflow:visible}
  .sheet::before{display:none}
  .top{border-top:5px solid var(--brand);padding:12px 0 12px}
  .mark{width:38px;height:38px;font-size:14px;border-radius:10px}
  .biz{font-size:16pt}
  .title{margin:16px 0 14px;gap:20px}
  .title h1{font-size:19pt;margin:8px 0 8px}
  .total-card{padding:12px 16px;min-width:190px}
  .total-card .amount{font-size:22pt;margin-top:2px}
  .parties{margin-bottom:14px;gap:10px}
  .party{padding:9px 12px}
  .party strong{font-size:10.5pt}
  table.items th{padding-bottom:6px}
  table.items td{padding:7px 10px}
  .totals{margin-top:8px}
  .totals .row{padding:3px 0}
  .totals .grand{font-size:12pt;padding-top:7px;margin-top:4px}
  .totals .due{padding:6px 10px;margin-top:5px}
  .boxes{margin-top:14px;gap:10px}
  .box{padding:10px 13px}
  .qr svg{width:80px;height:80px}
  .sum{gap:18px;margin-top:8px}
  .btn{padding:7px 12px;margin:2px 0 4px}
  ol.steps li{padding-bottom:4px;min-height:26px}
  .terms li{margin-bottom:1px}
  .top{padding:10px 0 10px}
  .title{margin:12px 0 12px}
  .kicker{padding:4px 8px}
  .sign{margin-top:14px}
  .foot{margin-top:14px;padding-top:9px}
  .section{margin-top:18px}
  a{text-decoration:none}
  .noprint{display:none}
  .section,.box,.totals,.sign,.party,table.items tr{break-inside:avoid}
  h2,h3{break-after:avoid}
}
`;
}

function initials(name) {
  const words = String(name || '')
    .replace(/[^A-Za-z0-9 &']+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(the|and|of|co|llc|inc|&)$/i.test(w));
  return (words.length ? words : ['?']).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
}

// The business header every document starts with.
function header(f, { tagline } = {}) {
  const contact = [f.email && esc(f.email), f.phone && esc(f.phone), f.website && esc(f.website), f.address && esc(f.address)].filter(Boolean);
  const tag = tagline != null ? tagline : f.what;
  return `<header class="top">
  <div class="brand"><div class="mark" aria-hidden="true">${esc(initials(f.displayName))}</div><div><div class="biz">${esc(f.displayName)}</div>${tag ? `<div class="tag">${esc(text1(tag))}</div>` : ''}</div></div>
  ${contact.length ? `<div class="contact">${contact.join('<br>')}</div>` : ''}
</header>`;
}

function text1(s) {
  const t = String(s || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function list(items, cls = 'ticks') {
  const a = (items || []).filter(Boolean);
  return a.length ? `<ul class="${cls}">${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
}

function steps(items) {
  const a = (items || []).filter(Boolean);
  return a.length ? `<ol class="steps">${a.map((x) => `<li>${typeof x === 'string' ? esc(x) : `<b>${esc(x.when)}</b><br>${esc(x.what)}`}</li>`).join('')}</ol>` : '';
}

function doc({ title, description = '', css, body, pal, paper, lang = 'en' }) {
  return files.htmlDoc({ title, description, lang, css: `${baseCss(pal, { paper })}${css || ''}`, head: '<meta name="robots" content="noindex">', body });
}

// A QR code for a payment or booking link, as inline SVG (kit qr), or '' when it can't be made.
function qrFor(link, pal) {
  if (!link) return '';
  try {
    const { qrSvg } = require('../../_kit').qr;
    return qrSvg(link, { ecc: 'M', margin: 2, dark: pal ? pal.ink : '#111111', light: '#ffffff', size: 104, title: 'Scan to open the link' });
  } catch {
    return '';
  }
}

module.exports = { esc, SANS, SERIF, baseCss, vars, header, initials, list, steps, doc, qrFor, text1 };
