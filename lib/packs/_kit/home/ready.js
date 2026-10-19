// "Look ready" for a household pack: the facts for a one-page website (site pack), a Google profile
// kit and a flyer (local pack), all from the member's real prices, offer and promise, composed as
// steps in the workflow. This tool only gathers and words the facts; nothing is invented (no
// reviews, years or numbers the member didn't give). Shared household spine.

const { text, views } = require('..');
const offer = require('./offer');
const geo = require('./geo');
const T = require('./tools');
const print = require('./print');

const GROUP = { cleaning: 'cleaning', lawn: 'yard', detailing: 'auto', washing: 'washing' };
const color0 = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || '').trim()) ? String(c).trim() : '');

function readyTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  return {
    name: `${id}.ready_kit`,
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
        city: { type: 'string', maxLength: 80, title: 'Your city and state' },
        areas: { type: 'string', maxLength: 600, title: 'Towns or neighborhoods you serve (optional)' },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        email: { type: 'string', maxLength: 120 },
        link: { type: 'string', maxLength: 300 },
        about: { type: 'string', maxLength: 600, title: 'About you, in your words (optional)' },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: { type: 'object', required: ['site', 'gbp', 'flyer'], properties: { site: { type: 'object' }, gbp: { type: 'object' }, flyer: { type: 'object' }, steps: { type: 'array' }, services: { type: 'string' } } },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const parsed = geo.parsePlace(f.place);
      const menu = offer.menuFor(ctx, cfg, {});
      const { lead: lo } = T.leadFor(ctx, cfg, menu, { lat: geo.latOf(f.place).lat });
      const sized = (cfg.prices.factors || []).find((x) => x.id === N.quote.size_factor);
      const isSized = (p) => sized && (!sized.packages || sized.packages.includes(p.id));
      // Services as each pack reads them: the site takes "Deep clean, from $300 per visit, baseboards..."
      // (name, price, detail); the local pack's profile kit and flyer take "Deep clean, from $300 per visit".
      const list = menu.packages.filter((p) => !p.rate).slice(0, 6);
      const priced = (p) => `${p.label}, ${isSized(p) ? 'from ' : ''}$${p.price} per ${p.unit || 'job'}`;
      const services = list.map((p) => `${priced(p)}, ${(p.includes || []).slice(0, 3).join(', ').toLowerCase()}`).join('\n');
      const servicesShort = list.map(priced).join('\n');
      const email = String(input.email || '').trim();
      // One color on all three: theirs, else the niche's (the same green or blue as their cards).
      const color = color0(input.color) || print.paletteFor(cfg, '').primary;
      const areas = String(input.areas || '').trim() || parsed.city || '';
      const first = f.first;
      const offerLine = `${lo.headline}: ${lo.foundingText} for my first 3 clients${lo.ref ? ` (${lo.ref})` : ''}`;
      const included = [N.offer.promise, ...(lo.includes || []).slice(0, 3)];
      const site = {
        business: f.business,
        what: N.what,
        city: parsed.city,
        region: parsed.state,
        area: areas.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean).slice(0, 6).join(', '),
        services,
        included: included.join('\n'),
        tagline: N.offer.outcome,
        promise: N.offer.promise,
        // No founding offer on the site: it's for the first 3 clients and would go stale on a page
        // that stays up. The flyer and the messages carry it.
        phone: f.phone,
        email,
        booking: f.link,
        color,
        owner: first,
        ...(input.about ? { about: text.clip(text.plain(input.about), 600) } : {}),
      };
      const biz = { business: f.business, what: N.what, city: parsed.city, region: parsed.state, phone: f.phone, email, booking: f.link, color, services: servicesShort, firstName: first, group: N.local_group || GROUP[id] || 'home' };
      const gbp = { ...biz, website: '', areas, promise: N.offer.promise };
      const flyer = {
        ...biz,
        copy: {
          headline: lo.headline,
          sub: N.offer.outcome,
          bullets: (lo.includes || []).slice(0, 3),
          offerText: `First 3 clients: ${lo.foundingText}`,
          cta: f.phone ? `Text ${f.phone}` : f.link ? 'Book online' : 'Call or text to book',
        },
        offer: text.clip(`First 3 clients: ${lo.foundingText}`, 60),
        area: parsed.city || '',
      };
      const look = (N.where_buyers_look || []).slice(0, 3).map((w) => w.channel);
      const steps = [
        'Website: open the preview, check every line, then drag the ZIP onto Netlify Drop (the steps are in its README).',
        'Google profile: claim it at business.google.com, then paste the description, services and first post from the kit.',
        'Flyer: print 20 and pin them where neighbors look: coffee shops, libraries, laundromats and hardware store boards.',
        look.length ? `Where your customers look first: ${text.list(look.map((x) => (/^[A-Z][a-z]/.test(x) && !/^(Google|Nextdoor|Facebook|Instagram|AI)\b/.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x)))}.` : '',
      ].filter(Boolean);
      return { site, gbp, flyer, steps, services, offer: offerLine };
    },
    view(out) {
      return views.blocks(
        views.text(`On your flyer: ${out.offer}. Your website and Google profile show your regular prices, so they stay true after your first 3 clients.`),
        views.copy('Your services and prices, as they appear', out.services),
        views.text(`Then: ${out.steps.join(' ')}`),
      );
    },
  };
}

module.exports = { readyTool, GROUP };
