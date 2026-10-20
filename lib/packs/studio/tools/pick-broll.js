// Where b-roll goes in a long talking video: 1 to 4 moments, each with the words being said and a
// shot for an AI video model to fill it. From the transcript when there is one (transcription is held
// for Legal, so in production the member's topic and evenly spaced moments stand in).

const { ai, views, text, brain } = require('../../_kit');

function flatWords(words) {
  const out = [];
  for (const item of Array.isArray(words) ? words : []) {
    if (!item || item.error) continue;
    const list = Array.isArray(item.words) ? item.words : Array.isArray(item) ? [item] : [];
    for (const w of list) {
      if (Array.isArray(w)) out.push({ w: String(w[0]), s: Number(w[1]), e: Number(w[2]) });
      else if (w && w.w != null) out.push({ w: String(w.w), s: Number(w.s), e: Number(w.e) });
    }
  }
  return out.filter((w) => Number.isFinite(w.s)).sort((a, b) => a.s - b.s);
}

// Sentences with times.
function sentences(ws) {
  const out = [];
  let cur = [];
  for (const w of ws) {
    cur.push(w);
    if (/[.!?]$/.test(w.w) || cur.length > 28) {
      out.push({ text: cur.map((x) => x.w).join(' '), start: cur[0].s, end: cur[cur.length - 1].e });
      cur = [];
    }
  }
  if (cur.length) out.push({ text: cur.map((x) => x.w).join(' '), start: cur[0].s, end: cur[cur.length - 1].e });
  return out;
}

const CONCRETE = /\b(kitchen|car|house|yard|store|shop|phone|laptop|money|coffee|gym|street|city|office|team|customer|product|box|hands?|tools?|food|dog|kids?|desk|truck|garden|camera|screen|clients?)\b/i;

module.exports = {
  name: 'studio.pick_broll',
  title: 'Pick the b-roll moments',
  description: 'Finds 1 to 4 moments in your talking video where b-roll helps (a concrete thing being described, a long stretch on one shot) and writes a shot for each one.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['plan'],
  credits: 12,
  input: {
    type: 'object',
    properties: {
      words: { type: ['array', 'null'], title: 'Transcript words', items: {} },
      seconds: { type: ['number', 'null'], title: 'Video length in seconds' },
      topic: { type: 'string', title: 'What the video is about', maxLength: 200 },
      count: { type: 'integer', title: 'How many moments', minimum: 1, maximum: 4, default: 3 },
      clip: { type: 'integer', title: 'Seconds of each b-roll', minimum: 2, maximum: 6, default: 3 },
    },
  },
  output: {
    type: 'object',
    properties: { moments: { type: 'array', items: { type: 'object' } }, from: { type: 'string' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } },
    required: ['moments', 'from'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const count = input.count || 3;
    const len = input.clip || 3;
    const ws = flatWords(input.words);
    const sents = sentences(ws);
    const total = Number(input.seconds) || (ws.length ? ws[ws.length - 1].e : 60);
    const topic = text.oneLine(input.topic || b.offer || b.what || 'the business');
    let picks;
    let from;
    if (sents.length >= 2) {
      from = 'transcript';
      const scored = sents.filter((s) => s.start > 2.5 && s.end < total - 1).map((s, i) => ({ ...s, score: (CONCRETE.test(s.text) ? 3 : 0) + Math.min(3, (s.end - s.start) / 4) + (i % 3 === 1 ? 0.5 : 0) }));
      picks = scored.sort((a, z) => z.score - a.score).filter((s, i, arr) => arr.slice(0, i).every((o) => Math.abs(o.start - s.start) > len + 4)).slice(0, count).sort((a, z) => a.start - z.start);
    } else {
      from = 'even';
      picks = Array.from({ length: count }, (_, i) => ({ start: Math.round(((i + 1) * total) / (count + 1)), text: '' }));
    }
    const plan = picks.map((p, i) => ({ n: i + 1, at: Math.round(p.start * 10) / 10, seconds: len, said: text.clip(p.text, 200), title: `B-roll ${i + 1}`, text: `${p.text ? `${text.clip(p.text, 80)}: ` : ''}${topic}, close detail shot, slow camera push in, natural light, realistic` }));
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'plan',
      system: 'You plan b-roll for short talking videos. For each moment write a short title and one sentence for an AI video model: what is shown, what moves, the camera move and the light. Show the thing being talked about, literally. No text, logos, real people\'s names or faces of real people.',
      prompt: `Video about: ${topic}.\n${plan.map((m) => `${m.n}. at ${m.at}s${m.said ? `, said: "${m.said}"` : ''}`).join('\n')}`,
      schema: { type: 'object', properties: { moments: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } }, required: ['title', 'text'] } } }, required: ['moments'] },
      fallback: () => ({ moments: plan.map((m) => ({ title: m.title, text: m.text })) }),
      accept: (d) => Array.isArray(d.moments) && d.moments.length === plan.length,
    });
    const moments = plan.map((m, i) => ({ ...m, title: text.clip(data.moments[i].title, 60), text: text.clip(data.moments[i].text, 600) }));
    return { moments, from, ai: usedAi, sample: from === 'even' };
  },
  view(out) {
    return views.blocks(
      out.from === 'even' ? views.text('No transcript yet (transcription is not switched on), so the moments are spread evenly. Move them in the next step if you like.') : null,
      views.table([{ key: 'at', label: 'At (s)', format: 'number' }, { key: 'title', label: 'B-roll' }, { key: 'said', label: 'Being said' }], out.moments),
    );
  },
};
