// Your offer: more Google reviews for local shops at the member's price position. Price menu
// (setup, monthly care, a do-it-yourself card kit), the first-clients ladder, the money model with
// time per client, promises the member controls, how to say the price, and a printable offer sheet.
// No income totals and no promise of a number of reviews: the shop's customers decide that.

const kit = require('../../_kit');
const { text, money, views, save, brain, quote, files, time } = kit;
const NICHE = require('../data/niche.json');
const PRICES = require('../data/prices.json');
const { colorsFor } = require('../lib/cardkit');
const prices = require('../lib/prices');
const talk = require('../../_kit/talk');

const esc = files.esc;

function offerHtml({ offer, member, checked }) {
  const p = colorsFor(member.business || 'five star', member.color);
  const css = `@page{size:Letter;margin:0.5in}*{box-sizing:border-box}body{margin:0;background:${p.paper};color:${p.ink};font:15px/1.45 Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}main{max-width:780px;margin:0 auto;padding:24px 16px 40px}header{border-bottom:4px solid ${p.primary};padding-bottom:10px;margin-bottom:14px}h1{font-size:28px;line-height:1.15;margin:0 0 6px}h2{font-size:18px;margin:22px 0 8px;color:${p.primary}}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid ${p.line};padding:8px 6px;text-align:left;vertical-align:top}.price{white-space:nowrap;font-weight:700}.muted{color:${p.muted};font-size:12.5px}.badge{display:inline-block;background:${p.primary};color:${p.onPrimary};border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700}ul{padding-left:20px}`;
  const rows = offer.menu.map((m) => `<tr><td><b>${esc(m.label)}</b><br><span class="muted">${esc(m.includes.join('. '))}.</span></td><td class="price">${esc(m.priceText)}</td></tr>`).join('');
  const body = `<main><header><h1>${esc(offer.name)}</h1><p>${esc(offer.promise)}</p><p class="muted">For ${esc(offer.who)}</p></header>
<h2>What you get</h2><table>${rows}</table>
<h2><span class="badge">${esc(offer.ladder.badge)}</span></h2><p>${esc(offer.ladder.terms)}</p><p class="muted">${esc(offer.ladder.stepUp)}</p>
<h2>How it works</h2><ul>${offer.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
<h2>Promises</h2><ul>${offer.promises.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
<h2>The honest way</h2><ul>${NICHE.rules.slice(0, 3).map((r) => `<li>${esc(r.line)}</li>`).join('')}</ul>
<p class="muted">${member.name || member.business ? `${esc([member.name, member.business].filter(Boolean).join(', '))}${member.contact ? ` · ${esc(member.contact)}` : ''} · ` : ''}Prices checked ${esc(checked)}.</p></main>`;
  return files.htmlDoc({ title: offer.name, description: 'Offer sheet', css, body });
}

async function logClient(ctx, input, pack, data) {
  const name = text.clip(text.oneLine(String(input.client || '')), 100);
  try {
    const { lead } = await talk.findLead(ctx, { name, website: input.website });
    const email = text.oneLine(String(input.email || ''));
    const links = { ...(talk.siteUrl(input.website) ? { website: talk.siteUrl(input.website) } : {}), ...(/@/.test(email) ? { email } : {}) };
    return await talk.moveLead(ctx, lead, { pack, stage: 'call', name, source: 'Proposal', links, data });
  } catch {
    return '';
  }
}

module.exports = {
  name: 'reviews.build_offer',
  title: 'Reviews offer',
  description: 'Builds your offer for more Google reviews: price menu at your position, founding-client terms, promises you control, time per client and a printable offer sheet.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      position: { type: 'string', enum: ['budget', 'standard', 'premium'] },
      setup: { type: 'number', minimum: 0, maximum: 5000 },
      care: { type: 'number', minimum: 0, maximum: 2000 },
      shop: { type: 'string', enum: Object.keys(NICHE.shops) },
      city: { type: 'string', maxLength: 120 },
      myName: { type: 'string', maxLength: 60 },
      myBusiness: { type: 'string', maxLength: 80 },
      myContact: { type: 'string', maxLength: 160 },
      color: { type: 'string', maxLength: 7 },
      client: { type: 'string', maxLength: 100, description: 'In a proposal: the business it is for, moved to Call booked in your Pipeline.' },
      owner: { type: 'string', maxLength: 80 },
      email: { type: 'string', maxLength: 160 },
      website: { type: 'string', maxLength: 300 },
    },
  },
  output: { type: 'object', required: ['offer', 'sheet'], properties: { offer: { type: 'object' }, sheet: { type: 'object' }, options: { type: 'array' }, items: { type: 'array' } } },
  timeoutSec: 30,
  async run(input, ctx) {
    const br = brain.brainOf(ctx, input);
    // Typed numbers, else the band at their position (never the saved offer: this is where it's set).
    const nums = prices.offerNumbers(input, ctx, { useSaved: false });
    const { position, setup, care, kit: kitPrice } = nums;
    const S = NICHE.shops[input.shop] || null;
    const city = text.plain(input.city || br.place || br.city || 'your area');
    const { pkg } = prices;
    const menu = [
      { id: 'setup', label: pkg('setup').label, price: setup, priceText: `${money.usd(setup)} one time`, includes: pkg('setup').includes },
      { id: 'care', label: pkg('care').label, price: care, priceText: `${money.usd(care)} a month`, includes: pkg('care').includes },
      { id: 'kit', label: PRICES.downsell.label, price: kitPrice, priceText: `${money.usd(kitPrice)} one time`, includes: PRICES.downsell.includes },
    ];
    const setupMin = pkg('setup').minutes || 120;
    const careMin = pkg('care').minutes || 60;
    const perHour = (p, min) => money.usd(Math.round(p / (min / 60)));
    const { halfSetup, halfCare } = nums;
    const n = NICHE.first_clients.founding_count;
    const ladder = {
      badge: `First ${n} clients`,
      terms: `Setup free (normally ${money.usd(setup)}) and monthly care at ${money.usd(halfCare)} a month for the first 3 months (normally ${money.usd(care)}). What I ask: honest feedback, a short testimonial I may quote (I'll say you were a founding client) and permission to show your before and after numbers. No names unless you say yes. Your own reviews come from your customers, never from this deal.`,
      stepUp: `Clients 4 to 6: setup ${money.usd(halfSetup)}, care ${money.usd(care)} a month. From client 7: setup ${money.usd(setup)}.`,
      rows: [
        { who: `Clients 1 to ${n}`, setup: 0, care: halfCare, ask: 'Feedback, a testimonial and permission to share the numbers' },
        { who: 'Clients 4 to 6', setup: halfSetup, care, ask: 'A testimonial' },
        { who: 'Client 7 on', setup, care, ask: 'Referrals' },
      ],
    };
    const offer = {
      name: S ? `More Google Reviews for ${S.label.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\b(And|Or)\b/g, (w) => w.toLowerCase())}` : 'More Google Reviews for Local Shops',
      promise: 'Every customer gets asked, every time, with one tap. Cards and links live within 3 days, and a reply draft for every new review.',
      who: `owner-run ${S ? S.label.toLowerCase() : 'shops and services'} in ${city} whose newest reviews are months old.`,
      menu,
      ladder,
      promises: NICHE.promises,
      steps: [
        'A 15-minute visit: I show you your review card and we look at your listing together.',
        'You give me your review link from your Business Profile (I show you where it is).',
        'Within 3 days: printed cards on the counter, a line on your receipts and the words for your team.',
        'Every month: a reply draft for every new review, fresh cards and a one-page report.',
      ],
      money: {
        setup: { price: setup, minutes: setupMin, perHour: perHour(setup, setupMin) },
        care: { price: care, minutes: careMin, perHour: perHour(care, careMin), every: 'month' },
        downsell: { label: PRICES.downsell.label, price: kitPrice },
        addons: nums.addons.map((a) => ({ label: a.label, price: a.price })),
        math: quote.jobMath(care, careMin, {}),
      },
      say: [
        `"It's ${money.usd(setup)} to set up and ${money.usd(care)} a month, no contract. You own the cards, the link and the templates."`,
        `"You're one of my first ${n}, so setup is free and the first 3 months are ${money.usd(halfCare)} a month. All I ask is honest feedback, a short testimonial I can quote, and that I can share your before and after numbers."`,
        '"If the cards and links aren\'t live within 3 days of your yes, you get the setup fee back."',
      ],
    };
    const member = { name: text.plain(input.myName || br.firstName || ''), business: text.plain(input.myBusiness || br.name || ''), contact: text.plain(input.myContact || ''), color: input.color };
    const sheet = await save.saveFile(ctx, save.fileName(member.business || 'reviews', 'offer-sheet', '.html'), offerHtml({ offer, member, checked: PRICES.checked }));
    const options = prices.proposalOptions(nums);
    const items = prices.quoteItems(nums);
    // Every later answer, call card and care plan quotes these numbers.
    await brain.remember(ctx, 'offer', { position, setup, care, kit: kitPrice, saved: time.today(ctx) });
    // In a proposal: the shop moves to Call booked here (or is added), and the proposal and quote
    // steps run with pipeline: false, so HQ shows one row for them.
    const line = input.client ? await logClient(ctx, input, 'reviews', { shop: input.shop || 'salons' }) : '';
    return { position, offer, sheet, options, items, line, checked: PRICES.checked, sources: PRICES.sources };
  },
  view(out) {
    const o = out.offer;
    return views.blocks(
      views.metric(o.name, `${o.menu[0].priceText} + ${o.menu[1].priceText}`, `${out.position} position, checked ${out.checked}`),
      views.text(o.promise),
      views.table([{ key: 'label', label: 'Package' }, { key: 'priceText', label: 'Price' }], o.menu),
      views.table([{ key: 'who', label: 'First-clients ladder' }, { key: 'setup', label: 'Setup', format: 'money' }, { key: 'care', label: 'Care a month', format: 'money' }, { key: 'ask', label: 'What you ask for' }], o.ladder.rows),
      views.text(`Your time: setup about ${Math.round(o.money.setup.minutes / 60)} hours (${o.money.setup.perHour} an hour of your time). Monthly care about ${o.money.care.minutes} minutes a client (${o.money.care.perHour} an hour). Downsell: ${o.money.downsell.label}.`),
      views.cards(o.promises.map((p) => ({ title: 'Promise', body: p }))),
      ...o.say.map((s, i) => views.copy(i === 0 ? 'How to say the price' : i === 1 ? 'Founding client offer' : 'Your promise, out loud', s)),
      views.file(out.sheet, 'Offer sheet (printable)'),
      out.line ? views.text(out.line) : null,
    );
  },
};
