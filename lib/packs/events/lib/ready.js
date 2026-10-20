// "Look ready" facts with event coordination words on the website. The kit's readyTool gathers the
// facts once for the site, the Google profile kit and the flyer. The site pack has no profile for
// event coordination, so its generic one would print "the job done right the first time" and ask
// "How much does a job cost?". This adds the headline, the steps, the questions and the closing line
// in our words (output `copy`, which site.build lays over its own draft). Kit change asked for in
// the report: an event coordination profile in packs/site/lib/niches.js (and its "planners" match
// for digital products kept off "event planner"), after which this wrapper can go. It also hands the
// member's promise to the Google profile kit, as the home spine does, so "What if I am not happy?"
// is answered with it (kit change: pass `promise` in C.readyWorkflow's profile step).

const C = require('../../_kit/common');

function eventsReadyTool(N) {
  const base = C.readyTool(N);
  const Y = N.ready;
  return {
    ...base,
    output: { ...base.output, properties: { ...base.output.properties, copy: { type: 'object' } } },
    async run(input, ctx) {
      const out = await base.run(input, ctx);
      const me = C.who(ctx, input);
      const offer = C.offerOf(N, { price: C.priceOf(ctx, N, input) });
      const area = out.site.city || me.area;
      const reach = me.phone ? `Call or text ${me.phone}.` : me.link ? 'Book a free planning call online.' : '';
      const prices = C.serviceLines(N, offer).map((l) => l.short);
      const copy = {
        heroTitle: C.fill(area ? Y.headline : Y.headline.replace(/ in \{area\}$/, ''), { area }),
        heroSub: [Y.sub, reach].filter(Boolean).join(' '),
        steps: Y.site.steps,
        faq: [{ q: 'How much does day-of coordination cost?', a: `${prices.join('. ')}.` }, ...Y.site.faq],
        ctaTitle: Y.site.cta_title,
        ctaSub: [Y.site.cta_sub, reach].filter(Boolean).join(' '),
      };
      return { ...out, gbp: { ...out.gbp, promise: offer.promise }, copy };
    },
  };
}

module.exports = { eventsReadyTool };
