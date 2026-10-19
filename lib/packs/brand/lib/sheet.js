// One printable brand sheet (HTML, no scripts): logo, mark, colors with hex codes and CSS
// variables, type, voice, bios and the rules for using the logo. Prints on one or two Letter pages.

const { files } = require('../../_kit');
const L = require('./logos');
const P = require('./palettes');

const esc = files.esc;

function sheetHtml({ spec, conceptId, voice, notYet = [] }) {
  const c = spec.colors;
  const d = L.draw(conceptId, spec, 'color');
  const rev = L.draw(conceptId, spec, 'reverse');
  const logo = L.logoSvg(d, { pad: 0.04 });
  const logoRev = L.logoSvg(rev, { pad: 0.04 });
  const mark = L.markSvg(d, { size: 120 });
  const checks = P.checks(c);
  const swatches = P.ROLES.map(([key, role, use]) => `<div class="sw"><div class="chip" style="background:${c[key]}"></div><b>${esc(role)}</b><span>${esc(c[key].toUpperCase())}</span><small>${esc(use)}</small></div>`).join('');
  const li = (arr) => arr.map((x) => `<li>${esc(x)}</li>`).join('');
  const bios = voice && voice.bios ? voice.bios.map((b) => `<div class="bio"><b>${esc(b.label)} ${esc(b.field.toLowerCase())}</b><p>${esc(b.text)}</p><small>${b.chars} characters${b.limit ? `, limit ${b.limit}` : `, kept under ${b.target}`}</small></div>`).join('') : '';
  const css = `
@page { size: letter; margin: 0.5in; }
* { box-sizing: border-box; }
body { margin: 0; background: ${c.paper}; color: ${c.ink}; font: 15px/1.5 Inter, "Helvetica Neue", Arial, sans-serif; }
main { max-width: 900px; margin: 0 auto; padding: 48px 40px 64px; }
.kicker { font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: ${c.muted}; font-weight: 700; }
h1 { font-size: 44px; line-height: 1.05; margin: 8px 0 6px; letter-spacing: -.02em; }
h2 { font-size: 13px; letter-spacing: .2em; text-transform: uppercase; color: ${c.muted}; margin: 40px 0 14px; }
.lede { color: ${c.muted}; margin: 0 0 28px; font-size: 17px; }
.hero { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
.panel { border-radius: 20px; padding: 32px; display: flex; align-items: center; justify-content: center; min-height: 220px; }
.panel svg { max-width: 100%; height: auto; max-height: 180px; }
.light { background: #fff; border: 1px solid ${c.line}; }
.dark { background: ${c.primary}; }
.grid6 { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.sw .chip { height: 84px; border-radius: 14px; border: 1px solid ${c.line}; margin-bottom: 8px; }
.sw b, .sw span, .sw small { display: block; }
.sw span { font-family: "DejaVu Sans Mono", Menlo, monospace; font-size: 13px; }
.sw small { color: ${c.muted}; font-size: 12px; line-height: 1.35; }
pre { background: #fff; border: 1px solid ${c.line}; border-radius: 14px; padding: 16px; font-size: 12.5px; overflow: auto; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
ul { margin: 0; padding-left: 20px; } li { margin: 4px 0; }
.words { display: flex; gap: 10px; flex-wrap: wrap; }
.words span { background: ${c.surface}; border-radius: 999px; padding: 8px 14px; font-weight: 600; }
.bio { background: #fff; border: 1px solid ${c.line}; border-radius: 14px; padding: 14px 16px; margin-bottom: 10px; }
.bio p { margin: 4px 0; } .bio small { color: ${c.muted}; }
table { border-collapse: collapse; width: 100%; font-size: 14px; } td, th { text-align: left; padding: 8px 6px; border-bottom: 1px solid ${c.line}; }
.pass { color: #1d7a46; font-weight: 700; } .fail { color: #9a5a00; font-weight: 700; }
.type { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.type div { background: #fff; border: 1px solid ${c.line}; border-radius: 14px; padding: 18px; }
.big { font-size: 34px; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; }
footer { margin-top: 40px; color: ${c.muted}; font-size: 12px; }
@media (max-width: 700px) { .hero, .two, .type { grid-template-columns: 1fr; } .grid6 { grid-template-columns: repeat(3, 1fr); } }
@media print { main { padding: 0; } h2 { break-after: avoid; } .panel, .bio, .sw { break-inside: avoid; } }`;
  const body = `<main>
<div class="kicker">Brand sheet</div>
<h1>${esc(spec.name)}</h1>
<p class="lede">${esc(spec.descriptor)}${spec.city ? ` in ${esc(spec.city)}` : ''}. Keep this next to you when you make a post, a flyer, a sign or a website.</p>
<div class="hero"><div class="panel light">${logo}</div><div class="panel dark">${logoRev}</div></div>
<h2>Logo rules</h2>
<div class="two"><ul>
<li>Leave space around the logo at least as wide as one letter of the name.</li>
<li>Use the color version on light backgrounds and the white version on your main color.</li>
<li>Smallest size: 64 pixels wide on screens, 1 inch in print. Below that, use the square mark.</li>
</ul><ul>
<li>Never stretch, squash, outline or add shadows.</li>
<li>Never recolor it outside these colors.</li>
<li>The square mark (right) is your profile picture and favicon.</li>
</ul></div>
<div style="margin-top:14px">${mark}</div>
<h2>Colors</h2>
<div class="grid6">${swatches}</div>
<h2>Contrast check</h2>
<table><tr><th>Use</th><th>Pair</th><th>Ratio</th><th>Result</th></tr>${checks.map((x) => `<tr><td>${esc(x.use)}</td><td>${esc(x.fg)} on ${esc(x.bg)}</td><td>${x.ratio}:1</td><td class="${x.pass ? 'pass' : 'fail'}">${esc(x.level)}</td></tr>`).join('')}</table>
<h2>For your website builder</h2>
<pre>${esc(P.cssVars(c))}</pre>
<h2>Type</h2>
<div class="type"><div><div class="big">Inter Bold for headlines</div><p>Free from Google Fonts. Tight spacing, sentence case.</p></div><div><p style="font-size:17px">Inter Regular for everything else, 15 to 17 pixels on screens and 10 to 11 points in print. One font family keeps it clean.</p></div></div>
${voice ? `<h2>Voice</h2>
<div class="words">${voice.words.map((w) => `<span>${esc(w)}</span>`).join('')}</div>
<div class="two" style="margin-top:18px"><div><b>Do</b><ul>${li(voice.do)}</ul></div><div><b>Don't</b><ul>${li(voice.dont)}</ul></div></div>
<h2>Bios</h2>${bios}
<h2>Taglines</h2><ul>${li(voice.taglines)}</ul>` : ''}
${notYet.length ? `<h2>Not yet</h2><ul>${li(notYet)}</ul>` : ''}
<footer>Made with 127. Colors checked for contrast (WCAG). Search the trademark office (tmsearch.uspto.gov) before you file or print in bulk.</footer>
</main>`;
  return files.htmlDoc({ title: `${spec.name} brand sheet`, css, body, description: `Logo, colors, type and voice for ${spec.name}` });
}

module.exports = { sheetHtml };
