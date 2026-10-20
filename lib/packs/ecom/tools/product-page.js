// Product page writer: one product's title, five bullets, description and photo alt text for Shopify,
// plus an Etsy title, 13 tags and description, every field cut to its limit in code (data/limits.json).
// Only the member's facts go in: no ratings, reviews, buyer counts, "best" or "#1" unless they typed it,
// and no promised results (Legal L76 D3, D4). AI writes when it can; the template uses their words.

const { views, save, text, ai } = require('../../_kit');
const U = require('../lib/util');
const S = require('../lib/store');

const { plain } = text;
const L = S.LIMITS;

const lines = (s, max = 12) => String(s || '').split(/\r?\n|;/).map((x) => plain(x).replace(/^\s*(?:[-*•]+|\d{1,2}[.)])\s+/, '').trim()).filter(Boolean).slice(0, max);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const sentence = (s) => {
  const t = plain(s).trim();
  return t ? cap(/[.!?]$/.test(t) ? t : `${t}.`) : '';
};

function tagsFrom(words, max = L.etsy.tags) {
  const out = [];
  const seen = new Set();
  for (const w of words) {
    const t = plain(w).toLowerCase().replace(/[^a-z0-9 &'-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length < 3 || t.length > L.etsy.tag_chars || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

// Whole sentences only, while they fit.
function upTo(parts, max) {
  let out = '';
  for (const p of parts.filter(Boolean)) {
    const next = out ? `${out} ${p}` : p;
    if (next.length > max) break;
    out = next;
  }
  return out || U.fit(parts.filter(Boolean)[0] || '', max);
}

// "Candle on a white background" for "Lavender soy candle" -> "Lavender soy candle on a white background".
function altFor(product, photo) {
  const last = product.toLowerCase().split(/\s+/).pop();
  const words = photo.replace(/^(a |an |the )/i, '').split(/\s+/);
  if (words[0] && words[0].toLowerCase().replace(/s$/, '') === last.replace(/s$/, '')) return `${product} ${words.slice(1).join(' ')}`;
  return `${product}, ${photo.charAt(0).toLowerCase()}${photo.slice(1)}`;
}

const SHOTS = ['on a plain light background, front view', 'in use, in a real room', 'close-up of the texture and finish', 'next to a hand for size', 'in its packaging'];

function template(f) {
  const short = f.details.slice(0, 2).map((d) => d.split(/[,(]/)[0].trim()).filter((d) => d.length <= 28);
  const title = U.fit([f.product, ...short].join(', '), L.shopify.title);
  const meta = upTo([sentence(f.what), f.for_who ? sentence(`Made for ${f.for_who}`) : '', f.details[0] ? sentence(f.details[0]) : ''], L.shopify.meta);
  const bullets = (f.details.length ? f.details : [f.what]).slice(0, L.bullets.count).map((d) => U.fit(cap(d), L.bullets.max));
  const description = [
    `${sentence(f.what)}${f.for_who ? ` ${sentence(`Made for ${f.for_who}`)}` : ''}`,
    f.details.length ? f.details.map((d) => sentence(d)).join(' ') : '',
    f.care ? sentence(f.care) : '',
  ].filter(Boolean).join('\n\n');
  const photos = f.photos.length ? f.photos : SHOTS.slice(0, 4);
  const alts = photos.map((p) => U.fit(altFor(f.product, p), L.alt.max));
  const etsy_title = U.fit([f.product, ...f.keywords.slice(0, 3), ...short].join(', '), L.etsy.title);
  const pw = f.product.toLowerCase().split(/\s+/);
  const tags = tagsFrom([...f.keywords, f.product, pw.slice(-2).join(' '), ...short, ...f.details.map((d) => d.split(/[,(]/)[0]), pw.slice(-1)[0]]);
  const etsy_description = [sentence(f.what), bullets.map((b) => `- ${b}`).join('\n'), f.care ? sentence(f.care) : ''].filter(Boolean).join('\n\n');
  return { title, meta, bullets, description, alts, etsy_title, tags, etsy_description };
}

// Every field to its limit, every claim the member didn't type taken out.
function enforce(d, f, typed) {
  const sc = (s) => U.scrub(plain(s), typed);
  const out = {
    title: U.fit(sc(d.title) || f.product, L.shopify.title),
    meta: U.fit(sc(d.meta), L.shopify.meta),
    bullets: (d.bullets || []).map((b) => U.fit(sc(b), L.bullets.max)).filter(Boolean).slice(0, L.bullets.count),
    description: sc(d.description),
    alts: (d.alts || []).map((a) => U.fit(sc(a), L.alt.max)).filter(Boolean).slice(0, 12),
    etsy_title: U.fit(sc(d.etsy_title) || f.product, L.etsy.title),
    tags: tagsFrom((d.tags || []).map(sc)),
    etsy_description: sc(d.etsy_description),
  };
  return out;
}

const SCHEMA = {
  type: 'object',
  required: ['title', 'meta', 'bullets', 'description', 'alts', 'etsy_title', 'tags', 'etsy_description'],
  properties: {
    title: { type: 'string' },
    meta: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' } },
    description: { type: 'string' },
    alts: { type: 'array', items: { type: 'string' } },
    etsy_title: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    etsy_description: { type: 'string' },
  },
};

function sheet(f, d, counts) {
  const e = U.esc;
  const block = (label, value, n, max) => `<div class="card"><h3>${e(label)} <span class="tag">${n} of ${max}</span></h3><p>${e(value).replace(/\n/g, '<br>')}</p></div>`;
  const body = `<div class="band"><h1>${e(f.product)}</h1><p>Product page copy for Shopify and Etsy. Read it once out loud and change anything that isn't true or isn't how you talk.</p></div>
<h2>Shopify</h2>
${block('Title (also the search title)', d.title, d.title.length, L.shopify.title)}
${block('Search description', d.meta, d.meta.length, L.shopify.meta)}
<div class="card"><h3>Bullets</h3><ul>${U.li(d.bullets)}</ul></div>
<div class="card"><h3>Description</h3><p>${e(d.description).replace(/\n/g, '<br>')}</p></div>
<div class="card"><h3>Photo alt text, in photo order</h3><ol>${U.li(d.alts)}</ol></div>
<h2>Etsy</h2>
${block('Title', d.etsy_title, d.etsy_title.length, L.etsy.title)}
<div class="card"><h3>Tags <span class="tag">${d.tags.length} of ${L.etsy.tags}</span></h3><p>${d.tags.map((t) => `<span class="tag">${e(t)}</span>`).join('')}</p></div>
<div class="card"><h3>Description</h3><p>${e(d.etsy_description).replace(/\n/g, '<br>')}</p></div>
<h2>Counted against</h2><div class="wrap"><table><tr><th>Field</th><th class="n">Used</th><th class="n">Limit</th><th>Where the limit comes from</th></tr>${counts.map((c) => `<tr><td>${e(c.field)}</td><td class="n">${c.used}</td><td class="n">${c.max}</td><td class="small">${e(c.from)}</td></tr>`).join('')}</table></div>
<p class="small muted">Limits checked ${e(L.checked)}: ${L.shopify.sources.map((s) => `<a href="${e(s.url)}">${e(s.url)}</a>`).join(', ')}; ${L.etsy.sources.map((s) => `<a href="${e(s.url)}">${e(s.url)}</a>`).join(', ')}.</p>`;
  return U.page({ title: `${f.product}: product page`, seed: f.color, body });
}

module.exports = {
  name: 'ecom.write_product_page',
  title: 'Write a product page',
  description: "A product title, five bullets, a description and photo alt text for Shopify, plus an Etsy title, 13 tags and description, each counted to the platform's limit, from your own facts only.",
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  timeoutSec: 120,
  input: {
    type: 'object',
    required: ['product'],
    properties: {
      product: { type: 'string', maxLength: 80, title: 'Product name', description: 'Like "Lavender soy candle"' },
      what: { type: 'string', maxLength: 240, title: 'What it is, in one sentence' },
      details: { type: 'string', format: 'textarea', maxLength: 1500, title: 'Facts, one per line', description: 'Size, materials, scent or color, how it is made, what is in the box. Only true facts: they go on the page.' },
      for_who: { type: 'string', maxLength: 80, title: 'Who it is for (optional)', description: 'Like "people who like a quiet evening at home"' },
      care: { type: 'string', maxLength: 300, title: 'Care or use note (optional)' },
      keywords: { type: 'string', maxLength: 300, title: 'Words shoppers search (optional)', description: 'Comma separated, like "soy candle, lavender candle, gift for her"' },
      photos: { type: 'string', format: 'textarea', maxLength: 1200, title: 'Your photos, one per line (optional)', description: 'What each photo shows, in order, for the alt text' },
      color: { type: 'string', maxLength: 7, title: 'Brand color (optional)', description: 'A hex color like #7a4b2a' },
    },
  },
  output: {
    type: 'object',
    required: ['product', 'shopify', 'etsy', 'counts'],
    properties: { product: { type: 'string' }, shopify: { type: 'object' }, etsy: { type: 'object' }, counts: { type: 'array' }, file: { type: 'object' }, ai: { type: 'boolean' } },
  },
  async run(input, ctx) {
    const f = {
      product: plain(input.product).slice(0, 80),
      what: plain(input.what || `${input.product}, made by hand`),
      details: lines(input.details),
      for_who: plain(input.for_who || ''),
      care: plain(input.care || ''),
      keywords: String(input.keywords || '').split(',').map((k) => plain(k)).filter(Boolean).slice(0, 20),
      photos: lines(input.photos),
      color: input.color,
    };
    const typed = U.typedOf(input, ctx);
    const base = template(f);
    const r = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write product pages for a small online shop. Use only the facts given. Never write ratings, reviews, testimonials, buyer counts, "best", "#1", percentages or promised results unless the facts say so word for word. No health or body claims.',
      prompt: `Product: ${f.product}\nWhat it is: ${f.what}\nFacts:\n${f.details.join('\n') || '(none)'}\nFor: ${f.for_who || '(not given)'}\nCare: ${f.care || '(not given)'}\nSearch words: ${f.keywords.join(', ') || '(none)'}\nPhotos in order:\n${(f.photos.length ? f.photos : SHOTS.slice(0, 4)).join('\n')}\n\nWrite: title (Shopify, at most ${L.shopify.title} characters), meta (search description, at most ${L.shopify.meta}), 5 bullets (at most ${L.bullets.max} each), description (2 or 3 short paragraphs), alts (one per photo, at most ${L.alt.max} each), etsy_title (at most ${L.etsy.title}, search words first), 13 tags (each at most ${L.etsy.tag_chars} characters), etsy_description.`,
      schema: SCHEMA,
      maxTokens: 1600,
      accept: U.acceptOf(typed),
      fallback: () => base,
    });
    const d = enforce(r.data, f, typed);
    if (!d.bullets.length) d.bullets = base.bullets;
    if (!d.alts.length) d.alts = base.alts;
    if (d.tags.length < 5) d.tags = tagsFrom([...d.tags, ...base.tags]);
    if (!d.description) d.description = base.description;
    if (!d.etsy_description) d.etsy_description = base.etsy_description;
    const sh = L.shopify.sources[0].url;
    const et = L.etsy.sources;
    const counts = [
      { field: 'Shopify title', used: d.title.length, max: L.shopify.title, from: sh },
      { field: 'Shopify search description', used: d.meta.length, max: L.shopify.meta, from: `${sh} (recommended length)` },
      { field: 'Longest bullet', used: Math.max(0, ...d.bullets.map((b) => b.length)), max: L.bullets.max, from: L.bullets.why },
      { field: 'Longest alt text', used: Math.max(0, ...d.alts.map((a) => a.length)), max: L.alt.max, from: L.alt.why },
      { field: 'Etsy title', used: d.etsy_title.length, max: L.etsy.title, from: et[0].url },
      { field: 'Etsy tags', used: d.tags.length, max: L.etsy.tags, from: et[1].url },
      { field: 'Longest Etsy tag', used: Math.max(0, ...d.tags.map((t) => t.length)), max: L.etsy.tag_chars, from: et[1].url },
    ];
    const file = await save.saveFile(ctx, save.fileName(f.product, 'product page', '.html'), sheet(f, d, counts));
    return {
      product: f.product,
      shopify: { title: d.title, meta: d.meta, bullets: d.bullets, description: d.description, alts: d.alts },
      etsy: { title: d.etsy_title, tags: d.tags, description: d.etsy_description },
      counts,
      file,
      ai: r.ai,
      ...(r.ai ? {} : { sample: true }),
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Product page', out.product, `Shopify title ${out.shopify.title.length} of ${L.shopify.title} characters, Etsy title ${out.etsy.title.length} of ${L.etsy.title}, ${out.etsy.tags.length} tags`),
      views.copy('Shopify title', out.shopify.title),
      views.copy('Shopify search description', out.shopify.meta),
      views.copy('Bullets', out.shopify.bullets.join('\n')),
      views.copy('Description', out.shopify.description),
      views.copy('Photo alt text, in order', out.shopify.alts.join('\n')),
      views.copy('Etsy title', out.etsy.title),
      views.copy('Etsy tags (paste one at a time)', out.etsy.tags.join(', ')),
      views.copy('Etsy description', out.etsy.description),
      views.table([{ key: 'field', label: 'Field' }, { key: 'used', label: 'Used', format: 'number' }, { key: 'max', label: 'Limit', format: 'number' }], out.counts),
      views.text('Only your facts are on the page: no ratings, reviews, buyer counts or "best" unless you typed them. Read it once and fix anything that is not true.'),
      views.file(out.file, 'Product page copy (HTML)'),
    );
  },
};

