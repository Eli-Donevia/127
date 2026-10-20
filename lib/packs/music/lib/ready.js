// "Look ready" facts with music lesson words on the website. The kit's readyTool gathers the facts
// once for the site, the Google profile kit and the flyer. The site pack files music teachers under
// its tutoring profile, whose headline and the line under it say "help with schoolwork", so this adds
// the headline and that line in music lesson words (output `copy`, which site.build lays over its own
// draft). No `audience` in the site facts: the coach design would print it with the same tutoring
// line. Kit change asked for in the report: a music lessons profile in packs/site/lib/niches.js,
// after which this wrapper can go.

const { text } = require('../../_kit');
const C = require('../../_kit/common');

function musicReadyTool(N) {
  const base = C.readyTool(N);
  const Y = N.ready;
  return {
    ...base,
    output: { ...base.output, properties: { ...base.output.properties, copy: { type: 'object' } } },
    async run(input, ctx) {
      const out = await base.run(input, ctx);
      const me = C.who(ctx, input);
      const what = text.sentenceCase(out.site.what || N.what);
      const area = out.site.city || me.area;
      const heroTitle = area ? C.fill(Y.site_title, { What: what, area }) : what;
      const reach = me.phone ? `Call or text ${me.phone}.` : me.link ? 'Book a free first call online.' : '';
      const heroSub = [me.first ? `I'm ${me.first}.` : '', Y.site_sub, reach].filter(Boolean).join(' ');
      return { ...out, copy: { heroTitle, heroSub } };
    },
  };
}

module.exports = { musicReadyTool };
