// The wall (Eli Oct 21, "a shared wall of member wins and sites, opt-in"): sites members shipped and wins they chose
// to show, on one public page (/wall), and the same entries for the Day One Challenge's wall of shipped sites
// (publicList({ kind: 'site', source: 'challenge' })). One store for both. A Challenge entry may come from someone with
// no account yet: it keeps the email they entered with, and link() ties it to their account once they have one.
//
// Nothing shows without three things: the member's own yes to the exact words below (kept with its version and when,
// like Wins), an admin's approval of that entry, and WALL=on. The words are a draft until Legal gives the release
// words (legal/06 Part C; ask N6 in v2/hq-nudges/LEGAL-ASKS.md), so WALL stays off until then. Every surface carries
// the typicality line, no amounts are asked for or shown, and removing an entry takes it down at once.

const deps = { db: require('./db'), now: () => Date.now() };
const { clip } = require('./harness/text');

const COL = 'wall';
const KINDS = { site: 'A site I shipped', win: 'A win' };
const CONSENT = {
  first: 'Show this on 127\'s public wall with my first name only.',
  public: 'Show this on 127\'s public wall with my name and my business name.',
};
// 'draft' until Legal's words land; a change to the words gets a new version.
const CONSENT_VERSION = 'draft-2026-10-21';
const TYPICALITY = "One person's real numbers. Yours will differ. No results promised.";
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
    consentText: CONSENT[body.consent],
    consentVersion: CONSENT_VERSION,
    consentAt: now,
    status: 'pending',
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

// Admins: everything waiting or shown, with the consent record.
function review() {
  return deps.db.filter(COL, () => true).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
async function setStatus(id, status, by) {
  const e = deps.db.get(COL, String(id || ''));
  if (!e || !STATUSES.includes(status)) return null;
  if (status === 'shown' && looksPrivate(e.url)) throw err('That address looks like a private preview. Ask the member for the live address first.');
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
    .map((e) => ({ id: e.id, kind: e.kind, url: e.url, title: e.title, note: e.note, by: e.consent === 'public' ? [e.firstName, e.business].filter(Boolean).join(', ') : e.firstName }));
}

// Challenge entries made before an account existed join it once the same email signs up.
async function link(email, memberId) {
  const e0 = String(email || '').trim().toLowerCase();
  if (!e0 || !memberId) return 0;
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
async function forget(memberId, email) {
  const e0 = String(email || '').trim().toLowerCase();
  for (const e of deps.db.filter(COL, (x) => (memberId && x.memberId === memberId) || (e0 && x.email === e0))) await deps.db.remove(COL, e.id);
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { on, KINDS, CONSENT, CONSENT_VERSION, TYPICALITY, submit, remove, mine, review, setStatus, publicList, cleanUrl, looksPrivate, link, forget, _setDeps };
