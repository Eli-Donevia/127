// Plan a video shoot: a shot list for one short video (what to film, how close, how long, what to
// say), the order to film it in so the phone moves as little as possible, gear, sound and light
// tips, a permission text for anyone on camera, and a storyboard. One printable page (no scripts),
// the shot list as a spreadsheet, and the storyboard as a picture.

const fs = require('fs');
const path = require('path');
const { ai, text, views, save, media, color } = require('../../_kit');
const { bizOf } = require('../lib/sample');
const { lookFor } = require('../lib/look');
const S = require('../lib/shoot');

const SHAPES = { vertical: 'vertical 9:16 (Reels, TikTok, Shorts)', wide: 'wide 16:9 (YouTube, your website)', square: 'square 1:1 (feeds)' };

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          framing: { type: 'string' },
          seconds: { type: 'integer' },
          setup: { type: 'string' },
          action: { type: 'string' },
          line: { type: 'string' },
        },
        required: ['name', 'framing', 'seconds', 'setup', 'action', 'line'],
      },
    },
  },
  required: ['title', 'shots'],
};

function titleFor(kind, f, b) {
  if (f.about) return text.clip(text.sentenceCase(f.about.replace(/[.!?]+$/, '')), 70);
  const who = b.name || 'your business';
  return { 'Promo for my offer': f.offer ? `Promo: ${f.offer}` : `Promo for ${who}`, 'How-to or tip': `A tip from ${who}`, 'Behind the scenes': `Behind the scenes at ${who}`, 'Customer story': `A customer story for ${who}`, 'Product close-ups': `Product close-ups for ${who}` }[kind];
}

async function boardJpg(ctx, png) {
  const dir = media.scratch(ctx, 'shoot');
  const src = path.join(dir, 'board.png');
  const out = path.join(dir, 'board.jpg');
  fs.writeFileSync(src, png);
  await media.ffmpeg(['-i', src, '-vf', 'scale=1400:-2:flags=lanczos', '-q:v', '4', out], { timeoutSec: 60, signal: ctx.signal });
  return fs.readFileSync(out);
}

module.exports = {
  name: 'video.plan_shoot',
  title: 'Plan the shoot',
  description: 'Plans one short video before you film: a shot list with how close to film, how long and what to say, the order to film it in, gear, sound and light tips, a permission text for anyone on camera, and a storyboard. A printable page, a spreadsheet and a picture.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  tasks: ['plan'],
  credits: 12,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      about: { type: 'string', title: 'What is the video about?', maxLength: 160 },
      kind: { type: 'string', title: 'Kind of video', enum: S.KINDS, default: 'Promo for my offer' },
      seconds: { type: 'integer', title: 'Length in seconds', minimum: 15, maximum: 180, default: 45 },
      shape: { type: 'string', title: 'Shape', enum: ['vertical', 'wide', 'square'], default: 'vertical' },
      where: { type: 'string', title: 'Where will you film? (optional)', maxLength: 100 },
      people: { type: 'string', title: 'Who is on camera? (optional)', maxLength: 140 },
      date: { type: 'string', format: 'date', title: 'Shoot day (optional)' },
      color: { type: 'string', title: 'Brand color (optional hex)', maxLength: 9 },
    },
  },
  output: {
    type: 'object',
    properties: {
      plan: { type: 'object' },
      page: { type: ['object', 'null'] },
      csv: { type: ['object', 'null'] },
      board: { type: ['object', 'null'] },
      ai: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['plan'],
  },
  async run(input, ctx) {
    // The video's topic is `about`, so the business facts keep the brain's own "what".
    const b = bizOf(ctx, { color: input.color });
    const f = S.factsOf(b, input);
    const kind = S.KINDS.includes(input.kind) ? input.kind : S.KINDS[0];
    const seconds = Math.max(15, Math.min(180, Math.round(Number(input.seconds) || 45)));
    const shape = SHAPES[input.shape] ? input.shape : 'vertical';
    const fallback = () => ({ title: titleFor(kind, f, b), shots: S.templatePlan(kind, f, seconds) });
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'plan',
      system: 'You plan short videos for small business owners who film on a phone, alone or with one helper. Plain words, no film jargon.',
      prompt: [
        `Plan a ${seconds} second ${shape} video. Kind: ${kind}.`,
        f.about ? `What it is about: ${f.about}` : '',
        `Business: ${[b.name, b.what, b.offer ? `offer: ${b.offer}` : '', b.city].filter(Boolean).join('; ') || 'not given'}`,
        f.where ? `Where they film: ${f.where}` : '',
        f.people ? `Who is on camera: ${f.people}` : 'Only the owner is on camera unless the kind needs a customer.',
        `Give 5 to 9 shots in story order. Each: name (2 to 4 words), framing (one of ${S.FRAMINGS.join(', ')}), seconds (whole seconds in the finished video; they add up to about ${seconds}), setup (where the phone is, like "Tripod, facing you" or "Handheld, at the counter"; shots filmed from the same spot use exactly the same setup words), action (what to film, one sentence, under 25 words), line (what the owner says on camera, under 16 words, or an empty string when nothing is said).`,
        'Lines use only the facts above: no prices, results, reviews, client counts or promises unless given. Never write lines for a customer: they speak in their own words. The first shot hooks in under 3 seconds; the last says the one next step.',
        'title: a plain name for the video, under 60 characters.',
      ].filter(Boolean).join('\n'),
      schema: SCHEMA,
      maxTokens: 1800,
      fallback,
      accept: (d) => ai.cleanCopy(d) && d.shots.length >= 4 && d.shots.length <= 10,
    });
    const shots = S.cleanShots(data.shots);
    const secs = S.fitSeconds(shots.map((s) => s.seconds), seconds, 1);
    shots.forEach((s, i) => (s.seconds = secs[i]));
    const order = S.filmingOrder(shots);
    const look = lookFor(ctx, input, b);
    const plan = {
      title: text.clip(text.oneLine(data.title) || titleFor(kind, f, b), 70),
      kind,
      seconds,
      shape,
      shapeLabel: SHAPES[shape],
      where: f.where,
      people: f.people,
      date: input.date || '',
      accent: color.ensureContrast(look.primary, '#ffffff', 4.5),
      shots,
      order,
      shootMinutes: order.reduce((n, g) => n + g.minutes, 0),
      gear: S.GEAR,
      sound: S.SOUND,
      light: S.LIGHT,
      beforePost: S.BEFORE_POST,
      questions: kind === 'Customer story' ? S.QUESTIONS : [],
      consent: S.consentText(f, input.date),
      consentParent: S.parentConsentText(f, input.date, input.people),
    };
    const base = save.fileName(plan.title.split(' ').slice(0, 6).join(' '));
    let board = null;
    let boardAsset = null;
    if (media.canRender(ctx)) {
      const sb = S.storyboardSvg(plan, { shape, accent: plan.accent });
      const png = await media.svgToPng(ctx, sb.svg, { width: sb.W, height: sb.H });
      boardAsset = await save.saveFile(ctx, `${base}-storyboard.png`, png);
      board = await boardJpg(ctx, png);
    }
    const page = await save.saveFile(ctx, `${base}-shoot-plan.html`, S.htmlOf(plan, { board }));
    const csv = await save.saveFile(ctx, `${base}-shot-list.csv`, S.csvOf(plan));
    ctx.log(`${shots.length} shots in ${order.length} setups, about ${plan.shootMinutes} minutes of filming${usedAi ? '' : ' (from the plan template)'}`);
    return { plan, page, csv, board: boardAsset, ai: usedAi, sample: !!b.sampleBiz };
  },
  view(out) {
    const p = out.plan;
    return views.blocks(
      views.metric('Shots', p.shots.length, `about ${p.seconds} seconds of video, ${p.order.length} setups, about ${p.shootMinutes} minutes of filming`),
      views.file(out.page, 'Shoot plan to print or open on your phone'),
      views.image(out.board, 'Storyboard: how close to film each shot'),
      views.table(
        [
          { key: 'n', label: '#' },
          { key: 'name', label: 'Shot' },
          { key: 'framing', label: 'How close' },
          { key: 'seconds', label: 'Seconds', format: 'number' },
          { key: 'line', label: 'What to say' },
        ],
        p.shots.map((s) => ({ n: s.n, name: s.name, framing: s.framing, seconds: s.seconds, line: s.line || '' })),
      ),
      views.text(`Film in this order: ${p.order.map((g) => `${g.setup} (${g.shots.join(', ')})`).join('; ')}.`),
      views.copy('Ask anyone on camera first', p.consent),
      p.consentParent ? views.copy('For a child, ask a parent', p.consentParent) : null,
      views.file(out.csv, 'Shot list (.csv)'),
    );
  },
};
