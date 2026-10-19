// The tools every household pack gets, built from its data/ files: Your first 25, the offer card and
// door hangers, the price menu and offer sheet, and the job quote. Shared household spine.

const { text, money, time, brain, crowd, first25, views, save, files, media, places } = require('..');
const geo = require('./geo');
const pipe = require('./pipeline');
const find = require('./find');
const offer = require('./offer');
const words = require('./words');
const qt = require('./quote');
const print = require('./print');

const usd = (n) => (n == null || n === '' ? '' : money.usd(n).replace(/\.00$/, ''));
const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };

// The member's facts: input first, then what this pack remembered, then the brain.
// Distances show in miles (members are in the US); places keep km inside.
const miles = (km) => (Number.isFinite(km) ? Math.round(km * 0.621371 * 10) / 10 : '');

function facts(ctx, cfg, input = {}) {
  const b = brain.brainOf(ctx, input);
  const mem = brain.packMemory(ctx, cfg.id);
  const contact = (mem && mem.contact) || {};
  const place = text.plain(input.city || b.place || b.city || contact.city || '');
  const parsed = geo.parsePlace(place);
  const phone = words.phoneText(input.phone || contact.phone || '');
  const link = String(input.link || contact.link || b.website || '').trim();
  const business = words.businessName({ name: input.business || b.name || contact.business, firstName: b.firstName }, cfg);
  return { b, place, area: parsed.city || place || 'town', phone, link, business, first: b.firstName || '' };
}

async function rememberContact(ctx, f) {
  const keep = { business: f.business, phone: f.phone, link: f.link, city: f.place };
  await brain.remember(ctx, 'contact', Object.fromEntries(Object.entries(keep).filter(([, v]) => v)));
}

// The lead offer for this month where they live, priced, with the words messages use.
function leadFor(ctx, cfg, menu, { lat, price } = {}) {
  const month = offer.monthNow(ctx);
  const card = crowd.card(cfg.niche.crowd, { month, lat, title: cfg.niche.crowd_title || `Is ${cfg.niche.name.toLowerCase()} a good business to start?` });
  const lead = offer.leadOffer(cfg, { month, slow: card.slow_now });
  // A follow-on that only makes sense where winters are cold (a snow contract) has a warm-city alternative.
  const fo = lead.follow_on;
  const use = fo && fo.cold && Number.isFinite(lat) && lat < 37 ? { ...lead, follow_on: fo.alt || null } : lead;
  const p = offer.pricedLead(ctx, cfg, menu, use, { price });
  const src = (cfg.prices.packages || []).find((x) => x.id === p.pkg.id) || {};
  // The follow-on's words come from data ("a standard clean every 2 weeks"), so no plural guessing.
  const say = (use.follow_on && use.follow_on.say) || (p.follow && (p.follow.every ? `${p.follow.label.toLowerCase()} every ${p.follow.every}` : `a ${p.follow.label.toLowerCase()}`));
  const follow = !p.follow ? '' : `Then ${say} for ${usd(p.follow.price)} a ${p.follow.unit}.`;
  return {
    card,
    month,
    lead: {
      id: lead.id,
      headline: lead.label,
      one: lead.one || lead.label.toLowerCase(),
      many: lead.many || `${lead.label.toLowerCase()}s`,
      package: p.pkg.id,
      price: p.price,
      founding: p.founding,
      foundingText: words.foundingText(p.founding, p.price),
      unit: p.unit,
      ref: cfg.niche.quote.reference || '',
      includes: (lead.includes || src.includes || []).slice(0, 4),
      plan: follow,
      planPrice: p.follow ? p.follow.price : null,
      every: p.follow ? p.follow.every : '',
      promise: cfg.niche.offer.promise,
      partners: lead.partners || null,
      ladder: p.ladder,
      sizes: sizeRows(cfg, menu, p.pkg.id),
    },
  };
}

function textVars(cfg, f, lead, extra = {}) {
  return words.baseVars(cfg, { firstName: f.first, name: f.business, city: f.area }, {
    lead_one: lead.one,
    lead_many: lead.many,
    founding: lead.foundingText,
    founding_price: usd(lead.founding),
    price: usd(lead.price),
    plan_price: usd(lead.planPrice),
    every: lead.every,
    ref: lead.ref,
    phone: f.phone,
    plan: lead.plan,
    me: f.first ? `I'm ${f.first}` : 'Hi',
    ...extra,
  });
}

// ---------------------------------------------------------------- Your first 25

function first25Tool(cfg) {
  const id = cfg.id;
  const T = cfg.niche.texts;
  return {
    name: `${id}.first_25`,
    title: 'Your first 25 list',
    description: `15 people you know with a personal text each, plus 10 local businesses near you that serve the same customers (${text.list(cfg.niche.partners.map((p) => p.label.toLowerCase()))}) with a partner ask, the offer that fits this month where you live, replies and a dated plan.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['osm'],
    credits: 4,
    timeoutSec: 240,
    input: {
      type: 'object',
      properties: {
        people: { type: 'string', maxLength: 4000, title: '15 people you know', description: 'One per line: name, how you know them, phone if you like. Nothing is pulled from your phone.' },
        city: { type: 'string', maxLength: 80, title: 'Your city and state', description: 'Like "Columbus, OH"' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone for the door hanger (optional)' },
        link: { type: 'string', maxLength: 300, title: 'Booking link (optional)' },
        price: { type: ['number', 'string'], title: 'Your full price for the lead offer (optional)' },
        exclude: { type: 'string', maxLength: 4000, title: 'Businesses already worked (optional)', description: 'Names, one per line. Your Pipeline is skipped too.' },
        batch: { type: ['integer', 'string'], title: 'Batch', description: '1 for the first 10 businesses, 2 for the next 10', default: 1 },
      },
    },
    output: { type: 'object', required: ['people', 'partners', 'lead'], properties: { people: { type: 'array' }, partners: { type: 'array' }, lead: { type: 'object' }, first: { type: 'object' }, files: { type: 'object' } } },
    async run(input, ctx) {
      const f = facts(ctx, cfg, input);
      const loc = await geo.locate(ctx, f.place, { network: true });
      const menu = offer.menuFor(ctx, cfg, {});
      const { card, lead } = leadFor(ctx, cfg, menu, { lat: loc.lat, price: Number(input.price) || null });
      const types = lead.partners ? cfg.niche.partners.filter((t) => lead.partners.includes(t.id)) : cfg.niche.partners;
      // Skip businesses already worked: typed names plus this pack's Pipeline.
      const exclude = String(input.exclude || '').split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean);
      try {
        const worked = ctx.leads && typeof ctx.leads.list === 'function' ? await ctx.leads.list({}) : [];
        for (const l of worked || []) exclude.push(l.key, l.name, l.company);
      } catch {
        /* no Pipeline yet */
      }
      const found = await find.findPartners(ctx, cfg, { place: f.place, center: loc, types, limit: 10, exclude: exclude.filter(Boolean), batch: Number(input.batch) || 1 });
      const today = time.today(ctx);
      const r = await first25.household(ctx, {
        people: input.people,
        partners: found.partners.map((p) => ({ ...p, name: p.name || 'Business on Google Maps' })),
        types: cfg.niche.partners,
        city: f.place,
        offer: { what: cfg.niche.what, area: f.area, me: f.first, price: lead.price, foundingPrice: lead.founding },
        start: today,
      });
      // Our own texts: the founding price is for photos and honest feedback, never for a review.
      const people = r.people.map((p, i) => {
        const v = textVars(cfg, f, lead, { greet: p.greet });
        return { ...p, message: words.fill(words.pick(T.people, `${p.name}${i}`), v), follow_up: words.fill(T.people_follow_up, v), follow_up_2: words.fill(T.people_follow_up_2, v) };
      });
      const partners = r.partners.map((p, i) => {
        const src = found.partners[i] || {};
        return { ...p, key: src.key, km: src.km, place_id: src.place_id, maps: src.sourceUrl || '', typeId: src.type, instagram: src.instagram || null, ...(src.searchBy ? { searchBy: src.searchBy } : {}) };
      });
      const v = textVars(cfg, f, lead, { greet: 'there' });
      const replies = Object.entries(T.replies || {}).map(([k, t]) => ({ key: k, label: { how_much: 'When they ask "how much?"', not_now: 'When they say "not now"', who_are_you: 'When they ask "who are you?"' }[k] || k, text: words.fill(t, v) }));
      const day = (n) => time.shortDate(time.addDays(today, n));
      const plan = [
        `Today: send the ${people.length || 15} texts${people.length ? '' : ' (add names to get one written for each person)'}. Short and personal beats polished.`,
        `Tomorrow (${day(1)}): walk into 5 of the businesses with a few door hangers, or send the message if you can't go in.`,
        `${day(3)}: the other 5 businesses, and the first follow-up to anyone who hasn't answered.`,
        `${day(7)}: the second follow-up. Then run this again for the next 10 businesses (batch 2).`,
        cfg.niche.door_rule || 'Door hangers go on the door, never in or on a mailbox.',
      ];
      const first = people[0] ? { to: people[0].name, text: people[0].message } : partners[0] ? { to: partners[0].name, text: partners[0].message } : { to: 'a friend', text: words.fill(words.pick(T.people, 'first'), textVars(cfg, f, lead, { greet: 'there' })) };
      // The CSV: every row with its messages and dates, and the OpenStreetMap credit as the last row (D27).
      const rows = [
        ...people.map((p) => ({ who: 'Person you know', name: p.name, contact: p.phone || p.email || '', note: p.note, message: p.message, follow1: p.follow_up, on1: time.addDays(today, 3), follow2: p.follow_up_2, on2: time.addDays(today, 7), link: '' })),
        ...partners.map((p) => ({ who: `${p.sample || p.source === 'sample' ? 'Sample business (made up)' : 'Business'}: ${p.type}`, name: p.name, contact: [p.phone, p.website].filter(Boolean).join(' '), note: p.address, message: p.message, follow1: p.walk_in, on1: time.addDays(today, 1), follow2: '', on2: '', link: p.maps || '' })),
      ];
      const creditLine = places.creditLine(partners);
      if (creditLine) rows.push({ who: creditLine });
      const csv = files.csv(rows, [
        { key: 'who', label: 'Who' },
        { key: 'name', label: 'Name' },
        { key: 'contact', label: 'Contact' },
        { key: 'note', label: 'Note' },
        { key: 'message', label: 'First message' },
        { key: 'follow1', label: 'Follow-up or walk-in line' },
        { key: 'on1', label: 'Send on' },
        { key: 'follow2', label: 'Second follow-up' },
        { key: 'on2', label: 'Send on' },
        { key: 'link', label: 'Map link' },
      ]);
      // Batch 2 and on get their own file, so the first 10 stay in the Library.
      const batchNo = Math.max(1, Math.round(Number(input.batch) || 1));
      const csvAsset = await save.saveFile(ctx, save.fileName(f.business, 'first 25', batchNo > 1 ? `batch ${batchNo}` : '', '.csv'), csv);
      // The Pipeline (D29): people they know saved warm with their texts and follow-ups; real
      // businesses with every message Do my day hands out. Never on a sample run or for sample businesses.
      const saved = await pipe.saveRows(ctx, [
        ...people.map((p) => pipe.personRow(p, { source: 'Your first 25' })),
        ...partners.filter((p) => p.source === 'osm').map((p) => partnerRow(cfg, f, p, { source: 'Your first 25' })),
      ]);
      await rememberContact(ctx, f);
      const notes = [...found.notes, ...r.notes.filter((n) => !/sample|businesses are/i.test(n))];
      return {
        city: f.place,
        business: f.business,
        phone: f.phone,
        link: f.link,
        card,
        season: { slow: card.slow_now, note: card.season },
        lead,
        people,
        partners,
        replies,
        plan,
        first,
        total: people.length + partners.length,
        files: { csv: csvAsset },
        source: found.source,
        credit: creditLine,
        saved,
        sample: found.sample,
        notes,
      };
    },
    view(out) {
      const offerLine = `This month's offer: ${out.lead.headline}, ${out.lead.foundingText} for your first 3 clients${out.lead.ref ? ` (${out.lead.ref})` : ''}.`;
      return views.blocks(
        views.metric('Your first 25', out.total, `${out.people.length} people you know and ${out.partners.length} businesses near ${out.city || 'you'}`),
        crowd.blocks(out.card),
        out.season.slow ? views.text(`Slow season where you live, so this list leads with the off-season offer. ${offerLine}`) : views.text(offerLine),
        views.copy(`Your first text, to ${out.first.to}: send it now`, out.first.text),
        out.people.length ? views.table([{ key: 'name', label: 'Person' }, { key: 'note', label: 'Note' }, { key: 'message', label: 'Text to send' }], out.people.map((p) => ({ name: p.name, note: p.note || '', message: p.message }))) : null,
        views.table(
          [{ key: 'name', label: 'Business' }, { key: 'type', label: 'Kind' }, { key: 'mi', label: 'Miles away', format: 'number' }, { key: 'walk_in', label: 'Walk-in line' }],
          out.partners.map((p) => ({ name: p.name, type: p.type, mi: miles(p.km), walk_in: p.walk_in })),
        ),
        places.creditBlocks(out.partners),
        out.sample && !(out.notes || []).some((n) => /sample/i.test(n)) ? views.text(`These are sample businesses, made up so you can see how it works. ${out.city ? 'Run it again to list real ones near you.' : 'Add your city to list real ones near you.'}`) : null,
        out.partners[0] ? views.copy(`Message to ${out.partners[0].name}`, out.partners[0].message) : null,
        out.people[0] ? views.copy('Follow-up on day 3', out.people[0].follow_up) : null,
        out.replies.map((r) => views.copy(r.label, r.text)),
        views.text(`Plan: ${out.plan.join(' ')}`),
        (out.notes || []).map((n) => views.text(n)),
        out.saved ? views.text(`Saved ${out.saved} to your Pipeline with their messages, so Do my day can hand them out each morning.`) : null,
        views.file(out.files.csv, 'All 25 with messages and follow-up dates (CSV)'),
      );
    },
  };
}

// A Pipeline row for one business from "Your first 25" or "Your next 25" (D29): the partner ask as a
// DM, the walk-in line, an email with the footer, two follow-ups, and why it's on the list.
function partnerRow(cfg, f, p, { source }) {
  const type = cfg.niche.partners.find((t) => t.id === p.typeId) || {};
  const links = { phone: p.phone, website: p.website, instagram: p.instagram };
  const msg = pipe.businessMsg({ biz: p.name, first: f.first, business: f.business, what: cfg.niche.what, area: f.area, phone: f.phone, their: type.their_customers || 'customers', why: type.why || 'could use this', ask: type.ask || 'pass my card to customers who ask', give: type.give || 'point customers your way', dm: p.message, walkin: p.walk_in }, pipe.channelOf(links));
  const facts = [`${text.sentenceCase(type.one || type.label || 'Local business')}${Number.isFinite(p.km) ? `, ${miles(p.km)} miles from you` : ''}`, type.their_customers && type.why ? `Their ${type.their_customers} ${type.why}.` : ''];
  return pipe.businessRow({ key: p.key, name: p.name, address: p.address, phone: p.phone, website: p.website, instagram: p.instagram, maps: p.maps, km: p.km, type, source: p.source }, { msg, facts, source });
}

// ---------------------------------------------------------------- offer card and door hangers

function cardTool(cfg) {
  const id = cfg.id;
  return {
    name: `${id}.offer_card`,
    title: cfg.niche.card_title || 'Offer card and door hangers',
    description: 'Your offer as a card to text or post (PNG) and printable door hangers, two per sheet, in your colors with a QR code to text or book you.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['render'],
    credits: 2,
    timeoutSec: 120,
    input: {
      type: 'object',
      required: ['lead'],
      properties: {
        lead: { type: 'object', title: 'The offer (from Your first 25 or the price menu)' },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        city: { type: 'string', maxLength: 80 },
        color: { type: 'string', maxLength: 7, title: 'Brand color hex (optional)' },
      },
    },
    output: { type: 'object', properties: { files: { type: 'object', properties: { png: ASSET, html: ASSET, svg: ASSET } } } },
    async run(input, ctx) {
      const f = facts(ctx, cfg, input);
      const lead = input.lead || {};
      const pal = print.paletteFor(cfg, input.color);
      const o = {
        business: f.business,
        area: f.area && f.area !== 'town' ? `${cfg.niche.name} in ${f.area}` : cfg.niche.name,
        headline: lead.headline || cfg.niche.name,
        price: lead.price,
        founding: lead.founding,
        who: 'First 3 clients',
        ref: lead.ref,
        includes: lead.includes || [],
        plan: lead.plan,
        promise: lead.promise,
        phone: f.phone,
        link: f.link,
        hello: cfg.niche.door_hello,
        sizes: lead.sizes || [],
        step3: cfg.niche.door_step3,
      };
      const svgText = print.offerCard(cfg, o, pal);
      const out = { files: {}, headline: o.headline };
      if (media.canRender(ctx)) {
        try {
          out.files.png = await save.saveFile(ctx, save.fileName(f.business, 'offer card', '.png'), await media.svgToPng(ctx, svgText));
        } catch {
          /* fall back to the SVG below */
        }
      }
      if (!out.files.png) out.files.svg = await save.saveFile(ctx, save.fileName(f.business, 'offer card', '.svg'), svgText);
      out.files.html = await save.saveFile(ctx, save.fileName(f.business, 'door hangers', '.html'), print.doorHangers(cfg, o, pal));
      return out;
    },
    view(out) {
      return views.blocks(
        views.image(out.files.png, 'Text this to people who ask, or post it'),
        out.files.svg ? views.file(out.files.svg, 'Offer card (open in a browser)') : null,
        views.file(out.files.html, 'Door hangers: print on card stock, cut on the dashed lines'),
        views.text(cfg.niche.door_rule || 'Door hangers go on the door, never in or on a mailbox.'),
      );
    },
  };
}

// ---------------------------------------------------------------- price menu and offer sheet

function parseOverrides(cfg, s) {
  const out = {};
  const items = [...(cfg.prices.packages || []), ...(cfg.prices.addons || [])];
  for (const part of String(s || '').split(/\r?\n|,|;/)) {
    const m = part.match(/^\s*(.+?)\s*[:=]?\s*\$?\s*(\d+(?:\.\d+)?)\s*$/);
    if (!m) continue;
    const label = m[1].toLowerCase();
    const hit = items.find((x) => x.id === label || x.label.toLowerCase() === label || x.label.toLowerCase().startsWith(label));
    if (hit) out[hit.id] = Number(m[2]);
  }
  return out;
}

function sizeRows(cfg, menu, pkgId) {
  const sf = cfg.niche.quote.size_factor;
  const f = (cfg.prices.factors || []).find((x) => x.id === sf);
  const p = menu.packages.find((x) => x.id === pkgId);
  if (!f || !p) return [];
  return f.options.map((o) => ({ label: o.short || o.label, price: money.nicePrice(p.price * (o.mult || 1)) }));
}

function priceMenuTool(cfg) {
  const id = cfg.id;
  const O = cfg.niche.offer;
  return {
    name: `${id}.price_menu`,
    title: 'Price menu and offer',
    description: 'Your price menu at the position you pick (from sourced price ranges), the first-clients ladder, the money model (attraction, core, regular plan, upsell, downsell), job math from your own costs and a one-page offer sheet buyers can read.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['render'],
    credits: 2,
    timeoutSec: 60,
    input: {
      type: 'object',
      properties: {
        position: { type: 'string', enum: ['budget', 'standard', 'premium'], default: 'standard', title: 'Where you price', description: 'Budget is the low end of local prices, premium the high end.' },
        prices: { type: 'string', maxLength: 600, title: 'Your own prices (optional)', description: 'Like "Standard clean 140, Deep clean 260". These win over the ranges.' },
        supplies: { type: ['number', 'string'], title: 'Supplies and gas per job, in dollars (optional)' },
        hourly: { type: ['number', 'string'], title: 'What you pay yourself per hour (optional)' },
        fixed: { type: ['number', 'string'], title: 'Fixed costs per month (optional)', description: 'Insurance, phone, software' },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: { type: 'object', required: ['packages'], properties: { packages: { type: 'array' }, ladder: { type: 'array' }, model: { type: 'array' }, jobs: { type: 'array' }, lead: { type: 'object' }, files: { type: 'object' } } },
    async run(input, ctx) {
      const f = facts(ctx, cfg, input);
      const position = offer.POSITIONS.includes(input.position) ? input.position : offer.positionOf(ctx, cfg, {});
      const overrides = parseOverrides(cfg, input.prices);
      const menu = offer.menuFor(ctx, cfg, { position, overrides });
      const loc = geo.latOf(f.place);
      const { lead } = leadFor(ctx, cfg, menu, { lat: loc.lat });
      const core = cfg.niche.money_model.core.package;
      const corePrice = offer.priceOf(menu, core);
      const att = cfg.niche.money_model.attraction || {};
      const ladderPkg = menu.packages.find((x) => x.id === att.package) || menu.packages.find((x) => x.id === core);
      const ladder = offer.ladderFor(cfg, ladderPkg ? ladderPkg.price : corePrice).map((l) => ({ ...l, who: `${l.who} (${ladderPkg ? ladderPkg.label.toLowerCase() : ''})` }));
      const model = offer.moneyModel(cfg, menu);
      const costs = { perJob: Number(input.supplies) || cfg.niche.default_costs.perJob, hourly: Number(input.hourly) || cfg.niche.default_costs.hourly, monthlyFixed: Number(input.fixed) || cfg.niche.default_costs.monthlyFixed };
      const jobs = offer.jobRows(cfg, menu, costs);
      const sizes = sizeRows(cfg, menu, core);
      const recurring = model.find((r) => r.step === 'Recurring plan');
      const sizeF = (cfg.prices.factors || []).find((x) => x.id === cfg.niche.quote.size_factor);
      const sized = (pid) => sizeF && (!sizeF.packages || sizeF.packages.includes(pid));
      const packages = menu.packages.map((p) => ({ id: p.id, label: p.label, price: p.price, unit: p.rate || !sized(p.id) ? p.unit : `${p.unit}${cfg.niche.quote.reference ? `, ${cfg.niche.quote.reference}` : ''}`, includes: (p.includes || []).slice(0, 5).join(', ') }));
      const addons = menu.addons.map((a) => ({ label: a.label, price: a.price, unit: a.unit }));
      const pal = print.paletteFor(cfg, input.color);
      const name = O.names[0];
      const html = print.offerSheet(cfg, {
        business: f.business,
        name,
        outcome: O.outcome,
        who_for: O.who,
        rows: [...packages.map((p) => ({ label: p.label, price: p.price, unit: `per ${p.unit}`, includes: p.includes })), ...addons.map((a) => ({ label: `Add: ${a.label}`, price: a.price, unit: a.unit === 'each' ? 'each' : `per ${a.unit}` }))],
        sizes,
        plansLine: recurring ? `${recurring.what}: ${usd(recurring.price)} ${recurring.unit}. ${recurring.note}` : '',
        promise: O.promise,
        ladder,
        phone: f.phone,
        link: f.link,
        area: f.area !== 'town' ? `${cfg.niche.name} in ${f.area}` : '',
      }, pal);
      const sheet = await save.saveFile(ctx, save.fileName(f.business, 'offer sheet', '.html'), html);
      await brain.remember(ctx, 'menu', { position, overrides });
      await rememberContact(ctx, f);
      const sources = [...new Set([...(cfg.prices.packages || []), ...(cfg.prices.addons || [])].flatMap((x) => (x.sources || []).map((s) => s.publisher)))];
      return {
        position,
        name,
        names: O.names.map((n) => ({ name: n })),
        packages,
        addons,
        sizes,
        ladder,
        model,
        jobs,
        costs,
        lead,
        promise: O.promise,
        sources: `Ranges from ${text.list(sources)}, checked ${cfg.prices.checked}. Your position picks a price inside each range; your own prices win.`,
        files: { html: sheet },
      };
    },
    view(out) {
      return views.blocks(
        ((core) => views.metric(`${out.name}: your core price`, core ? core.price : 0, `${out.position} position, ${core ? `${core.label.toLowerCase()}, ${core.unit}` : ''}`))(out.packages.find((p) => p.id === ((cfg.niche.money_model || {}).core || {}).package) || out.packages[0]),
        views.table([{ key: 'label', label: 'Service' }, { key: 'price', label: 'Price', format: 'money' }, { key: 'unit', label: 'Per' }, { key: 'includes', label: 'Includes' }], out.packages),
        out.sizes.length ? views.table([{ key: 'label', label: 'Size' }, { key: 'price', label: 'Price', format: 'money' }], out.sizes) : null,
        out.addons.length ? views.table([{ key: 'label', label: 'Add-on' }, { key: 'price', label: 'Price', format: 'money' }, { key: 'unit', label: 'Per' }], out.addons) : null,
        views.table([{ key: 'who', label: 'First clients' }, { key: 'price', label: 'Price', format: 'money' }, { key: 'ask', label: 'What you ask for' }], out.ladder),
        views.table([{ key: 'step', label: 'Money model' }, { key: 'what', label: 'What' }, { key: 'price', label: 'Price', format: 'money' }, { key: 'note', label: 'Note' }], out.model),
        views.table([{ key: 'job', label: 'Job' }, { key: 'price', label: 'Price', format: 'money' }, { key: 'hours', label: 'Hours', format: 'number' }, { key: 'left', label: 'Left after supplies and your pay', format: 'money' }, { key: 'jobsToCoverFixed', label: 'Jobs to cover fixed costs', format: 'number' }], out.jobs),
        views.text(`Your promise: ${out.promise}`),
        views.file(out.files.html, 'One-page offer sheet: open it, then Print or Save as PDF'),
        views.text(out.sources),
      );
    },
  };
}

// ---------------------------------------------------------------- quote a job

function quoteTool(cfg) {
  const id = cfg.id;
  return {
    name: `${id}.quote_job`,
    title: 'Quote this job',
    description: `Prices one job from what you see (${text.list(Object.values(cfg.niche.quote.fields).map((x) => String(x.title).toLowerCase()).slice(0, 4))}) at your menu prices, as line items the Sales desk turns into a quote and an invoice, plus a text you can send from the driveway.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: { type: 'object', properties: { ...qt.inputSchema(cfg), customer: { type: 'string', maxLength: 80, title: 'Customer name' }, notes: { type: 'string', maxLength: 500, title: 'Notes (optional)' } } },
    output: { type: 'object', required: ['items'], properties: { items: { type: 'array' }, subtotal: { type: 'number' }, title: { type: 'string' }, text: { type: 'string' }, next: { type: 'array' } } },
    async run(input, ctx) {
      const f = facts(ctx, cfg, input);
      const menu = offer.menuFor(ctx, cfg, {});
      const q = qt.build(cfg, menu, input);
      if (!q.items.length) throw new Error('Pick a service to quote.');
      const who = text.plain(input.customer || '') || 'there';
      // Title from the package and the first pick's short label: "House wash (soft wash), Two stories".
      const parts = [q.package ? q.package.label : q.items[0].label, (q.short || [])[0]].filter(Boolean);
      const title = text.clip(parts.join(', '), 110);
      const lower = (s) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
      const said = text.clip(parts.map(lower).join(', '), 110);
      const planLine = q.plan ? (q.plan.package ? ` After this one, a ${q.plan.package.toLowerCase()} is ${usd(q.plan.perVisit)} every ${q.plan.every}.` : ` After that it's ${usd(q.plan.perVisit)} every ${q.plan.every}.`) : '';
      const msg = words.fill(cfg.niche.texts.quote, { customer: who.split(' ')[0], first: f.first, business: f.business, title: said, lines: qt.itemLines(q.items).join('; '), total: usd(q.subtotal), plan: planLine, promise: cfg.niche.offer.promise });
      return {
        customer: who,
        title,
        items: q.items,
        subtotal: q.subtotal,
        minutes: q.minutes,
        hours: Math.round((q.minutes / 60) * 10) / 10,
        plan: q.plan,
        advice: q.advice,
        notes: [...q.notes, cfg.niche.offer.promise].join(' '),
        text: msg,
        next: [
          { label: 'They said yes: make the invoice', invoice: true },
          { label: 'Not yet: keep the quote', invoice: false },
        ],
      };
    },
    view(out) {
      return views.blocks(
        views.metric(`Quote for ${out.customer}`, out.subtotal, `${out.title}, about ${out.hours} hours`),
        views.table([{ key: 'label', label: 'Item' }, { key: 'qty', label: 'Qty', format: 'number' }, { key: 'price', label: 'Price', format: 'money' }], out.items),
        out.advice.map((a) => views.text(a)),
        views.copy(`Text to ${out.customer}`, out.text),
      );
    },
  };
}

// After a job: thank-you, review ask (every customer, nothing offered for it), the regular plan,
// a referral ask and a check-in later, each dated, plus leave-behind review cards with a QR code.
function keepTool(cfg) {
  const id = cfg.id;
  const K = cfg.niche.texts.keep;
  return {
    name: `${id}.keep_customer`,
    title: 'Keep this customer',
    description: 'Writes the messages for after a job: a thank-you, an honest review ask, the regular plan, a referral ask and a check-in later, each with its date, plus review cards to leave behind.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      required: ['customer'],
      properties: {
        customer: { type: 'string', maxLength: 80, title: 'Customer name' },
        job: { type: 'string', maxLength: 80, title: 'What you did (optional)', description: `Like "${cfg.niche.lead_offers[cfg.niche.lead_offers.length - 1].one}"` },
        review: { type: 'string', maxLength: 300, title: 'Your review link (optional)', description: 'Your Google review link, from your Business Profile' },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: { type: 'object', required: ['messages'], properties: { messages: { type: 'array' }, files: { type: 'object' } } },
    async run(input, ctx) {
      const f = facts(ctx, cfg, input);
      const menu = offer.menuFor(ctx, cfg, {});
      const { lead } = leadFor(ctx, cfg, menu, { lat: geo.latOf(f.place).lat });
      const who = text.plain(input.customer || '').trim() || 'there';
      const job = text.plain(input.job || '').trim().toLowerCase() || cfg.niche.lead_offers[cfg.niche.lead_offers.length - 1].one;
      const review = /^https:\/\/\S+$/.test(String(input.review || '').trim()) ? String(input.review).trim() : '';
      const v = { customer: who.split(' ')[0], first: f.first, business: f.business, job, phone: f.phone || '', phone_part: f.phone ? ` (${f.phone})` : '', promise: cfg.niche.offer.promise, review_line: review ? ` Here's the link: ${review}` : '', plan_offer: lead.plan ? lead.plan.replace(/^Then /, 'I can do ') : '', terms: cfg.niche.texts.plan_terms || '' };
      const today = time.today(ctx);
      const at = (n) => time.addDays(today, n);
      const messages = [
        { key: 'thanks', label: 'Thank-you, today', on: at(0), text: words.fill(K.thanks, v) },
        { key: 'review', label: 'Review ask, tomorrow', on: at(1), text: words.fill(K.review, v) },
        lead.plan ? { key: 'plan', label: 'Regular plan, in 2 days', on: at(2), text: words.fill(K.plan, v) } : null,
        { key: 'referral', label: 'Referral ask, in 2 weeks', on: at(14), text: words.fill(K.referral, v) },
        { key: 'checkin', label: `Check-in, in ${K.checkin_days} days`, on: at(K.checkin_days), text: words.fill(K.checkin, v) },
      ].filter(Boolean).map((m) => ({ ...m, date: time.shortDate(m.on) }));
      const out = { customer: who, messages, rules: K.rules, files: {} };
      if (review) {
        const pal = print.paletteFor(cfg, input.color);
        out.files.cards = await save.saveFile(ctx, save.fileName(f.business, 'review cards', '.html'), print.reviewCards(cfg, { business: f.business, review, phone: f.phone, thanks: K.card_thanks, ask: K.card_ask }, pal));
      }
      return out;
    },
    view(out) {
      return views.blocks(
        views.metric(`Keep ${out.customer}`, out.messages.length, 'messages, each with its day'),
        out.messages.map((m) => views.copy(`${m.label} (${m.date})`, m.text)),
        views.text(out.rules),
        out.files.cards ? views.file(out.files.cards, 'Review cards with your QR code: print, cut and leave one after each job') : views.text('Add your Google review link to get printable review cards with a QR code.'),
      );
    },
  };
}

module.exports = { miles, facts, leadFor, textVars, first25Tool, cardTool, priceMenuTool, quoteTool, keepTool, parseOverrides, partnerRow, sizeRows, rememberContact, usd };
