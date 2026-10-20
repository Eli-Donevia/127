// D2 and D7 (Legal row 12): the special category question and the audience check.
//
// D2: every campaign starts with Legal's question, with no answer picked. Politics, elections or social
//     issues stop the desk. Housing, jobs and credit (or another financial product) keep only what each
//     network allows in the US and Canada: no narrow age range, no gender, no ZIP or postal codes, no
//     location exclusions, no radius under the network's minimum (15 miles everywhere, our floor), no
//     lookalikes, and no interest, behavior or demographic targeting the network bars
//     (data/special-categories.json, with sources).
// D7: every audience starts at 18, whatever the category.

const SC = require('../data/special-categories.json');

const NETWORKS = ['meta', 'google', 'tiktok'];
const ANSWERS = SC.answers;

// The answer to the question, or an error when there isn't one: nothing is picked for the member.
function categoryOf(answer) {
  const a = String(answer == null ? '' : answer).trim();
  const c = SC.categories[a];
  if (!c) throw new Error(`Answer this first: ${SC.question} (${ANSWERS.join(', ')}).`);
  return { answer: a, ...c, special: !['none', 'politics'].includes(c.key), stop: !!c.stop };
}

const lines = (s) => String(s || '').split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean);

// One network's audience after D2 and D7. In: what the member asked for. Out: { network, audience,
// removed: [{ what, why, source }], lines: [what the audience is, in plain words] }.
function audienceFor(network, ask = {}, category = { key: 'none', special: false }) {
  const rules = SC.networks[network];
  if (!rules) throw new Error(`Unknown network ${network}.`);
  const removed = [];
  const drop = (what, why, source = rules.source) => removed.push({ what, why, source });
  let ageMin = Math.round(Number(ask.ageMin) || 18);
  let ageMax = Math.round(Number(ask.ageMax) || 65);
  if (ageMax < ageMin) ageMax = 65;
  // D7: adults only, on every audience.
  if (ageMin < 18) {
    drop(`Ages under 18 (${ageMin} to 17)`, 'Every audience starts at 18 (adults only).', null);
    ageMin = 18;
  }
  if (ageMax < 18) ageMax = 65;
  let gender = ['Women', 'Men'].includes(ask.gender) ? ask.gender : 'All';
  let zips = lines(ask.zips).filter((z) => /^[A-Za-z0-9 -]{3,10}$/.test(z)).slice(0, 50);
  let exclusions = lines(ask.exclusions).slice(0, 20);
  let radius = Number(ask.radius) > 0 ? Math.min(50, Math.round(Number(ask.radius))) : 10;
  let interests = lines(ask.interests).slice(0, 20);
  let lookalike = !!ask.lookalike;
  if (category.special) {
    const label = category.label;
    if (ageMin !== rules.ages.min || ageMax !== rules.ages.max) {
      drop(`Ages ${ageMin} to ${ageMax === 65 ? '65+' : ageMax}`, `${rules.ages.why} Ads about ${label}: 18 to 65+.`);
      ageMin = rules.ages.min;
      ageMax = rules.ages.max;
    }
    if (gender !== 'All') {
      drop(`Only ${gender.toLowerCase()}`, rules.gender);
      gender = 'All';
    }
    if (zips.length) {
      drop(`${zips.length} ZIP or postal ${zips.length === 1 ? 'code' : 'codes'}`, rules.zips);
      zips = [];
    }
    if (exclusions.length) {
      drop(`${exclusions.length} excluded ${exclusions.length === 1 ? 'place' : 'places'}`, rules.exclusions);
      exclusions = [];
    }
    if (radius < rules.minRadiusMiles) {
      drop(`A ${radius} mile radius`, `${rules.radius} Raised to ${rules.minRadiusMiles} miles.`);
      radius = rules.minRadiusMiles;
    }
    if (lookalike) {
      drop('Lookalike audience', rules.lookalike);
      lookalike = false;
    }
    if (interests.length) {
      drop(`${interests.length} ${interests.length === 1 ? 'interest' : 'interests'}`, rules.interests);
      interests = [];
    }
  }
  // Lookalikes are never in this build (Legal D10): they need a member's customer list.
  if (lookalike) {
    drop('Lookalike audience', 'Lookalikes come from your customer list, which this version never uploads.', null);
    lookalike = false;
  }
  const audience = { ageMin, ageMax, gender, zips, exclusions, radius, interests, lookalike, city: ask.city || '', country: ask.country || 'US' };
  const where = zips.length ? `ZIP codes ${zips.join(', ')}` : `${audience.city || 'your city'}, ${radius} miles around`;
  const out = [
    `Ages ${ageMin} to ${ageMax >= 65 ? '65+' : ageMax}`,
    gender === 'All' ? 'All genders' : `${gender} only`,
    `Where: ${where}${exclusions.length ? `, leaving out ${exclusions.join(', ')}` : ''}`,
    interests.length ? `Interests: ${interests.join(', ')}` : network === 'google' ? 'Who: people searching your keywords' : 'Interests: none (broad, so the network finds who responds)',
  ];
  return { network, name: rules.name, audience, removed, lines: out };
}

// Every network at once.
function audiences(ask, category) {
  return NETWORKS.map((n) => audienceFor(n, ask, category));
}

// D7 and D2 for any text the desk writes about audiences (optimizer suggestions, plans): words that
// would narrow by what the rules rule out.
const NARROWING = /\b(under|below)\s*18\b|\b1[3-7]\s*(-|to)\s*1[4-7]\b|\bteens?\b|\b(narrow|target|exclude|only)\b[^.!?\n]{0,40}\b(ages?|age range|gender|men|women|zip|postal|radius|lookalike)\b|\blookalikes?\b|\bcustom audiences?\b/i;
const narrows = (s) => NARROWING.test(String(s || ''));

module.exports = { SC, NETWORKS, ANSWERS, categoryOf, audienceFor, audiences, narrows };
