// shop.compare_stores: your store next to up to three others, from one quick read of each store's
// public product feed and pages. Where you lead, where they lead (with your fix), price position and
// the numbers side by side, as a page and a spreadsheet. Public pages only; nothing is sent.

const { text, files, save, views, time, money } = require('../../_kit');
const { readStore } = require('../lib/store');
const C = require('../lib/compare');
const H = require('../lib/html');
const { brandColors } = require('../lib/brand');

const MAX_OTHERS = 3;

function addresses(s) {
  return [...new Set(String(s || '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean))];
}

const FIXED = { sections: 'Make theme sections, in this pack, writes this in your words.' };

function priceChart(stores) {
  const top = Math.max(...stores.map((s) => s.priceMax || 0));
  if (!top) return '';
  const pct = (v) => Math.max(0, Math.min(100, (v / top) * 100)).toFixed(1);
  return `<div class="pchart">${stores
    .map((s, i) =>
      s.priceMin == null
        ? ''
        : `<div class="prow${i === 0 ? ' me' : ''}"><div class="pn">${H.esc(s.name)}</div><div class="pbar"><span class="rng" style="left:${pct(s.priceMin)}%;width:${Math.max(0.8, pct(s.priceMax) - pct(s.priceMin)).toFixed(1)}%"></span><span class="mid" style="left:${pct(s.priceMedian)}%" title="Middle price"></span></div><div class="pv">${H.esc(money.usd(s.priceMin))} to ${H.esc(money.usd(s.priceMax))}<br><b>${H.esc(money.usd(s.priceMedian))}</b> middle</div></div>`
    )
    .join('')}<div class="paxis"><span>$0</span><span>${H.esc(money.usd(top))}</span></div></div>`;
}

function pageHtml({ mine, others, skipped, table, lead, price, colors, today, sample }) {
  const t = H.theme(colors.primary);
  const all = [mine, ...others];
  const extra = `
.st.me{border:2px solid var(--p)}
.st .who{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--p);margin-bottom:6px}
.cmp th:nth-child(2),.cmp td:nth-child(2){background:var(--soft)}
.cmp td.best{font-weight:700}
.cmp td.best:after{content:" \\2605";color:var(--p)}
.cmp td .n{display:block;font-size:12.5px;color:var(--muted);font-weight:400}
.lead h3{margin-bottom:8px}
.lead .them{font-size:15px;margin:0 0 10px}
.lead .you{font-size:15px;margin:0 0 10px;padding-top:10px;border-top:1px solid var(--line)}
.lead .how{font-size:14.5px;color:var(--muted);margin:0}
.lead .tool{display:inline-block;margin-top:10px;font-size:13px;font-weight:600;background:var(--soft);color:var(--soft-t);padding:4px 10px;border-radius:8px}
.pchart{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px 26px 16px}
.prow{display:grid;grid-template-columns:170px 1fr 150px;gap:18px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
.prow:last-of-type{border-bottom:0}
.prow .pn{font-weight:600;font-size:15px}
.prow.me .pn{color:var(--p)}
.pbar{position:relative;height:16px;background:var(--surface);border-radius:8px}
.pbar .rng{position:absolute;top:0;height:16px;border-radius:8px;background:color-mix(in srgb,var(--muted) 35%,transparent)}
.prow.me .pbar .rng{background:color-mix(in srgb,var(--p) 45%,transparent)}
.pbar .mid{position:absolute;top:-4px;width:6px;height:24px;margin-left:-3px;border-radius:3px;background:var(--ink)}
.prow.me .pbar .mid{background:var(--p)}
.pv{font-size:13px;color:var(--muted);text-align:right;line-height:1.4}
.pv b{color:var(--ink)}
.paxis{display:flex;justify-content:space-between;margin:8px 168px 0 188px;font-size:12px;color:var(--muted)}
@media (max-width:760px){.prow{grid-template-columns:1fr;gap:6px}.pv{text-align:left}.paxis{margin:8px 0 0}}`;
  const body = [
    H.hero({
      eyebrow: 'Store comparison',
      heading: `How ${mine.name} compares`,
      lead: `Side by side with ${text.list(others.map((o) => o.name))}, from what each store shows shoppers on its public pages.`,
      meta: [{ value: mine.score, label: 'your score' }, { value: Math.max(...others.map((o) => o.score)), label: 'best of theirs' }, `Read ${time.longDate(today)}`],
    }),
    sample ? H.block({ kicker: 'Sample data', title: 'Practice stores', body: '<div class="note">These stores are made up for practice, so the numbers are too. Run it with real store addresses to compare real stores.</div>' }) : '',
    H.block({
      kicker: 'Scores',
      title: 'Out of 100',
      sub: 'The same audit for every store: photos, descriptions, reviews, signup, policies and more.',
      body: `<div class="stats">${all.map((s, i) => `<div class="stat st${i === 0 ? ' me' : ''}"><div class="who">${i === 0 ? 'You' : 'Them'}</div><div class="v">${s.score}</div><div class="l">${H.esc(s.name)}</div><div class="n">${H.esc(s.domain)}</div></div>`).join('')}</div>`,
    }),
    H.block({
      kicker: 'Where they lead',
      title: lead.behind.length ? `${text.plural(lead.behind.length, 'thing')} to catch up on` : 'Nothing: you match or beat them on every check',
      sub: lead.behind.length ? 'Biggest first. Each one says what they show and what to change on yours.' : '',
      body: lead.behind.length
        ? `<div class="cards">${lead.behind
            .slice(0, 8)
            .map((b) => `<div class="card lead"><p class="kicker">${H.esc(b.impact)} impact</p><h3>${H.esc(b.label)}</h3><p class="them"><b>${H.esc(text.list(b.stores))}</b>: ${H.esc(b.theirs || 'better on this check.')}</p>${b.mine ? `<p class="you"><b>You</b>: ${H.esc(b.mine)}</p>` : ''}<p class="how"><b>Fix</b>: ${H.esc(b.how)}</p>${b.fixedBy && FIXED[b.fixedBy] ? `<span class="tool">${H.esc(FIXED[b.fixedBy])}</span>` : ''}</div>`)
            .join('')}</div>`
        : '',
    }),
    H.block({
      kicker: 'Where you lead',
      title: lead.ahead.some((a) => a.all) ? `${text.plural(lead.ahead.filter((a) => a.all).length, 'thing')} you do better than all of them` : lead.ahead.length ? `Ahead of some of them on ${text.plural(lead.ahead.length, 'thing')}` : 'Nothing yet that they miss',
      sub: lead.ahead.length ? 'Keep these, and say them on your product pages and in your posts.' : 'Catch up on the list above first.',
      body: lead.ahead.length ? H.cards(lead.ahead.map((a) => ({ kicker: a.all ? 'Ahead of all of them' : `Ahead of ${text.list(a.stores)}`, title: a.label, body: a.mine }))) : '',
    }),
    H.block({ kicker: 'Price position', title: 'Where your prices sit', sub: price.text, body: priceChart(all) }),
    H.block({
      kicker: 'Side by side',
      title: 'The numbers',
      sub: 'A star marks the best on each row. Not seen means we did not see it on the public pages, not that they do not have it.',
      body: `<div class="tablewrap"><table class="cmp"><thead><tr><th></th>${all.map((s, i) => `<th>${H.esc(i === 0 ? `${s.name} (you)` : s.name)}</th>`).join('')}</tr></thead><tbody>${table
        .map((r) => `<tr><td><b>${H.esc(r.label)}</b>${r.note ? `<span class="n">${H.esc(r.note)}</span>` : ''}</td>${r.values.map((v, i) => `<td${r.best.includes(i) ? ' class="best"' : ''}>${H.esc(v)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`,
    }),
    skipped.length ? H.block({ kicker: 'Left out', title: 'Not in this comparison', body: H.cards(skipped.map((s) => ({ title: s.name, body: s.reason }))) }) : '',
  ].join('\n');
  return files.htmlDoc({
    title: `${mine.name} compared`,
    description: `${mine.name} next to ${text.list(others.map((o) => o.name))}.`,
    css: H.baseCss(t) + extra,
    body: `${body}\n<footer class="foot"><div class="wrap">Read from each store's public product feed and pages on ${time.longDate(today)}, one quick read per store (up to 250 products each). Only what a shopper can see. Stores change: run it again before you act on a number.</div></footer>`,
  });
}

module.exports = {
  name: 'shop.compare_stores',
  title: 'Compare stores side by side',
  description: 'Reads your Shopify store and up to three others from their public product feeds and pages, scores each with the same audit, and shows where you lead, where they lead (with your fix), where your prices sit and the numbers side by side, as a page and a spreadsheet.',
  kind: 'api',
  risk: 'read',
  needs: [],
  credits: 3,
  timeoutSec: 240,
  input: {
    type: 'object',
    properties: {
      store: { type: 'string', title: 'Your store', maxLength: 300 },
      others: { type: 'string', title: 'Stores to compare with', format: 'textarea', maxLength: 1000, description: 'Up to 3 addresses, one per line.' },
      color: { type: 'string', maxLength: 7 },
    },
    required: ['store', 'others'],
  },
  output: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      reason: { type: 'string' },
      mine: { type: 'object' },
      others: { type: 'array' },
      skipped: { type: 'array' },
      ahead: { type: 'array' },
      behind: { type: 'array' },
      price: { type: 'object' },
      page: { type: 'object' },
      sheet: { type: 'object' },
      sample: { type: 'boolean' },
    },
    required: ['ok'],
  },

  async run(input, ctx) {
    const list = addresses(input.others).filter((a) => a.toLowerCase() !== String(input.store || '').trim().toLowerCase());
    if (!list.length) return { ok: false, reason: 'Add one to three other store addresses to compare with.' };
    const extra = list.length > MAX_OTHERS ? list.slice(MAX_OTHERS) : [];
    ctx.log(`Reading ${text.plural(Math.min(list.length, MAX_OTHERS) + 1, 'store')}.`);
    const reads = await Promise.all([input.store, ...list.slice(0, MAX_OTHERS)].map((s) => readStore(ctx, s, { depth: 'quick' }).catch((e) => ({ ok: false, status: 'unreachable', reason: `We couldn't read ${s}: ${e.message}`, domain: s }))));
    const [mine, ...rest] = reads.map((r, i) => C.summary(r, { label: i === 0 ? input.store : list[i - 1] }));
    if (!mine.ok) return { ok: false, reason: `We couldn't read your store, so there's nothing to compare. ${mine.reason}`, sample: mine.sample };
    const others = rest.filter((o) => o.ok);
    const skipped = rest.filter((o) => !o.ok).map((o) => ({ name: o.name, reason: o.reason }));
    for (const e of extra) skipped.push({ name: e, reason: `Only ${MAX_OTHERS} stores are compared at once.` });
    if (!others.length) return { ok: false, reason: `We couldn't read any of the other stores. ${skipped.map((s) => s.reason).join(' ')}`, skipped, sample: mine.sample };
    const table = C.rows([mine, ...others]);
    const lead = C.leads(mine, others);
    const price = C.pricePosition(mine, others);
    const sample = mine.sample || others.some((o) => o.sample);
    const colors = brandColors(ctx, input);
    const today = time.today(ctx);
    const base = text.slug(`${mine.name} compared`, 50) || 'store-comparison';
    const page = await save.saveFile(ctx, `${base}.html`, pageHtml({ mine, others, skipped, table, lead, price, colors, today, sample }), 'text/html');
    const all = [mine, ...others];
    const cols = [{ key: 'measure', label: 'Measure' }, ...all.map((s, i) => ({ key: `s${i}`, label: i === 0 ? `${s.name} (you)` : s.name }))];
    const sheetRows = [
      ...table.map((r) => ({ measure: r.label, ...Object.fromEntries(r.values.map((v, i) => [`s${i}`, v])) })),
      { measure: 'Store address', ...Object.fromEntries(all.map((s, i) => [`s${i}`, s.url || s.domain])) },
      { measure: `Read ${today} from public pages. Not seen means we did not see it, not that they do not have it.` },
    ];
    const sheet = await save.saveFile(ctx, `${base}.csv`, files.csv(sheetRows, cols), 'text/csv');
    ctx.log(`You: ${mine.score}. ${others.map((o) => `${o.name}: ${o.score}`).join(', ')}.`);
    return {
      ok: true,
      mine: { name: mine.name, domain: mine.domain, score: mine.score, price_median: mine.priceMedian },
      others: others.map((o) => ({ name: o.name, domain: o.domain, score: o.score, price_median: o.priceMedian })),
      skipped,
      ahead: lead.ahead.map((a) => ({ label: a.label, impact: a.impact, mine: a.mine, ahead_of: a.stores, all: a.all })),
      behind: lead.behind.map((b) => ({ label: b.label, impact: b.impact, stores: b.stores, theirs: b.theirs, fix: b.fix, how: b.how })),
      price,
      page,
      sheet,
      sample,
    };
  },

  view(out) {
    if (!out.ok) return views.blocks(views.text(out.reason));
    return views.blocks(
      views.sampleNote(out, 'These stores', { plural: true }),
      views.metric('Your score', out.mine.score, `Theirs: ${out.others.map((o) => `${o.name} ${o.score}`).join(', ')}`),
      views.file(out.page, 'The comparison: where you lead, where they lead, prices and numbers'),
      views.file(out.sheet, 'The numbers side by side'),
      out.behind.length
        ? views.table(
            [
              { key: 'label', label: 'Where they lead' },
              { key: 'who', label: 'Who' },
              { key: 'fix', label: 'Your fix' },
            ],
            out.behind.map((b) => ({ label: b.label, who: b.stores.join(', '), fix: b.fix })),
            8
          )
        : views.text('You match or beat them on every check.'),
      out.ahead.length ? views.text(`Where you lead: ${out.ahead.map((a) => `${a.label.toLowerCase()} (${a.all ? 'ahead of all of them' : `ahead of ${text.list(a.ahead_of)}`})`).join(', ')}.`) : null,
      views.text(out.price.text),
      out.skipped.length ? views.text(`Left out: ${out.skipped.map((s) => `${s.name} (${s.reason})`).join(' ')}`) : null
    );
  },
};
