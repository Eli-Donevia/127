// gym.scorecard: the free Video Scorecard for one gym, as an image to send with the sample Reel (DM or
// email) and as a web page. It shows the owner what we checked, how they compare with the nearest gyms
// and the three videos the member would make first. The lead magnet that does the selling.

const { scorecardData, svgCard, htmlPage, accentFor } = require('../lib/scorecard');
const { saveCard } = require('../lib/render-card');
const { slug } = require('../lib/util');

module.exports = {
  name: 'gym.scorecard',
  title: 'Make their free Video Scorecard',
  description: "A one-page Video Scorecard for one gym: what we checked on its website and Instagram, how it compares with the nearest gyms, and the 3 videos you'd make first. An image to send with the sample, plus a web page.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Gym', description: 'One ranked gym from gym.find_gaps' },
      madeWith127: { type: 'boolean', title: 'Show "Made with 127"', default: true },
    },
    required: ['gym'],
  },
  output: { type: 'object', properties: { image: { type: 'object' }, page: { type: 'object' } }, required: ['page'] },

  async run(input, ctx) {
    const row = input.gym || {};
    if (!row.gym || !row.gym.name) throw new Error('Pick a gym first.');
    const now = ctx.now ? ctx.now() : Date.now();
    const tz = (ctx.member && ctx.member.timezone) || 'America/Chicago';
    const date = new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz });
    const data = scorecardData(row, { member: ctx.member || {}, business: (ctx.brain && ctx.brain.business) || {}, date, madeWith127: input.madeWith127 !== false });
    const accent = accentFor(row);
    const name = slug(row.gym.name);
    const warnings = [];
    const page = await ctx.save(`scorecards/${name}.html`, htmlPage(data, { accent }), { type: 'text/html' });
    const { image, png } = await saveCard(ctx, svgCard(data, { accent }), `scorecards/${name}`);
    if (!png) warnings.push("Couldn't turn the scorecard into an image here, so it's saved as an SVG.");
    if (data.score == null) warnings.push("We couldn't check this gym's website or Instagram, so the scorecard has no score. Add a screenshot of their Instagram first.");
    return { gym: row.gym.name, image, page, data, warnings, sample: !!row.sample };
  },

  view(out) {
    const blocks = [];
    if (out.image && out.image.type === 'image/png') blocks.push({ type: 'image', asset: out.image, caption: `Send this with the sample Reel. Every line is something we checked on ${out.gym}'s public pages.` });
    blocks.push({ type: 'file', asset: out.page, label: 'The same scorecard as a web page' });
    if (out.warnings.length) blocks.push({ type: 'text', text: out.warnings.join('\n') });
    return blocks;
  },
};
