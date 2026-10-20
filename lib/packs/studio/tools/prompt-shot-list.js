// Plan a shot list: the shots a video type needs (product ad, UGC-style ad, brand film, faceless
// short, b-roll, talking to camera, before and after, unboxing), each with its camera move, length
// and the prompt for the model you pick. Pure code (lib/prompts.js), so it is instant and costs 1.

const { text, views, save, brain, color } = require('../../_kit');
const P = require('../lib/prompts');

const KIND_TITLES = P.PACKS['shot-lists'].kinds;

module.exports = {
  name: 'studio.shot_list',
  title: 'Plan a shot list',
  description: 'Plans the shots for a video type (product ad, UGC-style ad, brand film, faceless short, b-roll, talking to camera, before and after, unboxing) with each shot\'s camera move, length and a prompt for the model you pick, as a printable sheet and a CSV.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      kind: { type: 'string', title: 'Video type', enum: P.SHOT_KINDS, default: 'product' },
      subject: { type: 'string', title: 'Your product or subject', maxLength: 120 },
      setting: { type: 'string', title: 'Where it happens', maxLength: 90 },
      person: { type: 'string', title: 'Who is in it', maxLength: 90 },
      service: { type: 'string', title: 'The job (local services)', maxLength: 90 },
      before: { type: 'string', title: 'The before', maxLength: 90 },
      after: { type: 'string', title: 'The after', maxLength: 90 },
      count: { type: 'integer', title: 'How many shots', minimum: 3, maximum: 12, default: 6 },
      seconds: { type: 'integer', title: 'Seconds per shot', minimum: 3, maximum: 12, default: 5 },
      model: { type: 'string', title: 'Model', enum: P.MODELS, default: 'kling' },
      aspect: { type: 'string', title: 'Shape', enum: ['9:16', '16:9', '1:1', '4:5'], default: '9:16' },
      brand_color: { type: 'string', title: 'Your brand color', pattern: '^#[0-9A-Fa-f]{6}$' },
      business: { type: 'string', title: 'Business name', maxLength: 80 },
    },
  },
  output: {
    type: 'object',
    properties: {
      kind: { type: 'string' },
      model: { type: 'string' },
      label: { type: 'string' },
      seconds: { type: 'integer' },
      shots: { type: 'array', items: { type: 'object' } },
      sheet: { type: ['object', 'null'] },
      csv: { type: ['object', 'null'] },
      sample: { type: 'boolean' },
    },
    required: ['kind', 'model', 'shots'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const kind = P.SHOT_KINDS.includes(input.kind) ? input.kind : 'product';
    const model = P.MODELS.includes(input.model) ? input.model : 'kling';
    const subject = text.oneLine(input.subject || '') || text.clip(String(b.what || b.offer || '').split(',')[0], 80) || 'the product';
    const brandColor = color.isHex(input.brand_color || '') ? input.brand_color : '';
    const count = input.count || 6;
    const list = P.shotList({ kind, subject, setting: input.setting, person: input.person, service: input.service || (kind === 'before_after' ? subject : ''), before: input.before, after: input.after, city: b.city, count, seconds: input.seconds || 5, brand: { name: b.name, color: brandColor }, seed: `${b.name}|${subject}|${kind}` });
    const shots = list.map((s) => {
      const built = P.build({ model, shot: s.shot, audio: s.audio, aspect: input.aspect, seconds: s.seconds, seed: `${s.n}` });
      return { n: s.n, title: s.title, use: KIND_TITLES[kind], camera: s.move, seconds: built.seconds || s.seconds, aspect: built.aspect, preset: built.preset, prompt: built.prompt, negative: built.negative, notes: built.notes, shot: s.shot };
    });
    const label = P.STYLE[model].label;
    const total = shots.reduce((n, s) => n + (s.seconds || 0), 0);
    const title = `${KIND_TITLES[kind]}: shot list`;
    const html = P.sheetHtml({ title, business: b.name || '', model, items: shots, brandColor, intro: `${shots.length} shots of ${text.clip(subject, 80)}${total ? `, about ${total} seconds in all` : ''}. Make each shot, then put them together in order in the editor.` });
    const base = save.fileName(b.name || 'studio', `${kind}-shot-list`, model);
    const sheet = await save.saveFile(ctx, `${base}.html`, html);
    const csv = await save.saveFile(ctx, `${base}.csv`, P.csvText(shots, model));
    ctx.log(`Planned ${shots.length} shots for a ${KIND_TITLES[kind].toLowerCase()}`);
    return { kind, model, label, seconds: total, shots, sheet: sheet || null, csv: csv || null, sample: false };
  },
  view(out) {
    return views.blocks(
      views.metric('Shots planned', out.shots.length, `About ${out.seconds} seconds, prompts written for ${out.label}`),
      views.table([{ key: 'n', label: '#', format: 'number' }, { key: 'title', label: 'Shot' }, { key: 'camera', label: 'Camera' }, { key: 'seconds', label: 'Seconds', format: 'number' }], out.shots.map((s) => ({ n: s.n, title: s.title, camera: s.camera, seconds: s.seconds })), 12),
      views.file(out.sheet, 'Shot list (prints clean)'),
      views.file(out.csv, 'Shot list (CSV)'),
      out.shots.map((s) => views.copy(`Shot ${s.n}. ${s.title}`, s.negative ? `${s.prompt}\n\nNegative prompt: ${s.negative}` : s.prompt)),
    );
  },
};
