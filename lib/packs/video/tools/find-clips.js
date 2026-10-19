// Finds the best moments in a transcript. Code scores every window of whole sentences (a strong first
// line, one complete thought, a payoff, a good length) and keeps the top dozen; AI only picks and
// titles the best few from those. Without AI the top windows and their own lines are used.

const { ai, text, views } = require('../../_kit');
const { flatten, duration, stamp } = require('../lib/words');
const { candidates, pickWindows, toClips, heuristicClips } = require('../lib/clips');

const SPANS = { short: [10, 30], medium: [15, 45], long: [30, 75] };

const SCHEMA = {
  type: 'object',
  properties: {
    clips: {
      type: 'array',
      items: {
        type: 'object',
        properties: { pick: { type: 'integer' }, title: { type: 'string', maxLength: 60 }, why: { type: 'string', maxLength: 160 } },
        required: ['pick', 'title'],
      },
    },
  },
  required: ['clips'],
};

module.exports = {
  name: 'video.find_clips',
  title: 'Find the best clips',
  description: 'Reads the transcript and picks the moments that stand on their own as short clips: a strong first line, one complete thought, a clear ending. Each gets a hook title in the speaker\'s own words.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['plan'],
  credits: 12,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      words: { type: 'array', title: 'Transcript (from Transcribe)' },
      count: { type: 'integer', title: 'How many clips', minimum: 1, maximum: 10, default: 5 },
      length: { type: 'string', title: 'Clip length', enum: ['short', 'medium', 'long'], default: 'medium' },
      topic: { type: 'string', title: 'What to look for (optional)', maxLength: 200 },
    },
    required: ['words'],
  },
  output: {
    type: 'object',
    properties: { clips: { type: 'array' }, minutes: { type: 'number' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } },
    required: ['clips'],
  },
  async run(input, ctx) {
    const blocks = Array.isArray(input.words) ? input.words : [];
    const sample = blocks.some((b) => b && b.sample);
    const all = flatten(blocks);
    const count = input.count || 5;
    const total = duration(all);
    if (all.length < 12) throw new Error('There are too few words to pick clips from. Check the video has speech, or that transcription is connected.');
    let [min, max] = SPANS[input.length] || SPANS.medium;
    if (total < 360) [min, max] = [Math.min(min, 10), Math.min(max, 35)];
    const base = heuristicClips(all, { count, min, max });
    const pool = pickWindows(candidates(all, { min, max, target: (min + max) / 2 }).list, Math.min(12, count * 2 + 2));
    const fallback = () => ({ clips: base.clips.map((c, i) => ({ pick: -1 - i, title: c.title, why: c.why })) });
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'plan',
      system: 'You are a short-form video editor. You pick moments that work alone as 15 to 60 second clips and write the hook title shown at the top of each clip.',
      prompt: [
        `Pick the ${count} best clips from these candidate moments of a talk${input.topic ? ` (the member wants clips about: ${input.topic})` : ''}.`,
        'Prefer a strong first line, one complete idea, and an ending that lands. Avoid intros and goodbyes.',
        'For each: pick (the candidate number), title (max 50 characters, plain words a viewer would stop for, built from what the speaker actually says, no claims they did not make), why (one short sentence).',
        '',
        ...pool.map((c, i) => `[${i}] ${stamp(c.start)} to ${stamp(c.end)}: ${text.clip(c.text, 700)}`),
      ].join('\n'),
      schema: SCHEMA,
      fallback,
      accept: ai.cleanCopy,
    });
    let clips;
    if (usedAi) {
      const seen = new Set();
      const chosen = [];
      for (const c of data.clips) {
        const w = pool[c.pick];
        if (!w || seen.has(c.pick) || chosen.some((x) => w.start < x.end + 1 && w.end > x.start - 1)) continue;
        seen.add(c.pick);
        chosen.push({ ...w, title: text.clip(c.title, 60), why: c.why ? text.oneLine(c.why) : '' });
        if (chosen.length >= count) break;
      }
      const missing = pickWindows(pool, count, chosen.slice());
      clips = toClips(missing.length > chosen.length ? missing : chosen, all, base.sents);
    } else clips = base.clips;
    clips.forEach((c, i) => {
      c.n = i + 1;
      c.id = `clip-${i + 1}`;
    });
    ctx.log(`Picked ${clips.length} clips from ${stamp(total)} of talk`);
    return { clips, minutes: Math.round((total / 60) * 10) / 10, ai: usedAi, sample };
  },
  view(out) {
    return views.blocks(
      views.metric('Clips found', out.clips.length, `from ${out.minutes} minutes`),
      views.cards(out.clips.map((c) => ({ title: c.title, subtitle: `${c.range}, ${Math.round(c.seconds)} seconds`, body: `${c.why}\n"${c.firstLine}"` }))),
    );
  },
};
