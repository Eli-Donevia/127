// The upload plan: your next uploads on the days you pick (3, 5 or 7 a week) at a time you can keep,
// as a calendar file and a tracker, with what YouTube and TikTok ask before they pay, stated as
// their help pages say it and dated. Titles come from your list, your last batch of scripts or the
// next ideas in your niche. A repeat picks up the day after the last plan ends.

const { views, save, files, time, text, brain } = require('../../_kit');
const C = require('../lib/channel');

const PER_WEEK_LABEL = { 3: 'Monday, Wednesday and Friday', 5: 'Monday to Friday', 7: 'every day' };

module.exports = {
  name: 'faceless.plan_posts',
  title: 'Plan your uploads',
  description: 'Puts your next uploads on the days you pick at a time you can keep, as a calendar file and a tracker, with what YouTube and TikTok ask before they pay, as their help pages say it.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      titles: { type: 'string', title: 'Titles, one per line (optional)', maxLength: 4000 },
      perWeek: { type: 'integer', title: 'Uploads a week', enum: [3, 5, 7], default: 3 },
      time: { type: 'string', title: 'Time of day (24 hour, like 17:00)', maxLength: 5, default: '17:00' },
      start: { type: 'string', format: 'date', title: 'First upload day (optional)' },
      count: { type: 'integer', title: 'How many uploads', minimum: 5, maximum: 60, default: 30 },
      niche: { type: 'string', title: 'Niche', enum: C.NICHE_IDS },
      ideas: { type: 'array', title: 'Ideas (from Find video ideas)', items: { type: 'object' } },
    },
  },
  output: {
    type: 'object',
    properties: {
      plan: { type: 'array' },
      calendar: { type: ['object', 'null'] },
      sheet: { type: ['object', 'null'] },
      rules: { type: ['object', 'null'] },
      from: { type: 'string' },
      perWeek: { type: 'integer' },
      time: { type: 'string' },
      first: { type: 'string' },
      last: { type: 'string' },
      continued: { type: 'boolean' },
    },
    required: ['plan'],
  },
  async run(input, ctx) {
    const n = C.nicheFor(ctx, input.niche);
    const mem = brain.packMemory(ctx, 'faceless');
    const perWeek = [3, 5, 7].includes(Number(input.perWeek)) ? Number(input.perWeek) : 3;
    const at = /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(input.time || '').trim()) ? String(input.time).trim().padStart(5, '0') : '17:00';
    const count = Math.max(5, Math.min(60, Number(input.count) || 30));
    // What goes on each day: your titles, your last scripts, ideas passed in, or the next ideas.
    let titles = String(input.titles || '').split(/\r?\n/).map((t) => text.oneLine(t.replace(/^\s*\d+[.)]\s*/, ''))).filter(Boolean);
    let from = titles.length ? 'your list' : '';
    if (!titles.length && Array.isArray(input.ideas) && input.ideas.length) {
      titles = input.ideas.filter((x) => x && x.title).map((x) => x.title);
      from = 'your ideas';
    }
    if (!titles.length && mem.batch && Array.isArray(mem.batch.titles) && mem.batch.titles.length) {
      titles = mem.batch.titles;
      from = `your scripts from ${time.longDate(mem.batch.date)}`;
    }
    if (!titles.length) {
      titles = C.ideas(n, n.topics, { count, made: C.madeIn(ctx, n.id) }).map((x) => x.title);
      from = `the next ideas in ${n.label}`;
    }
    // Start: the day you picked, else the day after the last plan, else next Monday.
    const today = time.today(ctx);
    const through = mem.planned && /^\d{4}-\d{2}-\d{2}$/.test(mem.planned.through) && mem.planned.through >= today ? mem.planned.through : null;
    const days = C.uploadDays(ctx, { start: input.start, perWeek, count: Math.min(count, titles.length), after: input.start ? null : through });
    const plan = days.map((date, i) => ({ n: i + 1, date, day: time.WEEKDAYS[time.weekdayOf(date)], time: at, title: titles[i % titles.length] }));
    const tz = time.tzOf(ctx);
    const first = plan[0].date;
    const last = plan[plan.length - 1].date;
    const calendar = await save.saveFile(
      ctx,
      save.fileName('uploads', first, 'to', last, '.ics'),
      files.ics(
        plan.map((p) => ({ uid: `faceless-${p.date}-${p.n}@127group.io`, title: `Post: ${p.title}`, date: p.date, time: p.time, minutes: 30, tz, description: 'Post it on YouTube Shorts and TikTok, then tick it off in your tracker. Seven days later, write down its views.' })),
        { name: 'Upload plan', now: time.nowMs(ctx) },
      ),
    );
    const sheet = await save.saveFile(
      ctx,
      save.fileName('upload tracker', first, '.csv'),
      files.csv(plan, [
        { key: 'n', label: '#' },
        { key: 'date', label: 'Date' },
        { key: 'day', label: 'Day' },
        { key: 'time', label: 'Time' },
        { key: 'title', label: 'Title' },
        { key: 'yt', label: 'Posted on YouTube' },
        { key: 'tt', label: 'Posted on TikTok' },
        { key: 'views7', label: 'Views after 7 days' },
        { key: 'note', label: 'What worked' },
      ], { bom: true }),
    );
    const rules = await save.saveFile(ctx, save.fileName('program rules', today, '.txt'), C.requirementsText());
    await brain.remember(ctx, 'planned', { through: last, perWeek, time: at, count: plan.length });
    ctx.log(`${plan.length} uploads, ${PER_WEEK_LABEL[perWeek]} at ${at}, ${time.shortDate(first)} to ${time.shortDate(last)}, titles from ${from}`);
    return { plan, calendar, sheet, rules, from, perWeek, time: at, first, last, continued: !!through && !input.start };
  },
  view(out) {
    return views.blocks(
      views.metric('Uploads planned', out.plan.length, `${PER_WEEK_LABEL[out.perWeek]} at ${out.time}, ${time.shortDate(out.first)} to ${time.shortDate(out.last)}`),
      out.continued ? views.text('This plan starts the day after your last one ends.') : null,
      views.table(
        [
          { key: 'date', label: 'Day' },
          { key: 'title', label: 'Upload' },
        ],
        out.plan.map((p) => ({ date: time.shortDate(p.date), title: p.title })),
        10,
      ),
      views.file(out.calendar, 'Upload days for your calendar (.ics)'),
      views.file(out.sheet, 'Upload tracker (.csv)'),
      views.text('What YouTube and TikTok ask before they pay, as their help pages said on ' + time.longDate(C.RULES.checked) + ':'),
      views.cards(C.RULES.programs.map((p) => ({ title: p.name, body: p.short, href: p.url }))),
      views.text("Don't count on ad money for months. Post them all, write down the views after 7 days, and make more of what people watched."),
      views.file(out.rules, 'Program rules with links (.txt)'),
    );
  },
};
