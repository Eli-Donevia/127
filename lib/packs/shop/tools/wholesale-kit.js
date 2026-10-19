// shop.wholesale_kit: everything to ask local shops to stock you. A one-page wholesale line sheet in
// your colors (keystone prices from your own retail prices unless you set another share, and only the
// terms you typed), and for each shop you picked: an email, an Instagram DM, a walk-in line and two
// follow-ups, saved to your Pipeline with the facts behind each message (D29) and in one sheet.
// Email follow-ups end like the first email (D28). Nothing is sent for you.

const { text, money, files, save, views, brain, time, places, color } = require('../../_kit');
const H = require('../lib/html');
const S = require('../lib/stockists');
const { brandColors, parseProductLines, sentence } = require('../lib/brand');

function termLines(s) {
  return String(s || '')
    .split(/\r?\n/)
    .map((l) => text.oneLine(l).replace(/^[-*•]\s*/, ''))
    .filter(Boolean)
    .slice(0, 10)
    .map((l) => sentence(l.replace(/^([a-z])/, (c) => c.toUpperCase())));
}

function lineSheetHtml({ br, items, terms, missing, contact, colors, today, share }) {
  const t = H.theme(colors.primary);
  const deep = color.ensureContrast(color.mix(t.primary, '#000000', 0.25), '#ffffff', 7);
  const month = time.longDate(today).replace(/ \d+, /, ' ');
  const links = [br.place, br.website ? br.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '', br.instagram ? `@${br.instagram}` : '', contact].filter(Boolean);
  const css = `
:root{--p:${t.primary};--deep:${deep};--ink:${t.ink};--muted:${t.muted};--line:${t.line};--soft:${t.soft};--soft-t:${t.softText};--paper:${t.paper}}
*{box-sizing:border-box}
body{margin:0;background:#e9e9e6;color:var(--ink);font:400 15px/1.5 ${H.FONT};-webkit-font-smoothing:antialiased}
.sheet{max-width:860px;margin:32px auto;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08),0 12px 40px rgba(0,0,0,.08)}
.top{background:var(--deep);color:#fff;padding:40px 48px 34px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end}
.top h1{font-size:40px;line-height:1.05;letter-spacing:-.03em;font-weight:800;margin:0 0 8px}
.top .what{margin:0;font-size:16px;opacity:.86;max-width:44ch}
.top .tag{text-align:right;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.9}
.top .tag b{display:block;font-size:22px;letter-spacing:-.01em;text-transform:none;margin-top:4px}
.links{padding:14px 48px;border-bottom:1px solid var(--line);font-size:13.5px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 22px}
.body{padding:28px 48px 36px}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:0 10px 10px 0;border-bottom:2px solid var(--ink)}
td{padding:14px 10px 14px 0;border-bottom:1px solid var(--line);vertical-align:top}
td.n{font-weight:700;font-size:16px}
td.n span{display:block;font-weight:400;font-size:13.5px;color:var(--muted);margin-top:2px}
td.num,th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
td.w{font-weight:800;font-size:17px;color:var(--deep)}
.grid{display:grid;grid-template-columns:1.2fr 1fr;gap:28px;margin-top:28px}
.box{border:1px solid var(--line);border-radius:14px;padding:18px 20px}
.box h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 10px;color:var(--p)}
.box ul{margin:0;padding-left:18px}
.box li{margin:0 0 6px}
.box p{margin:0 0 8px}
.small{font-size:12.5px;color:var(--muted)}
.screen{max-width:860px;margin:0 auto 40px;padding:24px 28px;background:#fff;border-radius:16px}
.screen h2{font-size:20px;margin:0 0 10px}
.screen ol{margin:0 0 12px;padding-left:20px}
.screen li{margin:0 0 6px}
.screen .note{background:var(--soft);color:var(--soft-t);border-radius:12px;padding:12px 14px;font-size:14px}
@media (max-width:700px){.top,.links,.body{padding-left:20px;padding-right:20px}.top{grid-template-columns:1fr}.top .tag{text-align:left}.grid{grid-template-columns:1fr}.sheet{margin:0}}
@page{size:Letter;margin:10mm}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:#fff}.sheet{box-shadow:none;margin:0;max-width:none}.screen{display:none}tr{break-inside:avoid}}`;
  const rows = items
    .map((i) => `<tr><td class="n">${H.esc(i.name)}${i.note ? `<span>${H.esc(i.note)}</span>` : ''}</td><td class="num w">${i.wholesale != null ? H.esc(money.usd(i.wholesale, { cents: i.wholesale % 1 !== 0 })) : 'Ask'}</td><td class="num">${i.retail != null ? H.esc(money.usd(i.retail)) : ''}</td></tr>`)
    .join('');
  const sheet = `<div class="sheet">
<header class="top"><div><h1>${H.esc(br.name || 'Your business')}</h1>${br.what ? `<p class="what">${H.esc(br.what)}</p>` : ''}</div><div class="tag">Wholesale line sheet<b>${H.esc(month)}</b></div></header>
${links.length ? `<div class="links">${links.map((l) => `<span>${H.esc(l)}</span>`).join('')}</div>` : ''}
<div class="body">
<table><thead><tr><th>Product</th><th class="num">Wholesale</th><th class="num">Suggested retail</th></tr></thead><tbody>${rows}</tbody></table>
<div class="grid">
<div class="box"><h2>Terms</h2>${terms.length ? `<ul>${terms.map((l) => `<li>${H.esc(l)}</li>`).join('')}</ul>` : '<p>Ask me about minimums, payment and shipping.</p>'}<p class="small">Prices in US dollars. Suggested retail is a guide: you set your own prices.</p></div>
<div class="box"><h2>To order</h2><p>${H.esc(contact ? `${/@/.test(contact) ? 'Email' : /\d{3}/.test(contact) ? 'Call or text' : 'Contact'} ${br.firstName || 'me'}: ${contact.replace(/\.$/, '')}.` : `Reply to the email this came with, or ask ${br.firstName || 'me'} in person.`)}</p><p class="small">Samples on request for shops near ${H.esc(br.city || 'me')}.</p></div>
</div>
</div></div>`;
  const screen = `<div class="screen">
<h2>Before you send it</h2>
<ol>
<li>Check every price and name above. Wholesale here is ${Math.round(share * 100)}% of your retail price. ${H.esc(S.WS.keystone)}</li>
<li>Save it as a PDF to attach: Print, then Save as PDF. This box doesn't print.</li>
${missing.length ? `<li>Decide these before a shop asks: ${H.esc(text.list(missing.map((m) => m.replace(/\s*\(.*\)$/, '').toLowerCase())))}. Add them to your terms and run it again.</li>` : ''}
${contact ? '' : '<li>Add an email or phone for orders so shops can reach you from the printed page.</li>'}
</ol>
<p class="note">${H.esc(S.WS.keystoneNote)}</p>
</div>`;
  return files.htmlDoc({
    title: `${br.name || 'Wholesale'} line sheet`,
    description: `Wholesale prices for ${br.name || 'your products'}.`,
    css,
    body: `${sheet}\n${screen}`,
  });
}

module.exports = {
  name: 'shop.wholesale_kit',
  title: 'Make a wholesale kit',
  description: 'Makes a one-page wholesale line sheet in your colors from your own prices (keystone by default) and terms, and for each shop you picked an email, DM, walk-in line and two follow-ups from public facts about that shop, saved to your Pipeline and in one sheet.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      shops: { type: 'array', description: 'Shops from shop.find_stockists.' },
      products: { type: 'string', format: 'textarea', maxLength: 8000, description: 'Name | retail price | note, one per line.' },
      share: { type: 'number', minimum: 0.3, maximum: 0.8, default: 0.5, description: 'Wholesale as a share of retail. 0.5 is keystone.' },
      terms: { type: 'string', format: 'textarea', maxLength: 1500 },
      contact: { type: 'string', maxLength: 120 },
      address: { type: 'string', maxLength: 200 },
      color: { type: 'string', maxLength: 7 },
    },
    required: ['shops', 'products'],
  },
  output: {
    type: 'object',
    properties: {
      items: { type: 'array' },
      shops: { type: 'array' },
      saved: { type: 'integer' },
      lineSheet: { type: 'object' },
      sheet: { type: ['object', 'null'] },
      missing: { type: 'array' },
      route: { type: ['string', 'null'] },
      sample: { type: 'boolean' },
    },
    required: ['items', 'shops', 'lineSheet'],
  },

  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const products = parseProductLines(input.products, { max: 40 });
    if (!products.length) throw new Error('Add at least one product, like "Lavender candle | 32".');
    const share = Number(input.share) > 0 ? Number(input.share) : S.WS.defaultWholesaleShare;
    const items = S.lineItems(products, share);
    const terms = termLines(input.terms);
    const missing = S.missingTerms(input.terms);
    const contact = text.oneLine(input.contact || '');
    const colors = brandColors(ctx, input);
    const today = time.today(ctx);
    const base = text.slug(br.name || 'my', 40) || 'my';
    const lineSheet = await save.saveFile(ctx, `${base}-wholesale-line-sheet.html`, lineSheetHtml({ br, items, terms, missing, contact, colors, today, share }), 'text/html');

    const cat = S.categoryOf(input.products, br.what, br.niche);
    const me = { first: br.firstName, business: br.name, what: br.what, city: br.city, address: text.oneLine(input.address || br.address || ''), minimum: terms.find((l) => /minimum|opening order|first order/i.test(l)) || '' };
    const chosen = (Array.isArray(input.shops) ? input.shops : []).filter((s) => s && s.name).slice(0, 25);
    const followOn = (d) => time.addDays(today, d);
    const shops = chosen.map((s, i) => {
      const m = S.messagesFor(s, cat, me, items);
      const channel = s.channel || S.channelOf(s);
      return { rank: i + 1, s, m, channel };
    });
    let saved = 0;
    for (const { s, m, channel } of shops) {
      const byEmail = channel === 'email' || channel === 'site';
      const links = {};
      if (s.website) links.website = s.website;
      if (s.email) links.email = s.email;
      if (s.instagram) links.instagram = `https://www.instagram.com/${String(s.instagram).replace(/^@/, '')}/`;
      if (s.phone) links.phone = s.phone;
      if (s.osmUrl) links.maps = s.osmUrl;
      try {
        await ctx.leads.upsert({
          key: s.key || `stockist:${text.slug(s.name, 50)}`,
          name: s.name,
          company: s.name,
          source: `Stockist finder${s.sample ? ' (sample)' : ''}`,
          stage: 'found',
          links,
          note: text.clip((s.facts || []).join(' '), 1000),
          score: Math.max(0, Math.min(100, Math.round(s.score || 0))),
          ...(channel ? { channel } : {}),
          facts: (s.facts || []).slice(0, 5).map((f) => text.clip(f, 160)),
          msg: { dm: m.dm, subject: m.subject, email: m.email, walkin: m.walkin, follow1: byEmail ? m.follow1Email : m.follow1, follow2: byEmail ? m.follow2Email : m.follow2 },
          data: { kind: s.kind || null, miles: s.miles != null ? s.miles : null, address: s.address || null, category: cat.id, source: s.source || null, sample: !!s.sample },
        });
        saved++;
      } catch (e) {
        ctx.log(`Couldn't save ${s.name} to your Pipeline: ${e.message}`);
      }
    }
    // One sheet with every shop and message; OpenStreetMap's credit is the last row (D27).
    const rows = shops.map(({ rank, s, m, channel }) => ({
      rank,
      name: s.name,
      kind: s.kindLabel || '',
      miles: s.miles != null ? s.miles : '',
      address: s.address || '',
      website: s.website || '',
      email: s.email || '',
      instagram: s.instagram ? `@${String(s.instagram).replace(/^@/, '')}` : '',
      phone: s.phone || '',
      fit: s.score != null ? s.score : '',
      why: (s.facts || []).join(' '),
      first: { email: 'Email', ig: 'Instagram DM', site: 'Website contact form', call: 'Call or walk in' }[channel] || 'Walk in',
      subject: m.subject,
      email_text: m.email,
      dm: m.dm,
      walkin: m.walkin,
      follow1_on: followOn(4),
      follow1: channel === 'email' || channel === 'site' ? m.follow1Email : m.follow1,
      follow2_on: followOn(10),
      follow2: channel === 'email' || channel === 'site' ? m.follow2Email : m.follow2,
      source: s.source,
    }));
    const credit = places.creditLine(chosen);
    const sheet = rows.length
      ? await save.saveFile(
          ctx,
          `${base}-stockist-pitches.csv`,
          files.csv(credit ? rows.concat([{ rank: credit }]) : rows, [
            { key: 'rank', label: '#' },
            { key: 'name', label: 'Shop' },
            { key: 'kind', label: 'Type' },
            { key: 'miles', label: 'Miles' },
            { key: 'address', label: 'Address' },
            { key: 'website', label: 'Website' },
            { key: 'email', label: 'Email seen' },
            { key: 'instagram', label: 'Instagram' },
            { key: 'phone', label: 'Phone' },
            { key: 'fit', label: 'Fit (0 to 100)' },
            { key: 'why', label: 'Why it fits' },
            { key: 'first', label: 'First contact' },
            { key: 'subject', label: 'Email subject' },
            { key: 'email_text', label: 'Email' },
            { key: 'dm', label: 'Instagram DM' },
            { key: 'walkin', label: 'Walk-in line' },
            { key: 'follow1_on', label: 'Follow up on' },
            { key: 'follow1', label: 'Follow-up 1' },
            { key: 'follow2_on', label: 'Second follow-up on' },
            { key: 'follow2', label: 'Follow-up 2' },
          ]),
          'text/csv'
        )
      : null;
    // A walking or driving route through the nearest real shops (not for sample shops).
    const real = chosen.filter((s) => !s.sample && (s.address || Number.isFinite(s.lat)) && s.miles != null).sort((a, b) => a.miles - b.miles).slice(0, 9);
    const route = real.length >= 2 ? places.directionsLink(real.map((s) => ({ address: s.address && /\d/.test(s.address) ? s.address : null, lat: s.lat, lng: s.lng }))) : null;
    ctx.log(`Line sheet with ${text.plural(items.length, 'product')}. ${text.plural(shops.length, 'shop')} written up, ${saved} saved to your Pipeline.`);
    return {
      items: items.map((i) => ({ name: i.name, wholesale: i.wholesale, retail: i.retail, note: i.note })),
      shops: shops.map(({ rank, s, m, channel }) => ({ rank, name: s.name, why: s.why || '', channel: channel || 'walk-in', subject: m.subject, email: m.email, dm: m.dm, walkin: m.walkin, source: s.source || null, ...(s.searchBy ? { searchBy: s.searchBy } : {}), sample: !!s.sample })),
      saved,
      lineSheet,
      sheet,
      missing,
      route,
      sample: chosen.some((s) => s.sample),
    };
  },

  view(out) {
    const top = out.shops.slice(0, 3);
    return views.blocks(
      views.sampleNote(out, 'These shops', { plural: true }),
      views.metric('Shops written up', out.shops.length, `${out.saved} saved to your Pipeline with the messages`),
      views.file(out.lineSheet, 'Wholesale line sheet: print it or save it as a PDF to attach'),
      views.file(out.sheet, 'Every shop with its email, DM, walk-in line and follow-ups'),
      views.table(
        [
          { key: 'name', label: 'Product' },
          { key: 'wholesale', label: 'Wholesale', format: 'money' },
          { key: 'retail', label: 'Retail', format: 'money' },
        ],
        out.items,
        8
      ),
      top.map((s) => (s.channel === 'email' || s.channel === 'site' ? views.copy(`Email to ${s.name}`, s.email, { subject: s.subject }) : s.channel === 'ig' ? views.copy(`DM to ${s.name}`, s.dm) : views.copy(`Walk-in line for ${s.name}`, s.walkin))),
      out.missing.length ? views.text(`Terms to decide before a shop asks: ${text.list(out.missing.map((m) => m.replace(/\s*\(.*\)$/, '').toLowerCase()))}.`) : null,
      out.route ? views.link('Walk-in route through the nearest shops', out.route) : null,
      places.creditBlocks(out.shops)
    );
  },
};
