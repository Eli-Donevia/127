// A posting plan for a week or a month, and the calendar files for it (CSV, ICS reminders, HTML).

const { text, views, save, files, time } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const { planPosts, clock } = require('../lib/plan');
const { page, esc } = require('../lib/page');
const { FACT_INPUTS } = require('./hooks');

const planPostsTool = {
  name: 'content.plan_posts',
  title: 'Plan your posts',
  description: 'Lays out a week or a month of posts: the day, time, format (Reel or carousel), pillar, hook and caption for each, with the rhythm give, give, give, ask so every fourth post asks for your keyword. Batch filming days and holidays included.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      hooks: { type: 'array', title: 'Hooks', description: 'From content.write_hooks' },
      days: { type: 'integer', minimum: 7, maximum: 31, default: 7 },
      perWeek: { type: 'integer', title: 'Posts a week', minimum: 1, maximum: 7, default: 5 },
      time: { type: 'string', title: 'Post time', description: '24-hour time, like 18:00', default: '18:00', maxLength: 5 },
      start: { type: 'string', title: 'First day (optional)', description: 'YYYY-MM-DD; default tomorrow', maxLength: 10 },
      ...FACT_INPUTS,
    },
    required: ['hooks'],
  },
  output: { type: 'object', properties: { posts: { type: 'array' }, filming: { type: 'array' }, reels: { type: 'array' }, carousel: { type: 'object' } }, required: ['posts'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const hooks = (input.hooks || []).filter((h) => h && h.hook);
    if (!hooks.length) throw new Error('Write hooks first, then plan.');
    const start = /^\d{4}-\d{2}-\d{2}$/.test(input.start || '') ? input.start : time.addDays(time.today(ctx), 1);
    const plan = planPosts(f, hooks, { start, days: input.days || 7, perWeek: input.perWeek || 5, at: input.time || '18:00' });
    ctx.log(`${plan.posts.length} posts from ${plan.start} to ${plan.end}, ${plan.asks} of them the ask`);
    return { ...plan, keyword: f.keyword, ctaLine: f.ctaLine };
  },
  view(out) {
    return [
      views.metric('Posts planned', out.posts.length, `${out.asks} ask for your keyword, the rest teach, show and prove`),
      views.table([{ key: 'day', label: 'Day' }, { key: 'format', label: 'Format' }, { key: 'pillarName', label: 'Pillar' }, { key: 'title', label: 'Post' }], out.posts, 12),
    ];
  },
};

const CSV_COLS = [
  { key: 'date', label: 'Date' }, { key: 'weekday', label: 'Day' }, { key: 'time', label: 'Time' }, { key: 'platform', label: 'Platform' }, { key: 'format', label: 'Format' },
  { key: 'pillarName', label: 'Pillar' }, { key: 'hook', label: 'Hook' }, { key: 'onScreen', label: 'On-screen text' }, { key: 'caption', label: 'Caption' },
  { key: 'cta', label: 'Call to action' }, { key: 'filmBy', label: 'Film by' }, { key: 'status', label: 'Status' }, { key: 'holiday', label: 'Notes' },
];

const makeCalendar = {
  name: 'content.make_calendar',
  title: 'Make the calendar',
  description: 'Saves the plan as a CSV for Google Sheets or Notion, calendar reminders (ICS) for every post and filming session, and a printable calendar page.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      posts: { type: 'array', title: 'Posts', description: 'The approved posts from content.plan_posts' },
      filming: { type: 'array' },
      holidays: { type: 'array' },
      area: FACT_INPUTS.area,
    },
    required: ['posts'],
  },
  output: { type: 'object', properties: { files: { type: 'array' }, posts: { type: 'integer' } }, required: ['files'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const posts = (input.posts || []).filter((p) => p && p.date);
    if (!posts.length) throw new Error('There are no posts in the plan yet.');
    const filming = input.filming || [];
    const tz = time.tzOf(ctx);
    const base = f.fileBase;
    const csv = files.csv(posts.map((p) => ({ ...p, status: 'Not filmed' })), CSV_COLS, { bom: true });
    const events = [
      ...posts.map((p) => ({ uid: `post-${p.date}-${p.n}@127group.io`, title: `Post: ${text.clip(p.title, 60)}`, description: `${p.format}, ${p.pillarName}\nHook: ${p.hook}\nOn screen: ${p.onScreen}\n\nCaption:\n${p.caption}`, date: p.date, time: p.time, minutes: 15, tz })),
      ...filming.map((x, i) => ({ uid: `film-${x.date}-${i}@127group.io`, title: `Film ${x.count} ${x.count === 1 ? 'video' : 'videos'}`, description: x.list.map((l, j) => `${j + 1}. ${l}`).join('\n'), date: x.date, time: '10:00', minutes: 60, tz })),
    ];
    const ics = files.ics(events, { name: base ? `${base} posts` : 'Your posts', now: time.nowMs(ctx) });
    const holidays = (input.holidays || []).filter((h) => !posts.some((p) => p.date === h.date));
    const byWeek = new Map();
    for (const p of posts) {
      const k = time.addDays(p.date, -((time.weekdayOf(p.date) + 6) % 7));
      if (!byWeek.has(k)) byWeek.set(k, []);
      byWeek.get(k).push(p);
    }
    const weeks = [...byWeek.values()];
    const body = weeks.map((list, wi) => {
      const films = filming.filter((x) => x.date >= time.addDays(list[0].date, -1) && x.date <= list[list.length - 1].date);
      return `<section${wi ? ' class="pb"' : ''}><h2>Week of ${esc(time.shortDate(list[0].date))}</h2><p class="lead">${films.map((x) => `Film day ${esc(x.day)}: ${x.count} ${x.count === 1 ? 'video' : 'videos'}.`).join(' ')}</p>${list.map((p) => `<div class="card"><div class="meta"><span class="tag">${esc(p.day)}, ${esc(clock(p.time))}</span><span class="tag">${esc(p.format)}</span><span class="tag${p.ask ? ' ask' : ''}">${esc(p.ask ? 'The ask' : p.pillarName)}</span></div><h3>${esc(p.hook)}</h3><p class="muted">On screen: ${esc(p.onScreen)}${p.holiday ? `. ${esc(p.holiday)}` : ''}</p><pre>${esc(p.caption)}</pre></div>`).join('')}</section>`;
    }).join('') + (holidays.length ? `<section><h2>Dates to know</h2>${holidays.map((h) => `<div class="card"><div class="meta"><span class="tag">${esc(time.shortDate(h.date))}</span></div><h3>${esc(h.name)}</h3><p class="muted">${esc(h.idea)}</p></div>`).join('')}</section>` : '');
    const html = page(f, {
      title: `Your posts, ${time.shortDate(posts[0].date).replace(/^\w+, /, '')} to ${time.shortDate(posts[posts.length - 1].date).replace(/^\w+, /, '')}`,
      kicker: 'Content calendar',
      sub: `Give, give, give, ask: three posts that help, then one clear ask. Film in batches on film days, then post at the same time each day.`,
      stats: [{ value: posts.length, label: 'posts' }, { value: posts.filter((p) => p.ask).length, label: 'ask for your keyword' }, { value: filming.length, label: 'film days' }],
      body,
    });
    const saved = [
      await save.saveFile(ctx, save.fileName(base, 'content calendar', '.csv'), csv),
      await save.saveFile(ctx, save.fileName(base, 'post reminders', '.ics'), ics),
      await save.saveFile(ctx, save.fileName(base, 'content calendar', '.html'), html),
    ];
    return { files: saved, posts: posts.length };
  },
  view(out) {
    return views.blocks(views.metric('Calendar files', out.files.length, `${out.posts} posts with reminders`), out.files.map((a, i) => views.file(a, ['Calendar CSV for Google Sheets or Notion', 'Reminders for your phone calendar (ICS)', 'Printable calendar'][i])));
  },
};

module.exports = { planPostsTool, makeCalendar };
