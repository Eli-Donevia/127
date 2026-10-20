// The niche specials, each switched on by data/niche.json "specials":
//   same_street (lawn, cleaning): one customer's street turned into a route, with a neighbor price.
//   season_plan (lawn, washing): twelve months of offers for where the member lives, with a calendar.
//   fleets (detailing): dealers, rental offices and trades with vans, plus a per-vehicle rate sheet.
//   storefronts (washing): shops and cafes in walking order, a counter script and a rate sheet.
// Businesses come from OpenStreetMap through the kit (credit on screen, in pages and CSVs), sample
// businesses in sample runs. Shared household spine.

const { text, views, save, files, time, places, money, leads, crowd, web } = require('..');
const offer = require('./offer');
const words = require('./words');
const print = require('./print');
const pages = require('./pages');
const geo = require('./geo');
const find = require('./find');
const pipe = require('./pipeline');
const T = require('./tools');
const { plan: planDef } = require('./config');

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
// "Hand wash and dry, wheels and tires, ...": one sentence from a package's include list.
const incl = (list, n = 6) => (list || []).slice(0, n).map((x, i) => (i && /^[A-Z][a-z]/.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x)).join(', ');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---------------------------------------------------------------- same street first

// House numbers near the customer's: the same side (same odd or even) and across the street.
function homesNear(number, count) {
  const n = parseInt(String(number || '').replace(/\D/g, ''), 10);
  const total = Math.max(6, Math.min(40, Math.round(Number(count) || 20)));
  if (!Number.isFinite(n) || n < 1) return Array.from({ length: total }, () => ({ label: '', side: '' }));
  const half = Math.ceil(total / 2);
  const same = [];
  for (let k = 1; same.length < half && k < 200; k++) {
    for (const d of [-2 * k, 2 * k]) if (n + d > 0 && same.length < half) same.push(n + d);
  }
  const across = [];
  for (let k = 0; across.length < total - half && k < 200; k++) {
    for (const d of [-(2 * k + 1), 2 * k + 1]) if (n + d > 0 && across.length < total - half) across.push(n + d);
  }
  return [{ n, side: 'Same side', customer: true }, ...same.map((x) => ({ n: x, side: 'Same side' })), ...across.map((x) => ({ n: x, side: 'Across' }))].sort((a, b) => a.n - b.n);
}

function streetTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  const S = N.same_street || {};
  return {
    name: `${id}.street_route`,
    title: 'Same street route',
    description: `Turns one customer's street into a route: door hangers with a neighbor price for the homes around them, a route sheet to tick off, and the intro ask for your customer. Homes on one street mean less driving between jobs.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 2,
    timeoutSec: 60,
    input: {
      type: 'object',
      required: ['street'],
      properties: {
        street: { type: 'string', maxLength: 80, title: "Your customer's street" },
        number: { type: 'string', maxLength: 10, title: 'Their house number (optional)' },
        customer: { type: 'string', maxLength: 80, title: 'Customer (optional)' },
        day: { type: 'string', maxLength: 40, title: 'The day you are there (optional)' },
        count: { type: ['integer', 'string'], title: 'Homes', minimum: 6, maximum: 40, default: 20 },
        city: { type: 'string', maxLength: 80 },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
        license_line: { type: 'string', maxLength: 80, title: 'A line your state requires on your ads (optional)', description: 'Like "Not a licensed contractor." Printed on every card, sheet and door hanger this makes' },
      },
    },
    output: { type: 'object', required: ['street', 'price', 'files', 'messages'], properties: { street: { type: 'string' }, price: { type: 'object' }, homes: { type: 'integer' }, files: { type: 'object', properties: { hangers: ASSET, sheet: ASSET } }, messages: { type: 'array' }, steps: { type: 'array' } } },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const street = text.clip(text.plain(input.street || '').trim().replace(/^\d+\s+/, '').replace(/[.,]+$/, ''), 80);
      if (!street) throw new Error('Type the street where you already have a customer, like "Maple Ave".');
      const typedNumber = String(input.number || '').trim() || (String(input.street || '').match(/^\s*(\d+)\s/) || [])[1] || '';
      const menu = offer.menuFor(ctx, cfg, {});
      const pkg = menu.packages.find((p) => p.id === S.package) || menu.packages[0];
      // The regular plan neighbors book: the one the data names (every 2 weeks for a clean), else the first with a discount.
      const plans = (cfg.prices.plans || []).filter((p) => (p.packages || []).includes(pkg.id));
      const pl = plans.find((p) => p.id === S.plan) || plans.find((p) => p.discount) || null;
      const base = pl ? offer.planPrice(pkg.price, pl) : pkg.price;
      const neighbor = money.nicePrice(base * (1 - (S.neighbor_off || 0.1)));
      const day = text.plain(input.day || '').trim();
      const dayPart = day ? ` on ${day.replace(/^on\s+/i, '')}` : '';
      const customer = text.plain(input.customer || '').trim();
      const first = customer.split(/\s+/)[0] || 'there';
      const v = { street, day_part: dayPart, customer: first, phone_part: f.phone ? ` (${f.phone})` : '' };
      const ref = N.quote.reference ? `for a ${N.quote.reference}` : '';
      const pal = print.paletteFor(cfg, input.color);
      const every = pl ? ` every ${pl.every}` : '';
      const o = {
        business: f.business,
        hello: words.fill(S.hello || 'Hi {street} neighbors!', v),
        headline: words.fill(S.headline || 'Your neighbor price on {street}', v),
        big: T.usd(neighbor),
        side: [`instead of ${T.usd(base)}`, `${pkg.label.toLowerCase()}${every}`, ref, S.side_extra || ''].filter(Boolean).slice(0, 3),
        includes: S.includes || (pkg.includes || []).slice(0, 3),
        plan: `Neighbor price on ${street}${dayPart}, the same day as your neighbor.`,
        promise: N.offer.promise,
        phone: f.phone,
        link: f.link,
        how: (S.how || []).map((x) => words.fill(x, v)),
        title: `${f.business}: ${street} door hangers`,
        license: T.licenseLine(input),
      };
      const hangers = await save.saveFile(ctx, save.fileName(f.business, street, 'neighbor door hangers', '.html'), print.doorHangers(cfg, o, pal));
      const homes = homesNear(typedNumber, input.count);
      const sheet = await save.saveFile(ctx, save.fileName(f.business, street, 'route sheet', '.html'), pages.routeSheet(cfg, {
        business: f.business,
        first: f.first,
        phone: f.phone,
        link: f.link,
        title: `${street}${dayPart}`,
        sub: `${homes.length - (typedNumber ? 1 : 0)} homes around ${customer || 'your customer'}${typedNumber ? ` at ${typedNumber} ${street}` : ''}`,
        offer: `Neighbor price: ${T.usd(neighbor)} instead of ${T.usd(base)} for a ${pkg.label.toLowerCase()}${every}, booked on ${street}${dayPart}. ${S.why || ''}`,
        rule: N.door_rule,
        homes: homes.map((h) => ({ label: h.n ? `${h.n} ${street}` : `____ ${street}`, side: h.side, customer: !!h.customer })),
        steps: S.steps || [],
        note: typedNumber ? 'House numbers are a guess from your customer\'s number: cross out any that don\'t exist and write in the real ones.' : 'Add your customer\'s house number next time to get the numbers filled in.',
      }, pal));
      const messages = [
        { key: 'ask', label: `Intro ask for ${customer || 'your customer'}, after the job`, text: words.fill(S.customer_ask || '', v) },
        // Never names the customer to the neighbors: that's theirs to share.
        { key: 'knock', label: 'If a neighbor is outside', text: text.plain(`Hi! ${f.first ? `I'm ${f.first} from ${f.business}` : `I'm with ${f.business}`}. I do ${N.what} for a home here on ${street}${dayPart}, so neighbors get ${T.usd(neighbor)} instead of ${T.usd(base)} for a ${pkg.label.toLowerCase()}${every}. Can I leave you a card?`) },
      ];
      return {
        street,
        price: { neighbor, base, menu: pkg.price, package: pkg.label, every: pl ? pl.every : '', note: S.neighbor_note || '' },
        homes: homes.filter((h) => !h.customer).length,
        files: { hangers, sheet },
        messages,
        steps: S.steps || [],
        why: S.why || '',
      };
    },
    view(out) {
      return views.blocks(
        views.metric(`Neighbor price on ${out.street}`, T.usd(out.price.neighbor), `instead of ${T.usd(out.price.base)} for a ${out.price.package.toLowerCase()}${out.price.every ? ` every ${out.price.every}` : ''}`),
        views.file(out.files.hangers, 'Neighbor door hangers: print on card stock, two per sheet'),
        views.file(out.files.sheet, `Route sheet: ${out.homes} homes to tick off`),
        out.messages.map((m) => views.copy(m.label, m.text)),
        views.text(out.why),
        out.price.note ? views.text(`The neighbor discount is a ${out.price.note.replace(/, not a sourced fact/, '')}: change it to what works for you.`) : null,
      );
    },
  };
}

// ---------------------------------------------------------------- season plan

function seasonTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  const SP = N.season_plan || {};
  return {
    name: `${id}.season_plan`,
    title: 'Plan your seasons',
    description: 'Twelve months for where you live: the busy and slow months, the offer to lead with each month and its price, who to reach, and the one thing to do at the start of each month, as a one-page plan and a calendar file.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: { type: 'object', properties: { city: { type: 'string', maxLength: 80, title: 'Your city and state' }, business: { type: 'string', maxLength: 80 }, phone: { type: 'string', maxLength: 40 }, link: { type: 'string', maxLength: 300 }, color: { type: 'string', maxLength: 7 } } },
    output: { type: 'object', required: ['months', 'files'], properties: { months: { type: 'array' }, slow: { type: 'string' }, files: { type: 'object', properties: { html: ASSET, ics: ASSET } }, where: { type: 'string' } } },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const lat = geo.latOf(f.place);
      const menu = offer.menuFor(ctx, cfg, {});
      const now = offer.monthNow(ctx);
      const today = time.today(ctx);
      const [y0] = today.split('-').map(Number);
      const best = (N.crowd && N.crowd.best_months) || [];
      const rows = [];
      for (let k = 0; k < 12; k++) {
        const m = ((now - 1 + k) % 12) + 1;
        const year = y0 + (now - 1 + k >= 12 ? 1 : 0);
        const s = crowd.season(N.crowd, { month: m, lat: lat.lat });
        const lo = offer.leadOffer(cfg, { month: m, slow: s.slow });
        const nextM = (m % 12) + 1;
        const nextLo = offer.leadOffer(cfg, { month: nextM, slow: crowd.season(N.crowd, { month: nextM, lat: lat.lat }).slow });
        const p = offer.pricedLead(ctx, cfg, menu, lo, {});
        // Presell only when next month sells something different (a new package), not a new label for the same one.
        const presell = nextLo.package !== lo.package ? ` Next month: ${nextLo.label}. Start telling customers about it this month.` : '';
        rows.push({
          month: m,
          year,
          label: `${MONTHS[m - 1]}${k === 0 || m === 1 ? ` ${year}` : ''}`,
          now: k === 0,
          season: s.slow ? 'Slow' : best.includes(m) ? 'Busy' : 'Steady',
          offer: `${lo.label}, ${T.usd(p.price)}${p.unit && p.unit !== 'job' ? ` a ${p.unit}` : ''} (first 3: ${T.usd(p.founding)})`,
          who: (SP.who || {})[lo.id] || 'Past customers first, then their neighbors',
          do: `${(SP.do || {})[lo.id] || 'Reach 25 people a day: Do my day hands them out.'}${presell}`,
          id: lo.id,
        });
      }
      const off = N.crowd && N.crowd.off_season;
      const cold = lat.lat != null ? Math.abs(lat.lat) >= 37 : null;
      const slow = off && off.months && off.months.length ? (off.where === 'cold' && cold === false ? `Where you live, winters are mild, so ${MONTHS[off.months[0] - 1]} to ${MONTHS[off.months[off.months.length - 1] - 1]} stay workable. ${off.play || ''}` : `${MONTHS[off.months[0] - 1]} to ${MONTHS[off.months[off.months.length - 1] - 1]} are slow${off.where === 'cold' ? (cold == null ? ' in colder cities' : ' where you live') : ''}. ${off.play || ''}`) : '';
      const pal = print.paletteFor(cfg, input.color);
      const sources = [...new Set((N.seasonality || []).flatMap((x) => (x.sources || []).map((s) => s.publisher)))];
      const html = pages.seasonPlan(cfg, {
        business: f.business,
        first: f.first,
        phone: f.phone,
        link: f.link,
        title: `Your next 12 months${f.area !== 'town' ? ` in ${f.area}` : ''}`,
        sub: `${N.name}: what to sell each month and what to do first.`,
        months: rows,
        slow,
        plans: SP.plans || [],
        sources: sources.length ? `Seasons from ${text.list(sources)}, checked ${N.checked}. Prices from your menu.` : '',
      }, pal);
      const htmlAsset = await save.saveFile(ctx, save.fileName(f.business, 'season plan', '.html'), html);
      const ics = files.ics(rows.map((r) => ({ uid: `${id}-season-${r.year}-${r.month}@127group.io`, title: `${MONTHS[r.month - 1]}: ${r.offer.split(',')[0]}`, description: `Lead with: ${r.offer}\nWho: ${r.who}\nFirst: ${r.do}`, date: r.now ? today : `${r.year}-${String(r.month).padStart(2, '0')}-01` })), { name: `${f.business} season plan`, now: time.nowMs(ctx) });
      const icsAsset = await save.saveFile(ctx, save.fileName(f.business, 'season plan', '.ics'), ics);
      return { months: rows, slow, where: lat.how ? `Seasons for ${f.place}` : 'Seasons for most of the US (add your city for yours)', files: { html: htmlAsset, ics: icsAsset } };
    },
    view(out) {
      return views.blocks(
        views.metric('This month', out.months[0].offer.split(',')[0], `${out.months[0].season} season. ${out.months[0].do}`),
        views.table([{ key: 'label', label: 'Month' }, { key: 'season', label: 'Season' }, { key: 'offer', label: 'Lead with' }, { key: 'do', label: 'Do this first' }], out.months),
        out.slow ? views.text(out.slow) : null,
        views.file(out.files.html, 'Your season plan: one page to print or pin'),
        views.file(out.files.ics, 'Calendar file: a reminder on the 1st of each month'),
        views.text(out.where),
      );
    },
  };
}

// ---------------------------------------------------------------- businesses for the specials

// Pipeline rows for buyers found on OpenStreetMap (never samples, never on a sample run).
function buyerRows(cfg, f, list, { source, dm, walkin, their, give, why, ask, typeOf }) {
  return list
    .filter((b) => b.source === 'osm')
    .map((b) => {
      const t = typeOf(b);
      const links = { phone: b.phone, website: b.website, instagram: b.instagram };
      const msg = pipe.businessMsg({ biz: b.name, first: f.first, business: f.business, what: cfg.niche.what, area: f.area, phone: f.phone, their: their(t), why: why(t), ask: ask(t), give: give(t), dm: dm(b, t), walkin: walkin(b, t) }, pipe.channelOf(links));
      return pipe.businessRow({ key: b.key, name: b.name, address: b.address, phone: b.phone, website: b.website, instagram: b.instagram, maps: b.sourceUrl, km: b.km, type: { id: t.id, weight: t.weight } }, { msg, facts: [`${t.label}${Number.isFinite(b.km) ? `, ${T.miles(b.km)} miles from you` : ''}`], source });
    });
}

async function knownSkip(ctx) {
  const known = await leads.known(ctx);
  return { exclude: [...known.keys, ...known.names], skip: (b) => !!(b.website && known.sites.has(web.domainOf(b.website))) };
}

// ---------------------------------------------------------------- fleets and dealers (detailing)

function fleetTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  const F = N.fleets || {};
  return {
    name: `${id}.fleet_list`,
    title: 'Fleets and dealers list',
    description: 'Car dealers, rental offices, trades with vans, movers and couriers near you that are not in your Pipeline, each with a message and a walk-in line, plus a per-vehicle rate sheet for an on-site wash day. Saved to your Pipeline.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['osm'],
    credits: 4,
    timeoutSec: 240,
    input: { type: 'object', properties: { city: { type: 'string', maxLength: 80, title: 'Your city and state' }, count: { type: ['integer', 'string'], minimum: 5, maximum: 40, default: 15, title: 'How many' }, business: { type: 'string', maxLength: 80 }, phone: { type: 'string', maxLength: 40 }, link: { type: 'string', maxLength: 300 }, color: { type: 'string', maxLength: 7 } } },
    output: { type: 'object', required: ['buyers', 'files'], properties: { buyers: { type: 'array' }, rates: { type: 'array' }, saved: { type: 'integer' }, files: { type: 'object' }, sample: { type: 'boolean' }, notes: { type: 'array' } } },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const want = Math.max(5, Math.min(40, Math.round(Number(input.count) || 15)));
      const loc = await geo.locate(ctx, f.place, { network: true });
      const menu = offer.menuFor(ctx, cfg, {});
      const types = F.types || [];
      const ks = await knownSkip(ctx);
      const found = await find.findPartners(ctx, cfg, { place: f.place, center: loc, types, limit: want, exclude: ks.exclude, skip: ks.skip, per: Math.ceil(want / Math.max(1, types.length)) + 8, kitSamples: true });
      const pkg = menu.packages.find((p) => p.id === F.package) || menu.packages[0];
      const pl = (cfg.prices.plans || []).find((p) => (p.packages || []).includes(pkg.id) && p.every === 'month') || null;
      const per = pl ? offer.planPrice(pkg.price, pl) : pkg.price;
      const typeOf = (b) => types.find((t) => t.id === b.type) || types[0];
      const v = (t) => ({ first: f.first || 'the owner', their: t.their, area: f.area });
      const dm = (b, t) => text.plain(`Hi ${b.name} team, I'm ${f.first || 'a local detailer'}${f.first ? `, I run ${f.business}` : ''}, mobile detailing in ${f.area}. I'd like to wash one of your ${t.their} free on your lot, so you can see the work. If you like it, I come one morning a month for ${T.usd(per)} a vehicle, less for 5 or more. Would next week work?`);
      const walkin = (b, t) => words.fill(F.say || '', v(t));
      const buyers = found.partners.map((b) => ({ name: b.name, kind: typeOf(b).label, km: b.km, address: b.address, phone: b.phone, website: b.website, source: b.source, message: dm(b, typeOf(b)), walk_in: walkin(b, typeOf(b)), ...(b.searchBy ? { searchBy: b.searchBy } : {}) }));
      const rows = buyerRows(cfg, f, found.partners, { source: 'Fleets and dealers', dm, walkin, typeOf, their: (t) => t.their, why: (t) => `are ${t.pitch}`, ask: () => 'wash one vehicle free on your lot', give: () => `do the first wash day at ${T.usd(per)} a vehicle` });
      const saved = await pipe.saveRows(ctx, rows);
      // The rate sheet: per vehicle, the monthly wash day, volume prices (a judgment call, said so).
      const rates = [
        { label: `${pkg.label}, monthly wash day`, detail: incl(pkg.includes, 4), price: per, unit: 'vehicle, once a month' },
        ...['interior', 'full'].map((pid) => menu.packages.find((p) => p.id === pid)).filter(Boolean).map((p) => ({ label: p.label, detail: incl(p.includes, 3), price: p.price, unit: 'vehicle', priceText: `from ${T.usd(p.price)}` })),
      ];
      const volume = (F.volume || []).map((x) => `${x.from} or more vehicles on one visit: ${T.usd(money.nicePrice(per * (1 - x.off)))} each for the monthly wash`);
      const pal = print.paletteFor(cfg, input.color);
      const sheet = await save.saveFile(ctx, save.fileName(f.business, 'fleet rate sheet', '.html'), pages.rateSheet(cfg, {
        business: f.business,
        first: f.first,
        phone: f.phone,
        link: f.link,
        area: f.area !== 'town' ? `Mobile detailing in ${f.area}` : 'Mobile detailing',
        eyebrow: `${f.business}, for fleets and dealers`,
        title: 'Clean vehicles on your lot, once a month',
        sub: 'I come to you on a set morning, wash every vehicle, and send photos when I finish.',
        rows: rates,
        volume,
        demo: F.demo,
        need: F.need || [],
        terms: F.terms,
        promise: N.offer.promise,
      }, pal));
      const csvRows = buyers.map((b) => ({ kind: b.kind, name: b.name, contact: [b.phone, b.website].filter(Boolean).join(' '), address: b.address, message: b.message, walk_in: b.walk_in }));
      const credit = places.creditLine(found.partners);
      if (credit) csvRows.push({ kind: credit });
      const csv = await save.saveFile(ctx, save.fileName(f.business, 'fleets and dealers', time.today(ctx), '.csv'), files.csv(csvRows, [{ key: 'kind', label: 'Kind' }, { key: 'name', label: 'Business' }, { key: 'contact', label: 'Contact' }, { key: 'address', label: 'Address' }, { key: 'message', label: 'Message' }, { key: 'walk_in', label: 'Walk-in line' }]));
      return { buyers, rates, volume, saved, files: { sheet, csv }, sample: !!found.sample, notes: [...found.notes, F.volume_note ? `Volume prices are a ${F.volume_note.replace(/, not a sourced fact/, '')}: change them to what works for you.` : ''].filter(Boolean) };
    },
    view(out) {
      return views.blocks(
        views.metric('Fleets and dealers near you', out.buyers.length, 'none already in your Pipeline'),
        out.saved ? views.text(`Saved ${out.saved} to your Pipeline with their messages, so Do my day hands them out.`) : null,
        views.table([{ key: 'name', label: 'Business' }, { key: 'kind', label: 'Kind' }, { key: 'mi', label: 'Miles away', format: 'number' }, { key: 'phone', label: 'Phone' }], out.buyers.map((b) => ({ name: b.name, kind: b.kind, mi: T.miles(b.km), phone: b.phone || '' }))),
        places.creditBlocks(out.buyers),
        out.buyers[0] ? views.copy(`Message to ${out.buyers[0].name}`, out.buyers[0].message) : null,
        out.buyers[0] ? views.copy('Walk-in line', out.buyers[0].walk_in) : null,
        views.file(out.files.sheet, 'Rate sheet for fleets: print it or attach it to your email'),
        views.file(out.files.csv, 'The list with messages (CSV)'),
        out.sample && !(out.notes || []).some((n) => /sample/i.test(n)) ? views.text('These are sample businesses, made up so you can see how it works. Run it again to list real ones near you.') : null,
        (out.notes || []).map((n) => views.text(n)),
      );
    },
  };
}

// ---------------------------------------------------------------- storefront route (washing)

// Nearest stop next, from the start: a walking order.
function walkOrder(list, start) {
  const left = list.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lon));
  const rest = list.filter((b) => !(Number.isFinite(b.lat) && Number.isFinite(b.lon)));
  const out = [];
  let at = start && Number.isFinite(start.lat) && Number.isFinite(start.lon) ? start : left[0];
  while (left.length) {
    let bi = 0;
    let bd = Infinity;
    left.forEach((b, i) => {
      const d = geo.kmBetween(at.lat, at.lon, b.lat, b.lon);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const b = left.splice(bi, 1)[0];
    out.push(b);
    at = b;
  }
  return [...out, ...rest];
}

function storefrontTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  const SF = N.storefronts || {};
  return {
    name: `${id}.storefront_route`,
    title: 'Storefront window route',
    description: 'Shops, cafes, salons and offices near you that are not in your Pipeline, in walking order with directions for each leg, a counter script with a free demo window, and a rate sheet to leave behind. Saved to your Pipeline.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['osm'],
    credits: 4,
    timeoutSec: 240,
    input: { type: 'object', properties: { city: { type: 'string', maxLength: 80, title: 'Your city and state' }, start: { type: 'string', maxLength: 120, title: 'Where you start (optional)' }, count: { type: ['integer', 'string'], minimum: 5, maximum: 30, default: 20, title: 'Stops' }, business: { type: 'string', maxLength: 80 }, phone: { type: 'string', maxLength: 40 }, link: { type: 'string', maxLength: 300 }, color: { type: 'string', maxLength: 7 } } },
    output: { type: 'object', required: ['stops', 'files'], properties: { stops: { type: 'array' }, legs: { type: 'array' }, price: { type: 'object' }, saved: { type: 'integer' }, files: { type: 'object' }, sample: { type: 'boolean' }, notes: { type: 'array' } } },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const want = Math.max(5, Math.min(30, Math.round(Number(input.count) || SF.stops || 20)));
      const startText = text.plain(input.start || '').trim();
      const loc = await geo.locate(ctx, f.place, { network: true });
      let start = loc;
      if (startText && !ctx.sample) {
        const g = await geo.geocode(ctx, `${startText}, ${f.place}`);
        if (g) start = { lat: g.lat, lon: g.lon };
      }
      const menu = offer.menuFor(ctx, cfg, {});
      const types = SF.types || [];
      const ks = await knownSkip(ctx);
      const found = await find.findPartners(ctx, cfg, { place: f.place, center: start, types, limit: want * 2, exclude: ks.exclude, skip: ks.skip, per: want + 6, kitSamples: true });
      // The closest ones, then a walking order through them.
      const near = found.partners.slice().sort((a, b) => (a.km == null ? 999 : a.km) - (b.km == null ? 999 : b.km)).slice(0, want);
      const ordered = walkOrder(near, start);
      const pkg = menu.packages.find((p) => p.id === SF.package) || menu.packages[0];
      const pl = planDef(cfg, SF.plan);
      const visit = pl ? offer.planPrice(pkg.price, pl) : pkg.price;
      const typeOf = (b) => types.find((t) => t.id === b.type) || types[0];
      const say = words.fill(SF.say || '', { first: f.first || 'a local window cleaner', area: f.area });
      const dm = (b) => text.plain(`Hi ${b.name} team, I'm ${f.first || 'a local window cleaner'}${f.first ? `, I run ${f.business}` : ''} here in ${f.area}. I clean storefront glass on a route${pl ? ` every ${pl.every}` : ''}, same day and time, before you open. Could I clean your front door glass free so you can see the work? After that it's ${T.usd(visit)} a visit.`);
      const stops = ordered.map((b, i) => ({ n: i + 1, name: b.name, kind: typeOf(b).label, address: b.address, phone: b.phone, website: b.website, km: b.km, lat: b.lat, lon: b.lon, source: b.source, ...(b.searchBy ? { searchBy: b.searchBy } : {}) }));
      // Directions per leg of 5 stops (phones show up to 3 stops between start and end).
      // Map points, not typed addresses (OpenStreetMap addresses are often partial). Sample stops get none.
      const legs = [];
      const L = Math.max(2, SF.leg || 5);
      const pt = (x) => (Number.isFinite(x.lat) && Number.isFinite(x.lon) ? { lat: x.lat, lng: x.lon } : { address: x.address });
      const at = (x) => (Number.isFinite(x.lat) && Number.isFinite(x.lon) ? `${x.lat.toFixed(5)},${x.lon.toFixed(5)}` : x.address);
      for (let i = 0; !found.sample && i < stops.length - 1; i += L - 1) {
        const part = stops.slice(i, i + L);
        const href = places.directionsLink(part.slice(1).map(pt), { origin: at(part[0]), mode: 'walking' });
        if (href) legs.push({ label: `Stops ${part[0].n} to ${part[part.length - 1].n}: ${part[0].name} to ${part[part.length - 1].name}`, href });
      }
      const rows = buyerRows(cfg, f, ordered, { source: 'Storefront route', dm, walkin: () => say, typeOf, their: () => 'guests', why: () => 'see the front glass before they see what you sell', ask: () => 'clean your front glass on my route', give: () => `do the first visit free, then ${T.usd(visit)} a visit` });
      const saved = await pipe.saveRows(ctx, rows);
      const pal = print.paletteFor(cfg, input.color);
      const credit = places.creditHtml(ordered);
      const routeSheet = await save.saveFile(ctx, save.fileName(f.business, 'storefront route', time.today(ctx), '.html'), pages.stopSheet(cfg, {
        business: f.business,
        first: f.first,
        phone: f.phone,
        link: f.link,
        eyebrow: `${f.business}, storefront route`,
        title: `${stops.length} storefronts in walking order`,
        sub: `${f.area !== 'town' ? `${f.area}. ` : ''}Free demo at every stop: the front door glass, right then.`,
        say,
        stops,
        legs,
        credit,
      }, pal));
      const rateSheet = await save.saveFile(ctx, save.fileName(f.business, 'storefront rate sheet', '.html'), pages.rateSheet(cfg, {
        business: f.business,
        first: f.first,
        phone: f.phone,
        link: f.link,
        area: f.area !== 'town' ? `Window cleaning in ${f.area}` : 'Window cleaning',
        eyebrow: `${f.business}, storefront windows`,
        title: 'Clear front glass, same day every visit',
        sub: 'Before you open, inside and out, so the first thing guests see is clean.',
        rows: [
          pl ? { label: `${pkg.label}, ${pl.label.toLowerCase()}`, detail: incl(pkg.includes), price: visit, unit: 'visit' } : null,
          { label: `${pkg.label}, once a month`, detail: incl(pkg.includes), price: pkg.price, unit: 'visit' },
        ].filter(Boolean),
        demo: SF.demo,
        need: SF.need || [],
        terms: SF.terms,
        promise: N.offer.promise,
      }, pal));
      return { stops, legs, price: { visit, menu: pkg.price, every: pl ? pl.every : 'month' }, say, saved, files: { route: routeSheet, rates: rateSheet }, sample: !!found.sample, notes: found.notes };
    },
    view(out) {
      return views.blocks(
        views.metric('Storefront route', out.stops.length, `stops in walking order, ${T.usd(out.price.visit)} a visit every ${out.price.every}`),
        views.copy('At the counter', out.say),
        views.table([{ key: 'n', label: '#', format: 'number' }, { key: 'name', label: 'Stop' }, { key: 'kind', label: 'Kind' }, { key: 'address', label: 'Address' }], out.stops),
        places.creditBlocks(out.stops),
        out.legs.map((l) => views.link(l.label, l.href)),
        views.file(out.files.route, 'Route sheet with directions: print it or open it on your phone'),
        views.file(out.files.rates, 'Rate sheet to leave behind at each stop'),
        out.saved ? views.text(`Saved ${out.saved} to your Pipeline, so Do my day brings up the follow-ups.`) : null,
        out.sample && !(out.notes || []).some((n) => /sample/i.test(n)) ? views.text('These are sample businesses, made up so you can see how it works. Run it again to list real ones near you.') : null,
        (out.notes || []).map((n) => views.text(n)),
      );
    },
  };
}

module.exports = { streetTool, seasonTool, fleetTool, storefrontTool, homesNear, walkOrder, buyerRows };
