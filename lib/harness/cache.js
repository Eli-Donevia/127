// A cache shared by every member for public data (a gym's public stats, a city's map point), so 20
// members in one city don't pay for the same lookup 20 times. Never member data: the engine
// namespaces keys by pack, and packs only put public facts here. Values up to 32 KB; the oldest
// entries go first past 2,000.

const crypto = require('crypto');
const deps = { db: require('../db'), now: () => Date.now() };

const MAX_VALUE = 32 * 1024;
const MAX_ENTRIES = 2000;
const idFor = (key) => crypto.createHash('sha256').update(String(key)).digest('base64url').slice(0, 24);

async function get(key) {
  const d = deps.db.get('harnessCache', idFor(key));
  if (!d) return null;
  if (d.expiresAt <= deps.now()) {
    await deps.db.remove('harnessCache', d.id);
    return null;
  }
  return d.value;
}

async function set(key, value, hours = 24) {
  if (value === undefined || value === null) return false;
  const json = JSON.stringify(value);
  if (!json || json.length > MAX_VALUE) return false;
  const h = Math.max(0.01, Math.min(Number(hours) || 24, 24 * 90));
  await deps.db.save('harnessCache', { id: idFor(key), key: String(key).slice(0, 200), value: JSON.parse(json), expiresAt: deps.now() + h * 3600 * 1000 });
  const all = deps.db.all('harnessCache');
  if (all.length > MAX_ENTRIES) {
    const drop = all.sort((a, b) => a.expiresAt - b.expiresAt).slice(0, all.length - MAX_ENTRIES);
    for (const d of drop) await deps.db.remove('harnessCache', d.id);
  }
  return true;
}

async function sweep() {
  const now = deps.now();
  for (const d of deps.db.filter('harnessCache', (x) => x.expiresAt <= now)) await deps.db.remove('harnessCache', d.id);
}

// What a pack's tools see: the same cache with keys prefixed by the pack id.
function forPack(packId) {
  return {
    get: (key) => get(`${packId}:${key}`),
    set: (key, value, hours) => set(`${packId}:${key}`, value, hours),
  };
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { get, set, sweep, forPack, MAX_VALUE, _setDeps };
