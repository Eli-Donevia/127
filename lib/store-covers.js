// What a Store item looks like on its card and at the top of its page (views/partials/store-cover.ejs), so
// every item shows something real instead of a kind label:
//
//   site    the template's sample page, shot at a desktop and a phone width (scripts/store-thumbs.js writes
//           content/store-thumbs/<id>/desk.jpg and phone.jpg; served by /app/hq/store/:id/thumb/:name)
//   paper   the item's own preview image from store.json, laid on the card like a printed page
//   prompts a prompt pack: the titles of its prompts, from the prompts manifest
//   video   a video or image prompt pack: its shots (title and camera move) and the models it covers, read from
//           the pack's own .md file
//   doc     anything else: the pages a Notion system holds (its home .md), or the item's own words
//
// Read from files once per item and kept (the files only change with a deploy).

const fs = require('fs');
const path = require('path');

const THUMBS = path.join(__dirname, '..', 'content', 'store-thumbs');
const THUMB_NAMES = ['desk.jpg', 'phone.jpg'];
const cache = new Map();

// The two thumbnails of a site item, when the script has made them.
function thumbFile(id, name) {
  if (!THUMB_NAMES.includes(name) || !/^[a-z0-9-]+$/.test(String(id))) return null;
  const abs = path.join(THUMBS, id, name);
  return fs.existsSync(abs) ? abs : null;
}

const read = (abs) => {
  try { return fs.readFileSync(abs, 'utf8'); } catch (e) { return ''; }
};

// A video or image pack's .md: "## Model" sections, each with "### 1. Shot" and a line ending "Camera: Move."
// The same shots repeat under every model, so they are counted once.
function videoPack(item, dir) {
  const f = (item.formats || []).find((x) => /\.md$/.test(x.name || x.file || ''));
  const md = f ? read(path.join(dir, 'files', item.id, path.basename(f.name || f.file))) : '';
  if (!md) return null;
  const skip = /^(how to use|the moves|the video types|the short version|rules that|sources)/i;
  const models = [], shots = [], seen = new Set();
  let model = null;
  const lines = md.split('\n');
  lines.forEach((ln, i) => {
    const h2 = /^## (.+)$/.exec(ln);
    if (h2) { model = skip.test(h2[1]) ? null : h2[1].trim(); if (model && !models.includes(model)) models.push(model); return; }
    const h3 = /^### \d+\.\s+(.+)$/.exec(ln);
    if (!h3 || !model) return;
    const title = h3[1].trim();
    if (seen.has(title.toLowerCase())) return;
    seen.add(title.toLowerCase());
    const next = lines.slice(i + 1, i + 4).find((l) => l.trim()) || '';
    const cam = /Camera:\s*([^.]+)\./.exec(next);
    shots.push({ title, camera: cam ? cam[1].trim() : '' });
  });
  if (!shots.length) return null;
  return { type: 'video', still: /image/i.test(item.id) || /image/i.test(item.title), shots: shots.slice(0, 3), count: shots.length, models: models.slice(0, 6) };
}

// A Notion system's home page: the bold names under "What's inside".
function notionPages(item, dir) {
  const f = (item.formats || []).find((x) => /home\.md$/.test(x.name || x.file || ''));
  const md = f ? read(path.join(dir, 'files', item.id, path.basename(f.name || f.file))) : '';
  const inside = md.split(/^## /m).find((s) => /^What's inside/i.test(s)) || '';
  return [...inside.matchAll(/^- \*\*([^*]+)\*\*/gm)].map((m) => m[1].trim());
}

function build(item, lib) {
  const dir = lib.dir;
  if (item.kind === 'site' && thumbFile(item.id, 'desk.jpg')) {
    const base = `/app/hq/store/${item.id}/thumb`;
    return { type: 'site', desk: `${base}/desk.jpg`, phone: thumbFile(item.id, 'phone.jpg') ? `${base}/phone.jpg` : null };
  }
  if (item.previewFile) return { type: 'paper', kind: item.kind, src: `/app/hq/store/${item.id}/files/${item.previewFile}` };
  if (item.kind === 'prompts' && item.prompts.length) {
    const titles = item.prompts.map((p) => p.title || ((lib.prompts.byId || {})[p.id] || {}).title).filter(Boolean);
    return { type: 'prompts', lines: titles.slice(0, 5), count: titles.length };
  }
  if (item.kind === 'video-prompts') {
    const v = videoPack(item, dir);
    if (v) return v;
  }
  const pages = item.kind === 'notion' ? notionPages(item, dir) : [];
  return { type: 'doc', title: item.title, lines: pages.slice(0, 6), count: pages.length, body: pages.length ? '' : item.summary };
}

function coverOf(item, lib) {
  const key = `${lib.dir}:${item.id}:${item.previewFile || ''}`;
  if (!cache.has(key)) cache.set(key, build(item, lib));
  return cache.get(key);
}

module.exports = { coverOf, thumbFile, videoPack, notionPages };
