// Write a prompt pack: the member names their product or scene, picks a model and a pack, and gets
// 10 to 20 ready prompts written the way that model reads best, a printable prompt sheet (HTML), a
// CSV and a copy block for each prompt. The prompts are built in code from data/prompts (lib/prompts.js);
// AI, when it answers, tightens each one to the member's own product while keeping its shape and length.
// UGC-style prompts are the member's own demo or a creator they hire who discloses: never a review.

const { ai, text, views, save, brain, color } = require('../../_kit');
const P = require('../lib/prompts');

const PACK_CHOICES = P.PACK_IDS;
const ASPECTS = ['9:16', '16:9', '1:1', '4:5'];
const NOT_A_REVIEW = /\b(review|testimonial|rated|five stars|5 stars|customers? (say|love)|best .* ever)\b/i;

const SCHEMA = {
  type: 'object',
  properties: { prompts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, prompt: { type: 'string' } }, required: ['id', 'prompt'] } } },
  required: ['prompts'],
};

// The member's brand color: their input, else one a pack remembered (brain.packs.*.color).
function brandColorOf(ctx, input) {
  if (color.isHex(input.brand_color || '')) return input.brand_color;
  const packs = (ctx && ctx.brain && ctx.brain.packs) || {};
  for (const v of Object.values(packs)) {
    const c = v && (v.brandColor || v.brand_color || v.color || (v.brand && v.brand.color));
    if (typeof c === 'string' && color.isHex(c)) return c;
  }
  return '';
}

function slotsFrom(ctx, input) {
  const b = brain.brainOf(ctx, input);
  const product = text.oneLine(input.product || '') || text.clip(String(b.what || b.offer || '').split(',')[0], 80);
  return {
    b,
    slots: {
      product,
      setting: input.setting,
      person: input.person,
      service: input.service || (input.pack === 'local-service' ? product : ''),
      city: input.city || b.city,
      before: input.before,
      after: input.after,
      business: b.name,
      brand_color: brandColorOf(ctx, input),
      text: input.words,
    },
  };
}

module.exports = {
  name: 'studio.prompt_pack',
  title: 'Write a prompt pack',
  description: 'Writes 10 to 20 ready video or image prompts for your product or scene, in the style the model you pick reads best (Higgsfield, Kling, Veo, Runway, Luma, Sora-style, FLUX, Imagen), with a printable prompt sheet and a CSV.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      product: { type: 'string', title: 'Your product or scene', description: 'What the shots are of, like "a soy candle in an amber jar" or "lawn mowing in a front yard".', maxLength: 120 },
      model: { type: 'string', title: 'Model', enum: P.MODELS, default: 'kling' },
      pack: { type: 'string', title: 'Prompt pack', enum: PACK_CHOICES, default: 'product' },
      count: { type: 'integer', title: 'How many prompts', minimum: 10, maximum: 20, default: 12 },
      setting: { type: 'string', title: 'Where it happens', maxLength: 90 },
      person: { type: 'string', title: 'Who is in it', description: 'Like "a woman in her 30s" or "a man in a work apron". Leave blank for a neutral person.', maxLength: 90 },
      service: { type: 'string', title: 'The job (local services)', maxLength: 90 },
      city: { type: 'string', title: 'Your town', maxLength: 60 },
      before: { type: 'string', title: 'The before (reveals)', maxLength: 90 },
      after: { type: 'string', title: 'The after (reveals)', maxLength: 90 },
      words: { type: 'string', title: 'Words in the image (image ads)', maxLength: 40 },
      brand_color: { type: 'string', title: 'Your brand color', description: 'A hex color like #C2410C.', pattern: '^#[0-9A-Fa-f]{6}$' },
      business: { type: 'string', title: 'Business name', maxLength: 80 },
      aspect: { type: 'string', title: 'Shape', enum: ASPECTS, default: '9:16' },
      seconds: { type: 'integer', title: 'Seconds per clip', minimum: 3, maximum: 20, default: 5 },
      from_image: { type: 'boolean', title: 'I have a photo to animate', default: false },
    },
  },
  output: {
    type: 'object',
    properties: {
      model: { type: 'string' },
      label: { type: 'string' },
      pack: { type: 'string' },
      packTitle: { type: 'string' },
      tips: { type: 'array', items: { type: 'string' } },
      prompts: { type: 'array', items: { type: 'object' } },
      sheet: { type: ['object', 'null'] },
      csv: { type: ['object', 'null'] },
      ai: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['model', 'pack', 'prompts'],
  },
  async run(input, ctx) {
    const model = P.MODELS.includes(input.model) ? input.model : 'kling';
    const packId = P.PACKS[input.pack] ? input.pack : 'product';
    const pack = P.PACKS[packId];
    const style = P.STYLE[model];
    const { b, slots } = slotsFrom(ctx, input);
    if (!slots.product) throw new Error('Name your product or scene, like "a soy candle in an amber jar".');
    const count = Math.max(10, Math.min(20, input.count || 12));
    const isImage = P.IMAGE_MODELS.has(model);
    const aspect = input.aspect || (isImage ? '1:1' : '9:16');
    const seed = `${b.name}|${slots.product}|${packId}`;
    const items = P.packPrompts({ pack: packId, model, slots, count, seed, aspect, seconds: input.seconds || 5, fromImage: !!input.from_image });

    // AI tightens each prompt to the member's product, keeping each one's camera move and length.
    const maxChars = input.from_image && style.maxCharsFromImage ? style.maxCharsFromImage : style.maxChars;
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: `You edit prompts for the AI ${isImage ? 'image' : 'video'} model ${style.label}. Keep each prompt's structure, camera move, order and line breaks. Make the subject and setting concrete for the member's product using only the facts given. ${style.notes.slice(0, 3).join(' ')} No real people's names, no other brands' names or logos. Never write a customer review, a testimonial, ratings or results; on-camera lines are the member's own words or a creator who says it is a paid partnership.`,
      prompt: [
        `Product or scene: ${slots.product}`,
        b.name ? `Business: ${b.name}` : '',
        slots.setting ? `Setting: ${slots.setting}` : '',
        `Each prompt must stay under ${maxChars} characters and ${style.maxWords} words.`,
        'Return prompts: [{ id, prompt }] with the same ids, in the same order.',
        JSON.stringify(items.map((it) => ({ id: it.id, prompt: it.prompt }))),
      ].filter(Boolean).join('\n\n'),
      schema: SCHEMA,
      maxTokens: 4000,
      fallback: () => ({ prompts: items.map((it) => ({ id: it.id, prompt: it.prompt })) }),
      accept: (d) => ai.cleanCopy(d)
        && d.prompts.length === items.length
        && d.prompts.every((x, i) => x.id === items[i].id && x.prompt.length >= 40 && x.prompt.length <= maxChars && x.prompt.split(/\s+/).length <= style.maxWords && !/[{}]/.test(x.prompt) && !NOT_A_REVIEW.test(x.prompt)),
    });
    const prompts = items.map((it, i) => ({ ...it, prompt: (data.prompts[i] && data.prompts[i].prompt) || it.prompt }));

    const title = `${pack.title} prompts for ${style.label}`;
    const sheetHtml = P.sheetHtml({
      title,
      business: b.name || '',
      model,
      items: prompts,
      brandColor: slots.brand_color,
      intro: `${prompts.length} prompts for ${text.clip(slots.product, 80)}. ${pack.rules || ''}`.trim(),
    });
    const base = save.fileName(b.name || 'studio', `${packId}-prompts`, model);
    const sheet = await save.saveFile(ctx, `${base}.html`, sheetHtml);
    const csv = await save.saveFile(ctx, `${base}.csv`, P.csvText(prompts, model));
    ctx.log(`Wrote ${prompts.length} ${style.label} prompts from the ${pack.title} pack`);
    return {
      model,
      label: style.label,
      pack: packId,
      packTitle: pack.title,
      tips: style.notes.slice(0, 3),
      prompts,
      sheet: sheet || null,
      csv: csv || null,
      ai: usedAi,
      // Contract 3: a template answer instead of AI costs nothing.
      sample: !usedAi,
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Prompts written', out.prompts.length, `${out.packTitle}, written for ${out.label}`),
      views.text(out.tips.join(' ')),
      views.file(out.sheet, 'Prompt sheet (prints clean)'),
      views.file(out.csv, 'All prompts (CSV)'),
      out.prompts.map((p) => views.copy(`${p.n}. ${p.title}${p.camera ? ` (${p.camera})` : ''}`, p.negative ? `${p.prompt}\n\nNegative prompt: ${p.negative}` : p.prompt)),
    );
  },
};
