// 30-day posting plan: post days spread over the week at the member's pace, each with a pillar (from
// their pillars: typed, remembered from "Find your niche", or five plain defaults), a post idea and a
// format, plus one email to their list each week. A CSV and a calendar file. Code only, no AI.

const { views, save, files, time, text } = require('../../_kit');
const K = require('../lib/creator');

const { plain } = text;

// Which weekdays get a post at each pace (0 = Sunday).
const DAYS = { 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
const GENERIC = ['One how-to about {niche}', 'Behind the scenes: how you do {niche}', 'A story from your own {niche} journey', 'Answer a question someone asked about {niche}', 'Something you use for {niche}, and why'];

module.exports = {
  name: 'creator.plan_month',
  title: 'Plan 30 days of posts',
  description: 'A 30-day plan at your pace: which day, which pillar, a post idea and a format, plus a weekly email to your list, as a CSV and a calendar file.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      niche: { type: 'string', maxLength: 80, title: 'What you post about (optional)', description: 'Leave empty to use what you saved in Find your niche' },
      per_week: { type: 'integer', minimum: 2, maximum: 7, default: 3, title: 'Posts a week', description: 'Pick a pace you can keep for a month. 3 is plenty to start.' },
      start: { type: 'string', format: 'date', title: 'Start day (optional)', description: 'Leave empty for tomorrow' },
      pillars: { type: 'string', format: 'textarea', maxLength: 800, title: 'Your pillars (optional)', description: 'One per line. Leave empty to use your saved pillars.' },
      platform: { type: 'string', enum: ['Instagram', 'TikTok', 'YouTube Shorts', 'LinkedIn', 'Several'], default: 'Instagram', title: 'Where you post most' },
      email_day: { type: 'string', enum: ['None', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], default: 'Thursday', title: 'Weekly email to your list' },
      time: { type: 'string', pattern: '^\\d{2}:\\d{2}$', default: '09:00', title: 'Time to post (24-hour)' },
    },
  },
  output: { type: 'object', required: ['days'], properties: { niche: { type: 'string' }, pillars_from: { type: 'string' }, days: { type: 'array' }, posts: { type: 'integer' }, emails: { type: 'integer' }, files: { type: 'array' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const today = time.today(ctx);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start || '')) && input.start >= today ? input.start : time.addDays(today, 1);
    const pace = Math.min(7, Math.max(2, Number(input.per_week) || 3));
    const { pillars, from } = K.pillarsOf(ctx, input, m.niche);
    const platform = input.platform || 'Instagram';
    const formatFor = (p, n) => {
      const list = platform === 'TikTok' || platform === 'YouTube Shorts' ? ['Short video'] : platform === 'LinkedIn' ? ['Text post', 'Carousel'] : p.formats || ['Reel', 'Carousel'];
      return list[n % list.length];
    };
    const emailDow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(input.email_day || 'Thursday');
    const used = new Map();
    const days = [];
    let post = 0;
    for (let i = 0; i < 30; i++) {
      const date = time.addDays(start, i);
      const dow = time.weekdayOf(date);
      if (DAYS[pace].includes(dow)) {
        const p = pillars[post % pillars.length];
        const n = used.get(p.name) || 0;
        used.set(p.name, n + 1);
        const ideas = Array.isArray(p.ideas) && p.ideas.length ? p.ideas : [`${p.what}`, ...GENERIC.map((g) => g.replace('{niche}', m.niche))];
        days.push({ date, day: time.shortDate(date), kind: 'Post', pillar: p.name, idea: plain(ideas[n % ideas.length]), format: formatFor(p, n) });
        post++;
      }
      if (emailDow >= 0 && dow === emailDow) days.push({ date, day: time.shortDate(date), kind: 'Email', pillar: 'Your list', idea: "This week's email: one useful thing, one thing you made, one question", format: 'Email' });
    }
    // A check-in at the end of each week: what worked, using their own numbers.
    for (let w = 1; w <= 4; w++) {
      const date = time.addDays(start, w * 7 - 1);
      days.push({ date, day: time.shortDate(date), kind: 'Check', pillar: 'Review', idea: 'Look at the week: which post got the most saves, shares and replies? Plan one more like it.', format: '10 minutes' });
    }
    days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === 'Post' ? -1 : 1));
    const cols = [
      { key: 'date', label: 'Date' },
      { key: 'kind', label: 'What' },
      { key: 'pillar', label: 'Pillar' },
      { key: 'idea', label: 'Idea' },
      { key: 'format', label: 'Format' },
      { key: 'done', label: 'Done' },
    ];
    const csv = await save.saveFile(ctx, save.fileName(m.niche, '30 day plan', start, '.csv'), files.csv(days.map((d) => ({ ...d, done: '' })), cols));
    const tz = time.tzOf(ctx);
    const at = /^\d{2}:\d{2}$/.test(String(input.time || '')) ? input.time : '09:00';
    const ics = await save.saveFile(ctx, save.fileName(m.niche, '30 day plan', start, '.ics'), files.ics(days.map((d, i) => ({ uid: `creator-plan-${start}-${i}@127group.io`, title: d.kind === 'Post' ? `Post (${d.pillar}): ${d.idea}` : d.kind === 'Email' ? 'Send your weekly email' : 'Weekly check-in', description: `${d.idea}\nFormat: ${d.format}`, date: d.date, time: at, minutes: d.kind === 'Post' ? 45 : 20, tz })), { name: '30-day posting plan', now: time.nowMs(ctx) }));
    return { niche: m.niche, pillars_from: from, days: days.map(({ day, kind, pillar, idea, format }) => ({ day, kind, pillar, idea, format })), posts: days.filter((d) => d.kind === 'Post').length, emails: days.filter((d) => d.kind === 'Email').length, files: [csv, ics] };
  },
  view(out) {
    const from = { typed: 'your pillars', remembered: 'the pillars you saved', default: 'five starter pillars (run Find your niche to make them yours)' }[out.pillars_from];
    return views.blocks(
      views.metric('Next 30 days', `${out.posts} posts`, `${out.emails} emails and 4 check-ins, from ${from}`),
      views.table([{ key: 'day', label: 'Day' }, { key: 'kind', label: 'What' }, { key: 'pillar', label: 'Pillar' }, { key: 'idea', label: 'Idea' }, { key: 'format', label: 'Format' }], out.days),
      views.text('Batch it: film or write 3 posts in one sitting, then post on the day. Missing a day is fine; pick up at the next one.'),
      views.file(out.files[0], 'Plan (CSV)'),
      views.file(out.files[1], 'Plan (calendar file)'),
    );
  },
};
