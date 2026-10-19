// The listing a buyer reads, written within each platform's own limits (title, description,
// hashtags, photos), plus the profit tracker CSV with working formulas for fees, profit, days to sell
// and what to do next. Limits come from data/niche.json, each with its source and date.

const { views, files, save, time, money, text } = require('../../_kit');
const C = require('../../_kit/common');
const F = require('../lib/fees');

const { usd, num } = money;
const { plain } = text;

const CONDITIONS = ['New with tags', 'New without tags', 'Like new', 'Good', 'Fair'];
const BANNED_WORDS = /\b(dupe|replica|inspired|look ?alike|knock ?off|fake)\b/gi;
const BLOCKED = "Not written: words like replica, dupe, inspired or fake mean a look-alike, and look-alikes can't be listed under any brand's name. List only genuine items, under their own brand.";
const TAG_SKIP = new Set(['the', 'and', 'with', 'for', 'made', 'size', 'new', 'used', 'inch', 'inches', 'nwt', 'nwot', 'lot', 'set', 'item', 'one', 'pair']);
const PHOTOS = ['Front, on a plain background in daylight', 'Back', 'Brand label or tag', 'Size tag or model number', 'Close-up of the material or finish', 'Every flaw, up close', 'Measurements with a tape measure', 'Item in use or folded, to show size'];

// Fit words into a limit without cutting a word in half.
function fit(words, max) {
  if (!max) return words.join(' ');
  const out = [];
  for (const w of words) {
    if ([...out, w].join(' ').length > max) break;
    out.push(w);
  }
  // A cut title never ends on a dangling word ("made in").
  while (out.length > 1 && /^(made|in|with|and|for|the|of|a|by|from|to)$/i.test(out[out.length - 1])) out.pop();
  return out.join(' ');
}

function cap(s, max) {
  if (!max || s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('. ') + 1)).trim() || cut.trim();
}

function listingTool(N) {
  return {
    name: 'resale.write_listing',
    title: 'Listing writer',
    description: 'A title, description, hashtags and photo checklist for each platform, within each site\'s own limits, with honest condition and flaws, and the fee and what you keep at your price.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: {
      type: 'object',
      required: ['item'],
      properties: {
        item: { type: 'string', maxLength: 100, title: 'What it is', description: 'Like "501 jeans" or "cast iron skillet 10 inch"' },
        brand: { type: 'string', maxLength: 60, title: 'Brand (only the real one)' },
        size: { type: 'string', maxLength: 40, title: 'Size or model (optional)' },
        color: { type: 'string', maxLength: 40, title: 'Color (optional)' },
        condition: { type: 'string', enum: CONDITIONS, default: 'Good', title: 'Condition' },
        flaws: { type: 'string', maxLength: 300, title: 'Flaws (every one)', description: 'Leave empty only if you checked and found none' },
        details: { type: 'string', maxLength: 600, title: 'Details (material, measurements, what is included)' },
        price: { type: 'string', maxLength: 10, title: 'Your price', default: '25' },
        weight: { type: 'string', enum: Object.keys(N.shipping.classes), default: '1lb', title: 'Ships as' },
        keywords: { type: 'string', maxLength: 120, title: 'Words buyers search (optional)', description: 'Style, era, use: "vintage 90s straight leg"' },
      },
    },
    output: { type: 'object', required: ['listings'], properties: { listings: { type: 'array' } } },
    async run(input, ctx) {
      const clean = (s) => plain(s || '').replace(BANNED_WORDS, '').replace(/\s{2,}/g, ' ').trim();
      const brand = clean(input.brand);
      const item = clean(input.item) || 'Item';
      const size = clean(input.size);
      const color = clean(input.color);
      const condition = CONDITIONS.includes(input.condition) ? input.condition : 'Good';
      const flaws = clean(input.flaws);
      const details = clean(input.details);
      const keywords = clean(input.keywords);
      const price = Math.max(1, num(input.price, 25) || 25);
      const weight = N.shipping.classes[input.weight] ? input.weight : '1lb';
      const removed = /\b(dupe|replica|inspired|look ?alike|knock ?off|fake)\b/i.test(`${input.brand} ${input.item} ${input.keywords}`);
      if (removed) return { listings: [], price, removed, condition, blocked: BLOCKED };
      const titleWords = [brand, item, size, color, keywords, condition === 'New with tags' ? 'NWT' : ''].join(' ').split(/\s+/).filter(Boolean);
      const fees = F.feeTable(N, { price, weight });
      const listings = N.platforms.map((p) => {
        const title = p.title_max ? fit(titleWords, p.title_max) : '';
        const tags = p.hashtags_max ? [...new Set([brand, color, ...item.split(/\s+/), ...keywords.split(/\s+/)].map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((t) => t.length > 2 && !/^\d+(x\d+)?$/.test(t) && !TAG_SKIP.has(t)))].slice(0, p.hashtags_max).map((t) => `#${t}`) : [];
        const lines = [
          p.title_max ? '' : `${[brand, item, size, color].filter(Boolean).join(' ')}`,
          p.title_max ? `${[brand, item].filter(Boolean).join(' ')}${size ? `, ${size}` : ''}${color ? `, ${color}` : ''}.` : '',
          `Condition: ${condition}. ${flaws ? `Flaws: ${flaws}. Shown in the photos.` : 'No flaws found when I checked; see every photo.'}`,
          details ? `Details: ${details}.` : '',
          weight === 'local' ? 'Local pickup in a public place.' : 'Ships within 1 business day with tracking.',
          'Questions welcome before you buy.',
          tags.length ? tags.join(' ') : '',
        ].filter(Boolean).map((l) => l.replace(/\.\./g, '.'));
        const description = cap(lines.join('\n'), p.description_max);
        const shots = PHOTOS.slice(0, p.photos_max ? Math.min(p.photos_max, PHOTOS.length) : PHOTOS.length);
        const f = fees.find((r) => r.id === p.id);
        return {
          platform: p.name,
          title,
          title_len: title.length,
          title_max: p.title_max || null,
          description,
          desc_len: description.length,
          description_max: p.description_max || null,
          hashtags: tags,
          photos: `${shots.length} photos: ${shots.join('; ')}`,
          photos_max: p.photos_max || null,
          fee: usd(f.fee),
          keep: usd(f.keep),
          limits: [p.title_max ? `title ${title.length} of ${p.title_max}` : 'no separate title', p.description_max ? `description ${description.length} of ${p.description_max}` : 'no published description limit', p.photos_max ? `up to ${p.photos_max} photos` : 'photo limit: check the app'].join(', '),
          note: p.limits_note || '',
          source: p.source,
          checked: p.checked,
        };
      });
      return { listings, price, removed, condition };
    },
    view(out) {
      return views.blocks(
        out.blocked ? views.text(out.blocked) : null,
        out.listings.map((l) => views.copy(`${l.platform}: ${l.limits}. Fee ${l.fee}, you keep ${l.keep} at ${usd(out.price)}`, [l.title, l.description].filter(Boolean).join('\n\n'))),
        views.table([{ key: 'platform', label: 'Platform' }, { key: 'photos', label: 'Photo checklist' }, { key: 'note', label: 'Limits note' }], out.listings),
      );
    },
  };
}

// ---------- profit tracker ----------

const PLATFORM_VALUES = ['eBay', 'Poshmark', 'Mercari', 'Depop', 'Facebook shipped', 'Facebook local'];

function feeFormula(r, N) {
  const P = Object.fromEntries(N.platforms.map((p) => [p.id, p]));
  const e = P.ebay;
  const po = P.poshmark;
  const m = P.mercari;
  const d = P.depop;
  const fb = P.facebook;
  const tot = `(I${r}+J${r}+K${r})`;
  return `=IF(I${r}="","",IF(B${r}="eBay",ROUND(${e.pct}*${tot}+IF(${tot}>${e.small_max},${e.fixed},${e.fixed_small}),2),IF(B${r}="Poshmark",IF(I${r}<=${po.flat_max},${po.flat},ROUND(${po.pct}*I${r},2)),IF(B${r}="Mercari",ROUND(${m.pct}*(I${r}+J${r}),2),IF(B${r}="Depop",ROUND(${d.pct}*${tot}+${d.fixed},2),IF(B${r}="Facebook shipped",MAX(${fb.min},ROUND(${fb.pct}*${tot},2)),0))))))`;
}

function trackerCsv(N, items, rows, today) {
  const out = [];
  for (let i = 0; i < rows; i++) {
    const r = i + 2;
    const it = items[i] || {};
    out.push({
      item: it.item || '',
      platform: it.platform || '',
      bought: it.item && !it.list ? today : '',
      cost: it.cost != null ? it.cost : '',
      where: it.where || '',
      listed: it.list ? today : '',
      list: it.list || '',
      sold_on: '',
      sold: '',
      ship: '',
      tax: '',
      label: '',
      fee: feeFormula(r, N),
      profit: `=IF(I${r}="","",I${r}+J${r}-L${r}-M${r}-D${r})`,
      days: `=IF(OR(F${r}="",H${r}=""),"",H${r}-F${r})`,
      status: `=IF(A${r}="","",IF(H${r}<>"","Sold",IF(F${r}="","Not listed",IF(TODAY()-F${r}>${N.pricing.move_day},"Move it",IF(TODAY()-F${r}>${N.pricing.markdowns[0].day},"Drop the price","Listed")))))`,
    });
  }
  return files.csv(out, [
    { key: 'item', label: 'Item' },
    { key: 'platform', label: `Platform (${PLATFORM_VALUES.join(', ')})` },
    { key: 'bought', label: 'Bought on' },
    { key: 'cost', label: 'Cost' },
    { key: 'where', label: 'Where bought' },
    { key: 'listed', label: 'Listed on' },
    { key: 'list', label: 'List price' },
    { key: 'sold_on', label: 'Sold on' },
    { key: 'sold', label: 'Sold price' },
    { key: 'ship', label: 'Shipping the buyer paid' },
    { key: 'tax', label: 'Sales tax on the order' },
    { key: 'label', label: 'Label cost' },
    { key: 'fee', label: 'Fee' },
    { key: 'profit', label: 'Profit' },
    { key: 'days', label: 'Days to sell' },
    { key: 'status', label: 'Next step' },
  ]);
}

function trackerTool(N) {
  return {
    name: 'resale.make_tracker',
    title: 'Profit tracker',
    description: 'A profit tracker CSV that opens in Google Sheets or Excel with working formulas: the fee for each platform, profit after cost, label and fee, days to sell, and the next step (drop the price at 30 days, move it at 60).',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: {
      type: 'object',
      properties: {
        items: { type: 'string', maxLength: 4000, title: 'Items you have (optional)', description: 'One per line: item, cost, platform and, once it is listed, the list price. Like "Levi\'s 501 jeans, 6, eBay, 42"' },
        rows: { type: 'string', maxLength: 3, title: 'Rows', default: '50' },
      },
    },
    output: { type: 'object', required: ['file'], properties: { file: { type: 'object' } } },
    async run(input, ctx) {
      const items = C.linesOf(input.items, 200).map((l) => {
        const [item, cost, platform, list] = l.split(',').map((s) => s.trim());
        const pf = PLATFORM_VALUES.find((p) => p.toLowerCase() === String(platform || '').toLowerCase()) || '';
        return { item, cost: num(cost, null), platform: pf, list: num(list, null) };
      });
      const rows = Math.max(items.length, Math.min(500, parseInt(input.rows, 10) || 50));
      const today = time.today(ctx);
      const csv = trackerCsv(N, items, rows, today);
      const file = await save.saveFile(ctx, save.fileName('resale', 'profit tracker', today, '.csv'), csv);
      return { file, rows, items: items.length, platforms: PLATFORM_VALUES };
    },
    view(out) {
      return views.blocks(
        views.text(`Open in Google Sheets or Excel. Fill in the white columns as you buy, list and sell; Fee, Profit, Days to sell and Next step work out themselves. Platform must be one of: ${out.platforms.join(', ')}. Fee math follows each site's own fee page (checked 2026-10-19); recheck if a site changes its fees.`),
        views.file(out.file, `Profit tracker (${out.rows} rows)`),
      );
    },
  };
}

module.exports = { listingTool, trackerTool, trackerCsv, feeFormula, fit, PLATFORM_VALUES, CONDITIONS, BLOCKED, PHOTOS };
