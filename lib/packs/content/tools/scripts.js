// Film-ready scripts from hooks, and one shoot sheet for all of them.

const { text, ai, views, save } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const { buildScript } = require('../lib/scripts');
const { page, esc, table } = require('../lib/page');
const { FACT_INPUTS } = require('./hooks');

const SCRIPT_SCHEMA = { type: 'object', properties: { beats: { type: 'array', items: { type: 'object', properties: { say: { type: 'string', maxLength: 300 } }, required: ['say'] } } }, required: ['beats'] };

const writeScript = {
  name: 'content.write_script',
  title: 'Write a video script',
  description: 'Turns one hook into a film-ready short video script: the hook (said and on screen), who you are in one line, 2 to 4 beats with on-screen text and the shot to film, the close with your comment keyword, the caption and up to 5 hashtags.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      hook: { type: 'object', title: 'Hook', description: 'One hook from content.write_hooks' },
      ask: { type: 'boolean', title: 'Is this the ask post?' },
      ...FACT_INPUTS,
    },
    required: ['hook'],
  },
  output: { type: 'object', properties: { script: { type: 'object' }, ai: { type: 'boolean' } }, required: ['script'] },
  async run(input, ctx) {
    if (!input.hook || !input.hook.hook) throw new Error('Pick a hook first.');
    const f = factsOf(ctx, input);
    const s = buildScript(input.hook, f, { ask: input.ask });
    const talking = s.beats.filter((b) => b.say);
    if (talking.length) {
      const { data, ai: usedAi } = await ai.aiJson(ctx, {
        task: 'write',
        system: 'You edit short video scripts for a small business owner who films on a phone. Make each line sound like a person talking: short sentences, plain words, no hype, no emoji. Keep every fact, price and place exactly as given.',
        prompt: `Hook: ${s.hookText}\nRewrite each beat so it is easy to say out loud. Same number of beats, same meaning.\n${JSON.stringify(talking.map((b) => ({ say: b.say })))}`,
        schema: SCRIPT_SCHEMA,
        fallback: () => ({ beats: [] }),
        accept: (d) => ai.cleanCopy(d) && (!d.beats.length || d.beats.length === talking.length),
      });
      if (usedAi && data.beats.length === talking.length) {
        let j = 0;
        s.beats = s.beats.map((b) => (b.say ? { ...b, say: text.oneLine(data.beats[j++].say) } : b));
        s.spoken = [s.hook.say, s.intro && s.intro.say, ...s.beats.map((b) => b.say), s.close.say].filter(Boolean).join('\n\n');
        s.ai = true;
      }
    }
    ctx.log(`Script: ${s.title} (${s.seconds} seconds)`);
    return { script: s, ai: !!s.ai };
  },
  view(out) {
    const s = out.script;
    return [views.cards([{ title: s.title, subtitle: `${s.seconds} seconds, ${s.format}${s.ask ? ', the ask' : ''}`, body: text.clip(s.silent ? s.beats.map((b) => b.onScreen).join(' / ') : s.spoken, 1200) }]), views.copy('Caption', s.caption)];
  },
  viewMany(outs) {
    const list = outs.map((o) => o.script).filter(Boolean);
    return views.blocks(
      views.table([{ key: 'title', label: 'Video' }, { key: 'seconds', label: 'Seconds', format: 'number' }, { key: 'format', label: 'Format' }, { key: 'keyword', label: 'Keyword' }], list, 10),
      list.slice(0, 5).map((s) => views.copy(`Say it: ${text.clip(s.title, 50)}`, s.silent ? s.beats.map((b) => `On screen: ${b.onScreen}`).join('\n') : s.spoken)),
      list.slice(0, 5).map((s) => views.copy(`Caption: ${text.clip(s.title, 50)}`, s.caption)),
    );
  },
};

const shootSheet = {
  name: 'content.shoot_sheet',
  title: 'Make a shoot sheet',
  description: 'Puts every script on one printable shoot sheet (what to say, what goes on screen, what to film, a shot checklist and the caption), plus a teleprompter text file and a captions file to paste from.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { scripts: { type: 'array', title: 'Scripts', description: 'Outputs of content.write_script' }, area: FACT_INPUTS.area } },
  output: { type: 'object', properties: { files: { type: 'array' }, count: { type: 'integer' }, seconds: { type: 'integer' } }, required: ['files'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const list = (input.scripts || []).map((x) => (x && x.script) || x).filter((s) => s && s.hook);
    if (!list.length) throw new Error('There are no scripts to put on the sheet yet.');
    const seconds = list.reduce((a, s) => a + (s.seconds || 0), 0);
    const body = list.map((s, i) => {
      const rows = [
        { part: 'Hook', say: s.hook.say || '(no talking)', screen: s.hook.onScreen, shot: s.hook.shot },
        ...(s.intro ? [{ part: 'Who you are', say: s.intro.say, screen: '', shot: s.intro.shot }] : []),
        ...s.beats.map((b, j) => ({ part: `Beat ${j + 1}`, say: b.say || '(no talking)', screen: b.onScreen, shot: b.shot })),
        { part: 'Close', say: s.close.say, screen: s.close.onScreen, shot: s.close.shot },
      ];
      return `<section class="${i ? 'pb' : ''}"><div class="card"><div class="meta"><span class="tag">Video ${i + 1}</span><span class="tag">${esc(s.format)}</span><span class="tag">About ${esc(s.seconds)} seconds</span>${s.ask ? '<span class="tag ask">The ask</span>' : ''}</div><p class="big">${esc(s.hookText)}</p>${table([{ key: 'part', label: 'Part' }, { key: 'say', label: 'Say' }, { key: 'screen', label: 'On screen' }, { key: 'shot', label: 'Film this' }], rows)}<h3>Shot checklist</h3><ul class="checks">${s.shots.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><h3>Caption</h3><pre>${esc(s.caption)}</pre><p class="muted">${esc(s.tips.join(' '))}</p></div></section>`;
    }).join('');
    const html = page(f, {
      title: `Shoot sheet: ${list.length} ${list.length === 1 ? 'video' : 'videos'}`,
      kicker: 'Film day',
      sub: `Film them back to back in one session. Read each line from the teleprompter file, then paste the caption when you post. Every video ends with: ${f.ctaLine}`,
      stats: [{ value: list.length, label: 'videos' }, { value: `${Math.round(seconds / 60) || 1} min`, label: 'of finished video' }, { value: f.keyword, label: 'comment keyword' }],
      body,
    });
    const prompter = list.map((s, i) => `VIDEO ${i + 1}: ${s.title}\n\n${s.silent ? s.beats.map((b) => `On screen: ${b.onScreen}`).join('\n') : s.spoken}\n`).join('\n----------\n\n');
    const captions = list.map((s, i) => `VIDEO ${i + 1}: ${s.title}\n\n${s.caption}\n`).join('\n----------\n\n');
    const base = f.fileBase;
    const saved = [
      await save.saveFile(ctx, save.fileName(base, 'shoot sheet', '.html'), html),
      await save.saveFile(ctx, save.fileName(base, 'teleprompter', '.txt'), prompter),
      await save.saveFile(ctx, save.fileName(base, 'captions', '.txt'), captions),
    ];
    return { files: saved, count: list.length, seconds };
  },
  view(out) {
    return views.blocks(views.metric('Videos ready to film', out.count, `About ${Math.max(1, Math.round(out.seconds / 60))} minutes of finished video`), out.files.map((a, i) => views.file(a, ['Printable shoot sheet', 'Teleprompter text', 'Captions to paste'][i])));
  },
};

module.exports = { writeScript, shootSheet };
