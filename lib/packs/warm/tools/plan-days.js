// 25 a day for 30 days: reach out to 25 people a day (or more, up to 100), split across people you
// know, new people and posts. Starts with people you know and shifts toward new people. Paid ads
// only once the member says they have a budget. A printable tracker, a sheet with formulas and a
// daily calendar reminder.

const { views, save, time, text } = require('../../_kit');
const pg = require('../lib/page');
const { Sheet } = require('../lib/sheet');
const { icsWithAlarms } = require('../lib/cal');
const { offerFacts } = require('../lib/facts');

const PHASES = [
  { from: 1, to: 10, name: 'People you know first', warm: 0.6, cold: 0.2, content: 0.2 },
  { from: 11, to: 20, name: 'Half and half', warm: 0.4, cold: 0.4, content: 0.2 },
  { from: 21, to: 30, name: 'Mostly new people', warm: 0.2, cold: 0.6, content: 0.2 },
];

function split(total, ph) {
  const content = Math.max(1, Math.round(total * ph.content));
  const warm = Math.round(total * ph.warm);
  return { warm, cold: total - warm - content, content };
}

function planOf({ perDay = 25, goal, start, adsPerDay = 0 }) {
  const base = Math.min(100, Math.max(5, Math.round(perDay)));
  const top = Math.min(100, Math.max(base, Math.round(goal || base)));
  const days = [];
  for (let d = 1; d <= 30; d++) {
    const ph = PHASES.find((p) => d >= p.from && d <= p.to);
    const step = Math.floor((d - 1) / 10);
    const total = Math.round(base + ((top - base) * step) / 2);
    const s = split(total, ph);
    days.push({ day: d, date: time.addDays(start, d - 1), phase: ph.name, total, ...s, ads: adsPerDay > 0 && d > 10 ? adsPerDay : 0 });
  }
  return days;
}

function trackerHtml(days, o, opts) {
  const rows = days.map((x) => `<tr><td>${x.day}</td><td>${pg.esc(time.shortDate ? time.shortDate(x.date) : x.date)}</td><td class="r">${x.warm}</td><td class="r">${x.cold}</td><td class="r">${x.content}</td><td class="r"><b>${x.total}</b></td><td><label class="check"><input type="checkbox" class="done"><span class="box"></span><span class="txt">Done</span></label></td></tr>`).join('');
  const extra = `body{counter-reset:done}.done:checked{counter-increment:done}.score::before{content:counter(done) " of 30 days done"}
.score{margin-top:18px;background:var(--deep);color:var(--on-deep);padding:14px 18px;border-radius:14px;font-weight:800;font-size:18px;text-align:center}
table.t td,table.t th{padding:6px 8px}table.t .check{border-bottom:0;padding:4px 0 4px 34px}table.t .check .box{left:4px;top:4px}`;
  const body = [
    pg.hero({ eyebrow: '25 a day', title: `Reach ${days[0].total} people a day for 30 days`, lede: 'Every day: message people you know, message new people, and post once. Tick the day when you hit the number. Miss a day? Just do today.', pills: [o.what, `Starts ${days[0].date}`] }),
    `<div style="margin-top:18px"></div>`,
    pg.grid([
      pg.card({ tag: 'People you know', title: 'Ask, or ask who they know', body: 'Friends, family, neighbors, old coworkers. Use your first 25 send sheet.' }),
      pg.card({ tag: 'New people', title: 'One honest message each', body: 'People who fit your buyer. Say who you are, what you do and one reason you picked them.' }),
      pg.card({ tag: 'Posts', title: 'One post counts as 5', body: 'Show your work or answer one question buyers ask. Reply to every comment.' }),
      pg.card({ tag: 'Ads', title: opts.adsPerDay > 0 ? `Up to $${opts.adsPerDay} a day from day 11` : 'Not yet', body: opts.adsPerDay > 0 ? 'Only on a post that already got buyers talking. Stop if it does not bring messages.' : 'Ads come after one of your posts brings in a buyer on its own.' }),
    ], 2),
    pg.section('Your 30 days', `<table class="t"><thead><tr><th>Day</th><th>Date</th><th class="r">Known</th><th class="r">New</th><th class="r">Posts</th><th class="r">Total</th><th></th></tr></thead><tbody>${rows}</tbody></table><div class="score"></div>`),
    pg.foot('You send every message yourself. Count reach-outs, not replies.', 'Made with 127'),
  ].join('');
  return pg.doc({ title: '25 a day tracker', pal: o.palette, body, extra });
}

function trackerCsv(days) {
  const sh = new Sheet();
  sh.add(['Day', 'Date', 'People you know (goal)', 'Done', 'New people (goal)', 'Done', 'Posts (goal, 1 post = 5)', 'Done', 'Total goal', 'Total done', 'Hit it?', 'Replies', 'Booked']);
  const first = 2;
  days.forEach((x) => sh.add((r) => [x.day, x.date, x.warm, '', x.cold, '', x.content, '', `=C${r}+E${r}+G${r}`, `=D${r}+F${r}+H${r}`, `=IF(J${r}="","",IF(J${r}>=I${r},"yes","not yet"))`, '', '']));
  const last = first + days.length - 1;
  sh.blank();
  const done = sh.add(['Reach-outs done', '', '', '', '', '', '', '', '', `=SUM(J${first}:J${last})`]);
  sh.add(['Days you hit it', '', '', '', '', '', '', '', '', `=COUNTIF(K${first}:K${last},"yes")`]);
  const rep = sh.add(['Replies', '', '', '', '', '', '', '', '', `=SUM(L${first}:L${last})`]);
  sh.add(['Booked', '', '', '', '', '', '', '', '', `=SUM(M${first}:M${last})`]);
  sh.add(['Replies per 100 reach-outs', '', '', '', '', '', '', '', '', `=IF(J${done}=0,"",ROUND(J${rep}/J${done}*100,1))`]);
  return sh.csv();
}

module.exports = {
  name: 'warm.plan_days',
  title: 'Plan 25 a day',
  description: 'Plans 30 days of reaching 25 people a day (up to 100), split across people you know, new people and posts, with a printable tracker, a sheet with formulas and a daily reminder.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      perDay: { type: 'integer', title: 'People a day to start', minimum: 5, maximum: 100, default: 25 },
      goal: { type: 'integer', title: 'Build up to (optional)', minimum: 5, maximum: 100 },
      start: { type: 'string', title: 'Start date (optional, YYYY-MM-DD)' },
      time: { type: 'string', title: 'Reminder time (HH:MM)', default: '09:00' },
      adsPerDay: { type: 'number', title: 'Ad budget per day (optional)', minimum: 0, maximum: 1000 },
    },
  },
  output: { type: 'object', properties: { days: { type: 'array' }, files: { type: 'array' }, perDay: { type: 'number' }, goal: { type: 'number' } }, required: ['days', 'files'] },
  async run(input, ctx) {
    const o = offerFacts(ctx, input);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(input.start || '') ? input.start : time.addDays(time.today(ctx), 1);
    const at = /^\d{1,2}:\d{2}$/.test(input.time || '') ? input.time.padStart(5, '0') : '09:00';
    const opts = { perDay: input.perDay || 25, goal: input.goal, start, adsPerDay: Number(input.adsPerDay) || 0 };
    const days = planOf(opts);
    const ev = days.map((x) => ({ date: x.date, time: at, minutes: 45, title: `25 a day: ${x.total} today`, description: `Day ${x.day}: ${x.warm} people you know, ${x.cold} new people, ${x.content === 5 ? '1 post' : `${x.content} in posts and comments`}. Tick it in your tracker.`, alarm: 5 }));
    const files = [
      await save.saveFile(ctx, '25-a-day-tracker.html', trackerHtml(days, o, opts)),
      await save.saveFile(ctx, '25-a-day-tracker.csv', trackerCsv(days)),
      await save.saveFile(ctx, '25-a-day-reminders.ics', icsWithAlarms(ev, { name: '25 a day', tz: o.timezone })),
    ];
    ctx.log(`Planned 30 days from ${start}, ${days[0].total} to ${days[29].total} a day`);
    return { days, files, perDay: days[0].total, goal: days[29].total };
  },
  view(out) {
    return views.blocks(
      views.metric('Each day', `${out.perDay} people`, out.goal > out.perDay ? `Building to ${out.goal} by day 21` : 'Raise it toward 100 when 25 feels easy'),
      views.table([{ key: 'day', label: 'Day' }, { key: 'date', label: 'Date' }, { key: 'warm', label: 'Known' }, { key: 'cold', label: 'New' }, { key: 'content', label: 'Posts' }, { key: 'total', label: 'Total' }], out.days, 30),
      out.files.map((f) => views.file(f)),
    );
  },
};
