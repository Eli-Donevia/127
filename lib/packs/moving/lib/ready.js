// "Look ready" for moving help: the kit's facts tool, with one change until the local pack knows moving
// help (kit change asked for in the report). The only local group with a moving category is "home", a
// handyman's group: painter and junk removal as extra categories, a drywall tip as a post, a mounted TV
// and a paint job as the photos to take, and handyman questions. So the Google profile gets the general
// group, and "mobile moving help", which makes the local pack set a service area and hide the home
// address; the steps say how to pick the category. The flyer keeps the home group (only its icon and
// colors come from it). Wanted instead: a moving group in packs/local/data/niches.json (a moving
// primary category, mobile, with moving photos, posts and questions).

const GBP_GROUP = 'general';
const GBP_WHAT = 'mobile moving help';
const CATEGORY_STEP = 'The kit leaves the primary category to you: type "moving" in Google\'s category box and pick the one closest to what you do.';

function movingProfile(tool) {
  const run = tool.run;
  return {
    ...tool,
    async run(input, ctx) {
      const out = await run.call(tool, input, ctx);
      if (!out) return out;
      if (out.gbp) out.gbp = { ...out.gbp, group: GBP_GROUP, what: GBP_WHAT };
      if (Array.isArray(out.steps)) out.steps = out.steps.map((s) => (/^Google profile:/.test(s) && !s.includes(CATEGORY_STEP) ? `${s} ${CATEGORY_STEP}` : s));
      return out;
    },
  };
}

module.exports = { movingProfile, GBP_GROUP, GBP_WHAT, CATEGORY_STEP };
