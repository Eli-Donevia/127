// The offer score: how much buyers want the result, how sure they are it works, how fast it works and
// how easy it is, scored 1 to 10 each from what the offer actually says (plus what the member's own
// site shows, when we read it). Value = (want x sure) / (wait x effort), mapped to 0..100.
// Then the 3 fixes that raise the score most, each a line the member can paste, and the offer
// rewritten with those fixes. Pure functions: the tool adds AI on top when it's available.

const { text, money } = require('../../_kit');
const { cap, whenLine } = require('./facts');

const DRIVERS = [
  { key: 'dream', label: 'How much they want it', short: 'Want', plain: 'the result, in their words' },
  { key: 'likelihood', label: 'How sure they are it works', short: 'Sure', plain: 'proof and a promise' },
  { key: 'speed', label: 'How fast it works', short: 'Fast', plain: 'when the first result shows up' },
  { key: 'ease', label: 'How easy it is for them', short: 'Easy', plain: 'what they don\'t have to do' },
];

const RX = {
  outcome: /\b(so (you|your|that)|get(s|ting)? (a|an|your|more|back)|look(s|ing)? (new|great|like)|feel(s|ing)?|never|without|finally|stop(s)? |ready|new again|more (calls|clients|customers|bookings|members|time|sales)|save(s)? (you|time|hours)|keep(s)? (your|it)|fresh|spotless|stronger|better|booked|answered|clear|calm|confident|frame|love|clean (car|home|house)|like new)\b/i,
  audience: /\b(for (busy|new|first|local|small|working|growing|every|all|any|young|single|older)|for [a-z]+ (owners|parents|moms|dads|families|students|teams|businesses|gyms|shops|restaurants|contractors|homeowners|renters|brands|couples|professionals|beginners|creators|athletes|teens|kids|seniors|commuters|landlords|realtors|salons|clinics|cafes)|for (parents|families|homeowners|renters|students|businesses|gyms|brands|couples|professionals|beginners|creators|commuters|moms|dads|teams|owners|landlords|realtors|restaurants|contractors))\b/i,
  emotion: /\b(love|proud|confident|stress|worry|embarrass\w*|show (it )?off|impress\w*|relax\w*|peace of mind|weekend|dread\w*|hassle|headache|finally|pride)\b/i,
  vague: /\b(quality|best|professional|affordable|top[- ]notch|premium|excellent|solutions?|world[- ]class|high[- ]end|amazing|great service|one[- ]stop)\b/i,
  promise: /\b(redo|re-do|refund\w*|money back|free if|don'?t pay|do not pay|or (it'?s|that (visit|month|session) is) free|on time or|keep (working|revising|going) until|until (you'?re|you are|it'?s) (happy|right)|no charge|fix it free|replace (it )?free|reshoot|remake|risk[- ]free|cancel any ?time|no contract|month to month)\b/i,
  proof: /\b(before (and|&) after|photos? of (my|our|your|real)|samples?|mock-?ups?|portfolio|examples?|case stud\w*|demo|see (it|my work|the results)|watch (me|it)|track record|worked with|i'?ve (done|helped|cleaned|detailed|built|made)|trial|free first|free (sample|mockup|session|consult\w*|lesson|walk|audit|estimate|quote)|gallery|progress (report|text|photos?))\b/i,
  process: /\b(step[- ]by[- ]step|\d[- ]step|steps?|plan|checklist|every (visit|session|week|month|job|clean)|here'?s how|we start|first we|process)\b/i,
  time: /\b(same[- ]day|same week|today|tonight|this week|next day|tomorrow|in (about |under |less than )?\d+ ?(min(ute)?s?|hours?|hrs?|days?|weeks?)|within (\d+|one|two|a) ?(min(ute)?s?|hours?|days?|weeks?)?|\d+[- ](hour|day|week|minute)|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|the weekend)|24 ?hours?|48 ?hours?|first (session|visit|week|draft|lesson|call)|one visit|single visit|sneak peek)\b/i,
  fast: /\b(fast|quick(ly)?|instant(ly)?|right away|immediately|asap|on the spot)\b/i,
  slow: /\b(\d+[- ]month (contract|minimum|commitment)|long[- ]term contract|minimum (term|commitment)|months? to see|takes? (months|weeks) to)\b/i,
  effort: /\b(we come to you|i come to you|come to you|comes to you|mobile|at your (home|house|door|office|place|kitchen table)|done[- ]for[- ]you|i handle|we handle|i do (the rest|everything|it all)|you don'?t (have to|need to|lift|drive|buy)|no need to|without (lifting|leaving|driving|doing|cooking|thinking)|just (text|send|reply|book|show up|approve)|all you do|pick[- ]?up (and|&) drop[- ]?off|delivered|from your phone|one (call|click|text)|bring (everything|my own|all)|nothing to (do|buy|learn)|hands[- ]off|ready to (use|serve|heat|wear|post)|i (plan|bring|write|set it up))\b/i,
  booking: /\b(book (online|by text|in (a|one|\d+) min\w*|now|here|at)|text (me )?to book|text [A-Z]{2,12} to|dm (me|us|@?\w+)|link in bio|reply (to )?book|order (by text|online|ahead)|text (me|us)|message (me|us))\b/i,
  diy: /\b(learn (to|how)|you'?ll need to|requires?|commit(ment)? to|homework|practice daily|diy|do it yourself|self[- ]paced)\b/i,
  quote: /\b(call (us )?for (a )?(quote|pricing|price)|contact (us )?for (a )?(quote|pricing|price)|request a quote|fill out (the|our) form|get a quote)\b/i,
  price: /\$\s?\d/,
  digits: /\d/,
};

function clamp(n) {
  return Math.max(1, Math.min(10, Math.round(n)));
}

// Value equation, mapped to 0..100 on a log scale (1s everywhere = 0, 10s everywhere = 100), with a
// gentle curve so a solid offer lands around 60 to 70.
function scoreOf(d) {
  const delay = 11 - d.speed;
  const effort = 11 - d.ease;
  const v = (d.dream * d.likelihood) / (delay * effort);
  const x = Math.max(0, Math.min(1, (Math.log10(v) + 2) / 4));
  return Math.round(100 * x ** 0.8);
}

function verdictOf(score) {
  if (score >= 85) return 'Hard to say no to';
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Solid';
  if (score >= 30) return 'Needs work';
  return 'Easy to ignore';
}

// site: optional facts from kit scan (booking, prices, testimonials) about the member's own site.
function rubric(offerText, site = {}) {
  const t = ` ${text.oneLine(offerText)} `;
  const words = t.trim().split(/\s+/).filter(Boolean).length;
  const has = (k) => RX[k].test(t);
  const found = { dream: [], likelihood: [], speed: [], ease: [] };
  const missing = { dream: [], likelihood: [], speed: [], ease: [] };
  const note = (d, ok, yes, no) => (ok ? found[d].push(yes) : no && missing[d].push(no));

  let dream = 3;
  if (has('outcome')) dream += 2;
  note('dream', has('outcome'), 'names a result', 'outcome');
  if (has('audience')) dream += 2;
  note('dream', has('audience'), 'says who it is for', 'audience');
  if (has('emotion')) dream += 1;
  note('dream', has('emotion'), 'speaks to how they feel');
  if (has('digits') && has('outcome')) dream += 1;
  if (words >= 14 && has('outcome')) dream += 1;
  if (words <= 5 && !has('outcome')) dream -= 1;
  if (has('vague')) {
    dream -= 1;
    missing.dream.push('vague');
  }

  let likelihood = 2;
  if (has('promise')) likelihood += 3;
  note('likelihood', has('promise'), 'makes a promise', 'promise');
  const proof = has('proof') || !!site.testimonials;
  if (proof) likelihood += 2;
  note('likelihood', proof, site.testimonials && !has('proof') ? 'site shows reviews or testimonials' : 'shows proof', 'proof');
  if (has('process')) likelihood += 1;
  note('likelihood', has('process'), 'explains the plan');
  if (has('digits')) likelihood += 1;
  if (/\bfree (first|sample|mockup|session|lesson|walk|audit|trial|consult)/i.test(t)) likelihood += 1;

  let speed = 3;
  if (has('time')) speed += 3;
  note('speed', has('time'), 'says when it happens', 'time');
  if (has('fast')) speed += 1;
  const booking = has('booking') || (Array.isArray(site.booking) && site.booking.length > 0);
  if (booking) speed += 1;
  note('speed', booking, Array.isArray(site.booking) && site.booking.length ? 'site has online booking' : 'easy to book', 'booking');
  if (/\bfirst (session|visit|draft|lesson|week|call|posts?|videos?)\b/i.test(t)) speed += 1;
  if (has('slow')) speed -= 1;

  let ease = 3;
  if (has('effort')) ease += 3;
  note('ease', has('effort'), 'says what they don\'t have to do', 'effort');
  if (booking) ease += 1;
  const priced = has('price') || (Array.isArray(site.prices) && site.prices.length > 0);
  if (priced) ease += 1;
  note('ease', priced, 'shows the price', 'price');
  if (has('diy')) ease -= 1;
  if (has('quote')) {
    ease -= 1;
    missing.ease.push('quote');
  }

  const drivers = { dream: clamp(dream), likelihood: clamp(likelihood), speed: clamp(speed), ease: clamp(ease) };
  return { drivers, found, missing, words };
}

// The candidate fixes for what's missing, each with the line to add and how much it lifts its driver.
function candidates(r, f) {
  const p = f.profile;
  const out = [];
  const add = (driver, key, gain, title, line, why) => out.push({ driver, key, gain, title, line: text.plain(line), why: text.plain(why) });
  const outcome = cap(f.outcome);
  if (r.missing.dream.includes('outcome')) add('dream', 'outcome', 3, 'Lead with the result, not the service', `${outcome}.`, `People buy ${f.outcome}, not "${text.clip(f.what, 40)}". Put the result first.`);
  if (r.missing.dream.includes('audience')) add('dream', 'audience', 2, 'Say exactly who it is for', `For ${f.who}.`, 'When the right people see themselves in the first line, they keep reading.');
  if (r.missing.dream.includes('vague')) add('dream', 'vague', 1, 'Trade vague words for specifics', `${outcome}, ${f.mobile ? 'at your place' : 'done start to finish'}.`, 'Words like quality and professional are what everyone says. Say what they get instead.');
  if (r.missing.likelihood.includes('promise')) add('likelihood', 'promise', 3, 'Add a promise you control', p.promise.text, 'A promise you can keep moves the risk from them to you. Only offer what you will actually do.');
  if (r.missing.likelihood.includes('proof')) add('likelihood', 'proof', 2, 'Show proof before they pay', `${cap(p.proof)}.`, 'Seeing your work beats any claim. Use only real photos and real work.');
  if (r.missing.speed.includes('time')) add('speed', 'time', 3, 'Say when the first result shows up', whenLine(f), 'Waiting is a cost. Tell them the moment they get something.');
  if (r.missing.speed.includes('booking')) add('speed', 'booking', 1, 'Make booking take one minute', 'Book by text in one minute.', 'Every extra step before booking loses people.');
  if (r.missing.ease.includes('effort')) add('ease', 'effort', 3, 'Say what they don\'t have to do', `${f.mobile ? p.mobileEffort : p.effort}.`, 'The less they have to do, the more it is worth. Spell it out.');
  if (r.missing.ease.includes('price')) add('ease', 'price', 1, 'Show the price up front', f.price ? `From ${money.usd(f.price)}.` : 'From $[your price].', 'A price on the page saves them a message, and a message is effort.');
  if (r.missing.ease.includes('quote')) add('ease', 'quote', 1, 'Drop "call for a quote"', 'Text a photo and get your price in minutes.', 'A quote request feels like work. A fast answer feels like service.');
  return out;
}

// The 3 fixes that raise the score most: best per driver first, then the next best.
function pickFixes(drivers, cands, n = 3) {
  const lift = (c) => scoreOf({ ...drivers, [c.driver]: clamp(drivers[c.driver] + c.gain) }) - scoreOf(drivers);
  const scored = cands.map((c) => ({ ...c, points: lift(c) })).sort((x, y) => y.points - x.points || y.gain - x.gain);
  const picked = [];
  for (const c of scored) if (picked.length < n && !picked.some((p) => p.driver === c.driver)) picked.push(c);
  for (const c of scored) if (picked.length < n && !picked.includes(c)) picked.push(c);
  return picked;
}

// The offer rewritten with the fixes: result and who, when, what they don't do, the promise, a price.
function rewrite(f) {
  const p = f.profile;
  const lines = [`${cap(f.outcome)}, for ${f.who}.`, whenLine(f), `${f.mobile ? p.mobileEffort : p.effort}.`, `${cap(p.proof)}.`, p.promise.text, f.price ? `From ${money.usd(f.price)}.` : ''];
  return text.plain(lines.filter(Boolean).join(' ').replace(/\.\./g, '.'));
}

function equation(d) {
  return { dream: d.dream, likelihood: d.likelihood, delay: 11 - d.speed, effort: 11 - d.ease };
}

function driverRows(d, r) {
  return DRIVERS.map((x) => ({
    key: x.key,
    label: x.label,
    short: x.short,
    score: d[x.key],
    why: r ? whyLine(x.key, r) : '',
  }));
}

function whyLine(key, r) {
  const yes = r.found[key];
  const no = r.missing[key].filter((m) => m !== 'vague' && m !== 'quote');
  const NO = {
    outcome: 'no result named',
    audience: 'doesn\'t say who it is for',
    promise: 'no promise',
    proof: 'no proof yet',
    time: 'no timeframe',
    booking: 'no quick way to book',
    effort: 'doesn\'t say what they skip',
    price: 'no price shown',
  };
  const parts = [...yes.map((y) => cap(y)), ...no.map((m) => cap(NO[m] || m))];
  if (key === 'dream' && r.missing.dream.includes('vague')) parts.push('Vague words');
  if (key === 'ease' && r.missing.ease.includes('quote')) parts.push('Asks for a quote first');
  return parts.length ? `${parts.join('. ')}.` : 'Nothing here yet.';
}

function evaluate(offerText, f, site) {
  const before = rubric(offerText, site);
  const fixes = pickFixes(before.drivers, candidates(before, f));
  const rewritten = rewrite(f);
  const after = rubric(rewritten, site);
  // The rewrite never scores lower than the original on any driver.
  const afterDrivers = Object.fromEntries(Object.keys(before.drivers).map((k) => [k, Math.max(before.drivers[k], after.drivers[k])]));
  return {
    score: scoreOf(before.drivers),
    drivers: before.drivers,
    rows: driverRows(before.drivers, before),
    fixes,
    rewrite: rewritten,
    after: { score: scoreOf(afterDrivers), drivers: afterDrivers, rows: driverRows(afterDrivers, after) },
  };
}

module.exports = { DRIVERS, RX, rubric, candidates, pickFixes, rewrite, scoreOf, verdictOf, equation, evaluate, driverRows, clamp };
