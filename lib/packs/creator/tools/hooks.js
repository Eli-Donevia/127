// Hooks and scripts: 20 opening lines for one topic (questions, mistakes, how-tos, stories, lists)
// and 3 short video scripts (hook, three beats, a call to comment or save), timed for 30 or 60
// seconds. From the member's topic and facts only: no "this will go viral", follower counts, results
// in a set time or numbers they didn't type (Legal L76 D3, D4).

const { views, save, time, text, ai } = require('../../_kit');
const U = require('../lib/util');
const K = require('../lib/creator');

const { plain } = text;

const SCHEMA = {
  type: 'object',
  required: ['hooks', 'scripts'],
  properties: {
    hooks: { type: 'array', items: { type: 'string' } },
    scripts: { type: 'array', items: { type: 'object', required: ['title', 'hook', 'beats', 'close'], properties: { title: { type: 'string' }, hook: { type: 'string' }, beats: { type: 'array', items: { type: 'string' } }, close: { type: 'string' }, on_screen: { type: 'string' } } } },
  },
};

const HOOKS = [
  'The mistake almost everyone makes with {topic}.',
  'Stop doing this with {topic}.',
  'Here is how I do {topic}, start to finish.',
  'If you are new to {topic}, watch this first.',
  'Three things I wish I knew about {topic}.',
  'You do not need anything fancy for {topic}. Here is what I use.',
  'Is {topic} worth it? My honest answer.',
  'The smallest change that helped my {topic} the most.',
  'I tried {topic} the hard way so you do not have to.',
  'What nobody tells you about {topic}.',
  'Save this for the next time you try {topic}.',
  'Answering the question I get most about {topic}.',
  'The one thing I check before I start {topic}.',
  'Beginner vs. a year in: {topic}.',
  'POV: your first week of {topic}.',
  'Do this, not that: {topic}.',
  'How I fixed my {topic} problem.',
  'A {topic} myth I believed for way too long.',
  'Everything I use for {topic}, and why.',
  'Try this the next time you do {topic}.',
];

function template(f) {
  const hooks = HOOKS.map((h) => h.replace(/\{topic\}/g, f.topic));
  const facts = f.facts.length ? f.facts : [`Show the first step of ${f.topic}`, 'Show the part people get wrong, and the fix', 'Show the result, and what you would do next time'];
  const scripts = [
    { title: 'The common mistake', hook: hooks[0], beats: [`Show the mistake: ${facts[0]}`, `Why it happens: ${facts[1] || 'say it in one line'}`, `The fix: ${facts[2] || 'show it once, slowly'}`], close: 'Save this so you have it next time. What should I cover next?', on_screen: `The ${f.topic} mistake` },
    { title: 'Start to finish', hook: hooks[2], beats: facts.slice(0, 3).map((x, i) => `Step ${i + 1}: ${x}`), close: 'Questions? Ask in the comments and I will answer every one.', on_screen: `${f.topic}: start to finish` },
    { title: 'Your question, answered', hook: hooks[11], beats: [`Read the question on screen${f.audience ? ` (from ${f.audience})` : ''}`, `Give the short answer: ${facts[0]}`, 'Show it, then say what you would do differently'], close: 'Got a question? Comment it and I will answer the next one on camera.', on_screen: 'You asked' },
  ];
  return { hooks, scripts };
}

module.exports = {
  name: 'creator.hooks_scripts',
  title: 'Write hooks and scripts',
  description: '20 opening lines for one topic and 3 short video scripts (hook, three beats, a close), timed for 30 or 60 seconds, from your topic and facts only.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  timeoutSec: 120,
  input: {
    type: 'object',
    required: ['topic'],
    properties: {
      topic: { type: 'string', maxLength: 100, title: 'Topic of the video', description: 'Like "repotting a snake plant"' },
      facts: { type: 'string', format: 'textarea', maxLength: 1200, title: 'What you would show or say (optional)', description: 'One point per line, in your words' },
      seconds: { type: 'integer', enum: [30, 60], default: 30, title: 'Length' },
      audience: { type: 'string', maxLength: 120, title: 'Who it is for (optional)' },
    },
  },
  output: { type: 'object', required: ['hooks', 'scripts'], properties: { topic: { type: 'string' }, hooks: { type: 'array' }, scripts: { type: 'array' }, seconds: { type: 'integer' }, file: { type: 'object' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const seconds = Number(input.seconds) === 60 ? 60 : 30;
    const f = {
      topic: plain(input.topic || m.niche).replace(/[.!?]$/, ''),
      facts: K.C.linesOf(input.facts, 8).map((x) => plain(x).replace(/^[-*\s]+/, '').replace(/[.]$/, '')),
      audience: m.audience,
    };
    const typed = U.typedOf(input, ctx);
    const words = seconds === 60 ? 150 : 75;
    const r = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write short-video hooks and scripts for a new creator, in their voice: plain, specific, spoken. Only the facts given. No "viral", no follower counts, no promised results, no results in a set time, no "best", "#1", ratings or percentages unless given. No before-and-after for the body, skin or weight.',
      prompt: `Topic: ${f.topic}\nWhat they would show or say:\n${f.facts.join('\n') || '(nothing given: keep beats general)'}\nFor: ${f.audience || '(not given)'}\nLength: ${seconds} seconds (about ${words} spoken words per script)\n\nWrite 20 different hooks (one line each, under 14 words) and 3 scripts. Each script: a title, the hook, 3 beats (what to say and show), a close that asks for a comment or a save, and on-screen text under 6 words.`,
      schema: SCHEMA,
      maxTokens: 1800,
      accept: (d) => U.acceptOf(typed)(d) && Array.isArray(d.hooks) && d.hooks.length >= 12 && Array.isArray(d.scripts) && d.scripts.length >= 3,
      fallback: () => template(f),
    });
    const sc = (s) => U.scrub(s, typed);
    const tpl = template(f);
    const hooks = [...new Set(r.data.hooks.map(sc).filter(Boolean))].slice(0, 20);
    for (const h of tpl.hooks) if (hooks.length < 20 && !hooks.includes(h)) hooks.push(h);
    const scripts = r.data.scripts.slice(0, 3).map((s, i) => {
      const t = tpl.scripts[i];
      const beats = (s.beats || []).map(sc).filter(Boolean).slice(0, 4);
      return { title: U.fit(sc(s.title) || t.title, 60), hook: sc(s.hook) || t.hook, beats: beats.length >= 2 ? beats : t.beats, close: sc(s.close) || t.close, on_screen: U.fit(sc(s.on_screen || '') || t.on_screen, 40), seconds };
    });
    const lines = [`Hooks for: ${f.topic}`, ...hooks.map((h, i) => `${i + 1}. ${h}`), '', ...scripts.flatMap((s) => [`Script: ${s.title} (${seconds} seconds)`, `Hook: ${s.hook}`, ...s.beats.map((b, i) => `${i + 1}. ${b}`), `Close: ${s.close}`, `On screen: ${s.on_screen}`, ''])];
    const file = await save.saveFile(ctx, save.fileName(f.topic, 'hooks', time.today(ctx), '.txt'), lines.join('\n'));
    return { topic: f.topic, hooks, scripts, seconds, file, ai: r.ai, ...(r.ai ? {} : { sample: true }) };
  },
  view(out) {
    return views.blocks(
      views.metric('Hooks and scripts', out.topic, `${out.hooks.length} hooks, ${out.scripts.length} scripts of ${out.seconds} seconds`),
      views.copy('20 hooks', out.hooks.map((h, i) => `${i + 1}. ${h}`).join('\n')),
      ...out.scripts.map((s) => views.copy(`Script: ${s.title}`, [`Hook: ${s.hook}`, ...s.beats.map((b, i) => `${i + 1}. ${b}`), `Close: ${s.close}`, `On screen: ${s.on_screen}`].join('\n'))),
      views.text('Say the hook in the first two seconds, with the words on screen too. Film three takes of the hook alone and keep the clearest.'),
      views.file(out.file, 'Hooks and scripts (text)'),
    );
  },
};
