// Higgsfield developer API (api.higgsfield.ai): Kling 3.0 video and Soul 2 images. Key is
// { key, secret } from ctx.secret('higgsfield'), sent as "Authorization: Key <id>:<secret>". Inputs take
// a public https link, so a start image is first put in Higgsfield's own storage through a presigned
// upload. Endpoints, fields and prices: data/providers.json "higgsfield" (checked 2026-10-20).

const crypto = require('crypto');
const C = require('./common');

const SERVICE = 'Higgsfield';
const D = C.DATA.higgsfield;
const BASE = 'https://api.higgsfield.ai';
const HOST = 'api.higgsfield.ai';

const models = [
  C.model('higgsfield', 'hf-kling-3-std', (req, d) => (Number(req.seconds) || d.seconds[0]) * d.usdPerSecond),
  C.model('higgsfield', 'hf-kling-3-pro', (req, d) => (Number(req.seconds) || d.seconds[0]) * d.usdPerSecond),
  C.model('higgsfield', 'hf-soul-2', (req, d) => batch(req, d) * d.usdPerImage),
];

// Soul 2 makes 1 or 4 images a call.
function batch(req, d) {
  return C.count(req, 4) > 1 ? d.batches[d.batches.length - 1] : d.batches[0];
}

function authOf(key) {
  if (C.isClient(key)) return undefined; // the member's client adds their key and secret itself
  if (key && typeof key === 'object') {
    const id = key.key || key.id || key.keyId;
    const secret = key.secret || key.keySecret;
    if (id && secret) return `Key ${id}:${secret}`;
  }
  if (typeof key === 'string' && key.includes(':')) return `Key ${key}`;
  throw new Error(`${SERVICE} needs both its key and its secret.`);
}

function headers(key, extra = {}) {
  return { Authorization: authOf(key), 'Content-Type': 'application/json', ...extra };
}

// Put a file in Higgsfield's storage and return its public link. The bytes go to the presigned URL
// with its own headers and never with our key.
async function upload(ctx, key, file) {
  if (!file || !file.data || !file.data.length) throw new Error(`${SERVICE} needs a start image and none came.`);
  if (file.data.length > C.MAX_INLINE) throw new Error(`That image is too big to send to ${SERVICE}.`);
  const type = file.type || 'image/jpeg';
  const u = await C.call(ctx, SERVICE, key, `${BASE}/files/generate-upload-url`, { method: 'POST', headers: headers(key), body: JSON.stringify({ content_type: type }), timeoutMs: 30000 });
  if (!u.upload_url || !u.public_url || !/^https:\/\//i.test(String(u.upload_url)) || !/^https:\/\//i.test(String(u.public_url))) throw new Error(`${SERVICE} did not give us a place to upload the image.`);
  const h = {};
  for (const [k, v] of Object.entries(u.upload_headers || {})) if (!/^authorization$/i.test(k)) h[k] = String(v);
  if (!Object.keys(h).some((k) => /^content-type$/i.test(k))) h['Content-Type'] = type;
  await C.call(ctx, SERVICE, key, u.upload_url, { method: 'PUT', headers: h, body: file.data, timeoutMs: 60000, raw: true, plain: true });
  return u.public_url;
}

async function start(ctx, key, req) {
  const m = C.find(models, req.model);
  const d = m.data;
  const prompt = String(req.prompt || '').trim();
  if (!prompt) throw new Error(`${SERVICE} needs a prompt.`);
  let path;
  let body;
  if (m.kind === 'video') {
    body = { prompt: prompt.slice(0, 2500), duration: Number(req.seconds) || 5, sound: m.audio ? 'on' : 'off' };
    if (req.image) {
      path = d.endpoints.image;
      body.image_url = await upload(ctx, key, req.image);
    } else {
      if (!d.endpoints.text) throw new Error(`${SERVICE} ${m.label} needs a start image.`);
      path = d.endpoints.text;
      body.aspect_ratio = req.aspect || '9:16';
    }
  } else {
    path = d.endpoints.text;
    body = { prompt, aspect_ratio: req.aspect || '1:1', resolution: d.resolution, batch_size: batch(req, d) };
    if (req.seed != null) body.seed = Math.min(1000000, Math.max(1, Math.floor(Number(req.seed)) || 1));
  }
  const j = await C.call(ctx, SERVICE, key, `${BASE}/${path}`, { method: 'POST', headers: headers(key, { 'Idempotency-Key': crypto.randomUUID() }), body: JSON.stringify(body), timeoutMs: 60000 });
  const id = j.request_id;
  if (!id || !/^[A-Za-z0-9-]+$/.test(String(id))) throw new Error(`${SERVICE} did not start the job. Try again in a minute.`);
  const status = C.sameHost(j.status_url, HOST) ? j.status_url : `${BASE}/requests/${id}/status`;
  return { job: { model: m.id, id, status } };
}

function filesOf(j) {
  const out = [];
  if (j.video && j.video.url) out.push({ url: j.video.url });
  for (const im of j.images || []) if (im && im.url) out.push({ url: im.url });
  const audios = j.audios && j.audios.length ? j.audios : j.audio ? [j.audio] : [];
  for (const a of audios) if (a && a.url) out.push({ url: a.url });
  return out;
}

async function check(ctx, key, job) {
  if (!job || !C.sameHost(job.status, HOST)) return { status: 'failed', error: `${SERVICE} lost track of this job.` };
  const s = await C.call(ctx, SERVICE, key, job.status, { headers: { Authorization: authOf(key) }, timeoutMs: 30000 });
  switch (s.status) {
    case 'queued':
      return { status: 'queued' };
    case 'in_progress':
      return { status: 'running' };
    case 'completed': {
      const files = filesOf(s);
      return files.length ? { status: 'done', files } : { status: 'failed', error: `${SERVICE} finished but sent no file back.` };
    }
    case 'nsfw':
      return { status: 'failed', error: C.jobError(SERVICE, 'nsfw', key) };
    case 'canceled':
      return { status: 'failed', error: `${SERVICE} canceled this job.` };
    case 'failed':
      return { status: 'failed', error: C.jobError(SERVICE, s.error, key) };
    default:
      return { status: 'running' };
  }
}

module.exports = { id: 'higgsfield', service: SERVICE, ...C.legalOf(D), models, start, check, data: D };
