// Where a member's video comes from: a Library file (a file input's id, read with ctx.asset) or a
// public https link ({ url }). Nothing here trusts a local path from member input. Files land in a
// shared cache for this server process, so the steps of one run (transcribe each minute, render
// each clip) copy or download the file once.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { media } = require('../../_kit');
const { cacheDir } = require('./sample');

const MAX_BYTES = 1.5e9;

// Share links that open a page, turned into links that send the file.
function directLink(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (/(^|\.)dropbox\.com$/i.test(u.hostname)) {
    u.searchParams.delete('dl');
    u.searchParams.set('dl', '1');
    return u.toString();
  }
  if (/(^|\.)drive\.google\.com$/i.test(u.hostname)) {
    const m = u.pathname.match(/\/file\/d\/([\w-]{10,})/) || [null, u.searchParams.get('id')];
    if (m[1]) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  }
  return u.toString();
}

function nameFrom(url) {
  try {
    const base = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return base.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 60) || 'your video';
  } catch {
    return 'your video';
  }
}

// What the member gave us, without downloading anything yet. file: a Library file id (contract 4b),
// or an asset object with an id.
function sourceOf(input = {}) {
  if (typeof input.file === 'string' && /^[\w-]{1,80}$/.test(input.file.trim())) {
    return { kind: 'file', asset: { id: input.file.trim(), url: null, name: null, type: null, bytes: null }, name: 'your video' };
  }
  const f = input.file && typeof input.file === 'object' && !Array.isArray(input.file) ? input.file : null;
  if (f && (f.id || f.url)) {
    return {
      kind: 'file',
      asset: { id: f.id ? String(f.id) : null, url: f.url ? String(f.url) : null, name: f.name ? String(f.name).slice(0, 120) : null, type: f.type ? String(f.type) : null, bytes: Number(f.bytes) || null },
      name: f.name ? String(f.name).replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 60) : 'your video',
    };
  }
  const raw = typeof input.url === 'string' ? input.url.trim() : '';
  if (raw) {
    const url = directLink(raw);
    if (!url) throw new Error('That link needs to start with https://. Paste a public link to the video file.');
    return { kind: 'url', url, name: nameFrom(url) };
  }
  return { kind: 'sample', name: 'Sample talk' };
}

function keyOf(ctx, source) {
  const who = (ctx && ctx.member && ctx.member.id) || 'member';
  return crypto.createHash('sha1').update(`${who}|${source.kind}|${source.url || (source.asset && (source.asset.id || source.asset.url))}`).digest('hex').slice(0, 20);
}

function cached(key) {
  const dir = cacheDir();
  const hit = fs.readdirSync(dir).find((f) => f.startsWith(`src-${key}.`) && !f.endsWith('.tmp'));
  if (!hit) return null;
  const p = path.join(dir, hit);
  const now = new Date();
  try {
    fs.utimesSync(p, now, now);
  } catch {
    /* ignore */
  }
  return p;
}

const inflight = new Map();

// Downloads to a temporary name, then renames, so a broken download never looks like a cached file.
async function download(ctx, url, dir, key) {
  const tmpName = `dl-${key}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const file = await media.fetchToFile(ctx, url, { dir, name: tmpName, maxBytes: MAX_BYTES });
    const dst = path.join(dir, `src-${key}${path.extname(file)}`);
    fs.renameSync(file, dst);
    return dst;
  } catch (e) {
    for (const f of fs.readdirSync(dir)) if (f.startsWith(tmpName)) fs.rmSync(path.join(dir, f), { force: true });
    throw e;
  }
}

// A local path for the source (downloaded once per process). null for the sample source.
async function localPath(ctx, source) {
  if (!source || source.kind === 'sample') return null;
  const key = keyOf(ctx, source);
  const hit = cached(key);
  if (hit) {
    // The file's name, kept beside it when it was copied from the Library.
    try {
      const name = fs.readFileSync(path.join(cacheDir(), `name-${key}.txt`), 'utf8').trim();
      if (name && source.asset) {
        source.asset.name = name.slice(0, 120);
        source.name = name.replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 60);
      }
    } catch {
      /* no name kept */
    }
    return hit;
  }
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    const dir = cacheDir();
    if (source.kind === 'url') return download(ctx, source.url, dir, key);
    const a = source.asset || {};
    // A Library file: ctx.asset copies it to a temp path for this call; keep a copy in the cache.
    if (a.id && ctx && typeof ctx.asset === 'function') {
      const got = await ctx.asset(a.id);
      if (!got || !got.path) throw new Error("That file isn't in your Library anymore. Add it again and rerun.");
      const ext = (String(got.name || '').match(/\.([a-z0-9]{2,4})$/i) || [null, /audio/.test(got.type || '') ? 'm4a' : 'mp4'])[1].toLowerCase();
      const dst = path.join(dir, `src-${key}.${ext}`);
      const tmp = `${dst}.${process.pid}.tmp`;
      fs.copyFileSync(got.path, tmp);
      fs.renameSync(tmp, dst);
      if (got.name) {
        source.asset.name = String(got.name).slice(0, 120);
        source.name = String(got.name).replace(/\.[a-z0-9]{2,4}$/i, '').slice(0, 60);
        fs.writeFileSync(path.join(dir, `name-${key}.txt`), source.asset.name);
      }
      return dst;
    }
    if (ctx && typeof ctx.file === 'function') {
      const got = await ctx.file(a);
      const ext = (String(a.name || '').match(/\.([a-z0-9]{2,4})$/i) || [null, /audio/.test(a.type || '') ? 'm4a' : 'mp4'])[1].toLowerCase();
      const dst = path.join(dir, `src-${key}.${ext}`);
      const tmp = `${dst}.${process.pid}.tmp`;
      if (Buffer.isBuffer(got)) fs.writeFileSync(tmp, got);
      else if (got && Buffer.isBuffer(got.data)) fs.writeFileSync(tmp, got.data);
      else if (got && Buffer.isBuffer(got.buf)) fs.writeFileSync(tmp, got.buf);
      else if (typeof got === 'string' || (got && typeof got.path === 'string')) fs.copyFileSync(typeof got === 'string' ? got : got.path, tmp);
      else throw new Error("Couldn't open that upload. Try uploading it again, or paste a public link to the video.");
      fs.renameSync(tmp, dst);
      return dst;
    }
    if (a.url && /^https:\/\//i.test(a.url)) return download(ctx, a.url, dir, key);
    throw new Error("Uploads can't be read here yet. Paste a public link to the video instead (Dropbox, Google Drive or your own site).");
  })();
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

module.exports = { sourceOf, localPath, directLink, keyOf, MAX_BYTES };
