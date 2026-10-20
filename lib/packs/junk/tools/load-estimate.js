// The signature tool for junk removal, the load estimate: a typed or pasted list of items gives the
// share of the truck from the sourced volume table (data/items.json), the price from the member's
// menu over the sourced load ranges (data/prices.json), the items that need special disposal with
// the state's note where a source has one and "check your county" where rules vary
// (data/disposal.json), and the dump fee from the rate per ton the member types. The line items go
// to the Sales desk as a quote and, once they say yes, an invoice. The member's dump numbers are kept
// in this pack's memory, so they type them once.

const { text, views, save, time, brain, money } = require('../../_kit');
const T = require('../../_kit/home/tools');
const offer = require('../../_kit/home/offer');
const qt = require('../../_kit/home/quote');
const geo = require('../../_kit/home/geo');
const words = require('../../_kit/home/words');
const print = require('../../_kit/home/print');
const E = require('../lib/estimate');
const { loadSheet } = require('../lib/sheet');
const TABLE = require('../data/items.json');
const D = require('../data/disposal.json');

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
const MEMORY = 'dump';
const DUMP_KEYS = ['dump_rate', 'dump_min', 'appliance_fee', 'tire_fee', 'truck', 'payload'];
const money10 = (title) => ({ type: 'string', maxLength: 10, title });
const usd = (n) => T.usd(Math.round(n));

const STR = { type: 'string' };
const NUM = { type: 'number' };
const STRS = { type: 'array', items: STR };

function loadEstimateTool(cfg) {
  const id = cfg.id;
  const factors = cfg.prices.factors || [];
  const accessF = factors.find((f) => f.id === 'access');
  const materialF = factors.find((f) => f.id === 'material');
  return {
    name: `${id}.estimate_load`,
    title: 'Estimate this load',
    description: 'A typed or pasted list of items: the share of your truck from a sourced volume table, the price from your menu, the items that need special disposal where you work, and the dump fee from the rate per ton you type. The lines go to a quote and an invoice, with a text and a printable estimate for the customer.',
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
        items: { type: 'string', maxLength: 4000, format: 'textarea', title: 'What goes' },
        access: { type: 'string', enum: accessF.options.map((o) => o.label), default: accessF.options[0].label, title: accessF.label },
        material: { type: 'string', enum: [E.AUTO, ...materialF.options.map((o) => o.label)], default: E.AUTO, title: materialF.label },
        dump_rate: money10('Dump fee per ton'),
        dump_min: money10('Dump minimum per trip'),
        appliance_fee: money10('Dump fee per appliance with refrigerant'),
        tire_fee: money10('Dump fee per tire'),
        truck: money10('Your truck or trailer, cubic yards'),
        payload: money10('Your payload, pounds'),
        city: { type: 'string', maxLength: 80, title: 'City and state' },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: {
      type: 'object',
      required: ['customer', 'title', 'items', 'subtotal', 'notes', 'text', 'next', 'load', 'lines', 'unknown', 'flags', 'keepOut', 'weight', 'dump', 'advice', 'state', 'sources', 'files'],
      properties: {
        customer: STR,
        title: STR,
        items: { type: 'array', items: { type: 'object', required: ['label', 'qty', 'unit', 'price'], properties: { label: STR, detail: STR, qty: NUM, unit: STR, price: NUM } } },
        subtotal: NUM,
        notes: STR,
        text: STR,
        next: { type: 'array', items: { type: 'object', properties: { label: STR, invoice: { type: 'boolean' } } } },
        load: { type: 'object', required: ['cubicFeet', 'cubicYards', 'eighths', 'fullLoads', 'fraction', 'material'], properties: { cubicFeet: NUM, cubicYards: NUM, eighths: { type: 'integer' }, fullLoads: { type: 'integer' }, fraction: STR, material: STR, heavyShare: NUM, text: STR } },
        lines: { type: 'array', items: { type: 'object', required: ['text', 'as', 'qty', 'cubicFeet', 'pounds', 'kind'], properties: { text: STR, as: STR, qty: NUM, cubicFeet: NUM, pounds: NUM, kind: STR } } },
        unknown: STRS,
        flags: { type: 'array', items: { type: 'object', required: ['id', 'label', 'items', 'text'], properties: { id: STR, label: STR, items: STRS, text: STR, state: STR } } },
        keepOut: { type: 'array', items: { type: 'object', required: ['label', 'text'], properties: { label: STR, text: STR, where: STR } } },
        weight: { type: 'object', required: ['pounds', 'tons', 'note'], properties: { pounds: NUM, tons: NUM, note: STR } },
        dump: { type: 'object', required: ['typed', 'trips', 'note'], properties: { typed: { type: 'boolean' }, rate: NUM, minimum: NUM, trips: { type: 'integer' }, truck: STR, fee: NUM, itemFees: NUM, total: NUM, left: NUM, note: STR } },
        advice: STRS,
        state: STR,
        sources: { type: 'array', items: { type: 'object', properties: { publisher: STR, url: STR } } },
        files: { type: 'object', required: ['sheet'], properties: { sheet: ASSET } },
      },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      if (!String(input.items || '').trim()) throw new Error('Type or paste what goes, one item per line, like "sofa" or "10 bags of trash".');
      const customer = text.clip(text.plain(input.customer || '').trim(), 80) || 'Customer';
      const state = geo.parsePlace(f.place).state || '';
      const menu = offer.menuFor(ctx, cfg, {});
      const r = E.estimate(cfg, menu, input, state);
      if (r.error) throw new Error(r.error);

      // The dump numbers: what they typed now, else what they typed last time.
      const mem = brain.packMemory(ctx, id)[MEMORY] || {};
      const typedNow = Object.fromEntries(DUMP_KEYS.filter((k) => String(input[k] || '').trim()).map((k) => [k, text.clip(String(input[k]).trim(), 10)]));
      const dumpIn = { ...mem, ...typedNow };
      if (Object.keys(typedNow).length) await brain.remember(ctx, MEMORY, dumpIn);
      const dumpTyped = E.dumpInputs(dumpIn);
      const d = E.dumpFee({ cubicFeet: r.load.cubicFeet, pounds: r.pounds, fridges: r.fridges, tires: r.tires }, dumpTyped);
      const ownJobs = unique(r.parts.filter((l) => l.kind === 'package').map((l) => l.entry.label.toLowerCase()));
      const weightNote = `${TABLE.weight.basis}${ownJobs.length ? ` The ${text.list(ownJobs)} ${ownJobs.length > 1 ? 'are' : 'is'} not in the weight: add ${ownJobs.length > 1 ? 'their' : 'its'} dump fee yourself.` : ''}`;
      const dump = d.typed
        ? {
            typed: true,
            rate: d.rate,
            minimum: d.minimum,
            trips: d.trips,
            truck: d.truck,
            fee: d.fee,
            itemFees: d.itemFees,
            total: d.total,
            left: Math.round((r.subtotal - d.total) * 100) / 100,
            note: `${d.trips} ${d.trips === 1 ? 'trip' : 'trips'} to the dump in ${d.truck}, by space and by weight, at ${usd(d.rate)} a ton${d.minimum ? ` with a ${usd(d.minimum)} minimum a trip` : ''}${d.itemFees ? `, plus ${T.usd(d.itemFees)} in appliance and tire fees` : ''}. The weight errs high, so the fee does too. Check your transfer station's current rates.`,
          }
        : { typed: false, trips: d.trips, truck: d.truck, note: `Type your transfer station's rate per ton to see the dump fee and what's left after it. ${D.dump_examples.member}` };

      // What the customer reads: the price lines, what stays out, what to do first, what gets a look on site.
      const flags = r.flags;
      const keepOut = flags.filter((x) => x.keepOut).map((x) => ({ label: x.label, text: x.customer, where: x.text }));
      const before = unique(flags.filter((x) => !x.keepOut && x.customer).map((x) => x.customer));
      const onsiteNames = r.onsite.map((l) => l.text);
      const unsureNames = r.parts.filter((l) => l.check).map((l) => l.text);
      const extra = [
        ...before,
        onsiteNames.length ? `I price the ${text.list(onsiteNames.map((s) => s.toLowerCase()))} on site.` : '',
        unsureNames.length ? `I'll size up the ${text.list(unsureNames.map((s) => s.toLowerCase()))} when I see ${unsureNames.length > 1 ? 'them' : 'it'}.` : '',
      ].filter(Boolean);
      const first = customer === 'Customer' ? 'there' : customer.split(/\s+/)[0];
      const msg = words.fill(cfg.niche.texts.estimate, {
        customer: first,
        first: f.first,
        business: f.business,
        load: r.load.text,
        lines: qt.itemLines(r.items).join('; '),
        total: T.usd(r.subtotal),
        keep_out: keepOut.length ? ` ${keepOut.map((k) => k.text).join(' ')}` : '',
        prep: extra.length ? ` ${extra.join(' ')}` : '',
        promise: cfg.niche.offer.promise,
      });

      // Advice from the quote data (heavy debris, stairs, a hot tub or piano), the covered-load rule and donation.
      const have = { material: [r.load.material === materialF.options.find((o) => o.id === 'heavy').label ? 'heavy' : 'household'], access: [accessF.options.find((o) => o.label === r.access).id], load: r.items.map((it) => (menu.packages.find((p) => p.label === it.label) || {}).id).filter(Boolean) };
      const advice = [];
      for (const a of cfg.niche.quote.advice || []) {
        const keys = Object.keys(a.when || {});
        if (keys.length && keys.every((k) => have[k] && [].concat(a.when[k]).some((w) => have[k].includes(w)))) advice.push(a.say);
      }
      if (r.auto && have.material[0] === 'heavy') advice.push(`Priced as heavy debris: by the table, construction debris, dirt, concrete or shingles are ${Math.round(r.load.heavyShare * 100)} percent of the space. ${TABLE.heavy_share.basis}`);
      if (r.load.eighths % 8 === 3 || r.load.eighths % 8 === 5 || r.load.eighths % 8 === 7) advice.push(TABLE.eighths.basis);
      advice.push(D.covered_load.member);
      if (r.parts.some((l) => l.kind === 'item')) advice.push(D.donation.member);

      const used = new Map();
      for (const s of Object.values(TABLE.sources)) used.set(s.url, s.publisher);
      for (const rule of D.rules.filter((x) => flags.some((fl) => fl.id === x.id))) for (const s of rule.sources) used.set(s.url, s.publisher);
      for (const s of [...D.covered_load.sources, ...(d.typed ? [] : D.dump_examples.sources)]) used.set(s.url, s.publisher);
      const sources = [...used].map(([url, publisher]) => ({ publisher, url }));

      const title = text.clip(`${cfg.niche.name}: ${r.load.eighths ? r.load.fraction : r.packages.join(', ')}${r.load.eighths && r.packages.length ? ` plus ${r.packages.map((p) => p.toLowerCase()).join(', ')}` : ''}`, 110);
      const notes = [
        r.load.eighths ? `Estimated from your list: about ${r.load.fraction} (${r.load.cubicYards} cubic yards), confirmed on site before loading.` : 'Estimated from your list, confirmed on site before loading.',
        ...keepOut.map((k) => k.text),
        cfg.niche.offer.promise,
      ].join(' ');

      const date = time.today(ctx);
      const pal = print.paletteFor(cfg, input.color);
      const counted = r.parts.filter((l) => l.counted).map((l) => ({ label: l.entry && l.kind !== 'unknown' ? l.entry.label : `${cap(l.text)} (a guess until I see it)`, qty: howMany(l), cubicFeet: l.cubicFeet }));
      const sheetHtml = loadSheet(cfg, {
        customer,
        business: f.business,
        first: f.first,
        phone: f.phone,
        link: f.link,
        area: f.area,
        dateText: time.longDate(date),
        load: r.load,
        counted,
        items: r.items,
        subtotal: r.subtotal,
        keepOut: keepOut.map((k) => k.text),
        before,
        onsite: onsiteNames.map((n) => `${cap(n)}: priced on site`),
        unsure: unsureNames.map((n) => `${cap(n)}: I size it up on site`),
        promise: cfg.niche.offer.promise,
      }, pal);
      const sheet = await save.saveFile(ctx, save.fileName(customer, 'load estimate', date, '.html'), sheetHtml);

      return {
        customer,
        title,
        items: r.items.map(({ label, detail, qty, unit, price }) => ({ label, ...(detail ? { detail: text.clip(detail, 290) } : {}), qty, unit, price })),
        subtotal: r.subtotal,
        notes,
        text: msg,
        next: [
          { label: 'They said yes: make the invoice', invoice: true },
          { label: 'Not yet: keep the quote', invoice: false },
        ],
        load: { cubicFeet: r.load.cubicFeet, cubicYards: r.load.cubicYards, eighths: r.load.eighths, fullLoads: r.load.fullLoads, fraction: r.load.fraction, material: r.load.material, heavyShare: r.load.heavyShare, text: r.load.text },
        lines: r.parts.map((l) => ({ text: l.text, as: asLabel(l), qty: l.qty, cubicFeet: Math.round(l.cubicFeet * 10) / 10, pounds: Math.round(l.pounds), kind: l.kind })),
        unknown: r.unknown,
        flags: flags.map((x) => ({ id: x.id, label: x.label, items: x.items, text: x.text, ...(x.state ? { state: x.state } : {}) })),
        keepOut,
        weight: { pounds: Math.round(r.pounds), tons: Math.round((r.pounds / 2000) * 100) / 100, note: weightNote },
        dump,
        advice,
        state,
        sources,
        files: { sheet },
      };
    },
    view(out) {
      const who = out.customer === 'Customer' ? 'the customer' : out.customer.split(/\s+/)[0];
      return views.blocks(
        views.metric(`Estimate for ${out.customer}`, out.subtotal, out.load.eighths ? `About ${out.load.fraction}, ${out.load.cubicYards} cubic yards, ${out.load.material.toLowerCase()}` : out.title),
        views.table([{ key: 'label', label: 'Line' }, { key: 'qty', label: 'Qty', format: 'number' }, { key: 'price', label: 'Price', format: 'money' }], out.items),
        views.table([{ key: 'text', label: 'You typed' }, { key: 'as', label: 'Counted as' }, { key: 'cubicFeet', label: 'Cubic feet', format: 'number' }, { key: 'pounds', label: 'Pounds', format: 'number' }], out.lines),
        out.unknown.length ? views.text(`Check by eye: ${out.unknown.join(' ')}`) : null,
        out.flags.map((x) => views.text(`${x.label} (${x.items.join(', ')}): ${x.text}`)),
        out.dump.typed ? views.metric('Dump fee', out.dump.total, out.dump.note) : views.text(out.dump.note),
        out.dump.typed ? views.text(`Left after the dump fee: ${T.usd(Math.round(out.dump.left))}, before gas, help and your time.`) : null,
        views.text(`Weight: about ${money.int(out.weight.pounds)} pounds. ${out.weight.note}`),
        out.advice.map((a) => views.text(a)),
        views.copy(`Text to ${who}`, out.text),
        views.file(out.files.sheet, 'Load estimate for the customer: print it or send it'),
        views.text(`Volumes from the Washington UTC cube sheet, two moving volume surveys, EPA weights and the haulers' truck sizes; disposal rules from EPA and state agencies, checked ${TABLE.checked}. ${D.disclaimer}`),
      );
    },
  };
}

const unique = (xs) => [...new Set(xs)];
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const UNIT_WORDS = { yd3: ['cubic yard', 'cubic yards'], ft3: ['cubic foot', 'cubic feet'], pickup: ['pickup load', 'pickup loads'], lb: ['pound', 'pounds'], ton: ['ton', 'tons'] };
const shown = (n) => String(Math.round(n * 100) / 100);

// "2", "1 cubic yard", "3 bags", "not typed": how much of a line, in the customer's words.
function howMany(l) {
  if (l.unit) return `${shown(l.qty)} ${UNIT_WORDS[l.unit][l.qty === 1 ? 0 : 1]}`;
  if (l.container) return `${shown(l.qty)} ${l.container.container}${l.qty === 1 ? '' : l.container.container === 'box' ? 'es' : 's'}`;
  if (l.kind === 'material') return 'not typed';
  return shown(l.qty);
}

// What a line was counted as: the table's label, the amount typed, or "not in the table".
function asLabel(l) {
  if (l.kind === 'unknown') return 'Not in the table';
  if (l.kind === 'amount') return l.entry ? `${l.entry.label} (amount typed)` : 'Amount typed';
  if (l.kind === 'material') {
    if (l.unit) return `${l.entry.label} (amount typed)`;
    if (l.container) return `${l.entry.label} (${l.container.container}s)`;
    return `${l.entry.label} (no amount typed)`;
  }
  if (l.kind === 'keep_out') return `${l.entry.label}: stays out of the truck`;
  if (l.kind === 'package') return `${l.entry.label}: priced as its own job`;
  if (l.kind === 'onsite') return `${l.entry.label}: priced on site`;
  return l.entry.label;
}

module.exports = { loadEstimateTool, MEMORY };
