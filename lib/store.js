// The 127 Store (W7): one manifest for every template kind in HQ, behind STORE_V2 (default off).
// Contract: product/templates/store/STORE-SCHEMA.md. store.json and its files live in
// content/templates/ next to the v1 Library's manifest.json (synced by scripts/sync-templates.js),
// never in public/, so Builder files are only served through the gated Store route.
//
// STORE_V2 is a workspace flag (lib/harness/flags.js): "on" shows the Store to every member HQ v2
// is on for, but only while TERMS_LIVE and PRIVACY_LIVE are both true (until then it acts as
// "admins"); "admins" shows it to ADMIN_EMAILS only; off or unset: every Store page 404s and the
// nav shows no Store. An item with its own `flag` (STORE_SITES) also needs that flag on.
//
// A fillable download has a token source next to it (files/<id>/<name>.tpl) that "Make it mine"
// fills (lib/packs/store). A .tpl file is never served to members.

const fs = require('fs');
const path = require('path');
const { PLANS, canAccess } = require('./plans');
const flags = require('./harness/flags');

const DIR = path.join(__dirname, '..', 'content', 'templates');
const PROMPTS_FILE = path.join(__dirname, '..', 'content', 'prompts', 'manifest.json');

// The fixed lists from STORE-SCHEMA.md. store.json may relabel them, never add to them.
const KINDS = {
  site: 'Website template',
  shopify: 'Shopify sections',
  notion: 'Notion system',
  sheet: 'Sheet',
  doc: 'Doc',
  email: 'Email template',
  social: 'Social template',
  deck: 'Deck',
  checklist: 'Checklist',
  recipe: 'Automation recipe',
  'video-prompts': 'Video prompt pack',
  prompts: 'Prompt pack',
};
const BUSINESS_TYPES = {
  local: 'Local service',
  ecom: 'Online store',
  creator: 'Creator or UGC',
  idea: 'Own idea or website',
  coach: 'Coaching or digital product',
  any: 'Any business',
};
const TOKENS = {
  'business.name': { label: 'Your business name', fallback: '[Your business]' },
  'business.what': { label: 'What you do', fallback: '[What you do]' },
  'business.offer': { label: 'Your offer', fallback: '[Your offer]' },
  'business.price': { label: 'Your price', fallback: '[Your price]' },
  'business.audience': { label: "Who it's for", fallback: "[Who it's for]" },
  'business.city': { label: 'Your city', fallback: '[Your city]' },
  'business.region': { label: 'Your area', fallback: '[Your area]' },
  'business.address': { label: 'Mailing address', fallback: '[Your mailing address]' },
  'owner.first': { label: 'Your first name', fallback: '[Your name]' },
  'links.website': { label: 'Website', fallback: '[yourwebsite.com]' },
  'links.booking': { label: 'Booking link', fallback: '[your booking link]' },
  'links.instagram': { label: 'Instagram', fallback: '[@yourhandle]' },
  'links.tiktok': { label: 'TikTok', fallback: '[@yourhandle]' },
  'links.youtube': { label: 'YouTube', fallback: '[your channel]' },
  'brand.color': { label: 'Brand color', fallback: '#F5F5F5' },
  'contact.email': { label: 'Email for customers', fallback: '[you@yourbusiness.com]', asked: true },
  'contact.phone': { label: 'Phone for customers', fallback: '[your phone]', asked: true },
  today: { label: "Today's date", fallback: '[date]' },
  year: { label: 'This year', fallback: '[year]' },
};
const STATUSES = ['ready', 'coming'];
const OWNERS = ['templates', 'design', 'media', 'prompts'];
const LINK_TYPES = ['copy', 'duplicate', 'open'];

// What each download is served as. Anything else never leaves the disk.
const TYPES = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.gs': 'text/plain; charset=utf-8',
  '.liquid': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};
const PREVIEW_EXT = ['.png', '.jpg', '.webp'];

// Ids and file names are plain lowercase words (the v1 Library's rules); anything else never
// reaches the disk. A path is always files/<id>/<name>, so nothing climbs out of files/.
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const SAFE_FILE = /^[a-z0-9][a-z0-9.-]{0,120}$/;
const TOKEN_KEY = /^(?:[a-z]+\.[a-z]+|today|year)$/;
const FLAG_NAME = /^[A-Z][A-Z0-9_]{1,40}$/;
const PROMPT_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const GROUP_ID = /^[a-z0-9_-]{1,40}$/;
const CELL = /^(.{1,31})!([A-Z]{1,3}[1-9][0-9]{0,6})$/;
// Outside links are https only. A same-site link is an /app/ path with no empty or dot segments (the site templates' Make it mine opens /app/hq/w/...).
const HTTPS_URL = /^https:\/\/[^\s"'<>]+$/;
const APP_PATH = /^\/app\/[A-Za-z0-9._~\/?=&%+,:@-]*$/;
const appPath = (u) => APP_PATH.test(u) && !u.split(/[?#]/)[0].split('/').slice(1).some((seg, i, all) => seg === '..' || seg === '.' || (seg === '' && i < all.length - 1));
const isTpl = (name) => /\.tpl$/i.test(String(name));
const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const str = (v) => typeof v === 'string' && v.trim() !== '';

// ---------- flags ----------

// 'on', 'admins' or 'off', as lib/harness/flags.js reads STORE_V2.
function setting() {
  return flags.value('STORE_V2');
}

function flagOn(name) {
  const v = String(process.env[name] || '').toLowerCase();
  return v === 'on' || v === 'true';
}

// The Store lives in HQ v2, so a member sees it only where HQ v2 is on for them too. flags.on applies
// the TERMS_LIVE and PRIVACY_LIVE gate: before Legal is live, only ADMIN_EMAILS see it.
function enabledFor(user) {
  if (!user || !flags.on('STORE_V2', user)) return false;
  return require('./harness').enabledFor(user); // lazily: the store pack requires this file while the harness loads packs
}

// The plan HQ uses for this member (an admin can give early access to a plan).
function tierOf(user) {
  try {
    return require('./harness').ledger.tierOf(user);
  } catch {
    return (user && user.tier) || 'free';
  }
}

const rank = (tier) => (PLANS[tier] || PLANS.free).rank;
const higher = (...tiers) => tiers.filter((t) => has(PLANS, t)).reduce((a, b) => (rank(b) > rank(a) ? b : a), 'free');

// ---------- the prompts manifest ----------

// The prompt text comes from content/prompts/manifest.json, which the Harness thread keeps for HQ's
// prompt library (lib/harness/prompts.js, already without `origin`). Only these keys ever leave
// this file, so `origin` (where a prompt came from) is never shown or sent even if a copy has it.
const PROMPT_KEYS = ['id', 'group', 'title', 'tier', 'when', 'prompt', 'variables'];

function indexPrompts(groups, prompts) {
  const out = { groups: {}, byId: {}, missing: false };
  for (const p of prompts || []) {
    if (!p || !PROMPT_ID.test(String(p.id || '')) || !has(PLANS, p.tier)) continue;
    const clean = {};
    for (const k of PROMPT_KEYS) if (p[k] !== undefined) clean[k] = p[k];
    out.byId[p.id] = clean;
  }
  for (const g of groups || []) {
    if (!g || !GROUP_ID.test(String(g.id || ''))) continue;
    out.groups[g.id] = { id: g.id, title: String(g.title || ''), intro: String(g.intro || ''), prompts: (g.prompts || []).filter((id) => has(out.byId, id)) };
  }
  return out;
}

// file: a prompts manifest of its own (tests, the sync script); left out, the Harness's copy.
function loadPrompts(file) {
  if (!file) {
    try {
      const L = require('./harness/prompts').load();
      if (L.prompts.length) return indexPrompts(L.groups, L.prompts);
    } catch {
      /* the harness copied outside the site */
    }
    file = PROMPTS_FILE;
  }
  if (!fs.existsSync(file)) return { groups: {}, byId: {}, missing: true };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return indexPrompts(raw && raw.groups, raw && raw.prompts);
}

// ---------- validation ----------

function filePath(id, rel, problems, what) {
  const name = path.basename(String(rel || ''));
  if (!SAFE_FILE.test(name) || rel !== `files/${id}/${name}`) {
    problems.push(`${id}: bad ${what} path ${rel}`);
    return null;
  }
  return name;
}

// The problems with one item (an empty list means it's fine), plus the item as the Store uses it.
function checkItem(raw, { kinds, types, tokens }) {
  const problems = [];
  const id = raw && raw.id;
  if (!raw || typeof raw !== 'object' || !SAFE_ID.test(String(id || ''))) return { problems: [`bad id ${raw && JSON.stringify(raw.id)}`] };
  const say = (p) => problems.push(`${id}: ${p}`);
  if (!str(raw.title)) say('needs a title');
  if (!has(kinds, raw.kind)) say(`unknown kind ${raw.kind}`);
  if (!Array.isArray(raw.businessTypes) || !raw.businessTypes.length || raw.businessTypes.some((t) => !has(types, t))) say('businessTypes must be one or more of the schema types');
  if (!has(PLANS, raw.tier)) say(`tier ${raw.tier} isn't a plan key in lib/plans.js`);
  if (!str(raw.summary) || raw.summary.length > 170) say('summary must be one sentence of at most 170 characters');
  if (!STATUSES.includes(raw.status)) say('status must be ready or coming');
  if (raw.owner !== undefined && !OWNERS.includes(raw.owner)) say(`unknown owner ${raw.owner}`);
  if (raw.flag != null && !FLAG_NAME.test(String(raw.flag))) say(`bad flag ${raw.flag}`);
  if (raw.library != null && !SAFE_ID.test(String(raw.library))) say(`bad library slug ${raw.library}`);
  if (raw.tags !== undefined && (!Array.isArray(raw.tags) || raw.tags.some((t) => typeof t !== 'string'))) say('tags must be a list of words');
  if (raw.disclaimer != null && (typeof raw.disclaimer !== 'string' || raw.disclaimer.length > 600)) say('disclaimer must be text of at most 600 characters');
  if (raw.howTo != null && (!Array.isArray(raw.howTo) || raw.howTo.some((t) => typeof t !== 'string'))) say('howTo must be a list of steps');

  const previewFile = raw.preview == null ? null : filePath(id, raw.preview, problems, 'preview');
  if (previewFile && (!PREVIEW_EXT.includes(path.extname(previewFile)) || isTpl(previewFile))) say(`preview must be a .png, .jpg or .webp image`);

  const files = {};
  for (const f of Array.isArray(raw.formats) ? raw.formats : []) {
    const name = f && filePath(id, f.file, problems, 'file');
    if (!name) continue;
    const ext = path.extname(name).toLowerCase();
    if (isTpl(name)) say(`a .tpl source can't be a download (${name})`);
    else if (!TYPES[ext]) say(`can't serve ${name}`);
    else if (has(files, name)) say(`duplicate file ${name}`);
    else files[name] = { format: String(f.format || ''), label: String(f.label || name), file: f.file, bytes: Number(f.bytes) || 0, sha256: f.sha256 || null, fillable: f.fillable === true, name, ext };
  }
  if (raw.formats !== undefined && !Array.isArray(raw.formats)) say('formats must be a list');

  const links = [];
  for (const l of Array.isArray(raw.links) ? raw.links : []) {
    const url = String((l && l.url) || '');
    const internal = appPath(url);
    if (!l || !str(l.label) || !(internal || HTTPS_URL.test(url)) || !LINK_TYPES.includes(l.type)) say(`bad link ${JSON.stringify(l)}`);
    else links.push({ label: l.label, url, type: l.type, internal });
  }

  let makeItMine = null;
  if (raw.makeItMine != null) {
    const m = raw.makeItMine;
    const out = { files: [], tokens: [], asks: [], cells: [] };
    for (const name of Array.isArray(m.files) ? m.files : []) {
      const f = has(files, name) ? files[name] : null;
      if (!f) say(`makeItMine file ${name} isn't one of its formats`);
      else out.files.push(name);
    }
    for (const t of [].concat(m.tokens || [], m.asks || [])) if (!TOKEN_KEY.test(String(t)) || !has(tokens, t)) say(`unknown token ${t}`);
    out.tokens = (m.tokens || []).filter((t) => has(tokens, t));
    out.asks = (m.asks || []).filter((t) => has(tokens, t));
    for (const c of Array.isArray(m.cells) ? m.cells : []) {
      if (!c || !CELL.test(String(c.cell || '')) || typeof c.value !== 'string' || (c.number !== undefined && typeof c.number !== 'boolean')) say(`bad cell ${JSON.stringify(c)}`);
      else out.cells.push({ cell: c.cell, value: c.value, number: c.number === true });
    }
    // Each file is filled from its .tpl source, or (an xlsx with cells) set cell by cell.
    for (const name of out.files) {
      if (!files[name].fillable && !(files[name].ext === '.xlsx' && out.cells.length)) say(`makeItMine file ${name} has no .tpl source and no cells`);
    }
    if (out.cells.length && !out.files.some((n) => files[n].ext === '.xlsx')) say('makeItMine cells need an .xlsx file');
    if (!out.files.length) say('makeItMine needs at least one file');
    makeItMine = out;
  }

  let source = null;
  let prompts = [];
  if (raw.kind === 'prompts' || raw.prompts !== undefined) {
    if (raw.source != null && (!raw.source || !GROUP_ID.test(String(raw.source.group || '')))) say('bad prompts source group');
    else if (raw.source) source = { group: raw.source.group };
    for (const p of Array.isArray(raw.prompts) ? raw.prompts : []) {
      if (!p || !PROMPT_ID.test(String(p.id || '')) || !has(PLANS, p.tier)) say(`bad prompt ${JSON.stringify(p && p.id)}`);
      else prompts.push({ id: p.id, title: String(p.title || ''), tier: p.tier, when: String(p.when || '') });
    }
  }

  const item = {
    id,
    title: String(raw.title || ''),
    kind: raw.kind,
    businessTypes: Array.isArray(raw.businessTypes) ? raw.businessTypes.slice() : [],
    tier: raw.tier,
    summary: String(raw.summary || ''),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    status: raw.status,
    owner: raw.owner || null,
    preview: raw.preview || null,
    previewFile,
    formats: Object.values(files),
    files,
    links,
    makeItMine,
    library: raw.library || null,
    flag: raw.flag || null,
    howTo: Array.isArray(raw.howTo) ? raw.howTo.map(String) : null,
    minutes: Number(raw.minutes) > 0 ? Number(raw.minutes) : null,
    output: typeof raw.output === 'string' ? raw.output : null,
    // Legal's note for an item (a proposal, a quote): shown on its card, its page and the Make it
    // mine result, never written into a file.
    disclaimer: typeof raw.disclaimer === 'string' && raw.disclaimer.trim() ? raw.disclaimer.trim() : null,
    groupTitle: typeof raw.groupTitle === 'string' ? raw.groupTitle : null,
    source,
    prompts,
  };
  return { problems, item };
}

// Loads and checks store.json. A broken top level throws; a broken item is left out and listed in
// `problems` (strict: true throws instead, for the sync script and tests). No store.json yet: an
// empty Store.
function load(dir = DIR, { strict = false, promptsFile = null } = {}) {
  const file = path.join(dir, 'store.json');
  const prompts = loadPrompts(promptsFile);
  const empty = { version: null, kinds: { ...KINDS }, types: { ...BUSINESS_TYPES }, tokens: { ...TOKENS }, items: [], byId: {}, problems: [], dir, prompts, missing: true };
  if (!fs.existsSync(file)) return empty;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw || !Array.isArray(raw.items)) throw new Error('store.json has no items[]');
  const problems = [];
  const kinds = { ...KINDS };
  for (const [k, label] of Object.entries(raw.kinds || {})) {
    if (!has(KINDS, k)) problems.push(`kinds: ${k} isn't a schema kind`);
    else if (str(label)) kinds[k] = label;
  }
  const types = { ...BUSINESS_TYPES };
  for (const [k, label] of Object.entries(raw.businessTypes || {})) {
    if (!has(BUSINESS_TYPES, k)) problems.push(`businessTypes: ${k} isn't a schema type`);
    else if (str(label)) types[k] = label;
  }
  const tokens = JSON.parse(JSON.stringify(TOKENS));
  for (const [k, t] of Object.entries(raw.tokens || {})) {
    if (!has(TOKENS, k)) problems.push(`tokens: ${k} isn't a schema token`);
    else if (t && typeof t === 'object') {
      if (str(t.label)) tokens[k].label = t.label;
      if (typeof t.fallback === 'string') tokens[k].fallback = t.fallback;
    }
  }
  const byId = {};
  const items = [];
  for (const r of raw.items) {
    const { problems: p, item } = checkItem(r, { kinds, types, tokens });
    if (item && has(byId, item.id)) p.push(`${item.id}: duplicate id`);
    if (p.length) {
      problems.push(...p);
      continue;
    }
    byId[item.id] = item;
    items.push(item);
  }
  if (strict && problems.length) throw new Error(`store.json:\n${problems.join('\n')}`);
  if (problems.length) console.warn(`[store] left out of the Store: ${problems.join('; ')}`);
  return { version: raw.version || null, kinds, types, tokens, items, byId, problems, dir, prompts, missing: false };
}

let lib = null;
function current() {
  if (!lib) {
    try {
      lib = load();
    } catch (err) {
      console.error(`[store] ${err.message}`);
      lib = { ...load(path.join(DIR, '__none__')), problems: [err.message] };
    }
  }
  return lib;
}
// Tests (and a re-sync without a restart) point the Store at another folder.
function use(l) {
  lib = l;
  return lib;
}

// ---------- reading ----------

const visible = (item) => !!item && (!item.flag || flagOn(item.flag));

function get(id, l = current()) {
  const item = has(l.byId, String(id)) ? l.byId[id] : null;
  return visible(item) ? item : null;
}

const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// The gallery: by kind, by business type (an item for `any` business fits every type), and by
// search words over the title, summary, tags and kind label (every word must match). Ready items
// first, then "Coming soon", each in store.json's order.
function list({ kind, type, q } = {}, l = current()) {
  const want = words(q);
  const out = l.items.filter((item) => {
    if (!visible(item)) return false;
    if (kind && item.kind !== kind) return false;
    if (type && type !== 'any' && !item.businessTypes.includes(type) && !item.businessTypes.includes('any')) return false;
    if (!want.length) return true;
    const hay = [item.title, item.summary, item.tags.join(' '), l.kinds[item.kind] || '', item.groupTitle || ''].join(' ').toLowerCase();
    return want.every((w) => hay.includes(w));
  });
  return out.filter((i) => i.status === 'ready').concat(out.filter((i) => i.status !== 'ready'));
}

// Kinds and business types that have at least one visible item, for the filter chips.
function facets(l = current()) {
  const shown = l.items.filter(visible);
  const kinds = Object.keys(l.kinds).filter((k) => shown.some((i) => i.kind === k)).map((k) => ({ key: k, label: l.kinds[k] }));
  const types = Object.keys(l.types).filter((t) => t !== 'any').map((t) => ({ key: t, label: l.types[t] }));
  return { kinds, types };
}

// A requested download, looked up in store.json. Null for anything it doesn't list, for any .tpl
// source, for an item that is coming soon (only its preview), and for an item whose flag is off.
function resolveFile(id, name, l = current()) {
  if (!SAFE_ID.test(String(id)) || !SAFE_FILE.test(String(name)) || isTpl(name)) return null;
  const item = get(id, l);
  if (!item) return null;
  const isPreview = !!item.previewFile && name === item.previewFile;
  let ext;
  if (isPreview) ext = path.extname(name).toLowerCase();
  else if (item.status === 'ready' && has(item.files, name)) ext = item.files[name].ext;
  else return null;
  if (!TYPES[ext]) return null;
  const root = path.join(l.dir, 'files', item.id);
  const abs = path.join(root, name);
  if (path.dirname(abs) !== root) return null;
  return { item, name, abs, root, isPreview, contentType: TYPES[ext] };
}

// For "Make it mine" only (never a route): where a file's fill source is. A fillable file's source
// is its .tpl; an xlsx filled by cells starts from the clean file.
function sourceFile(id, name, l = current()) {
  const item = get(id, l);
  if (!item || !item.makeItMine || !item.makeItMine.files.includes(name) || !has(item.files, name)) return null;
  const f = item.files[name];
  const src = f.fillable ? `${name}.tpl` : name;
  const root = path.join(l.dir, 'files', item.id);
  const abs = path.join(root, src);
  if (path.dirname(abs) !== root || !SAFE_FILE.test(src)) return null;
  return { item, file: f, abs, tpl: f.fillable };
}

function canOpen(user, item) {
  return !!item && canAccess({ tier: tierOf(user) }, item.tier);
}

// A prompt group from the prompts manifest, without `origin`.
function promptsForGroup(group, l = current()) {
  const g = has(l.prompts.groups, group) ? l.prompts.groups[group] : null;
  return g ? g.prompts.map((id) => ({ ...l.prompts.byId[id] })) : [];
}

// A prompt pack's prompts for this member: title, when and the lock always; the text only when
// their plan covers the prompt (the stricter of the Store's and the prompts manifest's tier, and
// the item's own).
function promptsFor(item, user, l = current()) {
  if (!item || !item.prompts.length) return [];
  const tier = tierOf(user);
  return item.prompts.map((p) => {
    const m = has(l.prompts.byId, p.id) ? l.prompts.byId[p.id] : null;
    const need = higher(item.tier, p.tier, m ? m.tier : 'free');
    const open = canAccess({ tier }, need);
    return { id: p.id, title: p.title || (m && m.title) || '', when: p.when || (m && m.when) || '', tier: need, locked: !open, text: open && m && typeof m.prompt === 'string' ? m.prompt : null, missing: !m };
  });
}

function fmtBytes(b) {
  if (!b && b !== 0) return '';
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

module.exports = {
  KINDS, BUSINESS_TYPES, TOKENS, TYPES, SAFE_ID, SAFE_FILE,
  setting, flagOn, enabledFor, tierOf,
  load, loadPrompts, checkItem, use, current,
  get, list, facets, resolveFile, sourceFile, canOpen, promptsForGroup, promptsFor, fmtBytes,
};
