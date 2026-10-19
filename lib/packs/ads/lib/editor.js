// A Google search campaign as one Google Ads Editor CSV (data/google-editor.json, read on Google's
// help pages): the campaign (Paused, Google Search only, Manual CPC, a daily budget from the
// member's own 30-day budget), ad groups with a starting Max CPC from their max cost per lead,
// phrase and exact keywords, campaign negatives for job and how-to searches, and one responsive
// search ad per ad group with every line counted. Nothing spends until the member turns it on.

const { text, money } = require('../../_kit');
const ED = require('../data/google-editor.json');
const C = require('./claims');

const L = ED.limits;
const COL = ED.columns;
const V = ED.values;

// Searches that look for a job, a course or a do-it-yourself answer, not a booking.
const NEGATIVES = ['jobs', 'job', 'hiring', 'salary', 'career', 'careers', 'training', 'course', 'class', 'school', 'certification', 'diy', 'supplies', 'equipment', 'franchise', 'license'];

const clean = (s) => text.oneLine(String(s || '').toLowerCase().replace(/[^a-z0-9&' ]+/g, ' '));
const okKeyword = (k) => k && k.length <= L.keywordMaxChars && k.split(/\s+/).length <= L.keywordMaxWords;

// Keyword themes from the member's service, city and own words.
function keywordGroups(f, { extra = [] } = {}) {
  const s = clean(f.service).replace(/^(a|an|the) /, '');
  const city = clean(f.city);
  const area = clean(f.where && f.where !== f.city ? f.where : '');
  const core = [];
  const push = (list, k, types) => {
    const kw = clean(k);
    if (okKeyword(kw) && !list.some((x) => x.text === kw)) list.push({ text: kw, types });
  };
  push(core, s, ['Phrase']);
  if (city) {
    push(core, `${s} ${city}`, ['Phrase', 'Exact']);
    push(core, `${city} ${s}`, ['Phrase']);
  }
  if (area) push(core, `${s} ${area}`, ['Phrase']);
  push(core, `${s} near me`, ['Phrase', 'Exact']);
  if (f.mobile && !/\bmobile\b/.test(s)) push(core, `mobile ${s}`, ['Phrase']);
  const price = [];
  for (const w of ['price', 'prices', 'cost', 'quote']) push(price, `${s} ${w}`, ['Phrase']);
  if (city) push(price, `${s} prices ${city}`, ['Phrase']);
  const own = [];
  for (const k of extra) push(own, k.replace(/^["[]|["\]]$/g, ''), ['Phrase']);
  const groups = [
    { name: text.titleCase(s), key: 'core', angle: 'local', keywords: core },
    { name: `${text.titleCase(s)} Prices`, key: 'price', angle: f.price != null ? 'price' : 'included', keywords: price },
  ];
  if (own.length) groups.push({ name: 'Your Keywords', key: 'own', angle: 'time', keywords: own.slice(0, 20) });
  return groups;
}

// The starting Max CPC: 10% of the max cost per lead (if about 1 in 10 clicks becomes a lead), kept
// between $0.50 and $20. A starting point to change after the first week, never a forecast.
function startingCpc(maxCpl) {
  if (!(maxCpl > 0)) return { value: 2, how: 'A starting guess of $2.00, because we don\'t have your max cost per lead yet. Run "Are ads worth it yet?" to get it.' };
  const v = Math.min(20, Math.max(0.5, money.round(maxCpl * 0.1, 2)));
  return { value: v, how: `${money.usd(v, { cents: true })} is 10% of your max cost per lead (${money.usd(maxCpl, { cents: true })}): what you can pay per click if about 1 in 10 clicks becomes a lead. Check your cost per lead after a week and change it.` };
}

// The ads speak as the business ("we"), like the headlines, even where an angle's hook says "I".
function weVoice(s) {
  return String(s || '')
    .replace(/\bI'm\b/g, "we're")
    .replace(/\bI'll\b/g, "we'll")
    .replace(/\bI\b/g, 'we')
    .replace(/\bmy\b/g, 'our')
    .replace(/(^|[.!?]\s+)(we|our)\b/g, (m, a, w) => `${a}${w.charAt(0).toUpperCase()}${w.slice(1)}`);
}

// One responsive search ad for an ad group: headlines that repeat the group's own keywords first
// (searchers see their words), then the kit's checked Google lines, anything flagged by claims.js
// dropped. Google needs at least 3 headlines and 2 descriptions.
function rsa(google, { lead = [] } = {}) {
  const seen = new Set();
  const headlines = [...lead, ...google.headlines]
    .map((h) => text.oneLine(h))
    .filter((h) => {
      const k = h.toLowerCase();
      if (!h || h.length > L.headlineMax || seen.has(k) || !C.ok(h)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, L.headlines);
  const descriptions = google.descriptions.map(weVoice).filter((d) => d && d.length <= L.descriptionMax && C.ok(d)).slice(0, L.descriptions);
  if (headlines.length < 3 || descriptions.length < 2) throw new Error('Not enough ad lines passed the checks to make a Google ad.');
  return { headlines, descriptions, path1: String(google.path1 || '').slice(0, L.pathMax), path2: String(google.path2 || '').slice(0, L.pathMax) };
}

const HEADERS = [
  COL.campaign, COL.campaignType, COL.campaignStatus, COL.budget, COL.bidStrategyType, COL.networks, COL.languages,
  COL.adGroup, COL.adGroupStatus, COL.maxCpc, COL.keyword, COL.type, COL.status,
  ...Array.from({ length: L.headlines }, (_, i) => COL.headline.replace('{n}', i + 1)),
  ...Array.from({ length: L.descriptions }, (_, i) => COL.description.replace('{n}', i + 1)),
  COL.path1, COL.path2, COL.finalUrl,
];

// The rows: campaign, ad groups, keywords, campaign negatives, ads.
function rows({ campaign, daily, groups, cpc, negatives = NEGATIVES }) {
  const out = [];
  out.push({ [COL.campaign]: campaign, [COL.campaignType]: V.campaignType, [COL.campaignStatus]: 'Paused', [COL.budget]: daily.toFixed(2), [COL.bidStrategyType]: V.bidStrategyType, [COL.networks]: V.networks, [COL.languages]: V.languages });
  for (const g of groups) out.push({ [COL.campaign]: campaign, [COL.adGroup]: g.name, [COL.adGroupStatus]: 'Enabled', [COL.maxCpc]: cpc.toFixed(2) });
  for (const g of groups) for (const k of g.keywords) for (const t of k.types) out.push({ [COL.campaign]: campaign, [COL.adGroup]: g.name, [COL.keyword]: k.text, [COL.type]: t, [COL.status]: 'Enabled' });
  for (const n of negatives) out.push({ [COL.campaign]: campaign, [COL.keyword]: n, [COL.type]: V.campaignNegative });
  for (const g of groups) {
    const row = { [COL.campaign]: campaign, [COL.adGroup]: g.name, [COL.status]: 'Enabled', [COL.path1]: g.ad.path1, [COL.path2]: g.ad.path2, [COL.finalUrl]: g.url };
    g.ad.headlines.forEach((h, i) => (row[COL.headline.replace('{n}', i + 1)] = h));
    g.ad.descriptions.forEach((d, i) => (row[COL.description.replace('{n}', i + 1)] = d));
    out.push(row);
  }
  return out;
}

// RFC 4180 CSV with the header row, UTF-8, no BOM.
function toCsv(list) {
  const q = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${[HEADERS.map(q).join(','), ...list.map((r) => HEADERS.map((h) => q(r[h])).join(','))].join('\r\n')}\r\n`;
}

// Problems Editor would refuse or Google would cut: [{ where, text, why }].
function validate(list) {
  const out = [];
  for (const r of list) {
    for (const [k, v] of Object.entries(r)) {
      if (!HEADERS.includes(k)) out.push({ where: k, text: String(v), why: 'Not a Google Ads Editor column' });
      if (/^Headline \d+$/.test(k) && String(v).length > L.headlineMax) out.push({ where: k, text: v, why: `Over ${L.headlineMax} characters` });
      if (/^Description \d+$/.test(k) && String(v).length > L.descriptionMax) out.push({ where: k, text: v, why: `Over ${L.descriptionMax} characters` });
      if (/^Path \d$/.test(k) && String(v).length > L.pathMax) out.push({ where: k, text: v, why: `Over ${L.pathMax} characters` });
      if (k === COL.keyword && !okKeyword(String(v))) out.push({ where: k, text: v, why: `Keywords take up to ${L.keywordMaxChars} characters and ${L.keywordMaxWords} words` });
      if (k === COL.finalUrl && !/^https:\/\//.test(String(v))) out.push({ where: k, text: v, why: 'Final URL must start with https://' });
      if (k === COL.budget && !(Number(v) > 0)) out.push({ where: k, text: v, why: V.budgetRule });
    }
  }
  return out;
}

// Headlines that lead an ad group: its keywords in title case, and for the price group, the price.
function leadFor(g, f) {
  const out = [];
  if (g.key === 'price') {
    out.push(`${text.titleCase(clean(f.service))} Prices`);
    if (f.price != null) out.push(`${text.titleCase(clean(f.service))} From ${money.usd(f.price)}`, `Clear Price: ${money.usd(f.price)}`);
  }
  for (const k of g.keywords) out.push(text.titleCase(k.text).replace(/\bNear Me\b/, 'Near You'));
  return out;
}

module.exports = { HEADERS, NEGATIVES, keywordGroups, startingCpc, rsa, leadFor, weVoice, rows, toCsv, validate, ED };
