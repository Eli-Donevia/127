// Builds the whole website folder from the member's facts, the design and the approved words:
// index.html, thanks and 404 pages, placeholder photos in their colors, share image, icons,
// robots.txt, sitemap.xml, _headers and a plain README.txt with the free deploy steps, zipped for
// Netlify Drop. Also saves a one-file preview and the share image. Code only (ffmpeg for images).

const { views, save, brain, text } = require('../../_kit');
const hosting = require('../data/hosting.json');
const { factsFrom } = require('../lib/facts');
const { rankTemplates } = require('../lib/pick');
const { draftCopy, fromItems, wordsKind } = require('../lib/copy');
const { getTemplate } = require('../lib/templates');
const { buildSite } = require('../lib/site');
const { madeWithOf } = require('../lib/privacy');

const designId = (d) => {
  const x = Array.isArray(d) ? d[0] : d;
  return typeof x === 'string' ? x : x && x.id;
};

// For a prospect: one short note to send with the sample (no claims, no price). For a client: the same
// share lines as the member's own site, labeled as theirs to send.
function prospectMessages(c) {
  return [{ label: 'A short note to send with the sample', text: `Hi, I made this sample homepage for ${c.name} so you can see what it could look like on a phone. It is not live anywhere, and it's yours to keep either way. Want me to walk you through it?` }];
}

function shareMessages(c) {
  const url = c.siteUrl;
  const has = [c.menu && c.menu.length ? 'the menu' : c.services.some((x) => x.priceText) ? 'prices' : '', c.hoursLine ? 'hours' : '', c.booking ? 'booking' : c.orderLinks && c.orderLinks.length ? 'ordering' : ''].filter(Boolean);
  const act = has.length > 1 ? `${has.slice(0, -1).join(', ')} and ${has[has.length - 1]} are all on one page.` : has.length ? `${has[0].charAt(0).toUpperCase()}${has[0].slice(1)} ${has[0] === 'prices' ? 'are' : 'is'} on the page.` : 'Everything is on one page.';
  return [
    { label: 'Text to friends and past customers', text: `${c.name} has a website now: ${url} ${act.charAt(0).toUpperCase()}${act.slice(1)} If you know someone who could use it, I'd love it if you passed it on.` },
    { label: 'Instagram or TikTok bio', text: `${c.whatShort ? `${c.whatShort.charAt(0).toUpperCase()}${c.whatShort.slice(1)}` : c.name}${c.area && !c.online ? ` in ${c.city || c.area}` : ''}. ${c.primary && c.primary.label ? `${c.primary.label}:` : 'More:'} ${url.replace(/^https:\/\//, '').replace(/\/$/, '')}` },
    // An online business (a creator, a shop with no storefront) has no Google Business Profile to fill.
    c.online ? null : { label: 'Website field on your Google Business Profile', text: url },
  ].filter(Boolean);
}

// A brief's motion as it arrives from a form: blanks dropped and alive as "tap, scroll" read as a list.
// resolveChoreo then keeps the valid values and falls back for the rest.
function motionOf(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(m)) {
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) continue;
    out[k] = k === 'alive' && typeof v === 'string' ? v.split(/[\s,]+/).filter(Boolean) : v;
  }
  return Object.keys(out).length ? out : undefined;
}

module.exports = {
  name: 'site.build',
  title: 'Build the website',
  description: 'Makes your one-page website folder (page, photos placeholders, share image, icons, search files and deploy steps) as a ZIP you drag onto Netlify Drop to put online free.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 3,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      facts: { type: 'object', title: 'Your business facts' },
      design: { title: 'Design', description: 'A design id, or the design you picked' },
      copy: { title: 'Words', description: 'The approved words (items from the review step), or leave out to use the written draft' },
      for: { type: 'string', enum: ['me', 'prospect', 'client'], default: 'me', title: 'Who the site is for', description: "me: your own site (gaps filled from your profile). prospect: a free sample for a business you pitch (only the facts given, a sample note on top, kept out of search). client: a paying client's site (only the facts given)." },
      maker: { type: 'string', maxLength: 80, title: 'Who made the sample (prospect only)', description: 'Your name or business, for the sample note. Leave empty to use your profile.' },
      note: { type: 'string', maxLength: 240, title: 'Sample note (prospect only)', description: 'Replaces the line at the top of a sample page.' },
      madeWith: {
        title: 'Made with 127 link',
        description: 'true adds a small "Made with 127" link next to the Privacy link in the footer, to the free website builder. Or { text, path }: other words and a page on 127group.io (a path like /challenge?ref=CODE). Sites from the free website builder have it.',
      },
      motion: {
        type: 'object',
        title: 'Motion (from a site brief)',
        description: "Overrides the design's own motion field by field: intro (assemble, develop, pour, unfold, type, mask, stamp, draw, none), alive (a list of drift, pointer, tap, scroll, or just still), scroll (scrub, pin, scene, none), pace (calm, medium, fast) and look (free words, kept). Unknown values fall back to the design's. See lib/choreo.md.",
      },
    },
  },
  output: {
    type: 'object',
    properties: {
      business: { type: 'string' },
      design: { type: 'string' },
      siteUrl: { type: 'string' },
      zip: { type: 'object' },
      preview: { type: 'object' },
      shareImage: { type: ['object', 'null'] },
      files: { type: 'array' },
      stats: { type: 'object' },
      share: { type: 'array' },
      mode: { type: 'string' },
    },
    required: ['design', 'siteUrl', 'zip', 'files'],
  },
  async run(input, ctx) {
    const mode = ['prospect', 'client'].includes(input.for) ? input.for : 'me';
    const f = factsFrom(ctx, input.facts || {}, { own: mode === 'me' });
    if (mode !== 'me' && !f.name) throw new Error("Add the business's name to build a site for them.");
    const id = designId(input.design) || rankTemplates(f)[0].id;
    getTemplate(id);
    const base = draftCopy(f, wordsKind(f, getTemplate(id).kind || id));
    const copy = Array.isArray(input.copy) ? fromItems(input.copy, base) : input.copy && typeof input.copy === 'object' ? { ...base, ...input.copy } : base;
    const br = brain.brainOf(ctx, {});
    const maker = text.oneLine(input.maker || [br.firstName, br.name].filter(Boolean).join(', '));
    const madeWith = madeWithOf(input.madeWith, (process.env.BASE_URL || 'https://127group.io').replace(/\/$/, ''));
    const r = await buildSite(ctx, { facts: f, template: id, copy, mode, maker, sampleNote: input.note || '', motion: motionOf(input.motion), madeWith });
    const slug = f.slug || 'my';
    const tag = mode === 'prospect' ? '-sample' : '';
    const zip = await save.saveFile(ctx, `${slug}${tag}-website.zip`, r.zip, 'application/zip');
    const preview = await save.saveFile(ctx, `${slug}${tag}-preview.html`, r.preview, 'text/html');
    const shareImage = r.ogPng && mode !== 'prospect' ? await save.saveFile(ctx, `${slug}-share.png`, r.ogPng, 'image/png') : null;
    // Only the member's own site is remembered as theirs.
    if (mode === 'me') await brain.remember(ctx, 'site', { url: r.c.siteUrl, design: id, built: r.c.today });
    ctx.log(`Built ${r.files.length} files for ${f.name} on the ${getTemplate(id).name} design (${Math.round(r.stats.htmlBytes / 1024)} KB page)${mode === 'prospect' ? ', marked as a sample' : ''}`);
    return {
      mode,
      business: f.name,
      design: id,
      designName: getTemplate(id).name,
      siteUrl: r.c.siteUrl,
      zip,
      preview,
      shareImage,
      files: r.files.map((x) => x.name),
      stats: r.stats,
      rendered: r.rendered,
      share: mode === 'prospect' ? prospectMessages(r.c) : mode === 'client' ? shareMessages(r.c).map((m) => ({ ...m, label: `For ${f.name} to use: ${m.label.charAt(0).toLowerCase()}${m.label.slice(1)}` })) : shareMessages(r.c),
      photos: Object.values(r.c.images).map((im) => ({ file: im.src, size: `${im.w} x ${im.h}`, alt: im.alt })),
      privacyLabel: mode === 'prospect' ? '' : r.privacy.label,
      // A site doesn't go online without a way to reach the business, and a store not without its policies (Legal L76).
      ready: !r.blockers.length,
      blockers: r.blockers,
    };
  },
  view(out) {
    if (out.mode === 'prospect') {
      return views.blocks(
        views.text(`Sample homepage for ${out.business} on the ${out.designName} design. It says it's a sample at the top and is kept out of search. Check every line against their own website before you show it.`),
        views.file(out.preview, 'The sample page (opens in any browser)'),
        views.file(out.zip, 'The sample site folder (ZIP), for after they say yes'),
        views.table([{ key: 'file', label: 'Photo to ask them for' }, { key: 'alt', label: 'What it should show' }], out.photos || [], 6),
        (out.share || []).map((s) => views.copy(s.label, s.text))
      );
    }
    if (out.blockers && out.blockers.length) {
      return views.blocks(
        views.metric('Almost ready to put online', out.siteUrl, `Before it goes online: ${out.blockers.join(' ')} Then build it again.`),
        views.file(out.preview, 'Preview the page in your browser'),
        out.privacyLabel ? views.text(`privacy.html is your site's privacy notice, linked in every footer. ${out.privacyLabel}`) : null
      );
    }
    return views.blocks(
      views.metric(out.mode === 'client' ? `${out.business}'s website is ready to put online` : 'Your website is ready to put online', out.siteUrl, `${out.files.length} files, ${Math.round(out.stats.htmlBytes / 1024)} KB page. Free on Netlify: drag the ZIP onto Netlify Drop, then claim it with a free account${out.mode === 'client' ? ' in their name' : ''}.`),
      views.file(out.zip, 'Website folder (ZIP) for Netlify Drop'),
      views.file(out.preview, 'Preview the page in your browser'),
      views.image(out.shareImage, 'What people see when you share your link'),
      views.link('Open Netlify Drop', hosting.netlify.dropUrl),
      out.privacyLabel ? views.text(`privacy.html is your site's privacy notice, linked in every footer. ${out.privacyLabel}`) : null,
      views.text(out.mode === 'client' ? `Next: put it on ${out.business}'s own Netlify account (drag the ZIP onto Netlify Drop, then claim it with their email) so they own it. README.txt in the ZIP has every step, plus how to send form messages to their inbox.` : 'Next: drag the ZIP onto Netlify Drop, sign up free to claim the site, then rename it in Site configuration so your address matches. README.txt in the ZIP has every step, plus how to turn on the contact form.'),
      views.table(
        [
          { key: 'file', label: 'Photo to replace' },
          { key: 'size', label: 'Size' },
          { key: 'alt', label: 'What it should show' },
        ],
        out.photos || [],
        8
      ),
      (out.share || []).map((s) => views.copy(s.label, s.text))
    );
  },
};
module.exports.motionOf = motionOf;
