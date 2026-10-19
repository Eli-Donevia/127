// The business brain: one read-only snapshot of what 127 knows about a member's business, handed
// to every tool as ctx.brain. It merges what the member wrote in Settings (the `brains` doc), their
// onboarding answers, their Circle profile, their HQ numbers, and what packs learned
// (ctx.remember). Every field can be missing.

const deps = { db: require('../db'), now: () => Date.now() };
const { clip } = require('./text');

let onboarding = null;
function labelOf(q, value) {
  if (!onboarding) {
    try {
      onboarding = require('../../content/onboarding.json');
    } catch {
      onboarding = { questions: [] }; // the harness copied outside the site (pack authors' CLI)
    }
  }
  const question = onboarding.questions.find((x) => x.id === q);
  const opt = question && (question.options || []).find((o) => o.value === value);
  return opt ? opt.label : value || '';
}

const ZONES = { 'Eastern (ET)': 'America/New_York', 'Central (CT)': 'America/Chicago', 'Mountain (MT)': 'America/Denver', 'Pacific (PT)': 'America/Los_Angeles', 'Alaska (AKT)': 'America/Anchorage', 'Hawaii (HT)': 'Pacific/Honolulu' };

const FIELDS = {
  // address: the mailing address every sales email ends with (US CAN-SPAM, Legal L55).
  business: ['name', 'what', 'niche', 'offer', 'price', 'audience', 'city', 'region', 'country', 'timezone', 'stage', 'address'],
  voice: ['tone', 'avoid'],
  links: ['website', 'instagram', 'tiktok', 'youtube', 'booking'],
  goal: ['northNumber', 'buildTarget', 'daily'],
};
const MAX_PACK_KEYS = 50;
const MAX_PACK_VALUE = 4000;

function docOf(userId) {
  return deps.db.get('brains', userId) || { id: userId, business: {}, voice: {}, links: {}, goal: {}, packs: {} };
}

function hqNumbers(user) {
  if (!user || !user.hq) return { northNumber: '', numbers: [] };
  let hq;
  try {
    hq = require('../hq');
  } catch {
    return { northNumber: '', numbers: [] };
  }
  const north = hq.metricDef(user, hq.northId(user));
  const end = hq.weekKey(deps.now());
  const numbers = [];
  for (const m of hq.metrics(user)) {
    for (const p of hq.series(user, m.id, end, 4)) if (p.v !== null && p.v !== undefined) numbers.push({ week: p.key, label: m.label, value: p.v });
  }
  return { northNumber: north ? north.label : '', numbers: numbers.slice(-40) };
}

function firstName(user) {
  return user && user.name ? String(user.name).trim().split(/\s+/)[0].slice(0, 40) : '';
}

function snapshot(user) {
  const d = docOf(user.id);
  const a = user.answers || {};
  const circle = (user.circle && user.circle.profile) || {};
  const nums = hqNumbers(user);
  const business = { ...d.business };
  if (!business.what && circle.building) business.what = circle.building;
  if (!business.audience && circle.forWho) business.audience = circle.forWho;
  if (!business.stage) business.stage = labelOf('stage', a.stage) || '';
  if (!business.niche && a.model) business.niche = labelOf('model', a.model);
  if (!business.timezone && ZONES[circle.timezone]) business.timezone = ZONES[circle.timezone];
  const goal = { ...d.goal };
  if (!goal.northNumber) goal.northNumber = circle.northLabel || nums.northNumber || '';
  if (!goal.buildTarget && circle.buildTarget) goal.buildTarget = circle.buildTarget;
  const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return {
    business: strip(business),
    voice: strip({ ...d.voice }),
    links: strip({ ...d.links }),
    goal: strip(goal),
    numbers: nums.numbers,
    packs: JSON.parse(JSON.stringify(d.packs || {})),
  };
}

// Settings: the member edits business, voice, links and goal.
async function update(user, patch = {}) {
  const d = docOf(user.id);
  for (const [group, keys] of Object.entries(FIELDS)) {
    if (!patch[group] || typeof patch[group] !== 'object') continue;
    d[group] = d[group] || {};
    for (const k of keys) {
      if (patch[group][k] === undefined) continue;
      const v = clip(patch[group][k], k === 'what' || k === 'offer' || k === 'audience' || k === 'buildTarget' || k === 'avoid' ? 400 : 120);
      if (group === 'links' && v && !/^https?:\/\//i.test(v) && !/^@?[\w.]{1,40}$/.test(v)) continue;
      if (v) d[group][k] = v;
      else delete d[group][k];
    }
  }
  await deps.db.save('brains', d);
  return snapshot(user);
}

async function remember(userId, packId, key, value) {
  const k = String(key || '').replace(/[^\w.-]/g, '').slice(0, 60);
  if (!k) throw new Error('ctx.remember needs a key.');
  const json = JSON.stringify(value === undefined ? null : value);
  if (json.length > MAX_PACK_VALUE) throw new Error('That is too much to remember in one key (4 KB at most).');
  const d = docOf(userId);
  d.packs = d.packs || {};
  const p = (d.packs[packId] = d.packs[packId] || {});
  if (!(k in p) && Object.keys(p).length >= MAX_PACK_KEYS) throw new Error('This pack already remembers 50 things. Reuse a key.');
  if (value === undefined || value === null) delete p[k];
  else p[k] = JSON.parse(json);
  await deps.db.save('brains', d);
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { snapshot, update, remember, firstName, FIELDS, ZONES, _setDeps };
