// A mock of one real product page with the audit's fixes applied: the store's own photos, title,
// price, options and words, laid out the better way, with numbered notes. Static HTML (no scripts),
// so it opens anywhere and prints. Nothing is invented: missing facts show as notes to fill in,
// and the reviews block is an empty "Reviews coming soon" state.

const { text, money, save, views, brain } = require('../../_kit');
const H = require('../lib/html');
const art = require('../lib/art');
const { readProduct, sized } = require('../lib/store');
const report = require('../lib/report');

const esc = H.esc;
const img = (src, w, t) => (art.isSampleArt(src) ? art.resolveImage(src, { palette: t, size: w }) : sized(src, w) || src);

function sentences(t) {
  return String(t || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[a-z]{3}[.!?]|\d[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

const CSS = `
.mock{background:#fff;border:1px solid var(--line);border-radius:22px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(0,0,0,.25)}
.bar{display:flex;gap:6px;padding:12px 16px;background:#f1f1f1;border-bottom:1px solid var(--line)}
.bar i{width:11px;height:11px;border-radius:50%;background:#d6d6d6;display:block}
.bar span{margin-left:12px;font-size:12px;color:var(--muted)}
.ship{background:var(--p);color:#fff;text-align:center;font-size:13px;font-weight:600;padding:9px 12px}
.nav{display:flex;justify-content:space-between;align-items:center;padding:16px 26px;border-bottom:1px solid var(--line);font-weight:800;letter-spacing:-.01em}
.nav small{font-weight:500;color:var(--muted);font-size:13px}
.pdp{display:grid;grid-template-columns:1.1fr 1fr;gap:34px;padding:30px 26px}
.main{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:16px;background:#f4f1ec;display:block}
.thumbs{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}
.thumbs img,.thumbs .need{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;display:block}
.need{border:2px dashed var(--p);color:var(--p);font-size:11px;font-weight:700;display:flex!important;align-items:center;justify-content:center;text-align:center;padding:4px;box-sizing:border-box;background:#fbfaf7}
.vendor{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0}
.ptitle{font-size:30px;line-height:1.1;margin:6px 0 10px;letter-spacing:-.02em}
.price{font-size:22px;font-weight:700;margin:0 0 16px}.price s{color:var(--muted);font-weight:500;font-size:16px;margin-left:8px}
.opts{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}.opts span{border:1px solid var(--ink);border-radius:999px;padding:6px 14px;font-size:13px}
.opts span:first-child{background:var(--ink);color:#fff}
.cart{display:block;text-align:center;background:var(--ink);color:#fff;border-radius:12px;padding:15px;font-weight:700;margin:0 0 14px}
.trust{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 18px;font-size:13px}
.trust div{background:#f6f4f0;border-radius:10px;padding:10px 12px}
.lead{font-size:17px;font-weight:600;margin:0 0 10px}
.ben{margin:0 0 14px;padding-left:18px}.ben li{margin:4px 0}
.fill{border:2px dashed #e0b44a;background:#fff8e6;color:#6b4e00;border-radius:10px;padding:10px 12px;font-size:13px;margin:0 0 12px}
details{border-top:1px solid var(--line);padding:12px 0}details summary{font-weight:700;cursor:pointer}
details p{margin:8px 0 0;color:var(--muted);font-size:14px}
.rev{margin:0 26px 26px;padding:22px;border-radius:16px;background:#f6f4f0;text-align:center}
.rev b{display:block;font-size:18px;margin-bottom:4px}
.pairs{padding:0 26px 30px}.pairs h3{margin:0 0 12px}
.pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.pgrid img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:12px;display:block}
.pgrid p{margin:6px 0 0;font-size:13px}
.pin{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#e2552d;color:#fff;font-size:12px;font-weight:800;margin-right:6px;vertical-align:middle;flex:none}
.notes{display:grid;gap:10px;margin:0;padding:0;list-style:none}
.notes li{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.before{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.before div{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;font-size:14px}.before b{display:block;font-size:22px}
@media(max-width:760px){.pdp{grid-template-columns:1fr}.pgrid{grid-template-columns:1fr 1fr}.trust{grid-template-columns:1fr}}
`;

function mockHtml(p, product, { by, now }) {
  const t = H.theme(report.seedColor({ home: { colors: p.store.colors } }));
  const notes = [];
  const pin = (msg) => {
    notes.push(msg);
    return `<span class="pin">${notes.length}</span>`;
  };
  const f = p.facts || {};
  const imgs = (product.imageList || []).map((i) => i.src).filter(Boolean);
  const main = imgs[0] || product.image;
  const extra = imgs.slice(1, 5);
  const need = ['In use', 'For scale', 'Close-up', 'Packaging'].slice(0, Math.max(0, 4 - extra.length));
  const sents = sentences(product.text);
  const lead = sents[0] || '';
  const bullets = sents.slice(1, 4);
  const firstOpt = (product.optionValues || [])[0];
  const opts = (firstOpt && typeof firstOpt === 'object' ? firstOpt.values || [] : product.optionValues || [])
    .map(String)
    .filter((o) => o && o !== 'Default Title')
    .slice(0, 6);
  const shipText = f.freeShipping || null;
  const pages = f.pages || {};
  const link = (k, label) => (pages[k] ? `<a href="${esc(pages[k])}">${esc(label)}</a>` : `${esc(label)}`);
  const gallery = `<div>${main ? `<img class="main" src="${esc(img(main, 900, t))}" alt="${esc(product.title)}">` : '<div class="main need">Main photo</div>'}
<div class="thumbs">${[main, ...extra].filter(Boolean).slice(0, 5 - need.length).map((s) => `<img src="${esc(img(s, 200, t))}" alt="">`).join('')}${need.map((n) => `<div class="need">Add: ${esc(n)}</div>`).join('')}</div>
${need.length ? `<p style="margin:10px 0 0;font-size:13px">${pin(`Photos: ${need.length ? `add ${text.list(need.map((n) => n.toLowerCase()))} shots` : 'keep the set'} so buyers see size, texture and what arrives.`)} ${text.plural(need.length, 'photo')} to add</p>` : ''}</div>`;
  const info = `<div>
<p class="vendor">${esc(product.vendor || p.store.name)}</p>
<h1 class="ptitle">${esc(product.title)}</h1>
<p class="price">${product.price != null ? money.usd(product.price) : ''}${product.compareAt && product.compareAt > product.price ? `<s>${money.usd(product.compareAt)}</s>` : ''}</p>
${opts.length ? `<div class="opts">${opts.map((o) => `<span>${esc(o)}</span>`).join('')}</div>` : ''}
<span class="cart">Add to cart</span>
<div class="trust"><div>${shipText ? esc(shipText) : `${pin('Say your shipping terms next to the button: a free shipping threshold or how fast it ships.')}Your shipping promise here`}</div><div>${pages.returns ? link('returns', 'Returns: see the policy') : `${pin('Link a returns policy here; buyers look for it before they pay.')}Returns policy link`}</div></div>
${lead ? `<p class="lead">${pin('Open with the one reason to buy, in the first line.')}${esc(lead)}</p>` : ''}
${bullets.length ? `<ul class="ben">${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
<div class="fill">${pin('Add the facts buyers ask about: size, materials, how to use it, care. Short lines beat a paragraph.')}Add here: size, materials, how to use it, care.</div>
<details open><summary>Shipping</summary><p>${shipText ? esc(shipText) : 'Say when it ships and what it costs.'} ${pages.shipping ? `<a href="${esc(pages.shipping)}">Shipping policy</a>` : ''}</p></details>
<details><summary>Returns</summary><p>${pages.returns ? `<a href="${esc(pages.returns)}">Returns policy</a>` : 'Say how returns work, in one line.'}</p></details>
<details><summary>${pages.faq ? '' : pin('Answer the top three questions on the page itself (FAQ).')}Questions</summary><p>${pages.faq ? `<a href="${esc(pages.faq)}">FAQ</a>` : 'Your top three questions and answers.'}</p></details>
</div>`;
  const reviews = f.reviewsApp
    ? ''
    : `<div class="rev">${pin('Reviews: install a reviews app and ask past buyers for an honest review. Never write or buy reviews.')}<b>Reviews coming soon</b>Collected from real buyers after their order arrives.</div>`;
  const pairs = (p.related || []).length
    ? `<div class="pairs"><h3>${f.reviewsApp ? '' : ''}${pin('Suggest one add-on that pairs with this product.')}Pairs well with</h3><div class="pgrid">${p.related.map((r) => `<div><img src="${esc(img(r.image, 400, t))}" alt="${esc(r.title)}"><p><b>${esc(r.title)}</b><br>${r.price != null ? money.usd(r.price) : ''}</p></div>`).join('')}</div></div>`
    : '';
  const mock = `<div class="mock"><div class="bar"><i></i><i></i><i></i><span>${esc(product.url || p.store.url || '')}</span></div>
<div class="ship">${shipText ? esc(shipText) : 'Your shipping terms here, like free shipping over a set amount'}</div>
<div class="nav">${esc(p.store.name)}<small>Shop &nbsp; About &nbsp; Contact</small></div>
<div class="pdp">${gallery}${info}</div>${reviews}${pairs}</div>`;
  const before = `<div class="before">
<div><b>${(product.imageList || []).length || (product.images || 0)}</b>photos now</div>
<div><b>${money.int(product.words || 0)}</b>words in the description</div>
<div><b>${f.reviewsApp ? 'Yes' : 'None seen'}</b>reviews on the page</div>
<div><b>${shipText ? 'Yes' : 'None seen'}</b>shipping promise</div>
</div>`;
  const body = [
    H.hero({ eyebrow: `Mock up${p.sample ? ' (sample data)' : ''}`, heading: `${product.title}, improved`, lead: `How this ${p.store.name} product page could look with the audit's fixes. Built from the store's own public page; not live.`, meta: [{ value: p.store.domain || '', label: '' }, { value: report.dateLabel(now), label: 'made on' }] }),
    H.block({ kicker: 'Today', title: 'What the page has now', body: before }),
    H.block({ kicker: 'The mock', title: 'The same product, laid out to sell', sub: 'Numbered notes match the list below. Dashed boxes are things to add.', body: mock }),
    H.block({ kicker: 'What changed', title: 'The notes', body: `<ol class="notes">${notes.map((n, i) => `<li><span class="pin">${i + 1}</span><span>${esc(n)}</span></li>`).join('')}</ol>` }),
  ].join('\n');
  return { html: H.page({ title: `${product.title}: page mock up`, description: `Mock up of a product page for ${p.store.domain}`, theme: t, body: `<style>${report.EXTRA_CSS}${CSS}</style>${body}`, footer: `Made from public pages on ${report.dateLabel(now)}${by ? ` by ${by}` : ''}. Photos, words and prices are the store's own; nothing here is live.` }), notes };
}

module.exports = {
  name: 'shop.mock_page',
  title: 'Mock an improved page',
  description: "Builds a mock of one real product page with the audit's fixes applied (more photos, a clear opening line, shipping and returns next to the button, FAQ, an honest empty reviews block, an add-on) from the store's public data, with numbered notes.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: { pitch: { type: 'object', description: 'The pitch object from shop.audit.' }, product: { type: 'string', maxLength: 300, description: 'A product page address (optional).' } },
    required: ['pitch'],
  },
  output: { type: 'object', properties: { ok: { type: 'boolean' }, page: { type: 'object' }, product: { type: 'object' }, notes: { type: 'array' }, sample: { type: 'boolean' } }, required: ['ok'] },

  async run(input, ctx) {
    const p = input.pitch || {};
    if (!p.store || !p.target) return { ok: false, reason: 'No product to mock: the audit found no products on this store.', notes: [], sample: !!p.sample };
    const handle = (input.product && (String(input.product).match(/\/products\/([^/?#]+)/) || [])[1]) || p.target.handle;
    let product = null;
    try {
      product = await readProduct(ctx, p.store.url || p.store.origin, handle);
    } catch (e) {
      ctx.log("Couldn't re-read the product page; using the audit's copy.");
    }
    if (!product) product = { ...p.target, imageList: p.target.imageList || [], optionValues: p.target.options || [] };
    const by = brain.brainOf(ctx, {}).name || '';
    const { html, notes } = mockHtml(p, product, { by, now: ctx.now() });
    const page = await save.saveFile(ctx, save.fileName(p.store.name || p.store.domain || 'store', text.clip(product.title, 30), 'mock up', '.html'), html, 'text/html');
    ctx.log(`Mocked ${product.title} with ${text.plural(notes.length, 'note')}.`);
    return { ok: true, page, product: { title: product.title, url: product.url, price: product.price }, notes, sample: !!(p.sample || product.sample) };
  },

  view(out) {
    if (!out.ok) return views.blocks(views.text(out.reason || 'Nothing to mock.'));
    return views.blocks(views.sampleNote(out, 'This mock up'), views.metric('Changes shown', out.notes.length, out.product.title), views.file(out.page, 'Mock up page (open in a browser, or print to PDF and attach)'));
  },
};
