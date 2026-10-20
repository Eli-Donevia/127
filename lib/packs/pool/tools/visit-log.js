// The signature tool for pool cleaning, the visit log card: the readings typed after a visit give a
// printable log for the owner's file, the text to send the owner with what was done, and a flag on any
// reading outside CDC's ranges for home pools and hot tubs (data/chemistry.json, lib/visit.js). It
// never works out a dose or says what to add: a flag says what CDC says and points to the label.
// The last visits for each pool are kept in this pack's memory, so the log shows the trend.

const { text, views, save, time, brain } = require('../../_kit');
const T = require('../../_kit/home/tools');
const print = require('../../_kit/home/print');
const visit = require('../lib/visit');
const page = require('../lib/page');

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
const reading = (title) => ({ type: 'string', maxLength: 12, title });
const MEMORY = 'visits';

function visitLogTool(cfg) {
  const id = cfg.id;
  return {
    name: `${id}.log_visit`,
    title: 'Log a pool visit',
    description: "The readings you typed after a pool or hot tub visit: a printable visit log, the text to send the owner with what you did, and a flag on any free chlorine or pH reading outside CDC's ranges. It never says what or how much to add: each product's label does.",
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      required: ['customer'],
      properties: {
        customer: { type: 'string', maxLength: 120, title: 'Whose pool' },
        kind: { type: 'string', enum: visit.KINDS, default: visit.KINDS[0], title: 'Pool or hot tub' },
        fc: reading('Free chlorine, ppm'),
        ph: reading('pH'),
        cya: reading('Stabilizer (cyanuric acid), ppm'),
        stabilizer: { type: 'string', enum: visit.STABILIZER, title: 'Uses stabilizer?' },
        test: { type: 'string', enum: visit.TESTS, title: 'Test used' },
        alk: reading('Total alkalinity, ppm'),
        hardness: reading('Calcium hardness, ppm'),
        salt: reading('Salt, ppm'),
        temp: reading('Water temperature, F'),
        other: { type: 'string', maxLength: 200, title: 'Other readings' },
        done: { type: 'string', maxLength: 600, format: 'textarea', title: 'What you did' },
        added: { type: 'string', maxLength: 300, title: 'What you added' },
        notes: { type: 'string', maxLength: 600, format: 'textarea', title: 'Notes for the owner' },
        next: { type: 'string', maxLength: 60, title: 'Next visit' },
        date: { type: 'string', maxLength: 10, title: 'Visit date' },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: {
      type: 'object',
      required: ['customer', 'date', 'kind', 'rows', 'flags', 'notes', 'done', 'text', 'fill', 'inRange', 'history', 'files'],
      properties: {
        customer: { type: 'string' },
        date: { type: 'string' },
        dateText: { type: 'string' },
        kind: { type: 'string', enum: ['pool', 'spa'] },
        rows: { type: 'array', items: { type: 'object', required: ['reading', 'value', 'range', 'status', 'flag'], properties: { key: { type: 'string' }, reading: { type: 'string' }, value: { type: 'string' }, range: { type: 'string' }, status: { type: 'string' }, flag: { type: 'boolean' } } } },
        flags: { type: 'array', items: { type: 'string' } },
        notes: { type: 'array', items: { type: 'string' } },
        done: { type: 'array', items: { type: 'string' } },
        added: { type: 'string' },
        text: { type: 'string' },
        fill: { type: 'boolean' },
        inRange: { type: 'boolean' },
        history: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, fc: { type: ['number', 'null'] }, ph: { type: ['number', 'null'] }, flags: { type: 'integer' } } } },
        safety: { type: 'array', items: { type: 'string' } },
        source: { type: 'object', properties: { publisher: { type: 'string' }, title: { type: 'string' }, url: { type: 'string' }, checked: { type: 'string' } } },
        files: { type: 'object', required: ['html', 'csv'], properties: { html: ASSET, csv: ASSET } },
      },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const customer = text.clip(text.plain(input.customer || '').trim(), 80);
      if (!customer) throw new Error('Type whose pool this is, like "Dana Whitfield".');
      const typed = String(input.date || '').trim();
      const date = /^\d{4}-\d{2}-\d{2}$/.test(typed) && !Number.isNaN(Date.parse(`${typed}T12:00:00Z`)) ? typed : time.today(ctx);
      const dateText = time.longDate(date);
      const c = visit.check(input);
      const done = visit.doneList(text.plain(input.done || ''));
      const added = text.clip(text.plain(input.added || '').trim(), 300);
      const notes = text.clip(text.plain(input.notes || '').trim(), 600);
      const next = text.clip(text.plain(input.next || '').trim(), 60);
      const said = visit.ownerText({ customer, first: f.first, business: f.business, dateText, done, added, check: c, notes, next });

      // This pool's last visits, from this pack's memory, with today's added.
      const mem = brain.packMemory(ctx, id);
      const { book, list: history } = visit.withVisit(mem[MEMORY], customer, date, c);
      await brain.remember(ctx, MEMORY, book);

      const pal = print.paletteFor(cfg, input.color);
      const o = { customer, business: f.business, first: f.first, phone: f.phone, link: f.link, date, dateText, check: c, done, added, notes, next, history };
      const html = await save.saveFile(ctx, save.fileName(customer, c.kind === 'spa' ? 'hot tub log' : 'pool log', date, '.html'), page.visitLog(cfg, o, pal));
      const csv = await save.saveFile(ctx, save.fileName(customer, c.kind === 'spa' ? 'hot tub log' : 'pool log', date, '.csv'), page.visitCsv(o));
      return {
        customer,
        date,
        dateText,
        kind: c.kind,
        rows: c.rows.map(({ key, reading: r, value, range, status, flag }) => ({ key, reading: r, value, range, status, flag })),
        flags: c.flags.map((x) => x.text),
        notes: c.notes,
        done,
        added,
        text: said.text,
        fill: said.fill,
        inRange: c.inRange,
        history,
        safety: visit.C.safety,
        source: { publisher: visit.RANGES.publisher, title: visit.RANGES.title, url: visit.RANGES.url, checked: visit.C.checked },
        files: { html, csv },
      };
    },
    view(out) {
      const thing = out.kind === 'spa' ? 'hot tub' : 'pool';
      return views.blocks(
        views.metric("Readings outside CDC's ranges", out.flags.length, out.flags.length ? "Follow each product's label for what to add and how much." : out.inRange ? 'Free chlorine and pH typed are inside the ranges.' : 'Type free chlorine and pH to check them.'),
        out.flags.length ? views.text(out.flags.join(' ')) : null,
        out.rows.length ? views.table([{ key: 'reading', label: 'Reading' }, { key: 'value', label: 'Today' }, { key: 'range', label: 'CDC range' }, { key: 'status', label: 'Status' }], out.rows) : null,
        out.notes.length ? views.text(out.notes.join(' ')) : null,
        views.copy(`Text to ${out.customer.split(/\s+/)[0]}, after the visit`, out.text),
        out.fill ? views.text('Fill in the [brackets] with what you really did before you send it. The log never says what to add.') : null,
        out.history.length > 1 ? views.table([{ key: 'date', label: 'Visit' }, { key: 'fc', label: 'Free chlorine' }, { key: 'ph', label: 'pH' }, { key: 'flags', label: 'Outside a CDC range' }], out.history.map((h) => ({ date: h.date, fc: h.fc == null ? '' : `${visit.show(h.fc)} ppm`, ph: h.ph == null ? '' : visit.show(h.ph), flags: h.flags || 'None' }))) : null,
        views.file(out.files.html, `Visit log for this ${thing}: print it or send it`),
        views.file(out.files.csv, 'The same readings as a spreadsheet (CSV)'),
        views.text(`Chemical safety: ${out.safety.join(' ')}`),
        views.text(`Ranges from ${out.source.publisher}, checked ${out.source.checked}. Pools at apartments, condos, HOAs and hotels can fall under state and county health rules: check your city and state.`),
        views.link(`CDC: ${out.source.title}`, out.source.url),
      );
    },
  };
}

module.exports = { visitLogTool, MEMORY };
