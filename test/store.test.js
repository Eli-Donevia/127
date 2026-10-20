// The HQ Store (W7): lib/store.js (store.json checks, search, gated files, prompt packs) and the
// store pack's "Make it mine" filler (lib/packs/store): every escape, Office parts, xlsx cells,
// zips, Liquid, brand colors and fallbacks. No network, no AI. Run with: npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const store = require('../lib/store');
const fill = require('../lib/packs/store/lib/fill');
const { valuesFor, brandColor } = require('../lib/packs/store/lib/values');
const tool = require('../lib/packs/store/tools/make-it-mine');
const storePack = require('../lib/packs/store');
const { makeCtx, runTool } = require('../lib/harness/testing');
const { zip, unzip } = require('../lib/packs/_kit/files');
const fx = require('./fixtures/store-fixture');

const TOKENS = store.TOKENS;
const opts = (values = {}) => ({ values, tokens: TOKENS, report: fill.report(), now: Date.UTC(2026, 9, 20) });
const part = (buf, name) => unzip(buf).find((e) => e.name === name).data.toString('utf8');

function fixture() {
  const { items, files } = fx.standard();
  const w = fx.writeStore({ items, files });
  return { ...w, lib: store.load(w.dir, { promptsFile: w.promptsFile }) };
}

// ---------- the filler ----------

test('each file type escapes values its own way', () => {
  const v = { 'business.name': 'A&B <C> "D"', 'owner.first': 'Maya\nRose' };
  assert.equal(fill.fillString('<h1>{{business.name}}</h1>', 'html', opts(v)), '<h1>A&amp;B &lt;C&gt; &quot;D&quot;</h1>');
  assert.equal(fill.fillBuffer('x.svg', Buffer.from('<text>{{business.name}}</text>'), opts(v)).toString(), '<text>A&amp;B &lt;C&gt; &quot;D&quot;</text>');
  // md and txt: as is, newlines turned into spaces
  assert.equal(fill.fillBuffer('x.md', Buffer.from('# {{business.name}} by {{owner.first}}'), opts(v)).toString(), '# A&B <C> "D" by Maya Rose');
  assert.equal(fill.fillBuffer('x.txt', Buffer.from('{{owner.first}}'), opts(v)).toString(), 'Maya Rose');
  // csv: the field is quoted when the value needs it, and a quoted field stays one field
  const csv = 'Name,Note,Plain\r\n{{business.name}},"Hi, {{owner.first}}",x\r\n';
  assert.equal(fill.fillBuffer('x.csv', Buffer.from(csv), opts(v)).toString(), 'Name,Note,Plain\r\n"A&B <C> ""D""","Hi, Maya\nRose",x\r\n');
  assert.equal(fill.fillBuffer('x.csv', Buffer.from('﻿a,{{business.name}}\n'), opts({ 'business.name': 'Plain Co' })).toString(), '﻿a,Plain Co\n');
  // json: JSON-string escaped
  assert.equal(fill.fillBuffer('x.json', Buffer.from('{"t":"{{business.name}}"}'), opts(v)).toString(), '{"t":"A&B <C> \\"D\\""}');
});

test('an XML-breaking value like A&B <C> stays well-formed in docx, xlsx and pptx parts', () => {
  const v = { 'business.name': 'A&B <C>', year: '2026' };
  const d = fill.fillBuffer('x.docx', fx.docx(true), opts(v));
  const doc = part(d, 'word/document.xml');
  assert.match(doc, /Welcome to A&amp;B &lt;C&gt;<\/w:t>/);
  assert.doesNotMatch(doc, /A&B|<C>/);
  assert.match(part(d, 'word/footer1.xml'), /A&amp;B &lt;C&gt; 2026/);
  const pptx = zip([{ name: 'ppt/slides/slide1.xml', data: '<p:sld><a:t>{{business.name}}</a:t></p:sld>' }, { name: 'ppt/notesSlides/notesSlide1.xml', data: '<a:t>{{business.name}}</a:t>' }]);
  const p = fill.fillBuffer('x.pptx', pptx, opts(v));
  assert.equal(part(p, 'ppt/slides/slide1.xml'), '<p:sld><a:t>A&amp;B &lt;C&gt;</a:t></p:sld>');
  assert.equal(part(p, 'ppt/notesSlides/notesSlide1.xml'), '<a:t>{{business.name}}</a:t>', 'only the schema parts are filled');
  const x = zip([{ name: 'xl/sharedStrings.xml', data: '<sst><si><t>{{business.name}}</t></si></sst>' }, { name: 'xl/worksheets/sheet1.xml', data: '<c t="inlineStr"><is><t>{{business.name}}</t></is></c>' }]);
  const xo = fill.fillBuffer('x.xlsx', x, opts(v));
  assert.equal(part(xo, 'xl/sharedStrings.xml'), '<sst><si><t>A&amp;B &lt;C&gt;</t></si></sst>');
  assert.match(part(xo, 'xl/worksheets/sheet1.xml'), /A&amp;B &lt;C&gt;/);
});

test('docx: a token inside one run is filled; one split across runs is left as written', () => {
  const rep = fill.report();
  const d = fill.fillBuffer('x.docx', fx.docx(true), { values: { 'business.name': 'Glow Co', 'business.city': 'Austin' }, tokens: TOKENS, report: rep });
  const doc = part(d, 'word/document.xml');
  assert.match(doc, /<w:r><w:rPr><w:b\/><\/w:rPr><w:t xml:space="preserve">Welcome to Glow Co<\/w:t><\/w:r>/);
  assert.match(doc, /<w:r><w:t>\{\{business\.<\/w:t><\/w:r><w:r><w:t>city\}\}<\/w:t><\/w:r>/, 'a split token is never half-filled');
  assert.match(doc, /Reach \[you@yourbusiness\.com\]/, 'no email given: the default fallback');
  assert.match(part(d, 'word/styles.xml'), /\{\{business\.name\}\} stays/, 'styles are not a text part');
  assert.ok(rep.used.has('business.name') && rep.missing.has('contact.email'));
});

test('brand.color is written only as #RRGGBB, else the fallback', () => {
  const src = '<rect fill="{{brand.color|#141418}}"/><rect fill="{{brand.color}}"/>';
  for (const bad of ['red', '#fff', '#12345G', '2F6F4F', '#2F6F4F"/><script>', '']) {
    const rep = fill.report();
    assert.equal(fill.fillString(src, 'html', { values: { 'brand.color': bad }, tokens: TOKENS, report: rep }), '<rect fill="#141418"/><rect fill="#F5F5F5"/>', bad);
    assert.ok(rep.missing.has('brand.color'));
  }
  assert.equal(fill.fillString(src, 'html', opts({ 'brand.color': '#2f6F4f' })), '<rect fill="#2f6F4f"/><rect fill="#2f6F4f"/>');
  // Where the color comes from: the brand pack first, then any pack's saved hex color.
  assert.equal(brandColor({ packs: { brand: { palette: { primary: '#112233' } }, social: { color: '#445566' } } }), '#112233');
  assert.equal(brandColor({ packs: { brand: { primary: 'blue' }, social: { style: { color: '#445566' } } } }), '#445566');
  assert.equal(brandColor({ packs: { site: { site: { color: '#778899' } } } }), '#778899');
  assert.equal(brandColor({ packs: { brand: { primary: '#abc' } } }), null);
});

test('missing values fall back (the token\'s own fallback first) and are reported to fill in', () => {
  const rep = fill.report();
  const out = fill.fillString('{{business.name}} / {{business.price|Ask me}} / {{business.city}} / {{today}}', 'text', { values: { 'business.city': 'Austin', today: 'October 20, 2026' }, tokens: TOKENS, report: rep });
  assert.equal(out, '[Your business] / Ask me / Austin / October 20, 2026');
  assert.deepEqual([...rep.missing].sort(), ['business.name', 'business.price']);
  assert.deepEqual([...rep.used].sort(), ['business.city', 'today']);
});

test('Liquid: {{ x }} with spaces, other names and {% tags %} stay; schema defaults are JSON-escaped', () => {
  const src = [
    '<h2>{{ section.settings.heading }}</h2><p>{{product.title}} by {{business.name}}</p>',
    '{%- if section.settings.show -%}{{ "x" | t }}{%- endif -%}',
    '{% schema %}{"name":"Hero","settings":[{"id":"heading","default":"Welcome to {{business.name}}"}]}{% endschema %}',
    '{%- schema -%}{"default":"{{owner.first}}"}{%- endschema -%}<span>{{owner.first}}</span>',
  ].join('\n');
  const out = fill.fillBuffer('hero.liquid', Buffer.from(src), opts({ 'business.name': 'Tom "&" <Jo>\nCo', 'owner.first': 'Ana "A"' })).toString();
  assert.match(out, /<h2>\{\{ section\.settings\.heading \}\}<\/h2>/);
  assert.match(out, /\{\{product\.title\}\} by Tom &quot;&amp;&quot; &lt;Jo&gt; Co<\/p>/, 'HTML-escaped outside the schema, newline to space');
  assert.match(out, /\{%- if section\.settings\.show -%\}\{\{ "x" \| t \}\}\{%- endif -%\}/);
  assert.match(out, /"default":"Welcome to Tom \\"&\\" <Jo> Co"\}\]\}\{% endschema %\}/, 'JSON-escaped inside the schema');
  assert.match(out, /\{%- schema -%\}\{"default":"Ana \\"A\\""\}\{%- endschema -%\}<span>Ana &quot;A&quot;<\/span>/);
  JSON.parse(out.match(/\{% schema %\}([\s\S]*?)\{% endschema %\}/)[1]);
});

test('a zip: text files in nested folders are filled, everything else is copied as is', () => {
  const out = fill.fillBuffer('crm.zip', fx.notionZip(true), opts({ 'business.name': 'Glow, "Co"', 'owner.first': 'Ana' }));
  const e = Object.fromEntries(unzip(out).map((x) => [x.name, x.data]));
  assert.deepEqual(Object.keys(e), ['Founder OS/', 'Founder OS/Home.md', 'Founder OS/Pages/Clients.csv', 'Founder OS/logo.png']);
  assert.equal(e['Founder OS/Home.md'].toString(), '# Glow, "Co" HQ\nRun by Ana\n');
  assert.equal(e['Founder OS/Pages/Clients.csv'].toString(), 'Name,Owner\r\n"Acme, Inc","Glow, ""Co"""\r\n');
  assert.deepEqual([...e['Founder OS/logo.png']], [0x89, 0x50, 0x4e, 0x47, 0x7b, 0x7b]);
  // Sizes written after the data (some apps do): read from the zip's own directory instead.
  const late = Buffer.from(fx.notionZip(true));
  const second = late.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 4);
  late.writeUInt32LE(0, second + 18); // Home.md's local header no longer says how big it is
  assert.notEqual(unzip(late).length, 4, 'the kit alone would stop short');
  const lateOut = Object.fromEntries(unzip(fill.fillBuffer('crm.zip', late, opts({ 'business.name': 'Late Co' }))).map((x) => [x.name, x.data.toString()]));
  assert.equal(lateOut['Founder OS/Home.md'], '# Late Co HQ\nRun by [Your name]\n');
  // A zip whose directory doesn't match what was read is refused, never half-filled.
  const broken = Buffer.concat([fx.notionZip(true).subarray(0, 60), fx.notionZip(true).subarray(-22)]);
  assert.throws(() => fill.fillBuffer('crm.zip', broken, opts()), /couldn't be opened/);
});

test('xlsx cells: a string cell, a number cell, a new cell in its row, and one left alone', () => {
  const rep = fill.report();
  const cells = [
    { cell: 'Start here!B3', value: 'First-Sale Math: {{business.name}}' },
    { cell: 'Math & more!C5', value: '{{business.price}}/mo', number: true },
    { cell: 'Math & more!D5', value: '{{business.city}}' },
    { cell: 'Math & more!B9', value: 'Made {{today}}' },
    { cell: 'Math & more!E5', value: 'Priced at {{business.price}}', number: true },
  ];
  const r = fill.setCells(fx.xlsx(), cells, { values: { 'business.name': 'A&B <C>', 'business.price': '$1,250.50', today: 'October 20, 2026' }, tokens: TOKENS, report: rep });
  assert.deepEqual(r.set, ['Start here!B3', 'Math & more!C5', 'Math & more!B9', 'Math & more!E5']);
  assert.deepEqual(r.left, ['Math & more!D5'], 'no city saved: that cell stays as it is');
  assert.ok(rep.missing.has('business.city'));
  const s1 = part(r.data, 'xl/worksheets/sheet1.xml');
  assert.match(s1, /<c r="B3" s="4" t="inlineStr"><is><t xml:space="preserve">First-Sale Math: A&amp;B &lt;C&gt;<\/t><\/is><\/c>/);
  const s2 = part(r.data, 'xl/worksheets/sheet2.xml');
  assert.match(s2, /<c r="C5" s="7"><v>1250\.5<\/v><\/c>/, 'the first number in "$1,250.50/mo"');
  assert.match(s2, /<c r="E5" s="7"><v>1250\.5<\/v><\/c>/);
  assert.match(s2, /<row r="9"><c r="A9"><v>1<\/v><\/c><c r="B9" t="inlineStr"><is><t xml:space="preserve">Made October 20, 2026<\/t><\/is><\/c><\/row>/, 'a new cell joins its row in column order');
  assert.match(part(r.data, 'xl/workbook.xml'), /<\/sheets><calcPr fullCalcOnLoad="1"\/>/);
  // E5 had a formula, so Excel's calculation chain goes with it.
  const names = unzip(r.data).map((e) => e.name);
  assert.ok(!names.includes('xl/calcChain.xml'));
  assert.doesNotMatch(part(r.data, '[Content_Types].xml'), /calcChain/);
  assert.doesNotMatch(part(r.data, 'xl/_rels/workbook.xml.rels'), /calcChain/);
  // number: true with no number in the value writes it as text; a new row lands in row order.
  const r2 = fill.setCells(fx.xlsx(), [{ cell: 'Math & more!C7', value: '{{business.price}}', number: true }], opts({ 'business.price': 'Call for a quote' }));
  assert.match(part(r2.data, 'xl/worksheets/sheet2.xml'), /<\/row><row r="7"><c r="C7" t="inlineStr"><is><t xml:space="preserve">Call for a quote<\/t><\/is><\/c><\/row><row r="9">/);
  assert.equal(fill.firstNumber('$45/mo'), 45);
  assert.equal(fill.firstNumber('about 3.5k'), 3.5);
  assert.equal(fill.firstNumber('no price'), null);
});

test('values come from the brain, the member and the form, dated in the member\'s time zone', () => {
  const v = valuesFor({
    brain: { business: { name: 'Glow Co', price: '45', timezone: 'America/Los_Angeles' }, links: { instagram: 'glowco', tiktok: '@glow', website: 'https://glow.co' }, packs: { brand: { primary: '#2F6F4F' } } },
    member: { firstName: 'Maya' },
    inputs: { email: 'hi@glow.co', phone: '(512) 555-0100' },
    now: Date.parse('2026-10-21T05:00:00Z'), // still Oct 20 in Los Angeles
  });
  assert.equal(v.today, 'October 20, 2026');
  assert.equal(v.year, '2026');
  assert.equal(v['business.price'], '$45');
  assert.equal(v['links.instagram'], '@glowco');
  assert.equal(v['links.tiktok'], '@glow');
  assert.equal(v['owner.first'], 'Maya');
  assert.equal(v['brand.color'], '#2F6F4F');
  assert.equal(v['contact.email'], 'hi@glow.co');
  assert.equal(valuesFor({ now: Date.parse('2026-10-21T04:00:00Z') }).today, 'October 20, 2026', 'Chicago when no zone is saved');
  assert.equal(valuesFor({ inputs: { email: 'not an email' } })['contact.email'], undefined);
});

// ---------- the loader ----------

test('store.json loads: kinds, types and tiers from the schema, files by name, .tpl never a download', () => {
  const { lib } = fixture();
  assert.deepEqual(lib.problems, []);
  assert.equal(lib.items.length, 6);
  const q = store.get('quote', lib);
  assert.deepEqual(Object.keys(q.files), ['127-quote.docx', '127-quote.html', '127-quote.md']);
  assert.equal(q.disclaimer, 'Template, not legal advice. Have a professional review any agreement before you sign.');
  assert.equal(lib.kinds.notion, 'Notion system', 'schema labels fill in what store.json leaves out');
  // Search: title, summary, tags and the kind's label; `any` items fit every business type.
  assert.deepEqual(store.list({ type: 'local' }, lib).map((i) => i.id), ['quote', 'first-sale-math', 'crm', 'prompts-brain']);
  assert.deepEqual(store.list({ type: 'idea' }, lib).map((i) => i.id), ['first-sale-math', 'crm', 'prompts-brain', 'deck-pitch']);
  assert.deepEqual(store.list({ q: 'notion' }, lib).map((i) => i.id), ['crm']);
  assert.deepEqual(store.list({ q: 'prompt pack' }, lib).map((i) => i.id), ['prompts-brain']);
  assert.deepEqual(store.list({ q: 'money sale' }, lib).map((i) => i.id), ['first-sale-math']);
  assert.deepEqual(store.list({ kind: 'doc', q: 'pricing' }, lib).map((i) => i.id), ['quote']);
  // An item behind its own flag shows only while that flag is on.
  assert.equal(store.get('site-agency', lib), null);
  process.env.STORE_SITES = 'on';
  assert.equal(store.get('site-agency', lib).id, 'site-agency');
  delete process.env.STORE_SITES;
});

test('bad ids, path traversal, .tpl downloads and unknown kinds are refused', () => {
  const { items, files } = fx.standard();
  const base = items[0];
  const bad = [
    { ...base, id: '../quote' },
    { ...base, id: 'Quote' },
    { ...base, id: 'q2', formats: [{ ...base.formats[0], file: 'files/q2/../../../etc/passwd' }] },
    { ...base, id: 'q3', formats: [{ ...base.formats[0], file: 'files/quote/127-quote.docx' }] },
    { ...base, id: 'q4', formats: [{ ...base.formats[0], file: 'files/q4/127-quote.docx.tpl' }], makeItMine: null },
    { ...base, id: 'q5', preview: '/etc/passwd' },
    { ...base, id: 'q6', kind: 'contract' },
    { ...base, id: 'q7', businessTypes: ['moon'] },
    { ...base, id: 'q8', tier: 'gold' },
    { ...base, id: 'q9', links: [{ label: 'x', url: 'javascript:alert(1)', type: 'copy' }] },
    { ...base, id: 'q10', makeItMine: { ...base.makeItMine, tokens: ['business.secret'] } },
    { ...base, id: 'q11', flag: 'lower-case' },
    { ...base, id: 'q12', links: [{ label: 'x', url: '//evil.example/app', type: 'open' }] },
    { ...base, id: 'q13', links: [{ label: 'x', url: '/app//evil.example', type: 'open' }] },
    { ...base, id: 'q14', links: [{ label: 'x', url: '/app/../admin', type: 'open' }] },
    { ...base, id: 'q15', links: [{ label: 'x', url: '/app/\\evil.example', type: 'open' }] },
    { ...base, id: 'q16', links: [{ label: 'x', url: '/admin/hq', type: 'open' }] },
    { ...base, id: 'q17', links: [{ label: 'x', url: '/app/hq"onmouseover=x', type: 'open' }] },
    base,
    { ...base },
  ];
  const w = fx.writeStore({ items: bad, files });
  const lib = store.load(w.dir, { promptsFile: w.promptsFile });
  assert.deepEqual(lib.items.map((i) => i.id), ['quote'], 'only the one good item, once');
  for (const id of ['bad id "../quote"', 'bad id "Quote"', 'q2: bad file path', 'q3: bad file path', "q4: a .tpl source can't be a download", 'q5: bad preview path', 'q6: unknown kind', 'q7: businessTypes', "q8: tier gold isn't a plan key", 'q9: bad link', 'q10: unknown token', 'q11: bad flag', 'q12: bad link', 'q13: bad link', 'q14: bad link', 'q15: bad link', 'q16: bad link', 'q17: bad link', 'quote: duplicate id']) {
    assert.ok(lib.problems.some((p) => p.startsWith(id)), `${id} in ${lib.problems.join(' | ')}`);
  }
  assert.throws(() => store.load(w.dir, { strict: true, promptsFile: w.promptsFile }), /q2: bad file path/);
  fs.writeFileSync(path.join(w.dir, 'store.json'), JSON.stringify({ items: [{ ...base }], kinds: { contract: 'Contract' } }));
  assert.match(store.load(w.dir, { promptsFile: w.promptsFile }).problems[0], /contract isn't a schema kind/);
  // No store.json yet: an empty Store, not a crash.
  assert.equal(store.load(path.join(w.dir, 'nowhere')).items.length, 0);
});

test('links: https outside links open in a new tab; same-site /app/ paths are kept as internal', () => {
  const { items, files } = fx.standard();
  const base = items[0];
  const links = [
    { label: 'Make it mine', url: '/app/hq/w/site.build_tonight?in_design=foundry', type: 'open' },
    { label: 'Make a copy', url: 'https://docs.google.com/spreadsheets/d/abc/copy', type: 'copy' },
  ];
  const w = fx.writeStore({ items: [{ ...base, links }], files });
  const lib = store.load(w.dir, { promptsFile: w.promptsFile });
  assert.deepEqual(lib.problems, []);
  assert.deepEqual(lib.items[0].links.map((l) => [l.url, l.internal]), [[links[0].url, true], [links[1].url, false]]);
});

test('resolveFile: listed downloads and previews only; a .tpl on disk is never served', () => {
  const { lib, dir } = fixture();
  const hit = store.resolveFile('quote', '127-quote.docx', lib);
  assert.equal(hit.abs, path.join(dir, 'files', 'quote', '127-quote.docx'));
  assert.equal(hit.isPreview, false);
  assert.ok(store.resolveFile('quote', 'preview.png', lib).isPreview);
  assert.ok(fs.existsSync(path.join(dir, 'files', 'quote', '127-quote.docx.tpl')));
  for (const [id, name] of [['quote', '127-quote.docx.tpl'], ['quote', '127-quote.md.tpl'], ['crm', '127-crm.zip.tpl'], ['quote', '..'], ['quote', '../crm/127-crm.zip'], ['../quote', '127-quote.docx'], ['quote', '127-crm.zip'], ['quote', 'store.json'], ['deck-pitch', 'preview.png'], ['nope', '127-quote.docx']]) {
    assert.equal(store.resolveFile(id, name, lib), null, `${id}/${name}`);
  }
  // Make it mine reads the .tpl itself, never through a route.
  assert.ok(store.sourceFile('quote', '127-quote.docx', lib).abs.endsWith('127-quote.docx.tpl'));
  assert.ok(store.sourceFile('first-sale-math', '127-first-sale-math.xlsx', lib).abs.endsWith('127-first-sale-math.xlsx'));
  assert.equal(store.sourceFile('quote', '127-quote.docx.tpl', lib), null);
});

test('prompt packs: text from the prompts manifest, gated per prompt, never its origin', () => {
  const { lib } = fixture();
  assert.ok(!JSON.stringify(lib.prompts).includes('ORIGIN-MARKER'));
  assert.ok(store.promptsForGroup('brain', lib).every((p) => !('origin' in p)));
  const item = store.get('prompts-brain', lib);
  const free = store.promptsFor(item, { tier: 'free' }, lib);
  assert.deepEqual(free.map((p) => [p.id, p.locked, !!p.text]), [['brain.interview', false, true], ['brain.vault', true, false]]);
  assert.ok(store.promptsFor(item, { tier: 'builder' }, lib).every((p) => p.text && !p.locked));
});

// ---------- the pack ----------

test('the store pack loads under the contract: a hidden, code-only workflow at 1 credit', () => {
  const packs = require('../lib/harness/packs');
  packs.reset();
  const r = packs.registerAll([{ pack: storePack, source: 'store' }]);
  assert.deepEqual(r.refused, [], JSON.stringify(r.refused));
  assert.ok(packs.workflow('store.make_it_mine'));
  assert.equal(tool.kind, 'code');
  assert.equal(tool.credits, 1);
  assert.deepEqual(tool.needs, undefined);
  assert.equal(storePack.workflows[0].id, 'store.make_it_mine');
  assert.equal(storePack.workflows[0].hidden, true);
  assert.deepEqual(Object.keys(storePack.workflows[0].inputs.properties), ['item', 'email', 'phone']);
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'packs', 'store', 'tools', 'make-it-mine.js'), 'utf8');
  assert.match(src, /Nothing here goes to Anthropic/);
  assert.doesNotMatch(src, /ctx\.ai\(|ctx\.fetch\(/);
});

test('Make it mine fills each file, saves <id>-<business>.<ext>, and lists what to fill in', async () => {
  const { lib } = fixture();
  store.use(lib);
  process.env.STORE_V2 = 'on';
  try {
    const ctx = makeCtx({ sample: false, member: { firstName: 'Maya', tier: 'free' }, brain: { business: { name: 'Glow & Co' }, links: {}, packs: { brand: { primary: '#2F6F4F' } } } });
    const out = await runTool(tool, { item: 'quote', email: 'hi@glow.co' }, ctx);
    assert.deepEqual(out.files.map((f) => f.asset.name), ['quote-glow-and-co.docx', 'quote-glow-and-co.html', 'quote-glow-and-co.md']);
    assert.deepEqual(out.fillYourself.map((t) => t.token), ['business.offer']);
    assert.ok(out.filled.some((t) => t.token === 'contact.email'));
    const html = ctx.saved[1].data.toString();
    assert.equal(html, '<h1>Glow &amp; Co</h1><p style="color:#2F6F4F">Your &lt;b&gt;offer&lt;/b&gt;</p>');
    assert.match(part(ctx.saved[0].data, 'word/document.xml'), /Reach hi@glow\.co/);
    // Legal's note shows on the result, in small print, and is never written into a file.
    const blocks = tool.view(out);
    assert.ok(blocks.some((b) => b.type === 'text' && b.muted && /not legal advice/.test(b.text)));
    assert.ok(blocks.some((b) => b.type === 'text' && /Fill these in yourself: Your offer/.test(b.text)));
    for (const s of ctx.saved) assert.ok(!(unzipText(s)).includes('legal advice'), s.name);
    // A Builder item for a free member, a coming item, and the Store switched off.
    await assert.rejects(runTool(tool, { item: 'first-sale-math' }, makeCtx({ sample: false, member: { tier: 'free' } })), /part of Builder/);
    await assert.rejects(runTool(tool, { item: 'deck-pitch' }, makeCtx({ sample: false })), /can't be filled in yet/);
    // Your business empty and no form answers: the result doesn't claim it was filled in.
    const blank = tool.view(await runTool(tool, { item: 'quote' }, makeCtx({ sample: false, member: { tier: 'free' }, brain: { business: {}, links: {}, packs: {} } })));
    assert.match(blank[0].text, /Your business is empty, so most of it still reads like the blank template/);
    assert.ok(!blank.some((b) => b.type === 'text' && /filled in with your details/.test(b.text)));
    assert.match(blocks[0].text, /filled in with your details/);
    assert.doesNotMatch(storePack.workflows[0].promise, /already in it/);
    const sheet = await runTool(tool, { item: 'first-sale-math' }, makeCtx({ sample: false, brain: { business: { price: '29' } } }));
    assert.equal(sheet.files[0].asset.name, 'first-sale-math-mine.xlsx');
    assert.deepEqual(sheet.cellsLeft, ['Start here!B3', 'Math & more!D5']);
    process.env.STORE_V2 = 'off';
    await assert.rejects(runTool(tool, { item: 'quote' }, makeCtx({ sample: false })), /isn't open/);
  } finally {
    delete process.env.STORE_V2;
    store.use(null);
  }
});

function unzipText(s) {
  if (/\.(docx|xlsx|pptx|zip)$/.test(s.name)) return unzip(s.data).map((e) => e.data.toString('utf8')).join('\n');
  return s.data.toString('utf8');
}
