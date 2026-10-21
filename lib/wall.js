// The wall (Eli Oct 21, "a shared wall of member wins and sites, opt-in"): sites members shipped and wins they chose
// to show, on one public page (/wall), and the same entries for the Day One Challenge's wall of shipped sites
// (publicList({ kind: 'site', source: 'challenge' })). One store for both. A Challenge entry may come from someone with
// no account yet: it keeps the email they entered with, and link() ties it to their account once they have one.
//
// Nothing shows without three things: the member's own tick of Legal's release words (RELEASE, L98 NU19, kept with
// its version and when, like Wins), an admin's approval of that entry, and WALL=on. Every surface carries LINE (NU20),
// no amounts are asked for or shown, and removing an entry takes it down at once.
// - Sites can show now. A win is only something the member did or made; outcome wins (replies, yeses, clients) wait
//   until 127 shows what members generally get (NU21, legal/06 A3), so submit() refuses them.
// - Admins approve every entry that meets RULES, not only the best ones (NU22). A member's connection with 127 shows
//   on the admin page and its 06 A4 line goes on the entry (NU23).
// - Links carry rel="ugc nofollow" and every entry has a Report link (NU24).
// - A Challenge entry with no account is kept by its email, joins an account only once that email is verified, and is
//   deleted 12 months after it was made if it never joined one (NU25, sweep()).

const deps = { db: require('./db'), now: () => Date.now() };
const { clip } = require('./harness/text');

const COL = 'wall';
const KINDS = { site: 'A site I shipped', win: 'A win' };
// The name choice inside the release box.
const CONSENT = {
  first: 'my first name only',
  public: 'my first name and business name',
};
// Legal L98 NU19, word for word. A change to the words gets a new version; each entry keeps the text it was given.
const CONSENT_VERSION = 'wall-v1-2026-10-21';
const RELEASE = {
  head: "Show this on 127's public wall.",
  lead: "It's mine and it's true, and I'm 18 or older. 127 may show it at 127group.io/wall with",
  tail: "and link to the address I gave. 127 may shorten what I wrote but won't change what I meant, and won't use AI to change it. No money amounts.",
  small: "The wall is public, so anyone can see and share it. Take it down anytime from Progress, or by emailing hello@127group.io from the email you used, and it comes off the wall right away. We can't recall copies others already made. We won't use it anywhere else, like ads or posts, without asking you again.",
};
RELEASE.body = (choice) => `${RELEASE.lead} ${choice ? `(x) ${CONSENT[choice]}` : `( ) ${CONSENT.first} ( ) ${CONSENT.public}`}, ${RELEASE.tail}`;
const releaseText = (choice) => `${RELEASE.head} ${RELEASE.body(choice)} ${RELEASE.small}`;
// NU20: on /wall, the opt-in, the admin page and any share image.
const LINE = "Shared by members who chose to. They aren't a sample of everyone's results, and yours will differ. No results promised.";
// Kept for older callers; the wall itself uses LINE.
const TYPICALITY = LINE;
// NU22: the posted rules every entry is checked against (shown on /admin/wall).
const RULES = [
  "It's theirs and it's true.",
  'No money.',
  'No private links.',
  'Nothing against the law or the community guidelines.',
  "No one else's private details, and no client names (Terms 13C).",
  "The link goes to the member's own site.",
];
// NU23: a member's connection with 127 and the line from legal/06 A4 that goes on their entry.
const CONNECTIONS = {
  free: { name: 'Free access or a free month', line: '127 gave me free access to try it.' },
  staff: { name: 'Works with 127', line: 'I work with 127.' },
  friend: { name: "Friend of Eli's", line: "I'm a friend of Eli's." },
  family: { name: 'Related to Eli', line: "I'm related to Eli." },
  five: { name: 'Founding Five', line: (first) => `${first || 'This member'} is one of the Founding Five: 127 gave them four group sessions with Eli for sharing their build.` },
  builder: { name: 'Public builder', line: "Ad · I'm working with 127." },
  ambassador: { name: 'Creator ambassador', line: "#ad I'm a paid ambassador for @buildwith127." },
};
const REPORT_TO = 'hello@127group.io';
const UNLINKED_KEEP_MS = 365 * 24 * 36e5;
// NU21: a win is something the member did or made. Words that describe an outcome wait for 06 A3's numbers.
const OUTCOME = /\b(got|landed|won|closed|signed|booked)\s+(my\s+|a\s+|an\s+|the\s+|\d+\s+)?(first\s+)?(sale|client|customer|lead|deal|order|booking|call|reply|yes|subscriber|follower)s?\b|\b\d[\d,.]*\s*k?\s+(repl(y|ies)|clients?|customers?|sales|leads?|followers?|views|subscribers?|yeses|calls?|orders?|bookings?|signups?|sign-ups?)\b|\b(first|1st)\s+(sale|client|customer|paying|yes|lead|order|booking|reply)\b|\b(revenue|profit|income)\b|\bsaid yes\b|\bwrote back\b/i;
const MAX_PER_MEMBER = 12;
const STATUSES = ['pending', 'shown', 'hidden'];

const on = () => String(process.env.WALL || '').trim().toLowerCase() === 'on';
const iso = () => new Date(deps.now()).toISOString();
const err = (m) => Object.assign(new Error(m), { status: 400 });

function cleanUrl(u) {
  let s = String(u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const x = new URL(s);
    if (!/^https?:$/.test(x.protocol) || !/\.[a-z]{2,}$/i.test(x.hostname) || x.username || x.password) return '';
    return x.toString().slice(0, 300);
  } catch {
    return '';
  }
}

// A private preview (a Netlify deploy preview, a draft link, a token in the address) must never go on a public wall.
// Admin review sees this flag, and approving such an entry is refused.
function looksPrivate(url) {
  const s = String(url || '').toLowerCase();
  return /deploy-preview-|--[a-z0-9-]+\.netlify\.app|^[^/]*\/\/[a-f0-9]{20,}--|localhost|127\.0\.0\.1|\/preview\b|[?&](token|key|secret|preview|share)=/.test(s);
}

function mine(memberId) {
  return deps.db.filter(COL, (e) => e.memberId === memberId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// who: a member ({ id, name }) or, from the Challenge, { email, firstName, business }. body: { kind, url, title, note,
// consent, source }. A new entry waits for an admin.
async function submit(who, body = {}) {
  const user = who && who.id ? who : null;
  const email = !user ? String((who && who.email) || '').trim().toLowerCase().slice(0, 200) : '';
  if (!user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw err('Sign in, or give the email you joined with.');
  const kind = KINDS[body.kind] ? body.kind : null;
  if (!kind) throw err('Pick a site or a win.');
  if (!CONSENT[body.consent]) throw err('Pick how your name shows.');
  const url = kind === 'site' ? cleanUrl(body.url) : '';
  if (kind === 'site' && !url) throw err('Paste the address of your site, like maya-tutoring.com.');
  const title = clip(body.title || '', 80);
  if (!title) throw err(kind === 'site' ? 'Name the site, like "Maya Tutoring".' : 'Say what happened in a few words.');
  const count = user ? mine(user.id).length : deps.db.filter(COL, (e) => !e.memberId && e.email === email).length;
  if (count >= MAX_PER_MEMBER) throw err(`You can have ${MAX_PER_MEMBER} things on the wall. Remove one first.`);
  if (/\$\s?\d|\b\d[\d,.]*\s?(k|dollars|usd)\b/i.test(`${title} ${body.note || ''}`)) throw err('Leave amounts out. The wall shows what you made, not money.');
  if (kind === 'win' && OUTCOME.test(`${title} ${body.note || ''}`)) throw err('For now a win on the wall is something you did or made, like "Posted every day this week" or "Wrote my first offer". Results like replies or clients come later.');
  if (body.agree !== true && body.agree !== '1' && body.agree !== 'on') throw err("Tick the box to say it's yours, it's true and you're 18 or older.");
  const brain = (user && deps.db.get('brains', user.id)) || {};
  const name = user ? user.name : who.firstName;
  const now = iso();
  return deps.db.save(COL, {
    memberId: user ? user.id : null,
    email: user ? '' : email,
    kind,
    url,
    private: looksPrivate(url),
    title,
    note: clip(body.note || '', 200),
    firstName: name ? String(name).trim().split(/\s+/)[0].slice(0, 40) : '',
    business: clip((brain.business && brain.business.name) || (!user && who.business) || '', 120),
    consent: body.consent,
    consentText: releaseText(body.consent),
    consentVersion: CONSENT_VERSION,
    consentAt: now,
    status: 'pending',
    connection: user ? autoConnection(user) : null,
    source: body.source === 'challenge' ? 'challenge' : 'hq',
    createdAt: now,
  });
}

async function remove(user, id) {
  const e = deps.db.get(COL, String(id || ''));
  if (!e || e.memberId !== user.id) return false;
  await deps.db.remove(COL, e.id);
  return true;
}

// What 127 can tell on its own: staff (ADMIN_EMAILS) and the Founding Five. Anything else an admin sets on the entry.
function autoConnection(user) {
  const admins = String(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  if (user.email && admins.includes(String(user.email).toLowerCase())) return 'staff';
  try {
    const ff = require('./founding-five');
    if (deps.db.find('foundingFive', (a) => a.userId === user.id && ff.isFive(a))) return 'five';
  } catch {
    /* no Founding Five store */
  }
  return null;
}
function connectionLine(e) {
  const c = e && CONNECTIONS[e.connection];
  if (!c) return '';
  return typeof c.line === 'function' ? c.line(e.firstName) : c.line;
}
async function setConnection(id, key) {
  const e = deps.db.get(COL, String(id || ''));
  if (!e) return null;
  e.connection = CONNECTIONS[key] ? key : null;
  return deps.db.save(COL, e);
}

// Admins: everything waiting or shown, with the consent record and the connection line.
function review() {
  return deps.db.filter(COL, () => true).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((e) => ({ ...e, connectionLine: connectionLine(e) }));
}
async function setStatus(id, status, by) {
  const e = deps.db.get(COL, String(id || ''));
  if (!e || !STATUSES.includes(status)) return null;
  if (status === 'shown' && looksPrivate(e.url)) throw err('That address looks like a private preview. Ask the member for the live address first.');
  if (status === 'shown' && e.kind === 'win' && OUTCOME.test(`${e.title} ${e.note || ''}`)) throw err('Outcome wins wait until the wall shows what members generally get (legal/06 A3).');
  e.status = status;
  e.reviewedAt = iso();
  e.reviewedBy = String(by || '').slice(0, 120);
  return deps.db.save(COL, e);
}

// What the public sees: approved entries only, named the way the member agreed.
function publicList({ kind, limit = 60, source } = {}) {
  if (!on()) return [];
  return deps.db
    .filter(COL, (e) => e.status === 'shown' && (!kind || e.kind === kind) && (!source || e.source === source))
    .sort((a, b) => String(b.reviewedAt || b.createdAt).localeCompare(String(a.reviewedAt || a.createdAt)))
    .slice(0, limit)
    .map((e) => ({ id: e.id, kind: e.kind, url: e.url, title: e.title, note: e.note, by: e.consent === 'public' ? [e.firstName, e.business].filter(Boolean).join(', ') : e.firstName, connection: connectionLine(e), report: reportHref(e) }));
}

function reportHref(e) {
  return `mailto:${REPORT_TO}?subject=${encodeURIComponent(`Report a wall entry (${e.id})`)}&body=${encodeURIComponent(`Entry: ${e.title}${e.url ? `\n${e.url}` : ''}\n\nWhat's wrong:\n`)}`;
}

// Challenge entries made before an account existed join it once the same email signs up and is verified (NU25).
// user: the account ({ id, email, emailVerified }).
async function link(user) {
  if (!user || !user.id || user.emailVerified !== true) return 0;
  const e0 = String(user.email || '').trim().toLowerCase();
  const memberId = user.id;
  if (!e0) return 0;
  let n = 0;
  for (const e of deps.db.filter(COL, (x) => !x.memberId && x.email === e0)) {
    e.memberId = memberId;
    e.email = '';
    await deps.db.save(COL, e);
    n += 1;
  }
  return n;
}

// Account deletion (and a Challenge entrant asking to be forgotten, by email).
// Entries never tied to an account go 12 months after they were made (Privacy Section 9). Run daily.
async function sweep(now = deps.now()) {
  const old = deps.db.filter(COL, (e) => !e.memberId && now - Date.parse(e.createdAt) > UNLINKED_KEEP_MS);
  for (const e of old) await deps.db.remove(COL, e.id);
  return old.length;
}

async function forget(memberId, email) {
  const e0 = String(email || '').trim().toLowerCase();
  for (const e of deps.db.filter(COL, (x) => (memberId && x.memberId === memberId) || (e0 && x.email === e0))) await deps.db.remove(COL, e.id);
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { on, KINDS, CONSENT, CONSENT_VERSION, RELEASE, releaseText, LINE, TYPICALITY, RULES, CONNECTIONS, REPORT_TO, submit, remove, mine, review, setStatus, setConnection, connectionLine, publicList, cleanUrl, looksPrivate, link, sweep, forget, _setDeps };
