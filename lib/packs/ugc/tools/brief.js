// The proposal for one brand, as a creative brief: the package they'd say yes to at the member's
// prices, a concept for every video built on their real products (title, price and page from their
// own store, read live by shop.read_store or from the dated list), hooks to test, the shots, the dates,
// what they get, what the member needs from them, the use in plain words and the honesty rules. It
// also hands sales.proposal and sales.quote the options, the line items and the cover notes, so the
// brand gets one brief, one proposal and one quote with the same numbers.

const kit = require('../../_kit');
const { text, views, save, brain, time, money } = kit;
const NICHE = require('../data/niche.json');
const U = require('../lib/ugc');
const talk = require('../../_kit/talk');
const close = require('../lib/close');
const offer = require('../lib/offer');
const pages = require('../lib/pages');

const usd = (n) => money.usd(n);

// Four kinds of video that need no claim the brand can't back up. {p}: the product's short name.
const FORMATS = [
  {
    id: 'first',
    name: 'First look',
    angle: (cat) => `A first look: ${cat.angle}.`,
    hooks: ['Here is {p} up close.', "First time opening {p}. Let's see.", 'Before you buy {p}, watch this.'],
    beats: (cat) => [
      { say: 'The hook, with the product in hand', shot: cat.shots[0] },
      { say: 'What it looks like up close', shot: cat.shots[1] },
      { say: 'My honest first reaction, filmed on first use', shot: cat.shots[2] },
      { say: 'The price and where to get it', shot: cat.shots[3] },
    ],
  },
  {
    id: 'use',
    name: 'How it fits a normal day',
    angle: () => 'A real moment of use, start to finish, in my own space.',
    hooks: ['How {p} fits into a normal morning.', '{p}, in under 15 seconds.', 'What using {p} actually looks like.'],
    beats: (cat) => [
      { say: 'The hook, mid-routine', shot: 'Phone at eye level, the product already in frame' },
      { say: 'Using it, step by step', shot: cat.shots[1] },
      { say: 'What I noticed, in my own words', shot: cat.shots[2] },
      { say: 'Where to get it', shot: cat.shots[3] },
    ],
  },
  {
    id: 'unbox',
    name: 'Unboxing',
    angle: () => 'Opening the package on camera: what arrives and what it looks like out of the box.',
    hooks: ['Unboxing {p}.', 'What actually comes with {p}.', 'Opening {p} so you can see it first.'],
    beats: () => [
      { say: 'The hook, package still closed', shot: 'Box on a clean table, hands in frame' },
      { say: 'Opening it, first look at the product', shot: 'Top-down, slow, no cuts' },
      { say: 'Each thing in the box, held up to the camera', shot: 'Close-ups, label facing camera' },
      { say: 'The price and where to get it', shot: 'Product next to the box' },
    ],
  },
  {
    id: 'details',
    name: 'The details',
    angle: () => 'Everything on the label and the page, read out plainly, so a shopper knows what they get.',
    hooks: ['Three things to know about {p}.', 'Reading the label on {p} so you don\'t have to.', 'Everything that comes with {p}.'],
    beats: () => [
      { say: 'The hook, product held to camera', shot: 'Face and product in frame, window light' },
      { say: 'What the label says: size, what it is for, how to use it', shot: 'Close-up of the label' },
      { say: 'How it looks and feels in use', shot: 'Hands using it' },
      { say: 'The price and where to get it', shot: 'Product on the counter' },
    ],
  },
];

function fill(s, p = 'the product') {
  return String(s || '').replace(/\{product\}/g, p);
}

const AT = ['0 to 3s', '3 to 7s', '7 to 11s', '11 to 15s'];

// One concept: a format, a real product and the category's shots.
function conceptFor(i, product, cat, brand) {
  const f = FORMATS[i % FORMATS.length];
  const short = U.shortTitle(product.title);
  const hooks = f.hooks.map((h) => h.replace(/\{p\}/g, short));
  const beats = f.beats(cat).map((b, k) => ({
    at: AT[k],
    say: b.say,
    shot: fill(b.shot, short),
    caption: k === 0 ? hooks[0] : k === 3 ? (product.price ? `${usd(product.price)} at ${brand.domain || 'your site'}` : brand.domain || 'Your site') : k === 2 ? 'Captions of what I say' : short,
  }));
  return { n: i + 1, format: f.name, length: 15, product: { title: product.title, price: product.price, url: product.url }, angle: f.angle(cat), hooks, beats };
}

// The products to film: the ones the member typed (matched to the store's), else the newest the store
// lists, else the one on the Pipeline row.
function productsFor(typed, brand, read) {
  const domain = brand.domain || '';
  const live = read && read.ok && !read.sample && String(read.domain || '').replace(/^www\./, '') === domain.replace(/^www\./, '') ? read.picks || [] : null;
  const snap = domain ? U.findSnapshot(domain) : null;
  const store = (live || (snap && snap.picks) || [])
    .map((p) => ({ title: U.safeName(p.title), price: Number(p.price) || 0, url: p.handle && domain ? `https://${domain}/products/${p.handle}` : '' }))
    .filter((p) => p.title && p.price > 0);
  const lines = String(typed || '')
    .split(/\n|;/)
    .map((l) => text.oneLine(l))
    .filter(Boolean)
    .slice(0, 4);
  const norm = (x) => talk.norm(x);
  const chosen = lines.map((l) => store.find((p) => norm(p.title).includes(norm(l)) || norm(l).includes(norm(p.title))) || { title: text.clip(l, 80), price: 0, url: '', typed: true });
  const fallback = brand.product && brand.product.title ? [{ title: brand.product.title, price: Number(brand.product.price) || 0, url: brand.product.url || '' }] : [];
  // The product the pitch was about goes first.
  const first = brand.product && brand.product.title ? store.findIndex((p) => norm(p.title) === norm(brand.product.title)) : -1;
  if (first > 0) store.unshift(...store.splice(first, 1));
  const out = chosen.length ? chosen : store.length ? store : fallback;
  return out.length ? out : [{ title: 'Your product', price: 0, url: '', typed: true }];
}

module.exports = {
  name: 'ugc.brief',
  title: 'Write the creative brief',
  description: "A one-page creative brief for one brand: the package at your prices, a concept for every video built on their real products, hooks to test, the shots, the dates, what they get, what you need from them and the use in plain words. Hands the proposal and the quote the same numbers.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    required: ['lead'],
    properties: {
      lead: { type: 'object' },
      read: { type: ['object', 'null'], description: 'A shop.read_store output, or null when that step was skipped (no store link).' },
      package: { type: 'string', enum: ['test', 'starter', 'monthly'] },
      products: { type: 'string', maxLength: 600 },
      start: { type: 'string', maxLength: 10 },
      notes: { type: 'string', maxLength: 3000 },
      contact: { type: 'string', maxLength: 80 },
      email: { type: 'string', maxLength: 160 },
      myName: { type: 'string', maxLength: 60 },
      myContact: { type: 'string', maxLength: 160 },
      site: { type: 'string', maxLength: 300 },
      color: { type: 'string', maxLength: 7 },
    },
  },
  output: { type: 'object', required: ['brand', 'file', 'options', 'items'], properties: { brand: { type: 'string' }, file: { type: 'object' }, options: { type: 'array' }, items: { type: 'array' }, notes: { type: 'string' }, goals: { type: 'string' }, title: { type: 'string' } } },
  timeoutSec: 30,
  async run(input, ctx) {
    const lead = input.lead || {};
    const today = time.today(ctx);
    const brand = U.brandFor({ lead, read: input.read, category: lead.category, today });
    const name = text.plain(lead.name || brand.name || 'This brand');
    const s = close.shortName(name);
    const cat = U.catOf(brand.category);
    const br = brain.brainOf(ctx, {});
    const me = { name: text.plain(input.myName || br.firstName || br.name || ''), contact: text.oneLine(input.myContact || br.email || ''), site: talk.siteUrl(input.site || br.website || '') };
    const rows = await talk.pipelineRows(ctx);
    const clients = talk.wonCount(rows, 'ugc');
    const founding = clients < NICHE.first_clients.founding_count;
    const n = offer.offerNumbers({}, ctx);
    const said = `${input.notes || ''}\n${lead.reply || ''}`;
    const pick = input.package || (/\b(every|each|per) month\b|\bmonthly\b|\bongoing\b|\bretainer\b/i.test(said) ? 'monthly' : /\bads?\b|\bspark\b|\bhooks?\b|\bcreatives\b/i.test(said) ? 'starter' : 'test');
    const pkg = offer.pkgOf(n, pick);
    const foundingNow = founding && pkg.id === 'test';
    const price = foundingNow ? n.founding : pkg.price;
    const priceText = `${usd(price)}${pkg.per ? ` ${pkg.per}` : ''}${foundingNow ? ` (founding price, normally ${usd(n.video)})` : ''}`;

    const products = productsFor(input.products, brand, input.read);
    const concepts = Array.from({ length: pkg.videos }, (_, i) => conceptFor(i, products[i % products.length], cat, brand));
    const typedOnly = products.every((p) => p.typed);

    // Dates: the brief today, the product's arrival (typed, else a week out), the videos, the edit window.
    const arrive = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start || '')) ? input.start : time.addDays(today, 7);
    const due = time.addDays(arrive, n.turnaround);
    const timeline = [
      { when: time.longDate(today), what: 'This brief and the quote' },
      { when: 'When you say yes', what: 'Half up front books the date. I send my shipping address.' },
      { when: `${time.longDate(arrive)}${input.start ? '' : ' (if it ships this week)'}`, what: 'The product arrives. Filming starts.' },
      { when: time.longDate(due), what: pkg.id === 'monthly' ? 'The first 2 videos' : `The video${pkg.videos === 1 ? '' : 's'}, with captions and clean versions` },
      ...(pkg.id === 'monthly' ? [{ when: time.longDate(time.addDays(due, 14)), what: 'Videos 3 and 4, then the month-end report' }] : []),
      { when: time.longDate(time.addDays(pkg.id === 'monthly' ? time.addDays(due, 14) : due, 5)), what: 'Last day to ask for the round of edits' },
    ];
    const slug = text.slug(s, 24);
    const names = [];
    for (let i = 1; i <= Math.min(pkg.videos, 4); i++) names.push(`${slug}_video${i}_captions_9x16.mp4`, `${slug}_video${i}_clean_9x16.mp4`);
    if (pkg.id === 'starter') names.push(`${slug}_video1_hook2_9x16.mp4`);
    const deliverables = [
      ...pkg.includes,
      'Vertical 9:16, 1080 x 1920, in one shared folder link',
      pkg.id === 'starter' ? 'The ad use starts on the first day you spend on the ads' : 'Paid ad use can be added per video, for 30 or 90 days',
    ];
    const needs = [
      `The product${pkg.videos > 1 ? 's' : ''} to film, shipped once you say yes (two if one gets used up while filming)`,
      'Any claim you want said, with your proof behind it. Without one, the videos say only what your product page and the label say.',
      'Words, competitors or topics to avoid',
      'Who approves, and a yes or edits within 5 days of delivery',
      'Half up front to book the date',
    ];
    const usage = offer.usageFor(s, { whitelist: false, raw: false });
    const rules = [
      'I film the product in my hands and only say what I saw and felt using it.',
      `Claims about results come from ${s}, with your proof.`,
      'No promises of views or sales: you get the videos on time, one round of edits and a redo if a video misses this brief.',
      `If a video goes on my account too, it is labeled as an ad: "This is an ad for ${s}" in the video and "#ad Paid partnership with ${s}" in the caption.`,
    ];
    const filmed = [...new Set(concepts.map((c) => U.shortTitle(c.product.title)))];
    const title = `${pkg.videos} ${pkg.videos === 1 ? 'video' : 'videos'}${pkg.id === 'monthly' ? ' a month' : ''} ${filmed.length === 1 ? `for ${filmed[0]}` : `across ${filmed.length} products`}`;
    const to = text.oneLine(input.contact || '');
    const checked = brand.checked ? time.longDate(brand.checked) : time.longDate(today);
    const html = pages.briefHtml({ brand: s, title, member: me, to, date: time.longDate(today), checked: typedOnly ? 'from the names you typed' : checked, pkg, priceText, timeline, concepts, deliverables, names, needs, usage, rules, color: input.color });
    const file = await save.saveFile(ctx, save.fileName(s, `brief ${today}`, '.html'), html, 'text/html');

    // For sales.proposal and sales.quote: the same packages, the line items for the one picked.
    const goals = [`New ${pkg.videos === 1 ? 'video' : 'videos'} for ${filmed.length > 2 ? `${filmed.slice(0, -1).join(', ')} and ${filmed[filmed.length - 1]}` : filmed.join(' and ')}`, pkg.id === 'starter' ? 'Hooks to test in paid ads' : pkg.id === 'monthly' ? 'A steady stream of new videos every month' : 'A first video to try a new creator', 'The use in writing before filming'].join('\n');
    const notes = [
      `Brief sent ${time.longDate(today)}: ${concepts.map((c) => `${c.format} of ${U.shortTitle(c.product.title)}`).join('; ')}.`,
      brand.gaps && brand.gaps[0] ? `${brand.gaps[0].text} (read from their store${brand.checked ? ` on ${checked}` : ''}).` : '',
      text.plain(input.notes || ''),
      foundingNow ? `Founding terms: ${NICHE.first_clients.ask}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const items = offer.quoteItems(n, pkg.id, { founding: foundingNow });
    const terms = `Half up front books the date, half on delivery. Videos ${n.turnaround} days after the product arrives. One round of edits if asked within 5 days. Use: ${usage.slice(0, 2).map((t) => t.text).join(' ')} No promises of views or sales.`;
    // In talks: this pack's brand moves to Call booked (or is added there). The proposal and quote
    // steps run with pipeline: false, so HQ keeps one row for the brand.
    const email = text.oneLine(input.email || lead.email || '');
    const dom = brand.domain || talk.domainOf(lead.website);
    const p0 = products[0] && !products[0].typed ? products[0] : null;
    const line = await talk.moveLead(ctx, { ...lead, key: lead.key || (dom ? `site:${dom}` : `lead:${text.slug(name, 40)}`) }, {
      pack: 'ugc',
      stage: 'call',
      name,
      source: 'Brief',
      links: { ...(dom ? { website: `https://${dom}` } : {}), ...(/@/.test(email) ? { email } : {}) },
      data: { service: 'ugc', category: brand.category, ...(p0 ? { product: { title: p0.title, url: p0.url, price: p0.price } } : {}) },
    });
    ctx.log(`Brief for ${s}: ${pkg.name}, ${concepts.length} concept${concepts.length === 1 ? '' : 's'}`);
    return {
      brand: s,
      name,
      to,
      email,
      line,
      pkg: { id: pkg.id, name: pkg.name, videos: pkg.videos, price, priceText },
      founding: foundingNow,
      products,
      typedOnly,
      concepts,
      timeline,
      file,
      options: offer.proposalOptions(n, pkg.id, { founding }),
      optionsText: offer.optionsText(n, pkg.id, { founding }),
      price,
      items,
      goals,
      notes,
      title: `UGC videos for ${s}`,
      quoteTitle: `${pkg.videos === 1 ? 'One UGC video' : `${pkg.videos} UGC videos`}${pkg.id === 'monthly' ? ' a month' : ''} for ${s}`,
      terms: text.clip(terms, 1200),
      // What the proposal promises, the same as the brief: never views or sales.
      promise: 'The videos on time, one round of edits if you ask within 5 days of delivery, and a redo if a video misses this brief.',
      deposit: '50%',
      contact: [me.name, me.contact].filter(Boolean).join(', '),
      customer: { name: to || s, company: name, email },
    };
  },
  view(out) {
    return views.blocks(
      views.metric(out.pkg.name, out.pkg.priceText, `${out.concepts.length} ${out.concepts.length === 1 ? 'concept' : 'concepts'} for ${out.brand}`),
      views.cards(out.concepts.map((c) => ({ title: `Video ${c.n}: ${c.format}`, subtitle: `${U.shortTitle(c.product.title)}${c.product.price ? `, ${money.usd(c.product.price)}` : ''}`, body: `Hooks to try: ${c.hooks.join(' / ')}` }))),
      views.table([{ key: 'when', label: 'When' }, { key: 'what', label: 'What happens' }], out.timeline),
      out.typedOnly ? views.text("These products weren't found on their store, so the brief uses the names you typed without prices. Check them before you send it.") : null,
      views.file(out.file, 'The creative brief to send (print or save as PDF)'),
      out.line ? views.text(out.line) : null,
    );
  },
};
