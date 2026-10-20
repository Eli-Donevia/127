// "Your first 25" for an online store: up to 15 people the member knows, each with a personal note and
// a follow-up, plus up to 10 local places (gift shops and boutiques for wholesale or consignment,
// markets for a vendor table, craft, book and stationery shops, independent cafes) from OpenStreetMap
// through the kit, each with a message, an email version and an in-person line. People and real places
// go to the Pipeline for Do my day; made-up sample places never do. Nothing is sent.

const { views, save, time, text, files, first25, crowd, brain } = require('../../_kit');
const C = require('../../_kit/common');
const S = require('../lib/store');

const { plain } = text;
const { N } = S;

const PEOPLE_NOTES = [
  'Hi {greet}! I just opened {shop}, where I sell {what}. Would you take a look and tell me honestly what you think?{offer} If you know someone who would like it, passing it on would mean a lot.',
  'Hey {greet}, I finally put {what} online at {shop}. Could you give it two minutes and tell me what you would change?{offer} And if someone you know would like it, please send it their way.',
  'Hi {greet}! Quick favor: I started selling {what} online ({shop}). I would love your honest first reaction to the page and the price.{offer} Sharing it with one friend who might like it would help a lot too.',
];
const PEOPLE_FOLLOW = 'Hi {greet}, no pressure on my shop note. If one thing on the page confused you or put you off, I would love to hear it. That helps me more than anything.';

const PLACE_NOTE = {
  wholesale: "Hi {biz} team, I'm {me}, and I make {what} here in {area}. A lot of your {their} {why}. Would you be open to looking at a few samples and a one-page line sheet with wholesale prices? I can work on wholesale or consignment, whichever suits you. I can drop samples by any day this week.",
  vendor: "Hi {biz} team, I'm {me}, and I make {what} here in {area}. Your {their} {why}, so I'd love a vendor table at an upcoming market. Could you tell me how to apply and what you ask of new vendors?",
  consignment: "Hi {biz} team, I'm {me}, and I make {what} here in {area}. A lot of your {their} {why}. Would you be open to keeping a few pieces on a small shelf or the counter, on consignment? You'd keep a share of every sale, and I'd restock and handle everything.",
};
const PLACE_WALK = {
  wholesale: "Hi, is the owner or the buyer around? I'm {me}, and I make {what} nearby. I brought a couple of samples and a line sheet. Would you be open to carrying a few, wholesale or on consignment?",
  vendor: "Hi, who's the best person to ask about vendor tables? I'm {me}, and I make {what} nearby. I'd love to apply for an upcoming market.",
  consignment: "Hi, is the owner or manager around? I'm {me}, and I make {what} nearby. Would you be open to a few pieces on the counter, on consignment?",
};

const PEOPLE_COLUMNS = [
  { key: 'name', label: 'Person' },
  { key: 'note', label: 'How you know them' },
  { key: 'message', label: 'Note to send' },
  { key: 'follow_up', label: 'Follow-up in 3 days' },
];
const PLACE_COLUMNS = [
  { key: 'name', label: 'Place' },
  { key: 'kind', label: 'Kind' },
  { key: 'address', label: 'Address' },
  { key: 'message', label: 'Message' },
  { key: 'walk_in', label: 'In person' },
];

module.exports = {
  name: 'ecom.list_first25',
  title: 'Your first 25 list',
  description: 'Up to 15 people you know with a personal note each, plus up to 10 local gift shops, boutiques, markets, craft and book shops and cafes from OpenStreetMap with a wholesale, consignment or vendor-table ask, a dated plan, a CSV and everyone saved to your Pipeline.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['osm'],
  credits: 2,
  timeoutSec: 240,
  input: {
    type: 'object',
    properties: {
      people: { type: 'string', format: 'textarea', maxLength: 4000, title: '15 people you know', description: 'One per line: name, how you know them, phone or email if you like. Nothing is pulled from your phone.' },
      city: { type: 'string', maxLength: 80, title: 'Your city and state', description: 'Like "Asheville, NC". For local shops and markets near you.' },
      what: { type: 'string', maxLength: 80, title: 'What you sell', description: 'Like "hand-poured soy candles"' },
      shop: { type: 'string', maxLength: 80, title: 'Shop name (optional)' },
      link: { type: 'string', maxLength: 200, title: 'Link to your shop (optional)', description: 'Your Shopify, Etsy or own site, starting with https://' },
      offer: { type: 'string', maxLength: 120, title: 'A thank-you for friends (optional)', description: 'Only if you want one, in your words, like "Code FRIENDS takes 10% off this month". Never in return for a review.' },
      exclude: { type: 'string', maxLength: 4000, title: 'Names already contacted (optional)', description: 'One per line. Skipped this time.' },
    },
  },
  output: {
    type: 'object',
    required: ['people', 'partners', 'plan'],
    properties: { card: { type: 'object' }, people: { type: 'array' }, partners: { type: 'array' }, plan: { type: 'array' }, first: { type: ['object', 'null'] }, file: { type: 'object' }, notes: { type: 'array' }, saved: { type: 'integer' }, sample: { type: 'boolean' } },
  },
  async run(input, ctx) {
    const m = S.me(ctx, input);
    const today = time.today(ctx);
    const skip = new Set(C.linesOf(input.exclude, 300).map((s) => s.toLowerCase()));
    const shop = m.shop || 'my new shop';
    const offer = input.offer ? ` ${C.sentence(plain(input.offer))}` : '';
    const link = m.link ? `\n\n${m.link}` : '';
    const people = first25
      .parsePeople(input.people, { max: 40 })
      .filter((p) => !skip.has(p.name.toLowerCase()))
      .slice(0, 15)
      .map((p, i) => ({
        ...p,
        message: `${C.fill(PEOPLE_NOTES[(i + p.name.length) % PEOPLE_NOTES.length], { greet: p.greet, shop, what: m.what, offer }).replace(/\.\.(?!\.)/g, '.')}${link}`,
        follow_up: C.fill(PEOPLE_FOLLOW, { greet: p.greet }),
      }));

    const notes = [];
    let found = { partners: [], notes: [], held: false };
    if (m.city) found = await S.findPartners(ctx, { city: m.city, limit: 10, skip });
    else notes.push('Add your city to list gift shops, markets and cafes near you.');
    const partners = found.partners.map((b) => {
      const t = S.typeOf(b.type);
      const vars = { biz: b.name, me: m.first || 'a local maker', what: m.what, area: m.area, their: t.their_customers, why: t.why };
      return { ...b, kind: t.label, role: t.role, why: t.why, message: C.fill(PLACE_NOTE[t.role], vars), walk_in: C.fill(PLACE_WALK[t.role], vars) };
    });
    const anySample = partners.some((b) => b.sample);
    if (anySample) notes.push('Places marked (sample) are made up so you can see how it works. They are never saved to your Pipeline.');
    if (anySample && found.held) notes.push(S.places().HELD_NOTE);

    const rows = people.map((p, i) => C.personLead(p, { dm: p.message, follow1: p.follow_up, subject: `My new shop: ${shop}`, source: 'Online store: first 25', score: 90 - Math.min(15, i) }));
    for (const b of partners) {
      if (b.sample) continue;
      const t = S.typeOf(b.type);
      rows.push(C.placeLead(b, t, { me: { first: m.first, business: m.shop }, what: m.what, area: m.area, source: 'Online store: first 25 (OpenStreetMap)', weight: N.partners.length - N.partners.indexOf(t) }));
    }
    const saved = await C.saveRows(ctx, rows);
    if (input.what) await brain.remember(ctx, 'what', plain(input.what));

    const day = (n) => time.shortDate(time.addDays(today, n));
    const plan = [
      `Today: send the ${people.length || 15} notes to people you know${people.length ? '' : ' (add their names to get one written for each)'}. Ask for honest reactions, not favors.`,
      `${day(1)}: call or visit 5 of the places. Bring 2 samples and your line sheet (Wholesale pitch kit makes it).`,
      `${day(3)}: the other places, and the follow-up to anyone who hasn't answered.`,
      `${day(7)}: fix the one thing two or more people said about your page or price, then run this again with new names.`,
    ];
    const csvRows = [
      ...people.map((p) => ({ who: 'Person you know', name: p.name, contact: p.phone || p.email || '', note: p.note, message: p.message, follow: p.follow_up, on: time.addDays(today, 3), status: 'To send' })),
      ...partners.map((b) => ({ who: `Place: ${b.kind}`, name: b.name, contact: [b.phone, b.website].filter(Boolean).join(' '), note: b.address, message: b.message, follow: b.walk_in, on: time.addDays(today, 1), status: 'To send' })),
    ];
    const credit = S.places().creditLine(partners);
    if (credit) csvRows.push({ who: credit });
    const file = await save.saveFile(
      ctx,
      save.fileName('online store', 'first 25', today, '.csv'),
      files.csv(csvRows, [
        { key: 'who', label: 'Who' },
        { key: 'name', label: 'Name' },
        { key: 'contact', label: 'Contact' },
        { key: 'note', label: 'Note' },
        { key: 'message', label: 'Message' },
        { key: 'follow', label: 'Follow-up or in-person line' },
        { key: 'on', label: 'Follow up on' },
        { key: 'status', label: 'Status' },
      ]),
    );
    if (!people.length) notes.push('Add up to 15 people you know, one per line, to get a personal note for each.');
    notes.push(...found.notes.filter((x) => !/sample businesses|made up/i.test(x)).slice(0, 2));
    return {
      card: C.crowdCard(ctx, N),
      people,
      partners,
      plan,
      first: people[0] ? { to: people[0].name, text: people[0].message } : partners[0] ? { to: partners[0].name, text: partners[0].message } : null,
      file,
      notes,
      saved,
      sample: anySample,
    };
  },
  view(out) {
    const P = S.places();
    return views.blocks(
      views.metric('Your first 25', `${out.people.length + out.partners.length} ready`, `${out.people.length} people, ${out.partners.length} places${out.saved ? `. ${out.saved} saved to your Pipeline for Do my day` : ''}`),
      crowd.blocks(out.card),
      out.first ? views.copy(`First message: to ${out.first.to}`, out.first.text) : null,
      out.people.length ? views.table(PEOPLE_COLUMNS, out.people) : null,
      out.partners.length ? views.table(PLACE_COLUMNS, out.partners) : null,
      views.text(`Plan: ${out.plan.join(' ')}`),
      out.notes.length ? views.text(out.notes.join(' ')) : null,
      P.creditBlocks(out.partners),
      views.file(out.file, 'Your first 25 (CSV)'),
    );
  },
};
