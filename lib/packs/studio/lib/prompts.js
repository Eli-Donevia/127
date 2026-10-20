// Video and image prompts written the way each model reads best. Pure code, no AI, deterministic:
// the same shot and seed always give the same words. Data lives in data/prompts/:
//   models.json  how each maker says to prompt (sourced, checked date), lengths and settings
//   camera.json  camera moves: a plain name, what each is for, and the words each model reads
//   <pack>.json  prompt packs: 20 to 40 templates each with {slots} (product, setting, person...)
//
// Exports: MODELS (ids), STYLE (each model's notes), CAMERA (moves by id), PACKS (packs by id),
// build() one shot for one model, shotList() a shot list for a video type, render() a pack template,
// packPrompts() a set of prompts from a pack, sheetHtml() and csvText() for the member's files.

const { text, color, files } = require('../../_kit');

const MODEL_DATA = require('../data/prompts/models.json');
const CAMERA_DATA = require('../data/prompts/camera.json');

const MODELS = ['higgsfield', 'kling', 'veo', 'runway', 'luma', 'sora', 'flux', 'imagen'];
const STYLE = MODEL_DATA.models;
const IMAGE_MODELS = new Set(MODELS.filter((m) => STYLE[m].media === 'image'));

const CAMERA = Object.fromEntries(CAMERA_DATA.moves.map((m) => [m.id, m]));

const PACK_IDS = ['camera-moves', 'product', 'ugc', 'cinematic', 'faceless', 'local-service', 'image-ads', 'shot-lists'];
const PACKS = Object.fromEntries(PACK_IDS.map((id) => [id, require(`../data/prompts/${id}.json`)]));

// What a {slot} becomes when the member leaves it out. Neutral, so every template reads well.
const SLOTS = {
  product: 'the product',
  setting: 'a bright, clean room',
  person: 'a friendly person',
  brand_color: '#2F6FDF',
  business: 'the business',
  service: 'the job',
  city: 'town',
  before: 'a messy, grimy space',
  after: 'the same space, spotless and finished',
  text: 'New this week',
};
const SLOT_KEYS = Object.keys(SLOTS);

// Where the shot starts and ends for a move (Higgsfield and Kling both ask for it).
const FRAMING = {
  dolly_in: ['a medium shot', 'a close-up'],
  dolly_out: ['a close-up', 'a wide shot'],
  orbit: ['the front', 'the back, then the front again'],
  arc: ['the front', 'a three-quarter view'],
  crane_up: ['eye level', 'a high wide view'],
  crane_down: ['a high wide view', 'eye level'],
  tilt_up: ['the bottom', 'the face or top'],
  tilt_down: ['the top', 'the detail below'],
  macro_push: ['an extreme close-up', 'an even tighter detail'],
  aerial_pullback: ['a medium shot', 'a high aerial view'],
  crash_zoom: ['a wide shot', 'a tight close-up'],
  hero_low: ['a low medium shot', 'a low close-up'],
};

const SPEED = { whip_pan: 'Fast', crash_zoom: 'Fast', fpv: 'Fast', hyperlapse: 'Fast', bullet_time: 'Smooth', static: 'No' };

// ---------- small helpers ----------

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const trimDot = (s) => String(s || '').trim().replace(/[.\s]+$/, '');
const sentence = (s) => (s ? `${cap(trimDot(s))}.` : '');
const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;

// A member's value for a slot: one line, no braces or quotes that could break a prompt.
function cleanSlot(v, max = 90) {
  return text.clip(String(v == null ? '' : v).replace(/[{}"`]/g, '').replace(/\s+/g, ' ').trim(), max);
}

function slotsOf(given = {}) {
  const out = { ...SLOTS };
  for (const k of SLOT_KEYS) {
    const v = cleanSlot(given[k], k === 'text' ? 40 : 90);
    if (v) out[k] = v;
  }
  if (!color.isHex(out.brand_color)) out.brand_color = SLOTS.brand_color;
  return out;
}

// "#2F6FDF" -> "bright blue". Video models read color words better than hex codes.
function colorName(hex) {
  if (!color.isHex(hex)) return 'neutral';
  const [h, s, l] = color.rgbToHsl(color.hexToRgb(hex));
  if (l > 0.92) return 'white';
  if (l < 0.1) return 'black';
  if (s < 0.12) return l > 0.65 ? 'light grey' : l < 0.35 ? 'charcoal' : 'grey';
  const hue = ((h % 360) + 360) % 360;
  let name = 'red';
  if (hue >= 15 && hue < 40) name = s < 0.45 && l < 0.5 ? 'brown' : 'orange';
  else if (hue >= 40 && hue < 65) name = 'yellow';
  else if (hue >= 65 && hue < 160) name = 'green';
  else if (hue >= 160 && hue < 195) name = 'teal';
  else if (hue >= 195 && hue < 255) name = 'blue';
  else if (hue >= 255 && hue < 290) name = 'purple';
  else if (hue >= 290 && hue < 340) name = 'pink';
  if (s < 0.35 && l > 0.55) return `soft ${name}`;
  if (l < 0.3) return `deep ${name}`;
  if (l > 0.72) return `pale ${name}`;
  return s > 0.6 ? `bright ${name}` : name;
}

// The color words for a model: FLUX attaches the hex to the object; the rest read a color name.
function colorFor(model, hex) {
  const name = colorName(hex);
  if (model === 'flux') return `${name} color ${hex.toUpperCase()}`;
  if (model === 'imagen') return `${name} (${hex.toUpperCase()})`;
  return name;
}

// Fills {slots}; anything left in braces is removed, so no prompt ever shows a raw slot.
function fill(str, slots, model) {
  const s = slotsOf(slots);
  return String(str == null ? '' : str)
    .replace(/\{(\w+)\}/g, (_, k) => (k === 'brand_color' ? colorFor(model, s.brand_color) : s[k] != null ? s[k] : ''))
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
}

// A field can be a list in the data (for variety): pick one by seed.
function pick(v, seed) {
  if (Array.isArray(v)) return text.pickBy(seed, v) || '';
  return v == null ? '' : String(v);
}

// A camera id, plain name or base words -> the move; free text stays free text.
function moveOf(cam) {
  const c = String(cam || '').trim();
  if (!c) return null;
  if (CAMERA[c]) return CAMERA[c];
  const low = c.toLowerCase();
  return CAMERA_DATA.moves.find((m) => m.base.toLowerCase() === low || m.name.toLowerCase() === low || m.id.replace(/_/g, ' ') === low) || null;
}

function cameraWords(model, cam) {
  const m = moveOf(cam);
  if (!m) return { words: trimDot(cam), move: null };
  if (IMAGE_MODELS.has(model)) return { words: m.still, move: m };
  return { words: m[model] || m.base, move: m };
}

// "a seamless backdrop in blue" -> "against a seamless backdrop in blue"; "a bright kitchen" -> "in a bright kitchen".
function place(setting) {
  const s = trimDot(setting);
  if (!s) return '';
  if (/^(in|on|at|inside|against|under|by|near|outside|full frame)\b/i.test(s)) return s;
  if (/\b(backdrop|background|set)\b/i.test(s)) return `against ${s}`;
  if (/^(an? |the )?[\w\s,-]*\b(table|tabletop|surface|counter|desk|bed|rug|plinth|pedestal|shelf|windowsill|bench|workbench)$/i.test(s)) return `on ${s}`;
  return `in ${s}`;
}

// "A man in a work polo, a trainer" + "coaches" -> "A man in a work polo, a trainer, coaches"
function sa(subject, action) {
  const sub = trimDot(subject);
  if (!action) return sub;
  return /,/.test(sub) ? `${sub}, ${action}` : `${sub} ${action}`;
}

function speakerOf(subject) {
  const s = trimDot(String(subject || '').split(',')[0]);
  if (!s || /hands?|product|surface|the inside|storefront|front of/i.test(s)) return 'The narrator';
  return cap(s);
}

function snapSeconds(model, seconds) {
  const allowed = STYLE[model].seconds;
  if (!allowed) return null;
  const want = Number(seconds) || allowed[0];
  return allowed.reduce((best, x) => (Math.abs(x - want) <= Math.abs(best - want) ? x : best), allowed[0]);
}

function aspectFor(model, aspect) {
  const list = STYLE[model].aspects || [];
  const a = aspect || (IMAGE_MODELS.has(model) ? '1:1' : '9:16');
  if (list.includes(a)) return { aspect: a, note: '' };
  const alt = a === '4:5' || a === '1:1' || a === '3:4' ? (list.includes('9:16') ? '9:16' : list[0]) : list[0];
  return { aspect: alt, note: `${STYLE[model].label} doesn't make ${a}; make it ${alt} and crop to ${a} in the editor.` };
}

// Keeps a prompt inside a model's length: drop the least important parts first, then cut.
function fit(parts, maxChars, maxWords, joiner = ' ') {
  let list = parts.filter((p) => p && p.t);
  const join = () => list.map((p) => p.t).join(joiner).replace(/[ \t]+/g, ' ').trim();
  let out = join();
  while ((out.length > maxChars || (maxWords && words(out) > maxWords)) && list.some((p) => !p.keep)) {
    let i = list.length - 1;
    while (i >= 0 && list[i].keep) i--;
    list = list.filter((_, j) => j !== i);
    out = join();
  }
  if (maxWords && words(out) > maxWords) out = out.split(/\s+/).slice(0, maxWords).join(' ');
  if (out.length > maxChars) out = text.clip(out, maxChars);
  return out;
}

// ---------- build: one shot for one model ----------

// shot: { subject, action, camera, setting, light, mood, style, lens, motion } (strings; camera can be
// a move id like 'dolly_in', its plain name, or your own words). Optional: audio { line, sfx, ambient }
// for models that make sound (Veo, Sora-style), text (words in an image), fromImage (animating a photo).
// Returns { prompt, negative, notes, model, label, seconds, aspect, preset, camera }.
function build({ model = 'kling', shot = {}, aspect, seconds, fromImage = false, audio, slots, seed = '' } = {}) {
  const id = MODELS.includes(model) ? model : 'kling';
  const st = STYLE[id];
  const isImage = IMAGE_MODELS.has(id);
  const f = (k) => fill(pick(shot[k], `${seed}|${k}`), slots, id);
  let subject = f('subject') || 'the subject';
  let action = f('action');
  const setting = f('setting');
  const light = f('light');
  const mood = f('mood');
  let style = f('style');
  const lens = f('lens');
  let motion = f('motion');
  const words_ = fill(pick(shot.text, `${seed}|text`), slots, id);
  const cam = cameraWords(id, pick(shot.camera, `${seed}|camera`));
  const au = audio || shot.audio || {};
  const line = fill(au.line, slots, id);
  const sfx = fill(au.sfx, slots, id);
  const ambient = fill(au.ambient, slots, id);
  if (id === 'luma') for (const w of st.avoidWords || []) style = style.replace(new RegExp(`\\b${w}\\b,?\\s*`, 'ig'), '').trim();
  if (isImage) {
    action = action.split(/,? then /)[0];
    motion = '';
  }
  const where = place(setting);
  const S = cap(subject);
  const secs = isImage ? null : snapSeconds(id, seconds);
  const asp = aspectFor(id, aspect);
  const maxChars = fromImage && st.maxCharsFromImage ? st.maxCharsFromImage : st.maxChars;
  const notes = [];
  const look = [light, mood, style, lens].filter(Boolean).join(', ');
  let prompt = '';
  let preset = null;

  if (id === 'kling') {
    // Subject + movement + scene, then camera language, lighting and atmosphere.
    const fr = cam.move && FRAMING[cam.move.id];
    prompt = fit([
      { t: sentence(fromImage ? `${sa(S, action)}` : `${sa(S, action)} ${where}`), keep: true },
      { t: sentence(cam.words), keep: true },
      { t: fromImage ? sentence(motion) : sentence(look) },
      { t: fr ? sentence(`Start on ${fr[0]}, end on ${fr[1]}`) : '' },
      { t: fromImage ? '' : sentence(motion) },
    ], maxChars, st.maxWords);
  } else if (id === 'veo') {
    // Cinematography first, then subject, action, context, style; sound cues last.
    const speaker = speakerOf(subject);
    prompt = fit([
      { t: sentence(cam.words), keep: true },
      { t: sentence(`${sa(S, action)} ${fromImage ? '' : where}`), keep: true },
      { t: sentence(light) },
      { t: sentence([style, lens].filter(Boolean).join(', ')) },
      { t: sentence(motion) },
      { t: line ? `${speaker} says, "${trimDot(line)}."` : '' },
      { t: sfx ? `SFX: ${trimDot(sfx)}.` : '' },
      { t: ambient ? `Ambient noise: ${trimDot(ambient)}.` : '' },
      { t: sentence(mood) },
    ], maxChars, st.maxWords);
    if (line) notes.push('One voice per clip lip-syncs best. Read the line aloud: it should fit the clip length.');
  } else if (id === 'runway') {
    // "The camera [move] as the subject [action]". Positive words only.
    const subj = fromImage ? 'the subject' : subject;
    prompt = fit([
      { t: sentence(`${cam.words}${/\bas\b/.test(action) ? ', while' : ' as'} ${sa(subj, action)}${fromImage ? '' : ` ${where}`}`), keep: true },
      { t: sentence(motion) },
      { t: fromImage ? '' : sentence(look) },
      { t: secs >= 10 ? 'Continuous, seamless shot.' : '' },
    ], maxChars, st.maxWords);
  } else if (id === 'luma') {
    // Subject, action, details, scene, style, camera; present tense; a secondary motion.
    const second = motion || text.pickBy(`${seed}|${subject}|second`, ['soft reflections move across the surfaces', 'light shifts gently through the scene', 'fine particles drift in the light']);
    prompt = fit([
      { t: sentence(`${sa(S, action)} ${fromImage ? '' : where}`), keep: true },
      { t: sentence(cam.words), keep: true },
      { t: fromImage ? '' : sentence([style, light].filter(Boolean).join(', ')) },
      { t: sentence(second) },
      { t: sentence(lens) },
      { t: sentence(mood) },
    ], maxChars, st.maxWords);
  } else if (id === 'sora') {
    // A scene paragraph, a Cinematography line, the actions as beats, then dialogue.
    const speaker = speakerOf(subject);
    const scene = fromImage ? sentence(`The scene starts from the photo: ${subject}`) : [sentence(sa(S, where)), sentence(light)].filter(Boolean).join(' ');
    const beats = [sa(S, trimDot(action))];
    if (motion) beats.push(trimDot(motion));
    beats.push('holds for the final second');
    prompt = fit([
      { t: scene, keep: true },
      { t: `\nCinematography: ${[cam.words, lens, style].filter(Boolean).join(', ')}.`, keep: true },
      { t: `\nActions: ${beats.join(', then ')}.`, keep: true },
      { t: line ? `\nDialogue: ${speaker}: "${trimDot(line)}."` : '' },
      { t: sfx ? `\nSound: ${trimDot(sfx)}.` : ambient ? `\nSound: ${trimDot(ambient)}.` : '' },
      { t: mood ? `\nMood: ${trimDot(mood)}.` : '' },
    ], maxChars, st.maxWords, '');
  } else if (id === 'higgsfield') {
    // The preset does the move; the words say what the subject does, the speed and the framing.
    preset = cam.move ? cam.move.higgsfield : null;
    const fr = cam.move && FRAMING[cam.move.id];
    const speed = cam.move ? SPEED[cam.move.id] || 'Slow' : 'Slow';
    const moveLine = !cam.move ? sentence(cam.words) : speed === 'No' ? 'The camera holds still.' : sentence(`${speed} move${fr ? `, starting on ${fr[0]} and ending on ${fr[1]}` : ', subject stays centered'}`);
    prompt = fit([
      { t: sentence(`${sa(S, action)} ${fromImage ? '' : where}`), keep: true },
      { t: moveLine, keep: true },
      { t: sentence(motion) },
      { t: fromImage ? '' : sentence([light, style].filter(Boolean).join(', ')) },
      { t: sentence(mood) },
    ], maxChars, st.maxWords);
    if (preset) notes.push(`Pick the ${preset} preset in Higgsfield's camera controls.`);
  } else if (id === 'flux') {
    // Subject first; style and context next; words in quotes with where they go.
    const quoted = words_ ? `The words "${trimDot(words_)}" in bold sans serif at the top, in white, easy to read.` : '';
    prompt = fit([
      { t: `${action ? sa(S, action) : S} ${where}`.trim() + ',', keep: true },
      { t: `${cam.words},`, keep: true },
      { t: style ? `${style},` : '' },
      { t: light ? `${light},` : '' },
      { t: lens ? `${lens},` : '' },
      { t: quoted, keep: !!quoted },
      { t: mood ? `${mood},` : '' },
    ], maxChars, st.maxWords).replace(/,\s*$/, '.').replace(/,(\s*The words)/, '.$1');
    if (!/[.]$/.test(prompt)) prompt = `${trimDot(prompt.replace(/,\s*$/, ''))}.`;
  } else {
    // Imagen and Gemini image: subject and context, then style; short text only.
    const w = words_ ? text.clip(trimDot(words_), st.maxTextChars || 25) : '';
    prompt = fit([
      { t: sentence(`${action ? sa(S, action) : S} ${where}`), keep: true },
      { t: sentence(withStyle(style || 'natural')), keep: true },
      { t: sentence(cam.words), keep: true },
      { t: sentence(light) },
      { t: sentence(lens) },
      { t: w ? `The text "${w}" in large bold letters at the top.` : '', keep: !!w },
      { t: sentence(mood) },
    ], maxChars, st.maxWords);
    if (words_ && words_.length > (st.maxTextChars || 25)) notes.push('Words in the image were cut to 25 characters: longer text comes out garbled.');
  }

  prompt = prompt.split('\n').map((l) => text.plain(l)).join('\n').trim();
  const negative = st.negative ? st.negativeDefault : '';
  if (!isImage && words_) notes.push('Add your words in the editor, not the prompt: video models garble text.');
  if (asp.note) notes.push(asp.note);
  notes.push(secs ? `Set ${asp.aspect} and ${secs} seconds in the settings, not in the prompt.` : `Set ${asp.aspect} in the settings, not in the prompt.`);
  if (fromImage && st.fromImage) notes.push(st.fromImage);
  if (!st.negative) notes.push(`${st.label} reads positive words only, so there is no negative prompt.`);
  return { prompt, negative, notes: notes.map((n) => text.plain(n)), model: id, label: st.label, seconds: secs, aspect: asp.aspect, preset, camera: cam.move ? cam.move.name : '' };
}

// "premium product commercial" -> "A premium product commercial photo"
function withStyle(style) {
  const s = trimDot(style);
  if (/photography$/i.test(s)) return cap(s);
  const noun = /\b(photo|image|shot|design|illustration|portrait|lay|layout|background|look|grade|film)\b/i.test(s) ? s : `${s} photo`;
  return cap(text.withA(noun));
}

// ---------- packs ----------

function templatesOf(packId) {
  const p = PACKS[packId];
  return p ? p.templates : [];
}

const PACK_OF = Object.fromEntries(PACK_IDS.flatMap((p) => PACKS[p].templates.map((t) => [t.id, p])));

// The pack's own defaults (like a client's home for local services) under the member's values.
function withPackSlots(packId, slots = {}) {
  const out = { ...((PACKS[packId] && PACKS[packId].slots) || {}) };
  for (const [k, v] of Object.entries(slots || {})) if (v != null && String(v).trim() !== '') out[k] = v;
  return out;
}

function findTemplate(id) {
  for (const p of PACK_IDS) {
    const t = templatesOf(p).find((x) => x.id === id);
    if (t) return t;
  }
  return null;
}

// A pack template, built for one model with the member's slots.
function render(template, { model, slots, aspect, seconds, fromImage, seed } = {}) {
  const t = typeof template === 'string' ? findTemplate(template) : template;
  if (!t) throw new Error('That prompt template does not exist.');
  slots = withPackSlots(PACK_OF[t.id], slots);
  const shot = { subject: t.subject, action: t.action, camera: t.camera, setting: t.setting, light: t.light, mood: t.mood, style: t.style, lens: t.lens, motion: t.motion, text: t.text };
  const b = build({ model, shot, aspect, seconds: seconds || t.seconds || 5, fromImage, audio: t.audio, slots, seed: `${seed || ''}|${t.id}` });
  return { id: t.id, title: t.title, use: t.use || '', ...b };
}

// A stable shuffle by seed (so "the next 12" differ by business but not between runs).
function seeded(list, seed) {
  return list.map((x) => ({ x, k: text.hash(`${seed}|${x.id}`) })).sort((a, b) => a.k - b.k).map((o) => o.x);
}

// count prompts from a pack for one model. The first ones keep the pack's order (its best openers),
// the rest are picked by seed so different businesses see different picks.
function packPrompts({ pack = 'product', model = 'kling', slots = {}, count = 12, seed = '', aspect, seconds, fromImage = false } = {}) {
  const list = templatesOf(PACKS[pack] ? pack : 'product');
  const n = Math.max(1, Math.min(count, list.length));
  const head = list.slice(0, Math.min(4, n));
  const rest = seeded(list.slice(head.length), seed).slice(0, n - head.length);
  return [...head, ...rest].map((t, i) => ({ n: i + 1, ...render(t, { model, slots, aspect, seconds, fromImage, seed }) }));
}

// ---------- shot lists ----------

const KIND_ALIASES = { 'b-roll': 'broll', b_roll: 'broll', talking_head: 'talking', beforeafter: 'before_after', 'before-after': 'before_after' };
const EXTRA_FROM = { product: ['product'], ugc: ['ugc'], cinematic: ['cinematic'], faceless: ['faceless'], broll: ['faceless', 'local-service'], talking: ['ugc'], before_after: ['local-service'], unboxing: ['product'] };
const SHOT_KINDS = Object.keys(PACKS['shot-lists'].kinds);

// [{ n, title, shot: { subject, action, camera, setting, light, mood, style, lens, motion }, seconds, move, audio }]
// The five beats of the video type, then extra shots from the matching pack, kept before the closer.
function shotList({ kind = 'product', subject, setting, count = 5, seconds = 5, brand, seed = '', person, service, city, before, after } = {}) {
  const k0 = KIND_ALIASES[String(kind || '').toLowerCase()] || String(kind || '').toLowerCase();
  const k = SHOT_KINDS.includes(k0) ? k0 : 'product';
  const n = Math.max(1, Math.min(Number(count) || 5, 12));
  const b = typeof brand === 'string' ? { name: brand } : brand || {};
  const slots = withPackSlots('shot-lists', { product: subject, setting, person, service, city, before, after, business: b.name, brand_color: b.color });
  const s = slotsOf(slots);
  const beats = templatesOf('shot-lists').filter((t) => t.kind === k);
  let chosen;
  if (n <= beats.length) {
    // Keep the hook and the closer; drop middle beats when fewer shots are asked for.
    chosen = n === 1 ? [beats[0]] : [...beats.slice(0, n - 1), beats[beats.length - 1]];
  } else {
    const pool = seeded(EXTRA_FROM[k].flatMap(templatesOf), `${seed}|${k}|${s.product}`);
    const extra = pool.slice(0, n - beats.length);
    chosen = [...beats.slice(0, -1), ...extra, beats[beats.length - 1]];
  }
  return chosen.map((t, i) => {
    const sd = `${seed}|${t.id}|${i}`;
    const camId = pick(t.camera, `${sd}|camera`);
    const mv = moveOf(camId);
    const shot = {};
    for (const key of ['subject', 'action', 'setting', 'light', 'mood', 'style', 'lens', 'motion']) shot[key] = fill(pick(t[key], `${sd}|${key}`), s, 'kling');
    shot.camera = mv ? mv.base : camId;
    if (!shot.style) shot.style = 'realistic';
    const out = { n: i + 1, title: t.title, shot, seconds: Number(seconds) || 5, move: mv ? mv.name : '' };
    if (t.audio) out.audio = Object.fromEntries(Object.entries(t.audio).map(([a, v]) => [a, fill(v, s, 'kling')]));
    return out;
  });
}

// ---------- files: the printable sheet and the CSV ----------

const esc = files.esc;

// One printable page of prompts: no scripts, inline CSS, phone-friendly, prints clean, the member's
// colors. items: [{ n, title, use, camera, prompt, negative, notes, seconds, aspect, preset }]
function sheetHtml({ title, business, model, items, brandColor, intro, footer } = {}) {
  const p = color.palette(color.isHex(brandColor) ? brandColor : 'clean');
  const st = STYLE[model] || STYLE.kling;
  const css = `@page{size:letter;margin:14mm}*{box-sizing:border-box}body{margin:0;font:15px/1.5 -apple-system,Segoe UI,Inter,Roboto,Arial,sans-serif;color:${p.ink};background:${p.paper}}
main{max-width:860px;margin:0 auto;padding:20px 16px 40px}header{border-bottom:4px solid ${p.primary};padding-bottom:12px;margin-bottom:18px}
h1{font-size:26px;line-height:1.2;margin:0 0 4px}h2{font-size:17px;margin:0}.sub{color:${p.muted};margin:0}
.tips{background:${p.surface};border-radius:10px;padding:12px 16px;margin:0 0 18px}.tips h2{margin-bottom:6px}.tips ul{margin:0;padding-left:18px}
.card{border:1px solid ${p.line};border-radius:12px;padding:14px 16px;margin:0 0 14px;background:#fff;break-inside:avoid;page-break-inside:avoid}
.top{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.num{background:${p.primary};color:${p.onPrimary};border-radius:999px;min-width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.meta{color:${p.muted};font-size:13px;margin:4px 0 8px}.prompt{white-space:pre-wrap;word-wrap:break-word;background:${p.surface};border-left:4px solid ${p.primary};border-radius:6px;padding:10px 12px;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;margin:0}
.neg{font-size:13px;margin:8px 0 0}.notes{font-size:13px;color:${p.muted};margin:6px 0 0;padding-left:18px}footer{color:${p.muted};font-size:12px;margin-top:20px}
@media print{body{background:#fff}main{padding:0}.card{border-color:#ccc}.prompt{background:#f5f5f5}}@media (max-width:520px){h1{font-size:22px}.prompt{font-size:13px}}`;
  const cards = (items || []).map((it) => `<section class="card"><div class="top"><span class="num">${esc(it.n)}</span><h2>${esc(it.title)}</h2></div>
<p class="meta">${esc([it.use, it.camera ? `Camera: ${it.camera}` : '', it.preset ? `Preset: ${it.preset}` : '', it.aspect, it.seconds ? `${it.seconds} seconds` : ''].filter(Boolean).join(' | '))}</p>
<pre class="prompt">${esc(it.prompt)}</pre>${it.negative ? `<p class="neg"><strong>Negative prompt:</strong> ${esc(it.negative)}</p>` : ''}${(it.notes || []).length ? `<ul class="notes">${it.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</section>`).join('\n');
  const tips = (st.notes || []).slice(0, 4).map((n) => `<li>${esc(n)}</li>`).join('');
  const body = `<main><header><h1>${esc(title)}</h1><p class="sub">${esc([business, `Written for ${st.label}`].filter(Boolean).join(' | '))}</p></header>
${intro ? `<p>${esc(intro)}</p>` : ''}<div class="tips"><h2>How ${esc(st.label)} reads a prompt</h2><ul>${tips}</ul></div>
${cards}
<footer>${esc(footer || `Prompt advice from ${st.label}'s own guide, checked ${MODEL_DATA.checked}. Paste one prompt at a time and change one thing between tries.`)}</footer></main>`;
  return files.htmlDoc({ title, css, body });
}

function csvText(items, model) {
  const label = (STYLE[model] || {}).label || model;
  const rows = (items || []).map((it) => ({ n: it.n, title: it.title, use: it.use || '', model: label, camera: it.camera || '', preset: it.preset || '', aspect: it.aspect || '', seconds: it.seconds || '', prompt: it.prompt, negative: it.negative || '', notes: (it.notes || []).join(' ') }));
  return files.csv(rows, ['n', 'title', 'use', 'model', 'camera', 'preset', 'aspect', 'seconds', 'prompt', 'negative', 'notes']);
}

module.exports = {
  MODELS,
  STYLE,
  IMAGE_MODELS,
  CAMERA,
  PACKS,
  PACK_IDS,
  SLOTS,
  SHOT_KINDS,
  CHECKED: MODEL_DATA.checked,
  build,
  shotList,
  render,
  packPrompts,
  findTemplate,
  fill,
  colorName,
  sheetHtml,
  csvText,
};
