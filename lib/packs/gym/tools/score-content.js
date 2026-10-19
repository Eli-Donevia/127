// gym.score_content: reads one gym's website (free) and, with 127's Instagram key, its recent posts,
// then scores it: can it pay, how much does it need video, can you reach the owner.

const { scanSite } = require('../lib/site-scan');
const { businessDiscovery } = require('../lib/instagram');
const { scoreGym } = require('../lib/score');
const { domainOf, slug: slugName } = require('../lib/util');
const { categoryOf, ownSite } = require('../lib/sources');
const sampleScans = require('../sample/scans.json');

const compact = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Is this website the chain's own domain (anytimefitness.com/gyms/2987) rather than the owner's?
function onBrandDomain(gym, website) {
  if (!['franchise', 'corporate'].includes(gym.owner) || !gym.brand) return false;
  const b = compact(gym.brand).replace(/(fitness|training|gym|club|studio)$/, '');
  const stem = compact((domainOf(website) || '').split('.')[0]);
  return !!(b && stem && (stem.includes(b) || b.includes(stem)));
}

// A franchise location page on the brand's own domain lists the brand's national accounts.
// Keep only handles that are clearly the location's own (purebarreankeny, f45_training_downtowndsm).
function localize(gym, site) {
  if (!site || !site.reachable || gym.owner !== 'franchise' || !gym.brand) return { site, brandSite: false };
  const b = compact(gym.brand).replace(/(fitness|training|gym|club|studio)$/, '');
  const stem = compact((site.domain || domainOf(site.url) || '').split('.')[0]);
  if (!onBrandDomain(gym, site.url || site.domain)) return { site, brandSite: false };
  const brandish = (h) => {
    const c = compact(String(h || '').replace(/^https?:\/\/[^/]+\//, ''));
    return !c || c === stem || c === compact(gym.brand) || c === b;
  };
  const socials = { ...site.socials };
  for (const k of ['instagram', 'tiktok', 'facebook', 'youtube', 'x', 'linkedin']) if (socials[k] && brandish(socials[k])) socials[k] = null;
  const contacts = { emails: [], phones: site.contacts.phones };
  return { site: { ...site, socials, contacts, brandSite: true }, brandSite: true };
}

function trimSite(s) {
  if (!s || !s.reachable) return s || { reachable: false, reason: 'No website listed.' };
  return {
    reachable: true,
    url: s.url,
    domain: s.domain,
    brandSite: !!s.brandSite,
    title: s.title,
    socials: s.socials,
    video: s.video,
    booking: s.booking,
    tracking: s.tracking,
    offer: s.offer,
    monthlyPrice: s.monthlyPrice,
    colors: s.colors,
    images: { logo: s.images.logo, icon: s.images.icon, ogImage: s.images.ogImage, photos: (s.images.photos || []).slice(0, 5) },
    contacts: s.contacts,
    people: s.people,
    links: { team: s.links.team, about: s.links.about, pricing: s.links.pricing },
    platform: s.platform,
    copyrightYear: s.copyrightYear,
    testimonials: s.testimonials,
    mobileReady: s.mobileReady,
    pagesRead: s.pagesRead,
  };
}

module.exports = {
  localize,
  onBrandDomain,
  name: 'gym.score_content',
  title: 'Score one gym',
  description:
    "Reads a gym's website (and its Instagram when 127's Instagram key is set) and scores it: can it pay, how much it needs video, and how to reach the owner. Facts only; anything not checked is marked as such.",
  kind: 'api',
  risk: 'read',
  needs: [],
  wants: ['instagram'],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Gym', description: 'One gym from gym.find_gyms, or at least { name, website }' },
      name: { type: 'string', title: 'Gym name', description: 'Instead of gym: check one gym by name and website' },
      website: { type: 'string', title: 'Its website' },
      city: { type: 'string', title: 'City' },
    },
    required: [],
  },
  output: { type: 'object', properties: { gym: { type: 'object' }, site: { type: 'object' }, content: {}, score: { type: 'object' } }, required: ['gym', 'score'] },

  async run(input, ctx) {
    const given = input.gym || { name: input.name, website: input.website, city: input.city };
    // A Facebook, Instagram, booking or map page given as the website isn't a site of its own (Funnels 0010).
    const own = ownSite(given.website);
    const gym = { owner: 'independent', category: categoryOf({ name: given.name }), key: given.key || `site:${domainOf(own.website) || slugName(given.name)}`, ...given, website: own.website };
    if (own.page) gym.webPage = own.page;
    if (!gym.instagram && own.instagram) gym.instagram = own.instagram;
    if (!gym.facebook && own.facebook) gym.facebook = own.facebook;
    if (!gym.name) throw new Error('Add the gym\'s name.');
    let site;
    let content = null;
    if (gym.sample || ctx.sample) {
      const fake = sampleScans.byName[gym.name] || sampleScans.byName.default;
      site = { ...fake.site, reachable: true, sample: true };
      content = fake.content ? { ...fake.content, sample: true } : null;
    } else {
      site = gym.website
        ? await scanSite(ctx, gym.website, { includeRoot: !onBrandDomain(gym, gym.website) })
        : { reachable: false, reason: gym.webPage ? `Its website link goes to its ${gym.webPage}, not a site of its own.` : 'No website listed.' };
      site = localize(gym, site).site;
      const handle = (site.reachable && site.socials.instagram) || gym.instagram;
      if (handle) content = await businessDiscovery(ctx, handle);
    }
    if (content && content.unavailable) content = { ...content, note: `Instagram not checked (${content.unavailable}).` };
    const year = new Date(ctx.now ? ctx.now() : Date.now()).getUTCFullYear();
    const score = scoreGym(gym, site, content, { year });
    const merged = {
      ...gym,
      email: gym.email || score.contact.email,
      phone: gym.phone || score.contact.phone,
      instagram: score.contact.instagram || gym.instagram || null,
      tiktok: score.contact.tiktok || gym.tiktok || null,
    };
    return { gym: merged, site: trimSite(site), content, score, sample: !!(gym.sample || ctx.sample) };
  },

  view(out) {
    const s = out.score;
    return [
      {
        type: 'cards',
        items: [
          {
            title: out.gym.name,
            subtitle: `Opportunity ${s.opportunity} (${s.tier}) · Content: ${s.content.label}${s.content.basis ? `, from ${s.content.basis}` : ''}`,
            body: [...s.why.canPay, ...s.why.needsHelp, ...s.why.reachable].join('\n'),
            badge: s.tier,
          },
        ],
      },
    ];
  },
};
