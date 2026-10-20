// The ad desk's shared logic: the member's facts, the 30-day math, angles, ad copy checked to the
// character against each platform's limit, tracking links and reading results. No statistics and no
// promised results: every number comes from the member's own price, costs and ad account.

const { brain, text, money, time, web } = require('../../_kit');
const C = require('./claims');
const LIMITS = require('../data/platforms.json');
const SEASONS = require('../data/seasons.json');

const sc = (s) => text.sentenceCase(String(s || '').trim());
const noEnd = (s) => String(s || '').trim().replace(/[.?!]+$/, '');
const lowerFirst = (s) => (/^[A-Z]{2,}\b|^I\b/.test(String(s)) ? String(s) : String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1));

// HQ fills an empty niche with the member's onboarding answer ("Local business"), which names no
// business, so it never becomes what the ads sell (the kit's brainOf and ownWords drop it).
const own = brain.ownWords;

function factsOf(ctx, input = {}) {
  const b = brain.brainOf(ctx, input);
  const said = text.oneLine(input.service || own(b.niche) || own(b.what) || own(b.offer) || '').replace(/^(a|an|the)\s+/i, '');
  const service = said || 'your service';
  const mobile = /\bmobile\b|come to you|at your (home|door|office)|on[- ]site/i.test(`${b.what} ${b.offer}`);
  const area = (String(b.audience || '').match(/\bin\s+((?:[A-Z][\w'.]*\s*){1,3})/) || [])[1];
  return {
    name: b.name || '',
    first: b.firstName || '',
    service: lowerFirst(service),
    vague: !said, // nothing says what they sell
    offer: text.oneLine(b.offer || ''),
    audience: text.oneLine(b.audience || ''),
    city: b.city || '',
    region: b.region || '',
    where: (area || b.city || '').trim(),
    price: money.num(input.price) != null ? money.num(input.price) : b.price,
    website: /^https?:\/\//.test(input.url || '') ? input.url : b.website ? (/^https?:/.test(b.website) ? b.website : `https://${b.website}`) : '',
    mobile,
    month: time.partsIn(time.nowMs(ctx), time.tzOf(ctx)).m,
  };
}

function season(f) {
  const hay = `${f.service} ${f.offer}`.toLowerCase();
  const s = SEASONS.slow.find((x) => x.words.some((w) => hay.includes(w)));
  if (!s || SEASONS.warmStates.includes(String(f.region || '').toUpperCase())) return null;
  return s.months.includes(f.month) ? s : null;
}

// The 30-day math from the member's own numbers.
function numbers(f, input = {}) {
  const price = money.num(input.price) != null ? money.num(input.price) : f.price;
  const cost = money.num(input.cost, 0);
  const jobs30 = Math.max(1, money.num(input.jobs30, 1));
  const closeRate = Math.min(1, Math.max(0.01, money.num(input.closeRate, 25) / 100));
  const outreach = Math.max(0, Math.round(money.num(input.outreachCustomers, 0)));
  const budget = Math.max(0, money.num(input.budget, 300));
  if (price == null || !(price > 0)) return { ready: false, status: 'missing', title: 'Add your price first', why: 'The math starts from what one job pays you. Add your price per job and run this again.', price: null };
  const fee = money.cardFee(price);
  const gp = money.round(price - cost - fee);
  const gp30 = money.round(gp * jobs30);
  const breakEven = gp30;
  const target = money.round(gp30 / 2);
  const maxCpl = money.round(target * closeRate);
  const leadsForBudget = maxCpl > 0 ? Math.floor(budget / maxCpl) : 0;
  const learnWeek = money.round(LIMITS.meta.learningPhase.results * maxCpl);
  const slow = season(f);
  let status = 'ready';
  let title = 'Ready for a small test';
  let why = `After costs and card fees, one customer leaves you ${money.usd(gp30)} in the first 30 days. Spend no more than ${money.usd(target)} in ads for each new customer, which means no more than ${money.usd(maxCpl)} per lead at your close rate.`;
  if (gp <= 0) {
    status = 'no';
    title = 'Not yet: each job loses money';
    why = `After ${money.usd(cost)} in costs and about ${money.usd(fee)} in card fees, a ${money.usd(price)} job leaves ${money.usd(gp)}. Raise the price or cut the cost before any ad.`;
  } else if (outreach < 3) {
    status = 'not_yet';
    title = 'Not yet: get 3 customers from outreach first';
    why = `Ads make more of what already works. You have ${outreach} ${outreach === 1 ? 'customer' : 'customers'} from texts, calls and DMs so far. When 3 people have paid ${money.usd(price)} from outreach, your offer is proven and an ad has something to amplify.`;
  } else if (slow) {
    status = 'not_yet';
    title = `Not yet: it is the slow season for ${slow.what}`;
    why = `In places with cold winters, people do not book ${slow.what} now. Save the budget for the first warm weeks, and use this time to collect before and after photos.`;
  } else if (leadsForBudget < 10) {
    status = 'not_yet';
    title = 'Not yet: the budget is too small to learn anything';
    why = `At no more than ${money.usd(maxCpl)} per lead, ${money.usd(budget)} buys at most ${leadsForBudget} leads. That is too few to tell a good ad from a bad one. Raise the price, add a repeat visit, or keep doing outreach.`;
  }
  return {
    ready: status === 'ready', status, title, why,
    price, cost, fee, gp, jobs30, gp30, breakEven, target, closeRate: Math.round(closeRate * 100), maxCpl, outreach, budget, leadsForBudget, learnWeek,
    breakEvenRoas: gp30 > 0 ? money.round((price * jobs30) / gp30, 2) : null,
    lines: [
      `Price per job: ${money.usd(price)}`,
      `Minus costs per job: ${money.usd(cost)}`,
      `Minus card fees (about 2.9% plus 30 cents): ${money.usd(fee)}`,
      `Profit per job: ${money.usd(gp)}`,
      `Jobs per customer in 30 days: ${jobs30}`,
      `Profit per customer in 30 days: ${money.usd(gp30)} (the most you could pay for a customer and break even)`,
      `Target cost per customer (half of that): ${money.usd(target)}`,
      `Max cost per lead at a ${Math.round(closeRate * 100)}% close rate: ${money.usd(maxCpl)}`,
      `What ${money.usd(budget)} buys at that max: up to ${leadsForBudget} leads`,
    ],
  };
}

function notYet(n) {
  const out = [];
  if (!n.ready) out.push('Do not boost posts or buy ads yet. Keep sending 25 messages a day to people who might buy.');
  out.push('Do not send ad clicks to your home page. Send them to one page with one offer, the price and one button.');
  out.push('Do not test more than 3 angles at once, and set the stop rule before you spend a dollar.');
  if (n.ready) out.push('Do not raise the budget on day 2. Give each ad 3 days and at least your max cost per lead in spend before you judge it.');
  return out.slice(0, 3);
}

// Angles to test, from the member's facts. Each one can be posted as a normal post first. When
// nothing says what they sell, the hooks leave it out instead of saying "your service".
function angles(f, n = {}) {
  const S = f.service;
  const V = !!f.vague;
  const where = f.where || f.city;
  const price = f.price != null ? money.usd(f.price) : '';
  const list = [];
  if (price) list.push({ key: 'price', name: 'Price up front', hook: V ? `${where ? `${where}: ` : ''}${price}, and you know the price before I start.` : `${sc(S)}${where ? ` in ${where}` : ''}: ${price}, and you know the price before I start.`, why: 'Price is the first question every buyer has. Saying it first filters for people ready to book.' });
  list.push({ key: 'local', name: 'Local call-out', hook: `${where ? `${where}: if` : 'If'} you have been putting ${V ? 'it off' : `off ${S}`}, this is for you.`, why: 'Naming the area makes the people near you stop scrolling.' });
  list.push({ key: 'proof', name: 'Before and after', hook: `A real ${V ? '' : `${S} `}job${where ? ` in ${where}` : ''}, before and after. Watch the last shot.`, why: 'The fastest proof there is. Use one of your own jobs, with permission.' });
  list.push({ key: 'time', name: 'Your time back', hook: f.mobile ? `I come to you${where ? ` anywhere in ${where}` : ''}, so you do not lose a Saturday${V ? '' : ` to ${S}`}.` : `Book ${V ? '' : `${S} `}in two minutes and get your weekend back.`, why: 'Busy buyers pay to skip the hassle. Show what they get back.' });
  list.push({ key: 'included', name: 'What is included', hook: f.offer ? `Here is everything included: ${lowerFirst(noEnd(f.offer))}.` : `Here is exactly what is included when you book${V ? '' : ` ${S}`}.`, why: 'Clear scope beats a vague promise and answers questions before they are asked.' });
  list.push({ key: 'who', name: 'Who it is for', hook: f.audience ? `For ${lowerFirst(noEnd(f.audience))}: ${V ? 'a clear price and no hassle' : `${S} without the hassle`}.` : `Who ${V ? 'this' : S} is for, and who should skip it.`, why: 'Calling out the buyer makes the right people feel seen and the wrong ones scroll on.' });
  return list.map((a, i) => ({ ...a, rank: i + 1, testFirst: 'Post it as a normal Reel or post first. If it gets saves, shares and DMs, it has earned ad money.' }));
}

// ---------- copy, fitted and checked ----------

function fit(cands, max) {
  for (const c of cands) {
    const t = text.oneLine(c);
    if (t && t.length <= max) return t;
  }
  return text.oneLine(cands[cands.length - 1]).slice(0, max).replace(/\s+\S*$/, '');
}

function titleCase(s) {
  return String(s).replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
}

function googleAd(f, a) {
  const S = titleCase(f.service);
  const C = f.city || '';
  const inC = C ? ` in ${C}` : '';
  const price = f.price != null ? money.usd(f.price) : '';
  const raw = [
    C && `${S} in ${C}`, C && `${S} ${C}`, C && `${C} ${S}`, price && `${S} From ${price}`, price && `${price} ${S}`, price && `Clear Price: ${price}`,
    f.mobile && 'We Come to You', f.mobile && `Mobile ${S}`, a.key === 'time' && 'Get Your Weekend Back', a.key === 'proof' && 'See Real Before and Afters',
    a.key === 'included' && 'See What Is Included', 'Price Before We Start', 'Get a Quick Quote', 'Call or Text Today', 'Easy to Book', 'Local and Owner Run',
    C && `Serving ${C}`, f.where && f.where !== C && `Serving ${f.where}`, 'Friendly Local Service', 'Message Us for a Price', `Book ${S} Today`, `${S} Near You`,
    'Questions? Just Ask', 'Clear Scope, No Surprises', 'Book Your Spot', 'Real Photos of Real Jobs', 'Talk to the Owner', 'Message Us Today', 'Same Price for Everyone', 'Ask Us Anything', 'Clear Prices',
  ].filter(Boolean).map((h) => text.oneLine(h)).filter((h) => h.length <= LIMITS.google.rsa.headlineMax);
  const headlines = [...new Set(raw)].slice(0, LIMITS.google.rsa.headlines);
  const D = LIMITS.google.rsa.descriptionMax;
  const descriptions = [
    fit([`${sc(f.service)}${inC}${price ? ` for ${price}` : ''}. You know the price before we start.`, `${sc(f.service)}${inC}. Price before we start.`], D),
    fit([f.offer ? `${noEnd(sc(f.offer))}. Book in a few minutes.` : '', `Clear scope and a price up front. Book in a few minutes.`].filter(Boolean), D),
    fit([`${noEnd(a.hook)}.`, `Message us and get a price today.`], D),
    fit([f.mobile ? `We come to you${C ? ` anywhere in ${C}` : ''}. Call or text to book.` : `Easy to book${inC}. Call, text or message us.`, 'Call, text or message us today.'], D),
  ];
  const slug = (s) => text.slug(s, 15).replace(/-+$/, '');
  return { headlines, descriptions, path1: (slug(f.service.split(' ').slice(-2).join('-')) || 'services').slice(0, LIMITS.google.rsa.pathMax), path2: (slug(C) || 'book').slice(0, LIMITS.google.rsa.pathMax) };
}

function metaAd(f, a) {
  const price = f.price != null ? money.usd(f.price) : '';
  const primary = fit([
    `${noEnd(a.hook)}. ${price && !a.hook.includes(price) ? `${price}, price up front. ` : ''}Tap to book.`,
    `${noEnd(a.hook)}. Tap to book.`,
    noEnd(a.hook),
  ], LIMITS.meta.primaryTextInstagramFeed);
  const headline = fit([price ? `${titleCase(f.service)}, ${price}` : '', f.city && `${titleCase(f.service)} in ${f.city}`, titleCase(f.service), 'Book Today'].filter(Boolean), LIMITS.meta.headlineFacebookFeed);
  const description = fit([f.mobile ? 'We come to you' : f.city ? `Serving ${f.city}` : 'Price before we start', 'Price before we start', 'Easy to book'], LIMITS.meta.description.max);
  const reels = fit([`${sc(f.service)}${price ? `, ${price}` : ''}. Tap to book.`, `${sc(f.service)}. Tap to book.`, 'Tap to book.'], LIMITS.meta.primaryTextReels);
  return { primary, headline, description, reels };
}

function tiktokAd(f, a) {
  const clean = (s) => String(s).replace(/https?:\/\/\S+|[@#]\S*/g, '').replace(/\s+/g, ' ').trim();
  return { text: fit([clean(a.hook), clean(`${sc(f.service)}${f.city ? ` in ${f.city}` : ''}. Tap to book.`)], LIMITS.tiktok.adTextMax) };
}

function videoBrief(f, a) {
  return {
    first3: [
      { at: '0.0 to 1.0 s', show: a.key === 'proof' ? 'The worst part of the before, close up' : 'You, face to camera, mid-sentence', onScreen: text.clip(noEnd(a.hook), 40), say: text.clip(noEnd(a.hook), 90) },
      { at: '1.0 to 2.0 s', show: 'Cut to the work in progress', onScreen: '', say: '' },
      { at: '2.0 to 3.0 s', show: 'The finished result, same angle as the before', onScreen: f.price != null ? money.usd(f.price) : 'Price up front', say: '' },
    ],
    rest: ['Who you are in one line: name, business and area.', 'What is included, in three quick shots.', 'Close: the price and "tap to book".'],
    rules: ['Film vertical (9:16). Keep text out of the top 14% and bottom 35% of the frame, where the app puts its buttons.', 'Real job, real customer (with their OK). No stock footage.', 'If a creator films it, they say it is an ad (FTC disclosure).'],
  };
}

function checks(ad) {
  const L = LIMITS;
  const rows = [
    { where: 'Meta primary text (Instagram feed)', text: ad.meta.primary, max: L.meta.primaryTextInstagramFeed },
    { where: 'Meta headline (Facebook feed)', text: ad.meta.headline, max: L.meta.headlineFacebookFeed },
    { where: 'Meta description', text: ad.meta.description, max: L.meta.description.max },
    { where: 'Meta Reels primary text', text: ad.meta.reels, max: L.meta.primaryTextReels },
    ...ad.google.headlines.map((h, i) => ({ where: `Google headline ${i + 1}`, text: h, max: L.google.rsa.headlineMax })),
    ...ad.google.descriptions.map((d, i) => ({ where: `Google description ${i + 1}`, text: d, max: L.google.rsa.descriptionMax })),
    { where: 'Google path 1', text: ad.google.path1, max: L.google.rsa.pathMax },
    { where: 'Google path 2', text: ad.google.path2, max: L.google.rsa.pathMax },
    { where: 'TikTok ad text', text: ad.tiktok.text, max: L.tiktok.adTextMax },
  ];
  return rows.map((r) => ({ ...r, length: r.text.length, ok: r.text.length > 0 && r.text.length <= r.max }));
}

// D3, D4 on every line of one ad: a line that fails the claims check is swapped for a plain line from
// the member's own facts. Returns { checked, replaced: [{ where, why, match }] }.
function clean(ad, f, { typed = '' } = {}) {
  const S = sc(f.service);
  const inC = f.city ? ` in ${f.city}` : '';
  const replaced = [];
  let checked = 0;
  const fix = (where, value, safe) => {
    checked++;
    const c = C.check(value, { typed });
    if (c.ok) return value;
    const p = c.blocked[0] || c.proof[0];
    replaced.push({ where, why: c.blocked.length ? 'blocked' : 'needs proof', match: p.match });
    return safe;
  };
  ad.meta.primary = fix('Meta primary text', ad.meta.primary, fit([`${S}${inC}. Tap to book.`, `${S}. Tap to book.`], LIMITS.meta.primaryTextInstagramFeed));
  ad.meta.headline = fix('Meta headline', ad.meta.headline, fit([titleCase(f.service), 'Book Today'], LIMITS.meta.headlineFacebookFeed));
  ad.meta.description = fix('Meta description', ad.meta.description, 'Easy to book');
  ad.meta.reels = fix('Meta Reels text', ad.meta.reels, 'Tap to book.');
  const heads = ad.google.headlines.filter((h, i) => fix(`Google headline ${i + 1}`, h, '') !== '');
  for (const h of ['Easy to Book', 'Call or Text Today', 'Message Us Today', 'Ask Us Anything', 'Clear Prices', 'Book Your Spot', 'Talk to the Owner', 'Questions? Just Ask']) if (heads.length < LIMITS.google.rsa.headlines && !heads.includes(h)) heads.push(h);
  ad.google.headlines = heads.slice(0, LIMITS.google.rsa.headlines);
  ad.google.descriptions = ad.google.descriptions.map((d, i) => fix(`Google description ${i + 1}`, d, ['Call, text or message us today.', 'Clear scope and a price up front. Book in a few minutes.', 'Message us and get a price today.', `${S}${inC}. Call or text to book.`.slice(0, LIMITS.google.rsa.descriptionMax)][i % 4]));
  ad.tiktok.text = fix('TikTok ad text', ad.tiktok.text, fit([`${S}${inC}. Tap to book.`, 'Tap to book.'], LIMITS.tiktok.adTextMax));
  if (ad.video) for (const [i, x] of ad.video.first3.entries()) {
    if (x.say) x.say = fix(`Video ${x.at} spoken`, x.say, text.clip(S, 90));
    if (x.onScreen) x.onScreen = fix(`Video ${x.at} on screen`, x.onScreen, i === 0 ? text.clip(S, 40) : '');
  }
  return { checked, replaced };
}

// The ad as a script for the video pack's renderer (video.promo): HOOK, OFFER, PRICE and CTA lines,
// each one already through the claims check.
function videoScript(f, a, ad) {
  const said = ad.video && ad.video.first3[0] && ad.video.first3[0].say;
  const hook = said && said.length <= 90 && !/\.\.\.$/.test(said) ? said : `${sc(f.service)}${f.city ? ` in ${f.city}` : ''}`;
  const site = f.website ? web.domainOf(f.website) : '';
  const lines = [`HOOK: ${noEnd(hook)}`, `OFFER: ${f.name || sc(f.service)} | ${sc(f.service)}${f.city ? ` in ${f.city}` : ''}`];
  if (f.price != null) lines.push(`PRICE: ${money.usd(f.price)}, price up front`);
  lines.push(`CTA: Tap to book${site ? ` | ${site}` : ''}`);
  const ok = lines.filter((l) => C.check(l.replace(/^[A-Z]+:\s*/, ''), { typed: `${f.name} ${f.service} ${f.city} ${site}` }).ok);
  return { title: text.clip(`${a.name} ad`, 60), kind: 'promo', seconds: 15, text: ok.join('\n') };
}

// ---------- links ----------

function utm(url, p) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(p)) if (v) u.searchParams.set(k, v);
  return u.toString().replace(/%7B/g, '{').replace(/%7D/g, '}');
}

// ---------- results ----------

const HEAD = {
  name: /^(ad name|ad set name|campaign name|campaign|ad|name)$/i,
  spend: /^(amount spent( \(usd\))?|spend|cost|amount spent \(.*\))$/i,
  impressions: /^impr(essions|\.)?$/i,
  reach: /^reach$/i,
  clicks: /^(link clicks|clicks \(all\)|clicks)$/i,
  results: /^(results|leads|conversions|messaging conversations started)$/i,
  revenue: /^(purchase conversion value|conv\. value|revenue|conversion value)$/i,
};

function parseCsv(s) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const t = String(s || '').replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

function readRows(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim());
  const idx = {};
  for (const [k, re] of Object.entries(HEAD)) {
    const pref = k === 'clicks' ? head.findIndex((h) => /^link clicks$/i.test(h)) : -1;
    idx[k] = pref >= 0 ? pref : head.findIndex((h) => re.test(h));
  }
  const n = (r, k) => (idx[k] >= 0 ? money.num(String(r[idx[k]] || '').replace(/[$,%]/g, ''), 0) : 0);
  return rows.slice(1).map((r, i) => ({ name: idx.name >= 0 ? text.clip(r[idx.name], 60) : `Row ${i + 1}`, spend: n(r, 'spend'), impressions: n(r, 'impressions'), reach: n(r, 'reach'), clicks: n(r, 'clicks'), results: n(r, 'results'), revenue: n(r, 'revenue') })).filter((r) => r.spend || r.impressions);
}

function diagnose(r, nums) {
  const m = {
    cpm: r.impressions ? money.round((r.spend / r.impressions) * 1000) : null,
    ctr: r.impressions ? money.round((r.clicks / r.impressions) * 100, 2) : null,
    cpc: r.clicks ? money.round(r.spend / r.clicks) : null,
    cpr: r.results ? money.round(r.spend / r.results) : null,
    roas: r.revenue && r.spend ? money.round(r.revenue / r.spend, 2) : null,
    clickToLead: r.clicks ? money.round((r.results / r.clicks) * 100, 1) : null,
  };
  const max = nums && nums.maxCpl;
  let stage;
  let call;
  let fix;
  if (r.impressions < 1000) {
    stage = 'Too early'; call = 'Keep running'; fix = 'Fewer than 1,000 people have seen it. Wait for more data before you change anything.';
  } else if (m.ctr != null && m.ctr < 0.8) {
    stage = 'The ad'; call = max && r.spend >= 2 * max && !r.results ? 'Stop it' : 'Fix the ad'; fix = `Only ${m.ctr}% clicked (a rule of thumb is about 1% or more). Test a new first line and a new first frame: your best before and after, or the price in the first second.`;
  } else if (max && m.cpr != null && m.cpr <= max) {
    stage = 'Working'; call = 'Keep, then scale'; fix = `Leads cost ${money.usd(m.cpr)}, under your max of ${money.usd(max)}. Raise the daily budget by about 20% every 3 days while it stays under.`;
  } else if (r.clicks >= 30 && (m.clickToLead == null || m.clickToLead < 5)) {
    stage = 'The page'; call = 'Fix the page'; fix = `People click but few reach out (${m.clickToLead || 0}% of clicks). Put the price, one button and a tap-to-call or text link at the top of the page, matching the ad's words.`;
  } else if (max && m.cpr != null && m.cpr > max) {
    stage = 'The cost'; call = r.spend >= 3 * max ? 'Stop it' : 'Watch it'; fix = `Each lead costs ${money.usd(m.cpr)}, above your max of ${money.usd(max)}. Stop it, or raise the price or the close rate first.`;
  } else if (max && !r.results && r.spend >= 2 * max) {
    stage = 'The cost'; call = 'Stop it'; fix = `It spent ${money.usd(r.spend)} with no leads, twice your max cost per lead.`;
  } else {
    stage = 'Not sure yet'; call = 'Keep running'; fix = 'Add your price and costs so we can compare each lead with what you can afford.';
  }
  return { ...r, ...m, stage, call, fix };
}

// Ad copy is built from what the member sells; without it every line would be about "your service".
function needService(f) {
  if (f.vague) throw new Error('Tell us what you sell first, like "mobile car detailing": type it in What you sell, or add it to your business details. Every ad line is built from it.');
}

module.exports = { LIMITS, clean, videoScript, fit, factsOf, needService, numbers, notYet, angles, googleAd, metaAd, tiktokAd, videoBrief, checks, utm, readRows, parseCsv, diagnose, season, titleCase };
