// shop.drop_plan: a day by day plan for a product drop, counted back from the drop date: what to
// make, set up, post and send each day, the Shopify steps to make the product go live on its own
// (verified), six post captions, and one calendar file with every task and email send.

const { text, files, save, views, brain, time, money } = require('../../_kit');
const H = require('../lib/html');
const L = require('../lib/launch');
const { brandColors } = require('../lib/brand');

const TAGS = { make: 'Make', store: 'Store', post: 'Post', email: 'Email', live: 'Drop' };

function pageHtml({ f, tasks, posts, colors, today, compressed }) {
  const t = H.theme(colors.primary);
  const extra = `
.day{display:grid;grid-template-columns:150px 1fr;gap:22px;padding:22px 0;border-top:1px solid var(--line)}
.day:first-child{border-top:0}
.day .d{font-weight:800;font-size:20px;letter-spacing:-.01em;line-height:1.2}
.day .w{color:var(--muted);font-size:14px;margin-top:4px}
.day.drop .d{color:var(--p)}
.day ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.day li{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.day li b{display:block;margin-bottom:2px}
.day li span.h{color:var(--muted);font-size:15px}
.tg{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:6px;margin-right:8px;vertical-align:2px;background:var(--soft);color:var(--soft-t)}
.tg.live{background:var(--p);color:var(--on-p)}
.cap{white-space:normal;font-size:16px}
.src{font-size:14px;color:var(--muted);margin-top:14px}
@media (max-width:760px){.day{grid-template-columns:1fr;gap:10px}}`;
  const days = [];
  for (const x of tasks) {
    const last = days[days.length - 1];
    if (last && last.date === x.date) last.items.push(x);
    else days.push({ date: x.date, items: [x] });
  }
  const dayLabel = (d) => {
    const n = L.daysBetween(f.date, d);
    if (n === 0) return 'Drop day';
    if (d === today) return 'Today';
    return n < 0 ? `${-n} ${n === -1 ? 'day' : 'days'} before` : `${n} ${n === 1 ? 'day' : 'days'} after`;
  };
  const body = [
    H.hero({
      eyebrow: 'Drop plan',
      heading: `${f.short} goes live ${L.dayName(f.date)}`,
      lead: `${L.when(f.date, f.time)}. What to make, set up, post and send each day, and how to make the product go live on its own.`,
      meta: [{ value: L.daysBetween(today, f.date), label: 'days to go' }, { value: tasks.length, label: 'tasks' }, f.quantity ? { value: f.quantity, label: 'in this batch' } : '', f.price ? { value: money.usd(f.price), label: 'price' } : ''],
    }),
    compressed ? H.block({ kicker: 'Short on time', title: 'A few tasks start today', body: `<div class="note">${H.esc(`Your drop is ${text.plural(L.daysBetween(today, f.date), 'day')} away, so ${text.plural(compressed, 'task')} that would come earlier ${compressed === 1 ? 'starts' : 'start'} today. Do the photos and the product page first: everything else hangs on them.`)}</div>` }) : '',
    H.block({
      kicker: 'Set it once',
      title: 'Make it go live on its own',
      sub: `Shopify can publish the product at ${f.time ? L.clock(f.time) : 'the time you pick'} on ${L.when(f.date)}, even if you're packing orders.`,
      body: `${H.steps(L.SCHEDULE_STEPS)}<p class="src">From Shopify's Help Center page on future publishing: ${H.esc(L.SCHEDULE_SOURCE)}</p>`,
    }),
    H.block({
      kicker: 'Day by day',
      title: 'The plan',
      body: days
        .map(
          (d) => `<div class="day${d.date === f.date ? ' drop' : ''}"><div><div class="d">${H.esc(time.shortDate(d.date))}</div><div class="w">${H.esc(dayLabel(d.date))}</div></div><ul>${d.items
            .map((x) => `<li><b><span class="tg${x.tag === 'live' ? ' live' : ''}">${H.esc(TAGS[x.tag] || x.tag)}</span>${H.esc(x.title)}${x.time ? `, ${H.esc(L.clock(x.time))}` : ''}</b><span class="h">${H.esc(x.how)}</span></li>`)
            .join('')}</ul></div>`
        )
        .join(''),
    }),
    H.block({
      kicker: 'Posts',
      title: 'Six captions',
      sub: 'Pair each with a photo or clip from your shoot. Change any word that does not sound like you.',
      body: H.cards(posts.map((p) => ({ kicker: `${p.n}. ${time.shortDate(p.date)}`, title: p.type, html: `<p class="cap">${H.esc(p.caption)}</p>` }))),
    }),
  ].join('\n');
  return files.htmlDoc({
    title: `Drop plan for ${f.short}`,
    description: `A day by day plan for the ${f.short} drop on ${L.when(f.date, f.time)}.`,
    css: H.baseCss(t) + extra,
    body: `${body}\n<footer class="foot"><div class="wrap">Built from what you typed. Scheduling steps checked on Shopify's Help Center on ${time.longDate('2026-10-19')}. Made ${time.longDate(today)}.</div></footer>`,
  });
}

module.exports = {
  name: 'shop.drop_plan',
  title: 'Plan a product drop',
  description: 'Plans a product drop day by day, counted back from the drop date: photos, product page, Shopify scheduling (verified steps), posts with captions, email sends and the first week after, with a calendar file of every task.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      product: { type: 'string', maxLength: 120 },
      date: { type: 'string', format: 'date' },
      time: { type: 'string', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$', maxLength: 5, default: '10:00' },
      price: { type: 'number', minimum: 0, maximum: 100000 },
      quantity: { type: 'integer', minimum: 1, maximum: 100000 },
      why: { type: 'string', format: 'textarea', maxLength: 900 },
      details: { type: 'string', format: 'textarea', maxLength: 900 },
      link: { type: 'string', maxLength: 300 },
    },
    required: ['product'],
  },
  output: {
    type: 'object',
    properties: {
      date: { type: 'string' },
      time: { type: 'string' },
      tasks: { type: 'array' },
      posts: { type: 'array' },
      notes: { type: 'array' },
      page: { type: 'object' },
      calendar: { type: 'object' },
    },
    required: ['date', 'tasks', 'page', 'calendar'],
  },

  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const f = L.factsOf({ ...input, time: L.isTime(input.time) ? input.time : '10:00', mode: 'drop' }, br, ctx, { defaultDays: 14 });
    const list = L.emails(f);
    const tasks = L.dropTasks(f, list);
    const posts = L.dropPosts(f);
    const compressed = tasks.filter((x) => x.moved).length;
    const colors = brandColors(ctx, input);
    const base = text.slug(`${f.short}-drop-plan`, 60) || 'drop-plan';
    const page = await save.saveFile(ctx, `${base}.html`, pageHtml({ f, tasks, posts, colors, today: f.today, compressed }), 'text/html');
    const tz = time.tzOf(ctx);
    const events = tasks.map((x, i) => ({
      uid: `${text.hash(`${f.name}:${f.product}:${x.title}`)}-${i}@127group.io`,
      title: `${x.tag === 'email' ? '' : 'Drop: '}${x.title}`,
      description: x.how,
      date: x.date,
      ...(x.time ? { time: x.time, minutes: x.tag === 'live' ? 60 : 15 } : {}),
      tz,
    }));
    const calendar = await save.saveFile(ctx, `${base}.ics`, files.ics(events, { name: `${f.short} drop`, now: time.nowMs(ctx) }), 'text/calendar');
    const notes = [...f.notes];
    if (compressed) notes.push(`The drop is ${text.plural(L.daysBetween(f.today, f.date), 'day')} away, so ${text.plural(compressed, 'early task')} ${compressed === 1 ? 'starts' : 'start'} today.`);
    ctx.log(`Planned ${text.plural(tasks.length, 'task')} for the drop on ${f.date}.`);
    return {
      date: f.date,
      time: f.time,
      tasks: tasks.map((x) => ({ date: x.date, when: x.when, title: x.title, how: x.how, tag: x.tag, ...(x.time ? { time: x.time } : {}) })),
      posts: posts.map((p) => ({ n: p.n, date: p.date, type: p.type, caption: p.caption })),
      notes,
      page,
      calendar,
    };
  },

  view(out) {
    const next = out.tasks.slice(0, 6);
    return views.blocks(
      views.metric('Drop day', L.when(out.date, out.time), `${text.plural(out.tasks.length, 'task')} from today to a week after`),
      (out.notes || []).map((n) => views.text(n)),
      views.file(out.page, 'The day by day plan, the Shopify scheduling steps and six captions'),
      views.file(out.calendar, 'Every task and email send for your calendar'),
      views.table(
        [
          { key: 'day', label: 'Day' },
          { key: 'title', label: 'First up' },
        ],
        next.map((x) => ({ day: time.shortDate(x.date), title: x.title }))
      )
    );
  },
};
