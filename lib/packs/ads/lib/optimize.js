// The daily ad check (Legal D9): reads a results export from Meta, Google or TikTok (one row per ad
// per day works best) and suggests what to stop, keep, raise, move or refresh, each with the rule, the
// numbers behind it and what it does to spend, against the member's own max cost per customer from
// their price and costs. Suggestions only: nothing is applied, there are no automatic rules and no
// "do them all", and no suggestion touches the audience (D2, D7). Totals only, one member's numbers,
// never compared with anyone else's (D10).

const { money, text } = require('../../_kit');
const A = require('./ads');
const T = require('./targeting');
const OPT = require('../data/optimizer.json');
const LINES = require('../data/screen-lines.json');

const R = OPT.rules;
const H = {
  day: /^(day|date|by day|reporting starts|date \(by day\)|stat time day)$/i,
  campaign: /^(campaign name|campaign)$/i,
  adset: /^(ad set name|ad group name|ad group|adgroup name)$/i,
  ad: /^(ad name|ad)$/i,
  spend: /^(amount spent( \(\w+\))?|spend|cost|total cost)$/i,
  impressions: /^(impressions|impr\.?)$/i,
  reach: /^reach$/i,
  frequency: /^frequency$/i,
  clicks: /^(link clicks|clicks \(destination\)|clicks|clicks \(all\))$/i,
  results: /^(results|conversions|leads|purchases|website purchases|messaging conversations started|complete payment)$/i,
  revenue: /^(purchases conversion value|purchase conversion value|conv\. value|conversion value|total complete payment value|revenue)$/i,
};

// Which network an export is from, by its header row.
function networkOf(head, title = '') {
  const h = head.map((x) => x.toLowerCase());
  if (h.some((x) => /amount spent/.test(x)) || h.includes('ad set name')) return 'Meta';
  if (h.includes('impr.') || h.includes('conv. value') || /google/i.test(title)) return 'Google';
  if (h.some((x) => /clicks \(destination\)|ad group name|total complete payment|stat time/.test(x))) return 'TikTok';
  return 'Ads';
}

const ISO = (s) => {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const d = Date.parse(t);
  return Number.isNaN(d) ? '' : new Date(d).toISOString().slice(0, 10);
};

// Rows from one export: [{ network, day, campaign, adset, ad, spend, impressions, reach, frequency, clicks, results, revenue }].
// Google's title lines above the header and its "Total" rows are skipped. No people's details are read.
function readExport(csvText) {
  const all = A.parseCsv(csvText);
  const at = all.findIndex((r) => r.filter((c) => Object.values(H).some((re) => re.test(String(c).trim()))).length >= 3);
  if (at < 0) return { network: 'Ads', rows: [] };
  const head = all[at].map((c) => String(c).trim());
  const network = networkOf(head, all.slice(0, at).flat().join(' '));
  const idx = {};
  for (const [k, re] of Object.entries(H)) {
    const pref = k === 'clicks' ? head.findIndex((h) => /^(link clicks|clicks \(destination\))$/i.test(h)) : -1;
    idx[k] = pref >= 0 ? pref : head.findIndex((h) => re.test(h));
  }
  const num = (r, k) => (idx[k] >= 0 ? money.num(String(r[idx[k]] || '').replace(/[$,%\s]/g, ''), 0) : 0);
  const str = (r, k) => (idx[k] >= 0 ? text.clip(text.oneLine(r[idx[k]] || ''), 60) : '');
  const rows = [];
  for (const r of all.slice(at + 1)) {
    if (r.some((c) => /^total\b/i.test(String(c).trim()))) continue;
    const row = { network, day: ISO(str(r, 'day')), campaign: str(r, 'campaign'), adset: str(r, 'adset'), ad: str(r, 'ad'), spend: num(r, 'spend'), impressions: num(r, 'impressions'), reach: num(r, 'reach'), frequency: num(r, 'frequency'), clicks: num(r, 'clicks'), results: num(r, 'results'), revenue: num(r, 'revenue') };
    if (!row.spend && !row.impressions) continue;
    if (!row.frequency && row.reach) row.frequency = money.round(row.impressions / row.reach, 2);
    rows.push(row);
  }
  return { network, rows };
}

// One line per ad (or ad group or campaign, whatever the export goes down to), days in order.
function group(rows) {
  const by = new Map();
  for (const r of rows) {
    const name = r.ad || r.adset || r.campaign || 'All ads';
    const key = `${r.network}|${r.campaign}|${name}`;
    if (!by.has(key)) by.set(key, { network: r.network, campaign: r.campaign || name, name, days: [] });
    by.get(key).days.push(r);
  }
  for (const g of by.values()) {
    const days = new Map();
    for (const d of g.days) {
      const k = d.day || `row${days.size}`;
      const x = days.get(k) || { day: d.day, spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0, revenue: 0, frequency: 0 };
      for (const f of ['spend', 'impressions', 'reach', 'clicks', 'results', 'revenue']) x[f] += d[f];
      x.frequency = Math.max(x.frequency, d.frequency || 0);
      days.set(k, x);
    }
    g.days = [...days.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  }
  return [...by.values()];
}

const sum = (xs, k) => xs.reduce((s, x) => s + (x[k] || 0), 0);
const ctrOf = (xs) => (sum(xs, 'impressions') ? (sum(xs, 'clicks') / sum(xs, 'impressions')) * 100 : 0);
const freqOf = (xs) => {
  const f = xs.filter((x) => x.frequency > 0);
  return f.length ? f.reduce((s, x) => s + x.frequency, 0) / f.length : 0;
};

// Totals and what each customer costs, against the member's numbers. resultIs: 'lead' or 'sale'.
function measure(g, n, resultIs = 'lead') {
  const spend = money.round(sum(g.days, 'spend'));
  const results = sum(g.days, 'results');
  const impressions = sum(g.days, 'impressions');
  const clicks = sum(g.days, 'clicks');
  const dated = g.days.filter((d) => d.day);
  const recent = dated.slice(-3);
  const daily = recent.length ? money.round(sum(recent, 'spend') / recent.length) : money.round(spend / Math.max(1, g.days.length));
  const cpr = results ? money.round(spend / results) : null;
  const close = n && n.closeRate ? n.closeRate / 100 : 0.25;
  const cpc = cpr == null ? null : money.round(resultIs === 'sale' ? cpr : cpr / close);
  const w = R.fatigue.window;
  const first = dated.slice(0, w);
  const last = dated.slice(-w);
  return { spend, results, impressions, clicks, days: dated.length || g.days.length, daily, cpr, cpc, ctr: money.round(ctrOf(g.days), 2), frequency: money.round(freqOf(g.days), 2), firstCtr: money.round(ctrOf(first), 2), lastCtr: money.round(ctrOf(last), 2), firstFreq: money.round(freqOf(first), 2), lastFreq: money.round(freqOf(last), 2) };
}

// The suggestions: [{ kind, change, network, campaign, ad, effect, why, rule, card, numbers }].
function suggest(groups, n, { resultIs = 'lead' } = {}) {
  const have = n && n.price && n.maxCpl > 0;
  const maxCpl = have ? n.maxCpl : null;
  const target = have ? n.target : null;
  const breakEven = have ? n.breakEven : null;
  const list = [];
  const usd = (v) => money.usd(v);
  const add = (g, m, kind, change, effect, why, rule) => list.push({ kind, change, network: g.network, campaign: g.campaign, ad: g.name, effect, why, rule, numbers: m });
  for (const g of groups) {
    const m = measure(g, n, resultIs);
    const base = `${usd(m.spend)} spent over ${text.plural(m.days, 'day')}, ${text.plural(m.results, resultIs === 'sale' ? 'sale' : 'result')}`;
    const per = m.cpc != null ? `, about ${usd(m.cpc)} per customer` : '';
    // Fatigue first: it's about the creative, whatever the cost.
    const F = R.fatigue;
    const tired = m.days >= F.minDays && m.firstFreq > 0 && m.lastFreq >= F.minFrequency && m.lastFreq >= m.firstFreq * F.freqUp && m.firstCtr > 0 && m.lastCtr <= m.firstCtr * F.ctrDown;
    if (tired) add(g, m, 'refresh', 'Make a new creative for this angle', 'No change to spend: same budget, a new ad', `frequency went from ${m.firstFreq} to ${m.lastFreq} and the click rate from ${m.firstCtr}% to ${m.lastCtr}% (first ${F.window} days against the last ${F.window})`, F.why);
    if (m.impressions < R.early.minImpressions && (!maxCpl || m.spend < maxCpl)) {
      add(g, m, 'keep', 'Keep it running, too early to judge', 'No change to spend', `${base}, ${m.impressions.toLocaleString('en-US')} views`, R.early.why);
      continue;
    }
    if (!have) {
      add(g, m, 'keep', 'Keep it running until your price is in', 'No change to spend', `${base}${m.cpr != null ? `, ${usd(m.cpr)} per result` : ''}`, 'Add your price and costs so each ad can be checked against the most you can pay for a customer.');
      continue;
    }
    if (!m.results && m.spend >= R.stopNoResults.spendTimesMaxCpl * maxCpl) {
      add(g, m, 'stop', 'Turn it off', `Saves about ${usd(m.daily)} a day`, `${base}, against a max of ${usd(maxCpl)} per lead`, R.stopNoResults.why);
    } else if (m.cpc != null && m.cpc > breakEven && m.spend >= R.stopTooDear.spendTimesMaxCpl * maxCpl) {
      add(g, m, 'stop', 'Turn it off', `Saves about ${usd(m.daily)} a day`, `${base}${per}, more than the ${usd(breakEven)} you can pay for a customer and break even`, R.stopTooDear.why);
    } else if (m.cpc != null && m.cpc <= target * R.scale.underTarget && m.results >= R.scale.minResults && m.days >= R.scale.minDays && (!m.frequency || m.frequency < R.scale.maxFrequency)) {
      const more = Math.max(1, money.round(m.daily * R.scale.raise));
      add(g, m, 'scale', `Raise its daily budget about ${Math.round(R.scale.raise * 100)}%`, `Up to ${usd(more)} more a day (from about ${usd(m.daily)} to ${usd(m.daily + more)})`, `${base}${per}, under your target of ${usd(target)}`, `${R.scale.why} Raise it again only after 3 more days under target.`);
    } else if (m.cpc != null && m.cpc <= target) {
      add(g, m, 'keep', 'Keep it as it is', 'No change to spend', `${base}${per}, at or under your target of ${usd(target)}`, R.keep.why);
    } else if (m.cpc != null) {
      const over = m.cpc > breakEven;
      add(g, m, 'watch', 'Keep it, and test a new first line or page', 'No change to spend', `${base}${per}, over your target of ${usd(target)}${over ? ` and over break-even (${usd(breakEven)}); it gets until ${usd(R.stopTooDear.spendTimesMaxCpl * maxCpl)} spent before the stop rule` : ` but under break-even (${usd(breakEven)})`}`, R.watch.why);
    } else {
      add(g, m, 'keep', 'Keep it running', 'No change to spend', `${base}, ${usd(m.spend)} of the ${usd(R.stopNoResults.spendTimesMaxCpl * maxCpl)} it gets before the stop rule`, R.early.why);
    }
  }
  // Budget shift: a stopped ad's daily spend goes to the cheapest ad under target on the same network.
  for (const s of list.filter((x) => x.kind === 'stop')) {
    const to = list.filter((x) => x.kind === 'scale' && x.network === s.network).sort((a, b) => a.numbers.cpc - b.numbers.cpc)[0];
    if (!to) continue;
    list.push({ kind: 'shift', change: `Move ${money.usd(s.numbers.daily)} a day from "${s.ad}" to "${to.ad}"`, network: s.network, campaign: to.campaign, ad: to.ad, effect: 'No change to total spend: the same money moves to the cheaper ad', why: `"${s.ad}" is being turned off; "${to.ad}" costs about ${money.usd(to.numbers.cpc)} per customer, under your target of ${money.usd(target)}`, rule: R.shift.why, numbers: to.numbers });
  }
  // D2, D7: a suggestion never narrows the audience. Belt and braces: drop any that would.
  const order = { stop: 0, shift: 1, scale: 2, refresh: 3, watch: 4, keep: 5 };
  return list.filter((s) => !T.narrows(`${s.change} ${s.why} ${s.rule}`)).sort((a, b) => order[a.kind] - order[b.kind]).map((s) => ({ ...s, card: cardOf(s) }));
}

// The card line in Legal's pattern (part 5), with the files-only ending: the member makes the change.
function cardOf(s) {
  const line = OPT.line.replace('{change}', s.change).replace('{campaign}', s.campaign === s.ad ? s.ad : `${s.campaign}, ${s.ad}`).replace('{effect}', s.effect).replace('{why}', s.why);
  return `${line} ${OPT.doneLine.replace('{network}', s.network === 'Ads' ? 'your ad account' : s.network)}`;
}

// What a run keeps for the next one (pack memory, 4 KB a key): each ad's day rows, numbers only,
// trimmed to the last days that fit. Names are campaign and ad names, never people.
function compact(rows, max = 3800) {
  let keep = rows.map((r) => [r.network.charAt(0), r.day, r.campaign, r.ad || r.adset, r.spend, r.impressions, r.clicks, r.results, r.frequency]);
  const days = [...new Set(keep.map((r) => r[1]))].sort();
  while (JSON.stringify(keep).length > max && days.length > 1) {
    const oldest = days.shift();
    keep = keep.filter((r) => r[1] !== oldest);
  }
  while (JSON.stringify(keep).length > max && keep.length) keep = keep.slice(1);
  return keep;
}

function expand(saved) {
  const N = { M: 'Meta', G: 'Google', T: 'TikTok', A: 'Ads' };
  return (Array.isArray(saved) ? saved : []).filter(Array.isArray).map((r) => ({ network: N[r[0]] || 'Ads', day: r[1] || '', campaign: r[2] || '', adset: '', ad: r[3] || '', spend: +r[4] || 0, impressions: +r[5] || 0, reach: 0, clicks: +r[6] || 0, results: +r[7] || 0, revenue: 0, frequency: +r[8] || 0 }));
}

module.exports = { OPT, LINES, readExport, group, measure, suggest, cardOf, compact, expand, networkOf };
