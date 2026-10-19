// Printable pages for the offer pack, built on page.js (no scripts). Every page uses the
// member's palette and only the member's own facts.

const { text, money } = require('../../_kit');
const pg = require('./page');

const usd = (n) => (n == null ? 'check' : money.usd(n));
const by = (f) => [f.business, f.place].filter(Boolean).join(', ');

// Offer score report for the member.
function scoreCardHtml(ev, f, { source = '' } = {}) {
  const rows = ev.rows.map((r) => ({ what: r.label, score: `${r.score} of 10`, why: r.why }));
  const after = ev.after.rows.map((r) => ({ what: r.label, score: `${r.score} of 10` }));
  const body = [
    pg.hero({ eyebrow: 'Offer score', title: `${ev.score} out of 100`, lede: `How strong your offer reads to a buyer today, and the 3 changes that raise it most. With the fixes it reads at about ${ev.after.score}.`, pills: [by(f), source].filter(Boolean) }),
    `<div style="margin-top:18px">${pg.grid([pg.stat(String(ev.score), 'Today'), pg.stat(String(ev.after.score), 'With the 3 fixes')], 2)}</div>`,
    pg.section('Where it stands', pg.table([{ key: 'what', label: 'What buyers weigh' }, { key: 'score', label: 'Score', right: true }, { key: 'why', label: 'Why' }], rows)),
    pg.section('The 3 fixes that raise it most', pg.grid(ev.fixes.map((x, i) => pg.card({ tag: `Fix ${i + 1}: +${x.points || x.gain} points`, title: x.title, body: `${x.why} Try: "${x.line}"` })), 3)),
    pg.section('Your offer, rewritten', `<div class="card"><p>${pg.esc(ev.rewrite)}</p></div>`),
    pg.section('After the fixes', pg.table([{ key: 'what', label: 'What buyers weigh' }, { key: 'score', label: 'Score', right: true }], after)),
    pg.foot('Scores come from the words in your offer only.', 'Made with 127'),
  ].join('');
  return pg.doc({ title: `Offer score: ${f.business || f.whatShort}`, pal: f.palette, body });
}

// What each customer can buy, in order, with the words to say.
function ladderHtml(ld, f) {
  const steps = ld.steps.map((s, i) => pg.card({ tag: `${i + 1}. ${s.step}`, title: `${s.title}: ${s.priceText}`, body: s.what, extra: `<p class="small"><b>When:</b> ${pg.esc(s.when)}</p><p class="small"><b>Say:</b> "${pg.esc(s.script)}"</p>` }));
  const t = ld.thirty;
  const math = [
    { k: 'One customer who buys the main offer, the add-on and one month of the plan', v: usd(t.cash) },
    { k: 'Your supplies and card fees for those', v: usd(t.costs) },
    { k: 'What you keep from that one customer', v: usd(t.kept), total: true },
  ];
  const body = [
    pg.hero({ eyebrow: 'Money model', title: 'What each customer can buy', lede: 'One offer for each step, in order, with when to offer it and the words to say. The math is per customer, from your own price and costs.', pills: [by(f)] }),
    pg.section('The 5 steps', pg.grid(steps, 2)),
    pg.section('One customer, first 30 days', pg.table([{ key: 'k', label: 'For one customer' }, { key: 'v', label: 'Amount', right: true }], math)),
    `<p class="small">Spend up to ${usd(t.maxToGetOne)} per customer like this and you still break even in 30 days. Card fees use ${pg.esc(ld.fee.label || ld.fee.key || 'your payment app')}; check current rates before you rely on them.</p>`,
    pg.foot('Per customer math only. Not a forecast.', 'Made with 127'),
  ].join('');
  return pg.doc({ title: `Money model: ${f.business || f.whatShort}`, pal: f.palette, body });
}

// Buyer-facing price menu: best first, "Best place to start" on better.
function priceMenuHtml(pr, f, offerName) {
  const cards = pr.tiers.map((t) => pg.card({ cls: t.key === 'better' ? 'pick' : '', tag: t.key === 'better' ? 'Best place to start' : t.badge || '', title: `${t.name}: ${usd(t.price)}`, extra: pg.list(t.includes || []) }));
  const founding = pr.ladder && pr.ladder.length ? pg.section('Opening prices', pg.table([{ key: 'label', label: 'Who' }, { key: 'price', label: 'Price', right: true }, { key: 'note', label: '' }], pr.ladder.map((l) => ({ label: l.who, price: usd(l.price), note: '' })))) : '';
  const body = [
    pg.hero({ eyebrow: by(f) || 'Prices', title: offerName || (f.what.charAt(0).toUpperCase() + f.what.slice(1)), lede: 'Pick the one that fits. You know the exact price before any work starts.' }),
    `<div style="margin-top:18px">${pg.grid(cards, 3)}</div>`,
    founding,
    pg.foot(`Prices per ${f.unit || 'job'}.`, f.instagram ? `@${f.instagram}` : f.website || ''),
  ].join('');
  return pg.doc({ title: `Prices: ${f.business || f.whatShort}`, pal: f.palette, body });
}

// The member's promise, printable, with the terms in plain words.
function promiseCardHtml(p, f) {
  const t = p.terms;
  const body = [
    pg.hero({ eyebrow: by(f) || 'My promise', title: p.name, lede: p.long }),
    pg.promise(p.short),
    pg.section('The details', pg.grid([
      pg.card({ tag: 'Covers', body: t.covers }),
      pg.card({ tag: 'How to claim it', body: t.claim }),
      pg.card({ tag: 'What I do', body: t.you }),
      pg.card({ tag: 'Not covered', extra: pg.list(t.notCovered) }),
    ], 2)),
    pg.foot('A promise about what I control.', 'Made with 127'),
  ].join('');
  return pg.doc({ title: `${p.name}: ${f.business || f.whatShort}`, pal: f.palette, body });
}

// The 30-day math as a sheet with formulas the member can change.
function ladderCsv(ld) {
  const { Sheet } = require('./sheet');
  const sh = new Sheet();
  sh.add(['Step', 'Offer', 'Price', 'Supplies', 'Card fee', 'You keep', 'Hours', 'Buys it? (1 or 0)', 'Kept if bought']);
  ld.steps.forEach((s) => sh.add((r) => [s.step, s.title, s.price || 0, Math.round((s.supplies || 0) * 100) / 100, Math.round((s.fee || 0) * 100) / 100, `=C${r}-D${r}-E${r}`, s.hours || 0, s.key === 'attraction' || s.key === 'downsell' ? 0 : 1, `=F${r}*H${r}`], s.key));
  const first = 2;
  const last = first + ld.steps.length - 1;
  sh.blank();
  sh.add(() => ['One customer, first 30 days', '', '', '', '', '', '', '', `=SUM(I${first}:I${last})`], 'total');
  return sh.csv();
}

module.exports = { scoreCardHtml, ladderHtml, priceMenuHtml, promiseCardHtml, ladderCsv, usd };
