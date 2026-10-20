// A small Store for tests (test/store*.test.js): store.json, its files and a prompts manifest,
// written to a temp folder. The Office files are tiny but real zips, made with the kit's zip().

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { zip } = require('../../lib/packs/_kit/files');

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const run = (t) => `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`;

function docx(tokens = true) {
  const name = tokens ? '{{business.name}}' : '[Your business]';
  return zip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
    { name: 'word/document.xml', data: `<?xml version="1.0"?><w:document ${W}><w:body><w:p>${run(`Welcome to ${name}`)}</w:p><w:p>${tokens ? '<w:r><w:t>{{business.</w:t></w:r><w:r><w:t>city}}</w:t></w:r>' : ''}</w:p><w:p>${run(tokens ? 'Reach {{contact.email}}' : 'Reach [you@yourbusiness.com]')}</w:p></w:body></w:document>` },
    { name: 'word/footer1.xml', data: `<?xml version="1.0"?><w:ftr ${W}><w:p>${run(tokens ? '{{business.name}} {{year}}' : '[Your business] [year]')}</w:p></w:ftr>` },
    { name: 'word/styles.xml', data: `<?xml version="1.0"?><w:styles ${W}><!-- {{business.name}} stays: not a text part --></w:styles>` },
  ]);
}

const SHEET = (rows) => `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
function xlsx() {
  return zip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Start here" sheetId="1" r:id="rId1"/><sheet name="Math &amp; more" sheetId="2" r:id="rId2"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="ws" Target="worksheets/sheet2.xml"/><Relationship Id="rId1" Type="ws" Target="/xl/worksheets/sheet1.xml"/><Relationship Id="rId9" Type="calc" Target="calcChain.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', data: SHEET('<row r="1"><c r="A1" t="inlineStr"><is><t>Start here</t></is></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Name</t></is></c><c r="B3" s="4" t="s"><v>0</v></c></row>') },
    { name: 'xl/worksheets/sheet2.xml', data: SHEET('<row r="5"><c r="A5" t="inlineStr"><is><t>Price</t></is></c><c r="C5" s="7"><v>0</v></c><c r="E5" s="7"><f>C5*2</f><v>0</v></c></row><row r="9"><c r="A9"><v>1</v></c></row>') },
    { name: 'xl/sharedStrings.xml', data: '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>[Your business]</t></si></sst>' },
    { name: 'xl/calcChain.xml', data: '<?xml version="1.0"?><calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><c r="E5" i="2"/></calcChain>' },
  ]);
}

function notionZip(tokens = true) {
  const n = tokens ? '{{business.name}}' : '[Your business]';
  return zip([
    { name: 'Founder OS/', data: '' },
    { name: 'Founder OS/Home.md', data: `# ${n} HQ\nRun by ${tokens ? '{{owner.first}}' : '[Your name]'}\n` },
    { name: 'Founder OS/Pages/Clients.csv', data: `Name,Owner\r\n"Acme, Inc",${tokens ? '{{business.name}}' : '[Your business]'}\r\n` },
    { name: 'Founder OS/logo.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x7b, 0x7b]) },
  ]);
}

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

// files: { '<id>/<name>': Buffer|string }. Returns the folder.
function writeStore({ items, files = {}, prompts, extra = {} }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '127-store-'));
  for (const [rel, data] of Object.entries(files)) {
    const abs = path.join(dir, 'files', rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, data);
  }
  fs.writeFileSync(path.join(dir, 'store.json'), JSON.stringify({ version: 'test.1', kinds: { sheet: 'Sheet', doc: 'Doc', prompts: 'Prompt pack' }, businessTypes: {}, tokens: {}, items, ...extra }, null, 1));
  const promptsFile = path.join(dir, 'prompts.json');
  fs.writeFileSync(promptsFile, JSON.stringify(prompts || PROMPTS));
  return { dir, promptsFile };
}

const PROMPTS = {
  groups: [{ id: 'brain', title: 'Business brain', prompts: ['brain.interview', 'brain.vault'] }],
  prompts: [
    { id: 'brain.interview', group: 'brain', title: 'Interview me', tier: 'free', when: 'Day one.', prompt: 'FREE-PROMPT-TEXT: ask me ten questions about {{business}}.', origin: 'ORIGIN-MARKER-SECRET from an intake call' },
    { id: 'brain.vault', group: 'brain', title: 'Set up my vault', tier: 'builder', when: 'Once you have a brain.', prompt: 'BUILDER-PROMPT-TEXT: lay out my vault.', origin: 'ORIGIN-MARKER-SECRET two' },
  ],
};

const fmt = (id, name, buf, extra = {}) => ({ format: path.extname(name).slice(1), label: `${name} label`, file: `files/${id}/${name}`, bytes: Buffer.byteLength(buf), sha256: sha(Buffer.from(buf)), ...extra });

// The standard test Store: a free fillable doc with Legal's note, a Builder sheet filled by cells,
// a free Notion zip, a prompt pack with one free and one Builder prompt, a coming item and one
// behind its own flag.
function standard() {
  const html = '<h1>{{business.name}}</h1><p style="color:{{brand.color|#141418}}">{{business.offer|Your <b>offer</b>}}</p>';
  const md = '# {{business.name}}\nBy {{owner.first}} on {{today}}\n';
  const files = {
    'quote/127-quote.docx': docx(false),
    'quote/127-quote.docx.tpl': docx(true),
    'quote/127-quote.html': html.replace(/\{\{[^}]*\}\}/g, '[x]'),
    'quote/127-quote.html.tpl': html,
    'quote/127-quote.md': md,
    'quote/127-quote.md.tpl': md,
    'quote/preview.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    'first-sale-math/127-first-sale-math.xlsx': xlsx(),
    'first-sale-math/preview.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    'crm/127-crm.zip': notionZip(false),
    'crm/127-crm.zip.tpl': notionZip(true),
  };
  const items = [
    {
      id: 'quote', title: 'Quote', kind: 'doc', businessTypes: ['local', 'coach'], tier: 'free', summary: 'A one-page quote with your prices and terms.', tags: ['pricing', 'sales'], status: 'ready', owner: 'templates', preview: 'files/quote/preview.png',
      formats: [fmt('quote', '127-quote.docx', files['quote/127-quote.docx'], { fillable: true }), fmt('quote', '127-quote.html', files['quote/127-quote.html'], { fillable: true }), fmt('quote', '127-quote.md', files['quote/127-quote.md'], { fillable: true })],
      links: [{ label: 'Copy in Google Docs', url: 'https://docs.google.com/document/d/abc/copy', type: 'copy' }],
      makeItMine: { files: ['127-quote.docx', '127-quote.html', '127-quote.md'], tokens: ['brand.color', 'business.name', 'business.offer', 'contact.email', 'owner.first', 'today', 'year'], asks: ['contact.email'] },
      library: null, flag: null, disclaimer: 'Template, not legal advice. Have a professional review any agreement before you sign.',
    },
    {
      id: 'first-sale-math', title: 'First-Sale Math', kind: 'sheet', businessTypes: ['any'], tier: 'builder', summary: 'Check that one sale makes you money after every cost.', tags: ['money'], status: 'ready', owner: 'templates', preview: 'files/first-sale-math/preview.png',
      formats: [fmt('first-sale-math', '127-first-sale-math.xlsx', files['first-sale-math/127-first-sale-math.xlsx'])],
      links: [],
      makeItMine: { files: ['127-first-sale-math.xlsx'], cells: [{ cell: 'Start here!B3', value: 'First-Sale Math: {{business.name}}' }, { cell: 'Math & more!C5', value: '{{business.price}}', number: true }, { cell: 'Math & more!D5', value: '{{business.city}}' }, { cell: 'Math & more!B7', value: 'Made {{today}}' }], tokens: [], asks: [] },
      library: 'first-sale-math', flag: null, howTo: ['Type your price.', 'Read the answer.'],
    },
    {
      id: 'crm', title: 'Notion CRM', kind: 'notion', businessTypes: ['any'], tier: 'free', summary: 'Your clients and deals in Notion.', tags: ['crm'], status: 'ready', owner: 'templates', preview: null,
      formats: [fmt('crm', '127-crm.zip', files['crm/127-crm.zip'], { fillable: true })], links: [],
      makeItMine: { files: ['127-crm.zip'], tokens: ['business.name', 'owner.first'], asks: [] }, library: null, flag: null,
    },
    {
      id: 'prompts-brain', title: 'Business brain prompts', kind: 'prompts', businessTypes: ['any'], tier: 'free', summary: 'Give your AI the context once.', tags: ['prompts', 'ai'], status: 'ready', owner: 'prompts', preview: null, formats: [], links: [], makeItMine: null, library: null, flag: null,
      source: { manifest: 'product/prompts/manifest.json', group: 'brain' },
      prompts: [{ id: 'brain.interview', title: 'Interview me', tier: 'free', when: 'Day one.' }, { id: 'brain.vault', title: 'Set up my vault', tier: 'builder', when: 'Once you have a brain.' }],
      groupTitle: 'Business brain: give your AI the context once',
    },
    { id: 'deck-pitch', title: 'Pitch deck', kind: 'deck', businessTypes: ['idea'], tier: 'builder', summary: 'A short pitch deck.', tags: ['deck'], status: 'coming', owner: 'templates', preview: null, formats: [], links: [], makeItMine: null, library: null, flag: null },
    { id: 'site-agency', title: 'Agency site', kind: 'site', businessTypes: ['idea'], tier: 'builder', summary: 'An animated site for a small agency.', tags: ['website'], status: 'coming', owner: 'design', preview: null, formats: [], links: [], makeItMine: null, library: null, flag: 'STORE_SITES' },
  ];
  return { items, files };
}

module.exports = { docx, xlsx, notionZip, writeStore, standard, fmt, PROMPTS };
