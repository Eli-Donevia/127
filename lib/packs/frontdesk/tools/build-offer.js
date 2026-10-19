// Your offer: the front desk offer for contractors at the member's price position. Price menu
// (setup, monthly care, care with after-hours answering, a do-it-yourself kit), the first-clients
// ladder, the money model with per-client time math, promises the member controls, how to say the
// price, and a printable one-page offer sheet. No income totals; prices are per client.

const kit = require('../../_kit');
const { text, money, views, save, brain, time, quote } = kit;
const NICHE = require('../data/niche.json');
const PRICES = require('../data/prices.json');
const TOOLS = require('../data/tools.json');
const { offerHtml } = require('../lib/pages');
const prices = require('../lib/prices');
const talk = require('../../_kit/talk');

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
  name: 'frontdesk.build_offer',
  title: 'Front desk offer',
  description: 'Builds your front desk offer for contractors: price menu at your position, founding-client terms, promises you control, the money model with time per client, and a printable offer sheet.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      position: { type: 'string', enum: ['budget', 'standard', 'premium'] },
      setup: { type: 'number', minimum: 0, maximum: 20000 },
      care: { type: 'number', minimum: 0, maximum: 5000 },
      carePlus: { type: 'number', minimum: 0, maximum: 5000 },
      trade: { type: 'string', enum: Object.keys(NICHE.trades) },
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
  output: { type: 'object', required: ['offer', 'sheet'], properties: { offer: { type: 'object' }, sheet: { type: 'object' }, quoteLines: { type: 'string' } } },
  timeoutSec: 30,
  async run(input, ctx) {
    const br = brain.brainOf(ctx, input);
    // Same numbers every other front desk tool quotes (lib/prices), saved below for replies and call prep.
    const n = prices.offerNumbers(input, ctx, { useSaved: false });
    const { position, setup, care, carePlus } = n;
    const m = { addons: n.addons };
    const kitPrice = n.kit;
    const trade = NICHE.trades[input.trade] || NICHE.trades.contractors;
    const city = text.plain(input.city || br.place || br.city || 'your area');
    const pkg = (id) => PRICES.packages.find((p) => p.id === id) || {};
    const menuRows = [
      { id: 'setup', label: pkg('setup').label, price: setup, priceText: `${money.usd(setup)} one time`, includes: pkg('setup').includes },
      { id: 'care', label: pkg('care').label, price: care, priceText: `${money.usd(care)} a month`, includes: pkg('care').includes },
      { id: 'care_plus', label: pkg('care_plus').label, price: carePlus, priceText: `${money.usd(carePlus)} a month`, includes: pkg('care_plus').includes },
      { id: 'kit', label: PRICES.downsell.label, price: kitPrice, priceText: `${money.usd(kitPrice)} one time`, includes: PRICES.downsell.includes },
    ];
    const careMin = pkg('care').minutes || 90;
    const setupMin = pkg('setup').minutes || 240;
    const perHour = (p, min) => money.usd(Math.round(p / (min / 60)));
    const { halfSetup, halfCare } = n;
    const ladder = {
      badge: `First ${NICHE.first_clients.founding_count} clients`,
      terms: `Setup free (normally ${money.usd(setup)}) and monthly care at ${money.usd(halfCare)} a month for the first 3 months (normally ${money.usd(care)}). What I ask: honest feedback, a short testimonial I may quote (I'll say you were a founding client) and permission to show your before and after numbers. No names unless you say yes. Reviews are asked for separately, with nothing attached.`,
      stepUp: `Clients 4 to 6: setup ${money.usd(halfSetup)}, care ${money.usd(care)} a month. From client 7: setup ${money.usd(setup)}.`,
      rows: [
        { who: 'Clients 1 to 3', setup: 0, care: halfCare, ask: 'A testimonial and permission to share their numbers' },
        { who: 'Clients 4 to 6', setup: halfSetup, care, ask: 'A testimonial' },
        { who: 'Client 7 on', setup, care, ask: 'Referrals' },
      ],
    };
    const name = `Never Miss a Call for ${trade.for}`;
    const offer = {
      name,
      promise: 'Every call you miss gets a text back from your own number right away, with a way to book. Live within 7 days.',
      who: `Owner-run ${trade.who} in ${city} who answer their own phone between jobs.`,
      outcome: 'No caller is left with only a voicemail. Every missed call gets a reply, a question and a way to book.',
      menu: menuRows,
      ladder,
      promises: NICHE.promises,
      toolsLine: `The tools run on your own accounts, so you own everything. Typical tool cost: ${money.usd(TOOLS.tools.quo.monthly)} a month for a business number with missed-call texts (Quo), or ${money.usd(TOOLS.tools.jobber_ai.monthly)} a month for Jobber's AI Receptionist if you use Jobber, plus a one-time texting registration (${money.usd(TOOLS.ten_dlc.quo_one_time)} through Quo). Prices checked ${TOOLS.checked}.`,
      steps: [
        'A 15-minute call: I show you your missed-call plan and we pick the tools.',
        'You add me as a user on your phone and booking accounts. Nothing is bought on my card.',
        'Live within 7 days: we test it together from two phones.',
        'Every month: I read the texts, fix what needs fixing and send a one-page report.',
      ],
      money: {
        setup: { price: setup, minutes: setupMin, perHour: perHour(setup, setupMin) },
        care: { price: care, minutes: careMin, perHour: perHour(care, careMin), every: 'month' },
        upsell: { label: pkg('care_plus').label, price: carePlus, why: 'For owners who want callers answered after hours, not just texted.' },
        downsell: { label: PRICES.downsell.label, price: kitPrice, why: 'For owners who want to set it up themselves: their texts, answers, booking flow and a setup sheet.' },
        addons: m.addons.map((a) => ({ label: a.label, price: a.price })),
        math: quote.jobMath(care, careMin, {}),
      },
      say: [
        `"It's ${money.usd(setup)} to set up and ${money.usd(care)} a month to look after, no contract. The tools are on your account, about ${money.usd(TOOLS.tools.quo.monthly)} to ${money.usd(TOOLS.tools.jobber_ai.monthly)} a month."`,
        `"You're one of my first 3, so setup is free and the first 3 months are ${money.usd(halfCare)} a month. All I ask is honest feedback, a short testimonial I can quote, and that I can share the numbers."`,
        '"If it isn\'t live within 7 days of you giving me access, you get the setup fee back."',
      ],
    };
    const member = { name: text.plain(input.myName || br.firstName || ''), business: text.plain(input.myBusiness || br.name || ''), contact: text.plain(input.myContact || ''), color: input.color };
    const html = offerHtml({ offer, member, checked: PRICES.checked });
    const sheet = await save.saveFile(ctx, save.fileName(member.business || 'front-desk', 'offer-sheet', '.html'), html);
    const quoteLines = [`${pkg('setup').label}, ${setup}`, `${pkg('care').label} (first month), ${care}`].join('\n');
    // For sales.proposal (most complete first) and sales.quote (line items).
    const options = prices.proposalOptions(n);
    const items = prices.quoteItems(n);
    // Replies, call prep and the care plan quote these same prices from now on.
    await brain.remember(ctx, 'offer', { position, setup, care, carePlus, kit: kitPrice, saved: time.today(ctx) });
    // In a proposal: the client moves to Call booked here (or is added), and the proposal and quote
    // steps run with pipeline: false, so HQ shows one row for them.
    const line = input.client ? await logClient(ctx, input, 'frontdesk', { trade: input.trade || 'contractors' }) : '';
    return { position, offer, sheet, quoteLines, options, items, line, checked: PRICES.checked, sources: PRICES.sources };
  },
  view(out) {
    const o = out.offer;
    return views.blocks(
      views.metric(o.name, `${o.menu[0].priceText} + ${o.menu[1].priceText}`, `${out.position} position, checked ${out.checked}`),
      views.text(o.promise),
      views.table([{ key: 'label', label: 'Package' }, { key: 'priceText', label: 'Price' }], o.menu),
      views.table([{ key: 'who', label: 'First-clients ladder' }, { key: 'setup', label: 'Setup', format: 'money' }, { key: 'care', label: 'Care a month', format: 'money' }, { key: 'ask', label: 'What you ask for' }], o.ladder.rows),
      views.text(`Your time: setup about ${Math.round(o.money.setup.minutes / 60)} hours (${o.money.setup.perHour} an hour of your time). Monthly care about ${o.money.care.minutes} minutes a client (${o.money.care.perHour} an hour). Upsell: ${o.money.upsell.label}. Downsell: ${o.money.downsell.label}.`),
      views.cards(o.promises.map((p) => ({ title: 'Promise', body: p }))),
      ...o.say.map((s, i) => views.copy(i === 0 ? 'How to say the price' : i === 1 ? 'Founding client offer' : 'Your promise, out loud', s)),
      views.file(out.sheet, 'Offer sheet (printable)'),
      out.line ? views.text(out.line) : null,
    );
  },
};
