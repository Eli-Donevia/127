// What's working this week: the member's top and bottom posts, ads and products for the last full
// week, each against their own usual over the 4 weeks before, with a plain reason drawn from the same
// files. Pure code. Its `findings` feed the next-week plan.

const { views, save, files } = require('../../_kit');
const { C, R, P, X, L, nameOf, wrap } = require('../lib/base');

const TARGET = { type: 'string', title: 'Your max cost per customer (optional)', maxLength: 20, description: 'The most you would pay in ads for one result (a sale, booking or sign-up), like "12". Left empty: the target on your Daily numbers scorecard.' };

module.exports = {
  name: 'cmo.whats_working',
  title: "See what's working",
  description: "For the member's last full week, from their own exports: the top and bottom posts, ads and products against their own usual over the 4 weeks before, each with a plain reason from the same files. Advice only.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 1,
  timeoutSec: 60,
  input: { type: 'object', properties: { files: C.FILES, target: TARGET } },
  output: {
    type: 'object',
    properties: {
      week: { type: 'string' },
      headline: { type: 'string' },
      posts: { type: 'object' },
      ads: { type: 'object' },
      products: { type: 'object' },
      findings: { type: 'array' },
      target: { type: ['object', 'null'] },
      html: { type: 'object' },
      csv: { type: 'object' },
      ...C.OUT_COMMON,
    },
    required: ['week', 'headline', 'posts', 'ads', 'products', 'findings', 'html', 'csv', 'sample'],
  },
  TARGET,
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    const out = analyse(ctx, d, input);
    const name = nameOf(ctx, d);
    const range = C.shortRange(out.span.from, out.span.to);
    const card = (x, good) => `<div class="card"><span class="tag ${good ? 'p' : ''}">${P.esc(x.area)}</span><h3>${P.esc(x.name)}</h3><p class="big">${P.esc(x.number)}</p><p class="muted">${P.esc(x.why)}</p></div>`;
    const top = out.findings.filter((f) => f.side === 'top');
    const bottom = out.findings.filter((f) => f.side === 'bottom');
    const body = wrap(d, `<section><h2>Working</h2><p class="lead">${P.esc(range)}, against your own usual over the 4 weeks before.</p>${top.length ? top.map((x) => card(x, true)).join('') : '<div class="card"><p>Nothing stood out above your usual this week.</p></div>'}</section>
<section><h2>Not working as well</h2>${bottom.length ? bottom.map((x) => card(x, false)).join('') : '<div class="card"><p>Nothing fell well below your usual this week.</p></div>'}</section>
${out.target ? `<section><div class="card small"><p>Ads are judged against ${P.esc(X.usd(out.target.value))} per result, ${P.esc(out.target.from)}. Results are what each ad platform counted.</p></div></section>` : ''}`, out.notes);
    const html = P.page(ctx, { title: `What's working, ${range}`, kicker: 'Marketing', sub: out.headline, stats: out.stats, body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'whats working', out.span.from, '.html'), html);
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'whats working', out.span.from, '.csv'), files.csv(out.findings, [{ key: 'side', label: 'Top or bottom' }, { key: 'area', label: 'Area' }, { key: 'name', label: 'Name' }, { key: 'number', label: 'Number' }, { key: 'why', label: 'Why' }], { bom: true }));
    ctx.log(out.headline);
    return { week: `${out.span.from} to ${out.span.to}`, headline: out.headline, posts: out.posts, ads: out.ads, products: out.products, findings: out.findings, target: out.target, html: htmlFile, csv: csvFile, sources: C.sources(d), notes: out.notes, sample: d.sample };
  },
  view(out) {
    const items = out.findings.map((f) => ({ title: f.name, subtitle: f.area, body: `${f.number}. ${f.why}`, badge: f.side === 'top' ? 'Working' : 'Watch' }));
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(out.headline),
      views.cards(items),
      views.file(out.html, "What's working (printable)"),
      views.file(out.csv, 'Findings (CSV)')
    );
  },
};

// Shared with the monthly review: the scored posts, ads and products for a span, as findings.
function analyse(ctx, d, input, span0) {
  const span = span0 || X.weekSpan(d.led);
  const notes = [...d.notes];
  const findings = [];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // Posts
  const ps = X.posts(d.records, span);
  const pat = X.patterns(ps.ref);
  const sorted = [...ps.now].sort((a, b) => b.score - a.score);
  const topPosts = sorted.filter((p) => p.vx >= 1.1 || sorted.length <= 2).slice(0, 3);
  const bottomPosts = sorted.length >= 4 ? sorted.slice(-2).reverse().filter((p) => p.vx < 0.9 && !topPosts.includes(p)) : [];
  const postRow = (p, top) => {
    const why = X.postReasons(p, pat, top);
    return { post: R.quote(p.caption, 70), where: R.SRC[p.src] || p.src, day: R.shortDay(p.date), format: X.FORMAT[p.format] || 'Post', kind: X.kindLabel(p.kind), views: X.r0(p.views), vsUsual: `${X.times(p.vx)} your usual`, number: `${X.r0(p.views).toLocaleString('en-US')} views, ${X.times(p.vx)} your usual`, why: `${cap(why.join('; '))}.` };
  };
  const posts = { top: topPosts.map((p) => postRow(p, true)), bottom: bottomPosts.map((p) => postRow(p, false)), count: ps.now.length };
  for (const p of posts.top) findings.push({ side: 'top', area: `${p.where} post`, name: p.post, number: p.number, why: p.why });
  for (const p of posts.bottom) findings.push({ side: 'bottom', area: `${p.where} post`, name: p.post, number: p.number, why: p.why });
  if (!d.led.cover.posts) notes.push('No post stats in these files. Add an Instagram or TikTok export to see your posts here.');
  else if (!ps.now.length) notes.push(`No posts between ${R.shortDay(span.from)} and ${R.shortDay(span.to)} in your files.`);

  // Ads
  const adsNow = X.ads(d.records, span.from, span.to);
  const adsRef = X.ads(d.records, span.baseFrom, span.to);
  const target = X.cprTarget(ctx, input.target, adsRef);
  const ctrs = adsNow.filter((a) => a.ctr != null && a.impressions >= 500).map((a) => a.ctr);
  const cvrs = adsNow.filter((a) => a.cvr != null && a.clicks >= 20).map((a) => a.cvr);
  const mCtr = X.median(ctrs);
  const mCvr = X.median(cvrs);
  const adWhy = (a, top) => {
    const out = [];
    if (mCtr && a.ctr != null && a.impressions >= 500 && ctrs.length >= 2) {
      if (top && a.ctr >= mCtr * 1.25) out.push(`click rate ${X.pct(a.ctr)} against ${X.pct(mCtr)} across your ads: the ad itself gets attention`);
      if (!top && a.ctr <= mCtr * 0.75) out.push(`click rate ${X.pct(a.ctr)} against ${X.pct(mCtr)} across your ads: people scroll past, so the picture or first line could use a change`);
    }
    if (!top && mCvr && a.cvr != null && a.clicks >= 20 && a.cvr <= mCvr * 0.6 && !(mCtr && a.ctr <= mCtr * 0.75)) out.push(`people click but few go on to a result (${X.pct(a.cvr)} of clicks against ${X.pct(mCvr)}): look at the page they land on`);
    if (a.roas != null && a.value > 0) out.push(`${X.usd(X.r0(a.value))} in purchases the platform counted for ${X.usd(X.r0(a.spend))} spent`);
    if (!out.length) out.push(top ? 'cheaper per result than your target with a usual click rate, so the offer is what works' : 'a usual click rate but dear per result, so the offer is what to change');
    return out.slice(0, 3);
  };
  let topAds = [];
  let bottomAds = [];
  if (target) {
    topAds = adsNow.filter((a) => a.results >= 2 && a.cpr <= target.value).sort((a, b) => a.cpr - b.cpr).slice(0, 2);
    bottomAds = adsNow.filter((a) => !topAds.includes(a) && ((a.cpr == null && a.spend >= target.value) || (a.cpr != null && a.cpr >= target.value * 1.3))).sort((a, b) => (b.cpr == null ? Infinity : b.cpr) - (a.cpr == null ? Infinity : a.cpr)).slice(0, 2);
  }
  const adRow = (a, top) => ({ ad: a.name, campaign: a.campaign, where: a.where, spend: X.usd(X.r0(a.spend)), results: X.r0(a.results), cpr: a.cpr == null ? 'no results' : X.usd(a.cpr), number: a.cpr == null ? `${X.usd(X.r0(a.spend))} spent, no results` : `${X.usd(a.cpr)} per result against ${X.usd(target.value)}, ${X.r0(a.results)} results`, why: `${cap(adWhy(a, top).join('; '))}.` });
  const ads = { top: topAds.map((a) => adRow(a, true)), bottom: bottomAds.map((a) => adRow(a, false)), count: adsNow.length };
  for (const a of ads.top) findings.push({ side: 'top', area: `${a.where} ad`, name: a.ad, number: a.number, why: a.why });
  for (const a of ads.bottom) findings.push({ side: 'bottom', area: `${a.where} ad`, name: a.ad, number: a.number, why: a.why });
  if (!d.led.cover.ads && !d.led.cover.adsSpread) notes.push('No ad reports in these files. Add a Meta Ads or Google Ads export to see your ads here.');
  else if (!target) notes.push('Not enough ad results yet to judge cost per result. Type your target to compare against it.');

  // Products
  const prods = X.products(d.records, span);
  const up = prods.filter((p) => p.units >= 3 && (p.ux == null || p.ux >= 1.15)).sort((a, b) => b.sales - a.sales).slice(0, 2);
  const best = prods[0] && !up.includes(prods[0]) && prods[0].units ? [prods[0]] : [];
  const topProducts = [...best, ...up].slice(0, 3);
  const down = prods.filter((p) => p.usual >= 3 && p.ux != null && p.ux <= 0.7 && !topProducts.includes(p)).sort((a, b) => a.ux - b.ux).slice(0, 2);
  const prodRow = (p, top) => {
    const why = X.productReasons(p, ps.now, adsNow, top);
    return { name: p.name, units: X.r0(p.units), sales: X.usd(X.r0(p.sales)), usual: p.usual, number: `${X.r0(p.units)} sold, ${X.usd(X.r0(p.sales))}${p.usual ? `, usual ${p.usual}` : ''}`, why: `${cap(why.join('; '))}.` };
  };
  const products = { top: topProducts.map((p) => prodRow(p, true)), bottom: down.map((p) => prodRow(p, false)), count: prods.length };
  for (const p of products.top) findings.push({ side: 'top', area: 'Product', name: p.name, number: p.number, why: p.why });
  for (const p of products.bottom) findings.push({ side: 'bottom', area: 'Product', name: p.name, number: p.number, why: p.why });
  if (!prods.length) notes.push('Product names come from a Shopify orders export. Square, Stripe and PayPal exports show sales but not which product.');

  const bits = [];
  if (posts.top[0]) bits.push(`best post ${posts.top[0].post} (${posts.top[0].vsUsual} views)`);
  if (ads.top[0]) bits.push(`best ad "${ads.top[0].ad}" (${ads.top[0].cpr} per result)`);
  if (products.top[0]) bits.push(`best seller ${products.top[0].name} (${products.top[0].units} sold)`);
  const headline = bits.length ? `${C.shortRange(span.from, span.to)}: ${bits.join(', ')}.` : `${C.shortRange(span.from, span.to)}: nothing stood out from your usual.`;
  const s = L.sum(d.led, span.from, span.to, { spread: true });
  const stats = [];
  if (d.led.cover.posts) stats.push({ value: String(ps.now.length), label: 'posts' }, { value: X.r0(s.views).toLocaleString('en-US'), label: 'post views' });
  if (adsNow.length) stats.push({ value: X.usd(X.r0(s.adSpend)), label: 'ad spend' });
  if (d.led.cover.money) stats.push({ value: X.usd(X.r0(s.sales)), label: 'sales' });
  return { span, posts, ads, products, findings, target, notes, headline, stats: stats.slice(0, 4) };
}

module.exports.analyse = analyse;
