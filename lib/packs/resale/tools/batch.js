// A batch of listings for the one site you start on: each line becomes a title and description
// within that site's checked limits (title, description, hashtags, photos and price range), with
// the fee, what you keep and the profit at your price. A dated CSV to work through, the photo
// checklist once, and the lines for the profit tracker. Look-alikes are skipped, never reworded.

const { views, files, save, time, money, text } = require('../../_kit');
const C = require('../../_kit/common');
const F = require('../lib/fees');
const { listingTool, CONDITIONS, BLOCKED, PHOTOS } = require('./listing');

const { usd, num } = money;
const { plain, clip } = text;

const MAX_LINES = 40;
const FAKE = /\b(dupe|replica|inspired|look ?alike|knock ?off|fake)\b/i;
const ALIASES = { nwt: 'New with tags', nwot: 'New without tags', euc: 'Like new', excellent: 'Like new', guc: 'Good', used: 'Good' };
const conditionOf = (s) => CONDITIONS.find((c) => c.toLowerCase() === s) || ALIASES[s] || '';
const KIDS = /\b(kids?|kid's|child|children'?s?|baby|babies|infant|toddler|crib|stroller|car seat|high ?chair|bassinet|play ?pen|playard|bouncer|teether|pacifier|youth)\b/i;
const APPLIANCE = /\b(heater|dehumidifier|humidifier|pressure cooker|air fryer|slow cooker|toaster|blender|hair dryer|power bank|charger|e-?bike|scooter|hoverboard)\b/i;
const TRACKER_NAME = { ebay: 'eBay', poshmark: 'Poshmark', mercari: 'Mercari', depop: 'Depop' };

// "Levi's 501 jeans 34x32, 42, Good, light wear at back hem, paid 6" (any order after the item).
function parseLine(line, classes) {
  const out = { item: [], price: null, cost: null, condition: '', weight: '', flaws: [] };
  for (const part of line.split(',').map((p) => p.trim()).filter(Boolean)) {
    const low = part.toLowerCase();
    let m;
    if ((m = low.match(/^(?:paid|cost|bought(?: for| at)?)\s*\$?(\d+(?:\.\d{1,2})?)$/))) out.cost = Number(m[1]);
    else if (out.price == null && out.item.length && (m = low.match(/^\$?(\d+(?:\.\d{1,2})?)$/))) out.price = Number(m[1]);
    else if (!out.condition && conditionOf(low)) out.condition = conditionOf(low);
    else if (!out.weight && classes.includes(low.replace(/\s+/g, ''))) out.weight = low.replace(/\s+/g, '');
    else if (out.price == null && !out.condition) out.item.push(part);
    else out.flaws.push(part);
  }
  return { ...out, item: out.item.join(', '), flaws: out.flaws.join(', ') };
}

function batchTool(N) {
  const classes = Object.keys(N.shipping.classes);
  const write = listingTool(N);
  return {
    name: 'resale.write_batch',
    title: 'List a batch',
    description: "Up to 40 listings for the one site you start on, each within that site's checked limits, with honest condition and flaws, the fee, what you keep and your profit, as a CSV to work through plus the lines for your profit tracker.",
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 2,
    timeoutSec: 60,
    input: {
      type: 'object',
      required: ['items'],
      properties: {
        items: { type: 'string', format: 'textarea', maxLength: 6000, title: 'Items to list, one per line', description: 'Item, price, condition, flaws, what you paid. Like "Levi\'s 501 jeans 34x32, 42, Good, light wear at back hem, paid 6"' },
        platform: { type: 'string', enum: N.platforms.map((p) => p.id), default: 'ebay', title: 'The one site you list on' },
        weight: { type: 'string', enum: classes, default: '1lb', title: 'Most items ship as', description: 'Add "2lb" or "local" to a line to change one item' },
        profit: { type: 'string', maxLength: 8, title: 'Lowest profit you accept per item', default: String(N.pricing.min_profit) },
      },
    },
    output: { type: 'object', required: ['listings', 'skipped'], properties: { listings: { type: 'array' }, skipped: { type: 'array' }, file: { type: 'object' }, tracker_items: { type: 'string' } } },
    async run(input, ctx) {
      const lines = C.linesOf(input.items, MAX_LINES + 1);
      if (!lines.length) throw new Error('Add the items to list, one per line: item, price, condition, flaws, what you paid.');
      const P = N.platforms.find((p) => p.id === input.platform) || N.platforms[0];
      const weight0 = classes.includes(input.weight) ? input.weight : '1lb';
      const profit = Math.max(0, num(input.profit, N.pricing.min_profit) || 0);
      const listings = [];
      const skipped = [];
      for (const line of lines.slice(0, MAX_LINES)) {
        const it = parseLine(line, classes);
        const name = clip(plain(it.item), 100);
        if (!name) {
          skipped.push({ line, why: 'No item name at the start of the line.' });
          continue;
        }
        if (FAKE.test(line)) {
          skipped.push({ line, why: BLOCKED });
          continue;
        }
        if (it.price == null) {
          skipped.push({ line, why: 'No price: add a sold price you checked, like "42".' });
          continue;
        }
        if ((P.price_min && it.price < P.price_min) || (P.price_max && it.price > P.price_max)) {
          skipped.push({ line, why: `${P.name} takes prices from ${usd(P.price_min || 1)} to ${usd(P.price_max)}.` });
          continue;
        }
        const weight = it.weight || weight0;
        const local = weight === 'local';
        const out = await write.run({ item: name, condition: it.condition || 'Good', flaws: it.flaws, price: String(it.price), weight }, ctx);
        const l = out.listings.find((x) => x.platform === P.name);
        const row = F.feeTable(N, { price: it.price, weight, cost: it.cost || 0 }).find((r) => r.id === P.id);
        const floor = it.cost != null ? F.floorPrice(N, P.id, { cost: it.cost, profit, weight }) : null;
        const check = [
          /\bcrib\b/i.test(name) ? "Cribs made before June 2011 can't be sold: check the date label." : '',
          KIDS.test(name) || APPLIANCE.test(name) ? `${KIDS.test(name) ? "Kids' item" : 'Appliance'}: check cpsc.gov/Recalls before you post.` : '',
          it.condition ? '' : 'Condition not given: set to Good, so check it.',
          it.flaws || /^new/i.test(it.condition) ? '' : 'No flaws listed: look it over once more before you post.',
          it.cost == null ? 'Add what you paid to see your profit.' : '',
          floor && it.price < floor ? `Under your lowest price of ${usd(floor)}: it won't leave ${usd(profit)} profit.` : '',
          l.title && P.title_max && l.title_len < P.title_max / 2 ? `Short title (${l.title_len} of ${P.title_max} characters): add color, style or material words buyers search for.` : '',
          local && !P.local_free ? `${P.name} has no local pickup listing here: list it on Facebook Marketplace for pickup instead.` : '',
        ].filter(Boolean);
        listings.push({
          n: listings.length + 1,
          item: name,
          title: l.title || '',
          title_len: l.title_len,
          description: l.description,
          hashtags: l.hashtags,
          price: it.price,
          price_text: usd(it.price),
          condition: out.condition,
          cost: it.cost,
          fee: usd(row.fee),
          keep: usd(row.keep),
          profit: it.cost != null ? usd(row.profit) : '',
          floor,
          check: check.join(' '),
          tracker: `${name.replace(/,/g, ' ')}, ${it.cost != null ? it.cost : ''}, ${P.id === 'facebook' ? (local ? 'Facebook local' : 'Facebook shipped') : TRACKER_NAME[P.id]}, ${it.price}`,
        });
      }
      if (lines.length > MAX_LINES) skipped.push({ line: `Lines after ${MAX_LINES}`, why: `Up to ${MAX_LINES} items per batch: run the rest as a second batch.` });
      const today = time.today(ctx);
      let file = null;
      if (listings.length) {
        const csv = files.csv(listings, [
          { key: 'n', label: '#' },
          { key: 'item', label: 'Item' },
          { key: 'title', label: P.title_max ? `Title (up to ${P.title_max})` : 'Title' },
          { key: 'description', label: P.description_max ? `Description (up to ${P.description_max})` : 'Description' },
          { key: 'price', label: 'Price' },
          { key: 'condition', label: 'Condition' },
          { key: 'fee', label: `${P.name} fee` },
          { key: 'keep', label: 'You keep' },
          { key: 'profit', label: 'Profit after cost' },
          { key: 'check', label: 'Check before you post' },
        ]);
        file = await save.saveFile(ctx, save.fileName('resale', `${P.name} listings`, today, '.csv'), csv);
      }
      const shots = PHOTOS.slice(0, P.photos_max ? Math.min(P.photos_max, PHOTOS.length) : PHOTOS.length);
      const limits = [
        P.title_max ? `titles up to ${P.title_max} characters` : 'no separate title (the description comes first)',
        P.description_max ? `descriptions up to ${P.description_max}` : 'no published description limit',
        P.hashtags_max ? `up to ${P.hashtags_max} hashtags` : '',
        P.photos_max ? `up to ${P.photos_max} photos` : 'photo limit: check the app',
        P.price_max ? `prices ${usd(P.price_min || 1)} to ${usd(P.price_max)}` : '',
      ].filter(Boolean);
      return {
        platform: P.name,
        listings,
        skipped,
        file,
        limits: `${P.name}: ${limits.join(', ')}.`,
        limits_note: P.limits_note || '',
        fee_text: P.fee_text,
        source: P.source,
        checked: P.checked,
        photos: `${shots.length} photos: ${shots.join('; ')}`,
        tracker_items: listings.map((l) => l.tracker).join('\n'),
        rules: N.rules,
      };
    },
    view(out) {
      return views.blocks(
        views.metric(`Your ${out.platform} batch`, `${out.listings.length} ready`, `${out.skipped.length ? `${out.skipped.length} skipped. ` : ''}${out.limits}`),
        out.skipped.length ? views.table([{ key: 'line', label: 'Skipped line' }, { key: 'why', label: 'Why' }], out.skipped) : null,
        out.listings.map((l) => views.copy(`${l.n}. ${l.item}: ${l.price_text}, fee ${l.fee}, you keep ${l.keep}${l.profit ? `, profit ${l.profit}` : ''}`, [l.title, l.description].filter(Boolean).join('\n\n'))),
        out.listings.some((l) => l.check) ? views.table([{ key: 'item', label: 'Item' }, { key: 'check', label: 'Check before you post' }], out.listings.filter((l) => l.check)) : null,
        out.photos ? views.text(`Photos for every listing: ${out.photos}.`) : null,
        views.text(`Fee: ${out.fee_text}.${out.limits_note ? ` ${out.limits_note}` : ''}`),
        views.link(`${out.platform} fees (checked ${out.checked})`, out.source),
        views.file(out.file, `Your ${out.platform} listings (CSV)`),
      );
    },
  };
}

module.exports = { batchTool, parseLine };
