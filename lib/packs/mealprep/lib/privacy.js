// What stays out of 127 in this pack. 127 doesn't take health information, and Washington's My Health
// My Data Act applies. Legal L73 rules on the week menu (its foods to leave out stay in the run and its
// files, never in the Pipeline, and memory keeps dish ids only); the L72 default covers the rest: food
// restrictions (allergies, intolerances, diets) and health details never reach the Pipeline, brain
// memory or an AI tool. These wrappers do that for the spine tools this pack uses:
// - people lists (first 25, next 25): a note about food or health is dropped before anyone is saved;
// - a reply about food or health gets the pack's own written answer (no AI call), and the Pipeline
//   gets the stage only, never their words or the answer;
// - the first cook day text on a new client keeps only the parts about the day and time;
// - free-text fields say "Nothing about their health."
// Matching leans wide on purpose: a false match only keeps a few words out of the Pipeline.

const first25 = require('../../_kit/first25');
const { views } = require('../../_kit');
const { STORAGE } = require('./menu');

const NOTHING = 'Nothing about their health.';

const FOODS = [...STORAGE.allergens.map((a) => a.words), STORAGE.nut_words, 'pork|beef|meats?|seafood|sugar|salt|sodium|carbs?|alcohol'].join('|');
const ALWAYS = [
  // allergies and intolerances
  'allerg\\w*', 'intoleran\\w*', 'sensitivit\\w*', 'anaphyla\\w*', 'epi-?pens?', 'epinephrine', 'celiac', 'coeliac', 'gluten\\w*', 'lactose', 'dairy',
  // diets, including religious ones
  'diet\\w*', 'vegetarian\\w*', 'vegan\\w*', 'pescatarian\\w*', 'plant[- ]based', 'keto\\w*', 'paleo', 'whole ?30', 'low[- ]?(carb|sodium|salt|fat|sugar)\\w*', 'fodmap', 'kosher', 'halal', 'fasting', 'ramadan',
  // health
  'health\\w*', 'medical\\w*', 'medicine\\w*', 'medication\\w*', 'meds', 'doctor\\w*', 'physician\\w*', 'dietitian\\w*', 'nutritionist\\w*', 'allergist\\w*', 'hospital\\w*', 'diabet\\w*', 'insulin', 'blood (sugar|pressure)', 'hypertension', 'cholesterol', 'heart', 'cardiac', 'kidney\\w*', 'renal', 'liver', 'cancer', 'chemo\\w*', 'surgery', 'pregnan\\w*', 'baby on the way', 'ill', 'illness\\w*', 'sick\\w*', 'disease\\w*', 'disorder\\w*', 'diagnos\\w*', 'weight', 'calorie\\w*', 'macros?', 'ibs', 'crohn\\w*', 'colitis', 'reflux', 'gerd', 'gout', 'autis\\w*', 'adhd',
];
const RESTRICTION = new RegExp(`\\b(${ALWAYS.join('|')})\\b`, 'i');
// "no nuts", "can't have shrimp", "doesn't eat pork", "nut-free"
const NEGATED = new RegExp(`\\b(no|not|never|without|avoid\\w*|skip\\w*|leave out|left out|can'?t|cannot|don'?t|doesn'?t|won'?t|free of)\\b[^.!?\\n]{0,40}\\b(${FOODS})\\b|\\b(${FOODS})[- ]free\\b`, 'i');

// True when the words say something about a food restriction or health.
const isPrivate = (s) => {
  const t = String(s || '');
  return RESTRICTION.test(t) || NEGATED.test(t);
};

// Keeps the parts of a short note that say nothing about food or health:
// "neighbor, peanut allergy at home" -> "neighbor".
function scrubText(s) {
  const t = String(s || '');
  if (!isPrivate(t)) return t;
  return t
    .split(/[,;]|\s+-\s+|(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x && !isPrivate(x))
    .join(', ');
}

const withNothing = (prop) => {
  const d = String(prop.description || '').trim();
  const stop = !d || /[.!?]["')]?$/.test(d) ? '' : '.';
  return { ...prop, description: `${d}${stop}${d ? ' ' : ''}${NOTHING}` };
};

function describe(tool, fields) {
  const P = tool.input.properties;
  const props = { ...P };
  for (const f of fields) if (props[f]) props[f] = withNothing(props[f]);
  return { ...tool.input, properties: props };
}

// Free-text fields that never reach the Pipeline, memory or AI: they only say "Nothing about their health."
function noHealth(tool, fields) {
  return { ...tool, input: describe(tool, fields) };
}

// Free-text fields saved to the Pipeline: the description, and any part about food or health dropped.
function privateFields(tool, fields) {
  return {
    ...tool,
    input: describe(tool, fields),
    async run(input, ctx) {
      const clean = { ...(input || {}) };
      for (const f of fields) if (typeof clean[f] === 'string') clean[f] = scrubText(clean[f]);
      return tool.run(clean, ctx);
    },
  };
}

// First 25 and next 25: everyone is saved to the Pipeline with their note, so a note about food or
// health is cut down to the rest ("neighbor, peanut allergy at home" is saved as "neighbor").
function privateList(tool) {
  return {
    ...tool,
    input: describe(tool, ['people']),
    output: { ...tool.output, properties: { ...tool.output.properties, kept_private: { type: 'integer' } } },
    async run(input, ctx) {
      const raw = input && input.people;
      if (!raw || (!Array.isArray(raw) && !isPrivate(raw))) return tool.run(input, ctx);
      let kept = 0;
      const people = first25.parsePeople(raw, { max: 400 }).map((p) => {
        const note = scrubText(p.note);
        if (note !== p.note) kept += 1;
        return { name: p.name, note, phone: p.phone, email: p.email };
      });
      if (!kept) return tool.run(input, ctx);
      return { ...(await tool.run({ ...input, people }, ctx)), kept_private: kept };
    },
    view(out) {
      const blocks = tool.view(out);
      if (!out.kept_private) return blocks;
      const who = out.kept_private === 1 ? '1 person' : `${out.kept_private} people`;
      return [...blocks, views.text(`Notes about food or health for ${who} were left off your Pipeline and this list.`)];
    },
  };
}

// The run's ctx without an AI model, and with a Pipeline that never gets their words or the answer.
const strip = (row) => {
  const { reply, msg, ...rest } = row || {}; // eslint-disable-line no-unused-vars
  return rest;
};
function privateCtx(ctx) {
  const base = ctx || {};
  const leads = base.leads;
  const own = { ai: { value: undefined, enumerable: true } };
  if (leads && typeof leads === 'object') {
    const safe = {};
    if (typeof leads.upsert === 'function') safe.upsert = { value: (row) => leads.upsert(strip(row)), enumerable: true };
    if (typeof leads.update === 'function') safe.update = { value: (id, patch) => leads.update(id, strip(patch)), enumerable: true };
    own.leads = { value: Object.create(leads, safe), enumerable: true };
  }
  return Object.create(base, own);
}

// Where the lead is now, said the way the spine's reply view says it, minus "saved with this answer".
const STAGE = { found: 'Found', contacted: 'Contacted', replied: 'Replied', call: 'Call', won: 'Won', lost: 'Lost' };
const RANK = { found: 0, contacted: 1, replied: 2, call: 3, lost: 4, won: 5 };
const behind = (stage, target) => (RANK[stage] ?? -1) < RANK[target];
function pipeLine(out) {
  const s = out.saved || {};
  const target = out.stop ? 'lost' : 'replied';
  let where = '';
  if (s.saved && s.other && behind(s.stage, target)) where = `${out.to} is in your Pipeline from another workflow: move them to ${STAGE[target]} on that row.`;
  else if (s.saved && out.stop && s.stage && s.stage !== 'lost') where = `${out.to} is marked ${STAGE[s.stage] || s.stage} in your Pipeline, so this run left them there. Move them to Lost on their row if they want no more messages.`;
  else if (s.saved && out.stop) where = `Marked lost in your Pipeline, so ${out.to} stays off your lists.`;
  else if (s.saved) where = s.stage && s.stage !== 'replied' ? `${out.to} stays at ${STAGE[s.stage] || s.stage} in your Pipeline.` : 'Moved to Replied in your Pipeline.';
  else if (out.to === 'them') where = 'Pick them from your Pipeline, or type their name, to move them to Replied.';
  const kept = `This reply mentions food or health, so ${out.answer ? 'their words and this answer stay' : 'their words stay'} out of your Pipeline.`;
  return [where, kept, out.answer ? 'Send the answer from here.' : ''].filter(Boolean).join(' ');
}

// Answer a reply: a message about food or health is answered from the pack's own text, with no AI
// call, and only the stage goes to the Pipeline.
function privateReply(tool) {
  const P = tool.input.properties;
  return {
    ...tool,
    input: {
      ...tool.input,
      properties: { ...P, reply: { ...P.reply, description: 'Paste their message. If it mentions allergies, diets or health, you get the written answer and your Pipeline gets the stage only.' } },
    },
    output: { ...tool.output, properties: { ...tool.output.properties, private: { type: 'boolean' } } },
    async run(input, ctx) {
      if (!isPrivate(input && input.reply)) return tool.run(input, ctx);
      const out = await tool.run(input, privateCtx(ctx));
      return { ...out, ai: false, private: true };
    },
    view(out) {
      if (!out.private) return tool.view(out);
      // The spine's view without its Pipeline line (it would say the answer is ready in Do my day).
      const blocks = tool.view({ ...out, saved: {} }).filter((b) => !(b.type === 'text' && /Do my day/.test(b.text)));
      return [...blocks, views.text(pipeLine(out))];
    },
  };
}

module.exports = { NOTHING, isPrivate, scrubText, noHealth, privateFields, privateList, privateReply, privateCtx };
