// "Price your offer": the lowest price that covers supplies, card fees and the member's time (the
// floor), then three options people choose between (the premium one shown first, so the middle one
// feels easy), founding prices for the first customers (a real, counted limit), and the words to say
// the price. Unit math only: per job, per visit, per hour of the member's time. Never income.

const { text, money } = require('../../_kit');
const { cap } = require('./facts');
const ladder = require('./ladder');
const { Sheet } = require('./sheet');

function stepOf(v) {
  if (v < 20) return 1;
  if (v < 200) return 5;
  if (v < 1000) return 25;
  if (v < 5000) return 50;
  return 100;
}

// Round up to a price people are used to seeing, never below n.
function niceUp(n) {
  if (!(n > 0)) return 0;
  const s = stepOf(n);
  return Math.ceil(n / s - 1e-9) * s;
}

function parsePrices(s) {
  const nums = String(s || '')
    .split(/[,;\n/]+|\s{2,}/)
    .map((x) => money.num(x, null))
    .filter((n) => n != null && n > 0 && n < 1e6);
  return nums.slice(0, 20);
}

function median(a) {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y);
  const m = Math.floor(b.length / 2);
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
}

function floorOf(f, fee, perHour) {
  const need = (f.cost || 0) + (f.hours || 0) * perHour;
  return need > 0 ? (need + fee.fixed) / (1 - fee.rate) : null;
}

function tierMath(price, f, fee, { costF = 1, timeF = 1 } = {}) {
  const supplies = money.round((f.cost || 0) * costF, 2);
  const cardFee = money.round(price > 0 ? price * fee.rate + fee.fixed : 0, 2);
  const kept = money.round(price - supplies - cardFee, 2);
  const hours = money.round((f.hours || 0) * timeF, 2);
  return { supplies, cardFee, kept, hours, keptPerHour: hours > 0 ? money.round(kept / hours, 2) : null, costF, timeF };
}

// The smallest true number for a price (only when there's a real period to divide by).
function smallNumber(price, f) {
  if (f.unit === 'month') return `${money.usd(price)} a month is about ${money.usd(Math.round(price / 30))} a day.`;
  return '';
}

function build(f, { payWith, perHour, competitors, parts = [] } = {}) {
  const p = f.profile;
  const fee = ladder.feeFor(payWith, f.arch);
  const rate = perHour || f.perHour || 20;
  const market = parsePrices(competitors);
  const mk = market.length ? { low: Math.min(...market), mid: median(market), high: Math.max(...market), n: market.length, prices: market } : null;
  const floor = floorOf(f, fee, rate);
  const floorNice = floor ? niceUp(floor) : null;
  let better = f.price || null;
  let basis = 'your price';
  if (!better && mk) {
    better = Math.max(floorNice ? niceUp(floorNice * 1.3) : 0, money.nicePrice(mk.mid));
    basis = 'the middle of the prices you found, and above your floor';
  } else if (!better && floorNice) {
    better = niceUp(floorNice * 1.4);
    basis = 'your floor plus room for the extras that make it worth more';
  }
  if (!better) throw new Error('Add your price idea, or what one job costs you in supplies and hours, and run it again.');
  const warnings = [];
  if (floorNice && better < floorNice) warnings.push(`Your price (${money.usd(better)}) is below your floor (${money.usd(floorNice)}). Every job would cost you money once your time counts. Raise it, or cut the hours per job.`);
  const up = p.upsell || {};
  const down = p.downsell || {};
  const cont = p.continuity || {};
  let good = money.nicePrice(better * (down.price && down.price < 1 ? down.price : 0.65));
  if (floorNice && good < floorNice) good = floorNice;
  if (good >= better) good = money.nicePrice(better * 0.8);
  const upPrice = up.price != null && up.price > 0 && up.price < 1.5 ? up.price : 0.4;
  const best = money.nicePrice(Math.max(better * 2, better * (1 + upPrice) * 1.4));
  const name = (parts[0] && parts[0].offerName) || `The ${(p.goal && p.goal[0]) || 'Full'} ${(p.containers && p.containers[0]) || text.titleCase(f.unit)}`;
  const top = parts.slice(0, 3).map((x) => x.part || x.name).filter(Boolean);
  const tiers = [
    {
      key: 'best',
      name: `${name} Plus`,
      badge: 'Everything',
      price: best,
      includes: [`Everything in ${name}`, cap(text.plain(String(up.title || 'The add-on').replace(/\{unit\}/g, f.unit))), 'First pick of times', f.arch === 'product' || f.arch === 'digital' || f.arch === 'food' ? 'Gift-ready packing' : 'A free check-in within 30 days'],
      ...tierMath(best, f, fee, { costF: 1 + (up.cost || 0.4), timeF: 1 + (up.time || 0.4) + 0.1 }),
    },
    {
      key: 'better',
      name,
      badge: 'Best place to start',
      price: better,
      includes: [cap(f.what), ...top, p.promise.type === 'refund' ? 'Full refund promise' : 'My promise, in writing'],
      ...tierMath(better, f, fee),
    },
    {
      key: 'good',
      name: cap(text.plain(String(down.title || 'Basic').replace(/\{unit\}/g, f.unit))),
      badge: 'The basics',
      price: good,
      includes: [cap(text.plain(String(down.what || 'The main job only').replace(/\{unit\}/g, f.unit))), 'My promise, in writing'],
      ...tierMath(good, f, fee, { costF: down.cost || 0.65, timeF: down.time || 0.65 }),
    },
  ];
  for (const t of tiers) t.per = f.unit === 'month' ? 'a month' : `per ${f.unit}`;
  // First customers: a counted limit the member keeps. Services: few spots; products: more orders.
  const many = ['product', 'digital', 'food'].includes(f.arch);
  const fCount = many ? 10 : f.arch === 'b2b_service' ? 2 : 3;
  const iCount = many ? 20 : 5;
  const ask = many ? 'a photo of it in use you can share, if they\'re happy to' : f.arch === 'b2b_service' ? 'permission to show the work as a sample, and honest feedback' : 'before and after photos you can show, and honest feedback';
  const founding = Math.max(floorNice || 0, money.nicePrice(better * (f.arch === 'b2b_service' ? 0.6 : 0.7)));
  const intro = Math.max(founding, money.nicePrice(better * 0.85));
  const ladderRows = [
    { who: `First ${fCount} ${fCount === 1 ? f.customer : f.customers}`, price: founding, ask: `In return: ${ask}.`, ...tierMath(founding, f, fee) },
    { who: `Next ${iCount}`, price: intro, ask: 'Intro price. Say it\'s going up after these.', ...tierMath(intro, f, fee) },
    { who: 'Everyone after', price: better, ask: 'Full price. Raise it when you\'re booked out two weeks ahead.', ...tierMath(better, f, fee) },
  ];
  const promiseShort = require('./library').promiseShort(p.promise);
  const scripts = [
    { label: 'Saying the price', text: `It's ${money.usd(better)} ${tiers[1].per}. ${promiseShort} Want me to save you a spot?` },
    { label: 'Showing the options', text: `There are three ways to do it. ${tiers[0].name} is ${money.usd(best)}, with everything. ${name} is ${money.usd(better)}, and it's where I'd start. Or ${tiers[2].name.toLowerCase()} for ${money.usd(good)}. Which fits?` },
    { label: 'If it\'s more than they want to spend', text: `No problem. I can do ${tiers[2].name.toLowerCase()} for ${money.usd(good)}. You'd still get my promise.` },
    { label: 'If someone else is cheaper', text: `They might be a good fit for you. With me you get ${top.length ? text.list(top.slice(0, 2).map((x) => x.toLowerCase())) : 'the whole job done right'}. And ${p.promise.text.charAt(0).toLowerCase()}${p.promise.text.slice(1)}` },
  ];
  const small = smallNumber(better, f);
  if (small) scripts.push({ label: 'The smallest true number', text: small });
  return { fee, perHour: rate, perHourAssumed: !(perHour || f.perHour), floor: floor ? money.round(floor, 2) : null, floorNice, market: mk, better, basis, tiers, ladder: ladderRows, scripts: scripts.map((x) => ({ ...x, text: text.plain(x.text) })), warnings };
}

// The calculator: change the settings and every price's math updates.
function csv(pr, f) {
  const sh = new Sheet();
  sh.add(['Setting', 'Value', 'What it means']);
  sh.add(['Supplies per job', f.cost || 0, 'What one job costs you in supplies, gas and materials'], 'cost');
  sh.add(['Hours per job', f.hours || 0, 'Including travel and setup'], 'hours');
  sh.add(['Your time, per hour', pr.perHour, pr.perHourAssumed ? 'A starting number. Change it to what your time is worth to you' : 'What your time is worth to you'], 'rate');
  sh.add(['Card fee percent', pr.fee.rate, `${pr.fee.label} (checked Oct 19, 2026; check your own plan)`], 'feeRate');
  sh.add(['Card fee per payment', pr.fee.fixed, ''], 'feeFixed');
  sh.add((r) => ['Your floor price', `=ROUND((${sh.ref('cost')}+${sh.ref('hours')}*${sh.ref('rate')}+${sh.ref('feeFixed')})/(1-${sh.ref('feeRate')}),2)`, 'Never charge less than this'], 'floor');
  sh.blank();
  sh.add(['Option', 'Price', 'Supplies', 'Hours', 'Card fee', 'Kept per job', 'Kept per hour', 'Left after paying your time', 'Supplies x', 'Hours x']);
  const row = (label, price, m) =>
    sh.add((r) => [
      label,
      price,
      `=ROUND(${sh.ref('cost')}*I${r},2)`,
      `=ROUND(${sh.ref('hours')}*J${r},2)`,
      `=IF(B${r}>0,ROUND(B${r}*${sh.ref('feeRate')}+${sh.ref('feeFixed')},2),0)`,
      `=ROUND(B${r}-C${r}-E${r},2)`,
      `=IF(D${r}>0,ROUND(F${r}/D${r},2),"")`,
      `=ROUND(F${r}-D${r}*${sh.ref('rate')},2)`,
      m.costF,
      m.timeF,
    ]);
  for (const t of pr.tiers) row(t.name, t.price, t);
  sh.blank();
  sh.add(['First customers', 'Price', 'Supplies', 'Hours', 'Card fee', 'Kept per job', 'Kept per hour', 'Left after paying your time', 'Supplies x', 'Hours x']);
  for (const l of pr.ladder) row(l.who, l.price, l);
  if (pr.market) {
    sh.blank();
    sh.add(['Prices you found', 'Price']);
    const first = sh.rows.length + 1;
    const list = pr.market.prices && pr.market.prices.length ? pr.market.prices : [pr.market.low, pr.market.mid, pr.market.high];
    list.forEach((n, i) => sh.add([`Price ${i + 1}`, n]));
    const last = sh.rows.length;
    sh.add(['Lowest', `=MIN(B${first}:B${last})`]);
    sh.add(['Middle', `=MEDIAN(B${first}:B${last})`]);
    sh.add(['Highest', `=MAX(B${first}:B${last})`]);
  }
  return sh.csv();
}

module.exports = { build, csv, niceUp, floorOf, parsePrices, median, tierMath, smallNumber };
