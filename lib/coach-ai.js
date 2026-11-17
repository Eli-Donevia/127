// Coach kit in the coach's own voice: Claude rewrites the template kit (lib/coach-kit.js) using the coach's form
// answers and story. The templates stay the floor: a rewritten section is used only when it keeps the template's
// shape, passes the kit's claim check and the site copy check, and adds no number the template didn't have (so no
// invented prices, dates, results or stats). Any section that fails keeps its template text.
//
// Legal (Eli as Legal, 2026-11-17, decision card in "Refocus 127 on online fitness coaches"): only the coach's own
// form answers go to Anthropic, never client data; every draft passes the claim check or the template stays; off
// until Eli says. Switch COACH_AI = off | admins | on (default off).

const coachKit = require('./coach-kit');
const copyCheck = require('./copy-check');

// Sections the AI may rewrite. The challenge page (rules, finish line, dates), posts and app link stay templates.
const SECTIONS = ['site', 'vsl', 'ads', 'emails', 'dms', 'consult'];
// Keys inside a section that are labels or facts, not copy: they must come back unchanged.
const FIXED = new Set(['name', 'nav', 'price', 'time', 'beat', 'when', 'step', 'part', 'angle', 'cta']);

const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);

function mode() {
  const v = String(process.env.COACH_AI || 'off').toLowerCase();
  return v === 'on' || v === 'admins' ? v : 'off';
}

const SYSTEM = [
  'You rewrite marketing copy for an online fitness coach so it sounds like them, not like a template or an AI.',
  'You get the coach\'s answers, their story, and a JSON kit. Return the same JSON with the same keys, the same array lengths and the same order.',
  'Rewrite only the copy. Leave these keys exactly as given: name, nav, price, time, beat, when, step, part, angle, cta.',
  'Write the way the coach writes in their story: their word choices, sentence length and tone. Plain words, short sentences, first person where the template uses it.',
  'Rules you never break:',
  '- No body, weight, health, fitness or money results or promises. No numbers of pounds, kilos, inches or dollars earned. No "guarantee", "before and after", "toned", "shred", "burn fat", "fat loss", "six-pack", "cure".',
  '- Use no number, price or date that the kit does not already contain. Keep every price and date exactly as written.',
  '- No made-up clients, testimonials, quotes or stats. Keep any "[link]" placeholder.',
  '- Injuries and conditions go to a doctor, as in the kit.',
  '- Never use: students, journey, unlock, elevate, game changer, em dashes.',
  'Reply with the JSON only, no other text.',
].join('\n');

function prompt(kit) {
  const f = kit.facts;
  const answers = { coach: f.coach, business: f.business, who: f.who, what: f.what, place: f.place, days: f.days, start: f.start, price: f.priceText, monthly: f.monthly, keyword: f.keyword, story: f.story };
  const draft = {};
  for (const s of SECTIONS) draft[s] = kit[s];
  return `<coach_answers>\n${JSON.stringify(answers, null, 1)}\n</coach_answers>\n\n<kit>\n${JSON.stringify(draft)}\n</kit>`;
}

// Same shape as the template: same keys, same array lengths, strings where strings were, fixed keys unchanged.
function sameShape(tpl, out, key) {
  if (typeof tpl === 'string') return typeof out === 'string' && out.trim().length > 0 && out.length <= Math.max(400, tpl.length * 3) && (!FIXED.has(key) || out === tpl);
  if (typeof tpl === 'number') return out === tpl;
  if (Array.isArray(tpl)) return Array.isArray(out) && out.length === tpl.length && tpl.every((v, i) => sameShape(v, out[i], key));
  if (tpl && typeof tpl === 'object') {
    if (!out || typeof out !== 'object' || Array.isArray(out)) return false;
    const a = Object.keys(tpl).sort(); const b = Object.keys(out).sort();
    return a.length === b.length && a.every((k, i) => k === b[i] && sameShape(tpl[k], out[k], k));
  }
  return tpl === out;
}

const numbers = (strs) => new Set(strs.join(' ').match(/\d+(?:[.,]\d+)?/g) || []);

// Why a rewritten section can't be used, or null when it can.
function problem(name, tpl, out, kit) {
  if (!sameShape(tpl, out, name)) return 'shape';
  const strs = coachKit.strings({ [name]: out });
  if (coachKit.check({ [name]: out }).length) return 'claim';
  const allowed = numbers(coachKit.strings({ [name]: tpl }).concat([String(kit.facts.days), String(kit.facts.price), String(kit.facts.monthly), kit.facts.start]));
  for (const n of numbers(strs)) if (!allowed.has(n)) return 'number';
  const text = strs.join('\n');
  if (/[—–]/.test(text)) return 'dash';
  // A copy-check block the template's own text didn't already have.
  const blocks = (t) => new Set(copyCheck.check(t, { paid: true }).filter((x) => x.severity === 'block').map((x) => x.rule));
  const had = blocks(coachKit.strings({ [name]: tpl }).join('\n'));
  for (const r of blocks(text)) if (!had.has(r)) return 'copy';
  return null;
}

function parse(raw) {
  const t = String(raw || '');
  const i = t.indexOf('{'); const j = t.lastIndexOf('}');
  if (i < 0 || j <= i) return null;
  try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { return null; }
}

let _client = null;
function client() {
  if (!_client) {
    const Anthropic = require('@anthropic-ai/sdk');
    _client = new Anthropic({ maxRetries: 1 });
  }
  return _client;
}

// Rewrite a kit. Returns { sections: {site, vsl, ...}, used: [names], kept: {name: reason} }. Sections that fail
// a check come back as the template. Throws only when the API call itself fails.
async function rewrite(input) {
  const kit = coachKit.build(input);
  if (kit.problems.length) return { error: 'claim', text: kit.problems[0].text };
  const model = env('ANTHROPIC_MODEL_COACH', env('ANTHROPIC_MODEL', 'claude-opus-5-5'));
  const params = { model, max_tokens: 8000, system: SYSTEM, messages: [{ role: 'user', content: prompt(kit) }] };
  if (/^claude-(opus-4-[5-9]|opus-5|fable|sonnet-4-6|sonnet-5|haiku-5)/.test(model)) params.output_config = { effort: env('AI_EFFORT_COACH', 'low') };
  const started = Date.now();
  const res = await client().messages.create(params, { timeout: 90000 });
  const u = res.usage || {};
  console.log(`[ai] coach-voice model=${res.model || model} in=${u.input_tokens || 0} out=${u.output_tokens || 0} ms=${Date.now() - started}${res.stop_reason && res.stop_reason !== 'end_turn' ? ` stop=${res.stop_reason}` : ''}`);
  const out = res.stop_reason === 'refusal' ? null : parse((res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''));
  const sections = {}; const used = []; const kept = {};
  for (const s of SECTIONS) {
    const why = out ? problem(s, kit[s], out[s], kit) : 'unreadable';
    if (why) { sections[s] = kit[s]; kept[s] = why; } else { sections[s] = out[s]; used.push(s); }
  }
  return { sections, used, kept };
}

module.exports = { mode, rewrite, SECTIONS, _test: { sameShape, problem, parse, prompt, setClient: (c) => { _client = c; } } };
