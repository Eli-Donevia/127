// Write the script for a short ad or video to be read out: UGC-style (a person showing the product
// on their phone), faceless (a voice over b-roll) or talking head. One sentence per line, so Make the
// voiceover reads it and the captions follow it. Only facts the member gave: no made-up results,
// reviews or numbers, and no promise of results.

const { ai, views, text, brain } = require('../../_kit');

const STYLES = ['ugc', 'faceless', 'talking'];

function fallbackScripts(b, input, n) {
  const what = text.oneLine(input.product || b.offer || b.what || 'this');
  const who = text.oneLine(input.audience || b.audience || 'people like you');
  const pts = String(input.points || '').split(/\r?\n|;/).map((x) => text.oneLine(x)).filter(Boolean).slice(0, 3);
  const point = (i, dflt) => pts[i] || dflt;
  const cta = text.oneLine(input.cta || (b.website ? 'Tap the link to see it.' : 'Send me a message to get yours.'));
  const opens = {
    ugc: [`Okay, I have to show you ${what}.`, `If you are ${who}, watch this.`, `This is the ${what} I keep telling people about.`],
    faceless: [`Here is what most ${who} miss about ${what}.`, `Three things to know before you buy ${what}.`, `This is how ${what} works, in under 30 seconds.`],
    talking: [`Hi, I make ${what}.`, `Quick one for ${who}.`, `Here is why I started ${b.name || 'this'}.`],
  }[input.style] || [];
  return Array.from({ length: n }, (_, v) => ({
    title: `${input.style === 'ugc' ? 'UGC-style ad' : input.style === 'faceless' ? 'Faceless video' : 'Talking clip'} ${v + 1}`,
    text: [opens[v % opens.length], point(0, `It is made for ${who}.`), point(1, `Here is how it works, start to finish.`), point(2, 'You can see every detail up close.'), cta].join('\n'),
  }));
}

module.exports = {
  name: 'studio.write_script',
  title: 'Write the script',
  description: 'Writes a short script to be read out for a UGC-style ad, a faceless video or a talking clip: a hook line, your points and a call to action, one sentence per line. Only uses facts you give it.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      style: { type: 'string', title: 'Style', enum: STYLES, default: 'ugc' },
      product: { type: 'string', title: 'What you sell or the topic', maxLength: 160 },
      audience: { type: 'string', title: 'Who it is for (optional)', maxLength: 160 },
      points: { type: 'string', format: 'textarea', title: 'What to say (optional)', description: 'One point per line: what it does, what is included, the price', maxLength: 1200 },
      cta: { type: 'string', title: 'What should they do at the end (optional)', maxLength: 140 },
      seconds: { type: 'integer', title: 'About how long (seconds)', minimum: 10, maximum: 60, default: 25 },
      variants: { type: 'integer', title: 'How many versions', minimum: 1, maximum: 3, default: 2 },
    },
  },
  output: {
    type: 'object',
    properties: { scripts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, style: { type: 'string' }, seconds: { type: 'number' }, text: { type: 'string' } }, required: ['title', 'text'] } }, ai: { type: 'boolean' } },
    required: ['scripts'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const style = input.style || 'ugc';
    const product = text.oneLine(input.product || b.offer || b.what || '');
    if (!product) throw new Error('Say what you sell or what the video is about.');
    const n = input.variants || 2;
    const seconds = input.seconds || 25;
    const words = Math.round(seconds * 2.4);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: `You write scripts to be read out for short vertical videos. ${style === 'ugc' ? 'UGC style: casual, first person, like a person filming on their phone. It is the member or a creator they pay, who will disclose it; never a customer review or testimonial, never "I was skeptical" stories.' : style === 'faceless' ? 'Faceless: a calm voice over b-roll, second person, useful.' : 'Talking head: the member speaking to camera, first person.'} One sentence per line, no labels, no stage directions, no emoji, no hashtags. Line 1 is the hook and must work with the sound off as on-screen text. Last line is the call to action. Use only the facts given; no numbers, results, reviews or claims that are not given. Never promise results.`,
      prompt: `Product or topic: ${product}.${input.audience || b.audience ? ` For: ${input.audience || b.audience}.` : ''}${b.name ? ` Business: ${b.name}.` : ''}${input.points ? `\nPoints:\n${input.points}` : ''}${input.cta ? `\nCall to action: ${input.cta}` : ''}\nWrite ${n} different versions, each about ${words} words.`,
      schema: { type: 'object', properties: { scripts: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } }, required: ['title', 'text'] } } }, required: ['scripts'] },
      fallback: () => ({ scripts: fallbackScripts(b, { ...input, style, product }, n) }),
      accept: (d) => Array.isArray(d.scripts) && d.scripts.length >= 1 && ai.cleanCopy(d),
    });
    const scripts = data.scripts.slice(0, n).map((s, i) => ({ id: `script-${i + 1}`, title: text.clip(s.title, 60), style, seconds, text: String(s.text).split(/\r?\n/).map((l) => text.oneLine(l)).filter(Boolean).join('\n') }));
    return { scripts, ai: usedAi };
  },
  view(out) {
    return views.blocks(...out.scripts.map((s) => views.copy(s.title, s.text)));
  },
};
