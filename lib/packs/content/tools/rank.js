// Rank the member's own posts from numbers they export or paste from their own accounts. The only
// input is their file or their paste: nothing is fetched, looked up or scraped from any app or
// profile. Saves a printable ranking with what to do more of, less of and next, and the same posts
// with their scores as a CSV. Both files are dated, so a run next month sits beside this one.

const fs = require('fs');
const path = require('path');
const { views, save, files, text, brain, time } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const R = require('../lib/rank');
const { page, esc } = require('../lib/page');
const { FACT_INPUTS } = require('./hooks');
const LIM = require('../data/platforms.json');

const SAMPLE = path.join(__dirname, '..', 'sample', 'posts.csv');
const MAX_BYTES = 5 * 1024 * 1024;
const fmtN = (n) => (n == null ? '' : Math.round(n).toLocaleString('en-US'));
const hhmm = (p) => (p.hour == null ? '' : `${p.hour % 12 || 12}:${String(p.minute || 0).padStart(2, '0')} ${p.hour < 12 ? 'am' : 'pm'}`);

// A Library file to text: UTF-8 or UTF-16 (some exports), never a spreadsheet or a ZIP.
function decode(buf) {
  if (buf[0] === 0x50 && buf[1] === 0x4b) throw new Error('That looks like an Excel or ZIP file. Open it, save it as CSV, and add the CSV instead. Or copy the rows and paste them.');
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const sw = Buffer.from(buf.slice(2));
    sw.swap16();
    return sw.toString('utf16le');
  }
  return buf.toString('utf8');
}

async function sourceOf(input, ctx) {
  if (input.file) {
    const a = await ctx.asset(input.file);
    if (a.bytes > MAX_BYTES) throw new Error('That file is over 5 MB. Export fewer months at a time, or paste the rows you want ranked.');
    return { raw: decode(fs.readFileSync(a.path)), kind: 'file', name: a.name || 'your file' };
  }
  if (String(input.rows || '').trim()) return { raw: String(input.rows), kind: 'paste', name: 'your pasted rows' };
  return { raw: fs.readFileSync(SAMPLE, 'utf8'), kind: 'sample', name: 'sample posts' };
}

const KIND_SHORT = { teach: 'Teach', myths: 'Myths', proof: 'Proof', bts: 'Behind the scenes', offer: 'Ask' };

function compact(p) {
  return {
    rank: p.rank,
    score: p.score,
    date: p.date,
    day: p.date ? time.shortDate(p.date) : '',
    time: hhmm(p),
    format: p.formatLabel || '',
    kind: p.kind ? KIND_SHORT[p.kind] : '',
    hooks: p.hooks.map((k) => R.HOOKS.find((x) => x.key === k).label),
    post: p.caption ? text.clip(p.caption, 120) : '',
    views: p.seen,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    saves: p.saves,
    follows: p.follows,
    clicks: p.clicks,
    why: p.why,
    link: p.link || '',
  };
}

const CSS = `.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.grid3 .card{margin:0}
.card ul.checks li{font-size:15px}.posts{display:grid;gap:12px}
.post{display:grid;grid-template-columns:54px 1fr;gap:16px;align-items:start}
.rank{width:54px;height:54px;border-radius:16px;background:var(--p);color:var(--onp);font-weight:800;font-size:22px;display:flex;align-items:center;justify-content:center}
.post.low .rank{background:var(--tint);color:var(--ink)}
.post h3{font-size:18px;margin:6px 0 6px}.nums{margin:0 0 4px;font-size:14px}
.bar{height:8px;min-width:80px;background:var(--tint);border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:var(--p);border-radius:99px}
tr.sub td{background:var(--surface);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
td.n,th.n{text-align:right;white-space:nowrap}td.d{white-space:nowrap}.small{font-size:13px}
@media (max-width:640px){td.p{min-width:190px}}
ul.plain{margin:0;padding-left:20px}ul.plain li{padding:4px 0}
@media print{.post,.grid3 .card{break-inside:avoid}}`;

function numsLine(c, has, base) {
  const unit = base === 'reach' ? 'people reached' : base === 'impressions' ? 'impressions' : 'views';
  const parts = [];
  if (c.views != null) parts.push(`${fmtN(c.views)} ${unit}`);
  for (const [k, one] of [['likes', 'like'], ['comments', 'comment'], ['shares', 'share'], ['saves', 'save'], ['follows', 'follow'], ['clicks', 'click']]) {
    if (has[k] && c[k] != null) parts.push(`${fmtN(c[k])} ${c[k] === 1 ? one : `${one}s`}`);
  }
  return parts.join(', ');
}

function postCard(c, has, base, low) {
  const tags = [`<span class="tag${low ? '' : ' ask'}">Score ${c.score}</span>`, c.format && `<span class="tag">${esc(c.format)}</span>`, c.kind && `<span class="tag">${esc(c.kind)}</span>`, c.day && `<span class="tag">${esc(c.day)}${c.time ? `, ${esc(c.time)}` : ''}</span>`].filter(Boolean).join('');
  const title = c.post ? `"${esc(c.post)}"` : esc(c.day ? `Your post from ${c.day}` : `Row ${c.rank}`);
  return `<div class="card post${low ? ' low' : ''}"><div class="rank">${c.rank}</div><div><div class="meta">${tags}</div><h3>${title}</h3><p class="nums">${esc(numsLine(c, has, base))}</p><p class="muted small">${esc(c.why)}.</p></div></div>`;
}

function groupsTable(groups, max) {
  const dims = [...new Set(groups.map((g) => g.title))];
  const rows = dims
    .map((d) => {
      const gs = groups.filter((g) => g.title === d).sort((a, b) => b.score - a.score);
      return `<tr class="sub"><td colspan="4">${esc(d)}</td></tr>${gs.map((g) => `<tr><td>${esc(g.label)}</td><td class="n">${g.n}</td><td class="n"><b>${g.score}</b></td><td style="width:40%"><div class="bar"><i style="width:${Math.max(3, Math.round((100 * Math.min(g.score, max)) / max))}%"></i></div></td></tr>`).join('')}`;
    })
    .join('');
  return `<table><thead><tr><th>Group</th><th class="n">Posts</th><th class="n">Typical score</th><th>Against your best group</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function allTable(list, has, base) {
  const cols = [
    { key: 'rank', label: '#', n: true },
    { key: 'score', label: 'Score', n: true },
    { key: 'day', label: 'Date' },
    { key: 'post', label: 'Post' },
    { key: 'format', label: 'Format' },
    { key: 'kind', label: 'Kind' },
    { key: 'views', label: base === 'reach' ? 'Reach' : base === 'impressions' ? 'Impr.' : 'Views', n: true, show: !!base },
    ...['likes', 'comments', 'shares', 'saves', 'follows', 'clicks'].map((k) => ({ key: k, label: R.LABEL[k], n: true, show: has[k] })),
  ].filter((c) => c.show !== false && (c.key !== 'format' || has.type) && (c.key !== 'post' || has.caption) && (c.key !== 'kind' || has.caption) && (c.key !== 'day' || has.date));
  const cell = (c, r) => {
    const v = r[c.key];
    if (c.key === 'post') return r.link ? `<a href="${esc(r.link)}">${esc(v || 'Open')}</a>` : esc(v);
    return esc(c.n && typeof v === 'number' ? fmtN(v) : v == null ? '' : v);
  };
  const cls = (c) => (c.n ? ' class="n"' : c.key === 'day' ? ' class="d"' : c.key === 'post' ? ' class="p"' : '');
  return `<table class="small"><thead><tr>${cols.map((c) => `<th${cls(c)}>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${list.map((r) => `<tr>${cols.map((c) => `<td${cls(c)}>${cell(c, r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

module.exports = {
  name: 'content.rank_posts',
  title: 'Rank your posts',
  description: 'Ranks your own posts from the numbers you export or paste (views, likes, comments, shares, saves, follows), where 100 is your typical post. Groups them by format, kind of post, hook, day and time, and says what to do more of, less of and next. Nothing is looked up or collected from any app: only your numbers are used.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'asset', accept: '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain', title: 'Your post stats (CSV)', description: 'Exported from your own account\'s insights or analytics, or a sheet saved as CSV. One row per post.' },
      rows: { type: 'string', format: 'textarea', title: 'Or paste your posts', description: 'Copy the rows from a sheet with the header row on top, like: Date, Caption, Type, Views, Likes, Comments, Shares, Saves', maxLength: 200000 },
      keyword: FACT_INPUTS.keyword,
      area: FACT_INPUTS.area,
    },
  },
  output: {
    type: 'object',
    properties: {
      count: { type: 'integer' },
      from: { type: 'string' },
      to: { type: 'string' },
      base: { type: 'string' },
      typicalViews: { type: 'integer' },
      top: { type: 'array' },
      bottom: { type: 'array' },
      more: { type: 'array' },
      less: { type: 'array' },
      next: { type: 'array' },
      groups: { type: 'array' },
      caution: { type: ['string', 'null'] },
      columns: { type: 'object' },
      dropped: { type: 'integer' },
      source: { type: 'string' },
      page: { type: 'object' },
      csv: { type: 'object' },
      sample: { type: 'boolean' },
    },
    required: ['count', 'top', 'page', 'csv'],
  },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const src = await sourceOf(input, ctx);
    const read = R.readPosts(src.raw, f);
    if (read.error) throw new Error(read.error);
    const r = R.rankPosts(read, f);
    const has = read.has;
    const list = r.posts.map((p) => compact(p));
    const top = list.slice(0, Math.min(5, list.length));
    const bottom = list.length >= 8 ? list.slice(-3).reverse() : [];
    const today = time.today(ctx);
    const base = f.name || 'your';
    const sample = src.kind === 'sample';

    // The CSV: every post with its score, in rank order.
    const csvCols = [
      { key: 'rank', label: 'Rank' }, { key: 'score', label: 'Score (100 is typical)' }, { key: 'date', label: 'Date' }, { key: 'time', label: 'Time' },
      { key: 'format', label: 'Format' }, { key: 'kind', label: 'Kind of post' }, { key: 'hookText', label: 'Hook style' }, { key: 'post', label: 'Post' },
      ...(r.base ? [{ key: 'views', label: R.LABEL[r.base] }] : []),
      ...['likes', 'comments', 'shares', 'saves', 'follows', 'clicks'].filter((k) => has[k]).map((k) => ({ key: k, label: R.LABEL[k] })),
      { key: 'why', label: 'Why it ranked here' },
      ...(has.link ? [{ key: 'link', label: 'Link' }] : []),
    ];
    const full = new Map(r.posts.map((p) => [p.rank, p.caption ? text.clip(p.caption, 500) : '']));
    const csv = await save.saveFile(ctx, save.fileName(base, 'ranked posts', today, '.csv'), files.csv(list.map((c) => ({ ...c, post: full.get(c.rank), hookText: c.hooks.join(', ') })), csvCols, { bom: true }));

    // The page.
    const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
    const range = !r.from ? '' : r.from === r.to ? time.longDate(r.from) : `${sameYear ? time.longDate(r.from).replace(/, \d{4}$/, '') : time.longDate(r.from)} to ${time.longDate(r.to)}`;
    const maxG = Math.max(100, ...r.groups.map((g) => g.score));
    const li = (xs) => (xs.length ? `<ul class="checks">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">Nothing stands out yet. Every group is close to your typical post.</p>');
    const weights = ['likes', 'comments', 'shares', 'saves', 'follows', 'clicks'].filter((k) => has[k]).map((k) => `a ${R.LABEL[k].toLowerCase().replace(/s$/, '')} ${R.WEIGHT[k]}`);
    const colsRead = Object.entries(read.columns).map(([k, h]) => (k === 'date' || k === 'caption' || k === 'type' || k === 'link' ? `${h} (${k === 'caption' ? 'the post' : k === 'type' ? 'format' : k})` : h));
    const body = `${sample ? '<section><div class="card"><p class="big">These are sample posts for a made-up business.</p><p class="muted">Add your own export or paste your posts to rank yours. Nothing else changes.</p></div></section>' : ''}
<section><h2>What to do next</h2><p class="lead">From ${esc(text.plural(r.count, 'post'))}. 100 is your typical post; 200 did twice as well.</p><div class="grid3">
<div class="card"><span class="tag ask">Do more</span>${li(r.more.map((g) => g.text))}</div>
<div class="card"><span class="tag">Do less</span>${li(r.less.map((g) => g.text))}</div>
<div class="card"><span class="tag">Try next</span>${li(r.next)}</div></div>${r.caution ? `<p class="muted">${esc(r.caution)}</p>` : ''}</section>
<section><h2>Your top ${top.length}</h2><p class="lead">What these did that the rest didn't.</p><div class="posts">${top.map((c) => postCard(c, has, r.base, false)).join('')}</div></section>
${bottom.length ? `<section><h2>Your lowest 3</h2><p class="lead">The ones to learn from. Check the first line and the first second: that is usually where a post loses people.</p><div class="posts">${bottom.map((c) => postCard(c, has, r.base, true)).join('')}</div></section>` : ''}
${r.groups.length ? `<section class="pb"><h2>By group</h2><p class="lead">Only groups with 2 or more posts. A post can have more than one hook style.</p>${groupsTable(r.groups, maxG)}</section>` : ''}
<section><h2>Every post</h2>${allTable(list, has, r.base)}</section>
<section><h2>How the score works</h2><div class="card"><ul class="plain">
${r.base ? `<li>Half of the score is how many people saw the post, against your typical post's ${esc(fmtN(r.typicalViews))} ${r.base === 'reach' ? 'reached' : esc(r.base)}.</li>` : '<li>Your numbers have no views column, so the score is from what people did, against your typical post.</li>'}
${weights.length ? `<li>${r.base ? 'Half' : 'All'} of it is what people did${r.base ? ' per view' : ''}, in points: ${esc(text.list(weights))}. Saves, shares and follows count more because they show someone wants more.</li>` : ''}
${r.base && weights.length ? '<li>A post seen by very few people is pulled toward your usual rate, so luck can\'t put it on top.</li>' : ''}
<li>Groups need 2 or more posts. Asks are judged by their comments, since that is where keyword replies land, and never go on the do-less list.</li>
<li>Columns we read from ${esc(src.name)}: ${esc(colsRead.join(', '))}.${read.dropped ? ` We kept your newest 500 posts and left out ${esc(text.plural(read.dropped, 'older one'))}.` : ''}</li>
<li>Only the numbers you gave were used. Nothing was looked up or collected from any app.</li></ul></div></section>
<section><h2>Next month</h2><div class="card"><ol><li>Export the same way, or add the new rows to your sheet. Most apps' insights or analytics pages can export your posts. ${esc(LIM.exports.youtube)}</li><li>No export? A sheet works: one row per post with the date, the first line of the caption, the format and the views, likes, comments, shares and saves.</li><li>Run "Rank your posts" again and compare your top 5 with this page.</li></ol></div></section>`;
    const html = page(f, {
      title: 'Your posts, ranked',
      kicker: f.name || 'Your posts',
      sub: `${text.plural(r.count, 'post')}${range ? ` from ${range}` : ''}, ranked by how many people saw each one and what they did.`,
      stats: [
        { value: r.count, label: 'posts read' },
        ...(r.base ? [{ value: fmtN(r.typicalViews), label: `${r.base === 'reach' ? 'reached' : r.base} on a typical post` }] : []),
        { value: top[0] ? top[0].score : 0, label: 'top score (100 is typical)' },
        { value: r.more.length, label: r.more.length === 1 ? 'thing to do more of' : 'things to do more of' },
      ],
      body,
      css: CSS,
      foot: `${[f.name, f.where].filter(Boolean).join(', ')}. Made ${time.longDate(today)} from ${src.name}.`,
    });
    const pageFile = await save.saveFile(ctx, save.fileName(base, 'post ranking', today, '.html'), html);
    await brain.remember(ctx, 'ranking', { on: today, posts: r.count, from: r.from, to: r.to, more: r.more.map((g) => g.label), less: r.less.map((g) => g.label), top: top[0] ? top[0].post : '' });
    ctx.log(`Ranked ${text.plural(r.count, 'post')} from ${src.name}. Top score ${top[0] ? top[0].score : 0}.`);
    return {
      count: r.count,
      from: r.from,
      to: r.to,
      base: r.base,
      typicalViews: r.typicalViews,
      top,
      bottom,
      more: r.more.map((g) => ({ by: g.by, label: g.label, n: g.n, score: g.score, text: g.text })),
      less: r.less.map((g) => ({ by: g.by, label: g.label, n: g.n, score: g.score, text: g.text })),
      next: r.next,
      groups: r.groups.map((g) => ({ by: g.by, title: g.title, label: g.label, n: g.n, score: g.score })),
      caution: r.caution,
      columns: read.columns,
      dropped: read.dropped,
      source: src.kind,
      page: pageFile,
      csv,
      sample,
    };
  },
  view(out) {
    const t = out.top[0];
    return views.blocks(
      out.sample ? views.text('These are sample posts for a made-up business. Add your own export or paste your posts to rank yours.') : null,
      t ? views.metric('Top post', t.score, `${t.post ? `"${t.post}"` : t.day}${t.format ? `, ${t.format}` : ''}. 100 is your typical post.`) : null,
      views.cards([
        ...out.more.map((g) => ({ title: 'Do more', body: g.text, badge: String(g.score) })),
        ...out.less.map((g) => ({ title: 'Do less', body: g.text, badge: String(g.score) })),
        ...out.next.map((x) => ({ title: 'Try next', body: x })),
      ]),
      views.table([{ key: 'rank', label: '#', format: 'number' }, { key: 'score', label: 'Score', format: 'number' }, { key: 'post', label: 'Post' }, { key: 'format', label: 'Format' }, { key: 'views', label: out.base === 'reach' ? 'Reach' : 'Views', format: 'number' }], out.top, 5),
      views.file(out.page, 'Your ranking, groups and what to do next (printable)'),
      views.file(out.csv, 'Every post with its score (CSV for Sheets)'),
      out.caution ? views.text(out.caution) : null
    );
  },
};
