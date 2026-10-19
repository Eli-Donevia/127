// Reads one business's own website (kit scan: up to 3 public pages, robots respected) and turns it
// into a lead: what the site shows, what it's missing, and signs it's a good first client.
// Sample (.example) sites get a sample scan. Used in `each` steps; viewMany shows one table.

const { views, web, leads, text } = require('../../_kit');

module.exports = {
  name: 'leads.scan_business',
  title: 'Check their website',
  description: "Reads a business's own website and lists what it is missing (no booking, no video, not phone-ready, old footer and 30 more checks), facts only.",
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      business: { type: 'object', title: 'Business', description: 'A place from leads.find_businesses, or { website, name }' },
      website: { type: 'string', title: 'Website', description: 'Used when business is not given' },
      category: { type: ['object', 'string'], title: 'Kind of business' },
      city: { type: 'string' },
    },
  },
  output: { type: 'object', properties: { key: { type: 'string' }, gaps: { type: 'array' }, siteStatus: { type: 'string' } }, required: ['key', 'gaps', 'siteStatus'] },
  async run(input, ctx) {
    const place = input.business && typeof input.business === 'object' ? { ...input.business } : {};
    if (!place.website && input.website) place.website = web.normalizeUrl(input.website);
    if (!place.website && !place.name) throw new Error('Add a website to check.');
    const cat = input.category ? require('../../_kit').places.categoryOf(typeof input.category === 'object' ? input.category.id || input.category.label : input.category) : null;
    const category = input.category && typeof input.category === 'object' && input.category.one ? input.category : cat;
    const scan = place.website ? await leads.scanFor(ctx, place.website) : null;
    const broken = place.website && scan && scan.reachable ? await leads.brokenLinkCheck(ctx, place.website, scan) : false;
    if (!place.name && scan && scan.reachable && !scan.parked && !leads.siteName(scan)) {
      // A site the member typed: the first part of its own title ("Tartine Bakery, ..." -> "Tartine Bakery").
      const t = text.plain(String(scan.title || '').split(/\s+[|:\-\u2013\u2014]\s+|\s*[|,]\s*/)[0]).trim();
      if (t && t.length <= 40 && t.split(/\s+/).length <= 4 && !/^(home|welcome|index)$/i.test(t)) place.name = t;
    }
    const lead = leads.makeLead(place, scan, { now: ctx.now(), category, city: input.city || '', brokenLink: broken });
    if (!lead.siteName && place.name && !input.business) lead.siteName = place.name;
    // A LocationIQ city lookup found this place: its lists show LocationIQ's link (Legal L57).
    if (place.searchBy) lead.searchBy = place.searchBy;
    // OpenStreetMap opening hours (the call sheet and walk-in route show them).
    if (place.hours && place.source !== 'google') lead.hours = text.clip(text.oneLine(place.hours), 120);
    return lead;
  },
  view(lead) {
    return views.blocks(
      views.metric(lead.name, lead.gaps.length ? `${lead.gaps.length} things missing` : 'Nothing obvious missing', lead.siteNote || (lead.website ? web.shortSite(lead.website) : 'No website')),
      views.table([{ key: 'chip', label: 'Missing' }, { key: 'why', label: 'What we saw' }], lead.gaps.map((g) => ({ chip: g.chip, why: g.why })), 12)
    );
  },
  viewMany(list) {
    const rows = list.map((l) => ({ name: l.name, status: { ok: 'Checked', none: 'No website', down: 'Not loading', parked: 'Placeholder', blocked: 'Bot wall', unchecked: "Couldn't check" }[l.siteStatus] || l.siteStatus, missing: text.clip(leads.shareableGaps(l).map((g) => g.chip).join(', '), 90) || 'Nothing obvious', site: l.website ? web.shortSite(l.website) : '' }));
    const ok = list.filter((l) => l.siteStatus === 'ok').length;
    return views.blocks(
      views.metric('Websites checked', ok, `of ${list.length} businesses`),
      views.table([{ key: 'name', label: 'Business' }, { key: 'status', label: 'Website' }, { key: 'missing', label: 'What is missing' }, { key: 'site', label: 'Site' }], rows, 10)
    );
  },
};
