// Testimonials a business shows on its own website: the homepage and, when it links one, its own
// testimonials or reviews page (robots.txt respected, cached 7 days, public pages only). Never a
// review site or a social profile: those links are refused with a plain line, and the member copies
// what they want by hand. Names, dates and stars are left out. Sample (.example) sites read their
// made-up pages, which show no testimonials.

const { views, web, leads, text } = require('../../_kit');
const { refusedHost, testimonialsFrom, testimonialPage } = require('../lib/reviews');

const REFUSED = (host) => `We don't read review sites or social pages (${host}). Open the page, copy the reviews you want and paste them in.`;

async function read(ctx, url) {
  if (leads.isSampleUrl(url)) {
    const year = typeof ctx.now === 'function' ? new Date(ctx.now()).getUTCFullYear() : 2026;
    const { html } = leads.sampleSiteHtml(url, { year });
    return { testimonials: testimonialsFrom(html).map((t) => ({ text: t, page: '/' })), pages: 1 };
  }
  // A site that didn't answer isn't cached: the next run tries again.
  let failed = null;
  const got = await web.cached(ctx, `intel:testimonials:v1:${web.domainOf(url)}${new URL(url).pathname.replace(/\/$/, '')}`, 24 * 7, async () => {
    const home = await web.fetchPage(ctx, url);
    if (!home.html) {
      failed = home.blocked ? 'robots' : home.status ? `answered ${home.status}` : 'unreachable';
      return null;
    }
    const out = testimonialsFrom(home.html).map((t) => ({ text: t, page: pathOf(home.url) }));
    let pages = 1;
    const more = testimonialPage(home.html, home.url);
    if (more && more.replace(/\/$/, '') !== home.url.replace(/\/$/, '') && !refusedHost(more)) {
      const p = await web.fetchPage(ctx, more);
      if (p.html) {
        pages++;
        for (const t of testimonialsFrom(p.html, { max: 30 })) if (!out.some((x) => x.text.slice(0, 80) === t.slice(0, 80))) out.push({ text: t, page: pathOf(p.url || more) });
      }
    }
    return { testimonials: out.slice(0, 30), pages };
  });
  return got || { failed: failed || 'unreachable' };
}

function pathOf(u) {
  try {
    return new URL(u).pathname || '/';
  } catch {
    return '/';
  }
}

module.exports = {
  name: 'intel.read_testimonials',
  title: "Read their website's testimonials",
  description: 'Reads the testimonials a business shows on its own website (homepage and its own testimonials page). Never reads review sites; names are left out.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      website: { type: 'string', title: 'Their website (optional)', description: 'The business\'s own site, like "copperyoga.com". Not Google, Yelp or Facebook.' },
    },
  },
  output: {
    type: 'object',
    properties: { site: { type: ['string', 'null'] }, testimonials: { type: 'array' }, pages: { type: 'integer' }, notes: { type: 'array' }, refused: { type: ['string', 'null'] }, sample: { type: 'boolean' } },
    required: ['testimonials', 'pages', 'notes'],
  },
  async run(input, ctx) {
    const raw = String(input.website || '').trim();
    if (!raw) return { site: null, testimonials: [], pages: 0, notes: [], refused: null, sample: false };
    const url = web.normalizeUrl(raw);
    if (!url) return { site: null, testimonials: [], pages: 0, notes: [`"${text.clip(raw, 60)}" isn't a website address, so we only read what you pasted.`], refused: null, sample: false };
    const host = refusedHost(url);
    if (host) {
      ctx.log(`Skipped ${host}: review sites and social pages are never read`);
      return { site: host, testimonials: [], pages: 0, notes: [REFUSED(host)], refused: host, sample: false };
    }
    const site = web.shortSite(url);
    const sample = leads.isSampleUrl(url);
    const r = await read(ctx, url);
    if (r.failed) {
      const why = r.failed === 'robots' ? 'asks bots not to read it, so we didn\'t' : r.failed === 'unreachable' ? "didn't answer" : r.failed;
      return { site, testimonials: [], pages: 0, notes: [`${site} ${why}. Paste the reviews you want read instead.`], refused: null, sample };
    }
    const notes = [];
    if (!r.testimonials.length) notes.push(`${site} doesn't show testimonials we could read on its own pages${sample ? ' (a sample site)' : ''}.`);
    ctx.log(`Read ${r.pages} ${r.pages === 1 ? 'page' : 'pages'} on ${site}: ${r.testimonials.length} testimonials`);
    return { site, testimonials: r.testimonials, pages: r.pages, notes, refused: null, sample };
  },
  view(out) {
    if (!out.site) return [views.text('No website given: reading only the reviews you pasted.')];
    return views.blocks(
      views.metric('Testimonials on their website', out.testimonials.length, out.site),
      out.testimonials.length ? views.cards(out.testimonials.slice(0, 3).map((t) => ({ title: `"${text.clip(t.text, 140)}"`, subtitle: `On ${out.site}${t.page && t.page !== '/' ? t.page : ''}` }))) : null,
      out.notes.map((n) => views.text(n))
    );
  },
};
