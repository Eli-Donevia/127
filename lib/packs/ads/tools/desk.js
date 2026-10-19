// The ad desk tools: the 30-day math, angles, ads checked to the character, tracking links, the test
// plan and reading results.

const { text, ai, views, save, files, money, time } = require('../../_kit');
const A = require('../lib/ads');
const { page, table, esc } = require('../lib/page');

const NUM_INPUTS = {
  price: { type: 'number', title: 'Price per job', description: 'What one customer pays you for one job or visit' },
  cost: { type: 'number', title: 'Cost per job', description: 'Supplies, gas and help for one job', default: 0 },
  jobs30: { type: 'number', title: 'Jobs per customer in 30 days', default: 1 },
  closeRate: { type: 'number', title: 'Close rate (%)', description: 'Out of 100 people who ask, how many book', default: 25 },
  outreachCustomers: { type: 'integer', title: 'Customers from outreach so far', default: 0 },
  budget: { type: 'number', title: 'Ad budget for 30 days', default: 300 },
};

// What the ads sell, when the business details don't say it yet.
const SERVICE = { type: 'string', title: 'What you sell (optional)', description: 'Like "mobile car detailing". Leave it empty to use your business details.', maxLength: 80 };

const checkNumbers = {
  name: 'ads.check_numbers',
  title: 'Check your ad math',
  description: 'Does the 30-day math from your price, costs and card fees: profit per customer, the most you can pay for a customer, your max cost per lead, and a plain verdict on whether ads are worth it yet, with the 3 things not to do yet.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { ...NUM_INPUTS, service: SERVICE } },
  output: { type: 'object', properties: { numbers: { type: 'object' }, notYet: { type: 'array' }, files: { type: 'array' } }, required: ['numbers'] },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    const n = A.numbers(f, input);
    const notYet = A.notYet(n);
    const body = `<section><h2>${esc(n.title)}</h2><p class="lead">${esc(n.why)}</p>${n.lines ? `<div class="card"><h3>Your 30-day math</h3><ol>${n.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ol></div>` : ''}</section><section><h2>3 things not to do yet</h2><div class="card"><ol>${notYet.map((l) => `<li>${esc(l)}</li>`).join('')}</ol></div></section>${n.price ? `<section><h2>How Meta learns</h2><p class="lead">Meta says an ad set needs about ${A.LIMITS.meta.learningPhase.results} results in a week to finish learning. At your max cost per lead that is about ${esc(money.usd(n.learnWeek))} a week. Smaller budgets still work for a test, they just learn slower.</p></section>` : ''}`;
    const html = page(ctx, { title: n.title, kicker: 'Ad math', sub: `${f.vague ? '' : `${text.sentenceCase(f.service)}${f.city ? ` in ${f.city}` : ''}. `}Every number below comes from your own price and costs.`, stats: n.price ? [{ value: money.usd(n.gp30), label: 'profit per customer, 30 days' }, { value: money.usd(n.target), label: 'target cost per customer' }, { value: money.usd(n.maxCpl), label: 'max cost per lead' }] : [], body });
    const saved = [await save.saveFile(ctx, save.fileName(f.name || f.service, 'ad math', '.html'), html)];
    ctx.log(n.title);
    return { numbers: n, notYet, facts: f, files: saved };
  },
  view(out) {
    const n = out.numbers;
    return views.blocks(
      views.metric('Verdict', n.ready ? 'Ready for a small test' : 'Not yet', n.title),
      views.text(n.why),
      n.price ? [views.metric('Profit per customer in 30 days', money.usd(n.gp30), 'The most you could pay for a customer and break even'), views.metric('Max cost per lead', money.usd(n.maxCpl), `Half your profit per customer, at a ${n.closeRate}% close rate`)] : null,
      views.cards(out.notYet.map((t, i) => ({ title: `Not yet, number ${i + 1}`, body: t }))),
      out.files.map((a) => views.file(a, 'Your ad math (printable)')),
    );
  },
};

const ANGLES_SCHEMA = { type: 'object', properties: { angles: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, hook: { type: 'string', maxLength: 140 } }, required: ['key', 'hook'] } } }, required: ['angles'] };

const findAngles = {
  name: 'ads.find_angles',
  title: 'Find ad angles',
  description: 'Writes 6 angles to test (price up front, local call-out, before and after, your time back, what is included, who it is for), each with a hook and why it works, built from your offer, price and area. Post them as normal posts first; the ones people save and DM about earn ad money.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 6,
  input: { type: 'object', properties: { price: NUM_INPUTS.price, service: SERVICE, needService: { type: 'boolean', description: 'Stop with a clear message when nothing says what the member sells (the ads that follow are built from it).' } } },
  output: { type: 'object', properties: { angles: { type: 'array' }, ai: { type: 'boolean' } }, required: ['angles'] },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    if (input.needService) A.needService(f);
    let list = A.angles(f);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write ad hooks for a small local business. Plain words, no hype, no emoji, no promised results. Keep every fact exactly as given.',
      prompt: `Business: ${f.name || 'a small business'}${f.vague ? '' : `, ${f.service}`} in ${f.where || f.city || 'their area'}. Offer: ${f.offer}. Price: ${f.price != null ? money.usd(f.price) : 'not given'}. Make each hook more specific, under 120 characters, same angle.\n${JSON.stringify(list.map((a) => ({ key: a.key, hook: a.hook })))}`,
      schema: ANGLES_SCHEMA,
      fallback: () => ({ angles: [] }),
      accept: ai.cleanCopy,
    });
    const better = new Map((data.angles || []).map((a) => [a.key, text.oneLine(a.hook)]));
    list = list.map((a) => ({ ...a, hook: better.get(a.key) || a.hook }));
    return { angles: list, ai: usedAi };
  },
  view(out) {
    return [views.table([{ key: 'name', label: 'Angle' }, { key: 'hook', label: 'Hook' }, { key: 'why', label: 'Why it works' }], out.angles, 6), views.text(out.angles[0] ? out.angles[0].testFirst : '')];
  },
};

const writeAds = {
  name: 'ads.write_ads',
  title: 'Write checked ads',
  description: 'For one angle: Meta ad text (primary text, headline, description, Reels text), a Google responsive search ad (15 headlines of up to 30 characters, 4 descriptions of up to 90, two paths of up to 15), TikTok ad text (up to 100, no links or tags) and the first 3 seconds of the video. Every line is counted in code against the limit.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 6,
  input: { type: 'object', properties: { angle: { type: 'object', title: 'Angle', description: 'One angle from ads.find_angles' }, price: NUM_INPUTS.price, service: SERVICE }, required: ['angle'] },
  output: { type: 'object', properties: { angle: { type: 'object' }, meta: { type: 'object' }, google: { type: 'object' }, tiktok: { type: 'object' }, video: { type: 'object' }, checks: { type: 'array' } }, required: ['meta', 'google', 'tiktok', 'checks'] },
  async run(input, ctx) {
    if (!input.angle || !input.angle.hook) throw new Error('Pick an angle first.');
    const f = A.factsOf(ctx, input);
    A.needService(f);
    const a = input.angle;
    const ad = { angle: { key: a.key, name: a.name, hook: a.hook }, meta: A.metaAd(f, a), google: A.googleAd(f, a), tiktok: A.tiktokAd(f, a), video: A.videoBrief(f, a) };
    ad.checks = A.checks(ad);
    const bad = ad.checks.filter((c) => !c.ok);
    if (bad.length) throw new Error(`${bad[0].where} is over its limit (${bad[0].length} of ${bad[0].max}).`);
    ctx.log(`${a.name}: ${ad.checks.length} lines checked against platform limits`);
    return ad;
  },
  view(out) {
    return [
      views.copy(`Meta: ${out.angle.name}`, `Primary text: ${out.meta.primary}\nHeadline: ${out.meta.headline}\nDescription: ${out.meta.description}\nReels text: ${out.meta.reels}`),
      views.copy(`Google: ${out.angle.name}`, `Headlines:\n${out.google.headlines.join('\n')}\n\nDescriptions:\n${out.google.descriptions.join('\n')}\n\nPaths: /${out.google.path1}/${out.google.path2}`),
      views.copy(`TikTok: ${out.angle.name}`, out.tiktok.text),
    ];
  },
  viewMany(outs) {
    const rows = outs.flatMap((o) => o.checks.filter((c) => /primary text \(|headline \(|TikTok|description 1/.test(c.where)).map((c) => ({ angle: o.angle.name, where: c.where, text: c.text, length: `${c.length} of ${c.max}` })));
    return views.blocks(
      views.metric('Ad lines checked', outs.reduce((s, o) => s + o.checks.length, 0), 'Every line is within the platform limit'),
      views.table([{ key: 'angle', label: 'Angle' }, { key: 'where', label: 'Where' }, { key: 'text', label: 'Text' }, { key: 'length', label: 'Characters' }], rows, 12),
      outs.slice(0, 3).flatMap((o) => [views.copy(`Meta: ${o.angle.name}`, `Primary text: ${o.meta.primary}\nHeadline: ${o.meta.headline}\nDescription: ${o.meta.description}`), views.copy(`Google: ${o.angle.name}`, `${o.google.headlines.join('\n')}\n\n${o.google.descriptions.join('\n')}`), views.copy(`TikTok: ${o.angle.name}`, o.tiktok.text)]),
    );
  },
};

const planTest = {
  name: 'ads.plan_test',
  title: 'Plan your ad test',
  description: 'Builds your first ad test from your numbers and ads: the budget split, when to stop an ad and when to raise it, check-in reminders (ICS) for days 3, 7, 14, 21 and 30, tracking links with UTM tags for Meta, Google and TikTok, a tracker CSV and the ads page with every line ready to paste.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: { type: 'object', properties: { numbers: { type: 'object' }, ads: { type: 'array' }, url: { type: 'string', title: 'Page the ads send people to', maxLength: 300 }, campaign: { type: 'string', maxLength: 60 }, service: SERVICE }, required: ['numbers', 'ads'] },
  output: { type: 'object', properties: { split: { type: 'array' }, rules: { type: 'array' }, links: { type: 'array' }, files: { type: 'array' } }, required: ['files'] },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    const n = input.numbers || {};
    const ads = (input.ads || []).filter((x) => x && x.meta);
    if (!ads.length) throw new Error('Write the ads first.');
    const url = /^https:\/\//.test(input.url || '') ? input.url : f.website && f.website.startsWith('https://') ? f.website : 'https://yourwebsite.example';
    const campaign = text.slug(input.campaign || `${f.service} ${time.today(ctx).slice(0, 7)}`, 40);
    const budget = n.budget || 300;
    const testShare = money.round(budget / 2);
    const perAngleDay = money.round(testShare / 14 / ads.length);
    const split = [
      ...ads.map((o) => ({ when: 'Days 1 to 14', what: `Meta: ${o.angle.name}`, daily: money.usd(perAngleDay), total: money.usd(perAngleDay * 14) })),
      { when: 'Days 15 to 30', what: 'The winner only (lowest cost per lead under your max)', daily: money.usd(money.round((budget - testShare) / 16)), total: money.usd(budget - testShare) },
    ];
    const max = n.maxCpl ? money.usd(n.maxCpl) : 'your max cost per lead';
    const rules = [
      `Stop an ad that spends ${n.maxCpl ? money.usd(n.maxCpl * 2) : 'twice your max cost per lead'} with no lead.`,
      `Stop an ad whose leads cost more than ${max} after 3 days.`,
      `Keep an ad whose leads cost ${max} or less. After 2 customers at or under ${n.target ? money.usd(n.target) : 'your target'} each, raise its budget about 20% every 3 days.`,
      'Change one thing at a time: the first line, the first frame, or the page. Never all three.',
      n.ready === false ? `First, fix this: ${n.title}.` : 'Answer every lead within 5 minutes. A fast reply is part of the ad.',
    ];
    const links = ads.flatMap((o) => [
      { angle: o.angle.name, platform: 'Meta', url: A.utm(url, { utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: campaign, utm_content: o.angle.key }) },
      { angle: o.angle.name, platform: 'Google', url: A.utm(url, { utm_source: 'google', utm_medium: 'cpc', utm_campaign: campaign, utm_content: o.angle.key, utm_term: '{keyword}' }) },
      { angle: o.angle.name, platform: 'TikTok', url: A.utm(url, { utm_source: 'tiktok', utm_medium: 'paid_social', utm_campaign: campaign, utm_content: o.angle.key }) },
    ]);
    const start = time.addDays(time.today(ctx), 1);
    const tz = time.tzOf(ctx);
    const checkins = [3, 7, 14, 21, 30].map((d) => ({ uid: `ads-check-${d}-${start}@127group.io`, title: `Ad check-in, day ${d}`, description: `Open your ads, paste the numbers into Read your ad results, and apply the rules:\n${rules.join('\n')}`, date: time.addDays(start, d - 1), time: '09:00', minutes: 20, tz }));
    const tracker = files.csv(ads.flatMap((o) => [3, 7, 14, 21, 30].map((d) => ({ day: d, date: time.addDays(start, d - 1), platform: 'Meta', angle: o.angle.name }))), [
      { key: 'day', label: 'Day' }, { key: 'date', label: 'Date' }, { key: 'platform', label: 'Platform' }, { key: 'angle', label: 'Angle' }, { key: 'spend', label: 'Spend' }, { key: 'impressions', label: 'Impressions' },
      { key: 'clicks', label: 'Link clicks' }, { key: 'leads', label: 'Leads' }, { key: 'customers', label: 'Customers' }, { key: 'revenue', label: 'Revenue' }, { key: 'cpl', label: 'Cost per lead' }, { key: 'decision', label: 'Decision' },
    ], { bom: true });
    const adRows = ads.flatMap((o) => o.checks.map((c) => ({ angle: o.angle.name, where: c.where, text: c.text, chars: `${c.length} of ${c.max}` })));
    const body = `<section><h2>Budget split</h2><p class="lead">Half the budget finds the winner, the other half runs it.</p>${table([{ key: 'when', label: 'When' }, { key: 'what', label: 'What' }, { key: 'daily', label: 'Per day' }, { key: 'total', label: 'Total' }], split)}</section>
<section><h2>Stop and raise rules</h2><div class="card"><ol>${rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></div></section>
<section><h2>Your ads, every line counted</h2>${table([{ key: 'angle', label: 'Angle' }, { key: 'where', label: 'Where' }, { key: 'text', label: 'Text' }, { key: 'chars', label: 'Characters' }], adRows)}</section>
<section><h2>First 3 seconds of each video</h2>${ads.map((o) => `<div class="card"><span class="tag">${esc(o.angle.name)}</span>${table([{ key: 'at', label: 'When' }, { key: 'show', label: 'Show' }, { key: 'onScreen', label: 'On screen' }, { key: 'say', label: 'Say' }], o.video.first3)}<ul>${o.video.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`).join('')}</section>
<section><h2>Tracking links</h2><p class="lead">Use these as the ad's website link so you can see which angle brought each visit. Keep them lowercase.</p>${table([{ key: 'angle', label: 'Angle' }, { key: 'platform', label: 'Platform' }, { key: 'url', label: 'Link' }], links)}</section>
${A.LIMITS.meta.specialAdCategories ? `<section><h2>Before you publish</h2><div class="card"><p>If your ads are about ${esc(A.LIMITS.meta.specialAdCategories.list.join(', ').toLowerCase())}, Meta needs you to pick that special ad category. ${esc(A.LIMITS.meta.specialAdCategories.effect)}</p><p>On Google, set location to Presence (people in your area). Add your area's ZIP codes or a radius around ${esc(f.city || 'your city')}.</p></div></section>` : ''}`;
    const html = page(ctx, { title: 'Your first ad test', kicker: 'Test plan', sub: `${money.usd(budget)} over 30 days, ${ads.length} ${ads.length === 1 ? 'angle' : 'angles'}, with the stop rules set before you spend.`, stats: [{ value: money.usd(budget), label: '30-day budget' }, { value: n.maxCpl ? money.usd(n.maxCpl) : 'Add price', label: 'max cost per lead' }, { value: ads.length, label: 'angles' }], body });
    const base = f.name || f.service;
    const saved = [
      await save.saveFile(ctx, save.fileName(base, 'ad test plan', '.html'), html),
      await save.saveFile(ctx, save.fileName(base, 'ad tracker', '.csv'), tracker),
      await save.saveFile(ctx, save.fileName(base, 'ad links', '.csv'), files.csv(links, [{ key: 'angle', label: 'Angle' }, { key: 'platform', label: 'Platform' }, { key: 'url', label: 'Link' }])),
      await save.saveFile(ctx, save.fileName(base, 'ad check-ins', '.ics'), files.ics(checkins, { name: `${base} ad check-ins`, now: time.nowMs(ctx) })),
    ];
    return { split, rules, links, files: saved, sample: url.endsWith('.example') };
  },
  view(out) {
    return views.blocks(
      views.table([{ key: 'when', label: 'When' }, { key: 'what', label: 'What' }, { key: 'daily', label: 'Per day' }, { key: 'total', label: 'Total' }], out.split),
      views.cards(out.rules.map((r, i) => ({ title: `Rule ${i + 1}`, body: r }))),
      out.sample ? views.text('Add your website link to get tracking links that point to your real page.') : null,
      out.files.map((a, i) => views.file(a, ['Test plan and all ads (printable)', 'Tracker for Google Sheets', 'Tracking links', 'Check-in reminders (ICS)'][i])),
    );
  },
};

const readResults = {
  name: 'ads.read_results',
  title: 'Read your ad results',
  description: 'Reads a Meta Ads Manager export (CSV) or the numbers you paste, works out cost per 1,000 views, click rate, cost per click, cost per lead and return on ad spend for each ad, and says where each one is stuck (the ad, the page or the cost) against your own max cost per lead.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      csv: { type: 'string', title: 'Paste your export (CSV)', description: 'From Ads Manager: Reports, Export table data', maxLength: 200000 },
      spend: { type: 'number' }, impressions: { type: 'number' }, clicks: { type: 'number' }, results: { type: 'number' }, revenue: { type: 'number' },
      ...NUM_INPUTS,
    },
  },
  output: { type: 'object', properties: { rows: { type: 'array' }, totals: { type: 'object' }, numbers: { type: 'object' }, files: { type: 'array' } }, required: ['rows'] },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    const n = A.numbers(f, { ...input, outreachCustomers: 3 });
    let rows = A.readRows(input.csv || '');
    let sample = false;
    if (!rows.length && (input.spend || input.impressions)) rows = [{ name: 'Your numbers', spend: money.num(input.spend, 0), impressions: money.num(input.impressions, 0), reach: 0, clicks: money.num(input.clicks, 0), results: money.num(input.results, 0), revenue: money.num(input.revenue, 0) }];
    if (!rows.length) {
      rows = A.readRows(require('fs').readFileSync(require('path').join(__dirname, '..', 'sample', 'meta-export.csv'), 'utf8'));
      sample = true;
    }
    const out = rows.map((r) => A.diagnose(r, n.price ? n : null));
    const sum = (k) => out.reduce((s, r) => s + (r[k] || 0), 0);
    const totals = A.diagnose({ name: 'All ads', spend: sum('spend'), impressions: sum('impressions'), reach: sum('reach'), clicks: sum('clicks'), results: sum('results'), revenue: sum('revenue') }, n.price ? n : null);
    const fmt = (r) => ({ name: r.name, spend: money.usd(r.spend), cpm: r.cpm != null ? money.usd(r.cpm) : '', ctr: r.ctr != null ? `${r.ctr}%` : '', cpc: r.cpc != null ? money.usd(r.cpc) : '', cpr: r.cpr != null ? money.usd(r.cpr) : 'no leads', roas: r.roas != null ? `${r.roas}x` : '', stage: r.stage, call: r.call, fix: r.fix });
    const cols = [{ key: 'name', label: 'Ad' }, { key: 'spend', label: 'Spend' }, { key: 'cpm', label: 'Per 1,000 views' }, { key: 'ctr', label: 'Click rate' }, { key: 'cpc', label: 'Per click' }, { key: 'cpr', label: 'Per lead' }, { key: 'roas', label: 'Return' }, { key: 'call', label: 'Call' }];
    const body = `<section><h2>Each ad</h2>${table(cols, out.map(fmt))}</section><section><h2>What to do</h2>${out.map((r) => `<div class="card"><span class="tag${r.call.startsWith('Keep') ? ' ok' : ''}">${esc(r.call)}</span><h3>${esc(r.name)}</h3><p>${esc(r.fix)}</p></div>`).join('')}</section>${n.price ? `<section><h2>Your limits</h2><div class="card"><p>Max cost per lead: ${esc(money.usd(n.maxCpl))}. Most you can pay for a customer and break even: ${esc(money.usd(n.breakEven))}.${n.breakEvenRoas ? ` Break-even return on ad spend: ${esc(n.breakEvenRoas)}x.` : ''}</p></div></section>` : ''}`;
    const html = page(ctx, { title: `Ad results: ${totals.call.toLowerCase()}`, kicker: sample ? 'Sample results' : 'Ad results', sub: sample ? 'This is a made-up export so you can see how it works. Paste your own from Ads Manager.' : `${out.length} ads read. Each one is checked against your own max cost per lead.`, stats: [{ value: money.usd(totals.spend), label: 'spent' }, { value: totals.results || 0, label: 'leads' }, { value: totals.cpr != null ? money.usd(totals.cpr) : 'none yet', label: 'per lead' }], body });
    const saved = [await save.saveFile(ctx, save.fileName(f.name || f.service, 'ad results', '.html'), html), await save.saveFile(ctx, save.fileName(f.name || f.service, 'ad results', '.csv'), files.csv(out.map(fmt), [...cols, { key: 'stage', label: 'Stuck at' }, { key: 'fix', label: 'Fix' }]))];
    return { rows: out.map(fmt), totals: fmt(totals), numbers: n, files: saved, sample };
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'This report'),
      views.metric('Spent', out.totals.spend, `${out.totals.cpr} per lead overall`),
      out.numbers.price ? views.metric('Your max cost per lead', money.usd(out.numbers.maxCpl), 'Half your 30-day profit per customer, at your close rate') : null,
      views.table([{ key: 'name', label: 'Ad' }, { key: 'ctr', label: 'Click rate' }, { key: 'cpr', label: 'Per lead' }, { key: 'call', label: 'Call' }, { key: 'fix', label: 'Why' }], out.rows, 12),
      out.files.map((a, i) => views.file(a, i ? 'Results CSV' : 'Results report (printable)')),
    );
  },
};

module.exports = { checkNumbers, findAngles, writeAds, planTest, readResults, NUM_INPUTS, SERVICE };
