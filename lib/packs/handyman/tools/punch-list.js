// The signature tool for handyman work, the punch list quote: a pasted list of small jobs is matched
// to sourced times and prices (data/punch.json, lib/parse.js), put in the order that saves time, and
// priced from the total time at the member's hourly rate with the trip minimum (lib/punch.js). The
// jobs that go to a licensed trade (panels, new wiring, gas, moved pipes, HVAC, structural, and the
// swaps the member's state lists as licensed work) come out of the price with the rule linked. The
// state's limit for work without a contractor license, EPA's lead rule for homes built before 1978,
// and the OSHA ladder and CPSC anchoring lines are added where they apply. The lines go to the Sales
// desk as a quote and, once they say yes, an invoice. The member's hourly rate is kept in this pack's
// memory, so they type it once.

const { text, views, save, time, brain } = require('../../_kit');
const T = require('../../_kit/home/tools');
const offer = require('../../_kit/home/offer');
const qt = require('../../_kit/home/quote');
const geo = require('../../_kit/home/geo');
const words = require('../../_kit/home/words');
const print = require('../../_kit/home/print');
const P = require('../lib/punch');
const { punchSheet } = require('../lib/sheet');
const DATA = require('../data/punch.json');

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
const MEMORY = 'rate';
const STR = { type: 'string' };
const NUM = { type: 'number' };
const STRS = { type: 'array', items: STR };
const SRC = { type: 'array', items: { type: 'object', properties: { publisher: STR, url: STR } } };
const usd = T.usd;
const src = (list) => (list || []).map((s) => ({ publisher: s.publisher, url: s.url }));

function punchListTool(cfg) {
  const id = cfg.id;
  return {
    name: `${id}.punch_list`,
    title: 'Price a punch list',
    description: 'A typed or pasted list of small jobs: the time for each from sourced ranges, the order to do them, the price from your hourly rate, the jobs that go to a licensed trade with your state\'s rule, the lead and ladder checks, a text and a printable estimate. The lines go to a quote and an invoice.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 2,
    timeoutSec: 60,
    input: {
      type: 'object',
      required: ['items'],
      properties: {
        customer: { type: 'string', maxLength: 80, title: 'Customer name' },
        items: { type: 'string', maxLength: 4000, format: 'textarea', title: 'The list of jobs' },
        built: { type: 'string', maxLength: 10, title: 'Year the home was built' },
        rate: { type: 'string', maxLength: 10, title: 'Your hourly rate' },
        city: { type: 'string', maxLength: 80, title: 'City and state' },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: {
      type: 'object',
      required: ['customer', 'title', 'items', 'subtotal', 'notes', 'text', 'next', 'rate', 'hours', 'visits', 'order', 'lines', 'refer', 'checks', 'unknown', 'state', 'lead', 'safety', 'compare', 'sources', 'files'],
      properties: {
        customer: STR,
        title: STR,
        items: { type: 'array', items: { type: 'object', required: ['label', 'qty', 'unit', 'price'], properties: { label: STR, detail: STR, qty: NUM, unit: STR, price: NUM } } },
        subtotal: NUM,
        notes: STR,
        text: STR,
        next: { type: 'array', items: { type: 'object', properties: { label: STR, invoice: { type: 'boolean' } } } },
        rate: { type: 'object', required: ['perHour', 'typed', 'note'], properties: { perHour: NUM, typed: { type: 'boolean' }, note: STR } },
        hours: { type: 'object', required: ['low', 'high', 'mid', 'text'], properties: { low: NUM, high: NUM, mid: NUM, text: STR } },
        visits: { type: 'object', required: ['count', 'text'], properties: { count: { type: 'integer' }, text: STR } },
        order: { type: 'array', items: { type: 'object', required: ['step', 'label', 'jobs'], properties: { step: STR, label: STR, why: STR, jobs: STRS } } },
        lines: { type: 'array', items: { type: 'object', required: ['text', 'as', 'qty', 'time', 'price', 'typical', 'timeBasis'], properties: { text: STR, as: STR, qty: NUM, time: STR, price: NUM, typical: STR, timeBasis: STR } } },
        refer: { type: 'array', items: { type: 'object', required: ['text', 'label', 'trade', 'why'], properties: { text: STR, label: STR, trade: STR, why: STR, sources: SRC } } },
        checks: { type: 'array', items: { type: 'object', required: ['label', 'items', 'text'], properties: { label: STR, items: STRS, text: STR, sources: SRC } } },
        unknown: STRS,
        state: { type: 'object', required: ['code', 'name', 'rule', 'link', 'limit', 'warning', 'banner'], properties: { code: STR, name: STR, rule: STR, link: STR, limit: NUM, warning: STR, banner: STR, notes: STRS, sources: SRC } },
        lead: { type: 'object', required: ['applies', 'text'], properties: { applies: { type: 'boolean' }, text: STR, items: STRS, sources: SRC } },
        safety: { type: 'array', items: { type: 'object', required: ['label', 'text'], properties: { label: STR, text: STR, items: STRS, sources: SRC } } },
        compare: { type: 'object', required: ['text'], properties: { text: STR, low: NUM, high: NUM, yours: NUM } },
        sources: SRC,
        files: { type: 'object', required: ['sheet'], properties: { sheet: ASSET } },
      },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      if (!String(input.items || '').trim()) throw new Error('Paste the list of jobs, one per line, like "fix sticky bedroom door" or "mount 2 TVs".');
      const customer = text.clip(text.plain(input.customer || '').trim(), 80) || 'Customer';
      const code = geo.parsePlace(f.place).state || '';

      // The hourly rate: what they typed now, else what they typed last time, else the menu's.
      const typedRate = Number(String(input.rate || '').replace(/[^\d.]/g, ''));
      const mem = brain.packMemory(ctx, id)[MEMORY];
      const menu = offer.menuFor(ctx, cfg, {});
      const hourPkg = menu.packages.find((p) => p.id === 'hour');
      let perHour = typedRate > 0 ? typedRate : Number(mem) > 0 ? Number(mem) : hourPkg ? hourPkg.price : 75;
      perHour = Math.min(500, Math.round(perHour * 100) / 100);
      if (typedRate > 0) await brain.remember(ctx, MEMORY, perHour);
      const hourSrc = (cfg.prices.packages || []).find((p) => p.id === 'hour') || {};
      const rateNote = typedRate > 0 || Number(mem) > 0 ? `Your rate: ${usd(perHour)} an hour.` : `${usd(perHour)} an hour, from your price menu. ${hourSrc.basis || ''} Type your own rate and it is kept for next time.`.trim();

      const r = P.estimate({ items: input.items, built: input.built }, { rate: perHour, state: code });
      if (r.error) throw new Error(r.error);
      if (!r.lines.length) {
        const why = r.refer.length ? ` ${r.refer.map((x) => `${cap(x.text)}: ${x.trade}.`).join(' ')}` : '';
        throw new Error(`Nothing on this list is a job to price here.${why} Paste the small jobs, one per line, like "fix sticky bedroom door".`);
      }

      const hoursText = r.lines.length ? `About ${P.timeText(r.minutes.low, r.minutes.high)}` : 'No jobs I can price from the list';
      const visitsText = r.visits ? `${r.visits === 1 ? 'One visit' : `${r.visits} visits`}${r.order.some((o) => o.step === 'return') ? ', including a short one to sand and paint the patches once they dry' : ''}. ${DATA.estimate.visits_note}` : '';
      const customerVisits = r.visits ? `${r.visits === 1 ? 'One visit.' : `${r.visits} visits${r.order.some((o) => o.step === 'return') ? ', including a short one to finish the patches once they dry' : ''}.`}` : '';

      // What the customer reads: the price lines, what goes to a licensed pro, what gets priced on site.
      const referLines = r.refer.map((x) => `${cap(x.text)}: ${x.trade}`);
      const first = customer === 'Customer' ? 'there' : customer.split(/\s+/)[0];
      const trades = [...new Set(r.refer.map((x) => x.trade))];
      const quoted = (list) => text.list(list.map((x) => `"${x}"`));
      const referText = r.refer.length ? ` ${cap(quoted(r.refer.map((x) => x.text)))} ${r.refer.length > 1 ? 'go' : 'goes'} to ${text.list(trades)}, so ${r.refer.length > 1 ? "they're" : "it's"} not in this price.` : '';
      const prep = r.unknown.length ? ` I'll price ${quoted(r.unknown)} when I see ${r.unknown.length > 1 ? 'them' : 'it'}.` : '';
      const msg = r.lines.length
        ? words.fill(cfg.niche.texts.estimate, {
            customer: first,
            first: f.first,
            business: f.business,
            lines: qt.itemLines(r.items).join('; '),
            hours: P.timeText(r.minutes.low, r.minutes.high),
            total: usd(r.subtotal),
            refer: referText,
            prep,
            promise: cfg.niche.offer.promise,
          })
        : words.fill('Hi {customer}, it\'s {first} from {business}.{refer}{prep} Happy to help with anything else on your list.', { customer: first, first: f.first, business: f.business, refer: referText, prep });

      const lineOut = r.lines.map((l) => ({
        text: l.text,
        as: l.qty > 1 ? `${l.job.label} (${l.qty})` : l.job.label,
        qty: l.qty,
        time: P.timeText(l.low, l.high),
        price: l.price,
        typical: l.typical.low != null ? `${usd(l.typical.low)} to ${usd(l.typical.high)} alone (${[...new Set(l.typical.sources.map((s) => s.publisher))].join(', ')})` : l.typical.note,
        timeBasis: l.timeSourced ? `${[...new Set(l.job.time_sources.map((s) => s.publisher))].join(', ')}${l.timeNote ? `. ${l.timeNote}` : ''}` : l.timeNote || 'Judgment call',
      }));
      const compare = r.compare
        ? { text: `Booked one at a time, the ${r.compare.jobs} jobs with a typical price come to ${usd(r.compare.low)} to ${usd(r.compare.high)} by the guides, since each one carries its own trip. In one visit at your rate they are ${usd(r.compare.yours)}.`, low: r.compare.low, high: r.compare.high, yours: r.compare.yours }
        : { text: 'No job on this list has a typical price from two or more guides, so it is priced by time only.' };

      const notes = [
        `Estimated from your list: ${hoursText.toLowerCase()} of work. I confirm each job and the price when I see it, before I start.`,
        DATA.materials.say,
        DATA.estimate.scope,
        r.refer.length ? `Not in this price, for a licensed pro: ${r.refer.map((x) => x.text.toLowerCase()).join(', ')}.` : '',
        cfg.niche.offer.promise,
      ].filter(Boolean).join(' ');

      const date = time.today(ctx);
      const pal = print.paletteFor(cfg, input.color);
      const groups = r.order
        .filter((o) => o.step !== 'return')
        .map((o) => ({ label: o.label, rows: r.lines.filter((l) => l.job.step === o.step).map((l, i) => ({ label: l.qty > 1 ? `${l.job.label} (${l.qty})` : l.job.label, detail: cap(l.text), time: P.timeText(l.low, l.high), price: l.price, i })) }));
      const ret = r.order.find((o) => o.step === 'return');
      if (ret) groups.push({ label: ret.label, rows: [{ label: 'Sand and paint the patches once they dry', detail: '', time: '', price: null }] });
      const sheetHtml = punchSheet(cfg, {
        customer,
        business: f.business,
        first: f.first,
        phone: f.phone,
        link: f.link,
        area: f.area,
        dateText: time.longDate(date),
        groups,
        extra: r.items.filter((it) => it.label === 'Trip minimum'),
        subtotal: r.subtotal,
        hoursText,
        visitsText: customerVisits,
        refer: referLines,
        unknown: r.unknown.map((n) => `${cap(n)}: priced when I see it`),
        parts: DATA.materials.say,
        scope: DATA.estimate.scope,
        promise: cfg.niche.offer.promise,
      }, pal);
      const sheet = await save.saveFile(ctx, save.fileName(customer, 'punch list estimate', date, '.html'), sheetHtml);

      const title = text.clip(`${cfg.niche.name}: ${r.lines.length} ${r.lines.length === 1 ? 'job' : 'jobs'}, ${P.timeText(r.minutes.low, r.minutes.high)}`, 110);
      return {
        customer,
        title,
        items: r.items.map(({ label, detail, qty, unit, price }) => ({ label, ...(detail ? { detail } : {}), qty, unit, price })),
        subtotal: r.subtotal,
        notes,
        text: msg,
        next: [
          { label: 'They said yes: make the invoice', invoice: true },
          { label: 'Not yet: keep the quote', invoice: false },
        ],
        rate: { perHour, typed: typedRate > 0, note: rateNote },
        hours: { low: Math.round((r.minutes.low / 60) * 10) / 10, high: Math.round((r.minutes.high / 60) * 10) / 10, mid: Math.round((r.minutes.mid / 60) * 10) / 10, text: hoursText },
        visits: { count: r.visits, text: visitsText },
        order: r.order.map((o) => ({ step: o.step, label: o.label, ...(o.why ? { why: o.why } : {}), jobs: o.jobs })),
        lines: lineOut,
        refer: r.refer.map((x) => ({ text: x.text, label: x.label, trade: x.trade, why: x.why, sources: src(x.sources) })),
        checks: r.checks.map((c) => ({ label: c.label, items: c.items, text: `${c.text} Check your state and city.`, sources: src(c.sources) })),
        unknown: r.unknown,
        state: { code: r.state.code, name: r.state.name, rule: r.state.rule, link: r.state.link, limit: r.state.limit, warning: r.state.warning, banner: r.state.banner, notes: r.notes, sources: src(r.state.sources) },
        lead: r.lead.applies ? { applies: true, text: r.lead.text, items: r.lead.items, sources: src(r.lead.sources) } : { applies: false, text: '' },
        safety: r.safety.map((x) => ({ label: x.label, text: x.text, items: x.items, sources: src(x.sources) })),
        compare,
        sources: r.sources,
        files: { sheet },
      };
    },
    view(out) {
      const who = out.customer === 'Customer' ? 'the customer' : out.customer.split(/\s+/)[0];
      const stateLine = out.state.name ? `${out.state.rule} Source: ${out.state.link}` : `${out.state.rule}`;
      return views.blocks(
        views.metric(`Estimate for ${out.customer}`, out.subtotal, `${out.hours.text} at ${usd(out.rate.perHour)} an hour. ${out.visits.text}`.trim()),
        views.table([{ key: 'label', label: 'Job' }, { key: 'price', label: 'Price', format: 'money' }], out.items),
        views.table([{ key: 'text', label: 'You typed' }, { key: 'as', label: 'Counted as' }, { key: 'time', label: 'Time' }, { key: 'typical', label: 'Typical alone' }], out.lines),
        out.order.length ? views.text(`Order: ${out.order.map((o, i) => `${i + 1}. ${o.label}`).join('; ')}.`) : null,
        out.refer.length ? views.table([{ key: 'text', label: 'For a licensed pro' }, { key: 'trade', label: 'Who' }, { key: 'why', label: 'Why' }], out.refer) : null,
        out.unknown.length ? views.text(`Not in the job table, price these by eye: ${out.unknown.join('; ')}.`) : null,
        out.state.warning ? views.text(out.state.warning) : null,
        out.state.banner ? views.text(out.state.banner) : null,
        views.text(`Your state: ${stateLine}`),
        out.checks.map((c) => views.text(`${c.label} (${c.items.join(', ')}): ${c.text}`)),
        out.lead.applies ? views.text(`Lead-safe check (${out.lead.items.join(', ')}): ${out.lead.text}`) : null,
        out.safety.map((x) => views.text(`${x.label}: ${x.text}`)),
        views.text(out.compare.text),
        views.text(out.rate.note),
        views.copy(`Text to ${who}`, out.text),
        views.file(out.files.sheet, 'Punch list estimate for the customer: print it or send it'),
        views.text(`Times and typical prices from Fixr, Thumbtack, TaskRabbit, HomeAdvisor and Housecall Pro; licensing rules from state statutes and contractor boards; checked ${DATA.checked}. General information, not legal advice: check your state and city.`),
      );
    },
  };
}

const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);

module.exports = { punchListTool, MEMORY };
