// Week menu planning for meal prep, as pure functions over data/recipes.json and data/storage.json
// (tests import these). It picks dinners that fit what the intake says (household size, the way they
// eat, the foods to leave out, foods they avoid), puts each dinner in the fridge or the freezer by the
// FDA storage times, merges one shopping list by store section, orders the cook day, and writes the
// labels. Legal L73: the foods to leave out are just foods (who has an allergy and how serious it is
// stay on the paper intake), nothing here looks for medical words, and every plan says it isn't a
// medical diet. A diet the client names is a preference to cook to, never advice.

const RECIPES = require('../data/recipes.json');
const STORAGE = require('../data/storage.json');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DIETS = Object.keys(STORAGE.diets);
const ALLERGEN_IDS = STORAGE.allergens.map((a) => a.id);
const ALLERGEN_LABEL = Object.fromEntries(STORAGE.allergens.map((a) => [a.id, a.label]));
// What a label and the menu say for a dish whose recipe has none of the 9 (Legal L73).
const NO_MAJOR = 'None of the 9 major allergens in the recipe. Packaged ingredients can differ.';
const ANIMAL_WORDS = [
  ['poultry', /\b(chicken|turkey|poultry|duck)\b/i],
  ['beef', /\b(beef|steak|red meat)\b/i],
  ['pork', /\b(pork|bacon|ham|sausage|red meat)\b/i],
  ['fish', /\b(fish|seafood)\b/i],
  ['shellfish', /\b(shellfish|seafood)\b/i],
  ['honey', /\bhoney\b/i],
];
const MEAT_WORDS = /\b(meat|meats)\b/i;
// Words in an ingredient name that don't say what it is ("Boneless skinless chicken thighs" is chicken).
const FILLER = new Set(['and', 'with', 'fresh', 'canned', 'boneless', 'skinless', 'ground', 'large', 'low', 'sodium', 'plain', 'shredded', 'grated', 'dried', 'long', 'grain', 'extra', 'firm', 'creamy', 'toasted', 'baby', 'mixed', 'whole', 'milk', 'style', 'small', 'short', 'red', 'green', 'yellow', 'white', 'black', 'sweet']);

const DAY_MS = 24 * 3600 * 1000;
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const parts = (s) => String(s).split('-').map(Number);
function addDays(s, n) {
  const [y, m, d] = parts(s);
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
function addMonths(s, n) {
  const [y, m, d] = parts(s);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return ymd(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, last));
}
const weekdayOf = (s) => {
  const [y, m, d] = parts(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const shortDate = (s) => {
  const [y, m, d] = parts(s);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
};
const dayShort = (s) => WEEKDAYS[weekdayOf(s)].slice(0, 3);
// "Feb 26, 2027" for dates months out.
const monthDay = (s) => {
  const [y, m, d] = parts(s);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
};

// FNV-1a, so the same client and cook day always get the same menu, and next week gets a new one.
function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const list = (xs) => {
  const a = xs.filter(Boolean);
  if (a.length <= 1) return a.join('');
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
};

// "Lemon herb chicken with roasted potatoes" -> "Lemon herb chicken" (a one-word head keeps the full name).
const shortName = (name) => {
  const head = String(name).split(/ with | in marinara/)[0];
  return head.trim().split(/\s+/).length < 2 ? String(name) : head;
};

function singular(w) {
  const s = String(w || '').toLowerCase().trim();
  if (s.length <= 3) return s;
  if (/oes$/.test(s)) return s.slice(0, -2);
  if (/ies$/.test(s)) return `${s.slice(0, -3)}y`;
  if (/(ss|us)$/.test(s)) return s;
  if (/s$/.test(s)) return s.slice(0, -1);
  return s;
}
const wordsIn = (s) => String(s || '').toLowerCase().split(/[^a-z]+/).filter(Boolean).map(singular);

// "peanuts, shellfish and sesame" / "no dairy; mushrooms" -> ["peanuts", "shellfish", "sesame"]
function termsOf(textIn) {
  const out = [];
  for (const raw of String(textIn || '').split(/\r?\n|[,;/]|\band\b|\bor\b|\+/i)) {
    const t = raw
      .toLowerCase()
      .replace(/\b(allerg(y|ies|ic)( to)?|intoleran(t|ce)( to)?|sensitiv(e|ity)( to)?|no|not|none|avoids?|hates?|dislikes?|don'?t (like|eat)|doesn'?t (like|eat)|without|free)\b/g, ' ')
      .replace(/[^a-z' -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (t && t.length > 1 && !out.includes(t)) out.push(t);
  }
  return out;
}

// The foods to leave out (allergies included): the major allergens it names (FDA's 9), gluten, and any
// other foods. Every one is strict: a dish that needs it is left out, an optional one is made without it.
function parseLeaveOut(textIn, S = STORAGE) {
  const ids = new Set();
  let gluten = false;
  const other = [];
  for (const t of termsOf(textIn)) {
    let hit = false;
    for (const a of S.allergens) {
      if (new RegExp(`\\b(${a.words})\\b`, 'i').test(t)) {
        ids.add(a.id);
        hit = true;
      }
    }
    if (!ids.has('tree_nuts') && !ids.has('peanuts') && new RegExp(`\\b(${S.nut_words})\\b`, 'i').test(t)) {
      ids.add('tree_nuts');
      ids.add('peanuts');
      hit = true;
    }
    if (new RegExp(`\\b(${S.gluten_words})\\b`, 'i').test(t)) gluten = true;
    if (!hit) other.push(t);
  }
  return { ids: ALLERGEN_IDS.filter((id) => ids.has(id)), gluten, other };
}

// Foods they avoid: groups ("dairy", "pork", "seafood") work like a diet; single foods ("mushrooms")
// leave out a dish only when the food is what the dish is.
function parseAvoid(textIn, S = STORAGE) {
  const tags = new Set();
  const foods = [];
  for (const t of termsOf(textIn)) {
    let hit = false;
    for (const a of S.allergens) {
      if (new RegExp(`\\b(${a.words})\\b`, 'i').test(t)) {
        tags.add(a.id);
        hit = true;
      }
    }
    if (new RegExp(`\\b(${S.gluten_words})\\b`, 'i').test(t)) tags.add('gluten');
    for (const [tag, re] of ANIMAL_WORDS) {
      if (re.test(t)) {
        tags.add(tag);
        hit = true;
      }
    }
    if (MEAT_WORDS.test(t)) {
      ['poultry', 'beef', 'pork'].forEach((x) => tags.add(x));
      hit = true;
    }
    if (!hit) foods.push(t);
  }
  return { tags: [...tags], foods };
}

function matchesFood(item, food) {
  const have = wordsIn(item);
  const want = wordsIn(food).filter((w) => !FILLER.has(w) || wordsIn(food).length === 1);
  return want.length > 0 && want.every((w) => have.includes(w));
}

// An ingredient is "the dish" when it comes first or its name is in the dish's name.
function isMain(recipe, ing, i) {
  if (i === 0) return true;
  const name = wordsIn(recipe.name);
  return wordsIn(ing.item).filter((w) => !FILLER.has(w)).some((w) => name.includes(w));
}

// One recipe against the household: { ok, dropped: [items left out], why } where `why` says what ruled it out.
function fit(recipe, { blockTags = [], leaveWords = [], avoidTags = [], avoidFoods = [] }) {
  const dropped = [];
  for (let i = 0; i < recipe.ingredients.length; i++) {
    const ing = recipe.ingredients[i];
    const tags = ing.tags || [];
    const hard = tags.find((t) => blockTags.includes(t)) || leaveWords.find((w) => matchesFood(ing.item, w));
    const soft = tags.find((t) => avoidTags.includes(t));
    const food = avoidFoods.find((w) => matchesFood(ing.item, w));
    if (hard || soft) {
      if (ing.optional || ing.staple) dropped.push(ing.item);
      else return { ok: false, dropped: [], why: ing.item };
    } else if (food) {
      if (isMain(recipe, ing, i) && !ing.optional) return { ok: false, dropped: [], why: ing.item };
      dropped.push(ing.item);
    }
  }
  return { ok: true, dropped, why: '' };
}

function eligible(recipes, rules) {
  const pool = [];
  const out = [];
  for (const r of recipes) {
    const f = fit(r, rules);
    if (f.ok) pool.push({ recipe: r, dropped: f.dropped });
    else out.push({ id: r.id, why: f.why });
  }
  return { pool, out };
}

const POULTRY = new Set(['chicken', 'turkey']);
const canFreeze = (S, r) => !!(r.freezes && S.categories[r.store] && S.categories[r.store].freezer_months);

// Picks `count` dinners: favorites first, then a stable shuffle by seed, one of each protein where
// it can (at most 2 poultry), with enough freezer-friendly dishes for the days the fridge can't cover.
function pick(pool, { count, seed, likes = [], recent = [], fridgeDays = 4, S = STORAGE }) {
  const likeWords = likes.flatMap((l) => wordsIn(l)).filter((w) => w.length > 3 && !FILLER.has(w));
  const score = (p) => {
    const name = wordsIn(p.recipe.name);
    const liked = likeWords.some((w) => name.includes(w) || wordsIn(p.recipe.protein).includes(w));
    return (liked ? 2000 : 0) + (recent.includes(p.recipe.id) ? -1000 : 0) + (hash(`${seed}|${p.recipe.id}`) % 1000);
  };
  const ranked = pool.map((p) => ({ ...p, score: score(p) })).sort((a, b) => b.score - a.score || a.recipe.id.localeCompare(b.recipe.id));
  const chosen = [];
  const take = (p) => chosen.push(p);
  const has = (p) => chosen.includes(p);
  const poultry = () => chosen.filter((c) => POULTRY.has(c.recipe.protein)).length;
  const needFreeze = Math.max(0, count - fridgeDays);
  // Freezer-friendly dishes first when the week runs past the fridge times.
  if (needFreeze) {
    for (const p of ranked) {
      if (chosen.filter((c) => canFreeze(S, c.recipe)).length >= needFreeze) break;
      if (!canFreeze(S, p.recipe) || chosen.some((c) => c.recipe.protein === p.recipe.protein)) continue;
      if (POULTRY.has(p.recipe.protein) && poultry() >= 2) continue;
      take(p);
    }
  }
  for (const pass of [0, 1]) {
    for (const p of ranked) {
      if (chosen.length >= count) break;
      if (has(p)) continue;
      if (pass === 0 && chosen.some((c) => c.recipe.protein === p.recipe.protein)) continue;
      if (pass === 0 && POULTRY.has(p.recipe.protein) && poultry() >= 2) continue;
      take(p);
    }
  }
  // Still short of freezer-friendly dishes: swap a fridge-only pick for one that freezes.
  let frozen = chosen.filter((c) => canFreeze(S, c.recipe)).length;
  for (const p of ranked) {
    if (frozen >= needFreeze) break;
    if (has(p) || !canFreeze(S, p.recipe)) continue;
    const i = chosen.map((c) => canFreeze(S, c.recipe)).lastIndexOf(false);
    if (i < 0) break;
    chosen[i] = p;
    frozen += 1;
  }
  return chosen;
}

// Days from the cook day on: the first `fridgeDays` dinners in the fridge (eat by the short end of
// the FDA fridge time), the rest in the freezer (thaw in the fridge the night before).
function assignDays(chosen, { cookDate, S = STORAGE }) {
  const fridgeOnly = chosen.filter((c) => !canFreeze(S, c.recipe));
  const freezable = chosen.filter((c) => canFreeze(S, c.recipe));
  const minFridge = Math.min(...Object.values(S.categories).map((c) => c.fridge_days[0]));
  const fridgeDays = minFridge + 1;
  const ordered = [...fridgeOnly, ...freezable];
  const rows = [];
  ordered.forEach((c, day) => {
    const r = c.recipe;
    const cat = S.categories[r.store];
    const date = addDays(cookDate, day);
    const inFridge = day < fridgeDays || !canFreeze(S, r);
    if (inFridge && day > cat.fridge_days[0]) return; // a fridge-only dish can't wait that long
    const row = {
      day,
      date,
      weekday: WEEKDAYS[weekdayOf(date)],
      recipe: r,
      dropped: c.dropped,
      store: inFridge ? 'fridge' : 'freezer',
      category: cat.label,
      fridge_days: cat.fridge_days,
      freezer_months: cat.freezer_months,
    };
    if (inFridge) row.eat_by = addDays(cookDate, cat.fridge_days[0]);
    else {
      row.thaw_on = addDays(date, -1);
      row.best_by = addMonths(cookDate, cat.freezer_months[0]);
    }
    rows.push(row);
  });
  return rows;
}

const allergensOf = (recipe, dropped = []) => {
  const tags = new Set();
  for (const ing of recipe.ingredients) if (!dropped.includes(ing.item)) for (const t of ing.tags || []) tags.add(t);
  return ALLERGEN_IDS.filter((id) => tags.has(id));
};

// ---------- the shopping list ----------

const WHOLE = /^(each|clove|stalk|piece|head|bunch|pint|can\b|jar\b)/;
const UNITS = { lb: ['lb', 'lb'], oz: ['oz', 'oz'], cup: ['cup', 'cups'], tbsp: ['tbsp', 'tbsp'], tsp: ['tsp', 'tsp'], each: ['', ''], clove: ['clove', 'cloves'], stalk: ['stalk', 'stalks'], piece: ['piece (about 2 inches)', 'pieces (about 2 inches)'], head: ['head', 'heads'], bunch: ['bunch', 'bunches'], pint: ['pint', 'pints'] };

function roundQty(q, unit) {
  if (q == null) return null;
  if (WHOLE.test(unit)) return Math.max(1, Math.ceil(q - 1e-9));
  if (unit === 'lb') return Math.max(0.25, Math.ceil(q * 4 - 1e-9) / 4);
  if (unit === 'oz') return Math.max(1, Math.ceil(q - 1e-9));
  return Math.max(0.25, Math.round(q * 4) / 4);
}

function fmtNum(q) {
  const whole = Math.floor(q + 1e-9);
  const frac = { 0.25: '1/4', 0.5: '1/2', 0.75: '3/4' }[Math.round((q - whole) * 4) / 4] || '';
  if (whole && frac) return `${whole} ${frac}`;
  return whole ? String(whole) : frac || '0';
}

// 9 tbsp -> 1/2 cup and 1 tbsp, kept simple: big spoon amounts become cups, big teaspoon ones tablespoons.
function normalize(q, unit) {
  if (unit === 'tsp' && q >= 6) return { q: q / 3, unit: 'tbsp' };
  if (unit === 'tbsp' && q >= 8) return { q: q / 16, unit: 'cup' };
  return { q, unit };
}

function amountText(q, unit) {
  if (unit === 'to taste' || q == null) return 'to taste';
  const n = normalize(q, unit);
  const r = roundQty(n.q, n.unit);
  const m = n.unit.match(/^(can|jar) \((.+)\)$/);
  let word;
  if (m) word = r === 1 ? `${m[1]} (${m[2]})` : `${m[1]}s (${m[2]})`;
  else {
    const u = UNITS[n.unit] || [n.unit, n.unit];
    word = r === 1 || (r < 1 && n.unit !== 'each') ? u[0] : u[1];
  }
  return `${fmtNum(r)}${word ? ` ${word}` : ''}`;
}

const PACKAGED = new Set(['pantry', 'bakery', 'dairy', 'frozen', 'spices']);

// readFor: the foods to leave out, named on every packaged item ("Read the label for").
function shoppingList(rows, { factor, readFor = [], sections = RECIPES.sections }) {
  const map = new Map();
  for (const row of rows) {
    for (const ing of row.recipe.ingredients) {
      if (row.dropped.includes(ing.item)) continue;
      const key = `${ing.item}|${ing.unit}`;
      const e = map.get(key) || { item: ing.item, unit: ing.unit, section: ing.section, qty: ing.qty == null ? null : 0, staple: !!ing.staple, tags: new Set(), for: [] };
      if (ing.qty != null) e.qty += ing.qty * factor;
      for (const t of ing.tags || []) e.tags.add(t);
      const dish = shortName(row.recipe.name);
      if (!e.for.includes(dish)) e.for.push(dish);
      map.set(key, e);
    }
  }
  const order = sections.map((s) => s.id);
  const label = Object.fromEntries(sections.map((s) => [s.id, s.label]));
  return [...map.values()]
    .sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section) || Number(a.staple) - Number(b.staple) || a.item.localeCompare(b.item))
    .map((e) => ({
      section: label[e.section] || e.section,
      item: e.item,
      amount: amountText(e.qty, e.unit),
      for: e.for.join('; '),
      pantry: e.staple,
      label_check: readFor.length && (PACKAGED.has(e.section) || e.item.toLowerCase().includes('sausage')) ? list(readFor) : '',
    }));
}

// ---------- the cook day ----------

function parseClock(s, fallback = 600) {
  const m = String(s || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return fallback;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = m[3] ? m[3][0] : '';
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  if (!ap && h >= 1 && h <= 6) h += 12; // "2:00" on a cook day is the afternoon
  if (h > 23 || min > 59) return fallback;
  return h * 60 + min;
}

function clock(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

function tempLine(recipe, S = STORAGE) {
  const t = recipe.cook_to && S.cook_temps[recipe.cook_to];
  if (!t) return '';
  const rest = t.rest_min ? `, then a ${t.rest_min} minute rest` : '';
  const or = t.or ? `, ${t.or}` : '';
  return `Cook to ${t.f}°F (${t.label}${rest}${or}), checked with a food thermometer.`;
}

const RAW = /\b(chicken|turkey|beef|steak|pork|sausage|salmon|cod|eggs?)\b/i;

function cookDay(rows, { start, S = STORAGE }) {
  const t0 = parseClock(start);
  const steps = [{ at: t0, step: 'Set up', detail: `${S.lines.hands} Check the fridge is at ${S.fridge_f}°F or below and the freezer at ${S.freezer_f}°F or below with an appliance thermometer. Clear and clean the counters.` }];
  let hands = t0 + 15;
  let end = hands;
  const order = [...rows].sort((a, b) => (b.recipe.passive ? b.recipe.cook_min : 0) - (a.recipe.passive ? a.recipe.cook_min : 0) || b.recipe.cook_min - a.recipe.cook_min);
  for (const row of order) {
    const r = row.recipe;
    const name = shortName(r.name);
    const prepAt = hands;
    const cookAt = prepAt + r.prep_min;
    const doneAt = cookAt + r.cook_min;
    const raw = r.ingredients.some((i) => !row.dropped.includes(i.item) && i.section !== 'pantry' && RAW.test(i.item));
    steps.push({ at: prepAt, step: `Prep: ${name}`, detail: `About ${r.prep_min} minutes.${raw ? ` ${S.lines.separate}` : ''}` });
    const verb = r.method === 'oven' ? 'Into the oven' : r.method === 'simmer' ? 'Simmer' : 'Cook';
    steps.push({ at: cookAt, step: `${verb}: ${name}`, detail: `About ${r.cook_min} minutes.${r.passive ? ' Start the next prep while it cooks.' : ''}` });
    const pack = r.pack ? ` ${r.pack}` : '';
    steps.push({ at: doneAt, step: `Pack and label: ${name}`, detail: `${tempLine(r, S) ? `${tempLine(r, S)} ` : ''}Divide into shallow containers, label them and put them in the ${row.store} within ${S.chill_hours} hours.${pack}` });
    hands = r.passive ? cookAt : doneAt + 10;
    end = Math.max(end, doneAt + 10, hands);
  }
  steps.push({ at: end, step: 'Clean up', detail: 'Wash, dry and put away, wipe the counters and the fridge shelf, and take out the trash. Leave the menu card on the fridge.' });
  // The printed "Contains" line comes from the recipe, so the packages get checked before the first
  // label (index 1 sorts it ahead of anything else at that time).
  const packAt = steps.filter((s) => s.step.startsWith('Pack and label')).map((s) => s.at);
  if (packAt.length) steps.splice(1, 0, { at: Math.min(...packAt), step: 'Check the packages', detail: S.lines.check_packages });
  const sorted = steps.map((s, i) => ({ ...s, i })).sort((a, b) => a.at - b.at || a.i - b.i);
  return { steps: sorted.map(({ at, step, detail }) => ({ time: clock(at), step, detail })), start: clock(t0), end: clock(end + 30), minutes: end + 30 - t0 };
}

// ---------- labels ----------

function storeLine(row) {
  if (row.store === 'fridge') return `Fridge. Eat by ${shortDate(row.eat_by)}.`;
  return `Freezer. Move to the fridge the night of ${shortDate(row.thaw_on)}. Best quality by ${monthDay(row.best_by)}.`;
}

function containsLine(row) {
  const a = allergensOf(row.recipe, row.dropped).map((id) => ALLERGEN_LABEL[id]);
  return a.length ? `Contains: ${list(a)}.` : NO_MAJOR;
}

function labelsFor(rows, { cookDate, household, perServing = false, max = 60, R = RECIPES }) {
  const out = [];
  for (const row of rows) {
    const n = perServing ? household : 1;
    const label = {
      name: row.recipe.name,
      serves: perServing ? '1 serving' : `Serves ${household}`,
      cooked: `Cooked ${shortDate(cookDate)}`,
      dinner: `${row.weekday} dinner`,
      store: storeLine(row),
      freezer: row.store === 'freezer',
      reheat: R.reheat[row.recipe.reheat] || R.reheat.plate,
      contains: containsLine(row),
      without: row.dropped.length ? `Made without ${list(row.dropped.map((x) => x.toLowerCase()))}.` : '',
      pack: row.recipe.pack || '',
    };
    for (let i = 0; i < n && out.length < max; i++) out.push(label);
  }
  return out;
}

// ---------- the whole week ----------

// input: { household, dinners, diet, leave_out, avoid, likes, cookDate, seed, perServing, recent }
// Returns the plan; `leave_list` is the foods left out as the plan, views and client text name them.
function planWeek(input, { R = RECIPES, S = STORAGE } = {}) {
  const household = Math.max(1, Math.min(10, Math.round(Number(input.household) || 4)));
  const count = Math.max(2, Math.min(6, Math.round(Number(input.dinners) || 4)));
  const diet = DIETS.includes(input.diet) ? input.diet : 'Anything';
  const leave = parseLeaveOut(input.leave_out, S);
  const avoid = parseAvoid(input.avoid, S);
  const blockTags = [...new Set([...S.diets[diet], ...leave.ids, ...(leave.gluten ? ['gluten'] : [])])];
  const rules = { blockTags, leaveWords: leave.other, avoidTags: avoid.tags, avoidFoods: avoid.foods };
  const { pool, out } = eligible(R.recipes, rules);
  const minFridge = Math.min(...Object.values(S.categories).map((c) => c.fridge_days[0]));
  const chosen = pick(pool, { count, seed: input.seed || '', likes: [String(input.likes || '')], recent: input.recent || [], fridgeDays: minFridge + 1, S });
  const rows = assignDays(chosen, { cookDate: input.cookDate, S });
  const factor = household / R.servings;
  const leaveList = [...leave.ids.map((id) => ALLERGEN_LABEL[id]), ...leave.other];
  const notes = [];
  if (rows.length < count) {
    notes.push(
      rows.length < chosen.length
        ? `${rows.length} of ${count} dinners fit one cook day: dishes that can't be frozen have to be eaten within ${minFridge} days. Plan a second cook day midweek for the rest.`
        : `Only ${rows.length} of ${count} dinners fit the foods to leave out, the way they eat and the foods they avoid. Add a dish of your own that fits, or ask whether one food on the avoid list can come back.`,
    );
  }
  if (leave.other.length) {
    const found = leave.other.filter((w) => R.recipes.some((r) => r.ingredients.some((i) => matchesFood(i.item, w))));
    const missing = leave.other.filter((w) => !found.includes(w));
    if (found.length) notes.push(`Left out every dish with ${list(found)}.`);
    if (missing.length) notes.push(`No dish on this list uses ${list(missing)} by name. Read every package label for it, since brands differ.`);
  }
  if (leave.gluten) notes.push('Left out wheat, barley and rye ingredients. That is not a gluten-free claim: read every label, and keep in mind that a home kitchen can have wheat in it.');
  // Printed on every plan, word for word (Legal L73).
  notes.push(S.lines.not_medical);
  return {
    household,
    count,
    diet,
    servings: household,
    factor,
    leave,
    leave_list: leaveList,
    avoid,
    rows,
    ruled_out: out,
    shopping: shoppingList(rows, { factor, readFor: leaveList, sections: R.sections }),
    schedule: cookDay(rows, { start: input.start, S }),
    labels: labelsFor(rows, { cookDate: input.cookDate, household, perServing: !!input.perServing, R }),
    notes,
  };
}

module.exports = {
  RECIPES,
  STORAGE,
  WEEKDAYS,
  DIETS,
  ALLERGEN_IDS,
  ALLERGEN_LABEL,
  NO_MAJOR,
  addDays,
  addMonths,
  shortDate,
  dayShort,
  monthDay,
  hash,
  list,
  shortName,
  singular,
  termsOf,
  parseLeaveOut,
  parseAvoid,
  matchesFood,
  isMain,
  fit,
  eligible,
  canFreeze,
  pick,
  assignDays,
  allergensOf,
  roundQty,
  amountText,
  shoppingList,
  parseClock,
  clock,
  tempLine,
  cookDay,
  storeLine,
  containsLine,
  labelsFor,
  planWeek,
};
