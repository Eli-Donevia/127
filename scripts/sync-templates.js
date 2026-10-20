#!/usr/bin/env node
// Copies the templates library (manifest + files) from the Templates thread into the app.
//
//   node scripts/sync-templates.js [path/to/product/templates]
//
// Only files the manifests list are copied, into content/templates/ (outside public/, so Builder
// files are only reachable through the gated /app/templates/:slug/:file and /app/hq/store routes):
// - manifest.json (the v1 Library): every format plus each preview;
// - store.json (the HQ Store, STORE-SCHEMA.md), when the Templates thread has published one: every
//   format, each preview, and the `<file>.tpl` token source next to each fillable format.
// Each copied file is checked against its manifest's sha256, and every path must be
// files/<id>/<name> with a plain lowercase name, so nothing lands outside files/.
// The Store's prompt packs read their text from content/prompts/manifest.json, which the Harness
// thread already keeps for HQ's prompt library (lib/harness/prompts.js), so it isn't copied here.
// Re-run when a manifest version changes, then commit the result.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = path.resolve(process.argv[2] || '/mnt/project-files/product/templates');
const OUT = path.join(__dirname, '..', 'content', 'templates');

// The same rules lib/templates.js and lib/store.js serve by.
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const SAFE_FILE = /^[a-z0-9][a-z0-9.-]{0,120}$/;

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const storePath = path.join(SRC, 'store.json');
const store = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : null;

const wanted = new Map(); // rel -> sha256 or null
const problems = [];
function want(id, rel, sha256) {
  const name = path.basename(String(rel || ''));
  if (!SAFE_ID.test(String(id || '')) || !SAFE_FILE.test(name) || rel !== `files/${id}/${name}`) {
    problems.push(`bad path: ${rel}`);
    return;
  }
  if (!wanted.has(rel) || (sha256 && !wanted.get(rel))) wanted.set(rel, sha256 || null);
}

for (const t of manifest.templates) {
  for (const f of t.formats || []) want(t.slug, f.file, f.sha256);
  if (t.preview) want(t.slug, t.preview, null);
}
if (store) {
  if (!Array.isArray(store.items)) problems.push('store.json has no items[]');
  for (const item of store.items || []) {
    for (const f of item.formats || []) {
      if (/\.tpl$/i.test(f.file)) problems.push(`a .tpl source is listed as a download: ${f.file}`);
      want(item.id, f.file, f.sha256);
      // The token source "Make it mine" fills. It has no sha256 of its own in store.json.
      if (f.fillable === true) want(item.id, `${f.file}.tpl`, null);
    }
    if (item.preview) want(item.id, item.preview, null);
  }
}

fs.rmSync(path.join(OUT, 'files'), { recursive: true, force: true });
let bytes = 0;
for (const [rel, sha256] of wanted) {
  const from = path.join(SRC, rel);
  const to = path.join(OUT, rel);
  if (!to.startsWith(path.join(OUT, 'files') + path.sep) || !from.startsWith(path.join(SRC, 'files') + path.sep)) {
    problems.push(`outside files/: ${rel}`);
    continue;
  }
  if (!fs.existsSync(from)) {
    problems.push(`missing: ${rel}`);
    continue;
  }
  const buf = fs.readFileSync(from);
  if (sha256 && crypto.createHash('sha256').update(buf).digest('hex') !== sha256) problems.push(`sha256 mismatch: ${rel}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, buf);
  bytes += buf.length;
}
fs.copyFileSync(path.join(SRC, 'manifest.json'), path.join(OUT, 'manifest.json'));
if (store) fs.copyFileSync(storePath, path.join(OUT, 'store.json'));
else fs.rmSync(path.join(OUT, 'store.json'), { force: true });

// The Store's own checks (kinds, business types, tiers, tokens, paths), so a bad store.json fails here.
if (store) {
  try {
    require('../lib/store').load(OUT, { strict: true });
  } catch (err) {
    problems.push(err.message);
  }
}

console.log(`[templates] manifest v${manifest.version}: ${manifest.templates.length} templates${store ? `; store v${store.version}: ${store.items.length} items` : '; no store.json yet'}; ${wanted.size} files, ${(bytes / 1048576).toFixed(1)} MB -> ${path.relative(process.cwd(), OUT) || OUT}`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
