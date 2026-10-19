// Services the member sells (data/services.json), the 7-day plan with real dates, and the sender
// details every draft is signed with. Pure functions; tools and tests import these.

const { text, time, brain } = require('../../_kit');
const DATA = require('../data/services.json');

const STOP = new Set(['i', 'we', 'my', 'our', 'a', 'an', 'the', 'and', 'or', 'do', 'make', 'sell', 'offer', 'provide', 'run', 'help', 'with', 'service', 'services', 'local', 'small', 'business', 'businesses', 'company', 'agency', 'freelance', 'freelancer']);
const words = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9+\- ]+/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));

// "websites", "Short videos for gyms", "pressure washing" -> a service object (always). Unknown words
// become the "other" service with the member's own words as its label.
function serviceOf(input) {
  const raw = String((input && input.id) || input || '').trim();
  if (DATA.services[raw]) return { id: raw, ...DATA.services[raw] };
  const head = raw.split(/\s+for\s+/i)[0];
  const w = words(head);
  const phrase = w.join(' ');
  if (!phrase) return { id: 'other', ...DATA.services.other };
  let best = null;
  for (const [id, s] of Object.entries(DATA.services)) {
    for (const name of [id, s.label, ...(s.aliases || [])]) {
      const aw = words(name);
      const a = aw.join(' ');
      if (!a) continue;
      if (a === phrase) return { id, ...s };
      const inside = ` ${phrase} `.includes(` ${a} `);
      const cover = aw.length / w.length;
      if (inside && cover >= 0.5 && id !== 'cleaning' && (!best || aw.length > best.len)) best = { id, len: aw.length };
    }
  }
  if (best) return { id: best.id, ...DATA.services[best.id] };
  const label = text.clip(text.plain(head), 40);
  const sell = label.toLowerCase();
  return { ...DATA.services.other, id: 'other', label: text.titleCase(label), sell, verb: `offer ${sell}`, custom: true };
}

const serviceList = () => Object.entries(DATA.services).map(([id, s]) => ({ id, label: s.label }));

// Who signs the drafts: the member's first name, business, city and (optional) mailing address.
function senderOf(ctx, input = {}) {
  const br = brain.brainOf(ctx, input);
  return {
    first: text.plain(input.your_name || br.firstName || ''),
    business: br.name || '',
    city: br.place || '',
    address: text.plain(input.address || ''),
  };
}

// The city to search: the input, else the member's own city from their brain.
function cityOf(ctx, input = {}) {
  return text.plain(input.city || brain.brainOf(ctx, {}).place || '').slice(0, 80);
}

// The next 7 working days from today (Mon to Fri), with the plan line for each.
function planDays(ctx, start) {
  let d = start || time.today(ctx);
  const out = [];
  while (out.length < DATA.plan.length) {
    const wd = time.weekdayOf(d);
    if (wd !== 0 && wd !== 6) out.push({ day: out.length + 1, date: d, label: time.shortDate(d), todo: DATA.plan[out.length] });
    d = time.addDays(d, 1);
  }
  return out;
}

// When each rank gets its first message (the plan: 1-5 day 1, 6-10 day 2, 11-15 day 4, 16-25 day 6).
function sendDay(rank) {
  if (rank <= 5) return 1;
  if (rank <= 10) return 2;
  if (rank <= 15) return 4;
  return 6;
}

// The free sample to make for #1 (Funnels spec steps), filled in for that business.
function specFor(service, vars) {
  const s = DATA.specs[service.id] || DATA.specs[service.sample] || DATA.specs.other;
  const hook = text.fill(DATA.hooks[vars.categoryId] || 'What a visit to {biz} looks like', vars);
  const v = { ...vars, hook };
  return { title: text.fill(s.title, v), steps: s.steps.map((x) => text.plain(text.fill(x, v))) };
}

module.exports = { DATA, serviceOf, serviceList, senderOf, cityOf, planDays, sendDay, specFor };
