// "Look ready" for pool cleaning: the kit's facts tool, with three changes until the shared packs
// know pools (kit change asked for in the report).
// - Google profile: the local pack has no pool group yet, so the profile would read as a business
//   with an address customers visit. Pool cleaning happens at the customer's home, so the profile's
//   "what" says mobile, and the local pack then tells the member to set a service area and hide
//   their home address. With no pool group the kit has no primary category to suggest, so the steps
//   say how to pick one.
// - Website: the site pack reads "cleaning" as house cleaning (a kitchen photo, "a home that feels
//   calm and fresh"), so the site gets "pool service", which reads as the site pack's general local
//   service.
// Wanted instead: a pool group in packs/local/data/niches.json (primary category "Pool cleaning
// service", mobile), GROUP.pool in packs/_kit/home/ready.js and a pool niche in packs/site/lib/niches.js.

const SERVICE_AREA = 'mobile pool cleaning';
const SITE_WHAT = 'pool service';
const CATEGORY_STEP = 'The kit leaves the primary category to you: type "pool" in Google\'s category box and pick the one closest to what you do.';

function serviceArea(tool) {
  const run = tool.run;
  return {
    ...tool,
    async run(input, ctx) {
      const out = await run.call(tool, input, ctx);
      if (!out) return out;
      if (out.gbp && !/\bmobile\b/i.test(String(out.gbp.what || ''))) out.gbp = { ...out.gbp, what: SERVICE_AREA };
      if (out.site && /\bcleaning\b/i.test(String(out.site.what || ''))) out.site = { ...out.site, what: SITE_WHAT };
      if (Array.isArray(out.steps)) out.steps = out.steps.map((s) => (/^Google profile:/.test(s) && !s.includes(CATEGORY_STEP) ? `${s} ${CATEGORY_STEP}` : s));
      return out;
    },
  };
}

module.exports = { serviceArea, SERVICE_AREA, SITE_WHAT, CATEGORY_STEP };
