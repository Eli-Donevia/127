// The windows quote tool: the kit's "Quote this job" (packs/_kit/home/tools.js quoteTool, the same
// name, input and output) with the fixes per-window pricing needs, kept here until the kit has them
// (README, "Kit changes"):
//   1. Window counts win over a flat house price, so one quote never charges for both.
//   2. A plan (every 6 or 3 months) on counted windows takes its discount off each visit, the same
//      as it does on a flat house price.
//   3. Storefront glass visits are route stops: no trip minimum.
//   4. Minutes for counted windows follow inside or outside, and add the floors' extra time once.
//   5. Inside only, upper floors are cleaned from inside: no floor charge.
// Windows pack.

const { text, money, views } = require('../../_kit');
const qt = require('../../_kit/home/quote');
const offer = require('../../_kit/home/offer');
const words = require('../../_kit/home/words');
const T = require('../../_kit/home/tools');
const { countOf } = require('./estimate');

const cents = (n) => Math.round(n * 100) / 100;
const usd = T.usd;
const labelFor = (field, id) => Object.keys(field.map || {}).find((k) => field.map[k] === id);
const PARTS = { window: ['window', 'windows'], picture: ['picture window', 'picture windows'], small_pane: ['French pane', 'French panes'] };

function quoteTool(cfg) {
  const N = cfg.niche;
  const F = N.quote.fields;
  const keyOf = (use) => Object.keys(F).find((k) => F[k].use === use);
  const measureKeys = Object.keys(F).filter((k) => String(F[k].use || '').startsWith('measure:'));
  const qtyKeys = Object.keys(F).filter((k) => String(F[k].use || '').startsWith('qty:'));
  const K = { pkg: keyOf('package'), plan: keyOf('plan'), sides: keyOf('factor:sides'), size: keyOf(`factor:${N.quote.size_factor}`) };
  const pick = (input, k) => (k ? qt.mapped(F[k], input[k] != null && input[k] !== '' ? input[k] : F[k].default) : null);
  return {
    name: `${cfg.id}.quote_job`,
    title: 'Quote this job',
    description: 'Prices one job from your window counts (standard, picture and small French panes), floors, inside or out, screens, tracks, hard water and skylights at your menu prices, or a flat house or storefront price, as line items the Sales desk turns into a quote and an invoice, plus a text you can send.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: { type: 'object', properties: { ...qt.inputSchema(cfg), customer: { type: 'string', maxLength: 80, title: 'Customer name' }, notes: { type: 'string', maxLength: 500, title: 'Notes (optional)' } } },
    output: {
      type: 'object',
      required: ['items'],
      properties: {
        items: { type: 'array' },
        subtotal: { type: 'number' },
        title: { type: 'string' },
        text: { type: 'string' },
        next: { type: 'array' },
        customer: { type: 'string' },
        minutes: { type: 'integer' },
        hours: { type: 'number' },
        advice: { type: 'array' },
        changes: { type: 'array' },
        notes: { type: 'string', maxLength: 1000 },
      },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const menu = offer.menuFor(ctx, cfg, {});
      const inp = { ...input };
      // "18", "18 windows" or 18 all count as 18.
      for (const k of [...measureKeys, ...qtyKeys]) if (inp[k] != null && inp[k] !== '') inp[k] = String(countOf(inp[k]) || '');
      const changes = [];
      const counted = measureKeys.some((k) => Number(inp[k]) > 0);
      let pkgId = pick(inp, K.pkg);
      let sideId = pick(inp, K.sides) || 'both';
      const perWindow = labelFor(F[K.pkg], null);
      const oneTime = labelFor(F[K.plan], null);
      const pkgLabel = (id) => ((menu.packages.find((p) => p.id === id) || {}).label || '').toLowerCase();

      // 1. Counts win over a flat price. "Outside only (flat)" with counts keeps its side.
      if (counted && pkgId) {
        if (pkgId === 'outside_house' && sideId === 'both') {
          sideId = 'out';
          inp[K.sides] = labelFor(F[K.sides], 'out');
        }
        changes.push(`Priced from your window counts, not the flat price for ${pkgLabel(pkgId)}.`);
        inp[K.pkg] = perWindow;
        pkgId = null;
      }
      // No counts: the flat house price. Outside only has its own flat price; inside only needs counts.
      if (!counted && !pkgId) {
        pkgId = (menu.packages.find((p) => !p.rate) || {}).id || null;
        if (pkgId) inp[K.pkg] = labelFor(F[K.pkg], pkgId);
        changes.push('No window counts typed, so this is your flat house price. Type the counts for a per-window price.');
      }
      if (!counted && pkgId === 'whole_house' && sideId === 'out') {
        pkgId = 'outside_house';
        inp[K.pkg] = labelFor(F[K.pkg], 'outside_house');
      }
      if (!counted && sideId === 'in') changes.push('Inside only is priced per window: type the counts for an inside-only price.');
      // Inside only, upper floors are cleaned from inside: no ladder, so no floor charge (as in the estimate).
      const sizeDefault = ((cfg.prices.factors || []).find((x) => x.id === N.quote.size_factor) || {}).default;
      if (counted && sideId === 'in' && K.size && pick(inp, K.size) && pick(inp, K.size) !== sizeDefault) {
        inp[K.size] = labelFor(F[K.size], sizeDefault);
        changes.push('Inside only: upper floors are cleaned from inside, so there is no charge for floors.');
      }

      // 2. The plan: a house plan on counted windows is priced below; a plan that doesn't fit is one time.
      const planId = pick(inp, K.plan);
      const pl = planId ? (cfg.prices.plans || []).find((p) => p.id === planId) : null;
      const storePlan = (p) => (p.packages || []).includes('storefront');
      let countPlan = null;
      if (pl && counted) {
        if ((pl.packages || []).includes('window')) countPlan = pl;
        else changes.push(`${pl.label} is for storefront visits, so this quote is one time.`);
        inp[K.plan] = oneTime;
      } else if (pl && pkgId && pl.packages && !pl.packages.includes(pkgId)) {
        changes.push(storePlan(pl) ? `${pl.label} is for storefront visits, so this quote is one time.` : `${pl.label} is for houses, so this quote is one time. Storefront visits repeat every month or every 2 weeks.`);
        inp[K.plan] = oneTime;
      }

      // 3. Storefront visits carry no trip minimum.
      const use = pkgId === 'storefront' ? { ...cfg, prices: { ...cfg.prices, minimum: 0 } } : cfg;
      const q = qt.build(use, menu, inp);
      if (!q.items.length) throw new Error('Type how many windows there are, or pick a flat price.');

      if (countPlan) {
        const at = q.items.findIndex((it) => it.label === 'Trip minimum');
        if (at >= 0) q.items.splice(at, 1);
        const base = cents(q.items.reduce((n, it) => n + it.price * it.qty, 0));
        const off = cents(base * (countPlan.discount || 0));
        if (off > 0) q.items.push({ label: `${countPlan.label} price`, detail: `${Math.round(countPlan.discount * 100)}% off each visit, every ${countPlan.every}`, qty: 1, unit: 'each', price: -off });
        let subtotal = cents(base - off);
        const min = cfg.prices.minimum;
        if (min && subtotal > 0 && subtotal < min) {
          q.items.push({ label: 'Trip minimum', detail: `Jobs start at ${money.usd(min)}`, qty: 1, unit: 'each', price: cents(min - subtotal) });
          subtotal = min;
        }
        q.subtotal = subtotal;
        q.plan = { id: countPlan.id, label: countPlan.label, every: countPlan.every, perVisit: subtotal };
        q.notes.push(`Repeats every ${countPlan.every}. ${N.texts.plan_terms || ''}`.trim());
      }

      // 4. Minutes for counted windows: each rate's minutes, inside or out, plus the floors once.
      const sizeF = (cfg.prices.factors || []).find((x) => x.id === N.quote.size_factor);
      const size = sizeF && ((sizeF.options || []).find((o) => o.id === pick(inp, K.size)) || (sizeF.options || []).find((o) => o.id === sizeF.default));
      if (counted) {
        const st = ((cfg.prices.estimate || {}).sides_time || {})[sideId];
        let minutes = 0;
        for (const k of measureKeys) {
          const n = Number(inp[k]) || 0;
          const src = (cfg.prices.packages || []).find((p) => p.id === F[k].use.slice(8)) || {};
          if (n > 0) minutes += (src.minutes_per_unit || 0) * n * (st != null ? st : 1);
        }
        minutes += ((size && size.minutes) || 0) + ((cfg.prices.estimate || {}).setup_minutes || 0);
        for (const k of qtyKeys) {
          const n = Math.round(Number(inp[k]) || 0);
          const a = menu.addons.find((x) => x.id === F[k].use.slice(4));
          if (n > 0 && a) minutes += (a.minutes || 0) * n;
        }
        q.minutes = Math.round(minutes);
      }

      // Title: "Window cleaning, 18 windows, 2 picture windows and 12 French panes, two stories".
      const lower = (s) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
      let parts;
      if (counted) {
        const counts = measureKeys.filter((k) => Number(inp[k]) > 0).map((k) => {
          const [one, many] = PARTS[F[k].use.slice(8)] || [F[k].use.slice(8), `${F[k].use.slice(8)}s`];
          return text.plural(Math.round(Number(inp[k])), one, many);
        });
        const side = (((cfg.prices.factors || []).find((x) => x.id === 'sides') || {}).options || []).find((o) => o.id === sideId);
        parts = ['Window cleaning', text.list(counts), size && size.id !== (sizeF || {}).default ? lower(size.short || size.label) : '', side && side.id !== 'both' ? lower(side.label) : ''];
      } else {
        parts = [q.package ? q.package.label : q.items[0].label, (q.short || [])[0] ? lower(q.short[0]) : ''];
      }
      const title = text.clip(parts.filter(Boolean).join(', '), 110);
      const said = text.clip(parts.filter(Boolean).map(lower).join(', '), 110);
      const who = text.plain(input.customer || '') || 'there';
      const planLine = q.plan ? (q.plan.package ? ` After this one, a ${q.plan.package.toLowerCase()} is ${usd(q.plan.perVisit)} every ${q.plan.every}.` : ` After that it's ${usd(q.plan.perVisit)} every ${q.plan.every}.`) : '';
      const msg = words.fill(N.texts.quote, { customer: who.split(' ')[0], first: f.first, business: f.business, title: said, lines: qt.itemLines(q.items).join('; '), total: usd(q.subtotal), plan: planLine, promise: N.offer.promise });
      return {
        customer: who,
        title,
        items: q.items,
        subtotal: q.subtotal,
        minutes: q.minutes,
        hours: Math.round((q.minutes / 60) * 10) / 10,
        ...(q.plan ? { plan: q.plan } : {}),
        advice: q.advice,
        changes,
        notes: text.clip([...q.notes, N.offer.promise].join(' '), 990),
        text: msg,
        next: [
          { label: 'They said yes: make the invoice', invoice: true },
          { label: 'Not yet: keep the quote', invoice: false },
        ],
      };
    },
    view(out) {
      return views.blocks(
        { ...views.metric(`Quote for ${out.customer}`, out.subtotal, `${out.title}, about ${out.hours} hours`), format: 'money' },
        // Dollars as they print ("$13.20" a window, not 13.2).
        views.table([{ key: 'label', label: 'Item' }, { key: 'qty', label: 'Qty', format: 'number' }, { key: 'price', label: 'Price' }], out.items.map((it) => ({ ...it, price: usd(it.price) }))),
        (out.changes || []).map((c) => views.text(c)),
        out.advice.map((a) => views.text(a)),
        views.copy(`Text to ${out.customer}`, out.text),
      );
    },
  };
}

module.exports = { quoteTool };
