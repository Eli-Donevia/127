// The prompts part of the studio pack: its tools and workflows (index.js joins the parts).
// Prompt packs and shot lists written the way each AI video or image model reads best (lib/prompts.js).

const P = require('./prompts');

const promptPack = require('../tools/prompt-pack');
const shotList = require('../tools/prompt-shot-list');

const MODEL = { type: 'string', title: 'Model', enum: P.MODELS, default: 'kling', description: 'Higgsfield, Kling, Google Veo, Runway, Luma Ray, Sora-style, FLUX or Imagen.' };
const COLOR = { type: 'string', title: 'Your brand color (optional)', description: 'A hex color like #C2410C.', pattern: '^#[0-9A-Fa-f]{6}$' };

const workflows = [
  {
    id: 'studio.video_prompts',
    title: 'Write video prompts for any model',
    promise: 'Name your product or scene and pick a model: 10 to 20 ready prompts written for it, a printable prompt sheet and a CSV.',
    proof: 'Up to 20 prompts with camera moves, settings and copy buttons, a prompt sheet and a CSV',
    minutes: 5,
    tier: 'free',
    job: 'content',
    starter: true,
    inputs: {
      type: 'object',
      properties: {
        product: { type: 'string', title: 'Your product or scene', description: 'Like "a soy candle in an amber jar", "a stainless steel water bottle" or "mowing a front lawn".', maxLength: 120 },
        model: MODEL,
        pack: { type: 'string', title: 'Prompt pack', enum: P.PACK_IDS, default: 'product', description: 'camera-moves, product, ugc (your own demo or a creator who discloses), cinematic, faceless, local-service, image-ads or shot-lists.' },
        count: { type: 'integer', title: 'How many prompts', minimum: 10, maximum: 20, default: 12 },
        setting: { type: 'string', title: 'Where it happens (optional)', maxLength: 90 },
        person: { type: 'string', title: 'Who is in it (optional)', maxLength: 90 },
        brand_color: COLOR,
        from_image: { type: 'boolean', title: 'I have a photo to animate', default: false },
      },
      required: ['product'],
    },
    steps: [
      {
        id: 'prompts',
        tool: 'studio.prompt_pack',
        input: { product: '$inputs.product', model: '$inputs.model', pack: '$inputs.pack', count: '$inputs.count', setting: '$inputs.setting', person: '$inputs.person', brand_color: '$inputs.brand_color', from_image: '$inputs.from_image' },
      },
    ],
    result: ['prompts'],
    next: [{ id: 'studio.plan_shots', why: 'Turn the prompts into a shot list for one video, in order.' }],
  },
  {
    id: 'studio.plan_shots',
    title: 'Plan the shots for a video',
    promise: 'Pick a video type and a model: the shot list in order, each shot with its camera move, length and prompt, as a sheet and a CSV.',
    proof: 'A shot list of 3 to 12 shots with prompts for your model',
    minutes: 8,
    tier: 'builder',
    job: 'content',
    inputs: {
      type: 'object',
      properties: {
        kind: { type: 'string', title: 'Video type', enum: P.SHOT_KINDS, default: 'product', description: 'product, ugc, cinematic, faceless, broll, talking, before_after or unboxing.' },
        subject: { type: 'string', title: 'Your product or subject', maxLength: 120 },
        setting: { type: 'string', title: 'Where it happens (optional)', maxLength: 90 },
        person: { type: 'string', title: 'Who is in it (optional)', maxLength: 90 },
        count: { type: 'integer', title: 'How many shots', minimum: 3, maximum: 12, default: 6 },
        model: MODEL,
        brand_color: COLOR,
      },
      required: ['subject'],
    },
    steps: [
      {
        id: 'shots',
        tool: 'studio.shot_list',
        input: { kind: '$inputs.kind', subject: '$inputs.subject', setting: '$inputs.setting', person: '$inputs.person', count: '$inputs.count', model: '$inputs.model', brand_color: '$inputs.brand_color' },
      },
    ],
    result: ['shots'],
    next: [{ id: 'studio.video_prompts', why: 'More prompts for the same product: other camera moves, looks or a second model.' }],
  },
];

module.exports = { tools: [promptPack, shotList], workflows };
