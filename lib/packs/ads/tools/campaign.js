// The campaign builder's own tools (Legal row 12, files only): the special category question (D2),
// the audience check (D2, D7), and the campaign as import files: a Meta Ads Manager bulk import sheet,
// a Google Ads Editor CSV and a TikTok upload pack, every campaign, ad set and ad paused. Every line
// passes the claims check (D3, D4), restricted products get their line (D8), AI-made creatives their
// labels (D5), and the landing page check's claims result rides along (D12). Nothing is posted,
// imported or spent: the member uploads the files and turns things on themselves.

const { text, views, save, files, money, time, web, brain } = require('../../_kit');
const A = require('../lib/ads');
const C = require('../lib/claims');
const T = require('../lib/targeting');
const LB = require('../lib/labels');
const BULK = require('../data/bulk-files.json');
const SC = require('../data/special-categories.json');
const LINES = require('../data/screen-lines.json');
const { page, table, esc } = require('../lib/page');
const { NUM_INPUTS, SERVICE } = require('./desk');
const { SPECIAL_INPUT, googlePlan, isSampleHost } = require('./make');

const countryOf = (ctx) => (/canada|^ca$/i.test(String(((ctx.brain || {}).business || {}).country || '')) ? 'CA' : 'US');

// ---------- D2: the question ----------

const specialCategory = {
  name: 'ads.special_category',
  title: 'Check the special category',
  description: "Takes your answer to the special category question (housing, jobs, credit or another financial product, politics, or none) and says what it means on Meta, Google and TikTok. Political and social issue ads stop here: make them on the platform itself. Nothing is picked for you.",
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { special: SPECIAL_INPUT }, required: ['special'] },
  output: {
    type: 'object',
    properties: { go: { type: 'boolean' }, answer: { type: 'string' }, key: { type: 'string' }, special: { type: 'boolean' }, line: { type: 'string' }, meta: { type: 'object' }, rules: { type: 'array' } },
    required: ['go', 'answer', 'line'],
  },
  async run(input, ctx) {
    const cat = T.categoryOf(input.special);
    const country = countryOf(ctx);
    if (cat.stop) {
      ctx.log('Political or social issue ad: the desk stops here.');
      return { go: false, answer: cat.answer, key: cat.key, special: false, line: LINES.politics, meta: { special_ad_categories: [cat.meta], special_ad_category_country: [country] }, rules: [] };
    }
    const rules = cat.special
      ? Object.values(SC.networks).map((n) => `${n.name}: ${n.ages.why} ${n.gender} ${n.zips} ${n.radius}`)
      : ['No special category: the usual targeting applies, starting at age 18.'];
    const line = cat.special
      ? `This ad is about ${cat.label}, so Meta's campaign carries the ${cat.meta} special ad category for ${country}, TikTok's Special Ad Category toggle goes on, and the audience keeps to what each network allows.`
      : 'None of these: Meta\'s campaign carries the special ad category NONE, and every audience starts at 18.';
    ctx.log(`Special category: ${cat.answer}.`);
    return { go: true, answer: cat.answer, key: cat.key, special: cat.special, line, meta: { special_ad_categories: [cat.meta], special_ad_category_country: [country] }, rules };
  },
  view(out) {
    return views.blocks(views.metric('Special category', out.answer, out.go ? 'Asked before any campaign draft' : 'The desk stops here'), views.text(out.line), out.special ? views.cards(out.rules.map((r) => ({ title: r.split(':')[0], body: r.slice(r.indexOf(':') + 2) }))) : null);
  },
};

// ---------- D2, D7: the audience ----------

const AUDIENCE_INPUTS = {
  ageMin: { type: 'integer', title: 'Youngest age to reach', minimum: 18, maximum: 65, default: 18, description: 'Every audience starts at 18.' },
  ageMax: { type: 'integer', title: 'Oldest age to reach (65 means 65 and up)', minimum: 18, maximum: 65, default: 65 },
  gender: { type: 'string', title: 'Who to reach', enum: ['All', 'Women', 'Men'], default: 'All' },
  radius: { type: 'integer', title: 'Miles around your city', minimum: 1, maximum: 50, default: 10 },
  zips: { type: 'string', format: 'textarea', title: 'ZIP codes (optional)', description: 'One per line, in place of the radius', maxLength: 600 },
  interests: { type: 'string', format: 'textarea', title: 'Interests (optional)', description: 'One per line, like "car enthusiasts". Left out for housing, jobs and credit ads.', maxLength: 600 },
};

const planAudience = {
  name: 'ads.plan_audience',
  title: 'Check your audience',
  description: "Turns who you want to reach into an audience for Meta, Google and TikTok, starting at 18 for everyone. For housing, jobs and credit ads it takes out what each network bars (narrow ages, gender, ZIP codes, excluded places, small radiuses, lookalikes and barred interests) and says why.",
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { special: SPECIAL_INPUT, ...AUDIENCE_INPUTS, exclusions: { type: 'string', maxLength: 600 }, lookalike: { type: 'boolean' } }, required: ['special'] },
  output: { type: 'object', properties: { special: { type: 'string' }, audiences: { type: 'array' }, removed: { type: 'array' } }, required: ['audiences', 'removed'] },
  async run(input, ctx) {
    const cat = T.categoryOf(input.special);
    if (cat.stop) throw new Error(LINES.politics);
    const b = brain.brainOf(ctx, {});
    const list = T.audiences({ ...input, city: b.city || '', country: countryOf(ctx) }, cat);
    const removed = list.flatMap((a) => a.removed.map((r) => ({ network: a.name, ...r, source: r.source || '' })));
    ctx.log(`${list.length} audiences, ${text.plural(removed.length, 'setting')} taken out.`);
    return { special: cat.answer, audiences: list, removed };
  },
  view(out) {
    return views.blocks(
      views.table([{ key: 'name', label: 'Network' }, { key: 'who', label: 'Audience' }], out.audiences.map((a) => ({ name: a.name, who: a.lines.join('. ') }))),
      out.removed.length ? views.cards(out.removed.map((r) => ({ title: `${r.network}: ${r.what} taken out`, body: r.why }))) : views.text('Nothing taken out: every audience starts at 18.'),
    );
  },
};

// ---------- the files ----------

const CAT_TIKTOK = { housing: 'Housing', jobs: 'Employment', credit: 'Credit', none: 'None' };

function metaRows(ctx, { f, cat, country, ads, aud, url, campaign, daily, images }) {
  const V = BULK.meta.values;
  const a = aud.audience;
  const adset = text.clip(`${a.city || 'Your area'} ${a.ageMin}-${a.ageMax >= 65 ? '65+' : a.ageMax}`, 60);
  return ads.map((o, i) => {
    const img = images && Array.isArray(images.ads) ? images.ads.find((x) => x.key === o.angle.key) : null;
    const tags = `utm_source=facebook&utm_medium=paid_social&utm_campaign=${text.slug(campaign, 40)}&utm_content=${o.angle.key}`;
    return {
      'Campaign Name': campaign,
      'Campaign Status': V.status,
      'Campaign Objective': V.objective,
      'Buying Type': V.buyingType,
      'Special Ad Categories': cat.meta,
      'Special Ad Category Country': country,
      'Ad Set Name': adset,
      'Ad Set Run Status': V.status,
      'Ad Set Daily Budget': daily.toFixed(2),
      'Optimization Goal': V.optimization,
      'Billing Event': V.billing,
      Countries: country,
      Cities: a.zips.length ? '' : a.city,
      'Age Min': a.ageMin,
      'Age Max': a.ageMax,
      Gender: a.gender === 'All' ? '' : a.gender,
      'Ad Name': text.clip(`${i + 1}. ${o.angle.name}`, 60),
      'Ad Status': V.status,
      Title: o.meta.headline,
      Body: o.meta.primary,
      'Link Description': o.meta.description,
      Link: url,
      'Call to Action': V.cta,
      'Image File Name': img && img.files ? img.files[1] || img.files[0] : '',
      'URL Tags': tags,
      'Link Object ID': '',
    };
  });
}

function tiktokRows({ cat, ads, aud, url, campaign, daily, video, lab }) {
  const a = aud.audience;
  return ads.map((o, i) => ({
    'Campaign name': campaign,
    Objective: 'Traffic',
    'Special ad category': CAT_TIKTOK[cat.key] || 'None',
    'Ad group name': text.clip(`${a.city || 'Your area'} ${cat.special ? '18+' : `${a.ageMin}-${a.ageMax >= 65 ? '55+' : a.ageMax}`}`, 60),
    Placement: 'TikTok',
    Location: a.zips.length ? a.zips.join(' ') : `${a.city || 'Your city'} (${a.radius} miles)`,
    Ages: cat.special || (a.ageMin === 18 && a.ageMax >= 65) ? '18+' : `${a.ageMin} to ${a.ageMax >= 65 ? '55+' : a.ageMax}`,
    Gender: a.gender,
    'Daily budget': daily.toFixed(2),
    'Ad name': text.clip(`${i + 1}. ${o.angle.name}`, 60),
    'Ad text': o.tiktok.text,
    'Call to action': 'Learn more',
    'Destination URL': A.utm(url, { utm_source: 'tiktok', utm_medium: 'paid_social', utm_campaign: text.slug(campaign, 40), utm_content: o.angle.key }),
    'Video file': video && video.video && video.video.name ? video.video.name : 'Your 9:16 video for this angle',
    'AI-generated content': lab.aiMade ? 'On' : 'Off',
    Status: 'Paused',
  }));
}

const campaignFiles = {
  name: 'ads.campaign_files',
  title: 'Make the campaign files',
  description: 'Saves your campaign as files to upload yourself, every campaign, ad set and ad paused: a Meta Ads Manager bulk import sheet with the special ad category and country, a Google Ads Editor CSV, a TikTok upload worksheet with its checklist (special category toggle and AI label), tracking links and a guide with the claims check, the audience and the landing page result. Drafts your ads, checks the claims, and leaves every OK to you.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 4,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      special: SPECIAL_INPUT,
      numbers: { type: 'object' },
      ads: { type: 'array' },
      audiences: { type: 'object' },
      page: { type: ['object', 'null'] },
      images: { type: ['object', 'null'] },
      video: { type: ['object', 'null'] },
      url: { type: 'string', maxLength: 300 },
      budget: NUM_INPUTS.budget,
      price: NUM_INPUTS.price,
      keywords: { type: 'string', maxLength: 2000 },
      ai: LB.AI_INPUT,
      service: SERVICE,
    },
    required: ['special', 'ads', 'audiences', 'url'],
  },
  output: {
    type: 'object',
    properties: {
      special: { type: 'string' },
      campaign: { type: 'string' },
      daily: { type: 'number' },
      files: { type: 'array' },
      zip: { type: 'object' },
      claims: { type: 'object' },
      restricted: { type: 'array' },
      labels: { type: 'array' },
      checklist: { type: 'array' },
      page: { type: ['object', 'null'] },
      sample: { type: 'boolean' },
    },
    required: ['special', 'files', 'zip', 'claims', 'checklist'],
  },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    A.needService(f);
    const cat = T.categoryOf(input.special);
    if (cat.stop) throw new Error(LINES.politics);
    const ads = (input.ads || []).filter((x) => x && x.meta && x.angle);
    if (!ads.length) throw new Error('Write the ads first.');
    const url = web.normalizeUrl(input.url || '');
    if (!url || !/^https:\/\//.test(url)) throw new Error('Add the https:// page your ads send people to.');
    const country = countryOf(ctx);
    const n = input.numbers && input.numbers.price ? input.numbers : A.numbers(f, { ...input, outreachCustomers: 3 });
    const budget = money.num(input.budget) != null ? money.num(input.budget) : n.budget || 300;
    // A third of the 30-day budget per network, as a daily amount (the member moves it later).
    const daily = Math.max(1, money.round(budget / 3 / 30.4, 2));
    const month = time.today(ctx).slice(0, 7);
    const campaign = text.clip(`${text.titleCase(f.service)}${f.city ? ` ${f.city}` : ''} ${month}`, 60).replace(/\.\.\.$/, '');
    const auds = (input.audiences && input.audiences.audiences) || T.audiences({ city: f.city }, cat);
    const audOf = (k) => auds.find((x) => x.network === k) || T.audienceFor(k, { city: f.city }, cat);
    const lab = LB.labelsFor(input.ai);

    // D3, D4: every line the desk wrote, checked again before it goes in a file.
    const typed = C.typedBy(ctx, input);
    const rows = ads.flatMap((o) => [
      { where: `${o.angle.name}: Meta primary text`, text: o.meta.primary },
      { where: `${o.angle.name}: Meta headline`, text: o.meta.headline },
      { where: `${o.angle.name}: Meta description`, text: o.meta.description },
      ...o.google.headlines.map((h, i) => ({ where: `${o.angle.name}: Google headline ${i + 1}`, text: h })),
      ...o.google.descriptions.map((h, i) => ({ where: `${o.angle.name}: Google description ${i + 1}`, text: h })),
      { where: `${o.angle.name}: TikTok text`, text: o.tiktok.text },
      ...((o.video && o.video.first3) || []).flatMap((x) => [{ where: `${o.angle.name}: video ${x.at}`, text: x.say }, { where: `${o.angle.name}: on screen ${x.at}`, text: x.onScreen }]),
    ]);
    const img = input.images && Array.isArray(input.images.ads) ? input.images.ads : [];
    for (const x of img) for (const k of ['kicker', 'headline', 'sub', 'button', 'primary']) rows.push({ where: `Image ${x.n}: ${k}`, text: x[k] });
    const g = await googlePlan({ numbers: n, url, budget, price: input.price, service: input.service, special: input.special, keywords: input.keywords }, ctx);
    for (const grp of g.groups) for (const h of grp.ad.headlines) rows.push({ where: `Google ${grp.name}`, text: h });
    const review = C.review(rows, { typed });
    if (review.blocked.length) throw new Error(`${review.blocked[0].where}: ${LINES.blocked}`);
    // A line that needs proof is taken out of the files, and listed with Legal's question.
    const held = new Set(review.proof.map((p) => p.where));
    const keep = (o) => ({ ...o, google: { ...o.google, headlines: o.google.headlines.filter((h, i) => !held.has(`${o.angle.name}: Google headline ${i + 1}`)) } });
    const clean = ads.map(keep);

    const restricted = C.restricted(f.service, f.offer);
    const meta = metaRows(ctx, { f, cat, country, ads: clean, aud: audOf('meta'), url, campaign, daily, images: input.images });
    const metaCsv = files.csv(meta, BULK.meta.columns.map((k) => ({ key: k, label: k })), { bom: true });
    const tt = tiktokRows({ cat, ads: clean, aud: audOf('tiktok'), url, campaign, daily, video: input.video, lab });
    const ttCsv = files.csv(tt, BULK.tiktok.columns.map((k) => ({ key: k, label: k })), { bom: true });
    const links = clean.flatMap((o) => [
      { angle: o.angle.name, platform: 'Meta', url: A.utm(url, { utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: text.slug(campaign, 40), utm_content: o.angle.key }) },
      { angle: o.angle.name, platform: 'TikTok', url: A.utm(url, { utm_source: 'tiktok', utm_medium: 'paid_social', utm_campaign: text.slug(campaign, 40), utm_content: o.angle.key }) },
    ]);

    // The checklist the member works through before turning anything on.
    const ttAud = audOf('tiktok');
    const checklist = [
      `Special category: ${cat.answer}.${cat.special ? ` Meta: the campaign carries ${cat.meta} for ${country}. Google: ${SC.networks.google.zips} TikTok: ${LINES.tiktokSpecial}.` : ' Meta: the campaign carries NONE.'}`,
      ...(cat.special ? [`${LINES.tiktokSpecial} (${cat.label}).`] : []),
      ...(lab.aiMade ? [`${LINES.tiktokAi}. ${SC.tiktokChecklist.aiDuplicate}`] : []),
      'Every audience starts at 18.',
      ...restricted.flatMap((r) => r.lines.map((l) => l.line)),
      'Everything is paused. Nothing spends until you turn it on yourself, with the daily budget you set.',
    ];
    const ttChecklist = [
      `TIKTOK UPLOAD CHECKLIST: ${campaign}`,
      '',
      ...BULK.tiktok.steps.map((s, i) => `${i + 1}. ${s}`),
      '',
      'Before you submit:',
      `[ ] Special category: ${cat.answer}.${cat.special ? ` ${LINES.tiktokSpecial}.` : ''}`,
      ...(cat.special ? [`[ ] Audience: ages 18+, all genders, no ZIP codes, no lookalikes, no interest keywords or hashtags, automatic targeting and targeting expansion off. ${SC.networks.tiktok.source}`] : [`[ ] Audience: ${ttAud.lines.join('; ')}. Never under 18.`]),
      `[ ] ${lab.aiMade ? `${LINES.tiktokAi}. ${SC.tiktokChecklist.aiDuplicate}` : `AI-generated content: leave it off only if no picture, video or voice was made or much changed by AI. If one was: ${LINES.tiktokAi}.`}`,
      ...(lab.person || lab.voice ? [`[ ] The video shows "${[lab.person ? LINES.aiPerson : '', lab.voice ? LINES.aiVoice : ''].filter(Boolean).join('" and "')}" on screen while the person or voice is in it.`] : []),
      '[ ] No links, @ mentions or hashtags in the ad text (TikTok rule).',
      '[ ] The campaign is off (paused) when you submit.',
      ...restricted.map((r) => `[ ] ${r.lines.find((l) => l.network === 'TikTok').line}`),
      '',
      `Sources: ${SC.tiktokChecklist.source} ; ${BULK.tiktok.sources.aigc} ; ${BULK.tiktok.sources.blank}`,
    ].join('\n');

    // D12: the landing page check's claims result.
    const pg = input.page && input.page.ok ? input.page : null;
    const pageClaims = pg ? (pg.checks || []).find((c) => c.id === 'claims') : null;

    const audTable = table([{ key: 'name', label: 'Network' }, { key: 'who', label: 'Audience' }], auds.map((a) => ({ name: a.name, who: a.lines.join('. ') })));
    const removed = auds.flatMap((a) => a.removed.map((r) => ({ network: a.name, what: r.what, why: r.why })));
    const body = `<section><h2>Before anything else</h2><div class="card"><ol>${checklist.map((l) => `<li>${esc(l)}</li>`).join('')}</ol></div></section>
<section><h2>Who sees it</h2><p class="lead">Every audience starts at 18.${cat.special ? ` This ad is about ${esc(cat.label)}, so each network's limits apply.` : ''}</p>${audTable}${removed.length ? `<div class="card" style="margin-top:14px"><h3>Taken out</h3><ul>${removed.map((r) => `<li>${esc(r.network)}: ${esc(r.what)}. ${esc(r.why)}</li>`).join('')}</ul></div>` : ''}</section>
<section><h2>Meta: bulk import sheet</h2><div class="card"><ol>${BULK.meta.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><p class="muted">${esc(BULK.meta.verified)} <a href="${esc(BULK.meta.sources.import)}">Meta's help</a>.</p></div>${table([{ key: 'Ad Name', label: 'Ad' }, { key: 'Title', label: 'Headline' }, { key: 'Body', label: 'Primary text' }, { key: 'Special Ad Categories', label: 'Special category' }, { key: 'Ad Status', label: 'Status' }], meta)}</section>
<section><h2>Google: Ads Editor CSV</h2><div class="card"><p>${esc(text.plural(g.groups.length, 'ad group'))}, ${esc(text.plural(g.kwRows.length, 'keyword'))}, paused. Import it in Google Ads Editor (Account, Import, From file), add your area${cat.special ? ` as a city or a radius of ${SC.networks.google.minRadiusMiles} miles or more, never ZIP codes` : ''}, then post the changes.</p></div></section>
<section><h2>TikTok: upload worksheet</h2><div class="card"><ol>${BULK.tiktok.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><p class="muted">${esc(BULK.tiktok.verified)}</p></div></section>
<section><h2>Claims check</h2><div class="card"><p>${esc(text.plural(review.passed.length, 'line'))} passed. Ads made with this desk never claim income, earnings or sure results, never show before-and-after results for the body or health, and never carry made-up reviews, ratings, customer counts or people presented as customers.</p>${review.proof.length ? `<p><b>${esc(LINES.backup)}</b></p><ul>${review.proof.map((p) => `<li>${esc(p.where)}: "${esc(p.match)}" was taken out.</li>`).join('')}</ul>` : ''}</div></section>
${lab.aiMade ? `<section><h2>AI labels</h2><div class="card"><ul>${lab.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div></section>` : ''}
${restricted.length ? `<section><h2>Restricted products</h2><div class="card"><ul>${restricted.flatMap((r) => r.lines.map((l) => `<li>${esc(l.line)} <a href="${esc(l.href)}">${esc(l.network)}'s rules</a>.</li>`)).join('')}</ul></div></section>` : ''}
${pg ? `<section><h2>Landing page</h2><div class="card"><p>${esc(web.domainOf(pg.url) || pg.url)}: ${esc(pg.score)} of 100.${pageClaims ? ` Claims on the page: ${esc(pageClaims.status === 'pass' ? 'none found' : pageClaims.evidence)}.` : ''}</p>${(pg.fixes || []).length ? `<ol>${pg.fixes.slice(0, 3).map((x) => `<li>${esc(x.title)}: ${esc(x.fix)}</li>`).join('')}</ol>` : ''}</div></section>` : ''}
<section><h2>Tracking links</h2>${table([{ key: 'angle', label: 'Angle' }, { key: 'platform', label: 'Platform' }, { key: 'url', label: 'Link' }], links)}</section>`;
    const base = f.name || f.service;
    const guideHtml = page(ctx, { title: 'Your ad campaign', kicker: 'Campaign files', sub: `${text.plural(clean.length, 'ad')} on Meta, Google and TikTok, all paused. Special category: ${cat.answer}.`, stats: [{ value: money.usd(daily, { cents: true }), label: 'per day, per network' }, { value: clean.length, label: 'angles' }, { value: 'Paused', label: 'until you turn it on' }], body });
    const names = {
      meta: save.fileName(base, 'meta bulk import', '.csv'),
      google: save.fileName(base, 'google ads editor', '.csv'),
      tiktok: save.fileName(base, 'tiktok upload', '.csv'),
      check: save.fileName(base, 'tiktok checklist', '.txt'),
      guide: save.fileName(base, 'ad campaign guide', '.html'),
      links: save.fileName(base, 'ad links', '.csv'),
    };
    const linksCsv = files.csv(links, [{ key: 'angle', label: 'Angle' }, { key: 'platform', label: 'Platform' }, { key: 'url', label: 'Link' }]);
    const saved = [
      await save.saveFile(ctx, names.meta, metaCsv, 'text/csv'),
      await save.saveFile(ctx, names.google, g.csvText, 'text/csv'),
      await save.saveFile(ctx, names.tiktok, ttCsv, 'text/csv'),
      await save.saveFile(ctx, names.check, ttChecklist, 'text/plain'),
      await save.saveFile(ctx, names.guide, guideHtml),
    ];
    const zip = await save.saveFile(ctx, save.fileName(base, 'ad campaign files', '.zip'), files.zip([
      { name: names.meta, data: metaCsv }, { name: names.google, data: g.csvText }, { name: names.tiktok, data: ttCsv }, { name: names.check, data: ttChecklist }, { name: names.guide, data: guideHtml }, { name: names.links, data: linksCsv }, { name: save.fileName(base, 'google campaign guide', '.html'), data: g.guideHtml },
    ], { mtime: typeof ctx.now === 'function' ? ctx.now() : Date.now() }), 'application/zip');
    ctx.log(`Campaign "${campaign}": ${clean.length} ads on 3 networks, ${review.passed.length} lines passed the claims check, all paused.`);
    return {
      special: cat.answer,
      campaign,
      daily,
      files: saved,
      zip,
      claims: { passed: review.passed.length, proof: review.proof, blocked: review.blocked },
      restricted: restricted.flatMap((r) => r.lines.map((l) => l.line)),
      labels: lab.lines,
      checklist,
      page: pg ? { score: pg.score, claims: pageClaims ? pageClaims.status : 'pass' } : null,
      sample: isSampleHost(url),
    };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text('This uses a sample page address. Run it with your own https:// page before you upload anything.') : null,
      views.metric('Campaign files', `${out.files.length} files`, `Special category: ${out.special}. Everything paused until you turn it on.`),
      views.cards(out.checklist.map((c, i) => ({ title: `Check ${i + 1}`, body: c }))),
      out.claims.proof.length ? views.text(`${LINES.backup} Taken out: ${out.claims.proof.map((p) => `"${p.match}"`).join(', ')}.`) : views.text(`${out.claims.passed} lines passed the claims check.`),
      (out.labels || []).map((l) => views.text(l)),
      views.file(out.zip, 'Every file in one ZIP'),
      out.files.map((a, i) => views.file(a, ['Meta Ads Manager bulk import sheet', 'Google Ads Editor CSV', 'TikTok upload worksheet', 'TikTok upload checklist', 'Campaign guide (printable)'][i])),
    );
  },
};

module.exports = { specialCategory, planAudience, campaignFiles, AUDIENCE_INPUTS };
