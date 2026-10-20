// The signature tool for moving help, "Crew and hours estimate": home size, stairs, carry distance and
// heavy items in; crew size, hours and a price at the member's hourly rate per mover out, with the
// line items the Sales desk turns into a quote, a printable move-day plan, the texts to send, and the
// items movers won't carry. Hours come from HireAHelper's estimating chart (data/crew.json, lib/crew.js);
// judgment calls are said on screen. Labor only: the customer drives, and the tool says why.

const { text, views, save } = require('../../_kit');
const T = require('../../_kit/home/tools');
const offer = require('../../_kit/home/offer');
const print = require('../../_kit/home/print');
const crew = require('../lib/crew');
const page = require('../lib/plan-page');

const C = crew.C;
const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
const RANGE = { type: 'object', required: ['low', 'est', 'high'], properties: { low: { type: 'number' }, est: { type: 'number' }, high: { type: 'number' } } };
const NAMED = { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, qty: { type: 'integer' }, say: { type: 'string' } } } };
const STR = { type: 'array', items: { type: 'string' } };
const lower = (s) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const amount = (v) => {
  const n = Number(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : 0;
};
const clean = (v, n) => text.clip(text.plain(v || '').trim(), n);

function crewPlanTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  return {
    name: `${id}.crew_plan`,
    title: 'Crew and hours estimate',
    description: "Home size, stairs, carry distance and heavy items give the crew size and hours from HireAHelper's estimating chart, a price at your hourly rate per mover, line items for a quote, a printable move-day plan and the texts to send, plus the items movers won't carry. Labor only: the customer drives.",
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 2,
    timeoutSec: 60,
    input: {
      type: 'object',
      properties: {
        customer: { type: 'string', maxLength: 80, title: 'Customer' },
        home: { type: 'string', enum: C.homes.map((h) => h.label), default: C.homes[0].label, title: 'Home size' },
        job: { type: 'string', enum: crew.JOBS.map((j) => j.label), default: crew.JOBS[0].label, title: 'The job' },
        stairsFrom: { type: 'string', maxLength: 2, title: 'Flights of stairs at the pickup' },
        stairsTo: { type: 'string', maxLength: 2, title: 'Flights of stairs at the drop-off' },
        carryFrom: { type: 'string', maxLength: 12, title: 'Feet from the truck to the door, pickup' },
        carryTo: { type: 'string', maxLength: 12, title: 'Feet from the truck to the door, drop-off' },
        items: { type: 'string', maxLength: 1000, format: 'textarea', title: 'Heavy or special items' },
        crew: { type: 'string', enum: crew.CREWS, default: crew.CREWS[0], title: 'Crew' },
        rate: { type: 'string', maxLength: 10, title: 'Your rate per mover per hour' },
        date: { type: 'string', maxLength: 40, title: 'Moving day' },
        start: { type: 'string', maxLength: 20, title: 'Start time' },
        from: { type: 'string', maxLength: 200, title: 'Pickup address' },
        to: { type: 'string', maxLength: 200, title: 'Drop-off address' },
        truck: { type: 'string', maxLength: 80, title: 'Their truck or container' },
        notes: { type: 'string', maxLength: 600, format: 'textarea', title: 'Notes for the crew' },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: {
      type: 'object',
      required: ['home', 'job', 'crew', 'chartCrew', 'hours', 'moverHours', 'rate', 'price', 'items', 'title', 'notes', 'why', 'warnings', 'heavy', 'specialist', 'appliances', 'hazards', 'perishables', 'plan', 'messages', 'laborOnly', 'files'],
      properties: {
        customer: { type: 'string' },
        home: { type: 'string' },
        job: { type: 'string' },
        crew: { type: 'integer' },
        chartCrew: { type: 'integer' },
        hours: RANGE,
        moverHours: { type: 'number' },
        rate: { type: 'number' },
        heavyFee: { type: 'number' },
        price: RANGE,
        items: { type: 'array', items: { type: 'object', required: ['label', 'qty', 'unit', 'price'], properties: { label: { type: 'string' }, detail: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string' }, price: { type: 'number' } } } },
        title: { type: 'string' },
        notes: { type: 'string' },
        why: STR,
        warnings: STR,
        heavy: NAMED,
        specialist: NAMED,
        appliances: NAMED,
        hazards: { type: 'array', items: { type: 'object', properties: { group: { type: 'string' }, found: { type: 'string' } } } },
        perishables: STR,
        plan: { type: 'array', items: { type: 'object', properties: { step: { type: 'string' }, hours: { type: 'number' }, do: STR } } },
        messages: { type: 'array', items: { type: 'object', required: ['key', 'label', 'text'], properties: { key: { type: 'string' }, label: { type: 'string' }, text: { type: 'string' } } } },
        laborOnly: STR,
        source: { type: 'object', properties: { publisher: { type: 'string' }, url: { type: 'string' }, checked: { type: 'string' } } },
        files: { type: 'object', required: ['html'], properties: { html: ASSET } },
      },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const menu = offer.menuFor(ctx, cfg, {});
      const hourRate = menu.packages.find((p) => p.id === 'mover_hour');
      const heavyAddon = menu.addons.find((a) => a.id === 'heavy');
      const rate = amount(input.rate) || (hourRate && hourRate.price) || 0;
      if (!rate) throw new Error('Type your rate per mover per hour, like 60.');
      const e = crew.estimate({ ...input, rate, heavyFee: heavyAddon ? heavyAddon.price : 0 });
      const customer = clean(input.customer, 80);
      const first = customer.split(/\s+/)[0] || 'there';
      const date = clean(input.date, 40);
      const start = clean(input.start, 20);
      const usd = crew.money;
      const hoursSay = `about ${crew.hrs(e.hours.est)} hours${crew.span(e.hours.low, e.hours.high)}`;
      const priceSay = `about ${usd(e.price.est)}${e.price.low !== e.price.high ? ` (${usd(e.price.low)} to ${usd(e.price.high)})` : ''}`;
      const heavyNames = e.heavy.map((h) => `${h.qty > 1 ? `${h.qty} ` : ''}${lower(h.label)}`);
      const fees = e.heavyCount && e.fee ? `, including ${usd(e.heavyCount * e.fee)} for the ${text.list(heavyNames)}` : '';
      const me = f.first ? `it's ${f.first} from ${f.business}` : `it's ${f.business}`;
      const spec = e.specialist.length ? ` The ${text.list(e.specialist.map((s) => lower(s.label)))} ${e.specialist.length > 1 ? 'need' : 'needs'} a specialist, so ${e.specialist.length > 1 ? 'they are' : 'it is'} not in this price.` : '';
      const hazards = [...new Set(e.hazards.map((h) => h.found))];
      const bring = (N.won.bring || []).slice(0, 4).map(lower);
      // The first prep line asks them to set aside what movers can't carry; with the list typed, it names what's on it.
      const prep = N.won.prep_items.map((x, i) => (i === 0 && hazards.length ? `set aside what's on your list that movers can't carry (${hazards.join(', ')}), and anything else flammable or under pressure` : x));

      const messages = [
        {
          key: 'estimate',
          label: `Estimate text to ${first === 'there' ? 'your customer' : first}`,
          text: text.plain(`Hi ${first}, ${me}. For your ${lower(e.home.label)} (${e.job.say}), I'd plan ${e.crew} movers for ${hoursSay}. At ${usd(e.rate)} per mover per hour that's ${priceSay}${fees}. We bill the actual time, with a ${C.min_hours} hour minimum, and you drive the truck.${spec} ${N.offer.promise} Want me to hold ${date || 'your moving day'}?`),
        },
        {
          key: 'prep',
          label: 'Prep text, 2 days before',
          text: text.plain(`Hi ${first}, a few things before ${date || 'moving day'}: ${prep.join('; ')}.${e.perishables.length ? ' Plants and food ride with you, not in the truck.' : ''} See you ${start ? `at ${start}` : 'then'}!`),
        },
        {
          key: 'crew',
          label: 'Crew text, the night before',
          text: text.plain(`Tomorrow${start ? ` at ${start}` : ''}: ${lower(e.home.label)}, ${e.job.say}${input.from ? ` at ${clean(input.from, 200)}` : ''}${input.to && e.ends.includes('unload') && e.ends.length > 1 ? `, then ${clean(input.to, 200)}` : ''}. ${e.crew} movers, ${hoursSay}.${heavyNames.length ? ` Heavy: ${text.list(heavyNames)}.` : ''} Bring: ${bring.join('; ')}. Labor only: the customer drives the truck.`),
        },
      ];

      const pal = print.paletteFor(cfg, input.color);
      const html = await save.saveFile(
        ctx,
        save.fileName(f.business, customer || 'move', 'move-day plan', '.html'),
        page.movePlan(cfg, { customer, business: f.business, first: f.first, phone: f.phone, link: f.link, date, start, from: clean(input.from, 200), to: clean(input.to, 200), truck: clean(input.truck, 80), notes: clean(input.notes, 600), est: e }, pal),
      );
      const chart = C.sources.chart;
      return {
        ...(customer ? { customer } : {}),
        home: e.home.label,
        job: e.job.label,
        crew: e.crew,
        chartCrew: e.chartCrew,
        hours: e.hours,
        moverHours: e.moverHours,
        rate: e.rate,
        ...(e.fee ? { heavyFee: e.fee } : {}),
        price: e.price,
        items: e.items.map(({ label, detail, qty, unit, price }) => ({ label, ...(detail ? { detail } : {}), qty, unit, price })),
        title: text.clip(`Moving labor (${lower(e.home.label)}, ${e.job.say})`, 110),
        notes: text.clip(`Labor only: we load and unload, and you rent and drive the truck. Hours are an estimate: we bill the actual time at ${usd(e.rate)} per mover per hour, with a ${C.min_hours} hour minimum.${spec} ${N.offer.promise}`, 900),
        why: e.why,
        warnings: e.warnings,
        heavy: e.heavy.map(({ id: hid, label, qty }) => ({ id: hid, label, qty })),
        specialist: e.specialist,
        appliances: e.appliances,
        hazards: e.hazards,
        perishables: e.perishables,
        plan: page.steps(e).map((s) => ({ step: s.step, ...(s.hours ? { hours: s.hours } : {}), do: s.do })),
        messages,
        laborOnly: C.labor_only,
        source: { publisher: chart.publisher, url: chart.url, checked: C.checked },
        files: { html },
      };
    },
    view(out) {
      const usd = crew.money;
      const first = out.customer ? out.customer.split(/\s+/)[0] : '';
      return views.blocks(
        views.metric(`Crew and hours${out.customer ? ` for ${out.customer}` : ''}`, `${out.crew} movers, about ${crew.hrs(out.hours.est)} hours`, `${crew.hrs(out.hours.low)} to ${crew.hrs(out.hours.high)} hours on the clock. About ${usd(out.price.est)} at ${usd(out.rate)} per mover per hour.`),
        out.warnings.map((w) => views.text(w)),
        views.table([{ key: 'label', label: 'Item' }, { key: 'qty', label: 'Qty', format: 'number' }, { key: 'price', label: 'Price', format: 'money' }], out.items),
        views.text(`How the hours were worked out: ${out.why.join(' ')}`),
        out.job === crew.JOBS[0].label ? views.text('The hours count loading and unloading. The drive between is not in them: decide before you send it whether you bill that time.') : null,
        out.heavyFee ? views.text(`Heavy items: ${usd(out.heavyFee)} each from your price menu, on top of the time. HireAHelper calls it a surcharge; change it on your menu.`) : null,
        out.specialist.map((s) => views.text(`${s.label}: ${s.say}`)),
        out.appliances.map((a) => views.text(`${a.label}: ${a.say}`)),
        out.hazards.length ? views.text(`Movers can't carry: ${out.hazards.map((h) => `${h.found} (${h.group.toLowerCase()})`).join(', ')}. The prep text asks ${first || 'the customer'} to set them aside.`) : null,
        out.messages.map((m) => views.copy(m.label, m.text)),
        views.file(out.files.html, 'Move-day plan: print one for the crew and send one to the customer'),
        views.text(out.laborOnly.join(' ')),
        views.link(`${out.source.publisher}: estimating job times`, out.source.url),
      );
    },
  };
}

module.exports = { crewPlanTool };
