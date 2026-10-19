// Answers to buyer messages: "is it available?", offers and lowballs (counter once, never under your
// lowest price), holds, late buyers and no-shows, "is it real?", and the scams to avoid (codes,
// payment outside the app, overpayment, couriers, fake payment emails), each with why and its source.
// Templates from data/niche.json `buyers`, no AI: nothing is sent for you, and the answer never says
// more than you can check.

const { views, money, text } = require('../../_kit');
const C = require('../../_kit/common');
const F = require('../lib/fees');

const { usd, num } = money;
const { plain, clip } = text;

const RE = {
  no_show: /\b(no[- ]?show|didn'?t (show|come|turn up)|never (showed|came|turned up)|stood me up|ghosted)\b/i,
  late: /\b(running late|running behind|i'?ll be late|be (a )?(few|couple|little)( of)? (min(ute)?s? )?late|stuck in traffic|on my way|reschedule|another time|different time|later today|tomorrow instead|can we (do|make it) (it )?(later|tomorrow|another day)|push (it )?back|can'?t make it)\b/i,
  offer: /\b(would you take|will you take|take \$?\d|do \$?\d+|lowest|best (price|you can do)|firm\b|negotiable|obo\b|wiggle room|come down|any discount|accept \$?\d|offer)\b|\$\s?\d/i,
  hold: /\b(hold|save it|set it aside|put it aside|reserve|keep it for me|can you wait|until (payday|the weekend|next week|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
  authentic: /\b(real|authentic|genuine|legit|fake|original|counterfeit)\b/i,
  available: /\b(available|still (for sale|have it|got it|there)|is it sold|sold yet)\b/i,
};

// "$30", "30 dollars", "take 30", "do 25.50" (sizes like 34x32 or "size 10" never count).
function amountIn(words) {
  const s = String(words || '');
  const m = s.match(/\$\s?(\d{1,5}(?:\.\d{1,2})?)/) || s.match(/\b(\d{1,5}(?:\.\d{1,2})?)\s?(?:dollars|bucks)\b/i) || s.match(/\b(?:take|do|for|at|offer|pay|accept)\s+(\d{1,5}(?:\.\d{1,2})?)\b(?!\s?(?:x|in|inch|cm|%))/i);
  const n = m ? Number(m[1]) : null;
  return n && n > 0 ? n : null;
}

function buyersTool(N) {
  const B = N.buyers;
  const where = [...N.platforms.map((p) => p.id), 'local'];
  return {
    name: 'resale.answer_buyer',
    title: 'Answer a buyer',
    description: 'What a buyer message means and the answer to send: is it available, offers and lowballs (one counter, never under your lowest), holds, late buyers and no-shows, is it real, and the scams to avoid, each with why and its source.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: {
      type: 'object',
      properties: {
        message: { type: 'string', format: 'textarea', maxLength: 2000, title: 'What the buyer wrote', description: 'Paste their message' },
        no_show: { type: 'boolean', default: false, title: "They didn't show up for pickup" },
        item: { type: 'string', maxLength: 100, title: 'Which item (optional)' },
        where: { type: 'string', enum: where, default: 'ebay', title: 'Where you listed it', description: 'local: local pickup, cash when you meet' },
        price: { type: 'string', maxLength: 10, title: 'Your price', description: 'Needed to answer offers' },
        floor: { type: 'string', maxLength: 10, title: 'Your lowest price (optional)', description: 'From Price and offers. Left empty, worked out from what you paid' },
        cost: { type: 'string', maxLength: 10, title: 'What you paid (optional)' },
        pickup: { type: 'string', maxLength: 120, title: 'Where you meet for pickup (optional)', description: 'A busy public place, like a police station lobby or a store entrance' },
        hold_until: { type: 'string', maxLength: 40, title: 'Hold until (optional)', description: 'Like "6pm today"' },
      },
    },
    output: {
      type: 'object',
      required: ['intent', 'label', 'answer', 'next'],
      properties: { intent: { type: 'string' }, label: { type: 'string' }, means: { type: 'string' }, answer: { type: 'string' }, next: { type: 'string' }, scam: { type: 'boolean' }, why: { type: 'string' }, sources: { type: 'array' }, numbers: { type: 'object' } },
    },
    async run(input, ctx) {
      const words = plain(input.message || '').trim();
      if (!words && !input.no_show) throw new Error('Paste what the buyer wrote, or tick "They didn\'t show up".');
      const place = where.includes(input.where) ? input.where : 'ebay';
      const local = place === 'local';
      const site = local ? 'local pickup' : N.platforms.find((p) => p.id === place).name;
      const item = clip(plain(input.item || ''), 100);
      const price = num(input.price, null);
      const cost = num(input.cost, null);
      const typedFloor = num(input.floor, null);
      const floor = typedFloor && typedFloor > 0 ? Math.round(typedFloor) : cost != null && cost >= 0 && price ? F.floorPrice(N, local ? 'facebook' : place, { cost, profit: N.pricing.min_profit, weight: local ? 'local' : '1lb' }) : null;
      const v = { pickup: plain(input.pickup || '') || B.pickup_default, hold_until: plain(input.hold_until || '') || B.hold_default, site, bundle_off: Math.round(N.pricing.bundle_off * 100) };
      const pick = (e) => C.fill(e[local ? 'local' : 'ship'] || e.answer || '', v);
      const sourcesOf = (ids) => (ids || []).map((i) => B.sources[i]).filter(Boolean).map((s) => ({ publisher: s.publisher, url: s.url, says: s.says }));

      const scam = words ? B.scams.find((s) => new RegExp(s.match, 'i').test(words)) : null;
      if (scam) {
        return {
          intent: 'scam',
          scam: true,
          label: `Scam to avoid: ${scam.label.toLowerCase()}`,
          means: scam.means,
          why: scam.why,
          answer: C.fill(local ? B.scam_local : B.scam_ship, v),
          next: B.scam_next,
          judgment: !!scam.judgment,
          sources: sourcesOf(scam.sources),
          rules: B.rules,
          item,
          site,
        };
      }
      let intent = 'other';
      if (input.no_show || RE.no_show.test(words)) intent = 'no_show';
      else if (RE.late.test(words)) intent = 'late';
      else if (RE.offer.test(words)) intent = 'offer';
      else if (RE.hold.test(words)) intent = 'hold';
      else if (RE.authentic.test(words)) intent = 'authentic';
      else if (RE.available.test(words)) intent = 'available';
      else if (/\?\s*$/.test(words)) intent = 'question';
      const e = B.intents[intent];
      let answer = pick(e);
      let label = e.label;
      let numbers = null;
      let note = '';
      if (intent === 'offer') {
        const amount = amountIn(words);
        if (!price) {
          answer = C.fill(e.unknown, v);
          note = 'Add your price (and what you paid) to get the exact counter.';
        } else {
          const acceptAt = Math.round(price * B.accept_at);
          let counter = null;
          let deal = null;
          if (amount && amount >= acceptAt) deal = Math.min(amount, price);
          else if (amount) counter = Math.min(price, Math.max(floor || 0, Math.round((amount + price) / 2)));
          else counter = Math.max(floor || 0, Math.round(price * (1 - N.pricing.watcher_off)));
          if (deal) answer = C.fill(local ? e.accept_local : e.accept_ship, { ...v, amount: usd(deal) });
          else if (!amount) answer = C.fill(local ? e.lowest_local : e.lowest_ship, { ...v, counter: usd(counter) });
          else answer = C.fill(local ? e.counter_local : e.counter_ship, { ...v, counter: usd(counter) });
          const low = amount && floor && amount < floor;
          if (low) label = 'A lowball offer';
          numbers = { price, floor, amount, counter, deal, accept_at: acceptAt };
          if (deal) note = `${usd(amount)} is within ${Math.round((1 - B.accept_at) * 100)} percent of your price: take it.`;
          else if (low) note = `${usd(amount)} is under your lowest price of ${usd(floor)}. Counter once at ${usd(counter)}; if they say no, the next buyer may pay your price.`;
          else if (amount && floor) note = `${usd(amount)} still clears your lowest price of ${usd(floor)}: accept it instead if you'd rather sell today.`;
          else if (!floor) note = 'Add what you paid (or your lowest price) and the counter never drops under it.';
        }
      }
      return {
        intent,
        scam: false,
        label,
        means: e.means,
        answer,
        next: C.fill(e.next, v),
        check: e.check ? C.fill(e.check, v) : '',
        note,
        judgment: !!e.judgment,
        sources: (e.sources || []).map((s) => ({ publisher: s.publisher, url: s.url, says: s.says })),
        numbers,
        rules: B.rules,
        item,
        site,
      };
    },
    view(out) {
      const n = out.numbers;
      return views.blocks(
        views.metric(out.item ? `Buyer message: ${out.item}` : 'Buyer message', out.label, out.means),
        out.scam ? views.text(`Why it's a scam: ${out.why}`) : null,
        views.copy('Your answer', out.answer),
        n ? views.table([{ key: 'what', label: 'Offer math' }, { key: 'amount', label: 'Amount' }], [
          { what: 'Your price', amount: usd(n.price) },
          { what: 'Your lowest', amount: n.floor ? usd(n.floor) : 'Not set' },
          { what: 'Their offer', amount: n.amount ? usd(n.amount) : 'No number yet' },
          { what: n.deal ? 'Accept at' : 'Counter at', amount: usd(n.deal || n.counter) },
        ]) : null,
        out.note ? views.text(out.note) : null,
        views.text(`Next: ${out.next}`),
        out.check ? views.text(`Before you send: ${out.check}`) : null,
        out.judgment ? views.text('This answer is our judgment, not a sourced fact. Make it sound like you.') : null,
        (out.sources || []).map((s) => views.link(`${s.publisher}: ${s.says}`, s.url)),
        views.text(`Rules for every buyer: ${out.rules.join(' ')}`),
      );
    },
  };
}

module.exports = { buyersTool, amountIn };
