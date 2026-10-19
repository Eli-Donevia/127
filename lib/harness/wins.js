// Wins in HQ v2 (v2/hormozi-playbook.md 1.7 and 1.8): a member logs a first conversation, a first
// yes or a first paying client (activation a5), and says what 127 may do with it: keep it private,
// share it with their first name only, or share it publicly. Each win keeps its consent record (the
// exact words they agreed to, the version and when), so proof only ever shows with that record, and
// nothing goes into marketing until Legal's checklist passes. No amounts are asked for or shown.
// The moment a member logs their first win is when HQ shows the Founder's Circle, once.

const deps = { db: require('../db'), now: () => Date.now(), emit: () => {} };
const activation = require('./activation');
const pipeline = require('./pipeline');
const { clip } = require('./text');

const KINDS = {
  talk: { label: 'A real conversation', card: 'First real conversation' },
  yes: { label: 'Someone said yes', card: 'First yes' },
  paid: { label: 'A client paid', card: 'First paying client' },
};
// The exact words a member agrees to. A change to these words gets a new version.
const CONSENT = {
  private: 'Keep it private. Only I see it.',
  first: '127 may share this win with my first name only.',
  public: '127 may share this win with my name and my business name.',
};
const CONSENT_VERSION = '2026-10-19';
const MAX_PER_MEMBER = 500;

const iso = () => new Date(deps.now()).toISOString();
const firstNameOf = (user) => (user && user.name ? String(user.name).trim().split(/\s+/)[0].slice(0, 40) : '');

function list(memberId) {
  return deps.db.filter('proof', (w) => w.memberId === memberId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function get(memberId, id) {
  const w = deps.db.get('proof', String(id || ''));
  return w && w.memberId === memberId ? w : null;
}

// { lead, kind, note, consent }. Returns { win, first } (first: the member's first win ever).
async function log(user, { lead, kind, note, consent } = {}) {
  if (!KINDS[kind]) throw Object.assign(new Error('Pick what happened.'), { status: 400 });
  if (!CONSENT[consent]) throw Object.assign(new Error('Pick who can see it.'), { status: 400 });
  const mine = list(user.id);
  if (mine.length >= MAX_PER_MEMBER) throw Object.assign(new Error("You've logged a lot of wins. Delete some old ones first."), { status: 400 });
  const l = lead ? pipeline.get(user.id, String(lead)) : null;
  const brain = deps.db.get('brains', user.id) || {};
  const now = iso();
  const win = await deps.db.save('proof', {
    memberId: user.id,
    leadId: l ? l.id : null,
    leadName: l ? clip(l.name || l.company || '', 120) : '',
    kind,
    note: clip(note || '', 280),
    consent,
    consentText: CONSENT[consent],
    consentVersion: CONSENT_VERSION,
    consentAt: now,
    consentLog: [{ at: now, consent, text: CONSENT[consent], version: CONSENT_VERSION }],
    firstName: firstNameOf(user),
    business: clip((brain.business && brain.business.name) || '', 120),
  });
  await activation.mark(user.id, 'a5');
  try {
    deps.emit('hq.win', { userId: user.id, kind, consent });
  } catch {
    /* analytics is best-effort */
  }
  return { win, first: mine.length === 0 };
}

async function setConsent(user, id, consent) {
  const w = get(user.id, id);
  if (!w) return null;
  if (!CONSENT[consent]) throw Object.assign(new Error('Pick who can see it.'), { status: 400 });
  if (w.consent !== consent) {
    const now = iso();
    w.consent = consent;
    w.consentText = CONSENT[consent];
    w.consentVersion = CONSENT_VERSION;
    w.consentAt = now;
    w.consentLog = (w.consentLog || []).concat({ at: now, consent, text: CONSENT[consent], version: CONSENT_VERSION }).slice(-20);
    await deps.db.save('proof', w);
  }
  return w;
}

async function remove(user, id) {
  const w = get(user.id, id);
  if (!w) return false;
  await deps.db.remove('proof', w.id);
  return true;
}

// The proof library for admins: only wins a member agreed to share, named the way they agreed.
function library() {
  return deps.db
    .filter('proof', (w) => w.consent === 'first' || w.consent === 'public')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((w) => ({
      id: w.id,
      kind: w.kind,
      what: KINDS[w.kind] ? KINDS[w.kind].card : w.kind,
      note: w.note,
      name: w.consent === 'public' ? [w.firstName, w.business].filter(Boolean).join(', ') : w.firstName,
      consent: w.consent,
      consentText: w.consentText,
      consentVersion: w.consentVersion,
      consentAt: w.consentAt,
      createdAt: w.createdAt,
    }));
}

// An offer shown at a win (the Circle), once per member, ever. Kept on the brain doc.
function offerSeen(memberId, key) {
  const d = deps.db.get('brains', memberId);
  return !!(d && d.offers && d.offers[key]);
}

async function markOffer(memberId, key) {
  const d = deps.db.get('brains', memberId) || { id: memberId, business: {}, voice: {}, links: {}, goal: {}, packs: {} };
  d.offers = d.offers || {};
  if (d.offers[key]) return false;
  d.offers[key] = iso();
  await deps.db.save('brains', d);
  return true;
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { KINDS, CONSENT, CONSENT_VERSION, list, get, log, setConsent, remove, library, offerSeen, markOffer, _setDeps };
