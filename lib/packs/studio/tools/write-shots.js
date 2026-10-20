// Plan the shots: 1 to 6 shots for an AI video model, each with a plain title, the words the model
// gets (editable in HQ before anything is made), how long it runs and the camera move. Built in code
// from the prompt packs (lib/prompts.js); AI, when it answers, tightens them to the member's product
// and words. With ad angles (from the ads desk), one shot per angle, each opening on that angle's hook.

const { ai, views, text, brain } = require('../../_kit');

const KINDS = ['product', 'ugc', 'cinematic', 'faceless', 'broll', 'talking'];

function promptsLib() {
  try {
    return require('../lib/prompts');
  } catch {
    return null;
  }
}

function joinShot(s) {
  return [s.subject, s.action, s.setting, s.camera, s.light, s.mood, s.style].filter(Boolean).join(', ');
}

// The code plan: from the prompt packs when present, else a short built-in list.
function codePlan({ kind, subject, setting, count, seconds, brand, angles, seed }) {
  const P = promptsLib();
  let list = [];
  if (P && typeof P.shotList === 'function') {
    try {
      list = P.shotList({ kind, subject, setting, count, seconds, brand, seed }) || [];
    } catch {
      list = [];
    }
  }
  if (!list.length) {
    const moves = ['slow push in', 'slow orbit around it', 'gentle handheld follow', 'top-down slide', 'crane up and reveal', 'macro push on the details'];
    const actions = { product: ['sits on a clean surface as light sweeps across it', 'turns slowly to show every side', 'in someone\'s hands, being used', 'close up on the texture and details', 'unboxed onto a table', 'next to everyday things for scale'], ugc: ['held up to a phone camera in a bright kitchen', 'being unboxed on a bed', 'used at a bathroom counter', 'in a bag on the go', 'shown next to the old way of doing it', 'held up at the end, close to camera'], cinematic: ['in soft window light', 'at golden hour outside', 'on a dark set with one hard light', 'in light haze', 'reflected in glass', 'in a wide establishing shot'], faceless: ['hands working on a desk', 'a city street at morning', 'a notebook and coffee', 'a laptop screen glowing in a dark room', 'a slow pan across shelves', 'a timelapse of clouds'], broll: ['a detail of the work being done', 'tools laid out', 'a wide of the space', 'hands at work', 'the finished result', 'a walk-through of the room'], talking: ['a person speaking to camera, friendly and natural', 'a person nodding as they listen', 'a person pointing to something off camera', 'a person smiling at the end', 'a person in a car, speaking to the phone', 'a person at a desk, speaking'] };
    const acts = actions[kind] || actions.product;
    for (let i = 0; i < count; i++) {
      list.push({ n: i + 1, title: text.titleCase(acts[i % acts.length].split(' ').slice(0, 4).join(' ')), seconds, shot: { subject: subject || 'the product', action: acts[i % acts.length], setting: setting || '', camera: moves[i % moves.length], light: 'soft natural light', mood: '', style: 'realistic, vertical video' } });
    }
  }
  list = list.slice(0, count).map((s, i) => ({ n: i + 1, title: text.clip(s.title || `Shot ${i + 1}`, 60), seconds: s.seconds || seconds, shot: s.shot || {} }));
  if (Array.isArray(angles) && angles.length) {
    list = angles.slice(0, count).map((a, i) => {
      const base = list[i % list.length] || { shot: {} };
      return { ...base, n: i + 1, title: text.clip(a.name || `Angle ${i + 1}`, 60), hook: text.oneLine(a.hook || ''), angle: a.key || a.name || '' };
    });
  }
  return list.map((s) => {
    let words = joinShot(s.shot);
    let negative = '';
    if (promptsLib() && typeof promptsLib().build === 'function') {
      try {
        const b = promptsLib().build({ model: 'kling', shot: s.shot, aspect: '9:16', seconds: s.seconds });
        words = b.prompt || words;
        negative = b.negative || '';
      } catch {
        /* keep the joined words */
      }
    }
    return { ...s, text: words, negative, hook: s.hook || '' };
  });
}

module.exports = {
  name: 'studio.write_shots',
  title: 'Plan the shots',
  description: 'Plans 1 to 6 shots for an AI video model: what each shows, the camera move, the light and how long it runs, written the way video models read best. You can edit the words before anything is made.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      kind: { type: 'string', title: 'What kind of video', enum: KINDS, default: 'product' },
      subject: { type: 'string', title: 'What it is about', description: 'Your product or service, in a few words', maxLength: 160 },
      setting: { type: 'string', title: 'Where (optional)', maxLength: 160 },
      script: { type: ['object', 'string', 'null'], title: 'The script (optional)', description: 'From Write the script: one shot per line' },
      angles: { type: ['array', 'null'], title: 'Ad angles (optional)', items: { type: 'object' } },
      count: { type: 'integer', title: 'How many shots', minimum: 1, maximum: 6, default: 3 },
      seconds: { type: 'integer', title: 'Seconds per shot', minimum: 3, maximum: 10, default: 5 },
      look: { type: 'string', title: 'Look (optional)', maxLength: 120, description: 'Like "bright and clean", "warm and moody", "shot on a phone"' },
    },
  },
  output: {
    type: 'object',
    properties: { shots: { type: 'array', items: { type: 'object' } }, kind: { type: 'string' }, ai: { type: 'boolean' } },
    required: ['shots', 'kind'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const kind = input.kind || 'product';
    const subject = text.oneLine(input.subject || b.offer || b.what || '');
    if (!subject && !input.script && !(input.angles && input.angles.length)) throw new Error('Say what the video is about: your product or service in a few words.');
    const scriptText = input.script && typeof input.script === 'object' ? input.script.text : input.script;
    const lines = String(scriptText || '').split(/\r?\n/).map((l) => text.oneLine(l.replace(/^[A-Z]+\s*:\s*/, ''))).filter(Boolean);
    const count = Math.min(6, input.angles && input.angles.length ? input.angles.length : lines.length && !input.count ? Math.min(6, lines.length) : input.count || 3);
    const plan = codePlan({ kind, subject: subject || 'the product', setting: input.setting, count, seconds: input.seconds || 5, brand: b.name, angles: input.angles, seed: `${b.name}|${subject}` });
    if (lines.length) plan.forEach((s, i) => (s.line = lines[Math.round((i * lines.length) / plan.length)] || ''));
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write shot prompts for AI video models (Kling, Veo, Runway, Luma, Higgsfield). Each prompt is one or two sentences: the subject first, then what moves, then the camera move, the setting and the light. Describe motion, not a still. No text or logos in the shot, no real people\'s names, no brand names but the member\'s own. Never show a customer review or a testimonial.',
      prompt: `Video kind: ${kind}. About: ${subject}.${input.setting ? ` Setting: ${input.setting}.` : ''}${input.look ? ` Look: ${input.look}.` : ''}${b.name ? ` Business: ${b.name}.` : ''}\nRewrite these ${plan.length} shots so each fits the subject. Keep the same number and order, keep each camera move.\n${plan.map((s) => `${s.n}. ${s.title}: ${s.text}${s.line ? ` (goes under the line: "${s.line}")` : ''}${s.hook ? ` (opens the ad "${s.hook}")` : ''}`).join('\n')}`,
      schema: { type: 'object', properties: { shots: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } }, required: ['title', 'text'] } } }, required: ['shots'] },
      fallback: () => ({ shots: plan.map((s) => ({ title: s.title, text: s.text })) }),
      accept: (d) => Array.isArray(d.shots) && d.shots.length === plan.length && ai.cleanCopy(d),
    });
    const shots = plan.map((s, i) => ({ ...s, title: text.clip(data.shots[i].title || s.title, 60), text: text.clip(`${data.shots[i].text}${!usedAi && input.look ? `, ${input.look}` : ''}`, 900) }));
    ctx.log(`Planned ${shots.length} shots`);
    return { shots, kind, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.table([{ key: 'n', label: '#' }, { key: 'title', label: 'Shot' }, { key: 'text', label: 'Words for the model' }, { key: 'seconds', label: 'Seconds', format: 'number' }], out.shots, 6),
      ...out.shots.map((s) => views.copy(`Shot ${s.n}: ${s.title}`, s.text)),
    );
  },
};
