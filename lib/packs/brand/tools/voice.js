// How the business sounds: three voice words, do and don't, ready-to-send lines, captions, an
// about paragraph, taglines and bios that fit each platform. AI writes it when available; the
// template builds it from the member's own facts otherwise. Saves a printable guide and a .md.

const { views, save, ai, text, files } = require('../../_kit');
const { specFrom } = require('../lib/kit');
const V = require('../lib/voice');

const SCHEMA = {
  type: 'object',
  properties: {
    words: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string', maxLength: 40 } },
    do: { type: 'array', minItems: 3, items: { type: 'string', maxLength: 120 } },
    dont: { type: 'array', minItems: 3, items: { type: 'string', maxLength: 120 } },
    captions: { type: 'array', minItems: 3, items: { type: 'string', maxLength: 300 } },
    about: { type: 'string', maxLength: 600 },
    taglines: { type: 'array', minItems: 3, items: { type: 'string', maxLength: 60 } },
  },
  required: ['words', 'do', 'dont', 'captions', 'about', 'taglines'],
};

function md(v, name) {
  const list = (a) => a.map((x) => `- ${x}`).join('\n');
  return `# ${name} voice\n\n## Voice words\n${list(v.words)}\n\n## Do\n${list(v.do)}\n\n## Don't\n${list(v.dont)}\n\n## Ready lines\n${v.lines.map((l) => `${l.use}:\n${l.text}`).join('\n\n')}\n\n## Captions\n${list(v.captions)}\n\n## About\n${v.about}\n\n## Taglines\n${list(v.taglines)}\n\n## Bios\n${v.bios.map((b) => `${b.label} ${b.field.toLowerCase()} (${b.chars} characters): ${b.text}`).join('\n')}\n`;
}

function html(v, spec) {
  const c = spec.colors;
  const esc = files.esc;
  const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join('');
  const css = `body{margin:0;background:${c.paper};color:${c.ink};font:16px/1.55 Inter,Arial,sans-serif}main{max-width:820px;margin:0 auto;padding:48px 32px}
h1{font-size:40px;line-height:1.1;margin:6px 0 24px;letter-spacing:-.02em}h2{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:${c.muted};margin:36px 0 12px}
.k{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:${c.muted};font-weight:700}.w{display:flex;gap:10px;flex-wrap:wrap}.w span{background:${c.primary};color:${c.onPrimary};border-radius:999px;padding:8px 16px;font-weight:700}
.two{display:grid;grid-template-columns:1fr 1fr;gap:24px}.card{background:#fff;border:1px solid ${c.line};border-radius:14px;padding:14px 16px;margin-bottom:10px}.card b{display:block;color:${c.muted};font-size:13px}
@media(max-width:640px){.two{grid-template-columns:1fr}}@media print{.card{break-inside:avoid}}`;
  const body = `<main><div class="k">Voice guide</div><h1>How ${esc(spec.name)} sounds</h1>
<div class="w">${v.words.map((w) => `<span>${esc(w)}</span>`).join('')}</div>
<div class="two"><div><h2>Do</h2><ul>${li(v.do)}</ul></div><div><h2>Don't</h2><ul>${li(v.dont)}</ul></div></div>
<h2>Ready lines</h2>${v.lines.map((l) => `<div class="card"><b>${esc(l.use)}</b>${esc(l.text)}</div>`).join('')}
<h2>Captions</h2>${v.captions.map((x) => `<div class="card">${esc(x)}</div>`).join('')}
<h2>About</h2><div class="card">${esc(v.about)}</div>
<h2>Taglines</h2><ul>${li(v.taglines)}</ul>
<h2>Bios</h2>${v.bios.map((b) => `<div class="card"><b>${esc(b.label)} ${esc(b.field.toLowerCase())}, ${b.chars} characters${b.limit ? ` of ${b.limit}` : `, kept under ${b.target}`}</b>${esc(b.text)}</div>`).join('')}
</main>`;
  return files.htmlDoc({ title: `${spec.name} voice guide`, css, body });
}

module.exports = {
  name: 'brand.voice',
  title: 'Brand voice',
  description: 'Writes how the business sounds: 3 voice words, do and don\'t, ready replies (price, booking, running late, review ask), captions, an about paragraph, taglines and bios that fit Instagram, TikTok and Facebook.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Business name', maxLength: 60 },
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      city: { type: 'string', title: 'City (optional)', maxLength: 80 },
      tone: { type: 'string', title: 'Tone', enum: ['friendly', 'premium', 'playful', 'straight', 'calm'] },
      palette: { title: 'Colors from the palette step' },
    },
  },
  output: { type: 'object', properties: { voice: { type: 'object' }, guide: { type: 'object' }, doc: { type: 'object' }, ai: { type: 'boolean' } }, required: ['voice'] },
  async run(input, ctx) {
    const spec = specFrom(input, ctx);
    const name = spec.name || 'Your business';
    const n = spec.niche;
    const facts = {
      name,
      label: spec.descriptor.toLowerCase(),
      cityShort: String(spec.city || '').split(',')[0].trim(),
      firstName: spec.firstName,
      price: spec.price,
      promise: n.promise,
      result: n.result,
      pain: n.pain,
      trust: n.trust,
      tone: input.tone || V.TONE_FOR_MOOD[spec.mood] || 'friendly',
      online: ['templates', 'content', 'apparel', 'jewelry', 'candles', 'resale', 'art'].includes(n.id),
    };
    const base = V.templateVoice(facts);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write brand voice guides for first-time founders. Plain words a customer would use. No hype, no promises about results the owner cannot control.',
      prompt: [
        `Business: ${name}`, `What: ${spec.what || facts.label}`, facts.cityShort ? `Where: ${facts.cityShort}` : '', `Tone: ${facts.tone}`,
        `What customers want: ${n.result}. What they are tired of: ${n.pain}.`,
        'Return: words (3, each "X, not Y"), do (5), dont (5), captions (3 short social captions), about (60 to 90 words, first person plural), taglines (3, under 6 words).',
      ].filter(Boolean).join('\n'),
      schema: SCHEMA,
      fallback: () => ({ words: base.words, do: base.do, dont: base.dont, captions: base.captions, about: base.about, taglines: base.taglines }),
      accept: ai.cleanCopy,
    });
    const voice = { ...base, ...data };
    const guide = await save.saveFile(ctx, save.fileName(name, 'voice-guide', '.html'), html(voice, { ...spec, name }));
    const doc = await save.saveFile(ctx, save.fileName(name, 'voice-guide', '.md'), md(voice, name));
    ctx.log(`Wrote the ${facts.tone} voice guide and ${voice.bios.length} bios`);
    return { voice, guide, doc, ai: usedAi };
  },
  view(out) {
    const v = out.voice;
    return views.blocks(
      views.cards(v.words.map((w) => ({ title: w }))),
      views.table([{ key: 'platform', label: 'Bio' }, { key: 'text', label: 'Text' }, { key: 'chars', label: 'Characters', format: 'number' }], v.bios.map((b) => ({ platform: `${b.label} ${b.field.toLowerCase()}`, text: b.text, chars: b.chars }))),
      ...v.lines.slice(0, 3).map((l) => views.copy(l.use, l.text)),
      views.file(out.guide, 'Voice guide (print or save as PDF)'),
      views.file(out.doc, 'Voice guide for Notion or Google Docs (.md)')
    );
  },
};
