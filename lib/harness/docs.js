// The Brain's documents: what a member writes or adds so every tool, Ask 127 and their own Claude
// know the business. Docs (pasted, uploaded, or imported from an Obsidian vault or Notion export),
// house rules (principles, ways of working, checks every answer must pass), a decisions log and
// numbers the member logs. Search is in-process: chunks scored with BM25, no outside service.
//
// Kept: each doc's text (never the original file), its title, tags, [[links]] and frontmatter;
// decisions and numbers. Deleted with "Delete this doc", "Delete everything in my Brain" and with
// the account. Behind BRAIN_DOCS (lib/harness/flags.js); Legal row 1 in v2/turnkey/LEGAL-ASKS.md.

const deps = { db: require('../db'), now: () => Date.now() };
const { readZip, makeZip } = require('./zipfile');
const { extract, kindOf } = require('./extract');
const { clip } = require('./text');

const LIMITS = {
  docs: 1000,
  docChars: 300000,
  totalChars: 5000000,
  log: 2000,
  title: 140,
  tags: 30,
  rule: 8000,
  zipFiles: 2000,
  zipBytes: 40 * 1024 * 1024,
};

// ---------- small helpers ----------
const iso = () => new Date(deps.now()).toISOString();
const versions = new Map();
const bump = (memberId) => versions.set(memberId, (versions.get(memberId) || 0) + 1);

function cleanTitle(t) {
  return String(t || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.title) || 'Untitled';
}

function cleanTag(t) {
  return String(t || '').replace(/^#/, '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_/-]/gu, '').slice(0, 40);
}

// ---------- frontmatter, tags and [[links]] ----------
function unquote(v) {
  const s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

// The YAML Obsidian writes: key: value, key: [a, b], and key: followed by "- item" lines.
function parseFrontmatter(text) {
  const m = String(text).match(/^﻿?---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/);
  if (!m) return { data: {}, body: String(text) };
  const data = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = line.match(/^\s+-\s*(.*)$/) || (listKey && line.match(/^-\s*(.*)$/));
    if (item && listKey) {
      data[listKey].push(unquote(item[1]).slice(0, 200));
      continue;
    }
    const kv = line.match(/^([\w][\w .-]{0,60}):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim();
    const v = kv[2].trim();
    if (Object.keys(data).length >= 40) break;
    if (!v) {
      data[key] = [];
      listKey = key;
    } else if (v.startsWith('[') && v.endsWith(']')) {
      data[key] = v.slice(1, -1).split(',').map((x) => unquote(x).slice(0, 200)).filter(Boolean);
      listKey = null;
    } else {
      data[key] = unquote(v).slice(0, 500);
      listKey = null;
    }
  }
  for (const [k, v] of Object.entries(data)) if (Array.isArray(v) && !v.length) data[k] = '';
  return { data, body: String(text).slice(m[0].length) };
}

function yamlValue(v) {
  if (Array.isArray(v)) return `[${v.map((x) => yamlValue(x)).join(', ')}]`;
  const s = String(v == null ? '' : v);
  return /^[\w .@/+-]*$/.test(s) && s.trim() === s && s !== '' ? s : JSON.stringify(s);
}

function frontmatter(data) {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}: ${yamlValue(v)}`);
  return lines.length ? `---\n${lines.join('\n')}\n---\n\n` : '';
}

const WIKILINK = /\[\[([^\]|#^\n]+)(#[^\]|\n]*)?(?:\|([^\]\n]*))?\]\]/g;

function linksIn(body) {
  const out = new Set();
  for (const m of String(body).matchAll(WIKILINK)) out.add(m[1].trim().slice(0, LIMITS.title));
  return [...out].slice(0, 200);
}

function tagsIn(body, fm = {}) {
  const out = new Set();
  const fromFm = [].concat(fm.tags || [], fm.tag || []).flatMap((t) => String(t).split(/[\s,]+/));
  for (const t of fromFm) if (cleanTag(t)) out.add(cleanTag(t));
  const prose = String(body).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of prose.matchAll(/(?:^|[\s(])#([\p{L}_][\p{L}\p{N}_/-]*)/gu)) if (cleanTag(m[1])) out.add(cleanTag(m[1]));
  return [...out].slice(0, LIMITS.tags);
}

// ---------- docs ----------
function list(memberId) {
  return deps.db.filter('brainDocs', (d) => d.memberId === memberId).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function get(memberId, id) {
  const d = deps.db.get('brainDocs', String(id || ''));
  return d && d.memberId === memberId ? d : null;
}

function usedChars(memberId, except) {
  return list(memberId).reduce((n, d) => n + (d.id === except ? 0 : (d.body || '').length), 0);
}

function view(d) {
  return { id: d.id, title: d.title, path: d.path || '', tags: d.tags || [], links: d.links || [], source: d.source, kind: d.kind, public: !!d.public, chars: (d.body || '').length, createdAt: d.createdAt, updatedAt: d.updatedAt, url: `/app/hq/brain/docs/${d.id}` };
}

// fields: { title, body, tags, public, source, kind, path, frontmatter, id (to update) }
async function save(memberId, fields = {}) {
  const existing = fields.id ? get(memberId, fields.id) : null;
  if (fields.id && !existing) throw new Error("That doc isn't in your Brain anymore.");
  let body = String(fields.body == null ? (existing ? existing.body : '') : fields.body).replace(/\r\n?/g, '\n');
  if (!body.trim()) throw new Error('That doc is empty.');
  if (body.length > LIMITS.docChars) throw new Error(`That doc is ${body.length.toLocaleString('en-US')} characters. The limit is ${LIMITS.docChars.toLocaleString('en-US')}: split it into parts.`);
  if (!existing && list(memberId).length >= LIMITS.docs) throw new Error(`Your Brain holds ${LIMITS.docs} docs at most. Delete some old ones first.`);
  if (usedChars(memberId, existing && existing.id) + body.length > LIMITS.totalChars) throw new Error('Your Brain is full. Delete some old docs first.');
  const fm = fields.frontmatter || (existing && existing.frontmatter) || {};
  const extraTags = Array.isArray(fields.tags) ? fields.tags : typeof fields.tags === 'string' ? fields.tags.split(/[\s,]+/) : [];
  const tags = [...new Set([...extraTags.map(cleanTag).filter(Boolean), ...tagsIn(body, fm)])].slice(0, LIMITS.tags);
  const d = existing || { id: deps.db.id(), memberId, createdAt: iso() };
  d.title = cleanTitle(fields.title !== undefined ? fields.title : existing ? existing.title : body.split('\n').find((l) => l.trim()).replace(/^#+\s*/, ''));
  d.body = body;
  d.tags = tags;
  d.links = linksIn(body);
  d.frontmatter = fm;
  d.source = fields.source || (existing && existing.source) || 'paste';
  d.kind = fields.kind || (existing && existing.kind) || 'markdown';
  d.path = clip(fields.path !== undefined ? fields.path : (existing && existing.path) || '', 200);
  d.public = fields.public !== undefined ? !!fields.public : !!(existing && existing.public);
  await deps.db.save('brainDocs', d);
  bump(memberId);
  return d;
}

async function addFile(memberId, fileName, buf) {
  const { text, kind } = extract(fileName, buf);
  const base = String(fileName || 'file').split(/[\\/]/).pop().replace(/\.[a-z0-9]{1,8}$/i, '');
  const parsed = kind === 'markdown' ? parseFrontmatter(text) : { data: {}, body: text };
  return save(memberId, { title: parsed.data.title || base, body: parsed.body.trim() || text, frontmatter: parsed.data, source: 'file', kind });
}

async function remove(memberId, id) {
  const d = get(memberId, id);
  if (!d) return false;
  await deps.db.remove('brainDocs', d.id);
  bump(memberId);
  return true;
}

// ---------- house rules ----------
const RULE_KEYS = ['principles', 'sops', 'checks'];

function rules(memberId) {
  const b = deps.db.get('brains', memberId);
  const r = (b && b.rules) || {};
  return { principles: r.principles || '', sops: r.sops || '', checks: r.checks || '', updatedAt: r.updatedAt || null };
}

async function setRules(memberId, patch = {}) {
  const b = deps.db.get('brains', memberId) || { id: memberId, business: {}, voice: {}, links: {}, goal: {}, packs: {} };
  const r = { ...(b.rules || {}) };
  for (const k of RULE_KEYS) {
    if (patch[k] === undefined) continue;
    const v = String(patch[k] || '').replace(/\r\n?/g, '\n').trim();
    if (v.length > LIMITS.rule) throw new Error(`Keep each part of your house rules under ${LIMITS.rule.toLocaleString('en-US')} characters.`);
    r[k] = v;
  }
  r.updatedAt = iso();
  b.rules = r;
  await deps.db.save('brains', b);
  bump(memberId);
  return rules(memberId);
}

const hasRules = (r) => !!(r && (r.principles || r.sops || r.checks));

// Checks the engine can test without AI: "Never say: x, y", "Don't use: z", "Avoid: w".
function bannedPhrases(r) {
  const out = [];
  for (const line of String((r && r.checks) || '').split('\n')) {
    const m = line.replace(/^\s*[-*\d.)]+\s*/, '').match(/^(?:never (?:say|use|write|mention)|don'?t (?:say|use|write|mention)|do not (?:say|use|write|mention)|avoid|banned words?)\s*:?\s*(.+)$/i);
    if (!m) continue;
    for (const p of m[1].split(/[,;]/)) {
      const phrase = p.trim().replace(/^["'“‘]|["'”’.]$/g, '').trim();
      if (phrase.length >= 2 && phrase.length <= 60) out.push(phrase);
    }
  }
  return [...new Set(out)].slice(0, 50);
}

function checkText(r, text) {
  const s = typeof text === 'string' ? text : JSON.stringify(text || '');
  const problems = [];
  for (const p of bannedPhrases(r)) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu');
    if (re.test(s)) problems.push(`uses "${p}", which the house rules ban`);
  }
  return problems;
}

// What every AI call that writes or plans for the member receives.
function rulesNote(r) {
  if (!hasRules(r)) return '';
  const parts = ["The member's house rules. Follow them in everything you write for this business:"];
  if (r.principles) parts.push(`Principles:\n${clip(r.principles, 3000)}`);
  if (r.sops) parts.push(`How we do things (standard ways of working):\n${clip(r.sops, 4000)}`);
  if (r.checks) parts.push(`Checks every answer must pass:\n${clip(r.checks, 2000)}`);
  return parts.join('\n\n');
}

// ---------- decisions and numbers ----------
function logOf(memberId, type) {
  return deps.db.filter('brainLog', (e) => e.memberId === memberId && (!type || e.type === type)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

async function trimLog(memberId) {
  const all = logOf(memberId);
  for (const e of all.slice(LIMITS.log)) await deps.db.remove('brainLog', e.id);
}

// by: 'you', 'Ask 127', 'Your Claude (AI link)', or a team member's name
async function logDecision(memberId, { text, why, tags, by } = {}) {
  const t = clip(text, 600);
  if (!t) throw new Error('Write the decision first.');
  const e = { id: deps.db.id(), memberId, type: 'decision', text: t, why: clip(why, 1200), tags: (Array.isArray(tags) ? tags : String(tags || '').split(/[\s,]+/)).map(cleanTag).filter(Boolean).slice(0, 10), by: clip(by || 'you', 60), at: iso() };
  await deps.db.save('brainLog', e);
  await trimLog(memberId);
  bump(memberId);
  return e;
}

async function logNumber(memberId, { name, value, note, by } = {}) {
  const n = clip(name, 80);
  const v = Number(String(value == null ? '' : value).replace(/[,$\s%]/g, ''));
  if (!n) throw new Error('Name the number first, like "Calls booked".');
  if (!Number.isFinite(v)) throw new Error('That number needs to be a number.');
  const e = { id: deps.db.id(), memberId, type: 'number', name: n, value: v, note: clip(note, 300), by: clip(by || 'you', 60), at: iso() };
  await deps.db.save('brainLog', e);
  await trimLog(memberId);
  bump(memberId);
  return e;
}

async function removeLog(memberId, id) {
  const e = deps.db.get('brainLog', String(id || ''));
  if (!e || e.memberId !== memberId) return false;
  await deps.db.remove('brainLog', e.id);
  bump(memberId);
  return true;
}

// The latest value of each number, with the one before it.
function numbers(memberId) {
  const by = new Map();
  for (const e of logOf(memberId, 'number').reverse()) {
    const k = e.name.toLowerCase();
    const cur = by.get(k) || { name: e.name, history: [] };
    cur.history.push({ value: e.value, at: e.at, note: e.note, id: e.id });
    by.set(k, cur);
  }
  return [...by.values()].map((x) => ({ name: x.name, value: x.history[x.history.length - 1].value, at: x.history[x.history.length - 1].at, before: x.history.length > 1 ? x.history[x.history.length - 2].value : null, history: x.history.slice(-20) }));
}

// ---------- search: chunks + BM25 ----------
const STOP = new Set('a an and are as at be but by for from has have i if in into is it its me my of on or our so that the their them then there these they this to was we were what when where which who will with you your yours not no do does did can could should would just about than too very also how why all any'.split(' '));

function stem(w) {
  let s = w;
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith('ies')) s = `${s.slice(0, -3)}y`;
  else if (s.length > 4 && s.endsWith('ed')) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  return s.length > 3 && s.endsWith('e') ? s.slice(0, -1) : s;
}

function tokens(text) {
  return (String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
}

// Paragraph-sized chunks (about 900 characters), each carrying the headings above it.
function chunk(body) {
  const out = [];
  const heads = [];
  let buf = '';
  const flush = () => {
    if (buf.trim()) out.push({ heading: heads.filter(Boolean).join(' > '), text: buf.trim() });
    buf = '';
  };
  for (const para of String(body).split(/\n{2,}/)) {
    const h = para.match(/^(#{1,6})\s+(.+)$/m);
    if (h && para.trim().startsWith('#')) {
      flush();
      heads.length = h[1].length - 1;
      heads[h[1].length - 1] = h[2].trim().slice(0, 80);
      const rest = para.trim().split('\n').slice(1).join('\n');
      if (rest.trim()) buf = rest;
      continue;
    }
    if (buf && buf.length + para.length > 900) flush();
    if (para.length > 1400) {
      for (let i = 0; i < para.length; i += 1000) {
        buf = para.slice(i, i + 1100);
        flush();
      }
      continue;
    }
    buf += (buf ? '\n\n' : '') + para;
  }
  flush();
  return out;
}

const indexes = new Map();

function buildIndex(memberId) {
  const items = [];
  for (const d of list(memberId)) {
    for (const [i, c] of chunk(d.body).entries()) items.push({ id: `${d.id}:${i}`, docId: d.id, kind: 'doc', title: d.title, heading: c.heading, text: c.text, link: `/app/hq/brain/docs/${d.id}`, source: d.source, public: !!d.public, extra: `${d.title} ${(d.tags || []).join(' ')}` });
  }
  for (const e of logOf(memberId, 'decision')) items.push({ id: e.id, docId: null, kind: 'decision', title: `Decision, ${String(e.at).slice(0, 10)}`, heading: '', text: e.why ? `${e.text}\nWhy: ${e.why}` : e.text, link: '/app/hq/brain#decisions', source: 'decision', public: false, extra: `decision ${(e.tags || []).join(' ')}` });
  const r = rules(memberId);
  for (const k of RULE_KEYS) if (r[k]) items.push({ id: `rules:${k}`, docId: null, kind: 'rule', title: 'House rules', heading: { principles: 'Principles', sops: 'How we do things', checks: 'Checks' }[k], text: r[k].slice(0, 3000), link: '/app/hq/brain#rules', source: 'rules', public: false, extra: 'house rules' });
  const df = new Map();
  let total = 0;
  for (const it of items) {
    const tf = new Map();
    const words = [...tokens(it.text), ...tokens(`${it.heading} ${it.extra}`), ...tokens(it.title)];
    for (const w of words) tf.set(w, (tf.get(w) || 0) + 1);
    it.tf = tf;
    it.len = words.length || 1;
    total += it.len;
    for (const w of tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  }
  return { version: versions.get(memberId) || 0, items, df, avg: items.length ? total / items.length : 1 };
}

function indexFor(memberId) {
  const cur = indexes.get(memberId);
  if (cur && cur.version === (versions.get(memberId) || 0)) return cur;
  const ix = buildIndex(memberId);
  indexes.set(memberId, ix);
  if (indexes.size > 500) indexes.delete(indexes.keys().next().value);
  return ix;
}

function passage(text, qwords, max = 700) {
  if (text.length <= max) return text;
  const lower = text.toLowerCase();
  let best = 0;
  for (const w of qwords) {
    const i = lower.indexOf(w);
    if (i >= 0) {
      best = Math.max(0, i - 150);
      break;
    }
  }
  const s = text.slice(best, best + max);
  return `${best > 0 ? '...' : ''}${s.trim()}${best + max < text.length ? '...' : ''}`;
}

// Returns [{ id, docId, kind, title, heading, text, link, source, score }], best first.
function search(memberId, query, { limit = 5, publicOnly = false, kinds } = {}) {
  const q = [...new Set(tokens(query))].slice(0, 30);
  if (!q.length) return [];
  const ix = indexFor(memberId);
  const N = ix.items.length;
  const k1 = 1.2;
  const b = 0.75;
  const scored = [];
  for (const it of ix.items) {
    if (publicOnly && !it.public) continue;
    if (kinds && !kinds.includes(it.kind)) continue;
    let s = 0;
    for (const w of q) {
      const f = it.tf.get(w);
      if (!f) continue;
      const n = ix.df.get(w) || 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * it.len) / ix.avg));
    }
    if (s > 0) scored.push({ it, s });
  }
  scored.sort((x, y) => y.s - x.s);
  const raw = String(query).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return scored.slice(0, Math.max(1, Math.min(20, limit))).map(({ it, s }) => ({ id: it.id, docId: it.docId, kind: it.kind, title: it.title, heading: it.heading, text: passage(it.text, raw), link: it.link, source: it.source, score: Math.round(s * 100) / 100 }));
}

// Passages for an AI prompt, numbered so the answer can cite them as [1], [2].
function sourcesNote(hits) {
  if (!hits.length) return '';
  return `From the member's Brain (cite these as [1], [2] when you use them):\n${hits.map((h, i) => `[${i + 1}] ${h.title}${h.heading ? ` > ${h.heading}` : ''}\n${h.text}`).join('\n\n')}`;
}

// ---------- Obsidian vault and Notion export import ----------
function isNote(name) {
  const parts = name.split('/');
  if (parts.some((p) => p.startsWith('.') || p === '__MACOSX')) return false;
  return /\.(md|markdown)$/i.test(name);
}

// A zip of an Obsidian vault, or a Notion "Markdown & CSV" export. Notes with the same folder and
// title are updated, so importing the vault again refreshes it.
async function importZip(memberId, buf, { source = 'obsidian' } = {}) {
  const files = readZip(buf, { only: isNote, maxFiles: LIMITS.zipFiles, maxBytes: LIMITS.zipBytes });
  if (!files.length) throw new Error('No Markdown notes in that zip. Zip your vault folder (or a Notion Markdown export) and try again.');
  const existing = new Map(list(memberId).filter((d) => d.source === source).map((d) => [`${d.path}/${d.title}`.toLowerCase(), d]));
  const result = { added: 0, updated: 0, skipped: [] };
  // A vault zipped from its folder has one top folder: drop it from the paths.
  const tops = new Set(files.map((f) => (f.name.includes('/') ? f.name.split('/')[0] : '')));
  const strip = tops.size === 1 && !tops.has('') ? `${[...tops][0]}/` : '';
  for (const f of files) {
    const rel = f.name.startsWith(strip) ? f.name.slice(strip.length) : f.name;
    const parts = rel.split('/');
    // Notion names files "Title 1a2b3c...md": drop the id.
    let title = parts.pop().replace(/\.(md|markdown)$/i, '');
    if (source === 'notion') title = title.replace(/\s+[0-9a-f]{32}$/i, '');
    const folder = parts.map((p) => (source === 'notion' ? p.replace(/\s+[0-9a-f]{32}$/i, '') : p)).join('/');
    const text = f.data.toString('utf8').replace(/^﻿/, '');
    const { data, body } = parseFrontmatter(text);
    if (!body.trim()) {
      result.skipped.push(`${title} (empty)`);
      continue;
    }
    const prev = existing.get(`${clip(folder, 200)}/${cleanTitle(title)}`.toLowerCase());
    try {
      await save(memberId, { id: prev && prev.id, title, body: body.trim(), frontmatter: data, source, kind: 'markdown', path: folder });
      if (prev) result.updated++;
      else result.added++;
    } catch (err) {
      result.skipped.push(`${title} (${err.message})`);
      if (/Brain is full|docs at most/.test(err.message)) break;
    }
  }
  return result;
}

// ---------- export ----------
function fileSafe(s) {
  return String(s).replace(/[\\/:*?"<>|#^[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Untitled';
}

function uniqueNames(docs) {
  const seen = new Map();
  const names = new Map();
  for (const d of docs) {
    const base = fileSafe(d.title);
    const key = `${d.path || ''}/${base}`.toLowerCase();
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    names.set(d.id, n > 1 ? `${base} (${n})` : base);
  }
  return names;
}

function profileMd(snapshot) {
  const out = ['# Profile', ''];
  const groups = { business: 'Business', voice: 'Voice', links: 'Links', goal: 'Goal' };
  for (const [g, label] of Object.entries(groups)) {
    const o = (snapshot && snapshot[g]) || {};
    const rows = Object.entries(o).filter(([, v]) => v);
    if (!rows.length) continue;
    out.push(`## ${label}`, '', ...rows.map(([k, v]) => `- ${k}: ${v}`), '');
  }
  return out.join('\n');
}

function rulesMd(r) {
  return ['# House rules', '', '## Principles', '', r.principles || '_None yet._', '', '## How we do things', '', r.sops || '_None yet._', '', '## Checks', '', r.checks || '_None yet._', ''].join('\n');
}

function learningsMd(snapshot) {
  const out = ['# Learnings', '', 'What 127\'s tools remembered while working for you.', ''];
  for (const [pack, keys] of Object.entries((snapshot && snapshot.packs) || {})) {
    const rows = Object.entries(keys || {});
    if (!rows.length) continue;
    out.push(`## ${pack}`, '', ...rows.map(([k, v]) => `- ${k}: ${clip(typeof v === 'string' ? v : JSON.stringify(v), 300)}`), '');
  }
  return out.join('\n');
}

function numbersMd(memberId) {
  const rows = numbers(memberId);
  if (!rows.length) return '# Numbers\n\n_None logged yet._\n';
  return ['# Numbers', '', '| Number | Latest | Before | Logged |', '| --- | --- | --- | --- |', ...rows.map((n) => `| ${n.name} | ${n.value} | ${n.before === null ? '' : n.before} | ${String(n.at).slice(0, 10)} |`), ''].join('\n');
}

// format: 'obsidian' (frontmatter, [[wikilinks]], folders) or 'notion' (plain Markdown, links as
// relative Markdown links Notion's importer follows, properties as lines at the top).
function exportZip(memberId, snapshot, format = 'obsidian') {
  const root = '127 Brain';
  const docs = list(memberId).reverse();
  const names = uniqueNames(docs);
  const byTitle = new Map(docs.map((d) => [d.title.toLowerCase(), d]));
  const files = [];
  const notion = format === 'notion';
  const docPath = (d) => (notion ? `${root}/Docs/${names.get(d.id)}.md` : `${root}/Docs/${d.path ? `${d.path.split('/').map(fileSafe).join('/')}/` : ''}${names.get(d.id)}.md`);
  const toNotionLinks = (body) =>
    String(body).replace(WIKILINK, (m, target, anchor, alias) => {
      const d = byTitle.get(target.trim().toLowerCase());
      const label = (alias || target).trim();
      return d ? `[${label}](${encodeURI(`${names.get(d.id)}.md`)})` : label;
    });
  for (const d of docs) {
    const meta = { ...(d.frontmatter || {}), tags: d.tags || [], source: d.source, public: d.public ? 'yes' : 'no', created: String(d.createdAt || '').slice(0, 10), updated: String(d.updatedAt || '').slice(0, 10) };
    delete meta.tag;
    const body = notion
      ? `# ${d.title}\n\n${[d.tags && d.tags.length ? `Tags: ${d.tags.join(', ')}` : '', `Source: ${d.source}`, `Updated: ${meta.updated}`].filter(Boolean).join('\n')}\n\n${toNotionLinks(d.body)}\n`
      : `${frontmatter(meta)}${d.body}\n`;
    files.push({ name: docPath(d), data: body });
  }
  const decisions = logOf(memberId, 'decision').reverse();
  const decNames = [];
  const used = new Set();
  for (const e of decisions) {
    let n = `${String(e.at).slice(0, 10)} ${fileSafe(e.text).slice(0, 60)}`;
    while (used.has(n.toLowerCase())) n += ' (2)';
    used.add(n.toLowerCase());
    decNames.push(n);
    const body = `${notion ? `# ${e.text}\n\nDate: ${String(e.at).slice(0, 10)}\nBy: ${e.by}\n\n` : `${frontmatter({ date: String(e.at).slice(0, 10), by: e.by, tags: ['decision', ...(e.tags || [])] })}# ${e.text}\n\n`}${e.why ? `Why: ${e.why}\n` : ''}`;
    files.push({ name: `${root}/Decisions/${n}.md`, data: body });
  }
  files.push({ name: `${root}/Profile.md`, data: profileMd(snapshot) });
  files.push({ name: `${root}/House rules.md`, data: rulesMd(rules(memberId)) });
  files.push({ name: `${root}/Numbers.md`, data: numbersMd(memberId) });
  files.push({ name: `${root}/Learnings.md`, data: learningsMd(snapshot) });
  const link = (title, path) => (notion ? `[${title}](${encodeURI(path)})` : `[[${title}]]`);
  const index = [
    '# 127 Brain',
    '',
    `Exported ${iso().slice(0, 10)}.`,
    '',
    `- ${link('Profile', 'Profile.md')}`,
    `- ${link('House rules', 'House rules.md')}`,
    `- ${link('Numbers', 'Numbers.md')}`,
    `- ${link('Learnings', 'Learnings.md')}`,
    '',
    '## Docs',
    '',
    ...docs.map((d) => `- ${notion ? link(d.title, `Docs/${names.get(d.id)}.md`) : `[[${names.get(d.id)}]]`}`),
    '',
    '## Decisions',
    '',
    ...decNames.map((n) => `- ${notion ? link(n, `Decisions/${n}.md`) : `[[${n}]]`}`),
    '',
  ].join('\n');
  files.push({ name: `${root}/${notion ? 'Index' : '127 Brain'}.md`, data: index });
  return makeZip(files);
}

// ---------- delete everything ----------
async function forget(memberId) {
  for (const d of deps.db.filter('brainDocs', (x) => x.memberId === memberId)) await deps.db.remove('brainDocs', d.id);
  for (const e of deps.db.filter('brainLog', (x) => x.memberId === memberId)) await deps.db.remove('brainLog', e.id);
  const b = deps.db.get('brains', memberId);
  if (b && b.rules) {
    delete b.rules;
    await deps.db.save('brains', b);
  }
  bump(memberId);
  indexes.delete(memberId);
}

function counts(memberId) {
  return { docs: list(memberId).length, chars: usedChars(memberId), decisions: logOf(memberId, 'decision').length, numbers: numbers(memberId).length, limit: LIMITS.totalChars };
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = {
  LIMITS,
  list,
  get,
  view,
  save,
  addFile,
  remove,
  rules,
  setRules,
  hasRules,
  rulesNote,
  bannedPhrases,
  checkText,
  logDecision,
  logNumber,
  removeLog,
  decisions: (memberId) => logOf(memberId, 'decision'),
  numbers,
  search,
  sourcesNote,
  chunk,
  tokens,
  parseFrontmatter,
  frontmatter,
  linksIn,
  tagsIn,
  importZip,
  exportZip,
  forget,
  counts,
  kindOf,
  _setDeps,
};
