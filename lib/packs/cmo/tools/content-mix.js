// Content mix check: what the member posted over the last 4 weeks by kind (from caption words),
// format, weekday and time of day, how each did against their own usual, and a mix for the next 2
// weeks that leans toward what did best for them without dropping anything that worked. Pure code.

const { views, save, files } = require('../../_kit');
const { C, R, P, T, X, nameOf, wrap } = require('../lib/base');
const KINDS = require('../data/kinds.json');

module.exports = {
  name: 'cmo.content_mix',
  title: 'Check your content mix',
  description: "The member's posts over the last 4 weeks from their own Instagram, TikTok or post sheet exports, grouped by kind, format, weekday and time of day, each against their usual views, plus a mix for the next 2 weeks. Advice only.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 1,
  timeoutSec: 60,
  input: { type: 'object', properties: { files: C.FILES, perWeek: { type: 'integer', title: 'Posts a week you can keep up (optional)', minimum: 1, maximum: 21 } } },
  output: {
    type: 'object',
    properties: { span: { type: 'string' }, kinds: { type: 'array' }, formats: { type: 'array' }, days: { type: 'array' }, times: { type: 'array' }, next: { type: 'array' }, perWeek: { type: 'integer' }, headline: { type: 'string' }, tips: { type: 'array' }, html: { type: 'object' }, csv: { type: 'object' }, ...C.OUT_COMMON },
    required: ['span', 'kinds', 'formats', 'days', 'next', 'perWeek', 'headline', 'tips', 'html', 'csv', 'sample'],
  },
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    if (!d.led.cover.posts) throw new Error('The content mix reads post stats. Add an Instagram (Meta Business Suite) or TikTok export, or a sheet with one row per post.');
    const to = d.led.cover.posts.to;
    const from = T.addDays(to, -27);
    // Each post against the middle of the same 4 weeks on its platform, so kinds compare with each other.
    const span = { from, to, baseFrom: from, baseTo: to };
    const ps = X.posts(d.records, span);
    const posts = ps.now;
    if (posts.length < 3) throw new Error(`Only ${posts.length} post${posts.length === 1 ? '' : 's'} between ${R.shortDay(from)} and ${R.shortDay(to)}. The mix check needs at least 3.`);
    const group = (key, label) => {
      const g = new Map();
      for (const p of posts) {
        const k = p[key];
        if (k == null) continue;
        const x = g.get(k) || { key: k, posts: 0, vx: [], views: 0, eng: [] };
        x.posts += 1;
        x.vx.push(p.vx);
        x.eng.push(p.ex);
        x.views += p.views;
        g.set(k, x);
      }
      return [...g.values()].map((x) => ({ key: x.key, name: label(x.key), posts: x.posts, share: `${Math.round((x.posts / posts.length) * 100)}%`, vx: X.median(x.vx), vsUsual: `${X.times(X.median(x.vx))} your usual views`, engagement: `${X.times(X.median(x.eng) || 0)} usual`, views: X.r0(x.views) })).sort((a, b) => b.vx - a.vx);
    };
    const kinds = group('kind', X.kindLabel);
    const formats = group('format', (k) => X.FORMAT[k] || 'Post');
    const days = group('wd', (k) => X.WEEKDAY[k]);
    const times = group('slot', (k) => k.charAt(0).toUpperCase() + k.slice(1));
    const rate = posts.length / 4;
    const perWeek = Math.max(1, Math.min(21, input.perWeek || Math.max(3, Math.round(rate))));

    // Next 2 weeks: slots split by how each kind did (views against usual), every kind that did at
    // least 0.75x keeps a slot, no kind takes more than half, and missing kinds get one try.
    const slots = perWeek * 2;
    const tried = kinds.filter((k) => k.key !== 'other');
    const keep = tried.filter((k) => k.vx >= 0.75);
    const missing = KINDS.kinds.filter((k) => !tried.some((t) => t.key === k.id));
    const plan = new Map(keep.map((k) => [k.key, 1]));
    const tryOne = missing.slice(0, slots - plan.size >= 3 ? 1 : 0);
    for (const k of tryOne) plan.set(k.id, 1);
    let left = slots - [...plan.values()].reduce((a, b) => a + b, 0);
    const weights = keep.map((k) => ({ key: k.key, w: Math.min(k.vx, 3) }));
    const wsum = weights.reduce((a, b) => a + b.w, 0) || 1;
    const cap = Math.max(1, Math.floor(slots / 2));
    for (const w of weights.sort((a, b) => b.w - a.w)) {
      const add = Math.min(left, Math.max(0, Math.round((w.w / wsum) * (slots - plan.size)) ), cap - plan.get(w.key));
      plan.set(w.key, plan.get(w.key) + add);
      left -= add;
    }
    for (const w of weights) {
      while (left > 0 && plan.get(w.key) < cap) {
        plan.set(w.key, plan.get(w.key) + 1);
        left -= 1;
      }
    }
    if (left > 0 && !plan.size) plan.set('teach', left);
    const bestFormat = formats.find((f) => f.posts >= 2) || formats[0];
    const next = [...plan.entries()].filter(([, n]) => n > 0).map(([k, n]) => {
      const was = kinds.find((x) => x.key === k);
      const meta = KINDS.kinds.find((x) => x.id === k) || { idea: '' };
      return { kind: X.kindLabel(k), posts: n, was: was ? `${was.posts} in 4 weeks, ${was.vsUsual}` : 'none in 4 weeks: one to try', idea: meta.idea };
    }).sort((a, b) => b.posts - a.posts);

    const tips = [];
    const topKind = kinds.find((k) => k.key !== 'other' && k.posts >= 2);
    if (topKind && topKind.vx >= 1.2) tips.push(`${topKind.name} posts did best: ${topKind.vsUsual} over ${topKind.posts} posts.`);
    if (bestFormat && formats.length > 1 && bestFormat.vx >= 1.15) tips.push(`${bestFormat.name} is your strongest format right now (${bestFormat.vsUsual}). Use it for the posts that matter most.`);
    const bestDay = days.find((x) => x.posts >= 2);
    if (bestDay && bestDay.vx >= 1.2) tips.push(`${bestDay.name} posts got ${bestDay.vsUsual}. Put your most important post there.`);
    const bestTime = times.find((x) => x.posts >= 2);
    if (bestTime && times.length > 1 && bestTime.vx >= 1.15) tips.push(`${bestTime.name} posts did better (${bestTime.vsUsual}).`);
    const weak = kinds.filter((k) => k.key !== 'other' && k.posts >= 3 && k.vx < 0.75);
    for (const k of weak) tips.push(`${k.name} posts got ${k.vsUsual} over ${k.posts} posts. Fewer of those, or a new angle on them.`);
    if (rate < 2) tips.push(`You posted about ${rate.toFixed(1)} times a week. The plan below keeps to ${perWeek} a week; pick a number you can keep up.`);
    if (!tips.length) tips.push('Your kinds, formats and days are all close to your usual. Keep the mix and try one new kind.');
    const headline = `${posts.length} posts over ${C.shortRange(from, to)}${topKind ? `: ${topKind.name.toLowerCase()} did best (${topKind.vsUsual})` : ''}. Next 2 weeks: ${perWeek} a week.`;
    const notes = [...d.notes, 'Kinds are sorted from caption words, so a few posts may land in the wrong one. The CSV lists every post with its kind so you can check.'];
    const name = nameOf(ctx, d);
    const tbl = (rows, first) => P.table([{ key: 'name', label: first }, { key: 'posts', label: 'Posts', n: true }, { key: 'share', label: 'Share', n: true }, { key: 'vsUsual', label: 'Views', n: true, cls: (r) => (r.vx >= 1.2 ? 'good' : r.vx < 0.8 ? 'bad' : '') }], rows);
    const body = wrap(d, `<section><h2>What to keep in mind</h2>${tips.map((t) => `<div class="card"><p class="big">${P.esc(t)}</p></div>`).join('')}</section>
<section><h2>Next 2 weeks: ${slots} posts</h2>${P.table([{ key: 'kind', label: 'Kind' }, { key: 'posts', label: 'Posts', n: true }, { key: 'was', label: 'Last 4 weeks' }, { key: 'idea', label: 'Idea' }], next)}${bestFormat ? `<p class="muted small">Make most of them ${P.esc(bestFormat.name.toLowerCase())} posts${bestDay ? `, and put the one that matters most on a ${P.esc(bestDay.name)}` : ''}.</p>` : ''}</section>
<section><h2>By kind</h2>${tbl(kinds, 'Kind')}</section>
<section><h2>By format</h2>${tbl(formats, 'Format')}</section>
<section><h2>By weekday</h2>${tbl(days, 'Day')}</section>
${times.length ? `<section><h2>By time of day</h2>${tbl(times, 'Time')}</section>` : ''}`, notes);
    const html = P.page(ctx, { title: 'Your content mix', kicker: 'Marketing', sub: headline, stats: [{ value: String(posts.length), label: 'posts in 4 weeks' }, { value: String(kinds.length), label: 'kinds' }, { value: String(perWeek), label: 'a week, next 2 weeks' }], body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'content mix', to, '.html'), html);
    const csvRows = posts.sort((a, b) => (a.date < b.date ? -1 : 1)).map((p) => ({ date: p.date, where: R.SRC[p.src] || p.src, caption: String(p.caption || '').slice(0, 200), kind: X.kindLabel(p.kind), format: X.FORMAT[p.format] || 'Post', views: X.r0(p.views), vs: Math.round(p.vx * 100) / 100 }));
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'content mix', to, '.csv'), files.csv(csvRows, [{ key: 'date', label: 'Date' }, { key: 'where', label: 'Where' }, { key: 'caption', label: 'Caption' }, { key: 'kind', label: 'Kind' }, { key: 'format', label: 'Format' }, { key: 'views', label: 'Views' }, { key: 'vs', label: 'Times your usual' }], { bom: true }));
    ctx.log(headline);
    const strip = (rows) => rows.map(({ key, vx, ...r }) => r);
    return { span: `${from} to ${to}`, kinds: strip(kinds), formats: strip(formats), days: strip(days), times: strip(times), next, perWeek, headline, tips, html: htmlFile, csv: csvFile, sources: C.sources(d), notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(out.headline),
      views.cards(out.tips.map((t) => ({ body: t }))),
      views.table([{ key: 'kind', label: 'Next 2 weeks' }, { key: 'posts', label: 'Posts', format: 'number' }, { key: 'was', label: 'Last 4 weeks' }], out.next),
      views.table([{ key: 'name', label: 'Kind' }, { key: 'posts', label: 'Posts', format: 'number' }, { key: 'vsUsual', label: 'Views' }], out.kinds),
      views.file(out.html, 'Content mix (printable)'),
      views.file(out.csv, 'Every post with its kind (CSV)')
    );
  },
};
