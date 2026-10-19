// The refresh itself, from what brand.read_site found and the colors the member picked: a before
// and after board (PNG when this run can render), a printable refresh page with what was found,
// the new colors, taglines and where to update in order, and a zip with the CSS, the colors, the
// board and the logo in the new colors. Remembers the new colors for the other packs.

const { views, save, files, text, ai, brain, time } = require('../../_kit');
const R = require('../lib/refresh');
const P = require('../lib/palettes');
const L = require('../lib/logos');
const { specFrom, png } = require('../lib/kit');

const esc = files.esc;

const TAGLINES = {
  type: 'object',
  properties: { taglines: { type: 'array', items: { type: 'string', maxLength: 70 } } },
  required: ['taglines'],
};

function pageHtml({ spec, site, read, chosen, tags, updates, boardSvg, today, hasPng }) {
  const c = chosen.colors;
  const checks = read.checks || [];
  const bad = checks.filter((x) => !x.pass).length;
  const passing = chosen.checks.filter((x) => x.pass).length;
  const after = chosen.pass ? 'Every pair in the new colors passes.' : `${passing} of ${chosen.checks.length} pairs pass in the new colors; the table below shows which.`;
  const free = updates.filter((u) => /^Free/.test(u.cost)).length;
  const short = [
    bad ? `<b>${text.plural(bad, 'text pair')}</b> on your site ${bad === 1 ? 'is' : 'are'} hard to read. ${after}` : `Your text pairs already pass. ${after}`,
    read.fonts.all.length > 1 ? `<b>${read.fonts.all.length} fonts</b> on one page now. From here, one family in two weights: Inter.` : 'One font family from here, Inter, in two weights.',
    tags[0] ? `A main line to try: <b>${esc(tags[0].text)}</b>` : null,
    `<b>${updates.length} places</b> to update, in the order below. ${free === updates.length ? 'All' : free} of them ${free === 1 ? 'is' : 'are'} free and ${free === 1 ? 'takes' : 'take'} 15 minutes or less.`,
  ].filter(Boolean);
  const swatches = P.ROLES.map(([key, role, use]) => `<div class="sw"><div class="chip" style="background:${c[key]}"></div><b>${esc(role)}</b><span>${esc(c[key].toUpperCase())}</span><small>${esc(use)}</small></div>`).join('');
  const before = (read.current.found || []).slice(0, 6).map((f) => `<div class="sw"><div class="chip" style="background:${f.hex}"></div><b>${esc(f.hex.toUpperCase())}</b><small>${esc(text.list(f.uses.map((u) => (u === 'background' ? 'backgrounds' : u === 'line' ? 'lines' : u === 'variable' ? 'a theme setting' : 'text'))))}</small></div>`).join('');
  const css = `@page{size:letter;margin:.5in}*{box-sizing:border-box}
body{margin:0;background:${c.paper};color:${c.ink};font:15px/1.55 Inter,"Helvetica Neue",Arial,sans-serif}
main{max-width:920px;margin:0 auto;padding:44px 32px 64px}
.kicker{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:${c.muted};font-weight:700}
h1{font-size:42px;line-height:1.05;margin:8px 0 6px;letter-spacing:-.02em}
h2{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:${c.muted};margin:38px 0 12px}
.lede{color:${c.muted};margin:0 0 22px;font-size:17px}
.hero{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:22px;align-items:start}
.board{margin:0;background:#fff;border:1px solid ${c.line};border-radius:20px;padding:10px}.board svg{width:100%;height:auto;display:block}
.board figcaption{font-size:12px;color:${c.muted};padding:6px 6px 2px}
.short{background:#fff;border:1px solid ${c.line};border-radius:16px;padding:20px 22px}.short ol{margin:0;padding-left:20px}.short li{margin:0 0 14px}
.cost{white-space:nowrap}
.grid6{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.sw .chip{height:72px;border-radius:14px;border:1px solid ${c.line};margin-bottom:8px}.sw b,.sw span,.sw small{display:block}
.sw span{font-family:"DejaVu Sans Mono",Menlo,monospace;font-size:13px}.sw small{color:${c.muted};font-size:12px;line-height:1.35}
.card{background:#fff;border:1px solid ${c.line};border-radius:16px;padding:16px 18px;margin-bottom:10px;break-inside:avoid}
ul{margin:0;padding-left:20px}li{margin:5px 0}
table{border-collapse:collapse;width:100%;font-size:14px;background:#fff}td,th{text-align:left;padding:9px 8px;border-bottom:1px solid ${c.line};vertical-align:top}th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${c.muted}}
.pass{color:#1d7a46;font-weight:700}.fail{color:#9a3b00;font-weight:700}
.dot{display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid ${c.line};vertical-align:-2px;margin-right:4px}
.tag{display:inline-block;font-size:12px;color:${c.muted};margin-left:6px}
.big{font-size:21px;font-weight:700;letter-spacing:-.01em}
pre{background:#fff;border:1px solid ${c.line};border-radius:14px;padding:14px;font-size:12.5px;white-space:pre-wrap}
.btn{display:inline-block;background:${c.primary};color:${c.onPrimary};font-weight:700;border-radius:10px;padding:10px 18px}
.n{font-weight:800;color:${c.primary};width:28px}
footer{margin-top:40px;color:${c.muted};font-size:12px}
@media (max-width:700px){main{padding:24px 18px 48px}h1{font-size:32px}.grid6{grid-template-columns:repeat(3,1fr)}.hero{grid-template-columns:1fr}.cost{white-space:normal}table{font-size:13px}td,th{padding:8px 5px}}
@media print{main{padding:0}h2{break-after:avoid}}`;
  const pairRow = (x) => `<tr><td>${esc(x.use)}</td><td><span class="dot" style="background:${x.fg}"></span>${esc(x.fg.toUpperCase())} on <span class="dot" style="background:${x.bg}"></span>${esc(x.bg.toUpperCase())}</td><td>${x.ratio}:1</td><td>${x.need}:1</td><td class="${x.pass ? 'pass' : 'fail'}">${x.pass ? 'Easy to read' : 'Hard to read'}</td></tr>`;
  const newPairs = chosen.checks.map((x) => `<tr><td>${esc(x.use)}</td><td><span class="dot" style="background:${x.fg}"></span>${esc(x.fg.toUpperCase())} on <span class="dot" style="background:${x.bg}"></span>${esc(x.bg.toUpperCase())}</td><td>${x.ratio}:1</td><td class="${x.pass ? 'pass' : 'fail'}">${esc(x.level)}</td></tr>`).join('');
  const body = `<main>
<div class="kicker">Brand refresh</div>
<h1>${esc(spec.name || site.domain)}</h1>
<p class="lede">${read.sample ? 'Read from a sample site for a made-up business. ' : `Read from ${esc(site.domain)} on ${esc(time.longDate(today))}. `}Before is what the page's code sets now. After is "${esc(chosen.label)}": ${esc(chosen.name)}.</p>
<div class="hero"><figure class="board">${boardSvg.replace(/<\?xml[^>]*>/, '')}<figcaption>${hasPng ? 'The board is in your files as a PNG to share, and in the zip as an SVG.' : 'The board is in the zip as an SVG.'}</figcaption></figure>
<div class="short"><h2 style="margin-top:0">In short</h2><ol>${short.map((x) => `<li>${x}</li>`).join('')}</ol></div></div>
<h2>What we found</h2>
${read.issues.length ? `<div class="card"><ul>${read.issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '<div class="card">Nothing to fix in the colors and fonts we could read.</div>'}
${before ? `<h2>Colors on your site now</h2><div class="grid6">${before}</div>` : ''}
<p class="lede" style="margin-top:12px">Fonts now: ${esc(read.fonts.all.length ? text.list(read.fonts.all) : 'set by your site builder, not in the page code')}.</p>
${checks.length ? `<h2>Text pairs on your site</h2><table><tr><th>Where</th><th>Pair</th><th>Ratio</th><th>Needs</th><th>Result</th></tr>${checks.map(pairRow).join('')}</table>` : ''}
<h2>Your new colors</h2>
<div class="grid6">${swatches}</div>
<p style="margin-top:14px"><span class="btn">Book now</span> <span class="tag">Button text ${chosen.checks[1].ratio}:1</span></p>
<table style="margin-top:12px"><tr><th>Use</th><th>Pair</th><th>Ratio</th><th>Result</th></tr>${newPairs}</table>
<h2>For your site builder</h2><pre>${esc(chosen.css)}</pre>
<h2>Fonts</h2><div class="card"><p class="big" style="margin:0">Inter Bold for headlines</p><p style="margin:6px 0 0">Inter Regular for everything else. Free from Google Fonts. One family in two weights replaces ${esc(read.fonts.all.length ? text.list(read.fonts.all) : 'what you have now')}.</p></div>
<h2>Taglines to pick from</h2>
<div class="card"><ul>${tags.map((t) => `<li><b>${esc(t.text)}</b> <span class="tag">${esc(t.from)}</span></li>`).join('')}</ul></div>
<h2>Where to update, in order</h2>
<table><tr><th></th><th>Where</th><th>What to do</th><th>Cost and time</th></tr>${updates.map((u) => `<tr><td class="n">${u.n}</td><td><b>${esc(u.where)}</b></td><td>${esc(u.what)}</td><td class="cost">${esc(u.cost)}</td></tr>`).join('')}</table>
<h2>Not yet</h2>
<div class="card"><ul><li>Keep your business name. A refresh changes how it looks, not what people search for.</li><li>Don't rebuild the whole site. Colors, fonts and the main line are most of the change.</li><li>Don't reprint everything at once. Swap printed things as you run out.</li></ul></div>
<footer>${read.sample ? 'Sample site, made up for 127.' : `Before is what ${esc(site.domain)} set in its page and ${text.plural(site.stylesheets || 0, 'stylesheet')} on ${esc(time.longDate(today))}; your site builder may set more.`} Contrast checked to WCAG: 4.5:1 for text, 3:1 for large headings.</footer>
</main>`;
  return files.htmlDoc({ title: `${spec.name || site.domain} brand refresh`, css, body, description: `Before and after colors, fonts and taglines for ${spec.name || site.domain}` });
}

module.exports = {
  name: 'brand.refresh',
  title: 'Brand refresh',
  description: 'Turns what was read from your website and the colors you picked into a before and after board, a printable refresh page with the new colors, fonts, taglines and where to update in order, and a zip with the CSS, the board and your logo in the new colors.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 4,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      site: { title: 'What brand.read_site found' },
      palette: { title: 'The colors you picked' },
      name: { type: 'string', title: 'Business name (optional)', maxLength: 60 },
      what: { type: 'string', title: 'What you sell (optional)', maxLength: 200 },
      city: { type: 'string', title: 'City (optional)', maxLength: 80 },
    },
    required: ['site'],
  },
  output: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      chosen: { type: 'object' },
      taglines: { type: 'array' },
      updates: { type: 'array' },
      board: { type: ['object', 'null'] },
      page: { type: 'object' },
      zip: { type: 'object' },
      ai: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['page', 'zip'],
  },
  async run(input, ctx) {
    const read = input.site && input.site.options ? input.site : null;
    if (!read) throw new Error('Read your website first, then pick the colors.');
    const picked = Array.isArray(input.palette) ? input.palette[0] : input.palette;
    const chosen = (picked && picked.colors ? read.options.find((o) => o.id === picked.id) || picked : null) || read.options[0];
    const spec = specFrom({ name: input.name || read.name, what: input.what || read.what || undefined, city: input.city, palette: chosen.colors }, ctx);
    if (!spec.name) spec.name = read.name || read.site.domain;
    const today = time.today(ctx);
    const site = read.site;

    // Taglines: the business's own facts, sharpened by AI only when every line stays plain.
    const base = R.taglines(spec, site);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write short taglines for small local businesses. Plain words a customer would say. No exclamation marks, no superlatives like best or number one, no promises about results the owner does not control.',
      prompt: [`Business: ${spec.name}`, `What: ${spec.what || spec.descriptor}`, spec.city ? `Where: ${spec.city}` : '', site.h1 ? `Their current main line: ${site.h1}` : '', site.description ? `Their page description: ${site.description}` : '', spec.offer ? `Offer: ${spec.offer}` : '', 'Return 4 taglines, each under 60 characters, sentence case, ending with a period.'].filter(Boolean).join('\n'),
      schema: TAGLINES,
      fallback: () => ({ taglines: base.map((t) => t.text) }),
      accept: (d) => ai.cleanCopy(d) && d.taglines.length >= 3 && d.taglines.every((t) => t.length <= 60 && !/!/.test(t) && !R.HYPE.test(t)),
    });
    const tags = usedAi ? [...base.filter((t) => t.from === 'Your current line'), ...data.taglines.map((t) => ({ text: text.sentenceCase(text.oneLine(t)), from: 'Written for you' }))].slice(0, 5) : base;

    const updates = R.updateList({ issues: (read.issueKeys || []).map((k) => ({ key: k })), chosen, page: site, platform: site.platform });
    const boardSvg = R.boardSvg({ spec, cur: read.current, fonts: read.fonts, beforeChecks: read.checks || [], chosen, line: site.h1, newLine: tags[0] && tags[0].text });
    const boardPng = await png(ctx, boardSvg, { width: 1080 });
    const name = spec.name;
    const board = boardPng ? await save.saveFile(ctx, save.fileName(name, 'brand refresh', '.png'), boardPng) : null;
    const page = await save.saveFile(ctx, save.fileName(name, 'brand refresh', '.html'), pageHtml({ spec, site, read, chosen, tags, updates, boardSvg, today, hasPng: !!boardPng }));
    const d = L.draw('wordmark', spec, 'color');
    const dr = L.draw('wordmark', spec, 'reverse');
    const m = L.draw('monogram', spec, 'color');
    const entries = [
      { name: 'colors.css', data: chosen.css },
      { name: 'colors.json', data: JSON.stringify({ name: chosen.name, label: chosen.label, colors: chosen.colors, checks: chosen.checks }, null, 2) },
      { name: 'before-and-after.svg', data: boardSvg },
      { name: 'logo.svg', data: L.logoSvg(d, { title: name }) },
      { name: 'logo-white.svg', data: L.logoSvg(dr, { title: name }) },
      { name: 'square-mark.svg', data: L.markSvg(m, { size: 512, title: name }) },
      { name: 'taglines.txt', data: `${tags.map((t) => t.text).join('\n')}\n` },
    ];
    if (boardPng) entries.push({ name: 'before-and-after.png', data: boardPng });
    const zip = await save.saveFile(ctx, save.fileName(name, 'refresh files', '.zip'), files.zip(entries));
    // Saved for the other workflows (palette, social kit, email and ads pages). A sample run saves nothing.
    if (!read.sample) {
      await brain.remember(ctx, 'colors', { ...chosen.colors, name: chosen.name, refreshedOn: today, from: site.domain });
      await brain.remember(ctx, 'primary', chosen.colors.primary);
    }
    ctx.log(`Refresh built: ${chosen.label} (${chosen.name}), ${text.plural(updates.length, 'place')} to update.`);
    return {
      name,
      chosen: { id: chosen.id, label: chosen.label, name: chosen.name, colors: chosen.colors, css: chosen.css },
      taglines: tags,
      updates,
      board,
      page,
      zip,
      ai: usedAi,
      sample: !!read.sample,
    };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text('This refresh is for a sample site. Add your own website address to refresh yours.') : null,
      out.board ? views.image(out.board, `Before and after: ${out.chosen.label}`) : views.text(`Before and after: ${out.chosen.label}. The board is in the zip as an SVG.`),
      views.copy('Your new colors (CSS variables)', out.chosen.css),
      views.cards(out.taglines.map((t) => ({ title: t.text, subtitle: t.from }))),
      views.table([{ key: 'n', label: '#' }, { key: 'where', label: 'Where' }, { key: 'what', label: 'What to do' }, { key: 'cost', label: 'Cost' }], out.updates),
      views.file(out.page, 'Your refresh: what we found, new colors, taglines and where to update (printable)'),
      views.file(out.zip, 'Refresh files: CSS, colors, the board and your logo in the new colors')
    );
  },
};
