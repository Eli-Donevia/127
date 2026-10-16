// Templates library: sheets, docs, checklists and workflow recipes from the Templates thread.
// The manifest and files live in content/templates/ (synced by scripts/sync-templates.js),
// never in public/, so Builder files are only served through the gated route below.

const fs = require('fs');
const path = require('path');
const { canAccess } = require('./plans');

const DIR = path.join(__dirname, '..', 'content', 'templates');

const KINDS = { sheet: 'Sheet', doc: 'Doc', checklist: 'Checklist', workflow: 'Recipe', system: 'System' };
const TRACKS = { start: 'Start', build: 'Build', grow: 'Grow' };

const TYPES = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.gs': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
  '.png': 'image/png',
};

// Slugs and file names are plain lowercase words; anything else never reaches the disk.
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
const SAFE_FILE = /^[a-z0-9][a-z0-9.-]{0,120}$/;

function load(dir = DIR) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  if (!manifest || !Array.isArray(manifest.templates)) throw new Error('templates manifest has no templates[]');
  const bySlug = {};
  for (const t of manifest.templates) {
    if (!SAFE_SLUG.test(t.slug || '')) throw new Error(`templates manifest: bad slug ${t.slug}`);
    if (bySlug[t.slug]) throw new Error(`templates manifest: duplicate slug ${t.slug}`);
    if (!TRACKS[t.track] || !KINDS[t.kind] || !['free', 'builder'].includes(t.tier)) throw new Error(`templates manifest: bad track, kind or tier on ${t.slug}`);
    // Each downloadable file, keyed by its base name. Paths are relative to the manifest folder.
    const files = {};
    for (const f of t.formats || []) {
      const name = path.basename(f.file);
      if (!SAFE_FILE.test(name) || f.file !== `files/${t.slug}/${name}`) throw new Error(`templates manifest: bad file path ${f.file}`);
      files[name] = { ...f, name, ext: path.extname(name).toLowerCase() };
    }
    const preview = t.preview ? path.basename(t.preview) : null;
    if (preview && t.preview !== `files/${t.slug}/${preview}`) throw new Error(`templates manifest: bad preview path ${t.preview}`);
    const checklistIds = new Set((t.checklist || []).flatMap((g) => g.items.map((i) => i.id)));
    bySlug[t.slug] = { ...t, files, previewFile: preview, checklistIds };
  }
  const list = manifest.templates.map((t) => bySlug[t.slug]);
  // Playbook slug -> templates that pair with it.
  const byPlaybook = {};
  for (const t of list) for (const p of t.pairsWith || []) (byPlaybook[p.slug] = byPlaybook[p.slug] || []).push(t);
  const roadmapIndex = manifest.roadmapIndex || {};
  return { version: manifest.version, list, bySlug, byPlaybook, roadmapIndex, dir };
}

const lib = load();

function get(slug) {
  return Object.prototype.hasOwnProperty.call(lib.bySlug, slug) ? lib.bySlug[slug] : null;
}
// Templates for a roadmap step id (start-w1-t1 style).
function forTask(taskId) {
  return (lib.roadmapIndex[taskId] || []).map(get).filter(Boolean);
}
function forPlaybook(slug) {
  return lib.byPlaybook[slug] || [];
}

// Looks a requested file up in the manifest. Returns null for anything the manifest doesn't list.
function resolveFile(slug, name, l = lib) {
  if (!SAFE_SLUG.test(String(slug)) || !SAFE_FILE.test(String(name))) return null;
  const t = Object.prototype.hasOwnProperty.call(l.bySlug, slug) ? l.bySlug[slug] : null;
  if (!t) return null;
  const isPreview = !!t.previewFile && name === t.previewFile;
  const f = isPreview ? { name, ext: '.png' } : Object.prototype.hasOwnProperty.call(t.files, name) ? t.files[name] : null;
  if (!f || !TYPES[f.ext]) return null;
  const root = path.join(l.dir, 'files', t.slug);
  const abs = path.join(root, name);
  if (path.dirname(abs) !== root) return null;
  return { template: t, name, abs, root, isPreview, contentType: TYPES[f.ext] };
}

// GET /app/templates/:slug/:file. Previews are open to every signed-in member (the library
// shows Builder cards to free members); every other file needs canAccess(user, tier).
function serveFile(l = lib) {
  return (req, res, next) => {
    if (!req.user) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    const hit = resolveFile(req.params.slug, req.params.file, l);
    if (!hit) return next();
    if (!hit.isPreview && !canAccess(req.user, hit.template.tier)) return res.redirect(302, `/app/templates/${hit.template.slug}?locked=1#unlock`);
    if (!fs.existsSync(hit.abs)) return next();
    const headers = {
      'Content-Type': hit.contentType,
      'Cache-Control': hit.isPreview ? 'private, max-age=86400' : 'private, no-cache',
      'Content-Disposition': `${hit.isPreview ? 'inline' : 'attachment'}; filename="${hit.name}"`,
    };
    res.sendFile(hit.name, { root: hit.root, headers, dotfiles: 'deny', lastModified: true }, (err) => {
      if (err && !res.headersSent) next(err.status === 404 ? undefined : err);
    });
  };
}

// "Do by" line for checklist groups that carry a due offset (days from launch).
function dueLabel(due) {
  if (due === null || due === undefined) return null;
  if (due === 0) return 'Launch day';
  const n = Math.abs(due);
  return `${n} day${n === 1 ? '' : 's'} ${due < 0 ? 'before' : 'after'} launch`;
}

function checklistProgress(t, user) {
  const total = t.checklistIds.size;
  const saved = (user && user.checklist) || {};
  let done = 0;
  for (const id of t.checklistIds) if (saved[id]) done += 1;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function fmtBytes(b) {
  if (!b && b !== 0) return '';
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

module.exports = {
  KINDS, TRACKS, TYPES,
  load, get, forTask, forPlaybook, resolveFile, serveFile, dueLabel, checklistProgress, fmtBytes,
  get list() { return lib.list; },
  get version() { return lib.version; },
  get roadmapIndex() { return lib.roadmapIndex; },
};
