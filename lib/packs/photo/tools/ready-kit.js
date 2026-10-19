// "Look ready" for a photographer: the facts for a portfolio website (site pack) and a Google profile
// kit (local pack), from the member's own prices (Your offer, else the middle of the market) and only
// the work and clients they list. This tool only gathers and words the facts; nothing is invented (no
// reviews, years, clients or numbers the member didn't give).

const { views, text, brain, money } = require('../../_kit');
const offer = require('../lib/offer');
const niche = require('../data/niche.json');

const WHAT = 'Business photography';
const lines = (s, max) =>
  String(s || '')
    .split(/\r?\n/)
    .map((l) => text.oneLine(l))
    .filter(Boolean)
    .slice(0, max);

module.exports = {
  name: 'photo.ready_kit',
  title: 'Gather your facts',
  description: 'Your shoots and prices, promise, work and contact details, worded once for your portfolio website and your Google profile kit, so both match.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 0,
  timeoutSec: 15,
  input: {
    type: 'object',
    properties: {
      business: { type: 'string', maxLength: 80, title: 'Your business name' },
      city: { type: 'string', maxLength: 80, title: 'Your city and state' },
      areas: { type: 'string', maxLength: 600, title: 'Towns you travel to (optional)' },
      phone: { type: 'string', maxLength: 40, title: 'Phone (optional)' },
      email: { type: 'string', maxLength: 120, title: 'Email (optional)' },
      link: { type: 'string', maxLength: 300, title: 'Booking link (optional)' },
      instagram: { type: 'string', maxLength: 120, title: 'Instagram (optional)' },
      work: { type: 'string', maxLength: 1500, title: 'Your best shoots, one per line (optional)' },
      clients: { type: 'string', maxLength: 600, title: 'Businesses you may name (optional)' },
      about: { type: 'string', maxLength: 600, title: 'About you, in your words (optional)' },
    },
  },
  output: { type: 'object', required: ['site', 'gbp', 'services', 'steps'], properties: { site: { type: 'object' }, gbp: { type: 'object' }, services: { type: 'string' }, steps: { type: 'array' }, priced: { type: 'string' } } },
  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const saved = brain.packMemory(ctx, 'photo').offer;
    const o = offer.build({ position: (saved && saved.position) || 'standard' });
    const pk = Object.fromEntries(o.menu.packages.map((p) => [p.id, p]));
    const [monthly] = o.care;
    const usd = money.usd;
    // The site reads "Name, $price, detail"; the Google profile kit takes the service names only.
    const services = [
      `${pk.business_shoot.label}, ${usd(pk.business_shoot.price)}, up to 2 hours at your place and 25 edited photos in your gallery within 3 days`,
      `${pk.half_day.label}, ${usd(pk.half_day.price)}, up to 4 hours: your work, your space and your team, 50 edited photos`,
      `${monthly.label}, ${usd(monthly.price)} a month, 10 new edited photos each month from a 1-hour session at your place`,
      `${pk.headshots.label}, ${usd(pk.headshots.price)} a person, 2 edited photos for each person`,
      `${pk.listing.label}, ${usd(pk.listing.price)} a property, 25 to 30 edited photos within 24 hours`,
    ];
    // The profile kit lists service names; "at your place" also tells it you go to the customer, so it
    // sets you up as a service-area business with your home address hidden.
    const names = [`${pk.business_shoot.label} at your place`, pk.half_day.label, monthly.label, pk.headshots.label, pk.listing.label];
    const [city, region] = String(input.city || '').split(',').map((s) => text.oneLine(s));
    const areas = text.oneLine(String(input.areas || '').replace(/\r?\n/g, ', ')) || city || '';
    const work = lines(input.work, 9);
    const clients = lines(input.clients, 12);
    const site = {
      business: text.oneLine(input.business || ''),
      what: WHAT,
      city: city || '',
      region: region || '',
      area: areas.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6).join(', '),
      services: services.join('\n'),
      included: ['A shot list we agree before the shoot', 'Edited photos in an online gallery within 3 days', 'Sized for your website, Google profile, posts and menus', 'Written permission to use them on your website, Google profile, posts, menus and ads', 'A new date free if weather or a closure moves the shoot'].join('\n'),
      tagline: 'Photos of your place, your work and your team, ready for your website and Google profile',
      promise: niche.promise,
      // No founding offer on the site: it's for the first clients and would go stale on a page that stays up.
      phone: text.oneLine(input.phone || ''),
      email: text.oneLine(input.email || ''),
      booking: text.oneLine(input.link || ''),
      instagram: text.oneLine(input.instagram || ''),
      work: work.join('\n'),
      clients: clients.join('\n'),
      ...(input.about ? { about: text.clip(text.plain(input.about), 600) } : {}),
    };
    for (const k of Object.keys(site)) if (site[k] === '') delete site[k];
    const gbp = { business: site.business, what: 'business photography', city: site.city, region: site.region, phone: site.phone, email: site.email, booking: site.booking, services: names.join('\n'), firstName: br.firstName || '', group: 'bizphoto', areas };
    for (const k of Object.keys(gbp)) if (gbp[k] === '' || gbp[k] == null) delete gbp[k];
    const steps = [
      'Website: open the preview and check every line, then swap the placeholder photos for your own best work (the file names are listed) and drag the ZIP onto Netlify Drop.',
      'Only show photos you took, of clients who said yes. Name a business on your site only with the owner\'s yes.',
      'Google profile: claim it at business.google.com, keep Photographer as the main category and add another only if it names work you do, then paste the description, services and first post from the kit. Upload your 10 strongest business photos first, and skip any post or photo idea in the kit that does not fit your work.',
    ];
    return { site, gbp, services: services.join('\n'), steps, priced: saved ? `your saved ${saved.position} prices` : 'the middle of the market range (run Your offer to set your own)' };
  },
  view(out) {
    return views.blocks(
      views.copy('Your shoots and prices, as they appear on your website', out.services),
      views.text(`Prices from ${out.priced}. Your website and Google profile show your regular prices, so they stay true after your founding clients.`),
      views.text(`Then: ${out.steps.join(' ')}`)
    );
  },
};
