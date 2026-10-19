// Reads the member's own website for its current look: the colors and fonts the page's code sets,
// the text pairs that are hard to read, the main line, and what is missing, then lays out three ways
// to refresh. One public page plus up to 3 of its stylesheets, robots.txt respected. An empty or
// .example address reads sample/site.html (a made-up detailing site) and is marked sample.

const fs = require('fs');
const path = require('path');
const { views, web, text, brain } = require('../../_kit');
const scan = require('../../_kit/scan');
const R = require('../lib/refresh');
const { specFrom } = require('../lib/kit');
const { nicheFor } = require('../lib/lexicon');

const SAMPLE = path.join(__dirname, '..', 'sample', 'site.html');
const TITLES = { fonts: 'Too many fonts', script: 'A decorative font', favicon: 'No favicon', description: 'No page description', title: 'Page title', h1: 'Main line', noh1: 'No main line', mobile: 'Phones' };
const SAMPLE_URL = 'https://reyes-detailing.example/';

// A favicon the page links, or /favicon.ico answering with an image.
async function faviconOf(ctx, page, url, html) {
  if (page.images && page.images.icon) return true;
  // Unquoted attributes count too (rel=icon href=/icon.png); an empty data: icon does not.
  if (/<link[^>]+rel\s*=\s*["']?(?:shortcut\s+)?(?:apple-touch-)?icon\b[^>]*href\s*=\s*["']?(?!data:,)[^"'\s>]+/i.test(html)) return true;
  try {
    const r = await web.getText(ctx, `${new URL(url).origin}/favicon.ico`, { timeoutMs: 6000, maxBytes: 200000, headers: { Accept: 'image/*' } });
    const type = r.headers && typeof r.headers.get === 'function' ? r.headers.get('content-type') || '' : '';
    return !!(r.ok && /image|icon|octet/i.test(type));
  } catch {
    return null;
  }
}

module.exports = {
  name: 'brand.read_site',
  title: "Read your website's look",
  description: 'Reads your own website for the colors and fonts its code sets, the text pairs that are hard to read, your main line and what is missing, then lays out three ways to refresh: your colors fixed, your main color with a new accent, or a fresh start.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      url: { type: 'string', title: 'Your website', description: 'Starts with https://. Leave it empty to try a sample site.', maxLength: 300 },
      name: { type: 'string', title: 'Business name (optional)', maxLength: 60 },
      what: { type: 'string', title: 'What you sell (optional)', maxLength: 200 },
      color: { type: 'string', title: 'A new direction (optional)', description: 'A hex like #0f766e, or a mood: bold, calm, warm, fresh, premium, playful, earthy, clean', maxLength: 20 },
    },
  },
  output: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      what: { type: 'string' },
      site: { type: 'object' },
      current: { type: 'object' },
      fonts: { type: 'object' },
      checks: { type: 'array' },
      issues: { type: 'array' },
      issueKeys: { type: 'array' },
      options: { type: 'array' },
      sample: { type: 'boolean' },
    },
    required: ['site', 'current', 'options'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const given = web.normalizeUrl(input.url || b.website || '');
    const sample = !given || /\.example$/i.test(web.domainOf(given));
    let html;
    let url;
    let css = '';
    let favicon;
    let sheets = 0;
    if (sample) {
      html = fs.readFileSync(SAMPLE, 'utf8');
      url = SAMPLE_URL;
      favicon = false;
    } else {
      const r = await web.fetchPage(ctx, given);
      if (!r.html) {
        const why = r.blocked ? 'Your site asks bots not to read it' : r.status ? `Your site answered ${r.status}` : r.notHtml ? 'That address is not a web page' : r.error === 'timeout' ? 'Your site took too long to answer' : "We couldn't reach your site";
        throw new Error(`${why}. Check the address, or leave it empty to see how this works on a sample site.`);
      }
      html = r.html;
      url = r.url || given;
      for (const href of R.stylesheetLinks(html, url)) {
        if (!(await web.allowed(ctx, href))) continue;
        try {
          const s = await web.getText(ctx, href, { timeoutMs: 8000, maxBytes: 600000, headers: { Accept: 'text/css,*/*;q=0.1' } });
          if (s.ok && !/<html/i.test(s.text.slice(0, 300))) {
            css += `\n${s.text}`;
            sheets += 1;
          }
        } catch {
          /* a stylesheet that won't load is skipped */
        }
      }
    }
    const page = scan.tidy(scan.parsePage(html, url));
    // Nobody said what the business sells in words we know (a brain niche can be just "Local service"):
    // the page usually does.
    const known = nicheFor(`${b.what || ''} ${b.niche || ''}`).id !== 'generic';
    const spec = specFrom({ ...input, what: input.what || (known ? undefined : R.whatFromPage(page) || undefined) }, ctx);
    if (!sample) favicon = await faviconOf(ctx, page, url, html);
    const rules = R.rulesOf(`${R.inlineCss(html)}\n${css}`);
    const fonts = R.fontsFrom(rules, html);
    const current = R.colorsFrom(rules, html);
    const checks = R.checksFrom(current);
    const issues = R.issuesFrom({ page: { ...page, favicon }, fonts, checks });
    const options = R.optionsFor(current, spec, { seed: String(input.color || '').trim().toLowerCase() || undefined });
    const name = spec.name || text.oneLine(String(page.title || '').split(/\s+[|–—:-]\s+/)[0]).slice(0, 60);
    const site = {
      url,
      domain: web.domainOf(url),
      title: page.title || '',
      description: page.description || '',
      h1: page.h1 || '',
      platform: page.platform || '',
      mobileReady: !!page.mobileReady,
      favicon: favicon == null ? null : !!favicon,
      stylesheets: sheets,
      words: page.words || 0,
    };
    ctx.log(`Read ${site.domain}${sample ? ' (sample site)' : ''}: ${current.found.length} colors, ${text.plural(fonts.all.length, 'font')}, ${checks.filter((c) => !c.pass).length} hard-to-read pairs.`);
    return {
      name,
      what: spec.what || '',
      site,
      current: { primary: current.primary, accent: current.accent, ink: current.ink, paper: current.paper, source: current.source, found: current.found.slice(0, 8) },
      fonts,
      checks,
      issues: issues.map((i) => i.text),
      issueKeys: issues.map((i) => i.key),
      options,
      sample,
    };
  },
  view(out) {
    const c = out.current;
    const bad = out.checks.filter((x) => !x.pass).length;
    const keys = out.issueKeys || [];
    const found = out.issues.map((t, i) => ({ t, k: String(keys[i] || '') }));
    const hard = found.filter((x) => x.k.startsWith('contrast:'));
    const cards = [
      ...(hard.length ? [{ title: `${text.plural(hard.length, 'text pair')} hard to read`, body: hard.map((x) => x.t).join(' ') }] : []),
      ...found.filter((x) => !x.k.startsWith('contrast:')).map((x) => ({ title: TITLES[x.k] || 'Worth fixing', body: x.t })),
    ];
    return views.blocks(
      out.sample ? views.text('This reads a sample site for a made-up business. Add your own website address to read yours.') : null,
      views.metric('Hard-to-read pairs', bad, `${out.site.domain}: ${c.primary ? `main color ${c.primary.toUpperCase()}` : 'no brand color in the code'}${out.fonts.all.length ? `, fonts ${text.list(out.fonts.all.slice(0, 3))}` : ''}`),
      cards.length ? views.cards(cards) : views.text('Nothing to fix in the colors and fonts we could read.'),
      views.cards(out.options.map((o) => ({ title: `${o.n}. ${o.label}`, subtitle: o.name, body: o.why, badge: o.pass ? 'All pairs pass' : 'Check pairs' })))
    );
  },
};
