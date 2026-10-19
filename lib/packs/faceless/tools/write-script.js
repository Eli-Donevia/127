// One faceless short's script: a hook, 4 to 9 spoken lines and a follow line, written from the
// topic's Wikipedia facts in plain spoken words, plus 5 titles, cover words, the description with
// its source, and what to search for footage. Lines with numbers the facts don't have are dropped,
// and lines that copy Wikipedia word for word are flagged: YouTube doesn't pay for videos that only
// read out text someone else wrote. The member's own script is kept as written.

const { ai, views, text } = require('../../_kit');
const C = require('../lib/channel');
const S = require('../lib/script');
const W = require('../lib/facts');

const EXTRA = {
  type: 'object',
  properties: { cover: { type: 'string' }, summary: { type: 'string' }, titles: { type: 'array', items: { type: 'string' } } },
  required: ['cover', 'summary', 'titles'],
};

const plainLines = (s) => [s.hook, ...s.lines, s.cta].filter(Boolean).join('\n');

// The topic: an idea picked from the list, a topic typed, or the top idea not made yet.
async function topicFor(ctx, input, n) {
  const idea = Array.isArray(input.idea) ? input.idea[0] : input.idea;
  if (idea && (idea.article || idea.topic)) {
    const known = n.topics.find((t) => t.article === idea.article) || Object.values(C.TOPICS.niches).flat().find((t) => t.article === idea.article);
    return { topic: known ? { ...known, views: idea.views || known.views, month: idea.month || C.TOPICS.month } : await W.lookUp(ctx, idea.topic, n.id), angle: idea.angle };
  }
  if (text.oneLine(input.topic || '')) return { topic: await W.lookUp(ctx, input.topic, n.id), typed: text.oneLine(input.topic) };
  if (text.oneLine(input.own || '')) {
    const named = W.mentioned(input.own, n.id);
    return { topic: named ? { ...named, month: C.TOPICS.month } : null, fromScript: !!named };
  }
  const next = C.ideas(n, n.topics, { count: 1, made: C.madeIn(ctx, n.id) })[0];
  return { topic: n.topics.find((t) => t.article === next.article), angle: next.angle };
}

module.exports = {
  name: 'faceless.write_script',
  title: 'Write the video script',
  description: "Writes one faceless short's script from the topic's Wikipedia facts in plain spoken words: a hook, the lines and a follow line, plus 5 titles, cover words and the description with its source. Or tidies your own script and writes its titles.",
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      idea: { type: ['object', 'array', 'null'], title: 'Idea (from Find video ideas)' },
      topic: { type: 'string', title: 'Or a topic', maxLength: 120 },
      niche: { type: 'string', title: 'Niche', enum: C.NICHE_IDS },
      length: { type: 'string', title: 'Length', enum: Object.keys(S.LENGTHS), default: 'short' },
      own: { type: 'string', title: 'Or your own script', maxLength: 3000 },
      recording: { type: ['string', 'object', 'null'], title: 'Your own recording (when there is one, no voice is made)' },
    },
  },
  output: {
    type: 'object',
    properties: {
      scripts: { type: 'array' },
      title: { type: 'string' },
      titles: { type: 'array' },
      cover: { type: 'string' },
      description: { type: 'string' },
      stock: { type: 'string' },
      stockLinks: { type: 'array' },
      label: { type: 'string' },
      color: { type: 'string' },
      niche: { type: 'string' },
      source: { type: ['object', 'null'] },
      seconds: { type: 'integer' },
      length: { type: 'string' },
      needVoice: { type: 'boolean' },
      notes: { type: 'array' },
      ai: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['scripts', 'title'],
  },
  async run(input, ctx) {
    const n = C.nicheFor(ctx, input.niche);
    const length = S.LENGTHS[input.length] ? input.length : 'short';
    const handle = C.handleOf(ctx);
    const own = text.oneLine(input.own || '') ? input.own : '';
    const { topic, angle: picked, typed, fromScript } = await topicFor(ctx, input, n);
    const notes = [];
    const facts = topic ? await W.factsFor(ctx, topic) : { sentences: [], text: '', live: false };
    const madeHere = topic ? C.madeAngles(C.madeIn(ctx, n.id), topic.article) : [];
    const angle = S.angleForLength(picked || (topic ? S.pickAngle(topic, facts.text, 0, madeHere) : null) || 'sixty', length, topic || {}, facts.text, madeHere);
    const name = topic ? topic.topic : typed || '';
    let s;
    let usedAi = false;
    let titles;

    if (own) {
      // Their script, as written. AI only adds titles, cover words and the description line.
      s = S.ownScript(own, { topicName: fromScript ? '' : name, niche: n, length });
      if (s.lines.length < 1) throw new Error('Your script needs at least two lines: a hook and one more.');
      const { data, ai: viaAi } = await ai.aiJson(ctx, {
        task: 'write',
        system: 'You title faceless short videos. Plain words, true to the script, no clickbait it cannot back.',
        prompt: `Script:\n${plainLines(s)}\n\nReturn cover (2 to 5 words for the thumbnail that add to the title), summary (one sentence for the description, using only facts in the script) and titles (5 options under 60 characters).`,
        schema: EXTRA,
        maxTokens: 500,
        fallback: () => ({ cover: s.cover, summary: s.summary, titles: name ? S.titleOptions(name, angle, length, [s.title], topic) : [s.title] }),
        accept: (d) => ai.cleanCopy(d) && d.titles.length >= 3 && S.unknownNumbers(`${d.summary} ${d.titles.join(' ')}`, plainLines(s)).length === 0,
      });
      usedAi = viaAi;
      s = { ...s, cover: data.cover || s.cover, summary: data.summary || s.summary };
      titles = data.titles.map((t) => S.cut(t, 70)).filter(Boolean).slice(0, 5);
      s.title = titles[0] || s.title;
      if (facts.text) {
        const unknown = [...new Set(S.unknownNumbers(plainLines(s), facts.text))];
        if (unknown.length) notes.push(`Check ${unknown.join(', ')}: ${unknown.length === 1 ? "that number isn't" : "those numbers aren't"} in the Wikipedia summary we read.`);
      }
      if (fromScript) notes.push(`Took facts from Wikipedia? Put its link in your description: ${topic.url || W.urlOf(topic.article)}`);
    } else if (!topic || facts.sentences.length < 2) {
      // Nothing to write from: an outline to fill in, never made-up facts.
      s = { title: text.clip(text.sentenceCase(name || 'Your video'), 70), hook: `[Your hook about ${name || 'the topic'}]`, lines: ['[First thing to know]', '[Second thing]', '[The most surprising thing, near the end]'], cta: `Follow for more ${n.more}.`, cover: name.split(/\s+/).slice(0, 4).join(' ') || 'Your topic', summary: '' };
      titles = S.titleOptions(name || 'Your video', angle, length);
      notes.push(`We couldn't find "${name}" on Wikipedia just now, so there are no facts to write from. Write your own lines in the box (one fact each), or try the name Wikipedia uses for it.`);
    } else {
      const fallback = () => S.templateScript({ topic, angle, sentences: facts.sentences, niche: n, length });
      const { data, ai: viaAi } = await ai.aiJson(ctx, {
        task: 'write',
        system: S.SYSTEM,
        prompt: S.promptFor({ topic, angle, facts: facts.text, niche: n, length }),
        schema: S.SCRIPT,
        maxTokens: 1400,
        fallback,
        accept: (d) => ai.cleanCopy(d) && Array.isArray(d.lines) && d.lines.length >= 3 && d.lines.length <= 12,
      });
      s = data;
      usedAi = viaAi;
      if (viaAi) {
        const g = S.guard(data, facts.text);
        if (!g.ok) {
          s = fallback();
          usedAi = false;
          notes.push("The AI draft used facts we couldn't find on Wikipedia, so this is the plain draft from Wikipedia's own sentences.");
        } else {
          s = g;
          if (g.dropped.length) notes.push(`${g.dropped.length} line${g.dropped.length > 1 ? 's were' : ' was'} left out for using a number the facts don't have.`);
          if (g.copiedLines.length) notes.push(`Line${g.copiedLines.length > 1 ? 's' : ''} ${g.copiedLines.map((i) => i + 1).join(', ')} still use${g.copiedLines.length > 1 ? '' : 's'} Wikipedia's exact words. Say ${g.copiedLines.length > 1 ? 'them' : 'it'} your own way.`);
        }
      }
      if (!usedAi) notes.unshift("These lines are Wikipedia's own sentences, a starting point only. Rewrite each one the way you'd say it to a friend before you post: YouTube doesn't pay for videos that only read out text someone else wrote.");
      s.cta = text.oneLine(s.cta) || `Follow for more ${n.more}.`;
      titles = S.titleOptions(name, angle, length, usedAi ? [s.title, ...(s.titles || [])].filter(Boolean) : [], topic);
      s.title = titles[0];
    }

    const seconds = S.secondsOf(s);
    if (length === 'minute' && seconds < 62) notes.push(`This reads in about ${seconds} seconds. TikTok's Creator Rewards counts only videos longer than 1 minute, so add a line or two before you render.`);
    if (length === 'short' && seconds > 58) notes.push(`This reads in about ${seconds} seconds. Cut a line to keep it under a minute.`);
    const cover = S.trimCover(s.cover || S.coverFor(name, angle, length));
    const stock = topic ? C.stockFor(topic, n) : n.stock;
    const stockLinks = [...new Set([stock, n.stock])].map((q) => ({ label: `Footage on Pexels: ${q}`, url: C.pexelsSearch(q) }));
    // Your own script: no Wikipedia credit line unless the facts came from it (the note says so).
    const description = C.descriptionFor(s, own ? null : topic, n);
    if (topic && topic.article && !own) await C.rememberMade(ctx, n.id, [{ article: topic.article, angle }]);
    ctx.log(`Script for ${name || s.title}: ${s.lines.length + 2} lines, about ${seconds} seconds${usedAi ? '' : own ? ' (your words)' : ' (draft from Wikipedia)'}${facts.live ? ', facts read live' : ''}`);
    return {
      scripts: [{ title: s.title, text: S.toText(s, handle), kind: 'faceless', topic: name, seconds }],
      title: s.title,
      titles,
      cover,
      description,
      stock,
      stockLinks,
      label: name ? S.cut(name, 40) : '',
      color: C.videoColor(ctx, n),
      niche: n.id,
      source: topic ? { topic: topic.topic, wiki: topic.wiki || topic.topic, url: topic.url || W.urlOf(topic.article), views: topic.views || null, month: topic.month || null, live: !!facts.live } : null,
      seconds,
      length,
      needVoice: !input.recording,
      notes,
      ai: usedAi,
      sample: !usedAi && !own,
    };
  },
  view(out) {
    const sc = out.scripts[0];
    const lines = sc.text.split('\n').map((l) => l.replace(/^[A-Z]+:\s*/, '').split(' | ')[0]);
    return views.blocks(
      views.metric('Script', `${out.seconds} seconds`, `read aloud at an easy pace, ${lines.length} lines`),
      views.copy('Script to read', lines.join('\n')),
      (out.notes || []).map((x) => views.text(x)),
      views.copy('Title options', out.titles.join('\n')),
      views.copy('Description', out.description),
      views.text(`Cover words: ${out.cover}`),
      out.source ? views.link(`Facts: Wikipedia, ${out.source.wiki}`, out.source.url) : null,
      (out.stockLinks || []).map((l) => views.link(l.label, l.url)),
    );
  },
};
