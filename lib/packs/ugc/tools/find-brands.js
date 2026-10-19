// Real small brands in the member's category (25 by default, up to 100), read from each store's own
// public Shopify files, each with one product to film, what its content is missing and a first
// message with two follow-ups. Live when the network answers, otherwise the dated snapshot in
// data/brands.json (also read from the stores themselves). With save on, every brand goes to the
// Pipeline with what Do my day reads (msg, facts, score and channel, contract 13), its email or
// Instagram read from its own homepage. With skipKnown on, anyone already there is skipped and the
// CSV carries today's date, so "Your next 25" can run every week without repeating anyone.

const kit = require('../../_kit');
const { views, save, files, web, time, money, text, brain } = kit;
const U = require('../lib/ugc');

const COLUMNS = ['rank', 'brand', 'category', 'store', 'country', 'products', 'prices', 'product', 'price', 'link', 'missing', 'channel', 'email', 'instagram', 'dm', 'subject', 'email_text', 'follow_up_day_4', 'follow_up_day_10', 'read'];

async function toPipeline(ctx, list) {
  if (!ctx || !ctx.leads || typeof ctx.leads.upsert !== 'function') return { saved: 0, error: '', ids: [] };
  let saved = 0;
  let error = '';
  const ids = [];
  for (const row of list) {
    try {
      const back = await ctx.leads.upsert(row);
      ids.push((back && back.id) || null);
      saved++;
    } catch (e) {
      ids.push(null);
      error = web.scrubKeys(text.oneLine(String((e && e.message) || ''))).slice(0, 160);
      if (/full/i.test(error)) break;
    }
  }
  return { saved, error, ids };
}

module.exports = {
  name: 'ugc.find_brands',
  title: 'Find brands to pitch',
  description: 'Lists small online brands in your category (25 by default, up to 100) from their public Shopify store data, with one product to film for each, what their content is missing and a first message, and can add them to your Pipeline, skipping anyone already there.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  timeoutSec: 420,
  input: {
    type: 'object',
    properties: {
      category: { type: 'string', title: 'What do you want to film?', enum: U.CAT_IDS, default: 'skincare' },
      stores: { type: 'string', title: 'Store links you already like (optional)', description: 'Paste up to 10 store links, one per line. They go first if they are Shopify stores.' },
      count: { type: 'integer', minimum: 1, maximum: 100, default: 25, title: 'How many brands' },
      check: { type: 'integer', minimum: 0, maximum: 5, default: 5, title: 'How many product pages to check for video' },
      only: { type: 'boolean', title: 'Only the stores I pasted', default: false },
      skipKnown: { type: 'boolean', title: 'Skip everyone already in my Pipeline', default: false },
      save: { type: 'boolean', title: 'Add them to my Pipeline', default: false },
      exclude: { type: 'string', maxLength: 6000, title: 'Stores to skip (optional)', description: 'One per line, like brand.com.' },
      name: { type: 'string', maxLength: 60, title: 'Your name' },
      business: { type: 'string', maxLength: 80, title: 'Your creator or business name (optional)' },
      site: { type: 'string', maxLength: 300, title: 'Portfolio link (optional)' },
      myAddress: { type: 'string', maxLength: 160, title: 'Your mailing address (for emails)' },
    },
    required: ['category'],
  },
  output: {
    type: 'object',
    properties: { brands: { type: 'array' }, first: { type: ['object', 'null'] }, top5: { type: 'array' }, csv: { type: 'object' }, live: { type: 'integer' }, skipped: { type: 'array' }, saved: { type: 'integer' } },
    required: ['brands'],
  },
  async run(input, ctx) {
    const today = time.today(ctx);
    const br = brain.brainOf(ctx, {});
    const cat = U.catOf(input.category);
    const count = Math.max(1, Math.min(100, Number(input.count) || 25));
    const daily = !!input.save && !!input.skipKnown;
    const sender = { name: text.plain(input.name || br.firstName || ''), business: text.plain(input.business || br.name || ''), site: text.plain(input.site || br.website || ''), address: text.plain(input.myAddress || br.address || '') };

    // Who to leave out: the Pipeline (skipKnown) and the stores the member typed.
    const known = input.skipKnown ? await kit.leads.known(ctx) : { keys: new Set(), names: new Set(), sites: new Set() };
    for (const d of U.parseStores(input.exclude, 500)) known.sites.add(d);
    const isKnown = (b) => known.sites.has(b.domain) || known.sites.has(`www.${b.domain}`) || known.keys.has(`site:${b.domain}`) || (b.name && known.names.has(String(b.name).toLowerCase().trim()));
    let skippedKnown = 0;

    const pasted = U.parseStores(input.stores);
    if (input.only && !pasted.length) throw new Error('Paste the store link first, like glowbrand.com.');
    let pool = [];
    for (const d of pasted) {
      const b = { ...(U.findSnapshot(d) || { domain: d, name: d }), domain: d, pasted: true };
      if (!input.only && isKnown(b)) skippedKnown++;
      else pool.push({ ...b, category: U.CATS[b.category] ? b.category : cat.id });
    }
    if (!input.only) {
      const add = (list, id) => {
        for (const b of list) {
          if (pool.some((x) => x.domain === b.domain)) continue;
          if (isKnown(b)) {
            skippedKnown++;
            continue;
          }
          pool.push({ ...b, category: b.filled || id });
        }
      };
      add(U.snapshot(cat.id), cat.id);
      // A member who runs this every week works through their own category: add the closest ones, labeled.
      for (const near of U.NEAR[cat.id] || []) {
        if (pool.length >= count + 6) break;
        add(U.snapshot(near), near);
      }
    }
    if (!pool.length) throw new Error(skippedKnown ? `Every ${cat.label.toLowerCase()} brand on the list is already in your Pipeline. Paste store links you like, or pick another category.` : 'No brands found. Try another category.');

    pool = pool
      .map((b) => ({ ...b, _s: b.pasted ? 1000 : U.scoreBrand(b, today, cat) }))
      .sort((a, b) => b._s - a._s)
      .slice(0, count + 6);
    const skipped = [];
    const fresh = await web.mapLimit(pool, 6, async (b) => U.readStore(ctx, b.domain).catch(() => null), ctx);
    pool = pool.map((b, i) => (fresh[i] ? { ...b, ...fresh[i], pasted: b.pasted, category: b.category } : b));
    pool = pool.filter((b) => {
      const ok = b.picks && b.picks.length;
      if (!ok && b.pasted) skipped.push({ store: b.domain, why: "Couldn't read public product data there. It may not be a Shopify store, or it blocks readers." });
      return ok;
    });
    if (!pool.length) throw new Error(skipped.length ? `${skipped[0].store}: ${skipped[0].why}` : 'No brands found. Try another category.');
    // Each brand's product and gaps in its own category; the rank is the fit for what the member films.
    const rowOf = (b, rank) => {
      const r = U.brandRow(b, rank, today, U.catOf(b.category || cat.id));
      return { ...r, category: b.category || cat.id, score: b.pasted ? r.score : U.scoreBrand(b, today, cat), pasted: !!b.pasted };
    };
    let rows = pool.map((b) => rowOf(b, 0));
    rows.sort((a, b) => (b.pasted ? 1 : 0) - (a.pasted ? 1 : 0) || b.score - a.score);
    rows = rows.slice(0, count).map((r, i) => ({ ...r, rank: i + 1 }));
    const nCheck = Math.max(0, Math.min(5, input.check == null ? 5 : Number(input.check)));
    if (fresh.some(Boolean) && nCheck) {
      const checks = await web.mapLimit(rows.slice(0, nCheck), 5, async (r) => (r.product && r.product.handle ? U.hasVideo(ctx, r.domain, r.product.handle).catch(() => null) : null), ctx);
      checks.forEach((c, i) => {
        if (!c) return;
        const src = pool.find((x) => x.domain === rows[i].domain);
        const p = src.picks.find((x) => x.handle === rows[i].product.handle);
        if (p) {
          p.video = c.video;
          if (!p.image && c.image) p.image = c.image;
        }
        rows[i] = { ...rowOf(src, rows[i].rank) };
      });
    }
    const live = rows.filter((r) => r.read === 'live').length;
    const widened = [...new Set(rows.filter((r) => r.category !== cat.id && !r.pasted).map((r) => U.catOf(r.category).label))];

    // Where to reach each one (their own homepage), when they go to the Pipeline or it's one store.
    let contacts = rows.map(() => null);
    if (input.save || input.only) contacts = await web.mapLimit(rows, 6, async (r) => U.contactOf(ctx, r.domain).catch(() => null), ctx);
    rows = rows.map((r, i) => {
      const c = contacts[i];
      return { ...r, contact: c ? { email: c.email, instagram: c.instagram, tiktok: c.tiktok, contactPage: c.contactPage } : null, channel: c && c.email ? 'email' : c && c.instagram ? 'ig' : 'site' };
    });

    // A first message and two follow-ups for every brand. None mentions a concept: none is made yet.
    const msgs = rows.map((r) => U.pitchFor(r, sender));
    let pipe = { saved: 0, error: '', ids: [] };
    if (input.save) pipe = await toPipeline(ctx, rows.map((r, i) => U.pipelineRow(r, msgs[i], contacts[i])));
    rows = rows.map((r, i) => ({ ...r, ...(input.save && pipe.ids[i] ? { inPipeline: true, id: pipe.ids[i], key: `site:${r.domain}`, stage: 'found' } : {}) }));
    ctx.log(`${rows.length} brands, ${live} read live from their stores today${skippedKnown ? `, ${skippedKnown} skipped (already in your Pipeline or your list)` : ''}${input.save ? `, ${pipe.saved} added to your Pipeline` : ''}`);

    const csvRows = rows.map((r, i) => {
      const m = msgs[i];
      const byEmail = r.channel !== 'ig';
      return {
        rank: r.rank,
        brand: r.name,
        category: U.catOf(r.category).label,
        store: r.url,
        country: r.country,
        products: r.products,
        prices: r.price_range,
        product: r.product && r.product.title,
        price: r.product && r.product.price,
        link: r.product && r.product.url,
        missing: r.gaps.map((g) => g.text).join('; '),
        channel: r.channel === 'email' ? 'Email' : r.channel === 'ig' ? 'Instagram DM' : 'Contact form on their store',
        email: (r.contact && r.contact.email) || '',
        instagram: r.contact && r.contact.instagram ? `@${r.contact.instagram}` : '',
        dm: m.dm,
        subject: m.subject,
        email_text: m.email,
        follow_up_day_4: byEmail ? m.follow1Email : m.follow1,
        follow_up_day_10: byEmail ? m.follow2Email : m.follow2,
        read: r.read === 'live' ? `live ${r.checked}` : `snapshot ${r.checked}`,
      };
    });
    const label = input.only ? 'store-check' : daily ? 'next-brands' : 'first-25';
    const csv = await save.saveFile(ctx, save.fileName(label, input.only ? pool[0].domain : cat.label, input.only ? '' : 'brands', daily ? today : '', '.csv'), files.csv(csvRows, COLUMNS, { bom: true }));
    return {
      category: cat.id,
      label: cat.label,
      brands: rows,
      first: rows[0] || null,
      top5: rows.slice(0, 5),
      messages: msgs.slice(0, 5),
      csv,
      live,
      skipped,
      skippedKnown,
      widened,
      saved: pipe.saved,
      saveError: pipe.error,
      daily,
      checked: live ? today : U.brandsData().checked,
    };
  },
  view(out) {
    const n = out.brands.length;
    const m = (out.messages || [])[0];
    const b = out.brands[0];
    const email = b && b.channel === 'email' && b.contact && b.contact.email ? { to: b.contact.email, subject: m && m.subject } : undefined;
    return views.blocks(
      views.metric(out.daily ? 'New brands to pitch' : n === 1 ? 'Brand to pitch' : 'Brands to pitch', n, out.skippedKnown ? `${out.skippedKnown} skipped: already in your Pipeline or on your skip list` : undefined),
      views.metric('Read live today', out.live || 0, out.live ? null : `Store facts as read on ${out.checked}`),
      out.widened && out.widened.length ? views.text(`Your ${out.label.toLowerCase()} list ran short, so this adds ${out.widened.join(' and ').toLowerCase()} brands, marked in the table.`) : null,
      views.table(
        [
          { key: 'rank', label: '#', format: 'number' },
          { key: 'name', label: 'Brand' },
          { key: 'product', label: 'Product to film' },
          { key: 'price', label: 'Price' },
          { key: 'gap', label: 'What is missing' },
          { key: 'reach', label: 'Reach them by' },
        ],
        out.brands.map((x) => ({ rank: x.rank, name: x.category !== out.category ? `${x.name} (${U.catOf(x.category).label.toLowerCase()})` : x.name, product: x.product ? x.product.title : '', price: x.product ? money.usd(x.product.price) : '', gap: x.gap, reach: x.contact ? (x.channel === 'email' ? 'Email' : x.channel === 'ig' ? 'Instagram' : 'Store contact form') : 'Their store' })),
      ),
      ...(out.skipped || []).map((s) => views.text(`${s.store}: ${s.why}`)),
      out.saved ? views.text(`Added ${out.saved} to your Pipeline, each with its first message, two follow-ups and where to send them. Do my day hands them out a few at a time.`) : out.saveError ? views.text("Couldn't add them to your Pipeline this time. The CSV has everything.") : null,
      out.daily && m && b ? views.copy(`First message for #1, ${b.name} (${b.channel === 'ig' ? 'Instagram DM' : b.channel === 'email' ? 'email' : "the contact page on their store"})`, b.channel === 'ig' ? m.dm : m.email, email) : null,
      views.file(out.csv, n === 1 ? 'The brand, its store facts and its messages (.csv)' : `All ${n} brands with their messages (.csv)`),
    );
  },
};
