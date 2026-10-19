// The card every business-type pack shows first (playbook 2.5, step 1: is this a starving crowd?).
// Our 1-to-5 scores for pain, can pay, easy to find and growing, how fast a first $1 usually comes,
// the best months, the slow season and 3 things not to do yet. The scores are our judgment until
// real member data re-scores them, and the card says so. Owner: library thread.
//
// packs/<id>/data/niche.json carries it as `crowd`:
// {
//   "buyer": "Homeowners",
//   "scores": { "pain": 3, "can_pay": 4, "findable": 4, "growing": 3 },
//   "first_dollar": "Fast in season",                 Fast | Medium | Slow | Fast in season
//   "best_months": [4, 5, 6, 7, 8, 9, 10],            1 = January
//   "off_season": { "months": [11, 12, 1, 2, 3], "where": "cold",   "cold": only where winters are cold
//                   "play": "Sell snow removal and book spring cleanups now at this year's price." },
//   "not_yet": ["Don't buy a trailer before your tenth customer.", "...", "..."],
//   "note": "Recurring. Same-street routes are where the time goes."
// }

const { plain } = require('./text');
const views = require('./views');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SCORES = [
  ['pain', 'Pain', 'How much the buyer hurts without it'],
  ['can_pay', 'Can pay', 'Whether the buyer has money for it'],
  ['findable', 'Easy to find', 'Whether you can list buyers by name'],
  ['growing', 'Growing', 'Whether demand is rising'],
];

// [4,5,6,7,8,9,10] -> "April to October"; [11,12,1,2] -> "November to February"; [3,4,9,10] -> "March to April and September to October"
function monthRange(months) {
  const set = [...new Set((months || []).map(Number).filter((m) => m >= 1 && m <= 12))];
  if (!set.length) return '';
  if (set.length === 12) return 'All year';
  // Walk the circle from a month whose previous month isn't in the set, so runs wrap past December.
  const has = (m) => set.includes(((m - 1 + 12) % 12) + 1);
  const starts = set.filter((m) => !has(m - 1)).sort((a, b) => a - b);
  const runs = starts.map((s) => {
    let e = s;
    while (has(e + 1) && ((e % 12) + 1) !== s) e = (e % 12) + 1;
    return s === e ? MONTHS[s - 1] : `${MONTHS[s - 1]} to ${MONTHS[e - 1]}`;
  });
  return runs.join(' and ');
}

// Whether `month` (1-12) is the slow season where the member lives. `lat` from a geocode when we
// have one; latitude 37 and up (roughly Virginia, Kansas, Colorado and north) counts as cold winters.
// Unknown latitude in a slow month: "maybe", and the note says "in colder cities".
function season(crowd, { month, lat } = {}) {
  const m = Number(month) || new Date().getMonth() + 1;
  const best = (crowd && crowd.best_months) || [];
  const off = crowd && crowd.off_season;
  let slow = false;
  let sure = true;
  if (off && Array.isArray(off.months) && off.months.includes(m)) {
    if (off.where === 'cold') {
      if (lat == null || !Number.isFinite(Number(lat))) {
        slow = true;
        sure = false;
      } else slow = Math.abs(Number(lat)) >= 37;
    } else slow = true;
  }
  const where = off && off.where === 'cold' ? (sure ? 'where you are' : 'in colder cities') : 'for most people';
  let note = null;
  if (slow) {
    note = `${MONTHS[m - 1]} is the slow season ${where}${off.months.length ? ` (${monthRange(off.months)})` : ''}.`;
    if (off.play) note += ` ${off.play}`;
  } else if (best.length && best.includes(m)) note = `${MONTHS[m - 1]} is a good month for this.`;
  return { month: m, slow, sure, best: monthRange(best), note: note && plain(note) };
}

// "Pain 4 of 5. Can pay 3 of 5. Easy to find 5 of 5. Growing 4 of 5. First $1: fast."
function scoreLine(crowd) {
  const s = (crowd && crowd.scores) || {};
  const parts = SCORES.filter(([k]) => s[k] != null).map(([k, label]) => `${label} ${s[k]} of 5`);
  if (crowd && crowd.first_dollar) parts.push(`First $1: ${String(crowd.first_dollar).toLowerCase()}`);
  return parts.join('. ') + (parts.length ? '.' : '');
}

// Output block for a tool: everything the card needs, plain and ready for view().
function card(crowd, { month, lat, title } = {}) {
  const c = crowd || {};
  const sea = season(c, { month, lat });
  return {
    title: plain(title || 'Is this a starving crowd?'),
    buyer: c.buyer ? plain(c.buyer) : null,
    scores: SCORES.filter(([k]) => (c.scores || {})[k] != null).map(([k, label, means]) => ({ key: k, label, score: Number(c.scores[k]), means })),
    first_dollar: c.first_dollar || null,
    line: scoreLine(c),
    best_months: sea.best || null,
    season: sea.note,
    slow_now: sea.slow,
    not_yet: (c.not_yet || []).slice(0, 3).map(plain),
    note: c.note ? plain(c.note) : null,
    basis: 'Our scores from 1 to 5, before real member data. We re-score as results come in.',
  };
}

// View blocks for the card (use inside a tool's view()).
function blocks(cardOut) {
  if (!cardOut) return [];
  const k = cardOut;
  return views.blocks(
    views.text(`${k.title}${k.buyer ? ` Buyer: ${k.buyer}.` : ''} ${k.line}`),
    k.scores.length
      ? views.table(
          [
            { key: 'label', label: 'Score' },
            { key: 'out_of_5', label: 'Of 5' },
            { key: 'means', label: 'What it means' },
          ],
          k.scores.map((s) => ({ label: s.label, out_of_5: s.score, means: s.means })),
        )
      : null,
    k.best_months ? views.text(`Best months: ${k.best_months}.${k.season ? ` ${k.season}` : ''}`) : k.season ? views.text(k.season) : null,
    k.not_yet.length ? views.text(`Not yet: ${k.not_yet.join(' ')}`) : null,
    k.note ? views.text(k.note) : null,
    views.text(k.basis),
  );
}

// Checks a niche.json crowd block; returns a list of problems (empty when fine).
function problems(crowd) {
  const out = [];
  if (!crowd || typeof crowd !== 'object') return ['missing crowd block'];
  for (const [k] of SCORES) {
    const v = (crowd.scores || {})[k];
    if (!Number.isInteger(v) || v < 1 || v > 5) out.push(`scores.${k} must be a whole number 1 to 5`);
  }
  if (!crowd.first_dollar) out.push('first_dollar is missing');
  if (!Array.isArray(crowd.best_months) || !crowd.best_months.length) out.push('best_months is missing');
  if (!Array.isArray(crowd.not_yet) || crowd.not_yet.length !== 3) out.push('not_yet needs exactly 3 lines');
  if (crowd.off_season && !Array.isArray(crowd.off_season.months)) out.push('off_season.months must be a list of months');
  return out;
}

module.exports = { MONTHS, monthRange, season, scoreLine, card, blocks, problems };
