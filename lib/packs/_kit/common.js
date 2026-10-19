// Shared code for the people-services packs: tutoring, petcare, coaching and resale. Each pack's facts
// live in its own data/niche.json, never here: this file turns them into tools. Owner: the People
// services builder (wave 3). Packs require it as require('../_kit/common'); their tools as
// require('../../_kit/common').
//
//   1. Niche data and the member's facts      load, fill, linesOf, who, priceOf, crowdCard
//   2. The offer                              offerOf, offerSheet, offerText, offerTool
//   3. Reviews and referrals                  keepTool
//   4. The Pipeline                           findLead, saveLead, personLead, placeLead, rungOf
//   5. Household first 25 and next 25         first25Tool, next25Tool (tutoring, petcare)
//   6. Answer a reply                         replyTool
//   7. Plan a quote                           quoteTool (then sales.quote and sales.invoice)
//   8. A customer said yes                    winTool
//   9. Show your work                         storyTool, storyCardTool, cardSvg, saveCard
//  10. Look ready                             readyTool (then site.build, local.gbp_kit, local.flyer)
//  11. Shared workflows                       replyWorkflow, quoteWorkflow, winSteps, proofWorkflow,
//                                             next25Workflow, readyWorkflow
//
// Prices are per session, walk or item, never an income total. Texts to people the member knows are
// personal (no address or opt-out lines); emails to businesses end with the name, business, address
// line and opt-out (Legal D28). Rows saved to the Pipeline carry msg, facts, score and channel (D29).
// Lists of OpenStreetMap places carry the credit: creditBlocks in views, creditLine as the last CSV
// row (D27). Nothing is given in exchange for a review, and a story from a founding or free deal says
// so plainly (D24).

const fs = require('fs');
const path = require('path');
const text = require('./text');
const money = require('./money');
const files = require('./files');
const views = require('./views');
const save = require('./save');
const crowd = require('./crowd');
const time = require('./time');
const brain = require('./brain');
const booked = require('./booked');
const first25 = require('./first25');
const ai = require('./ai');
const web = require('./web');

// Loaded when used: they bring in more code than the offer and keep tools need.
const places = () => require('./places');
const outreach = () => require('./outreach');
const leadsKit = () => require('./leads');
const svgKit = () => require('./svg');
const media = () => require('./media');

const { plain, clip } = text;
const { num, usd, nicePrice } = money;
const esc = files.esc;

// ---------- 1. niche data and the member's facts ----------

function load(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'data', 'niche.json'), 'utf8'));
}

// "Hi {greet}" + { greet: 'Lisa' } -> "Hi Lisa", tidy spaces, plain text.
function fill(t, v) {
  return plain(
    String(t || '')
      .replace(/\{(\w+)\}/g, (_, k) => (v[k] == null ? '' : String(v[k])))
      .replace(/\s+([,.!?])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

function linesOf(v, max = 60) {
  const raw = Array.isArray(v) ? v : String(v || '').split(/\r?\n|;/);
  return raw.map((s) => plain(String(s || '')).trim()).filter(Boolean).slice(0, max);
}

function monthOf(ctx) {
  const m = Number(String(time.today(ctx)).slice(5, 7));
  return m >= 1 && m <= 12 ? m : undefined;
}

function crowdCard(ctx, N) {
  return crowd.card(N.crowd, { month: monthOf(ctx) });
}

// The member's facts for messages: name, business, area.
function who(ctx, input = {}) {
  const br = brain.brainOf(ctx, input);
  const city = plain(input.city || br.place || br.city || '');
  return {
    first: br.firstName || '',
    business: plain(input.business || br.name || ''),
    city,
    area: plain(input.area || city.split(',')[0] || ''),
    phone: plain(input.phone || ''),
    link: /^https:\/\//.test(String(input.link || '')) ? String(input.link) : '',
  };
}

// The member's full price per unit: what they typed, else what the Offer builder saved, else null
// (offerOf then uses the standard price from the sourced range).
function priceOf(ctx, N, input = {}) {
  const typed = num(input.price, null);
  if (typed && typed > 0) return typed;
  const saved = brain.packMemory(ctx, N.id).offer;
  const p = saved && num(saved.price, null);
  return p && p > 0 ? p : null;
}

const firstWord = (s) => plain(s || '').trim().split(/\s+/)[0] || '';
const sentence = (s) => {
  const t = plain(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round2 = (n) => Math.round(n * 100) / 100;

// ---------- 2. the offer ----------

const POSITIONS = ['budget', 'standard', 'premium'];

function offerOf(N, input = {}) {
  const o = N.offer;
  const position = POSITIONS.includes(input.position) ? input.position : 'standard';
  const typed = num(input.price, null);
  const price = typed && typed > 0 ? Math.round(typed * 100) / 100 : o.prices[position];
  const per = `per ${o.unit}`;
  const founding = Math.max(1, nicePrice(price * (1 - o.ladder.founding.off)));
  const intro = Math.max(1, nicePrice(price * (1 - o.ladder.intro.off)));
  const ladder = [
    { step: `First ${o.ladder.founding.count}`, who: o.ladder.founding.who, price: founding, price_text: `${usd(founding)} ${per}`, note: o.ladder.founding.note },
    { step: `Next ${o.ladder.intro.count}`, who: o.ladder.intro.who, price: intro, price_text: `${usd(intro)} ${per}`, note: o.ladder.intro.note },
    { step: 'After that', who: o.ladder.full.who, price, price_text: `${usd(price)} ${per}`, note: o.ladder.full.note },
  ];
  const model = o.money_model.map((m) => {
    let p = 0;
    if (m.price === 'core') p = price;
    else if (m.times) p = nicePrice(price * m.times * (1 - (m.off || 0)));
    else if (m.factor) p = nicePrice(price * m.factor);
    else p = num(m.price, 0) || 0;
    return { kind: m.kind, name: m.name, price: p, price_text: p ? `${usd(p)} ${m.unit ? `per ${m.unit}` : per}` : 'Free', what: m.what };
  });
  return {
    name: o.name,
    unit: o.unit,
    per,
    length: o.length || '',
    position,
    price,
    price_text: `${usd(price)} ${per}`,
    includes: o.includes,
    promise: o.promise,
    promise_note: o.promise_note || '',
    steps: o.steps || [],
    ladder,
    founding,
    intro,
    money: model,
    basis: o.basis,
    sources: o.sources || [],
  };
}

const SHEET_CSS = `body{font-family:Inter,Arial,sans-serif;color:#1d2433;margin:0;background:#f6f7f9}
main{max-width:680px;margin:24px auto;background:#fff;border-radius:14px;padding:32px;box-shadow:0 2px 10px rgba(0,0,0,.06)}
h1{font-size:28px;margin:0 0 4px}h2{font-size:17px;margin:26px 0 8px;color:#2a5bd7}
.price{font-size:34px;font-weight:700;margin:14px 0 2px}.muted{color:#5b6475;font-size:14px}
ul{padding-left:20px;line-height:1.6}table{border-collapse:collapse;width:100%;font-size:15px}
td,th{border-bottom:1px solid #e3e6eb;padding:8px 6px;text-align:left}.box{background:#f1f5ff;border-radius:10px;padding:14px 16px}
footer{margin-top:26px;font-size:13px;color:#5b6475}@media print{body{background:#fff}main{box-shadow:none;margin:0}}`;

function li(items) {
  return `<ul>${(items || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

// A printable one-page offer sheet a buyer reads. No scripts.
function offerSheet(N, offer, me) {
  const book = [me.phone ? `Call or text ${esc(me.phone)}` : '', me.link ? `Book at <a href="${esc(me.link)}">${esc(me.link)}</a>` : ''].filter(Boolean).join('<br>');
  const body = `<main>
<p class="muted">${esc(me.business || N.name)}${me.area ? ` in ${esc(me.area)}` : ''}</p>
<h1>${esc(offer.name)}</h1>
<div class="price">${esc(offer.price_text)}</div>
<p class="muted">${esc(offer.length ? `${offer.length}. ` : '')}Founding price for my first ${N.offer.ladder.founding.count}: ${esc(usd(offer.founding))} ${esc(offer.per)}.</p>
<h2>What you get</h2>${li(offer.includes)}
<h2>How it works</h2>${li(offer.steps)}
<h2>My promise</h2><div class="box">${esc(offer.promise)}</div>
${offer.promise_note ? `<p class="muted">${esc(offer.promise_note)}</p>` : ''}
${(N.offer.sheet_notes || []).length ? `<h2>${esc(N.offer.sheet_notes_title || 'Good to know')}</h2>${li(N.offer.sheet_notes)}` : ''}
<h2>Book</h2><p>${book || 'Reply to my message and we will set a time.'}</p>
<footer>Prices ${esc(offer.per)}. ${esc(N.offer.footer || '')}</footer>
</main>`;
  return files.htmlDoc({ title: `${offer.name} | ${me.business || N.name}`, css: SHEET_CSS, body, description: offer.name });
}

function offerText(N, offer, me) {
  const lines = [
    `${offer.name}: ${offer.price_text}${offer.length ? ` (${offer.length})` : ''}.`,
    `What you get: ${offer.includes.join('; ')}.`,
    `My promise: ${offer.promise}`,
    `My first ${N.offer.ladder.founding.count} get ${usd(offer.founding)} ${offer.per}. ${N.offer.ladder.founding.note}`,
    me.phone || me.link ? `Book: ${[me.phone, me.link].filter(Boolean).join(' or ')}` : 'Reply here and we will find a time.',
  ];
  return lines.map(plain).join('\n');
}

// The Offer builder tool every one of these packs uses: price from the sourced range, the
// first-clients ladder, the money model and a printable sheet. The price is remembered, so the
// reply, quote and look-ready tools say the same number.
function offerTool(N) {
  return {
    name: `${N.id}.build_offer`,
    title: 'Offer builder',
    description: `Your ${N.offer.unit} price from the sourced range, the first-clients ladder (first ${N.offer.ladder.founding.count}, next ${N.offer.ladder.intro.count}, then full price), a money model and a one-page offer sheet.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        position: { type: 'string', enum: POSITIONS, default: 'standard', title: 'Where you price', description: `Budget, standard or premium within ${N.offer.range_text}` },
        price: { type: 'string', maxLength: 10, title: `Your own full price ${'per ' + N.offer.unit} (optional)` },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        city: { type: 'string', maxLength: 80, title: 'Your city (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
        link: { type: 'string', maxLength: 300, title: 'Booking link (optional)' },
      },
    },
    output: { type: 'object', required: ['offer', 'text'], properties: { offer: { type: 'object' }, text: { type: 'string' }, sheet: { type: 'object' } } },
    async run(input, ctx) {
      const me = who(ctx, input);
      const offer = offerOf(N, input);
      const html = offerSheet(N, offer, me);
      const sheet = await save.saveFile(ctx, save.fileName(me.business || N.id, 'offer sheet', '.html'), html);
      await brain.remember(ctx, 'offer', { price: offer.price, position: offer.position, saved: time.today(ctx) });
      return { offer, text: offerText(N, offer, me), sheet, range: N.offer.range_text, basis: N.offer.basis };
    },
    view(out) {
      const o = out.offer;
      return views.blocks(
        views.metric(o.name, o.price_text, `Founding price for your first ${o.ladder[0].step.replace('First ', '')}: ${o.ladder[0].price_text}`),
        views.text(`Typical range: ${out.range}. ${out.basis}`),
        views.table(
          [
            { key: 'step', label: 'First clients' },
            { key: 'who', label: 'Who' },
            { key: 'price_text', label: 'Price' },
            { key: 'note', label: 'Why' },
          ],
          o.ladder,
        ),
        views.table(
          [
            { key: 'kind', label: 'Money model' },
            { key: 'name', label: 'Offer' },
            { key: 'price_text', label: 'Price' },
            { key: 'what', label: 'What it is' },
          ],
          o.money,
        ),
        views.text(`Your promise: ${o.promise}`),
        views.copy('Your offer, ready to paste', out.text),
        views.file(out.sheet, 'Offer sheet (print or send)'),
      );
    },
  };
}

// ---------- 3. keep every customer: reviews and referrals ----------

// Every client gets the same honest review ask (no reward, no "only if you're happy"); the referral
// thank-you is for referrals only and never tied to a review. Texts come from data/niche.json `keep`.
function keepTool(N) {
  const K = N.keep;
  return {
    name: `${N.id}.ask_reviews`,
    title: K.title,
    description: K.description,
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: {
      type: 'object',
      required: ['client'],
      properties: {
        client: { type: 'string', maxLength: 60, title: K.client_title || "Client's name" },
        done: { type: 'string', maxLength: 160, title: 'What you did for them', description: `Like "${K.done_example}"` },
        review_link: { type: 'string', maxLength: 300, title: 'Your review link (optional)', description: 'Your Google Business Profile review link, or where they can rate you' },
        reward: { type: 'string', maxLength: 80, title: 'Thank-you for a referral (optional)', default: K.reward_default || '' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
        link: { type: 'string', maxLength: 300, title: 'Booking or shop link (optional)' },
      },
    },
    output: { type: 'object', required: ['messages'], properties: { messages: { type: 'array' }, card: { type: 'object' } } },
    async run(input, ctx) {
      const me = who(ctx, input);
      const greet = plain(input.client || 'there').split(' ')[0];
      const reviewLink = /^https:\/\//.test(String(input.review_link || '')) ? String(input.review_link) : '';
      const v = {
        greet,
        done: plain(input.done || K.done_example),
        review_link: reviewLink || '[your review link]',
        reward: plain(input.reward || K.reward_default || ''),
        business: me.business || K.business_fallback || N.name,
        me: me.first || me.business || '',
      };
      const T = K.texts;
      const messages = [
        { when: K.when_thanks || 'Right after the work', label: 'Thank you', text: fill(T.thank_you, v) },
        { when: K.when_review || 'The same day', label: 'Honest review ask (send to every client)', text: fill(T.review_ask, v) },
        T.referral_ask && v.reward ? { when: K.when_referral || 'A week later', label: 'Referral ask', text: fill(T.referral_ask, v) } : null,
        T.story_ask ? { when: 'After a good session, only if it fits', label: 'Story ask (consent first)', text: fill(T.story_ask, v) } : null,
      ].filter(Boolean);
      const body = `<main><p class="muted">${esc(v.business)}</p><h1>${esc(fill(K.card_title, v))}</h1>
<p>${esc(fill(T.card_line, v))}</p>
${v.reward && T.referral_ask ? `<div class="box">${esc(fill(K.card_reward || 'Referred by {greet}: you both get {reward} when you book.', v))}</div>` : ''}
<h2>Get in touch</h2><p>${[me.phone ? `Call or text ${esc(me.phone)}` : '', me.link ? `<a href="${esc(me.link)}">${esc(me.link)}</a>` : ''].filter(Boolean).join('<br>') || esc(v.business)}</p>
<footer>${esc(K.card_footer || '')}</footer></main>`;
      const card = await save.saveFile(ctx, save.fileName(greet, K.file_word || 'referral card', '.html'), files.htmlDoc({ title: fill(K.card_title, v), css: SHEET_CSS, body, description: fill(K.card_title, v) }));
      return { messages, card, rules: K.rules || [], missingLink: !reviewLink };
    },
    view(out) {
      return views.blocks(
        out.rules.length ? views.text(out.rules.join(' ')) : null,
        out.messages.map((m) => views.copy(`${m.label}: ${m.when}`, m.text)),
        out.missingLink ? views.text('Add your review link to fill in [your review link]. On Google Business Profile it is under "Ask for reviews".') : null,
        views.file(out.card, 'Card to hand over or send'),
      );
    },
  };
}

// ---------- 4. the Pipeline (contract 13, Legal D28 and D29) ----------
// Find the lead the member picked (options: 'pipeline' passes the name) or typed, and save people and
// places with what Do my day hands out each morning. A pack's own lead (or a new one) is upserted by
// key, so its stage only moves forward; another pack's lead gets ctx.leads.update (messages, reply and
// note only: its stage can't move from here). Saving never fails a run: a refusal is logged.

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const keyFor = (kind, name) => `${kind}:${norm(name).slice(0, 80)}`;
const placeKey = (b) => b.key || `place:${norm(b.name).slice(0, 60)}${b.address ? `:${norm(b.address).slice(0, 30)}` : ''}`;

// Words that say a typed name is a place or a business, not a person.
const BUSINESS_WORDS = /\b(llc|inc|corp|co-?ops?|library|libraries|center|centre|ymca|ywca|school|academy|pta|pto|association|club|church|clinic|hospital|vets?|veterinary|animal|grooming|groomers?|kennels?|apartments?|residences|lofts|properties|realty|management|studio|shop|store|market|cafe|company|group|services|hoa)\b/i;
const looksLikeBusiness = (name) => BUSINESS_WORDS.test(String(name || ''));

function canSave(ctx) {
  return !!(ctx && ctx.leads && typeof ctx.leads.upsert === 'function');
}

// Every lead the member has, from every pack ([] without a Pipeline).
async function everyone(ctx) {
  if (!ctx || !ctx.leads || typeof ctx.leads.list !== 'function') return [];
  try {
    return ((await ctx.leads.list({ all: true, limit: 2000 })) || []).filter(Boolean);
  } catch {
    return [];
  }
}

const isOwn = (lead, packId) => !!lead && (!lead.pack || lead.pack === packId);

// The best match for a name: exact first, this pack's own leads before other packs', open before lost.
async function findLead(ctx, packId, name) {
  const want = norm(name);
  if (want.length < 2) return null;
  let best = null;
  let bestScore = 0;
  for (const l of await everyone(ctx)) {
    const n = norm(l.name);
    const c = norm(l.company);
    let s = 0;
    if (n === want || c === want) s = 6;
    else if ((n && n.startsWith(want)) || (c && c.startsWith(want))) s = 3;
    else if (want.length >= 4 && ((n && n.includes(want)) || (c && c.includes(want)))) s = 2;
    if (!s) continue;
    if (isOwn(l, packId)) s += 1;
    if (l.stage !== 'lost') s += 0.5;
    if (s > bestScore) {
      best = l;
      bestScore = s;
    }
  }
  return best;
}

const isPlace = (lead) => !!lead && !lead.warm && (!!lead.company || /^(place|biz|osm|sample|gplaces|street):/.test(String(lead.key || '')) || !!lead.placeId);

// Merge into a lead's own data (an upsert replaces data whole; keep what other runs saved).
function mergeData(lead, extra) {
  const prev = lead && lead.data && typeof lead.data === 'object' ? lead.data : {};
  const out = { ...prev, ...extra };
  return JSON.stringify(out).length > 7500 ? extra : out;
}

const scrubbed = (e) => plain(web.scrubKeys(String((e && e.message) || e || ''))).slice(0, 140);

// Saves what a run wrote for one lead. patch: { stage, msg, facts, score, channel, reply, note, data, warm, links }.
// Returns { saved, created, other, stage }. Another pack's lead is updated by id, and HQ moves its
// stage forward too (contract v1.5); before v1.5 it stays put, so stage is where the lead really is.
async function saveLead(ctx, packId, lead, patch, { name, business, source } = {}) {
  if (!canSave(ctx)) return { saved: false };
  try {
    if (lead && !isOwn(lead, packId)) {
      if (!lead.id || typeof ctx.leads.update !== 'function') return { saved: false, other: true, stage: lead.stage };
      const { data, name: n, company, links, warm, source: s, key, ...rest } = patch; // eslint-disable-line no-unused-vars
      const after = await ctx.leads.update(lead.id, rest);
      return { saved: true, other: true, stage: (after && after.stage) || lead.stage };
    }
    const key = lead ? lead.key : patch.key || keyFor(business ? 'place' : 'person', name);
    if (!key || key.length < 6) return { saved: false };
    const row = { ...patch, key };
    if (!lead) {
      if (row.name === undefined && name) row.name = clip(plain(name), 120);
      if (business && row.company === undefined && name) row.company = clip(plain(name), 120);
      if (row.source === undefined) row.source = clip(source || 'Typed in', 60);
    }
    if (patch.data) row.data = mergeData(lead, patch.data);
    const out = await ctx.leads.upsert(row);
    return { saved: true, created: !lead, stage: (out && out.stage) || patch.stage || (lead && lead.stage) || 'found' };
  } catch (e) {
    if (ctx && typeof ctx.log === 'function') ctx.log(`Couldn't save to your Pipeline: ${scrubbed(e)}`);
    return { saved: false, error: scrubbed(e) };
  }
}

// Someone the member knows (warm). Texts to them are personal, so no address or opt-out lines.
function personLead(p, { dm, follow1, follow2, subject, source, score = 85 } = {}) {
  const links = {};
  if (p.phone) links.phone = String(p.phone).trim();
  if (p.email) links.email = String(p.email).trim();
  const channel = links.phone ? 'call' : links.email ? 'email' : null;
  const msg = { dm: plain(dm || '') };
  if (follow1) msg.follow1 = plain(follow1);
  if (follow2) msg.follow2 = plain(follow2);
  if (channel === 'email') {
    msg.subject = clip(subject || 'Quick question', 120);
    msg.email = msg.dm;
  }
  return {
    key: keyFor('person', p.name),
    name: clip(plain(p.name), 120),
    source: clip(source || 'People you know', 60),
    warm: true,
    ...(p.note ? { note: clip(plain(p.note), 1000) } : {}),
    links,
    msg,
    facts: [p.note ? clip(`You know them: ${plain(p.note)}`, 160) : 'Someone you know'],
    score: clamp(Math.round(score), 0, 100),
    ...(channel ? { channel } : {}),
  };
}

// A local place that serves the same customers (a library, a vet, an apartment building). Its first
// message and walk-in line come from kit first25.partnerMessage; the email ends with the name,
// business, address line and opt-out (D28), and the follow-ups take the form of the best channel.
function placeLead(b, t, { me = {}, what, area, source, weight = 1 } = {}) {
  const o = { what, area, me: me.first || '' };
  const m = b.message && b.walk_in ? { message: b.message, walk_in: b.walk_in } : first25.partnerMessage(b, t, o);
  const links = {};
  if (b.website && /^https?:\/\//.test(b.website)) links.website = b.website;
  if (b.phone) links.phone = String(b.phone);
  const channel = links.phone ? 'call' : links.website ? 'site' : null;
  const byEmail = channel === 'site';
  const O = outreach();
  const their = t.their_customers || 'customers';
  const hi = `Hi ${b.name} team,`;
  const sign = [me.first, me.business, O.ADDRESS_HOLD].filter(Boolean).join('\n');
  const asEmail = (body) => [hi, '', plain(body), '', sign, '', O.OPT_OUT].join('\n');
  const body = plain(String(m.message).replace(/^Hi [^,]+ team,\s*/, ''));
  const reach = me.phone ? `I'm at ${me.phone}.` : 'Just reply here.';
  const nudge = `following up on my note about your ${their}. Happy to drop off a few cards, or ${t.give || 'point my customers your way'}. Would that help?`;
  const last = `Last note from me. If a ${what} partner ever helps your ${their}, ${reach} Thanks for reading!`;
  const msg = {
    dm: plain(m.message),
    subject: clip(`${text.sentenceCase(what)} for your ${their} in ${area}`, 120),
    email: asEmail(body),
    walkin: plain(m.walk_in),
    follow1: byEmail ? asEmail(me.first ? `It's ${me.first} again, ${nudge}` : `I'm ${nudge}`) : plain(`${hi} ${me.first ? `it's ${me.first} again, ` : ''}${nudge}`),
    follow2: byEmail ? asEmail(last) : plain(`${hi} ${last}`),
  };
  const facts = [
    t.why ? clip(`Their ${their} ${plain(t.why)}`, 160) : null,
    b.address ? clip(`On the map at ${plain(b.address)}`, 160) : null,
    links.website ? clip(`Website: ${web.domainOf(links.website)}`, 160) : null,
  ].filter(Boolean);
  let score = 46 + clamp(weight, 0, 4) * 4;
  if (links.phone) score += 8;
  if (links.website) score += 4;
  return {
    key: placeKey(b),
    name: clip(plain(b.name), 120),
    company: clip(plain(b.name), 120),
    source: clip(source || 'Local partners', 60),
    note: clip([t.label, b.address].filter(Boolean).join(', '), 1000),
    links,
    msg,
    facts,
    score: clamp(score, 0, 74),
    ...(channel ? { channel } : {}),
    data: { type: t.id || null, kind: t.label || null, source: b.source || null, address: b.address || null, sample: !!b.sample },
  };
}

// Saves rows one by one (each upsert is its own call); returns how many were saved.
async function saveRows(ctx, rows) {
  if (!canSave(ctx)) return 0;
  let n = 0;
  for (const row of rows) {
    try {
      await ctx.leads.upsert(row);
      n += 1;
    } catch (e) {
      if (ctx && typeof ctx.log === 'function') ctx.log(`Couldn't save ${row.name} to your Pipeline: ${scrubbed(e)}`);
      if (/full/i.test(String(e && e.message))) break;
    }
  }
  return n;
}

// Where the member is on the first-clients ladder, from this pack's wins: its won rows and the other
// packs' leads it booked (kit booked.js).
async function rungOf(ctx, N) {
  let won = 0;
  try {
    won = (await booked.wonLeads(ctx, N.id)).length;
  } catch {
    won = 0;
  }
  return rungAt(N, won);
}

const STAGE_NAMES = { found: 'Found', contacted: 'Contacted', replied: 'Replied', call: 'Call', won: 'Won', lost: 'Lost' };
// How far along a lead is, the way HQ moves them (contract v1.5): forward only, won last.
const STAGE_RANK = { found: 0, contacted: 1, replied: 2, call: 3, lost: 4, won: 5 };
const behind = (stage, target) => (STAGE_RANK[stage] ?? -1) < STAGE_RANK[target];
const RUNG_WORDS = { founding: 'founding price', intro: 'intro price', full: 'full price' };
const rungPrice = (offer, rung) => (rung.id === 'founding' ? offer.founding : rung.id === 'intro' ? offer.intro : offer.price);

// "$30 per session (founding price for my first 3 families; full price $45)".
function rateText(N, offer, rung) {
  const p = rungPrice(offer, rung);
  const who = N.offer.ladder_word || 'clients';
  if (rung.id === 'founding') return `${usd(p)} ${offer.per} (my founding price for my first ${N.offer.ladder.founding.count} ${who}; full price ${usd(offer.price)})`;
  if (rung.id === 'intro') return `${usd(p)} ${offer.per} (my intro price while I build a track record; full price ${usd(offer.price)})`;
  return `${usd(p)} ${offer.per}`;
}

// ---------- 5. household first 25 and next 25 (tutoring, petcare) ----------

// Spread picks across partner types so a list isn't all one kind of place.
function roundRobin(lists, limit) {
  const out = [];
  const seen = new Set();
  let added = true;
  for (let r = 0; added && out.length < limit; r++) {
    added = false;
    for (const l of lists) {
      const b = l[r];
      if (!b) continue;
      added = true;
      const key = String(b.name || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(b);
      if (out.length >= limit) break;
    }
  }
  return out;
}

const typeOf = (N, b) => N.partners.find((t) => t.id === b.type || t.label === b.type) || N.partners[0] || {};
const typeWeight = (N, t) => Math.max(0, N.partners.length - N.partners.indexOf(t));

// Pipeline rows for a household list: people the member knows (warm, with their texts) and real
// places (with every message). Sample places are made up and never saved.
function householdRows(N, { people = [], partners = [], me, what, area, source, subject }) {
  const rows = people.map((p, i) => personLead(p, { dm: p.message, follow1: p.follow_up, subject, source, score: 90 - Math.min(15, i) }));
  for (const b of partners) {
    if (b.source === 'sample' || b.sample || !b.name) continue;
    const t = typeOf(N, b);
    rows.push(placeLead(b, t, { me, what, area, source: `${source} (OpenStreetMap)`, weight: typeWeight(N, t) }));
  }
  return rows;
}

const HOUSEHOLD_COLUMNS = [
  { key: 'who', label: 'Who' },
  { key: 'name', label: 'Name' },
  { key: 'contact', label: 'Contact' },
  { key: 'note', label: 'Note' },
  { key: 'message', label: 'Message' },
  { key: 'follow', label: 'Follow-up or in-person line' },
  { key: 'on', label: 'Follow up on' },
  { key: 'status', label: 'Status' },
];

// One CSV for people and places, the OpenStreetMap credit as its last row when any place came from it.
function householdCsv(N, people, partners, today) {
  const rows = [
    ...people.map((p) => ({ who: N.texts.person_label, name: p.name, contact: p.phone || p.email || '', note: p.note, message: p.message, follow: p.follow_up, on: time.addDays(today, 3), status: 'To send' })),
    ...partners.map((b) => ({ who: `Place: ${b.type}`, name: b.source === 'google' ? `place_id ${b.place_id}` : b.name, contact: b.source === 'google' ? '' : [b.phone, b.website].filter(Boolean).join(' '), note: b.source === 'google' ? '' : b.address, message: b.message, follow: b.walk_in, on: time.addDays(today, 1), status: 'To send' })),
  ];
  const credit = places().creditLine(partners);
  if (credit) rows.push({ who: credit });
  return files.csv(rows, HOUSEHOLD_COLUMNS);
}

const PEOPLE_COLUMNS = [
  { key: 'name', label: 'Person' },
  { key: 'note', label: 'Note' },
  { key: 'message', label: 'Text to send' },
  { key: 'follow_up', label: 'Follow-up in 3 days' },
];
const PLACE_COLUMNS = [
  { key: 'name', label: 'Place' },
  { key: 'type', label: 'Kind' },
  { key: 'address', label: 'Address' },
  { key: 'message', label: 'Message' },
  { key: 'walk_in', label: 'In person' },
];

// "Your first 25" for a household pack on kit first25.household: up to 15 people the member knows with
// our own personal texts (a founding price for honest feedback, never for a review), up to 10 local
// places that can send customers with an ask that respects their rules, the safety rules first, a
// dated plan, one CSV and every row saved to the Pipeline for Do my day.
function first25Tool(N) {
  const T = N.texts;
  return {
    name: `${N.id}.list_first25`,
    title: 'Your first 25 list',
    description: `Up to 15 ${T.people_word} you know with a personal text each, plus up to 10 local places (${text.list(N.partners.map((p) => p.label.toLowerCase()))}) with an ask that respects their rules, ${T.extra_label}, a dated plan, a pipeline CSV and everyone saved to your Pipeline.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['osm'],
    credits: 2,
    timeoutSec: 240,
    input: {
      type: 'object',
      properties: {
        people: { type: 'string', maxLength: 4000, title: `15 ${T.people_word} you know`, description: 'One per line: name, how you know them, phone if you like. Nothing is pulled from your phone.' },
        city: { type: 'string', maxLength: 80, title: 'Your city and state', description: 'Like "Columbus, OH"' },
        what: { type: 'string', maxLength: 80, title: `What you offer (optional)`, description: `Like "${N.what_example}"` },
        price: { type: 'string', maxLength: 10, title: `Your full price per ${N.offer.unit} (optional)` },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
        exclude: { type: 'string', maxLength: 4000, title: 'Names already contacted (optional)', description: 'One per line. Skipped this time, so a re-run gives you new people and places.' },
      },
    },
    output: { type: 'object', required: ['people', 'partners', 'plan'], properties: { people: { type: 'array' }, partners: { type: 'array' }, plan: { type: 'array' }, file: { type: 'object' }, saved: { type: 'integer' } } },
    async run(input, ctx) {
      const me = who(ctx, input);
      const offer = offerOf(N, { price: input.price || priceOf(ctx, N, {}) });
      const what = plain(input.what || N.what);
      const founding = `${usd(offer.founding)} ${offer.per} instead of ${usd(offer.price)}`;
      const skip = new Set(linesOf(input.exclude, 200).map((s) => s.toLowerCase()));
      const today = time.today(ctx);
      const r = await first25.household(ctx, {
        people: first25.parsePeople(input.people, { max: 40 }).filter((p) => !skip.has(p.name.toLowerCase())).slice(0, first25.MAX_PEOPLE),
        types: N.partners,
        city: me.city,
        offer: { what, area: me.area || 'town', me: me.first, price: offer.price, foundingPrice: offer.founding },
        start: today,
      });
      const v = (greet) => ({ greet, what, area: me.area || 'town', founding, me: me.first || 'me', phone: me.phone });
      // Our own texts: the founding price is for honest feedback, never for a review.
      const people = r.people.map((p, i) => ({
        ...p,
        message: fill(T.people[(i + p.name.length) % T.people.length], v(p.greet)),
        follow_up: fill(T.people_follow_up, v(p.greet)),
      }));
      // Sample places are named "(sample)" so they're never mistaken for real ones.
      const partners = r.partners
        .filter((b) => !skip.has(String(b.name || '').toLowerCase()))
        .map((b) => {
          if (b.source !== 'sample' || /\(sample\)$/.test(b.name)) return b;
          const name = `${b.name} (sample)`;
          return { ...b, name, message: b.message.split(b.name).join(name), walk_in: b.walk_in.split(b.name).join(name) };
        });
      const anySample = partners.some((b) => b.source === 'sample');
      const saved = await saveRows(ctx, householdRows(N, { people, partners, me: { ...me, first: me.first }, what, area: me.area || 'town', source: `${N.name}: first 25` }));
      // What they offer, remembered so Your next 25, replies and the story caption say the same thing.
      if (input.what) await brain.remember(ctx, 'focus', { ...focusOf(ctx, N), what });
      const day = (n) => time.shortDate(time.addDays(today, n));
      const plan = [
        `Today: send the ${people.length || 15} texts${people.length ? '' : ' (add names to get one written for each person)'}. Short and personal beats polished.`,
        `Tomorrow (${day(1)}): contact 5 of the places. Ask for their rules first and follow them.`,
        `${day(3)}: the other places, and the follow-up to anyone who hasn't answered.`,
        `${day(7)}: run Your next 25. It skips everyone already in your Pipeline.`,
      ];
      const file = await save.saveFile(ctx, save.fileName(N.id, 'first 25', today, '.csv'), householdCsv(N, people, partners, today));
      const notes = [...(r.notes || []).filter((n) => !/samples until/.test(n))];
      if (anySample) notes.push(`Places marked (sample) are made up so you can see how it works, and they aren't saved to your Pipeline. ${T.find_tip}`);
      if (anySample && places().osmServer(ctx).held) notes.push(places().HELD_NOTE);
      const extra = (N.extra || []).map((x) => ({ title: x.title, lines: x.lines.map((l) => fill(l, v('there'))) }));
      return {
        card: crowdCard(ctx, N),
        safety: N.safety || [],
        people,
        partners,
        total: people.length + partners.length,
        plan,
        extra,
        first: people[0] ? { to: people[0].name, text: people[0].message } : partners[0] ? { to: partners[0].name, text: partners[0].message } : null,
        file,
        notes,
        saved,
        sample: anySample,
        attribution: anySample ? 'Sample places are made up.' : r.attribution || '',
      };
    },
    view(out) {
      return views.blocks(
        views.metric('Your first 25', `${out.total} ready`, `${out.people.length} people, ${out.partners.length} places${out.saved ? `. ${out.saved} saved to your Pipeline for Do my day` : ''}`),
        out.safety.length ? views.text(`${N.texts.safety_title}: ${out.safety.join(' ')}`) : null,
        crowd.blocks(out.card),
        out.first ? views.copy(`First message: to ${out.first.to}`, out.first.text) : null,
        out.people.length ? views.table(PEOPLE_COLUMNS, out.people) : views.text('Add up to 15 people you know, one per line, to get a personal text for each.'),
        views.table(PLACE_COLUMNS, out.partners),
        out.extra.map((x) => views.copy(x.title, x.lines.join('\n'))),
        views.text(`Plan: ${out.plan.join(' ')}`),
        out.notes.length ? views.text(out.notes.join(' ')) : null,
        places().creditBlocks(out.partners),
        views.file(out.file, 'Your first 25 (CSV for your pipeline)'),
      );
    },
  };
}

// ---------- 5b. household next 25 ----------
// The next batch (10 to 100, default 25): new people the member knows first, then real local places,
// skipping everyone already in the Pipeline (kit leads.known: keys, names and website domains). Every
// row is saved with the messages Do my day hands out. Safe to repeat every Monday: the CSV is dated
// and nobody comes back twice. Sample places only show when nothing real is found, and are never saved.

const BATCH_MIN = 10;
const BATCH_MAX = 100;
const BATCH_DEFAULT = 25;
const batchOf = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? clamp(n, BATCH_MIN, BATCH_MAX) : BATCH_DEFAULT;
};

function isKnown(known, { key, name, website } = {}) {
  if (!known) return false;
  if (key && known.keys.has(key)) return true;
  if (name && known.names.has(String(name).toLowerCase().trim())) return true;
  if (website && known.sites.has(web.domainOf(website))) return true;
  return false;
}

// "$30 per session, my founding price for my first 3 families" (intro and full prices are plain).
function rateShort(N, offer, rung) {
  const p = rungPrice(offer, rung);
  if (rung.id === 'founding') return `${usd(p)} ${offer.per}, my founding price for my first ${N.offer.ladder.founding.count} ${N.offer.ladder_word || 'clients'}`;
  return `${usd(p)} ${offer.per}`;
}

// The pack's memory of who the member serves: what they offer (typed in a first or next 25 run) and,
// for coaching, the one person and result.
const focusOf = (ctx, N) => brain.packMemory(ctx, N.id).focus || {};
function whatOf(ctx, N, input = {}) {
  return plain(input.what || '') || plain(focusOf(ctx, N).what || '') || N.what;
}

// Real places for each partner kind, minus the ones already in the Pipeline, spread across kinds.
async function freshPlaces(ctx, N, { city, want, known }) {
  const out = { list: [], skipped: 0, sample: false, notes: [] };
  const types = N.partners || [];
  if (want <= 0 || !types.length) return out;
  const find = places().finder(ctx);
  const per = Math.min(30, Math.ceil(want / types.length) + 6);
  const real = [];
  const samples = [];
  for (const t of types) {
    let found = [];
    try {
      found = (await find(t, { city, limit: per })) || [];
    } catch {
      if (ctx && ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
      out.notes.push(`Couldn't list ${String(t.label).toLowerCase()} near ${city || 'you'} right now.`);
    }
    const mine = [];
    const fake = [];
    for (const b of found) {
      if (!b || !b.name) continue;
      const row = { ...b, type: t.id };
      if (b.sample || b.source === 'sample') fake.push(row);
      else if (isKnown(known, { key: placeKey(b), name: b.name, website: b.website })) out.skipped += 1;
      else mine.push(row);
    }
    real.push(mine);
    samples.push(fake);
  }
  out.list = roundRobin(real, want);
  if (!out.list.length) {
    out.list = roundRobin(samples, Math.min(want, Math.max(types.length * 2, 6)));
    out.sample = out.list.length > 0;
  }
  return out;
}

function next25Tool(N) {
  const T = N.texts;
  return {
    name: `${N.id}.list_next25`,
    title: 'Your next 25 list',
    description: `The next ${BATCH_DEFAULT} (10 to 100): new ${T.people_word} you know first, then local places (${text.list(N.partners.map((p) => p.label.toLowerCase()))}), skipping everyone already in your Pipeline. Each is saved with its messages for Do my day, plus a dated CSV.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['osm'],
    credits: 2,
    timeoutSec: 240,
    input: {
      type: 'object',
      properties: {
        people: { type: 'string', format: 'textarea', maxLength: 6000, title: `New ${T.people_word} you know (optional)`, description: 'One per line: name, how you know them, phone if you like. Anyone already in your Pipeline is skipped.' },
        city: { type: 'string', maxLength: 80, title: 'Your city and state', description: 'Like "Columbus, OH"' },
        count: { type: 'integer', minimum: BATCH_MIN, maximum: BATCH_MAX, default: BATCH_DEFAULT, title: 'How many', description: '10 to 100. People first, then places.' },
        what: { type: 'string', maxLength: 80, title: 'What you offer (optional)', description: `Like "${N.what_example}". Left empty, what you used last time.` },
        price: { type: 'string', maxLength: 10, title: `Your full price per ${N.offer.unit} (optional)`, description: 'Left empty, the price from your Offer builder' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
      },
    },
    output: { type: 'object', required: ['people', 'partners', 'plan'], properties: { people: { type: 'array' }, partners: { type: 'array' }, plan: { type: 'array' }, file: { type: 'object' }, saved: { type: 'integer' }, skipped: { type: 'object' } } },
    async run(input, ctx) {
      const me = who(ctx, input);
      const offer = offerOf(N, { price: priceOf(ctx, N, input) });
      const rung = await rungOf(ctx, N);
      const what = whatOf(ctx, N, input);
      const area = me.area || 'town';
      const batch = batchOf(input.count);
      const known = await leadsKit().known(ctx);
      const today = time.today(ctx);
      const rate = rateShort(N, offer, rung);
      const v = (greet) => ({ greet, what, area, rate, me: me.first || 'me', phone: me.phone });
      let skippedPeople = 0;
      const people = first25
        .parsePeople(input.people, { max: BATCH_MAX * 2 })
        .filter((p) => {
          const old = isKnown(known, { key: keyFor('person', p.name), name: p.name });
          if (old) skippedPeople += 1;
          return !old;
        })
        .slice(0, batch)
        .map((p, i) => ({ ...p, message: fill(T.next_people[(i + p.name.length) % T.next_people.length], v(p.greet)), follow_up: fill(T.next_follow_up, v(p.greet)) }));
      const found = await freshPlaces(ctx, N, { city: me.city, want: Math.min(40, batch - people.length), known });
      const o = { what, area, me: me.first || '' };
      const partners = found.list.map((b) => {
        const t = typeOf(N, b);
        return {
          name: plain(b.name),
          type: t.label,
          address: b.address || '',
          phone: b.phone || '',
          website: b.website || '',
          source: b.source || '',
          ...(b.sample ? { sample: true } : {}),
          ...(b.searchBy ? { searchBy: b.searchBy } : {}),
          ...first25.partnerMessage(b, t, o),
        };
      });
      const rows = householdRows(N, { people, partners, me, what, area, source: `${N.name}: next 25`, subject: fill(T.next_subject, { area, what }) });
      const saved = await saveRows(ctx, rows);
      if (input.what) await brain.remember(ctx, 'focus', { ...focusOf(ctx, N), what });
      const day = (n) => time.shortDate(time.addDays(today, n));
      const plan = [
        people.length ? `Today: send the ${people.length} ${people.length === 1 ? 'text' : 'texts'}.` : `Next time, add new ${T.people_word} you know: a personal text gets more answers than any place.`,
        partners.length ? `${day(1)}: contact the first 5 places. Ask for their rules first and follow them.` : '',
        `${day(3)}: the rest, and the follow-up to anyone who hasn't answered.`,
        'Every Monday: run this again. Do my day hands these messages out each morning, and nobody already in your Pipeline comes back.',
      ].filter(Boolean);
      const file = await save.saveFile(ctx, save.fileName(N.id, 'next 25', today, '.csv'), householdCsv(N, people, partners, today));
      const notes = [...found.notes];
      if (found.sample) notes.push(`No real places came back${me.city ? ` for ${me.city}` : ' (add your city)'}, so the places marked (sample) are made up to show how it works. They aren't saved to your Pipeline. ${T.find_tip}`);
      if (found.sample && places().osmServer(ctx).held) notes.push(places().HELD_NOTE);
      if (!found.sample && !partners.length && batch > people.length) notes.push('No new places nearby this week: everyone the map found is already in your Pipeline.');
      return {
        safety: N.safety || [],
        people,
        partners,
        total: people.length + partners.length,
        batch,
        skipped: { people: skippedPeople, places: found.skipped },
        rate,
        plan,
        first: people[0] ? { to: people[0].name, text: people[0].message } : partners[0] ? { to: partners[0].name, text: partners[0].message } : null,
        file,
        notes,
        saved,
        sample: found.sample,
      };
    },
    view(out) {
      const skipped = out.skipped.people + out.skipped.places;
      return views.blocks(
        views.metric(`Your next ${out.batch}`, `${out.total} new`, `${out.people.length} people, ${out.partners.length} places. ${skipped ? `${skipped} already in your Pipeline skipped. ` : ''}${out.saved ? `${out.saved} saved for Do my day.` : ''}`),
        out.safety.length ? views.text(`${N.texts.safety_title}: ${out.safety.join(' ')}`) : null,
        out.first ? views.copy(`First message: to ${out.first.to}`, out.first.text) : null,
        out.people.length ? views.table(PEOPLE_COLUMNS, out.people) : null,
        out.partners.length ? views.table(PLACE_COLUMNS, out.partners) : null,
        views.text(`Plan: ${out.plan.join(' ')}`),
        out.notes.length ? views.text(out.notes.join(' ')) : null,
        places().creditBlocks(out.partners),
        views.file(out.file, `Your next ${out.batch} (CSV)`),
      );
    },
  };
}

// ---------- 6. answer a reply ----------
// What a reply means and a short answer with one next step: kit outreach.intentOf for the intent, the
// niche's own objections (with their sources) first, and AI only where no template answers (a
// specific question). "Stop" and a decline ("not interested", "no thanks") get no answer and the lead
// goes to lost, as in kit outreach; a decline is labeled "Said no", not "Asked you to stop".

const NO_THANKS = /\b(not interested|no,? thanks?|no,? thank you|thanks,? but no|not for (me|us)|we'?re (all )?set|we'?re good|we'?ll pass|i'?ll pass)\b/i;
const HARD_STOP = /\b(stop|unsubscribe|remove me|take me off|do not (contact|email|message|text|call)|don['’]?t (contact|email|message|text|call)|leave (us|me) alone|no more (emails|messages|texts))/i;
const DOLLARS = /\$\s?\d[\d,]*(?:\.\d\d)?/g;
const dollarsIn = (s) => (String(s || '').match(DOLLARS) || []).map((x) => x.replace(/[\s,]/g, '').replace(/\.00$/, ''));
const lengthAdj = (len) => String(len || '').replace(/^(\d+)\s*minutes?$/i, '$1-minute');
const TALK = /\b(call|talk|chat|meet|zoom|phone|catch up|come (by|over)|stop by)\b/i;
const DAY = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|this weekend|next week)\b/i;
function whenAsk(words) {
  const m = String(words || '').match(DAY);
  if (!m) return 'What day and time suit you?';
  const d = m[1].toLowerCase();
  return /^(tomorrow|tonight|this weekend|next week)$/.test(d) ? `What time ${d} suits you?` : `What time on ${d.charAt(0).toUpperCase()}${d.slice(1)} suits you?`;
}
const SAID_NO = {
  label: 'Said no',
  means: 'They said no thanks.',
  next: "Nothing to send: a no ends it. They're marked lost so they stay off your lists.",
};

function replyVars(ctx, N, me, offer, rung) {
  const focus = focusOf(ctx, N);
  return {
    me: me.first || me.business || 'the person who messaged you',
    what: plain(focus.what || N.what),
    area: me.area || 'your area',
    rate: rateText(N, offer, rung),
    length: offer.length,
    length_adj: lengthAdj(offer.length),
    person: plain(focus.person || N.person_default || ''),
    result: plain(focus.result || N.result_default || ''),
  };
}

function replyTool(N) {
  const R = N.replies;
  return {
    name: `${N.id}.answer_reply`,
    title: 'Answer a reply',
    description: `What a reply means and a short answer with one next step, from the usual questions and worries in ${N.name.toLowerCase()} (with their sources), saved to your Pipeline so Do my day hands it out.`,
    kind: 'ai',
    tasks: ['write'],
    risk: 'draft',
    needs: [],
    credits: 2,
    timeoutSec: 60,
    input: {
      type: 'object',
      required: ['reply'],
      properties: {
        who: { type: 'string', maxLength: 120, title: R.who_title, description: 'Pick from your Pipeline or type a name' },
        reply: { type: 'string', format: 'textarea', maxLength: 2000, title: 'What they wrote', description: 'Paste their message' },
        price: { type: 'string', maxLength: 10, title: `Your full price per ${N.offer.unit} (optional)`, description: 'Left empty, the price from your Offer builder' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
      },
    },
    output: {
      type: 'object',
      required: ['intent', 'meaning', 'answer', 'next'],
      properties: { intent: { type: 'string' }, label: { type: 'string' }, meaning: { type: 'string' }, answer: { type: 'string' }, next: { type: 'string' }, sources: { type: 'array' }, saved: { type: 'object' }, stop: { type: 'boolean' } },
    },
    async run(input, ctx) {
      const words = plain(input.reply || '').trim();
      if (!words) throw new Error('Paste what they wrote, and you get an answer with one next step.');
      const name = clip(plain(input.who || ''), 120);
      const lead = name ? await findLead(ctx, N.id, name) : null;
      const partner = !!R.partners && (lead ? isPlace(lead) : looksLikeBusiness(name));
      const me = who(ctx, input);
      const offer = offerOf(N, { price: priceOf(ctx, N, input) });
      const rung = await rungOf(ctx, N);
      const v = replyVars(ctx, N, me, offer, rung);
      const set = partner ? R.partners : R.people;
      const worries = partner ? R.partner_objections || [] : R.objections || [];
      let intent = outreach().intentOf(words);
      if (NO_THANKS.test(words) && (intent !== 'stop' || !HARD_STOP.test(words))) intent = 'no';
      const lost = intent === 'stop' || intent === 'no';
      let pick = null;
      let entry;
      let talk = false;
      if (intent === 'stop') entry = R.stop;
      else if (intent === 'no') entry = SAID_NO;
      else {
        pick = worries.find((o) => new RegExp(o.match, 'i').test(words)) || null;
        talk = !pick && !!set.talk && ['yes', 'question', 'other'].includes(intent) && TALK.test(words);
        if (talk) intent = 'talk';
        entry = pick || set[intent] || set.other;
      }
      let answer = lost ? '' : fill(entry.answer, { ...v, when_ask: whenAsk(words) });
      let usedAi = false;
      const tryAi = !pick && !talk && (intent === 'question' || intent === 'other') && words.length > 3;
      if (tryAi) {
        const ready = worries.map((o) => `- ${o.label}: ${fill(o.answer, v)}`).join('\n');
        const facts = [
          `What: ${v.what} in ${v.area}`,
          `Price: ${v.rate}`,
          offer.length ? `Length: ${offer.length}` : '',
          `Includes: ${offer.includes.join('; ')}`,
          `Promise: ${offer.promise}`,
          ...(N.safety || N.rules || []).map((s) => `Rule: ${s}`),
          `How a first booking starts: ${fill(set.yes.answer, v)}`,
        ].filter(Boolean);
        const allowed = new Set(dollarsIn(`${facts.join(' ')} ${ready}`));
        const r = await ai.aiText(ctx, {
          task: 'write',
          system: [
            `You write one short reply that a new ${N.name.toLowerCase()} business owner sends to ${partner ? 'a local place they asked to share their info' : 'a person who answered their message'}.`,
            ...(R.ai_rules || []),
            'Answer what they asked using only the facts given. If a fact is not given, say you will find out instead of guessing.',
            `2 to 4 short sentences. End with one question that offers the next step (${fill(set.question.next, v)}).`,
            'No placeholders, no brackets, no sign-off and no links.',
          ].join(' '),
          prompt: `Their message:\n"${clip(words, 1500)}"\n\nFacts you can use:\n${facts.map((f) => `- ${f}`).join('\n')}\n\nAnswers already written for common worries (use one if it fits):\n${ready || '- none'}`,
          maxTokens: 400,
          fallback: () => answer,
          accept: (t) => t.length >= 20 && t.length <= 700 && !/[[\]{}]|https?:/i.test(t) && ai.cleanCopy(t) && dollarsIn(t).every((d) => allowed.has(d)),
        });
        answer = r.text;
        usedAi = r.ai;
      }
      const today = time.today(ctx);
      const patch = lost
        ? { stage: 'lost', reply: clip(words, 1000), note: `${intent === 'stop' ? 'Asked you to stop' : 'Said no'} on ${time.shortDate(today)}.` }
        : { stage: 'replied', reply: clip(words, 1000), msg: { answer } };
      const saved = name ? await saveLead(ctx, N.id, lead, patch, { name, business: partner, source: `${N.name}: reply` }) : { saved: false };
      return {
        to: name || 'them',
        partner,
        intent: pick ? pick.id : intent,
        label: entry.label,
        meaning: fill(entry.means, v),
        answer,
        next: fill(entry.next, v),
        check: entry.check ? fill(entry.check, v) : '',
        judgment: !!entry.judgment,
        ai: usedAi,
        sources: (entry.sources || []).map((s) => ({ publisher: s.publisher, url: s.url, says: s.says })),
        stop: lost,
        saved,
      };
    },
    view(out) {
      const s = out.saved || {};
      let pipe = '';
      if (s.saved && s.other && behind(s.stage, out.stop ? 'lost' : 'replied')) pipe = `${out.to} is in your Pipeline from another workflow: the reply${out.answer ? ' and this answer are' : ' is'} saved there. Move them to ${out.stop ? 'Lost' : 'Replied'} on that row.`;
      else if (s.saved && out.stop && s.stage && s.stage !== 'lost') pipe = `${out.to} is marked ${STAGE_NAMES[s.stage] || s.stage} in your Pipeline, so this run left them there. Move them to Lost on their row if they want no more messages.`;
      else if (s.saved && out.stop) pipe = `Marked lost in your Pipeline, so ${out.to} stays off your lists.`;
      else if (s.saved) pipe = s.stage && s.stage !== 'replied' ? `Saved to ${out.to}'s row in your Pipeline (stage: ${STAGE_NAMES[s.stage] || s.stage}), with this answer ready in Do my day.` : 'Saved to your Pipeline at Replied, with this answer ready in Do my day.';
      else if (out.to === 'them') pipe = 'Pick them from your Pipeline, or type their name, to save this for Do my day.';
      return views.blocks(
        views.metric(`Reply from ${out.to}`, out.label, out.meaning),
        out.answer ? views.copy('Your answer', out.answer) : views.text("Don't answer this one."),
        views.text(`Next: ${out.next}`),
        out.check ? views.text(`Before you send: ${out.check}`) : null,
        out.ai ? views.text('Written from your offer, prices and rules. Read it once and make it sound like you.') : out.judgment ? views.text('This answer is our judgment, not a sourced fact. Make it sound like you.') : null,
        (out.sources || []).map((x) => views.link(`${x.publisher}: ${x.says}`, x.url)),
        pipe ? views.text(pipe) : null,
      );
    },
  };
}

// ---------- 7. plan a quote (then sales.quote and sales.invoice) ----------
// The line items for one booking at the member's step on the first-clients ladder: a package from
// data/niche.json `quote`, its discount as its own line, an optional extra, and notes that say which
// price this is. The sales pack makes the printable quote and, once they say yes, the invoice.

const RATE_PICKS = ['Auto', 'Founding price', 'Intro price', 'Full price'];
const RATE_IDS = { 'Founding price': 'founding', 'Intro price': 'intro', 'Full price': 'full' };

function rungAt(N, won) {
  const L = N.offer.ladder;
  if (won < L.founding.count) return { id: 'founding', won, left: L.founding.count - won };
  if (won < L.founding.count + L.intro.count) return { id: 'intro', won, left: L.founding.count + L.intro.count - won };
  return { id: 'full', won, left: 0 };
}

function packageOf(N, pick) {
  const Q = N.quote;
  return Q.packages.find((p) => p.pick === pick || p.id === pick) || Q.packages.find((p) => p.id === Q.default) || Q.packages[0];
}
const defaultPick = (N) => packageOf(N, N.quote.default).pick;
const packagePicks = (N) => N.quote.packages.map((p) => p.pick);

// One package at a rung: { each, qty, gross, off, total, unit }. A package priced off the unit price
// (a potty break at 0.75 of a walk) and a package discount round to whole dollars.
function packagePrice(N, offer, rung, pkg, { qty } = {}) {
  const base = rungPrice(offer, rung);
  const factor = pkg.factor || 1;
  const each = factor === 1 ? base : Math.max(1, Math.round(base * factor));
  const n = qty || pkg.qty || 1;
  const gross = round2(each * n);
  const off = Math.round(gross * (pkg.off || 0));
  return { each, qty: n, gross, off, total: round2(gross - off), unit: pkg.unit || N.offer.unit };
}

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;
const RUNG_TAG = { founding: ' (my founding price)', intro: ' (my intro price)', full: '' };

// "4 sessions for $114 (my founding price)" or "$30 per session (my founding price)".
function dealText(pp, rung) {
  const tag = RUNG_TAG[rung.id] || '';
  if (pp.qty <= 1) return `${usd(pp.total)} per ${pp.unit}${tag}`;
  return `${plural(pp.qty, pp.unit)} for ${usd(pp.total)}${tag}`;
}

function rungNote(N, offer, rung) {
  const L = N.offer.ladder;
  if (rung.id === 'founding') return `Founding price for my first ${L.founding.count} ${N.offer.ladder_word || 'clients'}: ${usd(offer.founding)} instead of ${usd(offer.price)} ${offer.per}.`;
  if (rung.id === 'intro') return `Intro price while I build a track record: ${usd(offer.intro)} instead of ${usd(offer.price)} ${offer.per}.`;
  return '';
}

// The lines for one package, as sales.quote and sales.invoice read them: the package, its discount as
// its own line, and an optional extra. A session count other than the package's own keeps the
// package's price per session and discount.
function quoteLines(N, offer, rung, pkg, { forName = '', extra = false, qty } = {}) {
  const Q = N.quote;
  const pp = packagePrice(N, offer, rung, pkg, { qty });
  const custom = qty && qty !== (pkg.qty || 1);
  const items = [{ label: custom ? pkg.label.split(',')[0] : pkg.label, detail: [custom ? '' : pkg.detail, forName ? `For ${forName}` : ''].filter(Boolean).join('. '), qty: pp.qty, unit: pp.unit, price: pp.each }];
  if (pp.off > 0) items.push({ label: `${custom ? 'Package' : pkg.short || 'Package'} discount (${Math.round(pkg.off * 100)} percent)`, detail: 'For booking the whole package at once', qty: 1, unit: '', price: -pp.off });
  let added = null;
  if (extra && Q.extra) {
    const each = Math.max(1, Math.round(rungPrice(offer, rung) * Q.extra.factor));
    const n = Q.extra.per_package ? pp.qty : Q.extra.qty || 1;
    items.push({ label: Q.extra.label, detail: Q.extra.detail, qty: n, unit: pp.unit, price: each });
    added = { label: Q.extra.label, total: round2(each * n) };
  }
  const total = round2(items.reduce((sum, it) => sum + it.qty * it.price, 0));
  return { items, total, pp, extra: added };
}

function quoteTool(N) {
  const Q = N.quote;
  const props = {
    who: { type: 'string', maxLength: 120, title: Q.who_title, description: 'Pick from your Pipeline or type a name' },
    ...(Q.for_title ? { for: { type: 'string', maxLength: 40, title: Q.for_title } } : {}),
    package: { type: 'string', enum: packagePicks(N), default: defaultPick(N), title: 'What they are booking' },
    ...(Q.extra ? { extra: { type: 'boolean', default: false, title: Q.extra.title } } : {}),
    rate: { type: 'string', enum: RATE_PICKS, default: 'Auto', title: 'Price', description: `Auto follows your first-clients ladder: the founding price for your first ${N.offer.ladder.founding.count}, the intro price for the next ${N.offer.ladder.intro.count}, then full price.` },
    price: { type: 'string', maxLength: 10, title: `Your full price per ${N.offer.unit} (optional)`, description: 'Left empty, the price from your Offer builder' },
    contact: { type: 'string', maxLength: 160, title: 'Their email or phone (optional)', description: 'Left empty, what your Pipeline has for them' },
  };
  return {
    name: `${N.id}.plan_quote`,
    title: 'Plan the quote',
    description: `The line items for one booking: a package at your founding, intro or full price per ${N.offer.unit}, the package discount as its own line and an optional extra, ready for the printable quote and the invoice.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: { type: 'object', required: ['who'], properties: props },
    output: { type: 'object', required: ['items', 'customer', 'title', 'next'], properties: { items: { type: 'array' }, customer: { type: 'object' }, title: { type: 'string' }, notes: { type: 'string' }, total: { type: 'number' }, next: { type: 'array' } } },
    async run(input, ctx) {
      const name = clip(plain(input.who || ''), 80);
      if (!name) throw new Error(`Add ${Q.who_title.replace(/^Which /, 'the ').toLowerCase()}'s name for the quote.`);
      const offer = offerOf(N, { price: priceOf(ctx, N, input) });
      const lead = await findLead(ctx, N.id, name);
      const rung = RATE_IDS[input.rate] ? { id: RATE_IDS[input.rate] } : await rungOf(ctx, N);
      const pkg = packageOf(N, input.package);
      const forName = Q.for_title ? firstWord(input.for) : '';
      const { items, total, extra } = quoteLines(N, offer, rung, pkg, { forName, extra: input.extra === true || input.extra === 'true' });
      const notes = clip([rungNote(N, offer, rung), ...(Q.notes || [])].filter(Boolean).join(' '), 1000);
      const links = (lead && lead.links) || {};
      const contact = plain(input.contact || links.email || links.phone || '');
      const customer = { name, ...(contact ? { contact } : {}) };
      const title = clip(fill(Q.title, { for: forName ? ` for ${forName}` : '' }), 120);
      // One Pipeline row per customer: the quote goes on their row in this pack (a new row when
      // they're new), so sales.quote and sales.invoice add none of their own (pipeline: false). A lead
      // another workflow saved keeps its own row.
      let saved = { saved: false, other: !!lead && !isOwn(lead, N.id) };
      if (!saved.other) {
        const patch = { stage: 'replied', note: clip(`Quote for ${usd(total)} (${pkg.label}) made ${time.shortDate(time.today(ctx))}.`, 1000), data: { quote: { package: pkg.id, total, rung: rung.id, on: time.today(ctx) } } };
        if (!lead && contact) {
          if (/@/.test(contact)) patch.links = { email: contact };
          else if (contact.replace(/\D/g, '').length >= 7) patch.links = { phone: contact };
        }
        saved = await saveLead(ctx, N.id, lead, patch, { name, business: looksLikeBusiness(name), source: `${N.name}: quote` });
      }
      return {
        items,
        customer,
        title,
        notes,
        total,
        package: pkg.label,
        extra,
        rung: rung.id,
        price_words: RUNG_WORDS[rung.id],
        next: [
          { label: 'They said yes: make the invoice', invoice: true },
          { label: 'Not yet: keep the quote', invoice: false },
        ],
        saved,
      };
    },
    view(out) {
      return views.blocks(
        views.metric('Quote', usd(out.total), `${out.package}${out.extra ? `, plus ${out.extra.label.toLowerCase()}` : ''}, at your ${out.price_words}. Before any sales tax.`),
        views.table(
          [
            { key: 'label', label: 'Line' },
            { key: 'qty', label: 'Qty', format: 'number' },
            { key: 'price', label: 'Price', format: 'money' },
          ],
          out.items,
        ),
        out.notes ? views.text(`Notes on the quote: ${out.notes}`) : null,
        views.text('Next: the printable quote with the email and text to send. When they say yes, the invoice is made from the same lines.'),
        out.saved && out.saved.saved ? views.text(out.saved.created ? `${out.customer.name} is new in your Pipeline: saved at Replied, with this quote.` : `This quote is saved on ${out.customer.name}'s row in your Pipeline.`) : null,
      );
    },
  };
}

// ---------- 8. a customer said yes ----------
// Logs the win (stage won, so the first-clients ladder moves on), the booking, prep and reminder
// messages, the founding or free note (D24), and a printable first-session checklist with the safety
// rules. Packs call it from the delivery workflow they already have, so there is one "won" step.

const CHECK_CSS = `${SHEET_CSS}
ul.check{list-style:none;padding-left:0;margin:6px 0}ul.check li{position:relative;padding:7px 0 7px 34px;border-bottom:1px solid #eef0f3;line-height:1.45}
ul.check li:before{content:"";position:absolute;left:4px;top:9px;width:15px;height:15px;border:2px solid #5b6475;border-radius:4px}
.facts td:first-child{color:#5b6475;width:34%}.rules{background:#fff8e6;border-radius:10px;padding:10px 16px;margin-top:14px}.rules li{margin:4px 0}`;

const possessive = (s) => (s ? (/s$/i.test(s) ? `${s}'` : `${s}'s`) : '');
const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');

function checklistHtml(N, o) {
  const W = N.win;
  const rows = [
    [text.sentenceCase(W.who_word), o.to],
    W.for_title && o.for ? [W.for_title, o.for] : null,
    [W.when_title, o.when || 'Not set yet'],
    o.where ? [W.where_title || 'Where', o.where] : null,
    ['Booked', `${o.package}: ${o.deal}`],
  ].filter(Boolean);
  const rules = N.safety || N.rules || [];
  const sections = Object.entries(W.checklist)
    .map(([title, items]) => `<h2>${esc(title)}</h2><ul class="check">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`)
    .join('\n');
  const from = [...new Set((W.sources || []).map((s) => s.publisher))];
  const body = `<main>
<p class="muted">${esc(o.business || N.name)}</p>
<h1>${esc(o.title)}</h1>
<table class="facts">${rows.map(([k, val]) => `<tr><td>${esc(k)}</td><td>${esc(val)}</td></tr>`).join('')}</table>
${rules.length ? `<div class="rules"><strong>${esc((N.texts && N.texts.safety_title) || 'Ground rules')}</strong>${li(rules)}</div>` : ''}
${sections}
<footer>${from.length ? `Checklist built from ${esc(text.list(from))} guidance (checked ${esc(N.checked || '')}). ` : ''}Tick each box as you go.</footer>
</main>`;
  return files.htmlDoc({ title: o.title, css: CHECK_CSS, body, description: o.title });
}

function winTool(N) {
  const W = N.win;
  const props = {
    who: { type: 'string', maxLength: 120, title: W.who_title, description: 'Pick from your Pipeline or type a name' },
    ...(W.for_title ? { for: { type: 'string', maxLength: 40, title: W.for_title } } : {}),
    package: { type: 'string', enum: packagePicks(N), default: defaultPick(N), title: 'What they booked' },
    ...(W.sessions ? { sessions: { type: 'string', maxLength: 3, title: 'Sessions agreed (optional)', description: 'Left empty, the number in the package' } } : {}),
    when: { type: 'string', maxLength: 60, title: W.when_title, description: 'Like "Tuesday, Oct 27 at 4pm"' },
    ...(W.where ? { where: { type: 'string', enum: W.where, default: W.where[0], title: W.where_title } } : {}),
    rate: { type: 'string', enum: RATE_PICKS, default: 'Auto', title: 'Price', description: 'Auto follows your first-clients ladder' },
    price: { type: 'string', maxLength: 10, title: `Your full price per ${N.offer.unit} (optional)` },
    ...(W.free_title ? { free: { type: 'boolean', default: false, title: W.free_title } } : {}),
    invoice: { type: 'boolean', default: false, title: 'Make the invoice too', description: 'Leave it off if you already sent the invoice from Send a quote' },
    link: { type: 'string', maxLength: 300, title: 'Booking or payment link (optional)' },
    business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
    phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
  };
  return {
    name: `${N.id}.${W.tool}`,
    title: W.title,
    description: W.description,
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: { type: 'object', properties: props },
    output: {
      type: 'object',
      required: ['messages', 'checklist'],
      properties: { messages: { type: 'array' }, checklist: { type: 'object' }, saved: { type: 'object' }, price_text: { type: 'string' }, price_note: { type: 'string' }, sessions_text: { type: 'string' }, invoice: { type: 'boolean' }, items: { type: 'array' }, customer: { type: 'object' } },
    },
    async run(input, ctx) {
      const name = clip(plain(input.who || ''), 120);
      if (!name) throw new Error(`Add the ${W.who_word}'s name (pick them from your Pipeline) to log the win.`);
      const me = who(ctx, input);
      const offer = offerOf(N, { price: priceOf(ctx, N, input) });
      const lead = await findLead(ctx, N.id, name);
      const already = !!(lead && lead.stage === 'won' && (isOwn(lead, N.id) || booked.ids(ctx, N.id).includes(lead.id)));
      const count = await rungOf(ctx, N);
      const rung = RATE_IDS[input.rate] ? { id: RATE_IDS[input.rate] } : rungAt(N, Math.max(0, count.won - (already ? 1 : 0)));
      const pkg = packageOf(N, input.package);
      const free = !!W.free_title && (input.free === true || input.free === 'true');
      const n = parseInt(input.sessions, 10);
      const greet = firstWord(name);
      const forName = W.for_title ? firstWord(input.for) : '';
      const lines = quoteLines(N, offer, rung, pkg, { forName, qty: W.sessions && Number.isFinite(n) && n > 0 ? Math.min(52, n) : undefined });
      const pp = lines.pp;
      const forWord = forName || W.for_default || '';
      const where = W.where ? plain(input.where || W.where[0]) : '';
      const when = plain(input.when || '');
      const deal = free ? `${plural(pp.qty, pp.unit)}, free, as a founding ${W.who_word}` : dealText(pp, rung);
      const v = {
        greet,
        for: forWord,
        for_s: possessive(forWord),
        For_s: text.sentenceCase(possessive(forWord)),
        when: when || 'at the time we agreed',
        where: where ? `, ${lowerFirst(where)}` : '',
        deal,
        pay: me.link ? ` You can book and pay here: ${me.link}` : '',
      };
      const messages = [
        { label: 'Booking message', when: 'Send now', text: fill(W.booking, v) },
        { label: 'Prep message', when: 'With the booking, or the day after', text: fill(W.prep, v) },
        { label: 'Reminder', when: 'The day before', text: fill(W.reminder, v) },
      ];
      const notes = [];
      if (free && W.free) notes.push(fill(W.free, v));
      else if (rung.id === 'founding' && W.founding) notes.push(fill(W.founding, v));
      const today = time.today(ctx);
      const title = fill(W.checklist_title, { for_title: forName || greet, greet });
      const html = checklistHtml(N, { to: name, for: forName, when, where, package: pkg.label, deal, business: me.business, title });
      const checklist = await save.saveFile(ctx, save.fileName(forName || greet, W.file_word, '.html'), html);
      const patch = {
        stage: 'won',
        ...(lead && isPlace(lead) ? {} : { warm: true }),
        note: clip(`${pkg.label}: ${deal}. First ${N.offer.unit} ${v.when}.`, 1000),
        data: { deal: { package: pkg.id, each: pp.each, qty: pp.qty, total: free ? 0 : pp.total, rung: free ? 'free' : rung.id, first: when, for: forName, on: today } },
      };
      const saved = await saveLead(ctx, N.id, lead, patch, { name, source: `${N.name}: new ${W.who_word}` });
      // Another pack's lead that moved to won (contract v1.5) counts on this pack's ladder from now on.
      if (saved.other && saved.stage === 'won') await booked.add(ctx, N.id, lead.id);
      return {
        to: name,
        greet,
        for: forName,
        package: pkg.label,
        deal,
        free,
        rung: rung.id,
        number: rung.id === 'founding' && !already && !free && !RATE_IDS[input.rate] ? count.won + 1 : null,
        sessions: pp.qty,
        sessions_text: String(pp.qty),
        invoice: !free && (input.invoice === true || input.invoice === 'true'),
        items: lines.items,
        customer: { name, ...(lead && lead.links && (lead.links.email || lead.links.phone) ? { contact: lead.links.email || lead.links.phone } : {}) },
        title: clip(fill(N.quote.title, { for: forName ? ` for ${forName}` : '' }), 120),
        invoice_notes: clip([free ? '' : rungNote(N, offer, rung), ...(N.quote.notes || [])].filter(Boolean).join(' '), 1000),
        price_text: free ? '' : String(pp.each),
        price_note: free ? 'free' : RUNG_WORDS[rung.id],
        messages,
        notes,
        checklist,
        sources: (W.sources || []).map((s) => ({ publisher: s.publisher, url: s.url, says: s.says })),
        saved,
      };
    },
    view(out) {
      const s = out.saved || {};
      let logged = 'Not saved to your Pipeline in this run.';
      if (s.saved && s.other && s.stage !== 'won') logged = `${out.to} is in your Pipeline from another workflow: mark them won on that row.`;
      else if (s.saved && s.stage && s.stage !== 'won') logged = `${out.to} is marked ${STAGE_NAMES[s.stage] || s.stage} in your Pipeline, so this run couldn't move them: change them to Won on their row.`;
      else if (s.saved) logged = `Logged as won in your Pipeline${out.number ? `: founding ${W.who_word} ${out.number} of ${N.offer.ladder.founding.count}` : ''}.`;
      return views.blocks(
        views.metric(`New ${W.who_word}`, out.greet, `${out.package}: ${out.deal}`),
        views.text(logged),
        out.messages.map((m) => views.copy(`${m.label} (${m.when})`, m.text)),
        out.notes.map((x) => views.text(x)),
        views.file(out.checklist, `${text.sentenceCase(W.file_word)} (print it)`),
        (out.sources || []).map((x) => views.link(`${x.publisher}: ${x.says}`, x.url)),
      );
    },
  };
}

// ---------- 9. show your work ----------
// A story from typed words only. The draft step writes the permission ask with the exact words, the
// honest review ask (nothing attached) and both versions; the workflow then waits for the client's
// written yes (an approve step), and only then makes the card and caption. A founding or free deal is
// said plainly on the card, the case study and the caption (D24, FTC 16 CFR 255.5).

const DEALS = ['Full price', 'Founding price', 'Free'];
const CARD_W = 1080;
const CARD_H = 1350;
const PALETTE = { tutoring: '#2a5bd7', petcare: '#2a7a5c', coaching: '#5b43b5', resale: '#b8460b' };

// A 1080 x 1350 card from typed words: a band with the business, an optional photo, the big line,
// smaller lines, an attribution, a disclosure box and a footer. Every word comes from the member.
function cardSvg({ color = '#2a5bd7', business = '', area = '', badge = '', photo = null, big = '', quote = false, lines = [], attribution = '', disclosure = '', foot = '' }) {
  const S = svgKit();
  const W = CARD_W;
  const H = CARD_H;
  const pad = 80;
  const inner = W - pad * 2;
  const safe = inner - 40; // the width estimate runs a little narrow for Inter: wrap with room to spare
  const bandH = 170;
  const footH = 110;
  const body = [];
  body.push(S.rect({ x: 0, y: 0, w: W, h: H, fill: '#f8f6f1' }));
  body.push(S.rect({ x: 0, y: 0, w: W, h: bandH, fill: color }));
  let badgeW = 0;
  if (badge) {
    const probe = S.pill({ x: 0, y: 0, label: badge, size: 30, weight: 800 });
    badgeW = probe.width + 24;
    body.push(S.pill({ x: W - pad - probe.width, y: 58, label: badge, size: 30, weight: 800, fill: '#ffffff', color }).svg);
  }
  const head = S.fit(business || ' ', { width: safe - badgeW, height: 64, maxSize: 50, minSize: 26, maxLines: 1, weight: 800 });
  body.push(S.text({ x: pad, y: area ? 88 : 104, lines: head.lines, size: head.size, weight: 800, fill: '#ffffff' }));
  if (area) body.push(S.text({ x: pad, y: 134, lines: [clip(area, 60)], size: 28, weight: 500, fill: '#ffffff', opacity: 0.85 }));
  let top = bandH + 56;
  if (photo) {
    body.push(S.image({ x: 0, y: bandH, w: W, h: 620, data: photo, type: 'image/png' }));
    top = bandH + 620 + 48;
  }
  // The disclosure box sits just above the footer, so it is never cut off or crowded out.
  const discLines = disclosure ? S.wrap(disclosure, { width: safe - 48, size: 28, weight: 600 }).slice(0, 3) : [];
  const discH = discLines.length ? discLines.length * 36 + 36 : 0;
  const bottom = H - footH - (discH ? discH + 36 + 40 : 48);
  const lineLH = 42;
  const blocks = lines.filter(Boolean).map((l) => S.wrap(l, { width: safe, size: 32, weight: 500 }).slice(0, 3));
  const linesH = blocks.reduce((n, bl) => n + 30 + bl.length * lineLH, 0);
  const attrH = attribution ? 74 : 0;
  const avail = bottom - top;
  const bigText = quote ? `\u201C${big}\u201D` : big;
  const fitted = S.fit(bigText, { width: safe, height: Math.max(90, avail - linesH - attrH), maxSize: photo ? 56 : 80, minSize: 28, maxLines: photo ? 4 : 8, weight: 700, lineHeight: 1.2 });
  const bigLH = Math.round(fitted.size * 1.2);
  const total = fitted.lines.length * bigLH + linesH + attrH;
  // Centered in the space between the band (or photo) and the disclosure, a little above the middle.
  let y = top + Math.max(0, Math.round((avail - total) * 0.42));
  body.push(S.text({ x: pad, y: y + Math.round(fitted.size * 0.92), lines: fitted.lines, size: fitted.size, weight: 700, fill: '#1d2433', lineHeight: 1.2 }));
  y += fitted.lines.length * bigLH;
  for (const bl of blocks) {
    y += 30;
    body.push(S.text({ x: pad, y: y + 32, lines: bl, size: 32, weight: 500, fill: '#3b4250', lineHeight: lineLH / 32 }));
    y += bl.length * lineLH;
  }
  if (attribution) {
    y += 40;
    body.push(S.rect({ x: pad, y: y + 12, w: 36, h: 6, r: 3, fill: color }));
    body.push(S.text({ x: pad + 52, y: y + 24, lines: [clip(attribution, 60)], size: 30, weight: 700, fill: '#1d2433' }));
  }
  if (discLines.length) {
    const boxY = H - footH - 40 - discH;
    body.push(S.rect({ x: pad, y: boxY, w: inner, h: discH, r: 14, fill: '#ffffff', stroke: color, strokeWidth: 3 }));
    body.push(S.text({ x: pad + 24, y: boxY + 18 + 28, lines: discLines, size: 28, weight: 600, fill: '#1d2433', lineHeight: 1.29 }));
  }
  body.push(S.rect({ x: 0, y: H - footH, w: W, h: footH, fill: '#1d2433' }));
  if (foot) {
    const f = S.fit(foot, { width: safe, height: 50, maxSize: 36, minSize: 22, maxLines: 1, weight: 700 });
    body.push(S.text({ x: pad, y: H - footH / 2 + f.size * 0.35, lines: f.lines, size: f.size, weight: 700, fill: '#ffffff' }));
  }
  return S.doc({ width: W, height: H, body: body.join(''), title: clip(big, 80) });
}

// Saves a card: a PNG when rendering is available, else the SVG itself (the Library keeps both).
async function saveCard(ctx, svgString, baseName) {
  if (media().canRender(ctx)) {
    try {
      const png = await media().svgToPng(ctx, svgString, { width: CARD_W, height: CARD_H });
      return { asset: await save.saveFile(ctx, `${baseName}.png`, png, 'image/png'), png: true };
    } catch (e) {
      if (ctx && ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
      if (ctx && typeof ctx.log === 'function') ctx.log(`Card render failed, saving the SVG: ${scrubbed(e)}`);
    }
  }
  return { asset: await save.saveFile(ctx, `${baseName}.svg`, svgString, 'image/svg+xml'), png: false };
}

// A photo from the member's Library, cropped to the card's photo area (needs rendering).
async function photoFor(ctx, id, { width = CARD_W, height = 620 } = {}) {
  if (!id || !ctx || typeof ctx.asset !== 'function' || !media().canRender(ctx)) return null;
  try {
    const a = await ctx.asset(id);
    return await media().frame(ctx, a.path, { width, height });
  } catch (e) {
    if (ctx && ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
    if (ctx && typeof ctx.log === 'function') ctx.log(`Couldn't use the photo: ${scrubbed(e)}`);
    return null;
  }
}

function reachOf(me) {
  if (me.phone) return `call or text ${me.phone}.`;
  if (me.link) return `book at ${me.link}.`;
  return 'send me a message.';
}

function storyTool(N) {
  const S = N.story;
  const props = {
    who: { type: 'string', maxLength: 120, title: S.who_title, description: 'Pick from your Pipeline or type a name' },
    ...(S.for_title ? { for: { type: 'string', maxLength: 40, title: S.for_title, description: `Like "${S.for_example}"` } } : {}),
    what: { type: 'string', maxLength: 200, title: 'What you did together', description: `Like "${S.what_example}"` },
    result: { type: 'string', maxLength: 300, title: 'What changed, as they told you', description: `Like "${S.result_example}". Only what they said, and no numbers they didn't give you.` },
    quote: { type: 'string', maxLength: 300, title: 'Their own words (optional)', description: `Word for word from a text or email, like "${S.quote_example}"` },
    deal: { type: 'string', enum: DEALS, default: 'Full price', title: 'What they paid', description: 'A founding or free deal is said plainly wherever the story appears' },
    ...(S.photo ? { photo: { type: 'string', format: 'asset', accept: 'image/*', title: 'A photo (optional)', description: 'Only with their okay. JPG or PNG.' } } : {}),
    business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
  };
  return {
    name: `${N.id}.draft_story`,
    title: 'Draft the story',
    description: 'A short story from what you typed, the exact words to ask permission with, and an honest review ask with nothing attached. Nothing is shared until they say yes in writing.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: { type: 'object', required: ['what', 'result'], properties: props },
    output: { type: 'object', required: ['stories', 'consent', 'review', 'choices'], properties: { stories: { type: 'object' }, consent: { type: 'string' }, review: { type: 'string' }, choices: { type: 'array' } } },
    async run(input, ctx) {
      const me = who(ctx, input);
      const forName = S.for_title ? firstWord(input.for) : '';
      // Tutoring never names the student: their name becomes "my student" everywhere in the story.
      const hideName = forName.replace(/[^\w]/g, '');
      const hideRe = S.hide_for && hideName.length > 1 ? new RegExp(`\\b${hideName}('s)?\\b`, 'gi') : null;
      const hide = (t) => (hideRe ? String(t).replace(hideRe, (m, s2) => (s2 ? possessive(S.hide_for) : S.hide_for)) : String(t));
      const what = hide(plain(input.what || '').replace(/[.]$/, ''));
      const result = hide(plain(input.result || '').replace(/[.]$/, ''));
      if (!what || !result) throw new Error('Add what you did together and what changed, in their words.');
      const greet = firstWord(input.who);
      const rawQuote = plain(input.quote || '').replace(/^["“]|["”]$/g, '').trim();
      const quoteDropped = !!(hideRe && rawQuote && new RegExp(hideRe.source, 'i').test(rawQuote));
      const quote = quoteDropped ? '' : rawQuote;
      const deal = DEALS.includes(input.deal) ? input.deal : 'Full price';
      const tpl = (t) => (me.area ? t : String(t).replace(/,? in \{area\}/, ''));
      const pet = forName || 'your dog';
      const v = { greet: greet || 'there', area: me.area, for: pet, for_s: possessive(pet) };
      const attr = { anon: fill(tpl(S.anon), v), named: greet ? fill(tpl(S.named), { ...v, for_s: forName ? possessive(forName) : 'a dog' }) : fill(tpl(S.anon), v) };
      // "This family paid a founding price." / "Jordan received free coaching sessions."
      const whoFor = (share) => (share === 'named' && greet ? greet : 'This client');
      const disclosureFor = (share) => (deal === 'Founding price' ? fill(S.disclosure.founding, { who: whoFor(share) }) : deal === 'Free' ? fill(S.disclosure.free, { who: whoFor(share) }) : '');
      const short = (share) => [`${attr[share]}: ${sentence(what)}`, text.sentenceCase(sentence(result)), quote ? `“${text.sentenceCase(sentence(quote))}”` : '', disclosureFor(share)].filter(Boolean).join(' ');
      const stories = { anon: short('anon'), named: short('named') };
      const caseStudy = (share) =>
        [`Who: ${attr[share]}`, `What we did: ${text.sentenceCase(sentence(what))}`, `What changed: ${text.sentenceCase(sentence(result))}`, quote ? `In their words: “${text.sentenceCase(sentence(quote))}”` : '', disclosureFor(share)].filter(Boolean).join('\n');
      const photoLine = S.photo && input.photo ? `${fill(S.photo_line, v)} ` : '';
      const consent = fill(S.consent, { ...v, story: stories.anon, photo_line: photoLine });
      const review = fill(S.review, v);
      let saved = { saved: false };
      const name = clip(plain(input.who || ''), 120);
      const lead = name ? await findLead(ctx, N.id, name) : null;
      if (lead && isOwn(lead, N.id)) saved = await saveLead(ctx, N.id, lead, { data: { story: { asked: time.today(ctx), deal } } });
      return {
        greet,
        for: forName,
        what,
        result,
        quote,
        quote_dropped: quoteDropped,
        deal,
        attr,
        stories,
        cases: { anon: caseStudy('anon'), named: caseStudy('named') },
        disclosure: { anon: disclosureFor('anon'), named: disclosureFor('named') },
        consent,
        review,
        rules: S.rules || [],
        business: plain(input.business || me.business || ''),
        choices: [
          { label: 'Yes, in writing, without their name', share: 'anon' },
          { label: 'Yes, in writing, with their first name', share: 'named' },
          { label: 'Not yet', share: '' },
        ],
        saved,
      };
    },
    view(out) {
      return views.blocks(
        views.text(`Rules: ${out.rules.join(' ')}`),
        out.quote_dropped ? views.text("Their quote names your student, so it's left out. Ask them for a line without the name.") : null,
        views.copy('1. Ask first, with the exact words', out.consent),
        views.copy('2. Honest review ask (send it to every client, whatever they say about the story)', out.review),
        out.greet ? views.copy('The story with their first name, if they prefer it', out.stories.named) : null,
        views.text('The card and caption are made after they say yes in writing.'),
      );
    },
  };
}

function storyCardTool(N) {
  const S = N.story;
  return {
    name: `${N.id}.make_story_card`,
    title: 'Story card and caption',
    description: `A 1080 x 1350 card from the approved words${S.photo ? ' (with their photo if you add one)' : ''}, the case study and a post caption, with the founding or free line when it applies.`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['render'],
    credits: 2,
    timeoutSec: 120,
    input: {
      type: 'object',
      required: ['draft'],
      properties: {
        draft: { type: 'object', title: 'The story from the draft step' },
        share: { type: 'string', enum: ['anon', 'named'], default: 'anon', title: 'Name on it' },
        ...(S.photo ? { photo: { type: 'string', format: 'asset', accept: 'image/*', title: 'A photo (optional)' } } : {}),
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
        link: { type: 'string', maxLength: 300, title: 'Booking link (optional)' },
      },
    },
    output: { type: 'object', required: ['card', 'caption'], properties: { card: { type: 'object' }, caption: { type: 'string' }, case_study: { type: 'string' } } },
    async run(input, ctx) {
      const d = input.draft || {};
      if (!d.stories || !d.attr) throw new Error('Draft the story first.');
      const share = input.share === 'named' ? 'named' : 'anon';
      const me = who(ctx, input);
      const focus = focusOf(ctx, N);
      const v = { what: plain(focus.what || N.what), person: plain(focus.person || N.person_default || ''), result: plain(focus.result || N.result_default || ''), reach: reachOf(me) };
      const caption = fill(S.caption, { ...v, story_line: d.stories[share] });
      const photo = S.photo ? await photoFor(ctx, input.photo) : null;
      const business = d.business || me.business || N.name;
      const svgString = cardSvg({
        color: PALETTE[N.id] || '#2a5bd7',
        business,
        area: me.area,
        big: d.quote || text.sentenceCase(sentence(d.result)),
        quote: !!d.quote,
        lines: [text.sentenceCase(sentence(d.what)), d.quote ? text.sentenceCase(sentence(d.result)) : ''],
        attribution: d.attr[share],
        disclosure: d.disclosure ? d.disclosure[share] : '',
        foot: me.phone ? `Call or text ${me.phone}` : me.link ? me.link.replace(/^https:\/\//, '') : business,
        photo,
      });
      const saved = await saveCard(ctx, svgString, save.fileName(share === 'named' && d.greet ? d.greet : 'client', 'story card'));
      return {
        card: saved.asset,
        png: saved.png,
        photo: !!photo,
        caption,
        case_study: (d.cases && d.cases[share]) || d.stories[share],
        share,
      };
    },
    view(out) {
      return views.blocks(
        views.image(out.card, out.png ? 'Story card (1080 x 1350)' : 'Story card (SVG: open it in your browser to save or share it)'),
        views.copy('Caption', out.caption),
        views.copy('Case study (the words they approved)', out.case_study),
        views.text('Post only what they approved. If they ask you to take it down, take it down the same day.'),
      );
    },
  };
}

// ---------- 10. look ready ----------
// The facts for a one-page site (site pack), a Google profile kit and a flyer or door hanger (local
// pack), worded once from the member's real prices, offer and promise so all three match. Nothing
// invented: no reviews, years or numbers the member didn't give. The founding offer goes on the
// flyer and in messages, not on a site that stays up after the first clients.

// "Tutoring sessions, block of 4, $171" (the local pack reads the price at the end of the line).
function serviceLines(N, offer) {
  const full = { id: 'full' };
  return N.quote.packages.map((p) => {
    const pp = packagePrice(N, offer, full, p);
    const price = pp.qty > 1 ? usd(pp.total) : `${usd(pp.each)} per ${pp.unit}`;
    return { short: `${p.label}, ${price}`, long: `${p.label}, ${price}, ${lowerFirst(p.detail)}` };
  });
}

function readyTool(N) {
  const Y = N.ready;
  const online = Y.google === false;
  return {
    name: `${N.id}.ready_facts`,
    title: 'Gather your facts',
    description: 'Your services and prices, offer, promise and contact details, worded once for your website, your Google profile kit and your flyer, so all three match.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        city: { type: 'string', maxLength: 80, title: 'Your city and state', description: 'Like "Columbus, OH"' },
        areas: { type: 'string', maxLength: 600, title: 'Towns or neighborhoods you serve (optional)' },
        business: { type: 'string', maxLength: 80, title: 'Business name' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
        email: { type: 'string', maxLength: 120, title: 'Your email (optional)' },
        link: { type: 'string', maxLength: 300, title: 'Booking link (optional)' },
        about: { type: 'string', maxLength: 600, title: 'About you, in your words (optional)' },
        color: { type: 'string', maxLength: 7, title: 'Brand color (optional)' },
        price: { type: 'string', maxLength: 10, title: `Your full price per ${N.offer.unit} (optional)` },
        ...(online ? { in_person: { type: 'boolean', default: false, title: 'I also meet clients in person' } } : {}),
      },
    },
    output: { type: 'object', required: ['site', 'gbp', 'flyer'], properties: { site: { type: 'object' }, gbp: { type: 'object' }, flyer: { type: 'object' }, google: { type: 'boolean' }, print: { type: 'boolean' }, services: { type: 'string' }, steps: { type: 'array' } } },
    async run(input, ctx) {
      const me = who(ctx, input);
      const offer = offerOf(N, { price: priceOf(ctx, N, input) });
      const focus = focusOf(ctx, N);
      const what = plain(focus.what || N.what);
      const fv = { area: me.area || 'your area', person: plain(focus.person || N.person_default || ''), result: plain(focus.result || N.result_default || '') };
      const inPerson = online ? input.in_person === true || input.in_person === 'true' : true;
      const lines = serviceLines(N, offer);
      const L = N.offer.ladder;
      const offerLine = `First ${L.founding.count} ${N.offer.ladder_word || 'clients'}: ${usd(offer.founding)} ${offer.per} instead of ${usd(offer.price)}`;
      const [cityName, regionName] = me.city.split(',').map((s) => s.trim());
      const areas = plain(input.areas || '') || (inPerson ? cityName || '' : 'Online');
      const email = String(input.email || '').trim();
      const color = /^#[0-9a-f]{6}$/i.test(String(input.color || '').trim()) ? String(input.color).trim() : PALETTE[N.id] || '';
      const site = {
        business: me.business,
        what,
        city: cityName || '',
        region: regionName || '',
        area: areas.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean).slice(0, 6).join(', '),
        services: lines.map((l) => l.long).join('\n'),
        included: [offer.promise, ...offer.includes.slice(0, 3)].join('\n'),
        tagline: fill(Y.tagline, fv),
        promise: offer.promise,
        phone: me.phone,
        email,
        booking: me.link,
        color,
        owner: me.first,
        ...(input.about ? { about: clip(plain(input.about), 600) } : {}),
      };
      const biz = { business: me.business, what, city: cityName || '', region: regionName || '', phone: me.phone, email, booking: me.link, color, services: lines.map((l) => l.short).join('\n'), firstName: me.first, group: Y.group };
      const cta = me.phone ? `Call or text ${me.phone}` : me.link ? Y.cta : 'Call or text to book';
      // A flyer stays up for months, so it carries the niche's standing offer (a free first call),
      // not the founding price, which ends after the first clients (local.flyer's `offer` wins).
      const flyerOffer = clip(Y.offer || offerLine, 60);
      const flyer = {
        ...biz,
        copy: { headline: fill(Y.headline, fv), sub: fill(Y.sub, fv), bullets: Y.bullets, offerText: flyerOffer, cta: clip(cta, 32) },
        offer: flyerOffer,
        area: me.area || '',
        format: Y.format,
      };
      const steps = [
        'Website: open the preview, check every line, then drag the ZIP onto Netlify Drop (the steps are in its README).',
        inPerson
          ? 'Google profile: claim it at business.google.com as a service-area business (you can hide your home address), then paste the description, services and first post from the kit.'
          : 'Google profile: skipped, because Google profiles are for businesses that meet customers in person. Tick "I also meet clients in person" if you do.',
        Y.print ? (Y.format === 'door_hanger' ? 'Door hangers: print 25 for your own streets. Hang them on doors, never in mailboxes.' : 'Flyer: print 20 and ask before you pin one up: libraries, community centers and coffee shops each have their own rules.') : '',
      ].filter(Boolean);
      return { site, gbp: { ...biz, areas }, flyer, google: inPerson, print: !!Y.print, services: site.services, offer: offerLine, steps };
    },
    view(out) {
      return views.blocks(
        views.text(`Your founding offer${out.print ? ' on the flyer and in your messages' : ' in your messages'}: ${out.offer}.`),
        views.copy('Your services and prices, as they appear', out.services),
        views.text(`Then: ${out.steps.join(' ')}`),
      );
    },
  };
}

// ---------- 11. the workflows these packs share ----------
// Each pack lists them in its own order (first 25, offer, reply, quote, the yes step, keep, proof,
// next 25, look ready) with its own promises and next steps. Other packs' tools are composed by name:
// sales.quote and sales.invoice, site.build, local.gbp_kit and local.flyer.

const pipelinePick = (title, description) => ({ type: 'string', maxLength: 120, title, ...(description ? { description } : {}), options: 'pipeline' });
const passInputs = (keys) => Object.fromEntries(keys.map((k) => [k, `$inputs.${k}`]));
const CONTACT = {
  business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
  phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
  link: { type: 'string', maxLength: 300, title: 'Booking link (optional)' },
};
const CITY = { type: 'string', maxLength: 80, title: 'Your city and state', description: 'Like "Columbus, OH"' };
const MONDAYS = { cron: '0 7 * * 1', label: 'Every Monday at 7am' };

function replyWorkflow(N, t, { promise, next }) {
  const p = t.reply.input.properties;
  return {
    id: `${N.id}.reply`,
    title: 'Answer a reply',
    promise,
    minutes: 3,
    tier: 'builder',
    job: 'sales',
    inputs: {
      type: 'object',
      required: ['reply'],
      properties: { who: pipelinePick(N.replies.who_title, 'Pick from your Pipeline or type their name'), reply: p.reply, price: p.price, business: p.business },
    },
    steps: [{ id: 'answer', tool: t.reply.name, input: passInputs(['who', 'reply', 'price', 'business']) }],
    result: ['answer'],
    next,
  };
}

function quoteWorkflow(N, t, { promise, next }) {
  const p = t.quote.input.properties;
  const keys = Object.keys(p);
  return {
    id: `${N.id}.quote`,
    title: 'Send a quote',
    promise,
    minutes: 5,
    tier: 'builder',
    job: 'sales',
    inputs: {
      type: 'object',
      required: ['who'],
      properties: {
        ...p,
        who: pipelinePick(N.quote.who_title, 'Pick from your Pipeline or type their name'),
        deposit: { type: 'string', maxLength: 20, title: 'Deposit to book (optional)', description: '"25%" or "$50"' },
        payWhen: { type: 'string', enum: ['When the work is done', 'When they book', 'Each month, in advance'], default: ['When the work is done', 'When they book', 'Each month, in advance'].includes(N.quote.pay_when) ? N.quote.pay_when : 'When the work is done', title: 'With no deposit, they pay' },
        payLink: { type: 'string', maxLength: 300, title: 'Your payment link (optional)', description: 'Stripe, Square or PayPal.Me. Buyers pay you directly.' },
      },
    },
    steps: [
      { id: 'plan', tool: t.quote.name, input: passInputs(keys) },
      { id: 'quote', tool: 'sales.quote', input: { items: '$plan.items', customer: '$plan.customer', title: '$plan.title', notes: '$plan.notes', deposit: '$inputs.deposit', payWhen: '$inputs.payWhen', payLink: '$inputs.payLink', pipeline: false } },
      { id: 'yes', approve: { title: 'Did they say yes?', note: 'Pick yes when they book: the invoice is made from this quote. Then log the booking (the next step), so your Pipeline moves them to won.', choose: '$plan.next', label: 'label', max: 1 } },
      { id: 'invoice', tool: 'sales.invoice', when: '$yes.chosen.0.invoice', input: { quote: '$quote', payLink: '$inputs.payLink', pipeline: false } },
    ],
    result: ['plan', 'quote', 'invoice'],
    next,
  };
}

// The win step and its invoice, for a pack's own delivery workflow: steps that run when `flag` is on.
function winSteps(t, { flag, input }) {
  return [
    { id: 'log', tool: t.win.name, ...(flag ? { when: flag } : {}), input },
    { id: 'invoice', tool: 'sales.invoice', when: '$log.invoice', input: { items: '$log.items', customer: '$log.customer', title: '$log.title', notes: '$log.invoice_notes', dueDays: 0, pipeline: false } },
  ];
}

function proofWorkflow(N, t, { promise, next }) {
  const p = t.story.input.properties;
  const keys = Object.keys(p);
  return {
    id: `${N.id}.proof`,
    title: 'Show your work',
    promise,
    minutes: 5,
    tier: 'builder',
    job: 'content',
    inputs: {
      type: 'object',
      required: ['what', 'result'],
      properties: { ...p, who: pipelinePick(N.story.who_title, 'Only their first name is ever shown, and only with their yes'), phone: CONTACT.phone, link: CONTACT.link },
    },
    steps: [
      { id: 'draft', tool: t.story.name, input: passInputs(keys) },
      {
        id: 'ok',
        approve: { title: 'Did they say yes to sharing, in writing?', note: 'Send them the permission ask first. Pick yes only when you have their yes in a text or email. Not yet keeps the draft and the review ask, and makes no card.', choose: '$draft.choices', label: 'label', max: 1 },
        optional: true,
      },
      { id: 'card', tool: t.card.name, when: '$ok.chosen.0.share', input: { draft: '$draft', share: '$ok.chosen.0.share', ...(N.story.photo ? { photo: '$inputs.photo' } : {}), phone: '$inputs.phone', link: '$inputs.link' } },
    ],
    result: ['draft', 'card'],
    next,
  };
}

function next25Workflow(N, t, { promise, next, minutes = 15 }) {
  const p = t.next.input.properties;
  const keys = Object.keys(p);
  return {
    id: `${N.id}.next_25`,
    title: 'Your next 25',
    promise,
    minutes,
    tier: 'builder',
    job: 'leads',
    suggestSchedule: MONDAYS,
    inputs: { type: 'object', properties: p },
    steps: [{ id: 'batch', tool: t.next.name, input: passInputs(keys) }],
    result: ['batch'],
    next,
  };
}

function readyWorkflow(N, t, { promise, next }) {
  const p = t.ready.input.properties;
  const keys = Object.keys(p);
  const biz = (from) => Object.fromEntries(['business', 'what', 'city', 'region', 'phone', 'email', 'booking', 'color', 'services', 'firstName', 'group'].map((k) => [k, `$facts.${from}.${k}`]));
  const steps = [
    { id: 'facts', tool: t.ready.name, input: passInputs(keys) },
    { id: 'site', tool: 'site.build', input: { facts: '$facts.site', design: N.ready.design, for: 'me' } },
    { id: 'profile', tool: 'local.gbp_kit', ...(N.ready.google === false ? { when: '$facts.google' } : {}), input: { ...biz('gbp'), areas: '$facts.gbp.areas' } },
  ];
  if (N.ready.print) steps.push({ id: 'flyer', tool: 'local.flyer', input: { ...biz('flyer'), copy: '$facts.flyer.copy', offer: '$facts.flyer.offer', area: '$facts.flyer.area', formats: N.ready.format, campaign: 'ready' } });
  return {
    id: `${N.id}.ready`,
    title: 'Look ready',
    promise,
    minutes: 15,
    tier: 'builder',
    job: 'site',
    inputs: { type: 'object', properties: { ...p, city: CITY, about: { ...p.about, format: 'textarea', description: 'Two or three true sentences. Left empty, the site writes a plain one from your facts.' } } },
    steps,
    result: steps.map((s) => s.id),
    next,
  };
}

module.exports = {
  // 1
  load,
  fill,
  linesOf,
  monthOf,
  crowdCard,
  who,
  priceOf,
  firstWord,
  sentence,
  clip,
  clamp,
  round2,
  // 2
  POSITIONS,
  SHEET_CSS,
  li,
  offerOf,
  offerSheet,
  offerText,
  offerTool,
  // 3
  keepTool,
  // 4
  norm,
  keyFor,
  placeKey,
  looksLikeBusiness,
  canSave,
  everyone,
  findLead,
  isOwn,
  isPlace,
  mergeData,
  saveLead,
  saveRows,
  personLead,
  placeLead,
  rungOf,
  rungAt,
  rungPrice,
  rateText,
  rateShort,
  RUNG_WORDS,
  // 5
  roundRobin,
  householdRows,
  householdCsv,
  first25Tool,
  batchOf,
  isKnown,
  focusOf,
  whatOf,
  freshPlaces,
  next25Tool,
  BATCH_MIN,
  BATCH_MAX,
  BATCH_DEFAULT,
  // 6
  NO_THANKS,
  dollarsIn,
  lengthAdj,
  replyVars,
  replyTool,
  // 7
  RATE_PICKS,
  RATE_IDS,
  packageOf,
  packagePicks,
  defaultPick,
  packagePrice,
  dealText,
  rungNote,
  plural,
  quoteLines,
  quoteTool,
  // 8
  possessive,
  checklistHtml,
  winTool,
  // 9
  DEALS,
  PALETTE,
  CARD_W,
  CARD_H,
  cardSvg,
  saveCard,
  photoFor,
  reachOf,
  storyTool,
  storyCardTool,
  // 10
  serviceLines,
  readyTool,
  // 11
  pipelinePick,
  passInputs,
  CONTACT,
  CITY,
  MONDAYS,
  replyWorkflow,
  quoteWorkflow,
  winSteps,
  proofWorkflow,
  next25Workflow,
  readyWorkflow,
};
