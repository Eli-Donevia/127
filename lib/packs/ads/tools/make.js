// The ad desk's makers: ad images in three sizes, a Google search campaign as a Google Ads Editor
// CSV, a check of the page the ads send people to, and a brief for a creator who films ads. Every
// line of ad copy passes claims.js (no income claims, no promised results); nothing is posted,
// imported or spent for the member.

const fs = require('fs');
const path = require('path');
const { text, views, save, files, money, time, color, brain, media, web, scan, outreach } = require('../../_kit');
const A = require('../lib/ads');
const C = require('../lib/claims');
const CR = require('../lib/creative');
const ED = require('../lib/editor');
const LP = require('../lib/landing');
const CREATORS = require('../data/creators.json');
const { page, table, esc } = require('../lib/page');
const { NUM_INPUTS, SERVICE } = require('./desk');

const sc = (s) => text.sentenceCase(String(s || '').trim());
const noEnd = (s) => String(s || '').trim().replace(/[.?!]+$/, '');
const hex = (v) => (color.isHex(v) ? color.rgbToHex(color.hexToRgb(v)) : '');
const seedOf = (ctx, input) => hex(input.color) || hex((brain.packMemory(ctx, 'brand') || {}).primary) || 'bold';
const isSampleHost = (u) => /\.example(\/|$|:)/i.test(String(u || '').replace(/^https?:\/\//, ''));

// A member's photo, scaled down, as a data URI for the SVG.
async function photoUri(ctx, id) {
  const a = await ctx.asset(id);
  if (!a || !a.path) throw new Error('No photo.');
  const dir = fs.mkdtempSync(path.join(typeof ctx.tmpdir === 'function' ? ctx.tmpdir() : require('os').tmpdir(), 'adphoto-'));
  const out = path.join(dir, 'photo.jpg');
  await media.ffmpeg(['-y', '-i', a.path, '-vf', 'scale=1440:-2', '-frames:v', '1', '-q:v', '3', out], { timeoutSec: 60, signal: ctx.signal });
  return `data:image/jpeg;base64,${fs.readFileSync(out).toString('base64')}`;
}

// ---------- ad images ----------

const adImages = {
  name: 'ads.ad_images',
  title: 'Make ad images',
  description: 'Designs ad images in your colors for up to 3 angles, each in three sizes: square and portrait for the feed and 9:16 for Stories and Reels with every word inside the safe zone. Uses a photo of your own work when you add one. Saves all the PNGs in one ZIP, a preview of them all, and the ad text to go with each.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  lane: 'render',
  timeoutSec: 300,
  credits: 4,
  input: {
    type: 'object',
    properties: {
      angles: { type: 'array', description: 'Angles from ads.find_angles. Leave out for the top 3.' },
      photo: { type: 'string', format: 'asset', accept: 'image/*', title: 'A photo of your own work (optional)' },
      color: { type: 'string', title: 'Brand color (optional)', description: 'A hex color like #0f766e', maxLength: 7 },
      price: NUM_INPUTS.price,
      service: SERVICE,
    },
  },
  output: {
    type: 'object',
    properties: {
      ads: { type: 'array' },
      zip: { type: ['object', 'null'] },
      preview: { type: ['object', 'null'] },
      rendered: { type: 'boolean' },
      notes: { type: 'array' },
      colors: { type: 'object' },
    },
    required: ['ads', 'rendered'],
  },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    A.needService(f);
    const cols = CR.colorsFor(seedOf(ctx, input));
    const notes = [];
    let photo = null;
    if (input.photo) {
      try {
        photo = await photoUri(ctx, input.photo);
      } catch (e) {
        if (/^Stopped\.?$/.test(String(e && e.message))) throw e;
        notes.push("We couldn't read the photo, so these ads use type only.");
      }
    }
    let list = (Array.isArray(input.angles) && input.angles.length ? input.angles : A.angles(f)).filter((a) => a && a.key);
    if (!photo && list.some((a) => a.key === 'proof')) notes.push('The before and after angle needs a photo of your own work, so it was left out. Add a photo and run it again.');
    if (!photo) list = list.filter((a) => a.key !== 'proof');
    if (!list.length) list = A.angles(f).filter((a) => a.key !== 'proof');
    list = list.slice(0, 3);
    const ads = list.map((a) => {
      const w = CR.wordsFor(f, a, { photo: !!photo });
      const m = A.metaAd(f, a);
      const primary = C.firstOk([ED.weVoice(m.primary), `${sc(f.service)}${f.city ? ` in ${f.city}` : ''}. Tap to book.`]);
      const headline = C.firstOk([m.headline, text.clip(sc(f.service), 27)]);
      return { key: a.key, name: a.name, words: w, primary, headline, description: C.firstOk([m.description, 'Easy to book']) };
    });
    const base = save.fileName(f.name || f.service, 'ad images');
    const stem = base.replace(/\.[a-z]+$/, '');
    let zip = null;
    let preview = null;
    let rendered = false;
    const svgs = [];
    ads.forEach((ad, i) => {
      for (const s of CR.SIZES) svgs.push({ name: `${i + 1}-${ad.key}-${s.id}-${s.w}x${s.h}`, svg: CR.adSvg(ad.words, s, cols, { photoUri: photo, uid: `a${i}${s.id}` }), ad, size: s });
    });
    const rows = ads.map((ad, i) => ({ label: `${i + 1}. ${ad.name}`, ads: Object.fromEntries(CR.SIZES.map((s) => [s.id, CR.adBody(ad.words, s, cols, { photoUri: photo, uid: `p${i}${s.id}` })])) }));
    const title = `Ad images for ${f.name || f.service}`;
    if (media.canRender(ctx)) {
      try {
        const pngs = [];
        for (const x of svgs) pngs.push({ name: `${x.name}.png`, data: await media.svgToPng(ctx, x.svg) });
        zip = await save.saveFile(ctx, `${stem}.zip`, files.zip(pngs), 'application/zip');
        preview = await save.saveFile(ctx, `${stem}-preview.png`, await media.svgToPng(ctx, CR.previewSvg(rows, { title, cols })), 'image/png');
        rendered = true;
      } catch (e) {
        if (/^Stopped\.?$/.test(String(e && e.message))) throw e;
        ctx.log(`Rendering stopped (${text.clip(String(e && e.message), 80)}), so the ads come as SVG files instead.`);
      }
    }
    if (!rendered) {
      zip = await save.saveFile(ctx, `${stem}-svg.zip`, files.zip(svgs.map((x) => ({ name: `${x.name}.svg`, data: x.svg }))), 'application/zip');
      const body = `<section><h2>Your ads</h2><p class="lead">Open the SVG files in Canva or Figma to export PNGs, or run this again where images can be rendered.</p>${rows.map((r, i) => `<div class="card"><h3>${esc(r.label)}</h3><div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">${CR.SIZES.map((s) => `<svg viewBox="0 0 ${s.w} ${s.h}" style="width:${Math.round((s.w / s.h) * 260)}px;height:260px;border-radius:8px">${r.ads[s.id].defs ? `<defs>${r.ads[s.id].defs}</defs>` : ''}${r.ads[s.id].body}</svg>`).join('')}</div><p class="muted">${esc(ads[i].primary)}</p></div>`).join('')}</section>`;
      preview = await save.saveFile(ctx, `${stem}-preview.html`, page(ctx, { title, kicker: 'Ad images', sub: 'Three sizes per angle, in your colors.', body }));
    }
    ctx.log(`${text.plural(ads.length, 'angle')} in ${CR.SIZES.length} sizes${rendered ? ', rendered as PNG' : ', as SVG'}.`);
    return {
      ads: ads.map((ad, i) => ({ n: i + 1, key: ad.key, name: ad.name, kicker: ad.words.kicker, headline: ad.words.headline, sub: ad.words.sub || '', button: ad.words.cta, primary: ad.primary, metaHeadline: ad.headline, description: ad.description, files: CR.SIZES.map((s) => `${i + 1}-${ad.key}-${s.id}-${s.w}x${s.h}.${rendered ? 'png' : 'svg'}`) })),
      zip,
      preview,
      rendered,
      notes,
      colors: { background: cols.bg, accent: cols.accent },
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Ad images', out.ads.length * 3, `${text.plural(out.ads.length, 'angle')} in 3 sizes: feed square, feed portrait, Stories and Reels`),
      (out.notes || []).map((n) => views.text(n)),
      out.rendered ? views.image(out.preview, 'Every ad at a glance. On Stories, the words stay inside the dashed safe zone.') : views.file(out.preview, 'Preview of every ad'),
      views.file(out.zip, out.rendered ? 'All the PNGs, ready to upload' : 'All the ads as SVG files'),
      out.ads.map((a) => views.copy(`Text for ad ${a.n}: ${a.name}`, `Primary text: ${a.primary}\nHeadline: ${a.metaHeadline}\nDescription: ${a.description}`)),
      views.text('Upload the square or portrait image for feed ads and the 9:16 one for Stories and Reels. Use your own photos only, and nothing that promises a result.')
    );
  },
};

// ---------- Google search campaign ----------

const googleCampaign = {
  name: 'ads.google_campaign',
  title: 'Build a Google search campaign',
  description: 'Builds a Google search campaign as one CSV for Google Ads Editor: the campaign paused, Google Search only, Manual CPC and a daily budget from your 30-day budget; ad groups with a starting max cost per click from your max cost per lead; phrase and exact keywords for your service and city; negatives for job and how-to searches; and a responsive search ad per ad group with every line counted. Plus a guide to import it and add your area.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 3,
  input: {
    type: 'object',
    properties: {
      numbers: { type: 'object', description: 'From ads.check_numbers.' },
      url: { type: 'string', title: 'Page the ads send people to', description: 'Starts with https://', maxLength: 300 },
      keywords: { type: 'string', format: 'textarea', title: 'Your own keywords (optional)', description: 'One per line, like "ceramic coating austin"', maxLength: 2000 },
      budget: NUM_INPUTS.budget,
      price: NUM_INPUTS.price,
      service: SERVICE,
    },
    required: ['url'],
  },
  output: {
    type: 'object',
    properties: {
      campaign: { type: 'string' },
      daily: { type: 'number' },
      cpc: { type: 'object' },
      groups: { type: 'array' },
      negatives: { type: 'array' },
      csv: { type: 'object' },
      guide: { type: 'object' },
      problems: { type: 'array' },
      url: { type: 'string' },
      sample: { type: 'boolean' },
    },
    required: ['campaign', 'groups', 'csv'],
  },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    A.needService(f);
    const url = web.normalizeUrl(input.url || f.website || '');
    if (!url || !/^https:\/\//.test(url)) throw new Error('Add the https:// page your ads send people to. Google needs a final URL for every ad.');
    const n = input.numbers && input.numbers.price ? input.numbers : A.numbers(f, { ...input, outreachCustomers: 3 });
    const budget = money.num(input.budget) != null ? money.num(input.budget) : n.budget || 300;
    const daily = Math.max(1, money.round(budget / 30.4, 2));
    const cpc = ED.startingCpc(n.maxCpl);
    const month = time.today(ctx).slice(0, 7);
    const campaign = text.clip(`${text.titleCase(f.service)}${f.city ? ` ${f.city}` : ''} Search ${month}`, 60).replace(/\.\.\.$/, '');
    const extra = String(input.keywords || '').split(/\r?\n|,/).map((k) => text.oneLine(k)).filter(Boolean).slice(0, 20);
    const groups = ED.keywordGroups(f, { extra });
    const angles = A.angles(f);
    for (const g of groups) {
      const angle = angles.find((a) => a.key === g.angle) || angles[0];
      g.ad = ED.rsa(A.googleAd(f, angle), { lead: ED.leadFor(g, f) });
      g.url = A.utm(url, { utm_source: 'google', utm_medium: 'cpc', utm_campaign: text.slug(campaign, 40), utm_content: g.key });
    }
    const list = ED.rows({ campaign, daily, groups, cpc: cpc.value });
    const problems = ED.validate(list);
    if (problems.length) throw new Error(`${problems[0].where}: ${problems[0].why}.`);
    const base = f.name || f.service;
    const csv = await save.saveFile(ctx, save.fileName(base, 'google ads editor', '.csv'), ED.toCsv(list), 'text/csv');
    const kwRows = groups.flatMap((g) => g.keywords.map((k) => ({ group: g.name, keyword: k.text, match: k.types.join(' and ') })));
    const lim = ED.ED.limits;
    const adCards = groups
      .map((g) => `<div class="card"><span class="tag">${esc(g.name)}</span><h3>${esc(text.plural(g.ad.headlines.length, 'headline'))}, ${esc(text.plural(g.ad.descriptions.length, 'description'))}</h3><div class="chips">${g.ad.headlines.map((h) => `<span class="chip">${esc(h)}<i>${h.length}/${lim.headlineMax}</i></span>`).join('')}</div><ol class="descs">${g.ad.descriptions.map((d) => `<li>${esc(d)} <i>${d.length}/${lim.descriptionMax}</i></li>`).join('')}</ol><p class="muted">Shows as ${esc(web.domainOf(url) || 'yourdomain')}/${esc(g.ad.path1)}/${esc(g.ad.path2)} (paths ${g.ad.path1.length} and ${g.ad.path2.length} of ${lim.pathMax}).</p></div>`)
      .join('');
    const chipCss = '<style>.chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 14px}.chip{display:inline-flex;gap:8px;align-items:baseline;border:1px solid var(--line);background:var(--tint);border-radius:999px;padding:6px 12px;font-size:14px}.chip i,.descs i{font-style:normal;font-size:12px;color:var(--muted)}.descs{margin:0 0 10px;padding-left:20px}.descs li{margin:6px 0}</style>';
    const loc = A.LIMITS.google.location;
    const body = `<section><h2>Import it</h2><div class="card"><ol>${ED.ED.importSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><p class="muted">From Google's help: <a href="${esc(ED.ED.sources.import)}">Import a CSV file</a> and <a href="${esc(ED.ED.sources.columns)}">CSV file columns</a>, read ${esc(ED.ED.checked)}.</p></div></section>
<section><h2>Add your area before you turn it on</h2><div class="card"><p>The file leaves locations to you, because Google wants each one on its own row with its own ID. In the campaign's location settings, add ${esc(f.city || 'your city')} or a radius around where you work.</p><p>${esc(loc.advice)} <a href="${esc(loc.source)}">Google's help</a>.</p></div></section>
<section><h2>What's in the file</h2>${table([{ key: 'what', label: 'Setting' }, { key: 'value', label: 'Value' }, { key: 'why', label: 'Why' }], [
      { what: 'Campaign', value: campaign, why: 'Search ads on Google only, in English.' },
      { what: 'Status', value: 'Paused', why: 'Nothing spends until you turn it on in Google Ads.' },
      { what: 'Daily budget', value: money.usd(daily, { cents: true }), why: `Your ${money.usd(budget)} a month, divided by 30.4. ${ED.ED.budget}` },
      { what: 'Bidding', value: 'Manual CPC', why: 'You set what a click can cost while you learn what a lead costs you.' },
      { what: 'Starting max cost per click', value: money.usd(cpc.value, { cents: true }), why: cpc.how },
      { what: 'Networks', value: 'Google Search only', why: 'Search Partners and Display are left off for a first test.' },
    ])}</section>
<section><h2>Keywords</h2><p class="lead">Phrase match catches searches that include the words in order; exact match catches the same meaning. Broad match is left out for a first, small budget.</p>${table([{ key: 'group', label: 'Ad group' }, { key: 'keyword', label: 'Keyword' }, { key: 'match', label: 'Match' }], kwRows)}<p class="muted">Left out on purpose (campaign negatives): ${esc(ED.NEGATIVES.join(', '))}. These searches look for a job, a course or a how-to, not a booking.</p></section>
<section><h2>The ads, every line counted</h2><p class="lead">One responsive search ad per ad group. Google mixes the headlines and descriptions, so each one has to make sense on its own.</p>${chipCss}${adCards}<p class="muted">Final URL for each ad: your page with tracking tags (utm_source=google, utm_medium=cpc), so you can see which ad group brought each visit.</p></section>
<section><h2>Before you turn it on</h2><div class="card"><ol><li>Check the page your ads send people to (Check your ad landing page does it).</li><li>Set up conversion tracking in Google Ads for calls or form sends, so you can see cost per lead.</li><li>Turn the campaign on, and check it on day 3 and day 7 with Read your ad results.</li></ol></div></section>`;
    const guide = await save.saveFile(ctx, save.fileName(base, 'google campaign guide', '.html'), page(ctx, { title: 'Your Google search campaign', kicker: 'Google Ads Editor', sub: `${sc(f.service)}${f.city ? ` in ${f.city}` : ''}: ${text.plural(groups.length, 'ad group')}, ${text.plural(kwRows.length, 'keyword')}, paused until you turn it on.`, stats: [{ value: money.usd(daily, { cents: true }), label: 'per day' }, { value: money.usd(cpc.value, { cents: true }), label: 'starting max per click' }, { value: groups.length, label: 'ad groups' }], body }));
    ctx.log(`Campaign "${campaign}": ${groups.length} ad groups, ${kwRows.length} keywords, ${ED.NEGATIVES.length} negatives.`);
    return {
      campaign,
      daily,
      cpc,
      groups: groups.map((g) => ({ name: g.name, keywords: g.keywords.map((k) => k.text), headlines: g.ad.headlines, descriptions: g.ad.descriptions, path: `/${g.ad.path1}/${g.ad.path2}`, url: g.url })),
      negatives: ED.NEGATIVES,
      csv,
      guide,
      problems,
      url,
      sample: isSampleHost(url),
    };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text('This uses a sample page address. Run it with your own https:// page before you import it.') : null,
      views.metric('Daily budget', money.usd(out.daily, { cents: true }), `Paused until you turn it on. Starting max per click ${money.usd(out.cpc.value, { cents: true })}.`),
      views.file(out.csv, 'The campaign for Google Ads Editor (Account > Import > From file)'),
      views.file(out.guide, 'How to import it, add your area and what is inside'),
      views.table([{ key: 'name', label: 'Ad group' }, { key: 'path', label: 'Display path' }], out.groups),
      views.copy('Headlines', out.groups[0] ? out.groups[0].headlines.join('\n') : ''),
      views.text(out.cpc.how)
    );
  },
};

// ---------- landing page check ----------

const SAMPLE_PAGE = path.join(__dirname, '..', 'sample', 'landing.html');

const checkPage = {
  name: 'ads.check_page',
  title: 'Check an ad landing page',
  description: 'Reads the page your ads send people to, the way a buyer on a phone sees it, and checks it: https, fits a phone, loads fast, says what the ad says, shows the price and your area, one clear way to act, tap to call, a short form, proof, a privacy link, tracking tags and no claims an ad reviewer would flag. A score and the fixes in order.',
  kind: 'api',
  risk: 'read',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      url: { type: 'string', title: 'Page the ads send people to', description: 'Starts with https://', maxLength: 300 },
      ad: { type: 'string', title: 'Your ad headline or hook (optional)', description: 'To check the page says the same thing', maxLength: 300 },
      price: NUM_INPUTS.price,
    },
    required: ['url'],
  },
  output: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      reason: { type: 'string' },
      url: { type: 'string' },
      score: { type: 'integer' },
      checks: { type: 'array' },
      fixes: { type: 'array' },
      report: { type: ['object', 'null'] },
      read: { type: 'string' },
      sample: { type: 'boolean' },
    },
    required: ['ok'],
  },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    const url = web.normalizeUrl(input.url || '');
    if (!url) return { ok: false, reason: "That doesn't look like a web address. Try something like https://yoursite.com/book.", url: String(input.url || ''), checks: [], fixes: [], report: null, read: 'none', sample: false };
    let html = '';
    let ms = null;
    let finalUrl = url;
    let sample = false;
    if (isSampleHost(url) || ctx.sample) {
      html = fs.readFileSync(SAMPLE_PAGE, 'utf8');
      sample = true;
    } else {
      const t0 = Date.now();
      const r = await web.fetchPage(ctx, url, { timeoutMs: 15000 });
      ms = Date.now() - t0;
      if (!r.html) {
        const reason = r.blocked ? 'The site asks bots not to read it, so we left it alone.' : r.status ? `The page answered ${r.status}. Check the address, and that the page is public.` : r.error === 'timeout' ? 'The page took too long to answer. Buyers on a phone would leave too: check it loads.' : "We couldn't reach the page. Check the address.";
        return { ok: false, reason, url, checks: [], fixes: [], report: null, read: 'none', sample: false };
      }
      html = r.html;
      finalUrl = r.url || url;
    }
    const pg = scan.tidy(scan.parsePage(html, finalUrl));
    const x = LP.extras(html);
    const adText = text.oneLine(input.ad || '') || `${f.service} ${f.city || ''}`;
    const list = LP.checks(pg, x, { url: finalUrl, ms, adWords: [...new Set(LP.wordsOf(adText))].slice(0, 10), price: money.num(input.price) != null ? money.num(input.price) : f.price, area: f.where, city: f.city });
    const score = LP.scoreOf(list);
    const fixes = LP.fixesOf(list);
    const today = time.today(ctx);
    const badge = (s) => `<span class="tag${s === 'pass' ? ' ok' : ''}">${s === 'pass' ? 'Good' : s === 'warn' ? 'Fix soon' : 'Fix first'}</span>`;
    const body = `${fixes.length ? `<section><h2>Fix these, in this order</h2>${fixes.map((c, i) => `<div class="card">${badge(c.status)}<h3>${i + 1}. ${esc(c.title)}</h3><p>${esc(c.evidence)}</p><p><b>Fix:</b> ${esc(c.fix)}</p></div>`).join('')}</section>` : ''}
<section><h2>Every check</h2>${table([{ key: 'title', label: 'Check' }, { key: 'result', label: 'Result' }, { key: 'evidence', label: 'What we saw' }], list.map((c) => ({ title: c.title, result: c.status === 'pass' ? 'Good' : c.status === 'warn' ? 'Fix soon' : 'Fix first', evidence: c.evidence })))}</section>
<section><h2>How we read it</h2><div class="card">${sample ? '<p>This report reads a sample page for a made-up business, so you can see how the check works. Run it with your own page address to check your page.</p>' : `<p>One read of ${esc(web.domainOf(finalUrl) || finalUrl)} on ${esc(time.longDate(today))}, as a phone visitor would get it.</p>`}<p>"No ... found" means we didn't see it on this page, not that you don't have it.</p></div></section>`;
    const report = await save.saveFile(ctx, save.fileName(f.name || web.domainOf(finalUrl) || 'page', 'landing page check', '.html'), page(ctx, { title: `Landing page check: ${score} of 100`, kicker: sample ? 'Sample page' : 'Landing page', sub: `${web.domainOf(finalUrl) || finalUrl}. ${fixes.length ? `${text.plural(fixes.length, 'thing')} to fix before you spend on ads.` : 'Ready for ad traffic.'}`, stats: [{ value: `${score}`, label: 'score out of 100' }, { value: list.filter((c) => c.status === 'pass').length, label: 'checks passed' }, { value: fixes.filter((c) => c.status === 'fail').length, label: 'to fix first' }], body }));
    ctx.log(`${web.domainOf(finalUrl)}: ${score} of 100, ${text.plural(fixes.length, 'fix', 'fixes')}.`);
    return { ok: true, reason: '', url: finalUrl, score, checks: list, fixes: fixes.slice(0, 8).map((c) => ({ title: c.title, status: c.status, evidence: c.evidence, fix: c.fix })), report, read: sample ? 'sample' : 'live', sample };
  },
  view(out) {
    if (!out.ok) return views.blocks(views.text(out.reason));
    return views.blocks(
      out.sample ? views.text('This reads a sample page for a made-up business. Run it with your own page address.') : null,
      views.metric('Landing page score', `${out.score} of 100`, out.fixes.length ? `${text.plural(out.fixes.length, 'thing')} to fix, most important first` : 'Ready for ad traffic'),
      views.cards(out.fixes.slice(0, 4).map((c) => ({ title: c.title, body: `${c.evidence} Fix: ${c.fix}`, badge: c.status === 'fail' ? 'Fix first' : 'Fix soon' }))),
      views.file(out.report, 'The full check (printable)')
    );
  },
};

// ---------- creator brief ----------

const USAGE = ['Posts on my accounts only', '30 days of ads', '60 days of ads', '12 months of ads'];

const creatorBrief = {
  name: 'ads.creator_brief',
  title: 'Write a creator brief',
  description: "Writes a brief for a creator who films ads for you: what to make, the first 3 seconds of each angle, what to say and never say, how to disclose it's an ad (FTC), how long you may run it as an ad, how to share a TikTok Spark code or Meta partnership ad permission, the timeline and pay. Plus a short message to send with it.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      angles: { type: 'array', description: 'Angles from ads.find_angles. Leave out for the top 2.' },
      creator: { type: 'string', title: "Creator's name (optional)", maxLength: 80 },
      videos: { type: 'integer', title: 'How many videos', minimum: 1, maximum: 6, default: 2 },
      length: { type: 'string', title: 'Video length', enum: ['15 seconds', '30 seconds', '15 to 30 seconds'], default: '15 to 30 seconds' },
      usage: { type: 'string', title: 'How you may use the videos', enum: USAGE, default: '30 days of ads' },
      pay: { type: 'number', title: 'Pay per video (optional)', minimum: 0 },
      due: { type: 'string', format: 'date', title: 'Final videos due (optional)' },
      musts: { type: 'string', format: 'textarea', title: 'Facts they must get right (optional)', description: 'One per line, like "Prices start at $180"', maxLength: 1500 },
      avoid: { type: 'string', format: 'textarea', title: 'Anything to avoid (optional)', maxLength: 1500 },
      price: NUM_INPUTS.price,
      service: SERVICE,
    },
  },
  output: {
    type: 'object',
    properties: {
      brief: { type: 'object' },
      message: { type: 'object' },
      page: { type: 'object' },
      doc: { type: 'object' },
    },
    required: ['brief', 'page'],
  },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    A.needService(f);
    const b = brain.brainOf(ctx, {});
    const today = time.today(ctx);
    const due = /^\d{4}-\d{2}-\d{2}$/.test(input.due || '') && input.due > today ? input.due : time.addDays(today, 14);
    const span = Math.round((Date.parse(`${due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
    const firstCut = time.addDays(today, Math.max(2, Math.min(span - 2, Math.round(span * 0.6))));
    const videos = Math.max(1, Math.min(6, Math.round(input.videos || 2)));
    const length = input.length || '15 to 30 seconds';
    const usage = USAGE.includes(input.usage) ? input.usage : '30 days of ads';
    const days = CREATORS.durationsByUsage[usage.replace(/ of ads$/, '')] || null;
    let list = (Array.isArray(input.angles) && input.angles.length ? input.angles : A.angles(f).filter((a) => a.key !== 'included')).filter((a) => a && a.key).slice(0, 3);
    if (!list.length) list = A.angles(f).slice(0, 2);
    const P = f.price != null ? money.usd(f.price) : '';
    const facts = [
      `${sc(f.service)}${f.city ? ` in ${f.city}` : ''}${f.where && f.where !== f.city ? ` (${f.where})` : ''}.`,
      f.offer ? `${sc(noEnd(f.offer))}.` : '',
      P ? `The price: ${P}${/\bstart|from\b/i.test(f.offer) ? '' : ', said exactly like that'}.` : '',
      f.mobile ? `${f.name || 'The business'} comes to you.` : '',
      ...String(input.musts || '').split(/\r?\n/).map((l) => text.oneLine(l)).filter(Boolean).map((l) => (/[.!?]$/.test(l) ? l : `${l}.`)),
    ].filter(Boolean).filter(C.ok).slice(0, 8);
    const never = [
      'Any promise of a result, or of what someone will save or earn.',
      "A review, a before and after or a customer story that isn't real and ours.",
      'Other businesses by name, or comparisons to them.',
      'Pressure that isn\'t true, like a made-up deadline or "only 2 spots left".',
      'Music you don\'t have the rights to use in an ad. Use none, or sounds cleared for business use.',
      ...String(input.avoid || '').split(/\r?\n/).map((l) => text.oneLine(l)).filter(Boolean).map((l) => (/[.!?]$/.test(l) ? l : `${l}.`)),
    ].slice(0, 10);
    // The creator talks about the business, not as it, and introduces it once.
    const shots = list.map((a) => {
      const v = A.videoBrief(f, a);
      return {
        angle: a.name,
        hook: theyVoice(a.hook),
        first3: v.first3.map((x) => ({ ...x, at: x.at.replace(/\.0\b/g, ''), onScreen: theyVoice(x.onScreen), say: theyVoice(x.say) })),
        rest: [f.name ? `Name the business once: ${f.name}${f.where ? `, ${f.where}` : ''}.` : 'Name the business once, and the area.', ...v.rest.slice(1)],
      };
    });
    const deliver = [
      `${text.plural(videos, 'video')}, ${length} each, filmed vertical (9:16).`,
      'Your best take with your voice, plus the raw clips, so we can cut other versions.',
      'No burned-in captions or music on the raw clips; we add our own.',
      'Keep words and faces out of the top 14% and bottom 35% of the frame, where the app puts its buttons.',
      'Real footage of the work, with the customer\'s OK. No stock footage.',
    ];
    const rights = usage === USAGE[0]
      ? `We may repost the videos on our own accounts, crediting you. We won't run them as paid ads without asking you first.`
      : `We may run the videos as paid ads for ${usage.replace(/ of ads$/, '')} from the day you deliver, and repost them on our own accounts crediting you. After that, we stop the ads unless we agree on more time.`;
    const spark = usage === USAGE[0] ? null : { tiktok: CREATORS.tiktok, days: CREATORS.tiktok.durations.includes(days) ? days : 365, meta: CREATORS.meta.note };
    const payLine = input.pay != null && Number(input.pay) > 0 ? `${money.usd(Number(input.pay))} a video (${money.usd(Number(input.pay) * videos)} in all), paid when the final videos are in.` : 'Pay: [your rate per video, and when you pay].';
    const timeline = [
      { when: time.shortDate(today), what: 'Brief sent' },
      { when: time.shortDate(firstCut), what: 'First cut, for one round of notes' },
      { when: time.shortDate(due), what: 'Final videos and raw clips' },
    ];
    const name = text.oneLine(input.creator || '');
    const hi = name ? `Hi ${text.firstName ? text.firstName(name) || name : name}` : 'Hi';
    const me = b.firstName || '[your name]';
    const useWords = usage === USAGE[0] ? 'to post on our own accounts' : `to run as ads for ${usage.replace(/ of ads$/, '')}`;
    const from = f.name ? ` from ${f.name}${f.city ? ` in ${f.city}` : ''}` : `, and I run a small ${lowerFirstWord(f.service)} business${f.city ? ` in ${f.city}` : ''}`;
    const dm = `${hi}! I'm ${me}${from}. I'd love to pay you to film ${text.plural(videos, 'short video')} about our ${lowerFirstWord(f.service)}, ${useWords}. The brief has the details, the dates and the pay. Interested?`;
    const subject = `Paid video for ${f.name || `my ${lowerFirstWord(f.service)} business`}${f.city ? ` (${f.city})` : ''}`;
    const email = [`${hi},`, '', `I'm ${me}${from}. I'd love to pay you to film ${text.plural(videos, 'short video')} about our ${lowerFirstWord(f.service)}, ${useWords}. The brief is attached: what to film, what to say, how to mark it as an ad, the dates and the pay.`, '', 'If it works for you, reply with any questions and I\'ll confirm the dates.', '', [me, f.name].filter(Boolean).join('\n'), outreach.ADDRESS_HOLD, '', outreach.optOut('a paid video')].join('\n');
    const brief = { business: f.name, creator: name, videos, length, usage, due, firstCut, facts, never, shots, deliver, rights, disclose: CREATORS.ftc.rules, spark, pay: payLine, timeline };
    const body = `<section><h2>What to make</h2><div class="card"><ul>${deliver.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></div></section>
<section><h2>The angles, and the first 3 seconds</h2>${shots.map((s) => `<div class="card"><span class="tag">${esc(s.angle)}</span><h3>${esc(s.hook)}</h3>${table([{ key: 'at', label: 'When' }, { key: 'show', label: 'Show' }, { key: 'onScreen', label: 'On screen' }, { key: 'say', label: 'Say' }], s.first3)}<p class="muted">Then: ${esc(s.rest.join(' '))}</p></div>`).join('')}</section>
<section><h2>Facts to get right</h2><p class="lead">Say them in your own words, but keep these exact.</p><div class="card"><ul>${facts.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div></section>
<section><h2>Never say or show</h2><div class="card"><ul>${never.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div></section>
<section><h2>Say it's an ad</h2><div class="card"><ul>${CREATORS.ftc.rules.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p class="muted">From the FTC's <a href="${esc(CREATORS.ftc.source)}">Disclosures 101 for Social Media Influencers</a>, read ${esc(CREATORS.checked)}. Not legal advice.</p></div></section>
<section><h2>How we may use the videos</h2><div class="card"><p>${esc(rights)}</p>${spark ? `<h3>On TikTok: a Spark Ads video code</h3><ol>${spark.tiktok.creatorSteps.map((s) => `<li>${esc(s.replace('7, 30, 60 or 365 days', `${spark.days} days`))}</li>`).join('')}</ol><p class="muted">${esc(spark.tiktok.notes.join(' '))} <a href="${esc(spark.tiktok.source)}">TikTok's help</a>.</p><h3>On Instagram or Facebook: partnership ad permission</h3><p>${esc(spark.meta)} <a href="${esc(CREATORS.meta.source)}">Meta's help</a>.</p>` : ''}</div></section>
<section><h2>Dates and pay</h2>${table([{ key: 'when', label: 'When' }, { key: 'what', label: 'What' }], timeline)}<div class="card" style="margin-top:14px"><p>${esc(payLine)}</p><p class="muted">One round of notes on the first cut. If we ask for a change that isn't in this brief, we'll agree on it with you first.</p></div></section>`;
    const html = page(ctx, { title: `Creator brief${name ? ` for ${name}` : ''}`, kicker: f.name || 'Creator brief', sub: `${text.plural(videos, 'video')} for ${usage === USAGE[0] ? 'our accounts' : 'ads'}, ${length} each, due ${time.shortDate(due)}.`, stats: [{ value: videos, label: videos === 1 ? 'video' : 'videos' }, { value: usage.replace(/ of ads$/, ''), label: usage === USAGE[0] ? 'use' : 'of ad use' }, { value: time.shortDate(due).replace(/^\w+, /, ''), label: 'final due' }], body });
    const base = save.fileName(f.name || f.service, `creator brief${name ? ` ${name}` : ''}`).replace(/\.[a-z]+$/, '');
    const plainDoc = [
      `CREATOR BRIEF: ${f.name || ''}`.trim(),
      `${text.plural(videos, 'video')}, ${length} each. Final due ${time.shortDate(due)}.`,
      '',
      'WHAT TO MAKE',
      ...deliver.map((d) => `- ${d}`),
      '',
      'THE ANGLES',
      ...shots.flatMap((s) => [`${s.angle}: ${s.hook}`, ...s.first3.map((x) => `  ${x.at}: show ${lowerFirstWord(x.show)}${x.onScreen ? `; on screen "${x.onScreen}"` : ''}${x.say ? `; say "${x.say}"` : ''}`), '']),
      'FACTS TO GET RIGHT (in your own words, but keep these exact)',
      ...facts.map((l) => `- ${l}`),
      '',
      'NEVER SAY OR SHOW',
      ...never.map((l) => `- ${l}`),
      '',
      "SAY IT'S AN AD (FTC)",
      ...CREATORS.ftc.rules.map((l) => `- ${l}`),
      '',
      'HOW WE MAY USE THE VIDEOS',
      rights,
      ...(spark ? ['', `TikTok Spark Ads code (${spark.days} days):`, ...spark.tiktok.creatorSteps.map((s, i) => `${i + 1}. ${s.replace('7, 30, 60 or 365 days', `${spark.days} days`)}`), '', spark.meta] : []),
      '',
      'DATES AND PAY',
      ...timeline.map((t) => `${t.when}: ${t.what}`),
      payLine,
    ].join('\n');
    const pageFile = await save.saveFile(ctx, `${base}.html`, html);
    const doc = await save.saveFile(ctx, `${base}.txt`, plainDoc, 'text/plain');
    ctx.log(`Brief for ${text.plural(videos, 'video')}, ${usage}, due ${due}.`);
    return { brief, message: { dm, subject, email }, page: pageFile, doc };
  },
  view(out) {
    const br = out.brief;
    return views.blocks(
      views.metric('Creator brief', `${text.plural(br.videos, 'video')}`, `${br.length} each, ${br.usage.toLowerCase()}, final due ${time.shortDate(br.due)}`),
      views.file(out.page, 'The brief (printable, or save as PDF to send)'),
      views.file(out.doc, 'The same brief as plain text, to paste into an email or doc'),
      views.copy('DM to the creator', out.message.dm),
      views.copy('Email to the creator', out.message.email, { subject: out.message.subject }),
      views.text("Creators must say it's an ad in the video itself. The brief tells them how.")
    );
  },
};

// A creator speaks about the business: "I" and "we" become "they".
function theyVoice(s) {
  return String(s || '')
    .replace(/\b(I'm|we're)\b/gi, "they're")
    .replace(/\b(I'll|we'll)\b/gi, "they'll")
    .replace(/\b(I|we|We)\b/g, 'they')
    .replace(/\b(my|our|Our)\b/g, 'their')
    .replace(/\bus\b/g, 'them')
    .replace(/(^|[.!?]\s+)(they|their)\b/g, (m, a, w) => `${a}${w.charAt(0).toUpperCase()}${w.slice(1)}`);
}

function lowerFirstWord(s) {
  const t = String(s || '');
  return /^[A-Z]{2,}\b/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
}

module.exports = { adImages, googleCampaign, checkPage, creatorBrief, USAGE };
