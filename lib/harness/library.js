// The member's Library: files their runs made (spec videos, CSVs, forecasts, site files). Details
// live in the `assets` collection; the bytes are blobs (lib/db.js), so big files never sit in memory.
// Files are private to the member and served through /app/hq/files/:id after an ownership check.

const path = require('path');
const deps = { db: require('../db'), now: () => Date.now() };
const env = (key, fallback) => (process.env[key] === undefined || process.env[key] === '' ? fallback : process.env[key]);

const TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/html': 'html',
  'application/json': 'json',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'image/svg+xml': 'svg',
  'text/calendar': 'ics',
  'text/vcard': 'vcf',
  'text/vtt': 'vtt',
  'application/x-subrip': 'srt',
};
const BY_EXT = Object.fromEntries(Object.entries(TYPES).map(([t, e]) => [e, t]));
BY_EXT.jpeg = 'image/jpeg';
BY_EXT.htm = 'text/html';
BY_EXT.liquid = 'text/plain';
// Plain text files that keep their own extension (Shopify theme sections).
const KEEP_EXT = { 'text/plain': ['liquid'] };

const MB = 1024 * 1024;
const maxFile = () => Number(env('HARNESS_MAX_FILE_MB', '25')) * MB;
const quota = (tier) =>
  ({
    free: Number(env('HARNESS_QUOTA_FREE_MB', '25')),
    builder: Number(env('HARNESS_QUOTA_BUILDER_MB', '500')),
    circle: Number(env('HARNESS_QUOTA_CIRCLE_MB', '2000')),
  })[tier === 'builder' || tier === 'circle' ? tier : 'free'] * MB;

function cleanName(name, type) {
  let base = path.basename(String(name || 'file')).replace(/[^\w.\- ()]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 100) || 'file';
  const ext = TYPES[type];
  const own = (base.toLowerCase().match(/\.([a-z0-9]{1,8})$/) || [])[1];
  if (own && (KEEP_EXT[type] || []).includes(own)) return base;
  if (ext && !base.toLowerCase().endsWith(`.${ext}`)) base = `${base.replace(/\.[a-z0-9]{1,5}$/i, '')}.${ext}`;
  return base;
}

function typeFor(name, type) {
  if (type && TYPES[type]) return type;
  const ext = String(name || '').toLowerCase().split('.').pop();
  return BY_EXT[ext] || null;
}

function used(memberId) {
  return deps.db.filter('assets', (a) => a.memberId === memberId).reduce((n, a) => n + (a.bytes || 0), 0);
}

function card(a) {
  return { id: a.id, url: `/app/hq/files/${a.id}`, name: a.name, type: a.type, bytes: a.bytes };
}

async function save(member, name, data, { type, runId, stepId } = {}) {
  const t = typeFor(name, type);
  if (!t) throw new Error(`127 can't keep that kind of file (${type || name}).`);
  const buf = Buffer.isBuffer(data) ? data : data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(String(data == null ? '' : data), 'utf8');
  if (buf.length > maxFile()) throw new Error(`That file is ${Math.round(buf.length / MB)} MB. The limit is ${Math.round(maxFile() / MB)} MB.`);
  // A run's own files are always kept, so a run never stops halfway on space (credits already cap
  // what a run makes). Files a member adds must fit their space.
  if (!runId && used(member.id) + buf.length > quota(member.tier)) throw new Error('Your Library is full. Delete some old files first.');
  const id = deps.db.id();
  await deps.db.putBlob(id, buf);
  const doc = await deps.db.save('assets', { id, memberId: member.id, name: cleanName(name, t), type: t, bytes: buf.length, runId: runId || null, stepId: stepId || null });
  return card(doc);
}

function list(memberId, { runId, limit = 200 } = {}) {
  return deps.db
    .filter('assets', (a) => a.memberId === memberId && (!runId || a.runId === runId))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map((a) => ({ ...card(a), createdAt: a.createdAt, runId: a.runId }));
}

function get(memberId, id) {
  const a = deps.db.get('assets', id);
  return a && a.memberId === memberId ? a : null;
}

async function read(memberId, id) {
  const a = get(memberId, id);
  if (!a) return null;
  const buf = await deps.db.getBlob(a.id);
  return buf ? { asset: a, buf } : null;
}

async function remove(memberId, id) {
  const a = get(memberId, id);
  if (!a) return false;
  await deps.db.removeBlob(a.id);
  await deps.db.remove('assets', a.id);
  return true;
}

// How a file is served: media and PDFs open in the browser; HTML and SVG only in the sandboxed
// preview (scripts and forms off; SVG can carry script); everything else downloads.
function disposition(type) {
  if (type === 'image/svg+xml') return 'attachment';
  if (/^(image|video|audio)\//.test(type) || type === 'application/pdf' || type === 'text/plain' || type === 'text/csv') return 'inline';
  return 'attachment';
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { TYPES, save, list, get, read, remove, used, quota, card, disposition, typeFor, _setDeps };
