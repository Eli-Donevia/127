// Luma API (agents.lumalabs.ai/v1, the one Luma's docs now call the latest): Ray3.2 video from text or
// a start image, Uni-1 images. POST /v1/generations, then poll GET /v1/generations/{id}. A start image
// goes inline as { data, media_type } (the API also takes a public URL or a Files API id), so no public
// link is needed. Prices: data/providers.json "luma" (checked 2026-10-20).

const C = require('./common');

const SERVICE = 'Luma';
const D = C.DATA.luma;
const BASE = D.base;

// With a start image Luma makes 5 second clips only.
function clipSeconds(req, d) {
  const s = Number(req.seconds) || d.seconds[0];
  return req.image || s <= 5 ? 5 : 10;
}

const models = [
  C.model('luma', 'luma-ray-3.2', (req, d) => d.usdPerClip[String(clipSeconds(req, d))]),
  C.model('luma', 'luma-uni-1', (req, d) => d.usdPerImage),
];

function headers(key) {
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function start(ctx, key, req) {
  const m = C.find(models, req.model);
  const d = m.data;
  const prompt = String(req.prompt || '').trim().slice(0, 6000);
  if (!prompt) throw new Error(`${SERVICE} needs a prompt.`);
  let body;
  if (m.kind === 'video') {
    const video = { resolution: d.resolution, duration: `${clipSeconds(req, d)}s` };
    if (req.image) {
      if (!req.image.data || !req.image.data.length) throw new Error(`${SERVICE} needs a start image and none came.`);
      if (req.image.data.length > C.MAX_INLINE) throw new Error(`That image is too big to send to ${SERVICE}.`);
      video.start_frame = { data: Buffer.from(req.image.data).toString('base64'), media_type: req.image.type || 'image/jpeg' };
    }
    body = { model: d.model, type: 'video', prompt, video };
    if (req.aspect) body.aspect_ratio = req.aspect;
  } else {
    body = { model: d.model, type: 'image', prompt, output_format: 'png' };
    if (req.aspect) body.aspect_ratio = req.aspect;
  }
  const j = await C.call(ctx, SERVICE, key, `${BASE}/generations`, { method: 'POST', headers: headers(key), body: JSON.stringify(body), timeoutMs: 60000 });
  if (!j.id || !/^[A-Za-z0-9-]+$/.test(String(j.id))) throw new Error(`${SERVICE} did not start the job. Try again in a minute.`);
  return { job: { model: m.id, id: String(j.id) } };
}

async function check(ctx, key, job) {
  if (!job || !/^[A-Za-z0-9-]+$/.test(String(job.id || ''))) return { status: 'failed', error: `${SERVICE} lost track of this job.` };
  const g = await C.call(ctx, SERVICE, key, `${BASE}/generations/${job.id}`, { headers: headers(key), timeoutMs: 30000 });
  const state = String(g.state || '');
  if (state === 'queued') return { status: 'queued' };
  if (state === 'completed') {
    const files = (g.output || []).filter((o) => o && o.url).map((o) => ({ url: o.url }));
    return files.length ? { status: 'done', files } : { status: 'failed', error: `${SERVICE} finished but sent no file back.` };
  }
  if (state === 'failed') return { status: 'failed', error: C.jobError(SERVICE, `${g.failure_code || ''} ${g.failure_reason || ''}`.trim(), key) };
  return { status: 'running' }; // dreaming, processing and anything newer
}

module.exports = { id: 'luma', service: SERVICE, ...C.legalOf(D), models, start, check, data: D };
