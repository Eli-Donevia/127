// "A customer said yes" for a household pack: logs the win in the Pipeline, prices the job at the
// right step of the first-clients ladder (founding price for the first 3, early price for the next
// 7, then the menu), and writes everything for the job: the booking text, the founding-client note
// in writing, the prep text for the day before, a printable job sheet from data/niche.json
// "job_checklist" with what to bring and the photos to take, and the after-job text. The workflow
// sends the line items to the Sales desk for the invoice (with a deposit when the member asks).
// Shared household spine.

const { text, views, save, booked: bookedLeads } = require('..');
const offer = require('./offer');
const words = require('./words');
const print = require('./print');
const pages = require('./pages');
const pipe = require('./pipeline');
const geo = require('./geo');
const T = require('./tools');

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };

// The package for this job: what the member picked, else what the lead was offered, else this month's offer.
function packageFor(cfg, menu, input, lead, lo) {
  const pick = String(input.job || '').trim().toLowerCase();
  const all = menu.packages.filter((p) => !p.rate);
  if (pick) {
    const hit = all.find((p) => p.id === pick || p.label.toLowerCase() === pick) || all.find((p) => p.label.toLowerCase().startsWith(pick) || pick.startsWith(p.label.toLowerCase()));
    if (hit) return hit;
  }
  const sampleType = lead && lead.data && lead.data.type;
  const P = sampleType && cfg.niche.sample_one && cfg.niche.sample_one.partners && cfg.niche.sample_one.partners[sampleType];
  if (P && P.package && !/^(biz|osm|sample):/.test(String(lead.key || ''))) {
    const hit = all.find((p) => p.id === P.package);
    if (hit) return hit;
  }
  return all.find((p) => p.id === lo.package) || all[0];
}

// How many other customers this pack has already won (this one not counted): its own won rows and
// the other packs' leads it booked (kit booked.js). Counted by name: on HQ before contract v1.5 one
// customer can have two won rows (another pack's card and this pack's own).
async function wonBefore(ctx, cfg, key, name) {
  if (!ctx || !ctx.leads || typeof ctx.leads.list !== 'function') return 0;
  try {
    const rows = await bookedLeads.wonLeads(ctx, cfg.id);
    const me = pipe.norm(name);
    const seen = new Set();
    for (const l of rows) {
      if (!l || l.stage !== 'won' || l.key === key) continue;
      const n = pipe.norm(l.company || l.name) || String(l.key);
      if (n !== me) seen.add(n);
    }
    return seen.size;
  } catch {
    return 0;
  }
}

function bookTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  const W = N.won || {};
  return {
    name: `${id}.book_job`,
    title: 'Book this job',
    description: 'Logs the win in your Pipeline, prices the job at the right step of your first-clients ladder, and writes the booking text, the founding-client note, the prep text, a printable job sheet with the checklist, and the after-job text. The line items go to the Sales desk for the invoice.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 2,
    timeoutSec: 60,
    input: {
      type: 'object',
      required: ['customer'],
      properties: {
        customer: { type: 'string', maxLength: 120, title: 'Customer' },
        contact: { type: 'string', maxLength: 160, title: 'Their phone or email (optional)' },
        address: { type: 'string', maxLength: 200, title: 'Address (optional)' },
        when: { type: 'string', maxLength: 60, title: 'Day and time (optional)' },
        job: { type: 'string', maxLength: 80, title: 'The job (optional)' },
        price: { type: ['number', 'string'], title: 'Price you agreed (optional)' },
        notes: { type: 'string', maxLength: 600, title: 'Notes (optional)' },
        deposit: { type: 'string', maxLength: 20, title: 'Deposit to book (optional)' },
        city: { type: 'string', maxLength: 80 },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: {
      type: 'object',
      required: ['customer', 'items', 'messages', 'files'],
      properties: { customer: { type: 'object' }, job: { type: 'object' }, sizeNote: { type: 'string' }, wonBefore: { type: 'number' }, items: { type: 'array' }, title: { type: 'string' }, contactLine: { type: 'string' }, notes: { type: 'string' }, messages: { type: 'array' }, files: { type: 'object', properties: { html: ASSET } }, saved: { type: 'boolean' }, step: { type: 'string' } },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const name = text.clip(text.plain(input.customer || ''), 120).trim();
      if (!name) throw new Error('Pick the customer from your Pipeline, or type their name.');
      const menu = offer.menuFor(ctx, cfg, {});
      const { lead: lo } = T.leadFor(ctx, cfg, menu, { lat: geo.latOf(f.place).lat });
      const lead = await pipe.findLead(ctx, id, name);
      const isBiz = pipe.isBusiness(lead, name);
      const who = (lead && (isBiz ? lead.company || lead.name : lead.name)) || name;
      const greet = isBiz ? 'there' : String(who).split(/\s+/)[0];
      const pkg = packageFor(cfg, menu, input, lead, lo);

      // The ladder: this customer's place in line sets the price, unless the member typed one.
      const key = lead ? lead.key : pipe.keyFor(who, isBiz);
      const before = await wonBefore(ctx, cfg, key, who);
      const ladder = offer.ladderFor(cfg, pkg.price);
      let at = 0;
      let n = before;
      while (at < ladder.length - 1 && ladder[at].count && n >= ladder[at].count) {
        n -= ladder[at].count;
        at += 1;
      }
      const stepNow = ladder[at] || { label: 'Full price', price: pkg.price, off: 0 };
      const typed = Number(String(input.price == null ? '' : input.price).replace(/[^0-9.]/g, ''));
      const charged = typed > 0 ? typed : stepNow.price;
      const founding = !(typed > 0) && at === 0 && stepNow.off > 0;
      const early = !(typed > 0) && stepNow.off > 0 && !founding;
      // The menu price is for the base size (a 2 bed, 1 bath; a sedan): say so when it set the price.
      const sizedF = (cfg.prices.factors || []).find((x) => x.id === N.quote.size_factor);
      const sized = !!(sizedF && N.quote.reference && (!sizedF.packages || sizedF.packages.includes(pkg.id)));
      const ref = sized ? ` (${N.quote.reference})` : '';
      const priceLine = charged < pkg.price ? `${T.usd(charged)}, my ${stepNow.label.toLowerCase()} instead of ${T.usd(pkg.price)}` : T.usd(charged);
      const when = text.plain(input.when || '').trim();
      const job = pkg.label.toLowerCase();
      const contact = text.plain(input.contact || '').trim() || (lead && lead.links ? [lead.links.phone, lead.links.email].filter(Boolean).join(', ') : '');
      const address = text.plain(input.address || '').trim() || (isBiz && lead ? lead.note || '' : '');
      // Don't ask for what the member already typed: the address (or where the car is parked).
      const needs = address ? String(W.needs || '').replace(/\b(the address|where it'll be parked),\s*/gi, '') : W.needs || '';
      // "Tuesdays, starting Apr 7" is a first visit; "Saturday at 10am" is a day.
      const recurring = /^(every\b|weekly|biweekly|(mon|tues|wednes|thurs|fri|satur|sun)days\b)/i.test(when);
      const beforeWhen = !when ? 'before I come' : recurring ? `before your first visit (${when})` : `before I come on ${when}`;

      // Line items for the Sales desk: the menu price, and the ladder step as its own line.
      const items = [{ label: pkg.label, detail: (pkg.includes || []).slice(0, 4).join(', '), qty: 1, unit: pkg.unit || 'job', price: pkg.price }];
      if (charged < pkg.price) items.push({ label: founding ? 'Founding client price (first 3 clients)' : early ? 'Early client price' : 'Agreed price', qty: 1, unit: 'job', price: -Math.round((pkg.price - charged) * 100) / 100 });
      if (charged > pkg.price) items[0].price = charged;
      const ask = (ladder[0] && ladder[0].ask) || '';
      const notes = [founding ? `Founding client price. In return: ${lowerFirst(ask)}` : '', N.offer.promise].filter(Boolean).join(' ');

      // The messages, in the order they go out.
      const booked = when ? `you're booked for ${aOrAn(job)} ${job} on ${when}` : `you're on my schedule for ${aOrAn(job)} ${job}`;
      const messages = [
        { key: 'confirm', label: 'Booking text, now', text: words.tidy(`Hi ${greet}, ${booked}: ${priceLine}. ${needs ? `Before I come, could you send ${needs}?` : ''} ${when ? '' : 'What day and time work best for you?'} Thank you for trusting me with it!`) },
        founding ? { key: 'founding', label: 'Founding client note, with the booking', text: words.tidy(`One more thing, ${greet}: as one of my first 3 clients you get my founding price. In return I'd ask for ${lowerFirst(ask).replace(/\.$/, '')}. Is that okay with you? If not, no problem at all, the price stays the same.`) } : null,
        { key: 'prep', label: 'Prep text, the day before', text: [`Hi ${greet}, a quick note ${beforeWhen}. A few things that help me do my best work:`, ...(W.prep_items || []).slice(0, 4).map((x) => `- ${x}`), 'If anything changes, just reply here.'].join('\n') },
        { key: 'after', label: 'After the job, with your photos', text: words.tidy(`Hi ${greet}, ${W.done || 'all done'}! Your before and after photos are below. ${N.offer.promise} ${input.deposit ? "I'll send the invoice for the balance in a separate message." : "I'll send the invoice in a separate message."}`) },
      ].filter(Boolean);
      const pal = print.paletteFor(cfg, input.color);
      const html = pages.jobSheet(cfg, {
        business: f.business,
        customer: who,
        title: `${pkg.label} for ${who}`,
        sub: when ? `${when}${address ? `, ${address}` : ''}` : address || 'Agree the day and time, then print this',
        when,
        address,
        contact,
        job: `${pkg.label}${ref}: ${(pkg.includes || []).slice(0, 4).map(lowerFirst).join(', ')}`,
        priceLine: `${priceLine}${founding ? ' (founding client)' : ''}`,
        notes: text.plain(input.notes || '').trim(),
        bring: W.bring || [],
        photos: W.photos || [],
        after: ['Walk through it with them, or send photos if they are out', 'Send the after-job text with the photos', 'Send the invoice from the Sales desk', 'Then run "Keep your customers" for the thank-you, the honest review ask and the regular plan'],
        promise: N.offer.promise,
      }, pal);
      const sheet = await save.saveFile(ctx, save.fileName(f.business, 'job sheet', who, '.html'), html);

      // Log the win. Another pack's lead moves to won on its own card (contract v1.5), one row per
      // customer, and this pack remembers it booked them (kit booked.js). HQ before v1.5 can't move
      // it, so this pack adds its own won row and the card keeps a note.
      const data = { job: { package: pkg.id, price: charged, menu: pkg.price, step: founding ? 'founding' : early ? 'early' : 'full', when: when || null } };
      let saved = false;
      if (pipe.canSave(ctx)) {
        if (lead && !pipe.isOwn(lead, id)) {
          const s = await pipe.save(ctx, id, lead, { stage: 'won', note: `Won: ${pkg.label}, ${T.usd(charged)}.` });
          if (s.moved) {
            await bookedLeads.add(ctx, id, lead.id);
            saved = true;
          } else {
            try {
              await ctx.leads.upsert({ key: lead.key, name: text.clip(who, 120), ...(isBiz ? { company: text.clip(who, 120) } : {}), source: 'Won', links: lead.links || {}, stage: 'won', data });
              saved = true;
            } catch {
              saved = false;
            }
          }
        } else {
          const s = await pipe.save(ctx, id, lead, { stage: 'won', data, ...(contact && !lead ? { links: linksFrom(contact) } : {}) }, { name: who, business: isBiz, source: 'Won' });
          saved = !!s.saved;
        }
      }
      return {
        customer: { name: who, contact, address },
        job: { id: pkg.id, label: pkg.label, menu: pkg.price, price: charged, when, unit: pkg.unit },
        step: founding ? 'founding' : early ? 'early' : typed > 0 ? 'agreed' : 'full',
        wonBefore: before,
        sizeNote: sized && !(typed > 0) ? `Priced for a ${N.quote.reference}, your menu's base size. For a bigger job, type the price you agreed, or run "Quote a job" first.` : '',
        items,
        // The Sales desk prints this as the invoice heading and says "thank you for choosing me for your ...".
        title: text.clip(`Your ${job}${when ? `, ${when}` : ''}`, 120),
        contactLine: [f.phone, f.email].filter(Boolean).join(', '),
        notes,
        messages,
        files: { html: sheet },
        saved,
      };
    },
    view(out) {
      const stepText = { founding: `Founding client ${out.wonBefore + 1} of 3`, early: `Early client, customer ${out.wonBefore + 1}`, agreed: 'The price you agreed', full: 'Your menu price' }[out.step];
      return views.blocks(
        views.metric(`Booked: ${out.customer.name}`, T.usd(out.job.price), `${out.job.label}${out.job.when ? `, ${out.job.when}` : ''}. ${stepText}.`),
        out.messages.map((m) => views.copy(m.label, m.text)),
        out.sizeNote ? views.text(out.sizeNote) : null,
        views.file(out.files.html, 'Job sheet: print it or keep it open on your phone at the job'),
        out.saved ? views.text('Marked won in your Pipeline.') : null,
      );
    },
  };
}

function linksFrom(contact) {
  const s = String(contact || '');
  const email = (s.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0];
  const phone = (s.replace(email || '', '').match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/) || [])[0];
  return { ...(email ? { email } : {}), ...(phone ? { phone: phone.trim() } : {}) };
}

const lowerFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const aOrAn = text.aOrAn;

module.exports = { bookTool, packageFor, wonBefore, linksFrom };
