// The frame every app shares: one HTML file with inline CSS and JS, a content security policy that
// blocks every outside request, the near-black look (system font stack, pill buttons), and the
// app's settings as JSON the app reads (so "change my app" can edit them without touching code).

const fs = require('fs');
const path = require('path');
const { files, color } = require('../../_kit');

const { esc } = files;
const CLIENT = path.join(__dirname, 'client');
const read = (name) => fs.readFileSync(path.join(CLIENT, name), 'utf8');

// No outside requests of any kind; inline scripts and styles only; forms can't post anywhere.
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'";
const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;

const NAMED = {
  black: '#fafafa', white: '#fafafa', red: '#f87171', orange: '#fb923c', yellow: '#facc15', green: '#4ade80', 'forest green': '#22c55e', teal: '#2dd4bf', blue: '#60a5fa', navy: '#93c5fd', purple: '#c084fc', pink: '#f472b6', brown: '#d6a77a', gray: '#d4d4d4', grey: '#d4d4d4',
};
const BG = '#0a0a0a';

// The member's color, made readable on the near-black page. Default: near-white.
function accentOf(input) {
  const raw = String(input || '').trim().toLowerCase();
  let hex = color.isHex(raw) ? (raw.startsWith('#') ? raw : `#${raw}`) : NAMED[raw] || null;
  if (!hex) return { accent: '#fafafa', onAccent: '#0a0a0a' };
  hex = color.ensureContrast(hex, BG, 4.5);
  return { accent: hex, onAccent: color.readableOn(hex, '#0a0a0a', '#ffffff') };
}

const CSS = (a) => `:root{--bg:${BG};--panel:#141414;--panel2:#0f0f0f;--line:#262626;--text:#fafafa;--muted:#a3a3a3;--accent:${a.accent};--on-accent:${a.onAccent};--ok:#4ade80;--warn:#fbbf24;--bad:#f87171}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 "Geist","Geist Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:760px;margin:0 auto;padding:20px 16px 72px}
header{padding:8px 0 4px}
.biz{color:var(--muted);font-size:13px;letter-spacing:.02em;margin:0}
h1{font-size:28px;line-height:1.15;letter-spacing:-.02em;margin:6px 0 6px;font-weight:600}
h2{font-size:18px;letter-spacing:-.01em;margin:24px 0 8px;font-weight:600}
p{margin:6px 0}
a{color:var(--accent)}
.lede{color:var(--muted);margin:0 0 8px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;margin:12px 0}
label{display:block;font-size:13px;color:var(--muted);margin:12px 0 6px}
label.check{display:flex;gap:10px;align-items:flex-start;color:var(--text);font-size:15px;margin:10px 0;cursor:pointer}
label.check input{width:22px;height:22px;flex:0 0 22px;margin:1px 0 0;accent-color:var(--accent)}
input,select,textarea{width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:12px;padding:12px;font:inherit;font-size:16px;min-height:44px}
textarea{min-height:96px;resize:vertical}
input:focus,select:focus,textarea:focus,.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn{appearance:none;-webkit-appearance:none;border:1px solid var(--line);background:transparent;color:var(--text);border-radius:999px;padding:10px 18px;font:inherit;font-size:15px;font-weight:500;cursor:pointer;min-height:44px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn:hover{border-color:#404040}
.btn.primary{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
.btn.small{min-height:36px;padding:6px 14px;font-size:14px}
.btn.icon{width:44px;padding:0;font-size:20px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.grid2{display:grid;grid-template-columns:1fr;gap:0 12px}
@media(min-width:560px){.grid2{grid-template-columns:1fr 1fr}}
.total{font-size:40px;font-weight:600;letter-spacing:-.03em;line-height:1.1;margin:4px 0}
.line{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line);font-size:15px}
.line:last-child{border-bottom:0}
.line span:first-child{color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:500}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.muted{color:var(--muted)}
.small{font-size:13px}
.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:12px;color:var(--muted)}
.pill.low{border-color:var(--warn);color:var(--warn)}
.pill.done{border-color:var(--ok);color:var(--ok)}
.bar{height:8px;background:var(--panel2);border-radius:999px;overflow:hidden;border:1px solid var(--line)}
.bar i{display:block;height:100%;background:var(--accent);width:0}
.out{white-space:pre-wrap;background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:14px}
.note{border-left:3px solid var(--accent);padding:4px 0 4px 12px;color:var(--muted);font-size:14px}
.toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:10px 18px;border-radius:999px;opacity:0;pointer-events:none;transition:opacity .2s;font-size:14px}
.toast.show{opacity:1}
.js-only{display:none}
.js .js-only{display:revert}
.js .no-js{display:none}
footer{color:var(--muted);font-size:12px;margin-top:36px;border-top:1px solid var(--line);padding-top:12px}
@media print{body{background:#fff;color:#000}.no-print,.toast{display:none!important}.card{background:#fff;border-color:#ccc}.muted,label,th{color:#444}input,select,textarea{background:#fff;color:#000;border-color:#bbb}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}`;

// JSON that is safe inside a <script type="application/json"> tag.
function safeJson(v) {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

// title: what the app is; business: the member's business name; body: the app's markup (works as a
// static preview without scripts); config: what the app reads; script: the app's client file name.
function page({ title, business, lede, body, config, script, accent, note }) {
  const a = accent && accent.accent ? accent : accentOf(accent);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${CSP_META}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="${BG}">
<title>${esc(title)}${business ? ` | ${esc(business)}` : ''}</title>
<style>${CSS(a)}</style>
</head>
<body>
<div class="wrap">
<header>${business ? `<p class="biz">${esc(business)}</p>` : ''}<h1>${esc(title)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}</header>
${note ? `<p class="note">${esc(note)}</p>` : ''}
<main id="app">
${body}
</main>
<footer>Works offline. Anything you save stays in this browser on this device only.</footer>
</div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="app-config">${safeJson(config || {})}</script>
<script>
${read('helpers.js')}
${script ? read(`${script}.js`) : ''}
</script>
</body>
</html>
`;
}

module.exports = { page, accentOf, safeJson, CSP, CSP_META, CSS, read, esc, BG };
