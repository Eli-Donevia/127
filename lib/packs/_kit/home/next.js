// "Your next 25" for a household pack: the next batch of local businesses that serve the same
// customers (10 to 100, default 25), skipping everyone already in the Pipeline (kit leads.known:
// keys, names and website domains), plus any new people the member types. Every row is saved to the
// Pipeline with what Do my day hands out each morning: msg, facts, score and channel for businesses
// (D29), warm: true with the personal text and follow-ups for people. OpenStreetMap businesses carry
// the credit on screen and as the CSV's last row (D27). Shared household spine.

const { text, views, save, files, time, places, first25, leads, web } = require('..');
const offer = require('./offer');
const words = require('./words');
const geo = require('./geo');
const find = require('./find');
const pipe = require('./pipeline');
const T = require('./tools');

function nextTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  const TX = N.texts;
  return {
    name: `${id}.next_batch`,
    title: 'Find your next batch',
    description: `The next local businesses that serve the same customers (${text.list(N.partners.map((p) => p.label.toLowerCase()))}), none already in your Pipeline, each with a message, a walk-in line and follow-ups, plus personal texts for any new people you add. All saved to your Pipeline for Do my day.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['osm'],
    credits: 5,
    timeoutSec: 300,
    input: {
      type: 'object',
      properties: {
        city: { type: 'string', maxLength: 80, title: 'Your city and state' },
        count: { type: ['integer', 'string'], title: 'How many', minimum: 10, maximum: 100, default: 25 },
        kind: { type: 'string', enum: N.partners.map((p) => p.label), title: 'Only one kind of business (optional)' },
        people: { type: 'string', maxLength: 4000, title: 'New people you know (optional)' },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
      },
    },
    output: {
      type: 'object',
      required: ['partners', 'people', 'files'],
      properties: { count: { type: 'integer' }, partners: { type: 'array' }, people: { type: 'array' }, saved: { type: 'integer' }, inPipeline: { type: 'integer' }, files: { type: 'object' }, credit: { type: 'string' }, sample: { type: 'boolean' }, notes: { type: 'array' } },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const want = Math.max(10, Math.min(100, Math.round(Number(input.count) || 25)));
      const loc = await geo.locate(ctx, f.place, { network: true });
      const menu = offer.menuFor(ctx, cfg, {});
      const { lead: lo } = T.leadFor(ctx, cfg, menu, { lat: loc.lat });
      const kind = N.partners.find((t) => t.label === input.kind || t.id === input.kind);
      const types = kind ? [kind] : N.partners;

      // Everyone already in the Pipeline, from every pack: keys, names and website domains.
      const known = await leads.known(ctx);
      const sites = known.sites;
      const skip = (b) => !!(b.website && sites.has(web.domainOf(b.website)));
      const typedPeople = first25.parsePeople(input.people || '', { max: 50 }).filter((p) => !known.names.has(p.name.toLowerCase()) && !known.keys.has(`person:${pipe.norm(p.name).slice(0, 80)}`));
      const room = Math.max(0, want - typedPeople.length);
      const found = room ? await find.findPartners(ctx, cfg, { place: f.place, center: loc, types, limit: room, exclude: [...known.keys, ...known.names], skip, per: Math.min(60, Math.ceil(room / types.length) + 12) }) : { partners: [], notes: [], source: 'none', sample: false };

      // Messages: the niche's own texts for people, the partner ask for businesses.
      const people = typedPeople.map((p, i) => {
        const v = T.textVars(cfg, f, lo, { greet: p.greet });
        return { ...p, message: words.fill(words.pick(TX.people, `${p.name}${i}`), v), follow_up: words.fill(TX.people_follow_up, v), follow_up_2: words.fill(TX.people_follow_up_2, v) };
      });
      const o = { what: N.what, area: f.area, me: f.first };
      const partners = found.partners.map((b) => {
        const type = N.partners.find((t) => t.id === b.type) || {};
        const m = first25.partnerMessage(b, type, o);
        return { ...b, typeId: b.type, type: type.label || b.type, message: m.message, walk_in: m.walk_in, maps: b.sourceUrl || '' };
      });

      // The Pipeline: real businesses and typed people, never sample businesses or a sample run.
      const rows = [...people.map((p) => pipe.personRow(p, { source: 'Your next 25' })), ...partners.filter((p) => p.source === 'osm').map((p) => T.partnerRow(cfg, f, p, { source: 'Your next 25' }))];
      const saved = await pipe.saveRows(ctx, rows);

      // The CSV, with the OpenStreetMap credit as the last row.
      const today = time.today(ctx);
      const csvRows = [
        ...people.map((p) => ({ who: 'Person you know', name: p.name, contact: p.phone || p.email || '', note: p.note, message: p.message, follow1: p.follow_up, on1: time.addDays(today, 3), link: '' })),
        ...partners.map((p) => ({ who: `${p.sample || p.source === 'sample' ? 'Sample business (made up)' : 'Business'}: ${p.type}`, name: p.name, contact: [p.phone, p.website].filter(Boolean).join(' '), note: p.address, message: p.message, follow1: p.walk_in, on1: time.addDays(today, 1), link: p.maps || '' })),
      ];
      const credit = places.creditLine(partners);
      if (credit) csvRows.push({ who: credit });
      const csv = files.csv(csvRows, [
        { key: 'who', label: 'Who' },
        { key: 'name', label: 'Name' },
        { key: 'contact', label: 'Contact' },
        { key: 'note', label: 'Note' },
        { key: 'message', label: 'First message' },
        { key: 'follow1', label: 'Follow-up or walk-in line' },
        { key: 'on1', label: 'On' },
        { key: 'link', label: 'Map link' },
      ]);
      // Dated, so a weekly repeat never overwrites last week's list (contract 4d).
      const asset = await save.saveFile(ctx, save.fileName(f.business, 'next', String(people.length + partners.length), time.today(ctx), '.csv'), csv);
      const notes = [...(found.notes || [])];
      if (input.people && typedPeople.length < first25.parsePeople(input.people, { max: 50 }).length) notes.push('Some of the people you typed are already in your Pipeline, so they were skipped.');
      if (!found.sample && partners.length && partners.length < room) notes.push(`We found ${partners.length} new businesses near ${f.place}. Try a nearby town for more.`);
      return {
        count: people.length + partners.length,
        city: f.place,
        partners: partners.map((p) => ({ name: p.name, type: p.type, km: p.km, address: p.address, phone: p.phone, website: p.website, message: p.message, walk_in: p.walk_in, source: p.source, ...(p.searchBy ? { searchBy: p.searchBy } : {}) })),
        people: people.map((p) => ({ name: p.name, note: p.note, message: p.message })),
        saved,
        inPipeline: known.keys.size,
        files: { csv: asset },
        credit,
        sample: !!found.sample,
        notes,
      };
    },
    view(out) {
      return views.blocks(
        views.metric('Your next batch', out.count, `${out.partners.length} businesses${out.people.length ? ` and ${out.people.length} people you know` : ''}, none already in your Pipeline`),
        out.saved ? views.text(`Saved ${out.saved} to your Pipeline with their messages. Do my day hands out the best ones each morning, with follow-ups when they're due.`) : null,
        out.partners.length ? views.table([{ key: 'name', label: 'Business' }, { key: 'type', label: 'Kind' }, { key: 'mi', label: 'Miles away', format: 'number' }, { key: 'walk_in', label: 'Walk-in line' }], out.partners.map((p) => ({ name: p.name, type: p.type, mi: T.miles(p.km), walk_in: p.walk_in }))) : null,
        places.creditBlocks(out.partners),
        out.people.length ? views.table([{ key: 'name', label: 'Person' }, { key: 'message', label: 'Text to send' }], out.people) : null,
        out.sample && !(out.notes || []).some((n) => /sample/i.test(n)) ? views.text('These are sample businesses, made up so you can see how it works. Run it again to list real ones near you.') : null,
        (out.notes || []).map((n) => views.text(n)),
        views.file(out.files.csv, 'The batch with messages and dates (CSV)'),
      );
    },
  };
}

module.exports = { nextTool };
