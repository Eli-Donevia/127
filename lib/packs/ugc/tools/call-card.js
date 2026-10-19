// The UGC half of call prep: what to check before a call with a brand (the product page, their ads in
// the Meta Ad Library, their last posts, the concept), what their store shows (read live by
// shop.read_store, else from your list, always dated), the products worth filming, the questions to
// ask, the price said once (founding terms while the member has fewer than 3 paying brands), the
// brand's worries with honest answers, the close and what to do after. It hands sales.call_script the
// notes and the member's packages, puts the call on the calendar and moves the brand to "Call booked".

const kit = require('../../_kit');
const { text, views, files, save, brain, time, money } = kit;
const NICHE = require('../data/niche.json');
const U = require('../lib/ugc');
const talk = require('../../_kit/talk');
const close = require('../lib/close');
const offer = require('../lib/offer');

const usd = (n) => money.usd(n);

// "2pm", "2:30 pm", "14:00" -> "14:00"; '' when it can't tell.
function clock(s) {
  const m = String(s || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!m) return '';
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return '';
  if (m[3] && m[3].startsWith('p') && h < 12) h += 12;
  if (m[3] && m[3].startsWith('a') && h === 12) h = 0;
  if (!m[3] && h >= 1 && h <= 6) h += 12; // "3" is 3pm for a work call
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const nice = (date, hhmm) => {
  const [y, mo, d] = date.split('-').map(Number);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(Date.UTC(y, mo - 1, d, 12)));
  if (!hhmm) return day;
  const [h, m] = hhmm.split(':').map(Number);
  return `${day} at ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
};

// The package to suggest from what they said: ads mean the ad starter, ongoing work the monthly plan,
// anything else the test video.
function packageFor(said) {
  const t = String(said || '');
  if (/\b(every|each|per) (month|week)\b|\bmonthly\b|\bongoing\b|\bretainer\b|\bregular(ly)?\b|\ba steady\b/i.test(t)) return 'monthly';
  if (/\bads?\b|\bmeta\b|\bfacebook\b|\bspark\b|\bwhitelist\w*|\bpaid (social|media|use)\b|\bcreatives?\b|\bhooks?\b/i.test(t)) return 'starter';
  return 'test';
}

// Up to 4 products to film: the live read's newest first, else the snapshot's.
function productsOf(brand, read) {
  const domain = brand.domain || '';
  const live = read && read.ok && !read.sample && String(read.domain || '').replace(/^www\./, '') === domain.replace(/^www\./, '') ? read.picks || [] : null;
  const snap = domain ? U.findSnapshot(domain) : null;
  const picks = live || (snap && snap.picks) || [];
  return picks
    .map((p) => ({ title: U.safeName(p.title), price: Number(p.price) || 0, listed: p.listed || '', url: p.handle && domain ? `https://${domain}/products/${p.handle}` : '' }))
    .filter((p) => p.title && p.price > 0)
    .slice(0, 4);
}

module.exports = {
  name: 'ugc.call_card',
  title: 'Brand call card',
  description: 'One card for a call with a brand: what to check first (their product page, their ads, their posts, your concept), what their store shows, products worth filming, the questions to ask, your price said once, honest answers to the usual worries, the close and what to do after. Puts the call on your calendar.',
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
      notes: { type: 'string', maxLength: 3000 },
      contact: { type: 'string', maxLength: 80 },
      callDate: { type: 'string', maxLength: 10 },
      callTime: { type: 'string', maxLength: 20 },
      myName: { type: 'string', maxLength: 60 },
    },
  },
  output: { type: 'object', required: ['name', 'questions', 'worries', 'notes', 'optionsText'], properties: { name: { type: 'string' }, questions: { type: 'array' }, worries: { type: 'array' }, notes: { type: 'string' }, optionsText: { type: 'string' }, price: { type: 'number' } } },
  timeoutSec: 30,
  async run(input, ctx) {
    const lead = input.lead || {};
    const today = time.today(ctx);
    const brand = U.brandFor({ lead, read: input.read, category: lead.category, today });
    const name = text.plain(lead.name || brand.name || 'This brand');
    const s = close.shortName(name);
    const br = brain.brainOf(ctx, {});
    const me = text.plain(input.myName || br.firstName || '');
    const notes = text.plain(input.notes || '');
    const rows = await talk.pipelineRows(ctx);
    const clients = talk.wonCount(rows, 'ugc');
    const founding = clients < NICHE.first_clients.founding_count;
    const n = offer.offerNumbers({}, ctx);
    const P = offer.priceSay(n, { founding });
    const contact = text.oneLine(String(input.contact || '')).split(' ')[0] || '';
    const data = lead.data || {};
    const concept = !!(lead.concept || data.conceptMade);
    const conceptName = data.concept && data.concept.name ? data.concept.name : '';
    const products = productsOf(brand, input.read);
    const prod = brand.product ? U.shortTitle(brand.product.title) : products[0] ? U.shortTitle(products[0].title) : 'your best seller';

    // What their store shows, with where it came from and when.
    const day = brand.checked ? talk.longDate(brand.checked) : '';
    const from = brand.fresh ? `read from their store today` : brand.read === 'snapshot' ? `from your brand list, read ${day}` : day ? `from your Pipeline, read ${day}` : 'from your Pipeline';
    const store = [];
    if (brand.products) store.push({ fact: `${brand.products} products${brand.price_range ? `, ${brand.price_range}` : ''}`, from });
    if (brand.newest) store.push({ fact: `Newest product listed ${time.longDate(brand.newest)}`, from });
    for (const g of (brand.gaps || []).slice(0, 2)) store.push({ fact: g.text, from });
    for (const f of (lead.facts || []).slice(0, 2)) if (!store.some((x) => f.startsWith(x.fact))) store.push({ fact: f.replace(/\s*\((read|checked)[^)]*\)\s*$/i, ''), from: 'from your pitch' });

    // The store facts are in their own table, so the checks stay checks.
    const checkFirst = close.checkFirst({ brand, concept, conceptName }).filter((c) => !/^From their store/.test(c.why));
    const worries = close.worriesFor(`${notes}\n${lead.reply || ''}`, s);
    const said = `${notes}\n${lead.reply || ''}`;
    const pick = packageFor(said);
    const pkg = offer.pkgOf(n, pick);
    const start = pick === 'test' ? (founding ? `one test video of ${prod}, ${usd(n.founding)} as one of my first ${NICHE.first_clients.founding_count} brands (normally ${usd(n.video)})` : `one test video of ${prod}, ${usd(n.video)}`) : pick === 'starter' ? `the ad starter for ${prod}: 3 videos, an extra hook on each and 30 days of ad use, ${usd(n.starter)}` : `${pkg.videos} new videos a month at ${usd(n.monthly)}, and you can stop any month`;
    const closeLine = `Here's what I'd suggest: ${start}. I send a one-page brief today with the hooks and the shots, you ship the product, and the video${pick === 'test' ? '' : 's'} arrive${pick === 'test' ? 's' : ''} ${n.turnaround} days after it lands. Want me to send the brief and the quote today?`;
    const priceLines = {
      say: P.base,
      founding: P.founding,
      addons: P.addons,
      from: n.saved ? 'your saved offer' : 'the new-creator price list (run "Your offer" to set your own)',
    };
    const after = [
      { if: 'They say yes', then: 'Send the brief and the quote the same day (run "Write a brief"). Half up front books the date, and your shipping address goes with the brief.' },
      { if: 'They want to think it over', then: `Agree a day to talk again before you hang up and put it in your calendar.${concept ? '' : ` Offer the free concept for ${prod} so they have something to show their team.`}` },
      { if: 'They say no', then: 'Thank them and ask if you can check back in 3 months. If not, mark them lost in your Pipeline.' },
    ];
    const rules = `Never promise views or sales. Say only what you saw and felt after using the product, once you have it. Claims about results come from ${s}, with their proof. If a video goes on your account, it is labeled as an ad.`;

    // For sales.call_script: their store facts, the member's notes, the worries they mentioned, the offer.
    const scriptNotes = [
      ...store.slice(0, 3).map((x) => x.fact),
      notes,
      ...worries.filter((w) => w.mentioned).map((w) => `They may say: ${w.says}`),
      'What I offer: short vertical product videos, 15 to 60 seconds, with captions, a clean version and the use in writing. Paid ad use, extra hooks and raw footage are add-ons. I film the product in hand and never promise views or sales.',
    ]
      .filter(Boolean)
      .join('\n');

    // The call on the member's calendar, with the card's key lines.
    let when = null;
    let calendar = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(input.callDate || ''))) {
      const hhmm = clock(input.callTime);
      when = { date: input.callDate, time: hhmm, label: nice(input.callDate, hhmm) };
      const desc = [`Price, said once: ${P.base}`, founding ? P.founding : '', `Ask: ${close.QUESTIONS.slice(0, 3).join(' / ')}`, `Close: ${closeLine}`, `Rules: ${rules}`, brand.url ? `Their store: ${brand.url}` : ''].filter(Boolean).join('\n\n');
      try {
        const ics = files.ics([{ uid: `ugc-call-${text.slug(lead.key || s, 40)}-${input.callDate}@127group.io`, title: `Call: ${contact ? `${contact} at ` : ''}${s}`, date: input.callDate, time: hhmm || undefined, minutes: 20, tz: time.tzOf(ctx), description: desc, url: /^https:\/\//.test(brand.url || '') ? brand.url : undefined }], { name: 'Brand calls', now: time.nowMs(ctx) });
        calendar = await save.saveFile(ctx, save.fileName(s, 'call', '.ics'), ics, 'text/calendar');
      } catch {
        calendar = null;
      }
    }

    // Call booked: this pack's brand (or one typed in) moves to "call"; another pack's is the member's to move.
    let line = '';
    const leads = (ctx && ctx.leads) || {};
    const own = !lead.pack || lead.pack === 'ugc';
    try {
      if (lead.inPipeline && own && lead.key && typeof leads.upsert === 'function') {
        if (['found', 'contacted', 'replied'].includes(lead.stage)) {
          await leads.upsert({ key: lead.key, stage: 'call' });
          line = `Moved ${name} to Call booked in your Pipeline.`;
        }
      } else if (lead.inPipeline) {
        if (['found', 'contacted', 'replied'].includes(lead.stage)) line = `Move ${name} to Call booked in your Pipeline.`;
      } else if (typeof leads.upsert === 'function') {
        const dom = brand.domain || talk.domainOf(lead.website);
        const p = brand.product;
        await leads.upsert({ key: lead.key || (dom ? `site:${dom}` : `lead:${text.slug(name, 40)}`), name, company: name, source: 'Call prep', stage: 'call', links: dom ? { website: `https://${dom}` } : {}, data: { service: 'ugc', category: brand.category, ...(p ? { product: { title: p.title, url: p.url, price: p.price } } : {}) } });
        line = `Added ${name} to your Pipeline at Call booked.`;
      }
    } catch {
      line = '';
    }

    return {
      name,
      contact,
      inPipeline: !!lead.inPipeline,
      when,
      calendar,
      store,
      products,
      checkFirst,
      questions: close.QUESTIONS,
      priceLines,
      founding,
      clients,
      worries,
      pick,
      close: closeLine,
      rules,
      after,
      notes: scriptNotes,
      optionsText: offer.optionsText(n, pick, { founding }),
      price: pkg.id === 'test' && founding ? n.founding : pkg.price,
      line,
      me,
    };
  },
  view(out) {
    const p = out.priceLines || null;
    return views.blocks(
      views.metric(`Call with ${out.contact ? `${out.contact} at ` : ''}${out.name}`, out.when ? out.when.label : 'Not on your calendar yet', out.founding ? `Founding brand ${out.clients + 1} of ${NICHE.first_clients.founding_count}` : undefined),
      views.cards(out.checkFirst.map((c) => ({ title: c.item, body: c.why, badge: 'Before the call' }))),
      out.store.length ? views.table([{ key: 'fact', label: 'What their store shows' }, { key: 'from', label: 'From' }], out.store) : null,
      out.products.length ? views.table([{ key: 'title', label: 'Products you could film' }, { key: 'price', label: 'Price' }, { key: 'listed', label: 'Listed' }, { key: 'url', label: 'Page', format: 'link' }], out.products.map((x) => ({ title: x.title, price: money.usd(x.price), listed: x.listed ? time.shortDate(x.listed) : '', url: x.url }))) : null,
      views.copy('Questions to ask', out.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')),
      p ? views.copy('Say the price once', [p.say, p.founding || p.addons].filter(Boolean).join(' ')) : null,
      p ? views.text(`Prices from ${p.from}.`) : null,
      views.cards(out.worries.map((w) => ({ title: w.says, body: w.answer, badge: w.mentioned ? 'They mentioned this' : undefined }))),
      views.copy('The close', out.close),
      views.text(`The rules, if it comes up: ${out.rules}`),
      views.cards(out.after.map((a) => ({ title: a.if, body: a.then }))),
      views.file(out.calendar, 'The call, for your calendar (with these notes)'),
      out.line ? views.text(out.line) : null,
    );
  },
};
