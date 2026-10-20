// "Make a free sample" for a household pack (step 4): a demo offer for one street, or for one partner
// business from the Pipeline or a typed name. Street: door hangers for those homes and a card to
// text, with a small free demo (one room, a test strip, one panel, a free edge) while the member is
// already there. Business: a card made for that business's customers, a one-page sample offer to
// leave or email, and every message to send, saved on the lead for Do my day (D29).
// From data/niche.json "sample_one". Shared household spine.

const { text, views, save, media, time } = require('..');
const offer = require('./offer');
const words = require('./words');
const print = require('./print');
const pages = require('./pages');
const pipe = require('./pipeline');
const first25 = require('../first25');
const geo = require('./geo');
const T = require('./tools');

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };

// The partner type for a business: the Pipeline row's type, the member's pick, words in its name, else the first type.
function typeFor(cfg, lead, input) {
  const types = cfg.niche.partners;
  const S = (cfg.niche.sample_one && cfg.niche.sample_one.partners) || {};
  const byId = (id) => types.find((t) => t.id === id);
  if (lead && lead.data && byId(lead.data.type)) return byId(lead.data.type);
  const pick = String(input.kind || '').toLowerCase();
  if (pick) {
    const t = types.find((x) => x.id === pick || x.label.toLowerCase() === pick);
    if (t) return t;
  }
  const name = ` ${String(input.who || (lead && (lead.company || lead.name)) || '').toLowerCase()} `;
  for (const t of types) if (((S[t.id] || {}).words || []).some((w) => name.includes(String(w).toLowerCase()))) return t;
  return types[0];
}

// Price of a package for a partner's customers: the menu price and the founding price.
function packagePrice(ctx, cfg, menu, pkgId) {
  const p = menu.packages.find((x) => x.id === pkgId) || menu.packages[0];
  const ladder = offer.ladderFor(cfg, p.price);
  return { pkg: p, price: p.price, founding: ladder[0] ? ladder[0].price : p.price, count: (ladder[0] && ladder[0].count) || 3 };
}

const lowerFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const upperFirst = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);

function sampleTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  const S = N.sample_one || {};
  return {
    name: `${id}.free_sample`,
    title: 'Make a free sample',
    description: `A demo offer for one street (door hangers and a card, with a small free demo while you're already there) or for one business that serves the same customers (a card made for their ${text.list(N.partners.slice(0, 3).map((p) => p.their_customers))}, a one-page sample offer and every message, saved on their row in your Pipeline).`,
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['render'],
    credits: 2,
    timeoutSec: 90,
    input: {
      type: 'object',
      properties: {
        who: { type: 'string', maxLength: 120, title: 'Which business', description: 'From your Pipeline, or type a name' },
        street: { type: 'string', maxLength: 80, title: 'Or one street', description: 'Like "Maple Ave". Leave the business empty to make it for the homes on this street.' },
        kind: { type: 'string', enum: N.partners.map((p) => p.label), title: 'What kind of business (optional)' },
        day: { type: 'string', maxLength: 40, title: 'When you can do it (optional)', description: 'Like "Saturday morning"' },
        city: { type: 'string', maxLength: 80 },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
        license_line: { type: 'string', maxLength: 80, title: 'A line your state requires on your ads (optional)', description: 'Like "Not a licensed contractor." Printed on every card, sheet and door hanger this makes' },
      },
    },
    output: {
      type: 'object',
      required: ['mode', 'target', 'demo', 'messages', 'files'],
      properties: { mode: { type: 'string' }, target: { type: 'string' }, demo: { type: 'object' }, messages: { type: 'array' }, steps: { type: 'array' }, files: { type: 'object', properties: { png: ASSET, svg: ASSET, html: ASSET } }, saved: { type: 'boolean' } },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const menu = offer.menuFor(ctx, cfg, {});
      const { lead: lo } = T.leadFor(ctx, cfg, menu, { lat: geo.latOf(f.place).lat });
      const who = text.plain(input.who || '').trim();
      const street = text.plain(input.street || '').trim().replace(/[.,]+$/, '');
      if (!who && !street) throw new Error('Pick a business from your Pipeline, or type one street.');
      const day = text.plain(input.day || '').trim();
      const pal = print.paletteFor(cfg, input.color);
      const v = T.textVars(cfg, f, lo, { street, day, day_part: day ? ` ${day}` : ' this week', phone_line: f.phone ? `Text me at ${f.phone}.` : 'Message me here.' });
      const out = { mode: who ? 'business' : 'street', target: who || street, files: {}, messages: [], steps: [] };
      const area = f.area && f.area !== 'town' ? `${N.name} in ${f.area}` : N.name;
      const license = T.licenseLine(input);

      if (!who) {
        // A street: the free demo while the member is already there, on door hangers and a card.
        const st = S.street || {};
        const headline = words.fill(st.headline || 'A free demo on {street}', v);
        const side = (st.side || []).map((x) => words.fill(x, v));
        // What the demo leads to: the street's own package when the data names one (a driveway strip
        // leads to a driveway wash), else this month's lead offer.
        let after = `${lo.headline}, ${lo.foundingText} for my first 3 clients${lo.ref ? ` (${lo.ref})` : ''}.`;
        if (st.package && menu.packages.some((p) => p.id === st.package && !p.rate)) {
          const pp = packagePrice(ctx, cfg, menu, st.package);
          const sized = (cfg.prices.factors || []).find((x) => x.id === N.quote.size_factor);
          const ref = sized && (!sized.packages || sized.packages.includes(pp.pkg.id)) ? N.quote.reference || '' : '';
          after = `${pp.pkg.label}, ${words.foundingText(pp.founding, pp.price)} for my first ${pp.count} clients${ref ? ` (${ref})` : ''}.`;
        }
        const o = {
          business: f.business,
          area,
          eyebrow: `${street} only`,
          headline,
          big: 'Free',
          side,
          includes: (st.includes || []).map((x) => words.fill(x, v)),
          plan: `After the demo: ${lowerFirst(after)}`,
          promise: N.offer.promise,
          phone: f.phone,
          link: f.link,
          hello: `Hi ${street} neighbors!`,
          how: (st.how || []).map((x) => words.fill(x, v)),
          title: `${f.business}: ${street} door hangers`,
          license,
        };
        out.demo = { headline, line: words.fill(st.line || '', v), minutes: st.minutes || null, limit: st.limit || 3, first: side.find((x) => /^First \d/.test(x)) || '' };
        await saveCard(ctx, cfg, f, o, pal, out, `${street} demo card`);
        out.files.html = await save.saveFile(ctx, save.fileName(f.business, street, 'door hangers', '.html'), print.doorHangers(cfg, o, pal));
        out.steps = (st.steps || []).map((x) => words.fill(x, v));
        out.messages.push(
          { key: 'text', label: `Text for neighbors you know on ${street} (send it with the card)`, text: out.demo.line },
          { key: 'post', label: 'Post for your neighborhood group', text: words.fill(st.post || '{line}', { ...v, line: out.demo.line }) },
        );
        out.rule = N.door_rule || '';
        out.saved = false;
        return out;
      }

      // A business: what the Pipeline knows about it, its partner type, the free demo for it and a card for its customers.
      const lead = await pipe.findLead(ctx, id, who);
      const type = typeFor(cfg, lead, input);
      const P = (S.partners || {})[type.id] || {};
      const name = (lead && (lead.company || lead.name)) || who;
      const priced = packagePrice(ctx, cfg, menu, P.package || lo.package);
      const pv = { ...v, biz: name, their: type.their_customers, why: type.why, ask: type.ask, give: type.give, one: type.one || type.label.toLowerCase(), package: priced.pkg.label.toLowerCase(), founding_price: T.usd(priced.founding), price: T.usd(priced.price), ref: N.quote.reference || '' };
      const demo = words.fill(P.demo || 'one job done free, so you can see the work', pv);
      const o = {
        business: f.business,
        area,
        eyebrow: words.fill(P.eyebrow || 'For {biz} {their}', pv),
        headline: words.fill(P.headline || '{package}, done right', pv),
        price: priced.price,
        founding: priced.founding,
        who: words.fill(P.who || `First ${priced.count} ${type.their_customers}`, pv),
        ref: N.quote.reference,
        includes: (priced.pkg.includes || []).slice(0, 3),
        plan: words.fill(P.card_line || 'Mention {biz} when you book.', pv),
        promise: N.offer.promise,
        phone: f.phone,
        link: f.link,
        license,
      };
      out.type = type.id;
      out.demo = { headline: demo, line: words.fill(P.line || 'Before I ask you for anything, I would like to show you my work: {demo}.', { ...pv, demo }), card: o.headline, package: priced.pkg.label, price: priced.price, founding: priced.founding, their: type.their_customers, count: priced.count };
      await saveCard(ctx, cfg, f, o, pal, out, `${name} sample card`);
      out.files.html = await save.saveFile(ctx, save.fileName(f.business, 'sample for', name, '.html'), pages.sampleLetter(cfg, { business: f.business, first: f.first, phone: f.phone, link: f.link, area, town: f.area, partner: name, demo, why: `Your ${type.their_customers} ${type.why}.`, ask: type.ask, give: type.give, card: o, day, how: [
        `You pick the day${day ? ` (${day} works for me)` : ''} and the place.`,
        'I do the sample and take before and after photos from the same spots.',
        'You get the photos the same day.',
        'If you like the work, we talk about the offer below. If not, no hard feelings.',
      ], promise: N.offer.promise, license }, pal));

      // Every message, the sample first (it beats a cold ask), saved on the lead for Do my day.
      const me = f.first ? `I'm ${f.first} and I run ${f.business}` : `I run ${f.business}`;
      const when = day || 'one day this week';
      const dm = text.plain(`Hi ${name} team, ${me}, ${N.what} here in ${f.area}. Before I ask you for anything, I'd like to show you my work: ${demo}. No cost and no catch. I also made a card for your ${type.their_customers} you can look over. Would ${when} work?`);
      const walkin = text.plain(`${first25.whoToAsk(type)} ${f.first ? `I'm ${f.first}, ` : 'I '}${f.first ? 'I do' : 'do'} ${N.what} nearby. Before I ask for anything, I'd like to show you my work: ${demo}, at no cost. When would be a good day?`);
      const links = lead ? lead.links || {} : {};
      const channel = pipe.channelOf(links);
      const base = pipe.businessMsg({ biz: name, first: f.first, business: f.business, what: N.what, area: f.area, phone: f.phone, their: type.their_customers, why: type.why, ask: type.ask, give: type.give, dm, walkin, subject: `A sample of my work for ${name}` }, channel);
      const reach = f.phone ? `I'm at ${f.phone}.` : 'Just reply here.';
      const f1 = text.plain(`Hi ${name} team, following up on the free sample: ${demo}. I can work around your schedule. Would ${day || 'next week'} work?`);
      const f2 = text.plain(`Hi ${name} team, last note from me. The sample stands whenever it helps: ${demo}. ${reach} Thanks!`);
      const byEmail = channel === 'email' || channel === 'site';
      const msg = { ...base, follow1: byEmail ? pipe.signed(f1, f) : f1, follow2: byEmail ? pipe.signed(f2, f) : f2 };
      out.msg = msg;
      out.messages.push(
        { key: 'dm', label: `Message to ${name} (with the card)`, text: msg.dm },
        { key: 'walkin', label: 'If you walk in or call', text: msg.walkin },
        { key: 'email', label: 'If you email them', text: msg.email, subject: msg.subject },
        { key: 'follow1', label: 'Follow-up in 3 days', text: msg.follow1 },
      );
      out.steps = (P.steps || []).map((x) => words.fill(x, { ...pv, demo }));
      const facts = [`Free sample offered: ${demo}.`, `Their ${type.their_customers} ${type.why}.`];
      const r = await pipe.save(ctx, id, lead, { msg, facts, data: { type: type.id, sample: { demo, day: day || null, on: time.today(ctx) } } }, { name, business: true, source: 'Free sample' });
      out.saved = !!r.saved;
      out.inPipeline = !!lead;
      out.other = !!r.other;
      return out;
    },
    view(out) {
      const street = out.mode === 'street';
      return views.blocks(
        // A business's demo is a sentence, so it goes in the note and the value stays one word.
        street
          ? views.metric(`Free demo on ${out.target}`, out.demo.headline, `${out.demo.first || `First ${out.demo.limit} homes`}${out.demo.minutes ? `, about ${out.demo.minutes} minutes each` : ''}`)
          : views.metric(`Free sample for ${out.target}`, 'Free', `${upperFirst(out.demo.headline)}. Card for their ${out.demo.their || 'customers'}: ${out.demo.package}, ${T.usd(out.demo.founding)} for the first ${out.demo.count || 3}.`),
        views.image(out.files.png, street ? 'Text this card to neighbors you know, or post it' : 'The card for their customers: send it with your message'),
        out.files.svg ? views.file(out.files.svg, 'Card (open in a browser)') : null,
        views.file(out.files.html, street ? 'Door hangers for this street: print on card stock, two per sheet' : 'One-page sample offer: print it to leave behind, or attach it to your email'),
        out.messages.map((m) => views.copy(m.label, m.text, m.subject ? { subject: m.subject } : undefined)),
        out.steps.length ? views.text(`How to run it: ${out.steps.join(' ')}`) : null,
        street && out.rule ? views.text(out.rule) : null,
        !street && out.saved ? views.text(out.inPipeline ? 'Saved on this lead in your Pipeline: Do my day hands out the sample message and the follow-ups.' : 'Added to your Pipeline with these messages, so Do my day can hand them out.') : null,
      );
    },
  };
}

// The card as a PNG (an SVG when ffmpeg isn't there).
async function saveCard(ctx, cfg, f, o, pal, out, what) {
  const svgText = print.offerCard(cfg, o, pal);
  if (media.canRender(ctx)) {
    try {
      out.files.png = await save.saveFile(ctx, save.fileName(f.business, what, '.png'), await media.svgToPng(ctx, svgText));
      return;
    } catch {
      /* the SVG below still works */
    }
  }
  out.files.svg = await save.saveFile(ctx, save.fileName(f.business, what, '.svg'), svgText);
}

module.exports = { sampleTool, typeFor, packagePrice, saveCard };
