// Proof and growth for client gyms, run at the end of each month. The loop:
//   1. prove the month in the owner's language: trial sign-ups, new members and what they're worth,
//      then reach;
//   2. ask for the testimonial and the intro right after the numbers, while the win is fresh;
//   3. offer the next step up as more, better or new, tied to the bonuses in the member's offer;
//   4. turn the result into proof for the next sale: a case study and a line of proof for follow-ups and calls.
// Honesty is built in, not left to the member: only numbers someone typed (or the price on the gym's
// own website), never estimated or rounded up, and a missing number leaves its line out; money is
// "if" math on the owner's own numbers; public proof leaves money out and names a gym only with the
// owner's written OK; the owner's words stay theirs (we ask the questions, never write the answers).

const { plain, slug, shortSite, domainOf } = require('./util');
const { CATEGORY_LABEL, OFFER_LABEL, IDEAS } = require('./gaps');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// What a member can report: people first, then reach, then what the money math stands on.
const FIELDS = ['trials', 'newMembers', 'views', 'reelsPosted', 'followersStart', 'followersEnd', 'profileVisits', 'linkClicks', 'memberPrice', 'stayMonths'];

const LABEL = {
  trials: 'Trial sign-ups from the videos',
  newMembers: 'New members from the videos',
  views: 'Video views',
  reelsPosted: 'Reels posted',
  followers: 'Followers',
  followersStart: 'Followers at the start of the month',
  followersEnd: 'Followers at the end of the month',
  profileVisits: 'Profile visits',
  linkClicks: 'Link clicks',
  memberPrice: 'What a member pays a month',
  stayMonths: 'How long members usually stay',
};

// The numbers form both tools share (JSON Schema subset, contract section 3).
const NUMBERS_INPUT = {
  type: 'object',
  title: "This month's numbers",
  description: "Only what you actually counted. Leave anything you don't know empty and its line stays out.",
  properties: {
    trials: { type: 'integer', title: 'Trial sign-ups from the videos', description: 'Booked from your link, or told the front desk they saw a video', minimum: 0 },
    newMembers: { type: 'integer', title: 'New members from the videos', description: 'Ask the owner', minimum: 0 },
    views: { type: 'integer', title: 'Views on the videos', minimum: 0 },
    reelsPosted: { type: 'integer', title: 'Reels posted', minimum: 0 },
    followersStart: { type: 'integer', title: 'Followers at the start of the month', minimum: 0 },
    followersEnd: { type: 'integer', title: 'Followers at the end of the month', minimum: 0 },
    profileVisits: { type: 'integer', title: 'Profile visits', minimum: 0 },
    linkClicks: { type: 'integer', title: 'Link clicks', minimum: 0 },
    memberPrice: { type: 'number', title: 'What a member pays a month ($)', description: "Default: the price on the gym's website, if it shows one", minimum: 1, maximum: 5000 },
    stayMonths: { type: 'number', title: 'How long members usually stay (months)', description: 'Ask the owner', minimum: 1, maximum: 120 },
  },
};

// ---------- numbers: only what was typed, shown exactly ----------

// A number counts only when someone typed one: no defaults, no guesses. "1,240" is fine, "1.2k" isn't.
function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v === 'string' && /^\s*\$?\d[\d,]*(\.\d+)?\s*$/.test(v)) return Number(v.replace(/[$,\s]/g, ''));
  return null;
}

function cleanNumbers(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of FIELDS) {
    const v = num(raw[k]);
    if (v != null) out[k] = v;
  }
  return out;
}

// 48200 -> "48,200", 7.5 -> "7.5": commas only, never rounded.
function count(n) {
  const [i, d] = String(n).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? `.${d}` : '');
}

// $2,136 or $2,159.76. Rounding to the cent only removes float noise; util.money rounds to whole
// dollars, which can round a result up, so proof keeps its own.
function dollars(n) {
  const c = Math.round(n * 100);
  const rest = c % 100;
  return `$${count(Math.floor(c / 100))}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

const toCents = (n) => Math.round(n * 100) / 100;
const plural = (n, one, many) => `${count(n)} ${n === 1 ? one : many || `${one}s`}`;
// A hyphen-minus for drops, so "-50" never turns into a dash the copy rules forbid.
const signed = (n) => (n > 0 ? `+${count(n)}` : n < 0 ? `-${count(-n)}` : '0');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lowerFirst = (s) => (s && !/^[A-Z]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const possessive = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
const firstOf = (name) => String(name || '').trim().split(/\s+/)[0] || '';

function joinAnd(items) {
  const a = items.filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}

// Anything a member or a gym owner reads: plain() plus no emoji (brand rule), applied to every string.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
const clean = (s) => plain(String(s == null ? '' : s).replace(EMOJI, ''));

function deepMap(v, fn) {
  if (typeof v === 'string') return fn(v);
  if (Array.isArray(v)) return v.map((x) => deepMap(x, fn));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = deepMap(x, fn);
    return o;
  }
  return v;
}

// ---------- months ----------

function partsIn(ms, tz) {
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
    const p = {};
    for (const x of f.formatToParts(new Date(ms))) p[x.type] = Number(x.value);
    return { y: p.year, m: p.month, d: p.day };
  } catch {
    const t = new Date(ms);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
}

const keyOf = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

function shiftMonth(key, by) {
  const [y, m] = key.split('-').map(Number);
  const i = y * 12 + (m - 1) + by;
  return keyOf(Math.floor(i / 12), (i % 12) + 1);
}

// 'YYYY-MM' as given, or the month that's ending: in the first 10 days of a month, that's last month.
function monthKey(month, now, tz) {
  if (month != null && String(month).trim() !== '') {
    const m = String(month).trim().match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new Error('Write the month like 2026-10.');
    return keyOf(Number(m[1]), Number(m[2]));
  }
  const t = partsIn(Number.isFinite(now) ? now : Date.now(), tz);
  return t.d <= 10 ? shiftMonth(keyOf(t.y, t.m), -1) : keyOf(t.y, t.m);
}

const monthName = (key) => MONTHS[Number(key.slice(5, 7)) - 1];
const monthLabel = (key) => `${monthName(key)} ${key.slice(0, 4)}`;

function dateLabel(ms, tz) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(ms));
  } catch {
    return new Date(ms).toDateString();
  }
}

// ---------- the gym ----------

// A ranked row from gym.find_gaps, or just { name, category, city } (plus ownerName and email if known).
function gymOf(row) {
  const r = row && typeof row === 'object' ? row : {};
  const g = r.gym && typeof r.gym === 'object' ? r.gym : r;
  const site = r.site && typeof r.site === 'object' ? r.site : {};
  const contact = r.contact && typeof r.contact === 'object' ? r.contact : {};
  // gym.owner on a found gym says 'independent' or 'franchise', not who owns it: only these are people.
  const person = (contact.owner && contact.owner.name) || (r.owner && typeof r.owner === 'object' && r.owner.name) || (typeof r.ownerName === 'string' && r.ownerName) || null;
  const website = g.website || site.url || r.website || null;
  const category = g.category || r.category || null;
  const color = site.colors && typeof site.colors.primary === 'string' ? site.colors.primary.trim() : '';
  const price = num(site.monthlyPrice);
  return {
    key: r.key || g.key || null,
    name: clean(g.name || r.name || ''),
    listedName: clean(r.name || ''),
    category,
    label: CATEGORY_LABEL[category] || 'gym',
    city: clean(g.city || r.city || ''),
    brand: g.brand ? clean(g.brand) : null,
    website,
    domains: [...new Set([site.domain, domainOf(website), site.url ? domainOf(site.url) : null].filter(Boolean))],
    instagram: contact.instagram || g.instagram || r.instagram || null,
    tiktok: contact.tiktok || g.tiktok || null,
    email: contact.email || g.email || r.email || null,
    phone: contact.phone || g.phone || null,
    address: g.address || null,
    owner: person ? { name: clean(person), role: clean((contact.owner && contact.owner.role) || 'owner') } : null,
    // Only a real hex color goes into the page's CSS.
    color: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : null,
    monthlyPrice: price > 0 ? price : null,
    offer: site.offer && site.offer.kind && site.offer.kind !== 'none' ? site.offer : null,
    gaps: Array.isArray(r.gaps) ? r.gaps.filter(Boolean) : [],
    ideas: Array.isArray(r.ideas) ? r.ideas.filter((i) => i && i.title) : [],
    sample: !!r.sample,
  };
}

const hiTo = (g) => (g.owner ? `Hi ${firstOf(g.owner.name)}` : `Hi ${g.name} team`);
const article = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');

// How public proof names the gym: its name only with the owner's written OK, else what it is and where.
function whoFor(g, named) {
  if (named) return g.city && !g.name.toLowerCase().includes(g.city.toLowerCase()) ? `${g.name} in ${g.city}` : g.name;
  return `${article(g.label)} ${g.label}${g.city ? ` in ${g.city}` : ''}`;
}

// Words in a gym's name that say what it is, not which one it is.
const GENERIC = new Set(
  'the and of at in on for gym gyms fitness fit strength club co company crossfit box yoga studio studios pilates boxing martial arts art academy school dojo climbing cycling cycle spin dance barre house room lab center centre training athletics athletic performance health wellness sport sports mma bjj jiu jitsu karate taekwondo kickboxing hot power method collective llc inc place space works project'.split(' ')
);

// Everything that could point to one gym. Strong ones are swept from every anonymous line; single
// words of its name and the owner's first name only from the owner's quote, where they slip in.
function identifiers(g) {
  const out = [];
  const add = (text, as, strong = true) => {
    const t = String(text || '').trim();
    if (t.length >= 3 && !out.some((x) => x.text.toLowerCase() === t.toLowerCase())) out.push({ text: t, as, strong });
  };
  for (const d of g.domains) add(d, '[their website]');
  if (g.website) add(shortSite(g.website), '[their website]');
  if (g.instagram) {
    add(`@${g.instagram}`, '[their Instagram]');
    add(g.instagram, '[their Instagram]');
  }
  if (g.tiktok) {
    add(`@${g.tiktok}`, '[their TikTok]');
    add(g.tiktok, '[their TikTok]');
  }
  if (g.email) add(g.email, '[their email]');
  if (g.phone) add(g.phone, '[their phone number]');
  if (g.address) add(g.address, '[their street]');
  for (const n of [g.name, g.listedName, g.brand]) add(n, '[the gym]');
  if (g.owner) {
    add(g.owner.name, '[the owner]');
    for (const part of g.owner.name.split(/\s+/)) add(part, '[the owner]', false);
  }
  const cityWords = new Set(g.city.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  for (const w of g.name.split(/[^A-Za-z0-9']+/)) {
    if (w.length >= 4 && !GENERIC.has(w.toLowerCase()) && !cityWords.has(w.toLowerCase())) add(w, '[the gym]', false);
  }
  // Longest first, so "Ironleaf Strength Club" goes before "Ironleaf".
  return out.sort((a, b) => b.text.length - a.text.length);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function scrub(s, ids, all = false) {
  let t = String(s);
  for (const id of ids) {
    if (!all && !id.strong) continue;
    t = t.replace(new RegExp(`(^|[^A-Za-z0-9])${escapeRe(id.text)}(?![A-Za-z0-9])`, 'gi'), (m, pre) => pre + id.as);
  }
  return t;
}

// The owner's words, kept as written: typos aside, we only tidy quote marks and spacing.
function cleanQuote(q) {
  const t = clean(q)
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/["“”]/g, "'")
    .trim();
  return t || null;
}

// ---------- the monthly report ----------

function rowsFor(n, typed, prev, prevName, roi) {
  const rows = [];
  const vsPrev = (key) => {
    if (!prev || prev[key] == null) return {};
    const c = n[key] - prev[key];
    const was = `${count(prev[key])} in ${prevName}`;
    return { before: prev[key], change: c, changeText: `${signed(c)} vs ${prevName}`, changeWords: c > 0 ? `up from ${was}` : c < 0 ? `down from ${was}` : `same as ${prevName}` };
  };
  const add = (key, value, extra = {}) => rows.push({ key, label: LABEL[key], value, display: count(value), change: null, changeText: '', changeWords: '', kind: 'result', ...extra });
  for (const key of ['trials', 'newMembers', 'views', 'reelsPosted']) if (n[key] != null) add(key, n[key], vsPrev(key));
  const s = n.followersStart;
  const e = n.followersEnd;
  if (s != null && e != null) {
    const c = e - s;
    add('followers', e, {
      before: s,
      change: c,
      changeText: `${signed(c)} this month`,
      changeWords: c > 0 ? `up ${count(c)} from ${count(s)}` : c < 0 ? `down ${count(-c)} from ${count(s)}` : 'no change this month',
    });
  } else if (e != null) add('followersEnd', e);
  else if (s != null) add('followersStart', s);
  for (const key of ['profileVisits', 'linkClicks']) if (n[key] != null) add(key, n[key], vsPrev(key));
  // What the money math stands on: shown when typed, or when the website's price was used for it.
  if (n.memberPrice != null && (typed.memberPrice != null || roi)) {
    add('memberPrice', n.memberPrice, { display: dollars(n.memberPrice), kind: 'basis', note: typed.memberPrice == null ? 'from their website' : '' });
  }
  if (n.stayMonths != null) add('stayMonths', n.stayMonths, { display: plural(n.stayMonths, 'month'), kind: 'basis' });
  return rows;
}

const peopleParts = (n) => [n.trials > 0 && plural(n.trials, 'trial sign-up'), n.newMembers > 0 && plural(n.newMembers, 'new member')].filter(Boolean);

function reachParts(n, gain) {
  const parts = [];
  if (n.views > 0) parts.push(`${plural(n.views, 'view')}${n.reelsPosted > 0 ? ` on ${plural(n.reelsPosted, 'Reel')}` : ''}`);
  else if (n.reelsPosted > 0) parts.push(`${plural(n.reelsPosted, 'Reel')} posted`);
  if (gain > 0) parts.push(plural(gain, 'more follower'));
  return parts;
}

function winsFor(n, prev, prevName, gain) {
  const up = (key) => (prev && prev[key] != null && n[key] > prev[key] ? `, up from ${count(prev[key])} in ${prevName}` : '');
  const w = [];
  if (n.trials > 0) w.push(`${n.trials === 1 ? '1 person' : `${count(n.trials)} people`} signed up for a trial from the videos${up('trials')}.`);
  if (n.newMembers > 0) w.push(`${plural(n.newMembers, 'new member')} joined from the videos${up('newMembers')}.`);
  if (gain > 0) w.push(`Followers went from ${count(n.followersStart)} to ${count(n.followersEnd)}, up ${count(gain)}.`);
  if (n.views > 0) w.push(`${plural(n.views, 'view')}${n.reelsPosted > 0 ? ` on ${plural(n.reelsPosted, 'Reel')}` : ''}${up('views')}.`);
  else if (n.reelsPosted > 0) w.push(`${plural(n.reelsPosted, 'Reel')} posted${up('reelsPosted')}.`);
  if (n.profileVisits > 0) w.push(`${plural(n.profileVisits, 'profile visit')}${up('profileVisits')}.`);
  if (n.linkClicks > 0) w.push(`${plural(n.linkClicks, 'link click')}${up('linkClicks')}.`);
  return w.map(cap);
}

// "4 times" only when it is exactly 4; otherwise "more than 4 times", so the comparison never rounds up.
function timesFee(ratio, fee) {
  const f = `this month's ${dollars(fee)} fee`;
  if (Math.abs(ratio - Math.round(ratio)) < 1e-9) return Math.round(ratio) === 1 ? `the same as ${f}` : `${Math.round(ratio)} times ${f}`;
  return Math.floor(ratio) >= 2 ? `more than ${Math.floor(ratio)} times ${f}` : `more than ${f}`;
}

// Only when new members and a member price are both known. Always "if" math, never a promise.
function roiFor(n, priceFromSite, fee) {
  const members = n.newMembers;
  const price = n.memberPrice;
  if (!(members > 0) || !(price > 0)) return null;
  const stay = n.stayMonths > 0 ? n.stayMonths : null;
  const perMonth = toCents(members * price);
  const memberValue = stay ? toCents(members * price * stay) : null;
  const lines = [`${plural(members, 'new member')} at ${dollars(price)} a month${priceFromSite ? ' (the price on your website)' : ''}.`];
  if (stay) {
    const vs = fee > 0 && memberValue / fee >= 1 ? `, ${timesFee(memberValue / fee, fee)}` : '';
    lines.push(`If they stay as long as your members usually do (${plural(stay, 'month')}), ${members === 1 ? 'that member is' : "they're"} worth ${dollars(memberValue)} to you${vs}.`);
  } else {
    lines.push(`If ${members === 1 ? 'they stay' : 'they all stay'}, that's ${dollars(perMonth)} a month for as long as they do. Tell me how long members usually stay and I'll show what that adds up to.`);
  }
  lines.push("That's math on your own numbers, not a promise.");
  return {
    newMembers: members,
    memberPrice: price,
    priceSource: priceFromSite ? 'their website' : 'you',
    stayMonths: stay,
    perMonth,
    memberValue,
    fee: fee > 0 ? fee : null,
    text: lines.join(' '),
  };
}

// The 2 or 3 numbers for the top of the report: positive results first, people before reach.
function metricsFor(n, rows, roi, gain) {
  const r = (k) => rows.find((x) => x.key === k) || {};
  const c = [];
  if (n.trials != null) c.push({ label: 'Trial sign-ups', value: count(n.trials), note: r('trials').changeWords || 'from the videos', pos: n.trials > 0 });
  if (n.newMembers != null) {
    const note = roi && roi.memberValue != null ? `worth ${dollars(roi.memberValue)} if they stay ${plural(roi.stayMonths, 'month')}` : r('newMembers').changeWords || 'from the videos';
    c.push({ label: 'New members', value: count(n.newMembers), note, pos: n.newMembers > 0 });
  }
  if (n.views != null) c.push({ label: 'Video views', value: count(n.views), note: n.reelsPosted != null ? `on ${plural(n.reelsPosted, 'Reel')}` : r('views').changeWords, pos: n.views > 0 });
  if (gain != null) c.push({ label: 'Followers', value: count(n.followersEnd), note: `${signed(gain)} this month`, pos: gain > 0 });
  if (n.reelsPosted != null && n.views == null) c.push({ label: 'Reels posted', value: count(n.reelsPosted), note: r('reelsPosted').changeWords, pos: n.reelsPosted > 0 });
  if (n.profileVisits != null) c.push({ label: 'Profile visits', value: count(n.profileVisits), note: r('profileVisits').changeWords, pos: n.profileVisits > 0 });
  if (n.linkClicks != null) c.push({ label: 'Link clicks', value: count(n.linkClicks), note: r('linkClicks').changeWords, pos: n.linkClicks > 0 });
  return [...c.filter((x) => x.pos), ...c.filter((x) => !x.pos)].slice(0, 3).map(({ pos, ...m }) => ({ ...m, note: m.note || '' }));
}

// Three videos for next month: the ideas picked for this gym's gaps first, then its kind of gym's,
// skipping last month's suggestions so the plan moves forward instead of repeating.
function nextFor(g, n, skip = []) {
  const list = IDEAS[g.category] || IDEAS.gym;
  const done = new Set(skip.map((t) => String(t).toLowerCase()));
  const fresh = (i) => i && i.title && !done.has(i.title.toLowerCase());
  // People book trials but fewer join: a "what to expect" video to send every new trial comes first.
  const stuck = n.trials > 0 && n.newMembers != null && n.newMembers < n.trials;
  const first = stuck ? list.find((i) => /first|bring|101|class-preview/.test(i.id) && fresh(i)) : null;
  const seen = new Set(first ? [first.title] : []);
  const take = (ok) => [...g.ideas, ...list].filter((i) => i && i.title && ok(i) && !seen.has(i.title) && seen.add(i.title));
  const pool = take(fresh);
  // Run out of new ones and last month's come back round.
  if (pool.length + (first ? 1 : 0) < 3) pool.push(...take(() => true));
  return [first, ...pool]
    .filter(Boolean)
    .slice(0, 3)
    .map((i) => ({
      title: i.title,
      hook: i.hook || '',
      shots: i.shots || '',
      why: i === first ? 'Send it to everyone who books a trial, so they know what to expect before they walk in.' : '',
    }));
}

function signOff(me, biz) {
  return ['Thanks,', me || '[Your name]', biz && biz !== me ? biz : ''].filter(Boolean).join('\n');
}

// Questions, never a written-for-them testimonial (FTC: real words only). One honest ask, good or bad,
// with nothing offered for it, and their written OK before their name goes anywhere. The member edits
// video, so the easiest yes (and the strongest proof) is filming the answers at the next shoot.
function testimonialParts(g, who) {
  return {
    intro: 'could you answer three short questions, a line or two each, in your own words?',
    questions: [
      `1. What were video and social media like for ${g.name} before we started?`,
      '2. What have you noticed since?',
      "3. What would you tell another gym owner who's thinking about it?",
    ],
    video: "If talking is easier than typing, I can film you answering them at the next shoot, about a minute, and you'll see it before anyone else does.",
    share: `Honest beats polished, good or bad. If it's OK for me to share your answers on my website and social media, say so in your reply, and tell me if I can use ${possessive(g.name)} name or should keep it anonymous ("${who}").`,
  };
}

// Running totals across the reports so far, the strongest reason to stay. Exact sums of typed
// numbers, and the line says how many reports they cover.
function toDateFor(history, mKey, typed) {
  const months = {};
  for (const [k, v] of Object.entries(history && typeof history === 'object' ? history : {})) if (/^\d{4}-\d{2}$/.test(k) && k < mKey) months[k] = cleanNumbers(v);
  months[mKey] = typed;
  const keys = Object.keys(months).filter((k) => months[k].trials != null || months[k].newMembers != null).sort();
  if (keys.length < 2) return null;
  const total = (f) => keys.reduce((s, k) => (months[k][f] != null ? s + months[k][f] : s), 0);
  const trials = total('trials');
  const newMembers = total('newMembers');
  const parts = [trials > 0 && plural(trials, 'trial sign-up'), newMembers > 0 && plural(newMembers, 'new member')].filter(Boolean);
  if (!parts.length) return null;
  const from = keys[0];
  const since = `${monthName(from)}${from.slice(0, 4) !== mKey.slice(0, 4) ? ` ${from.slice(0, 4)}` : ''}`;
  return { from, reports: keys.length, trials, newMembers, text: `Since ${since}, across ${keys.length} monthly reports: ${joinAnd(parts)} from the videos.` };
}

// Totals over whole months for a case study: a field counts only when every month has it, so
// "over 3 months" is never quietly missing one.
function sumMonths(list) {
  const ms = (list || []).map(cleanNumbers);
  const out = {};
  if (!ms.length) return out;
  for (const f of ['trials', 'newMembers', 'views', 'reelsPosted', 'profileVisits', 'linkClicks']) {
    if (ms.every((m) => m[f] != null)) out[f] = ms.reduce((s, m) => s + m[f], 0);
  }
  if (ms[0].followersStart != null && ms[ms.length - 1].followersEnd != null) {
    out.followersStart = ms[0].followersStart;
    out.followersEnd = ms[ms.length - 1].followersEnd;
  }
  return out;
}

// The gift goes to the gym they introduce, not to the owner, so the intro stays a plain favor.
function giftLine(gift) {
  return gift ? `If you introduce us, I'll offer them ${lowerFirst(gift).replace(/[.!]+$/, '')}.` : "If you introduce us, I'll make their gym a free sample Reel, no strings.";
}

function forwardLine(me, biz, gift) {
  const name = me || biz || '[your name]';
  const who = me && biz && biz !== me ? `${me} (${biz})` : name;
  const offer = gift ? `is offering ${lowerFirst(gift).replace(/[.!]+$/, '')} to gyms I introduce` : 'offered to make yours a free sample Reel';
  return `"I've been working with ${who} on our videos. ${name} makes short videos for gyms and ${offer}. Want me to connect you?"`;
}

// More, better, new (the three ways to grow an account), using the member's own bonus wording.
function upsellFor(g, o, n, nextName, me, biz) {
  const hi = hiTo(g);
  const sign = signOff(me, biz);
  const bonuses = Array.isArray(o.bonuses) ? o.bonuses.filter((b) => b && b.title) : [];
  const bonus = (re) => bonuses.find((b) => re.test(`${b.id || ''} ${b.title}`));
  const close = 'Want me to send over what that would cost?';
  // The bonus lines read "Shows a first-timer...": give them a subject that agrees with the title.
  const isPlural = (title) => /^\s*([2-9]|\d{2,})\b/.test(title) || /[^s]s$/i.test(String(title).trim().split(/\s+/).pop() || '');
  const it = (b) => {
    if (!/^[A-Z][a-z]+s\b/.test(b.does)) return b.does;
    return isPlural(b.title) ? `They ${lowerFirst(b.does).replace(/^([a-z]+?)s\b/, '$1')}` : `It ${lowerFirst(b.does)}`;
  };
  const event = 'I could also cut a short recap of your next event or challenge.';

  const more = [`${hi}, want more of this in ${nextName}?`, n.reelsPosted > 0 ? `You got ${plural(n.reelsPosted, 'Reel')} this month.` : '', 'A second shoot day each month would give you more to post, with more classes and coaches in it.', close];

  const ads = bonus(/offer_ads|\bad cuts?\b|\bads\b/i);
  const coaches = bonus(/coach/i);
  const offerText = g.offer ? (g.offer.text ? ` ("${clean(g.offer.text)}")` : ` (your ${OFFER_LABEL[g.offer.kind] || 'intro offer'})`) : '';
  const better = ads || g.offer
    ? [`${hi}, one idea to get more from the videos:`, `${ads ? lowerFirst(ads.title) : 'short ad cuts of your intro offer'}${offerText}, each with a different first line.`, ads && ads.does ? it(ads) : 'Ready for Meta ads whenever you want to run them.', close]
    : [`${hi}, one idea to get more from the videos:`, `${coaches ? lowerFirst(coaches.title) : 'a short intro video for each coach'}, so people know who will greet them before they walk in.`, coaches && coaches.does ? it(coaches) : 'You can use them on your website, Instagram and Google listing.', close];

  const homepage = bonus(/homepage|website/i);
  const google = bonus(/google/i);
  const fresh = homepage || g.gaps.some((x) => x.id === 'site-video')
    ? [`${hi}, something new for ${nextName}:`, `${homepage ? lowerFirst(homepage.title) : 'a 30-second class video for the top of your homepage'}.`, homepage && homepage.does ? it(homepage) : 'It shows a first-timer what a class looks like before they book.', event, close]
    : [`${hi}, something new for ${nextName}:`, `${google ? lowerFirst(google.title) : 'short videos for your Google Business Profile'}, the listing people see when they look you up on Google Maps.`, event, close];

  const msg = (parts) => `${parts.filter(Boolean).join(' ')}\n\n${sign}`;
  return { more: msg(more), better: msg(better), new: msg(fresh) };
}

// args: { row, offer, month, numbers, member: { firstName, business }, business: { name }, previous,
//         previousMonth, history: { 'YYYY-MM': numbers }, skipIdeas, fee, referralGift, now, tz }
function monthlyReport(args = {}) {
  const { row, offer, month, numbers, member = {}, business = {}, previous, previousMonth, history, skipIdeas, fee, referralGift, now, tz } = args;
  const g = gymOf(row);
  if (!g.name) throw new Error('Pick a gym first.');
  const o = offer && typeof offer === 'object' ? offer : {};
  const mKey = monthKey(month, now, tz);
  const mName = monthName(mKey);
  const nextName = monthName(shiftMonth(mKey, 1));
  const typed = cleanNumbers(numbers);
  const n = { ...typed };
  // The one number we take without the member typing it: the price on the gym's own website.
  const priceFromSite = n.memberPrice == null && g.monthlyPrice != null && n.newMembers > 0;
  if (priceFromSite) n.memberPrice = g.monthlyPrice;
  const prev = cleanNumbers(previous);
  const hasPrev = Object.keys(prev).length > 0;
  const prevName = hasPrev ? monthName(/^\d{4}-\d{2}$/.test(previousMonth || '') ? previousMonth : shiftMonth(mKey, -1)) : null;
  const gain = n.followersStart != null && n.followersEnd != null ? n.followersEnd - n.followersStart : null;
  const me = clean(member.firstName || (o.member && o.member.firstName) || '');
  const biz = clean(business.name || member.business || (o.member && o.member.business) || '');
  const feeAmount = num(fee) || num(o.price && o.price.current) || num(o.price && o.price.monthly) || null;
  const gift = referralGift ? clean(referralGift) : null;
  const who = whoFor(g, false);

  const roi = roiFor(n, priceFromSite, feeAmount);
  const rows = rowsFor(n, typed, hasPrev ? prev : null, prevName, roi);
  const people = peopleParts(n);
  const reach = reachParts(n, gain);
  const headline = people.length ? `${mName}: ${joinAnd(people)} from the videos.` : reach.length ? `${mName}: ${joinAnd(reach)}.` : `${mName} video report for ${g.name}.`;
  const wins = winsFor(n, hasPrev ? prev : null, prevName, gain);
  // Ask at the moment of a win: people to point at, or one of the gym's numbers went up
  // (more Reels posted is the member's work, not the gym's result).
  const hasWin = people.length > 0 || gain > 0 || (hasPrev && rows.some((r) => ['views', 'profileVisits', 'linkClicks'].includes(r.key) && r.change > 0));
  const metrics = metricsFor(n, rows, roi, gain);
  const next = nextFor(g, n, Array.isArray(skipIdeas) ? skipIdeas : []);
  const toDate = toDateFor(history, mKey, typed);
  const hi = hiTo(g);
  const sign = signOff(me, biz);
  const t = testimonialParts(g, who);

  const asks = {
    testimonial: [`${hi}, a quick favor while ${mName} is fresh: ${t.intro}`, '', ...t.questions, '', t.video, '', t.share, '', sign].join('\n'),
    referral: [`${hi}, quick question. Who's one gym owner you'd want to see this work for? ${giftLine(gift)} An email or text with both of us on it is perfect, or forward them this:`, '', forwardLine(me, biz, gift), '', sign].join('\n'),
  };

  const bullets = rows.filter((r) => r.kind === 'result').map((r) => `- ${r.label}: ${r.display}${r.changeWords ? ` (${r.changeWords})` : ''}`);
  const subject = people.length ? `${mName} video report: ${joinAnd(people)}` : `Your ${mName} video report`;
  const body = [
    `${hi},`,
    '',
    `Here's how ${mName} went for ${g.name}.`,
    '',
    ...(people.length ? [`${cap(joinAnd(people))} came from the videos.`, ''] : reach.length ? [`${cap(joinAnd(reach))}.`, ''] : []),
    ...(bullets.length ? [...bullets, ''] : []),
    ...(toDate ? [toDate.text, ''] : []),
    ...(roi ? [`What it's worth: ${roi.text}`, ''] : []),
    ...(next.length ? [`For ${nextName}, I'd like to make ${joinAnd(next.map((i) => `"${i.title}"`))}.`, ''] : []),
    ...(hasWin
      ? ['Two quick favors, while this month is fresh.', '', `First, ${t.intro}`, ...t.questions, t.video, t.share, '', `Second, who's one gym owner you'd want to see this work for? ${giftLine(gift)} An email or text with both of us on it is perfect.`, '']
      : []),
    'The one-page report is attached.',
    '',
    sign,
  ].join('\n');

  const tracked = Array.isArray(o.bonuses) && o.bonuses.some((b) => b && /tracking|tracked/i.test(`${b.id || ''} ${b.title || ''}`));
  const dropped = rows.some((r) => ['trials', 'newMembers'].includes(r.key) && r.change < 0);
  const flat = (n.trials === 0 && !(n.newMembers > 0)) || (n.newMembers === 0 && !(n.trials > 0));
  const tips = [];
  // Get ahead of a bad month before the owner reads it cold.
  if (dropped || flat) tips.push('Results dipped this month. Call the owner before you send this: say what you see and what you will change next month. Bad news goes better by phone, good news in writing.');
  if (n.trials == null) tips.push(`Count trial sign-ups next month: ask the front desk to note how each new trial found the gym${tracked ? ', or use the tracked link and QR code from your offer' : ''}. It's the number owners care about most.`);
  else if (n.newMembers == null) tips.push('Ask the owner how many of those trial sign-ups joined. New members is the number that keeps you hired.');
  if (n.newMembers > 0 && n.memberPrice == null) tips.push('Ask what a member pays a month, so the report can show what the new members are worth.');
  if (n.newMembers > 0 && n.memberPrice != null && n.stayMonths == null) tips.push('Ask how long members usually stay, so the report can show what new members are worth over that time.');
  tips.push(hasWin ? 'The email asks for a testimonial and an intro. Ask for the testimonial once: if they have answered before, take that part out.' : 'No clear win this month, so the email skips the testimonial and intro asks. Save them for a month with one.');
  tips.push('Attach the report to the email, or open it and save it as a PDF first.');
  tips.push('Send one of the grow-the-account ideas a few days after the report, not in the same email. Skip any the gym already has.');

  const safeName = g.name.replace(/[\\/:*?"<>|#%\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Gym';
  return deepMap(
    {
      gym: g.name,
      month: mKey,
      monthLabel: monthLabel(mKey),
      headline,
      numbers: typed,
      rows,
      metrics,
      wins,
      roi,
      toDate,
      next,
      asks,
      upsell: upsellFor(g, o, n, nextName, me, biz),
      email: { to: g.email || null, subject, body },
      tips,
      fileName: `${safeName} ${mKey} report.html`,
      // For the page only.
      page: {
        color: g.color,
        from: me && biz && biz !== me ? `${me}, ${biz}` : me || biz || '',
        date: dateLabel(Number.isFinite(now) ? now : Date.now(), tz),
        ask: hasWin ? `Who's one gym owner you'd want to see this work for? ${giftLine(gift)}` : '',
      },
    },
    clean
  );
}

// ---------- the one-page report ----------

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function luminance(hex) {
  const h = hex.length === 4 ? hex.slice(1).split('').map((x) => x + x).join('') : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// One page the owner can read on a phone or print: inline CSS only, no links, fonts or images from
// anywhere else, in the gym's own color when its website has one (text on it in black or white,
// whichever reads better).
function reportHtml(rep) {
  const p = rep.page || {};
  const brand = p.color || '#1f2937';
  const on = luminance(brand) > 0.179 ? '#111111' : '#ffffff';
  const results = rep.rows.filter((r) => r.kind === 'result');
  const tiles = rep.metrics.map((m) => `<div class="tile"><b>${esc(m.value)}</b><span>${esc(m.label)}</span>${m.note ? `<small>${esc(m.note)}</small>` : ''}</div>`).join('\n');
  const table = results.map((r) => `<tr><td>${esc(r.label)}${r.changeWords ? `<small>${esc(r.changeWords)}</small>` : ''}</td><td class="n">${esc(r.display)}</td></tr>`).join('\n');
  const next = rep.next.map((i) => `<li><strong>${esc(i.title)}</strong>${i.hook ? `<small>Opens with: "${esc(i.hook)}"</small>` : ''}${i.why ? `<small>${esc(i.why)}</small>` : ''}</li>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(rep.gym)}, ${esc(rep.monthLabel)} video report</title>
<style>
:root{--brand:${brand};--on-brand:${on};--ink:#16181d;--muted:#5d6370;--line:#e3e5ea;--soft:#f4f5f7}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--soft);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.page{max-width:680px;margin:0 auto;background:#fff;min-height:100vh}
header{background:var(--brand);color:var(--on-brand);padding:28px 20px 24px}
header p{margin:0;font-size:14px;opacity:.85}
header h1{margin:6px 0 4px;font-size:28px;line-height:1.15;overflow-wrap:anywhere}
main{padding:20px}
.headline{font-size:20px;line-height:1.35;font-weight:700;margin:0 0 18px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 6px}
.tile{border:1px solid var(--line);border-top:4px solid var(--brand);border-radius:10px;padding:12px 14px}
.tile b{display:block;font-size:30px;line-height:1.1;font-variant-numeric:tabular-nums}
.tile span{display:block;font-weight:600;font-size:14px;margin-top:4px}
.tile small,td small,li small{display:block;color:var(--muted);font-size:13px;margin-top:2px;font-weight:400}
.roi{background:var(--soft);border-left:4px solid var(--brand);border-radius:8px;padding:14px 16px}
.roi p{margin:0}
h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:26px 0 8px}
table{width:100%;border-collapse:collapse;font-size:15px}
td{text-align:left;padding:9px 4px;border-bottom:1px solid var(--line);vertical-align:top}
td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700;padding-left:12px}
ol{margin:0;padding-left:22px}
li{margin:0 0 10px}
.ask{margin:26px 0 0;padding:14px 16px;border:1px dashed var(--line);border-radius:10px}
.ask p,.empty,.sofar{margin:0}
.sofar{font-weight:600}
footer{padding:16px 20px 28px;font-size:13px;color:var(--muted);border-top:1px solid var(--line)}
@media (max-width:420px){header h1{font-size:24px}.tile b{font-size:26px}}
@media print{body{background:#fff}.page{max-width:none;min-height:0}header,.tile,.roi{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div class="page">
<header>
<p>${esc(rep.monthLabel)} video report</p>
<h1>${esc(rep.gym)}</h1>
${p.from ? `<p>From ${esc(p.from)}</p>` : ''}
</header>
<main>
<p class="headline">${esc(rep.headline)}</p>
${tiles ? `<div class="tiles">\n${tiles}\n</div>` : ''}
${rep.roi ? `<h2>What it's worth</h2>\n<div class="roi"><p>${esc(rep.roi.text)}</p></div>` : ''}
${table ? `<h2>The numbers</h2>\n<table>\n${table}\n</table>` : '<p class="empty">No numbers yet for this month.</p>'}
${rep.toDate ? `<h2>So far</h2>\n<p class="sofar">${esc(rep.toDate.text)}</p>` : ''}
${next ? `<h2>Next month</h2>\n<ol>\n${next}\n</ol>` : ''}
${p.ask ? `<div class="ask"><p>${esc(p.ask)}</p></div>` : ''}
</main>
<footer>Prepared by ${esc(p.from || 'your video editor')}${p.date ? `${/,/.test(p.from || '') ? ',' : ''} on ${esc(p.date)}` : ''}.</footer>
</div>
</body>
</html>
`;
}

// ---------- memory: last month's numbers, so the next report shows the change ----------

// One key per gym, so reports for several gyms running at once never overwrite each other.
function memoryKey(g) {
  return `proof_${slug(`${g.name} ${g.city}`).replace(/-/g, '_')}`;
}

// mem: { gym, months: { 'YYYY-MM': numbers }, ideas: { 'YYYY-MM': [titles] } }
function latestBefore(map, mKey) {
  const obj = map && typeof map === 'object' ? map : {};
  const keys = Object.keys(obj).filter((k) => /^\d{4}-\d{2}$/.test(k) && k < mKey).sort();
  return keys[keys.length - 1] || null;
}

// The newest month before this one with numbers, and the ideas suggested last time.
function lastBefore(mem, mKey) {
  const m = mem && typeof mem === 'object' ? mem : {};
  const k = latestBefore(m.months, mKey);
  const ik = latestBefore(m.ideas, mKey);
  return {
    month: k,
    numbers: k ? cleanNumbers(m.months[k]) : {},
    ideas: ik && Array.isArray(m.ideas[ik]) ? m.ideas[ik].filter((t) => typeof t === 'string') : [],
  };
}

// The last 12 months are plenty for a change line, next month's ideas and a case study.
function rememberMonth(mem, mKey, numbers, gymName, ideas = []) {
  const m = mem && typeof mem === 'object' ? mem : {};
  const last12 = (obj) => {
    const keep = Object.keys(obj).filter((k) => /^\d{4}-\d{2}$/.test(k)).sort().slice(-12);
    return Object.fromEntries(keep.map((k) => [k, obj[k]]));
  };
  const months = { ...(m.months || {}) };
  if (Object.keys(numbers || {}).length) months[mKey] = numbers;
  const titles = { ...(m.ideas || {}) };
  if (ideas.length) titles[mKey] = ideas;
  return { gym: gymName, months: last12(months), ideas: last12(titles) };
}

// ---------- the case study ----------

// Where the gym started, from the gaps we found before the pitch: one short sentence each. Not the
// evidence lines, which carry the gym's name and handle, and not "pays for ads", a guess from a pixel.
const BEFORE = {
  'site-video': 'There was no video on their website.',
  quiet: 'Their Instagram had gone quiet.',
  reels: 'Their posts were mostly photos, with few Reels.',
  offer: 'Their intro offer only lived as text on their site.',
  tiktok: "They weren't on TikTok.",
  stories: 'Their site had no member stories.',
  coaches: 'Their coaches were names on a page, with no videos.',
  engagement: 'They had followers, but posts got few likes and comments.',
};

// "Last month" only while it's true; otherwise the month by name.
function whenRelative(mKey, span, now, tz) {
  const t = partsIn(Number.isFinite(now) ? now : Date.now(), tz);
  const cur = keyOf(t.y, t.m);
  const recent = mKey === cur || mKey === shiftMonth(cur, -1);
  if (span > 1) return recent ? `Over the last ${span} months` : `Over ${span} months`;
  if (mKey === cur) return 'This month';
  if (mKey === shiftMonth(cur, -1)) return 'Last month';
  return `In ${monthName(mKey)}${mKey.slice(0, 4) !== cur.slice(0, 4) ? ` ${mKey.slice(0, 4)}` : ''}`;
}

// args: { row, numbers, permission: 'named' | 'anonymous', quote, month, months, offer, now, tz, freeMonth }
// freeMonth: the gym was one of the free-first-month case studies.
function caseStudy(args = {}) {
  const { row, numbers, permission = 'anonymous', quote, month, months, offer, now, tz, freeMonth = false } = args;
  const g = gymOf(row);
  if (!g.name) throw new Error('Pick a gym first.');
  const named = permission === 'named';
  const o = offer && typeof offer === 'object' ? offer : {};
  const n = cleanNumbers(numbers);
  const span = Math.max(1, Math.min(36, Math.round(num(months) || 1)));
  const mKey = monthKey(month, now, tz);
  const startKey = shiftMonth(mKey, 1 - span);
  const period = span > 1 ? `Over ${span} months, from ${startKey.slice(0, 4) === mKey.slice(0, 4) ? monthName(startKey) : monthLabel(startKey)} to ${monthLabel(mKey)}` : `In ${monthLabel(mKey)}`;
  const inSpan = span > 1 ? `in ${span} months` : 'in one month';
  const who = whoFor(g, named);
  const gain = n.followersStart != null && n.followersEnd != null ? n.followersEnd - n.followersStart : null;
  const ids = identifiers(g);
  const q = quote ? cleanQuote(named ? quote : scrub(clean(quote), ids, true)) : null;
  const people = peopleParts(n);
  const hasResults = people.length > 0 || n.views > 0 || gain > 0 || n.profileVisits > 0 || n.linkClicks > 0;

  const made = n.reelsPosted > 0 ? `I made ${plural(n.reelsPosted, 'Reel')} for` : 'I made short videos for';
  const viewsLine = n.views > 0 ? `The videos got ${plural(n.views, 'view')}${gain > 0 ? `, and followers went from ${count(n.followersStart)} to ${count(n.followersEnd)}` : ''}.` : gain > 0 ? `Followers went from ${count(n.followersStart)} to ${count(n.followersEnd)}.` : '';
  const peopleLine = people.length ? `They had ${joinAnd(people)} from the videos.` : '';
  const extraLine = n.profileVisits > 0 || n.linkClicks > 0 ? `They also had ${joinAnd([n.profileVisits > 0 && plural(n.profileVisits, 'profile visit'), n.linkClicks > 0 && plural(n.linkClicks, 'link click')])}.` : '';

  // Named quotes are credited the 127 way: first name and last initial, then their role.
  let credit = 'the owner';
  if (named) {
    const owner = g.owner;
    const parts = owner ? owner.name.split(/\s+/) : [];
    const short = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.` : parts[0];
    credit = owner ? `${short}, ${owner.role} ${/owner/i.test(owner.role) ? 'of' : 'at'} ${g.name}` : `the owner of ${g.name}`;
  }
  const quoteLine = q ? `"${q}" (${credit})` : '';
  // The free month is a material connection (FTC Endorsement Guides, 16 CFR 255.5, Legal L55): wherever
  // this story or the owner's words are shown, the line goes with them.
  const disclosure = freeMonth ? `${cap(who)} got their first month free as one of my case studies.` : null;

  const shortParts = [`${period}, ${made} ${who}.`, peopleLine || viewsLine];
  if (q && q.length <= 160) shortParts.push(`In the owner's words: "${q}"`);
  else if (peopleLine && viewsLine) shortParts.push(viewsLine);
  if (disclosure) shortParts.push(disclosure);

  const befores = g.gaps.map((x) => BEFORE[x.id]).filter(Boolean).slice(0, 3);
  if (befores.length) befores[0] = `Before we started, ${lowerFirst(befores[0])}`;
  const long = [
    [`${cap(who)} started working with me${o.name ? ` on ${clean(o.name)}` : ''}.`, ...befores].join(' '),
    `${period}, ${made} them.`,
    [peopleLine, viewsLine, extraLine].filter(Boolean).join(' '),
    quoteLine,
    disclosure,
    hasResults ? "These are one gym's results. Every gym is different." : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  // A post for the member's own account: the result first, one line on the work, then a soft ask to
  // other gym owners. Proof that brings in the next client.
  const results = [
    n.trials > 0 && plural(n.trials, 'trial sign-up'),
    n.newMembers > 0 && plural(n.newMembers, 'new member'),
    n.views > 0 && plural(n.views, 'view'),
    gain > 0 && `Followers from ${count(n.followersStart)} to ${count(n.followersEnd)}`,
  ].filter(Boolean);
  const post = results.length
    ? [
        `What ${span > 1 ? `${span} months` : 'one month'} of Reels did for ${who}:`,
        '',
        ...results,
        '',
        [befores[0], `${cap(made)} them${o.name ? `, as part of ${clean(o.name)}` : ''}.`].filter(Boolean).join(' '),
        ...(q && q.length <= 220 ? ['', `In the owner's words: "${q}"`] : []),
        ...(disclosure ? ['', disclosure] : []),
        '',
        "One gym's results. Every gym is different.",
        'Run a gym and want a plan like this for yours? Send me a message.',
      ].join('\n')
    : null;

  const rel = whenRelative(mKey, span, now, tz);
  let dmLine = null;
  if (people.length) dmLine = `${rel}, I helped ${who} get ${joinAnd(people)} from Reels.`;
  else if (n.views > 0) dmLine = `${rel}, my Reels for ${who} got ${plural(n.views, 'view')}.`;
  else if (gain > 0) dmLine = `${rel}, I helped ${who} grow from ${count(n.followersStart)} to ${count(n.followersEnd)} followers with Reels.`;

  const proofPoints = [];
  if (n.trials > 0) proofPoints.push(`${plural(n.trials, 'trial sign-up')} from Reels ${inSpan}, for ${who}.`);
  if (n.newMembers > 0) proofPoints.push(`${plural(n.newMembers, 'new member')} from Reels ${inSpan}, for ${who}.`);
  if (n.views > 0) proofPoints.push(`${plural(n.views, 'view')}${n.reelsPosted > 0 ? ` on ${plural(n.reelsPosted, 'Reel')}` : ''} ${inSpan}, for ${who}.`);
  if (gain > 0) proofPoints.push(`Followers up from ${count(n.followersStart)} to ${count(n.followersEnd)} ${inSpan}, for ${who}.`);
  if (n.profileVisits > 0) proofPoints.push(`${plural(n.profileVisits, 'profile visit')} ${inSpan}, for ${who}.`);
  if (n.linkClicks > 0) proofPoints.push(`${plural(n.linkClicks, 'link click')} ${inSpan}, for ${who}.`);
  if (!proofPoints.length && n.reelsPosted > 0) proofPoints.push(`${plural(n.reelsPosted, 'Reel')} made and posted ${inSpan}, for ${who}.`);

  const rules = [
    'Only use numbers the gym gave you.',
    'Name the gym only with its written OK.',
    named ? "Keep the owner's written OK (their email or text) with this case study." : 'Until then, keep it anonymous: no name, logo, photos of the gym, street or anything else that gives it away.',
    q ? "Use the owner's words exactly as they wrote them. Fix typos only." : "Want a quote? Send the testimonial questions from the monthly report and use the owner's words exactly.",
    'Leave money out of public proof: sign-ups and members are the result, what they are worth stays in the private report.',
    "Say it was one gym's result. Don't promise another gym the same numbers.",
    'Never ask a client for a Google, Yelp or Facebook review in return for anything, a free month included.',
  ];
  if (disclosure) rules.push(`They got their first month free, so say so wherever you show their words or this story, public posts and proposals included: "${disclosure}"`);
  if (!named && g.city) rules.push(`If it's the only ${g.label} in ${g.city}, leave the city out too.`);
  if (!named) rules.push('A named story is stronger proof. If the owner is happy to be named, get it in writing and run this again with "named".');
  if (named) rules.push('Show the owner the long version before you post it.');
  if (named && q && g.owner) rules.push(`The quote is credited to ${credit}. Check they're happy with that.`);

  const note = hasResults ? '' : 'No results given yet, so this only says what you made. Add trial sign-ups, new members or views and run it again.';
  // Public proof carries no money, so the price and stay the report used stay out of it too.
  const { memberPrice, stayMonths, ...shown } = n;
  const out = { permission: named ? 'named' : 'anonymous', who, month: mKey, numbers: shown, short: shortParts.filter(Boolean).join(' '), long, post, dmLine, proofPoints, rules, note, disclosure };
  // Anonymous means anonymous: sweep every line for the gym's name, site, handle and people.
  return deepMap(out, (s) => clean(named ? s : scrub(s, ids)));
}

// ---------- the proof bank: public-safe lines for follow-ups, calls and proposals ----------

// brain.packs.gym.proof_bank: newest first, one entry per gym and kind. Ids are hashes, so the bank
// never carries an anonymous gym's name. Kept under the 4 KB a memory key can hold.
const bankId = (g, kind = '') => require('crypto').createHash('sha1').update(memoryKey(g)).digest('hex').slice(0, 10) + (kind ? `-${kind}` : '');

function bankWith(bank, entry) {
  const out = (Array.isArray(bank) ? bank : []).filter((p) => p && p.id !== entry.id);
  out.unshift(entry);
  out.length = Math.min(out.length, 12);
  while (out.length > 1 && JSON.stringify(out).length > 3800) out.pop();
  return out;
}

// Up to `max` lines, one per gym, newest first: each entry's first proof point (they carry no
// "last month", so they stay true later). Never for a first message.
function proofFor(bank, { max = 2 } = {}) {
  const seen = new Set();
  const lines = [];
  for (const p of Array.isArray(bank) ? bank : []) {
    const gymId = p && typeof p.id === 'string' ? p.id.split('-')[0] : null;
    const line = p && Array.isArray(p.proofPoints) ? p.proofPoints.find((x) => typeof x === 'string' && x.trim()) : null;
    if (!gymId || !line || seen.has(gymId)) continue;
    seen.add(gymId);
    lines.push(line.trim());
    if (lines.length >= max) break;
  }
  return lines;
}

module.exports = {
  monthlyReport,
  caseStudy,
  bankId,
  bankWith,
  proofFor,
  reportHtml,
  gymOf,
  whoFor,
  cleanNumbers,
  identifiers,
  scrub,
  monthKey,
  monthLabel,
  shiftMonth,
  memoryKey,
  lastBefore,
  rememberMonth,
  sumMonths,
  count,
  dollars,
  NUMBERS_INPUT,
  FIELDS,
};
