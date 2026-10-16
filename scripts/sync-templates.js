#!/usr/bin/env node
// Copies the templates library (manifest + files) from the Templates thread into the app.
//
//   node scripts/sync-templates.js [path/to/product/templates]
//
// Only files the manifest lists (every format plus each preview) are copied, into
// content/templates/ (outside public/, so Builder files are only reachable through the
// gated /app/templates/:slug/:file route). Each copied file is checked against the
// manifest's sha256. Re-run when the manifest version changes, then commit the result.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = path.resolve(process.argv[2] || '/mnt/project-files/product/templates');
const OUT = path.join(__dirname, '..', 'content', 'templates');

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const wanted = [];
for (const t of manifest.templates) {
  for (const f of t.formats || []) wanted.push({ rel: f.file, sha256: f.sha256 });
  if (t.preview) wanted.push({ rel: t.preview, sha256: null });
}

fs.rmSync(path.join(OUT, 'files'), { recursive: true, force: true });
let bytes = 0;
const problems = [];
for (const w of wanted) {
  const from = path.join(SRC, w.rel);
  const to = path.join(OUT, w.rel);
  if (!to.startsWith(path.join(OUT, 'files') + path.sep)) {
    problems.push(`outside files/: ${w.rel}`);
    continue;
  }
  if (!fs.existsSync(from)) {
    problems.push(`missing: ${w.rel}`);
    continue;
  }
  const buf = fs.readFileSync(from);
  if (w.sha256 && crypto.createHash('sha256').update(buf).digest('hex') !== w.sha256) problems.push(`sha256 mismatch: ${w.rel}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, buf);
  bytes += buf.length;
}
fs.copyFileSync(path.join(SRC, 'manifest.json'), path.join(OUT, 'manifest.json'));

console.log(`[templates] manifest v${manifest.version}: ${manifest.templates.length} templates, ${wanted.length} files, ${(bytes / 1048576).toFixed(1)} MB -> ${path.relative(process.cwd(), OUT) || OUT}`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
