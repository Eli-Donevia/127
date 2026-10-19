// Saves the list where the member works from it: a CSV (one row per business with every message and
// a send date), the "Your first 25" workbook (HTML), calendar reminders for the 7-day plan, and the
// member's Pipeline. Google listings keep only the place ID and website facts (Places terms).

const { views, save, files, leads, time, text, places } = require('../../_kit');
const { serviceOf, planDays, sendDay, DATA } = require('../lib/services');
const pages = require('../lib/pages');
const RULES = require('../data/rules.json');
const { visitData } = require('../lib/visits');

module.exports = {
  name: 'leads.export',
  title: 'Save your list',
  description: 'Saves the ranked list with every message to a CSV, a printable workbook with a 7-day plan, calendar reminders and your Pipeline (place IDs and website facts only for Google listings).',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      leads: { type: 'array', title: 'Ranked businesses', description: 'leads from leads.score_fit' },
      messages: { type: 'array', title: 'Messages', description: 'messages from leads.write_outreach (optional)' },
      edits: { type: 'array', title: 'Edited messages', description: 'items from an approve step over leads.write_outreach review (optional)' },
      service: { type: 'string', title: 'What you sell' },
      pipeline: { type: 'boolean', default: true, title: 'Add them to your Pipeline' },
    },
    required: ['leads', 'service'],
  },
  output: { type: 'object', properties: { csv: { type: 'object' }, workbook: { type: 'object' }, saved: { type: 'integer' }, days: { type: 'array' } }, required: ['csv', 'workbook', 'saved', 'days'] },
  async run(input, ctx) {
    const service = serviceOf(input.service);
    const list = (input.leads || []).filter((l) => l && l.key && !l.error);
    if (!list.length) throw new Error('No businesses to save.');
    const byKey = new Map((input.messages || []).filter((m) => m && m.key).map((m) => [m.key, m]));
    for (const e of input.edits || []) {
      const m = e && byKey.get(e.key);
      if (!m || !e.text) continue;
      const ch = String(e.channel || '');
      if (/instagram|facebook/i.test(ch)) m.dm = text.plain(e.text);
      else if (/call/i.test(ch)) m.call = text.plain(e.text);
      else if (/walk/i.test(ch)) m.walkIn = text.plain(e.text);
      else m.email = { ...m.email, body: String(e.text) };
    }
    const days = planDays(ctx);
    const rows = list.map((l, i) => {
      const m = byKey.get(l.key) || {};
      const rank = l.rank || i + 1;
      const day = days[sendDay(rank) - 1];
      return { ...leads.csvRow({ ...l, rank }, m, { sendOn: day.date, service }), send_label: day.label, chips: leads.shareableGaps(l).filter((g) => g.say).map((g) => g.chip) };
    });
    const cat = list[0].category || {};
    const city = places.cityShort(list[0].city || '');
    const title = `${service.label} for ${cat.many || 'local businesses'}${city ? ` in ${city}` : ''}`;
    const base = save.fileName('first 25', service.label, cat.many || 'businesses', city);
    // OpenStreetMap's credit rides in the spreadsheet and the workbook (ODbL).
    const credit = places.creditLine(list);
    const csv = await save.saveFile(ctx, `${base}.csv`, files.csv(credit ? rows.concat([{ rank: credit }]) : rows, leads.CSV_COLUMNS, { bom: true }));
    const google = list.some((l) => l.source === 'google');
    const attribution = google ? 'Businesses found with Google Maps. Names and details come from each business\'s own website.' : credit ? '' : list[0].attribution || '';
    const html = pages.workbookHtml({ title, subtitle: `${list.length} businesses, ranked by fit. Checked ${time.longDate(time.today(ctx))}.`, days, rows, replies: require('../../_kit').outreach.replies({ lead: list[0], service, sender: {} }), rules: RULES.send_rules, attribution, credit: places.creditHtml(list), sample: list.some((l) => l.sample) });
    const workbook = await save.saveFile(ctx, `${base}.html`, html);
    const tz = time.tzOf(ctx);
    const events = days.map((d) => ({ uid: `${base}-day${d.day}@127group.io`, title: `First 25, day ${d.day}`, description: d.todo, date: d.date, time: '09:00', minutes: 45, tz }));
    const calendar = await save.saveFile(ctx, `${base}.ics`, files.ics(events, { name: 'Your first 25', now: ctx.now() }));
    let saved = 0;
    if (input.pipeline && ctx.leads && typeof ctx.leads.upsert === 'function') {
      for (const l of list) {
        const m = byKey.get(l.key);
        try {
          const row = leads.pipelineLead(l, { service, message: m ? m.dm : '', draft: m });
          // Where the business came from (so later lists carry its credit) and, for OpenStreetMap and
          // sample businesses, what the call sheet and walk-in route need. Google listings keep only
          // the place ID (Places terms), so none of this is saved for them.
          row.data = { ...row.data, from: l.source || null, ...(l.searchBy ? { searchBy: l.searchBy } : {}), ...visitData(l, m) };
          await ctx.leads.upsert(row);
          saved++;
        } catch {
          /* one bad row doesn't stop the rest */
        }
      }
    }
    ctx.log(`Saved ${list.length} businesses${saved ? ` and added ${saved} to your Pipeline` : ''}`);
    return { csv, workbook, calendar, saved, days, plan: DATA.plan, sample: list.some((l) => l.sample) };
  },
  view(out) {
    return views.blocks(
      views.metric('Saved to your Pipeline', out.saved, 'stage: found. Mark each one contacted when you send.'),
      views.file(out.workbook, 'Your first 25 workbook (plan and every message)'),
      views.file(out.csv, 'The list as a spreadsheet (CSV)'),
      views.file(out.calendar, 'Reminders for the 7-day plan (calendar file)'),
      views.table([{ key: 'label', label: 'Day' }, { key: 'todo', label: 'To do' }], out.days, 7)
    );
  },
};
