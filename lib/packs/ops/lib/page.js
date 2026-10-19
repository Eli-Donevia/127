// One printable page style for every ops file: calm, high contrast, prints on Letter paper.
// No scripts. The accent comes from the member's brand colors when the brand pack saved them.

const { files, color } = require('../../_kit');

const esc = files.esc;

function accentFor(ctx) {
  const b = (ctx && ctx.brain) || {};
  const saved = (((b.packs || {}).brand || {}).palette || {}).primary;
  const hex = color.isHex(saved) ? saved : '#0f766e';
  return color.ensureContrast ? color.ensureContrast(hex, '#ffffff', 4.5) : hex;
}

function page({ title, kicker, h1, lede, body, accent = '#0f766e', description = '' }) {
  const css = `
@page { size: letter; margin: 0.5in; }
* { box-sizing: border-box; }
body { margin: 0; background: #f6f7f9; color: #111827; font: 15px/1.55 Inter, "Helvetica Neue", Arial, sans-serif; }
main { max-width: 860px; margin: 0 auto; padding: 44px 36px 64px; }
.kicker { font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: ${accent}; font-weight: 800; }
h1 { font-size: 40px; line-height: 1.08; margin: 8px 0 8px; letter-spacing: -.02em; }
h2 { font-size: 13px; letter-spacing: .2em; text-transform: uppercase; color: #4b5563; margin: 36px 0 12px; }
.lede { color: #4b5563; margin: 0 0 18px; font-size: 17px; }
.meta { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 8px; }
.meta span { background: #fff; border: 1px solid #e5e7eb; border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 600; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px 20px; }
table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; font-size: 14px; }
th { text-align: left; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #6b7280; background: #f9fafb; }
th, td { padding: 11px 12px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
tr:last-child td { border-bottom: 0; }
a { color: ${accent}; font-weight: 600; text-decoration: none; }
.free { display: inline-block; background: ${accent}; color: #fff; border-radius: 999px; padding: 2px 9px; font-size: 12px; font-weight: 700; }
.small { color: #6b7280; font-size: 12.5px; }
.steps { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.step { display: grid; grid-template-columns: 28px 34px 1fr; gap: 10px; align-items: start; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px 16px; break-inside: avoid; }
.box { width: 22px; height: 22px; border: 2px solid #111827; border-radius: 6px; margin-top: 2px; }
.n { font-weight: 800; color: ${accent}; font-size: 18px; line-height: 1.4; }
.step b { display: block; font-size: 16px; }
.step p { margin: 3px 0 0; color: #374151; }
.ticks { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
.ticks li { display: flex; gap: 10px; align-items: flex-start; }
.ticks li::before { content: ""; flex: 0 0 16px; height: 16px; border: 2px solid #111827; border-radius: 4px; margin-top: 3px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
ul.plain { margin: 0; padding-left: 20px; } ul.plain li { margin: 4px 0; }
.sign { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 18px; margin-top: 34px; }
.sign div { border-top: 2px solid #111827; padding-top: 6px; font-size: 12px; color: #4b5563; text-transform: uppercase; letter-spacing: .12em; }
pre { white-space: pre-wrap; font: inherit; margin: 0; }
.blank { display: inline-block; min-width: 46px; border-bottom: 1.5px solid #9ca3af; height: 18px; }
footer { margin-top: 36px; color: #6b7280; font-size: 12px; }
@media (max-width: 640px) { main { padding: 28px 16px 48px; } h1 { font-size: 32px; } .two, .ticks { grid-template-columns: 1fr; } table { font-size: 13px; } }
@media print { body { background: #fff; } main { padding: 0; } .card, .step, tr { break-inside: avoid; } h2 { break-after: avoid; } }`;
  const html = `<main><div class="kicker">${esc(kicker)}</div><h1>${esc(h1)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}${body}</main>`;
  return files.htmlDoc({ title, css, body: html, description });
}

module.exports = { page, esc, accentFor };
