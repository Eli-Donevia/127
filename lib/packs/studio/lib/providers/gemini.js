// Gemini API (Google AI, key 'gemini'): Gemini Omni 1.1 Flash video and Nano Banana images through the
// Interactions API (POST /v1beta/interactions). Video runs in the background and is polled with
// GET /v1beta/interactions/{id}; images answer at once. Veo 3.1 Preview (predictLongRunning) shuts
// down on 2026-10-22, so it is not offered. Paid tier keys only: Google's free tier uses inputs to
// improve its products. Prices: data/providers.json "gemini" (checked 2026-10-20).

const C = require('./common');

const SERVICE = 'Gemini';
const D = C.DATA.gemini;
const BASE = D.base;
const HOST = 'generativelanguage.googleapis.com';

const models = [
  C.model('gemini', 'gm-omni-flash', (req, d) => d.seconds[d.seconds.length - 1] * d.usdPerSecond + d.usdInputAllowance),
  C.model('gemini', 'gm-nano-banana-2-lite', (req, d) => d.usdPerImage + d.usdInputAllowance),
  C.model('gemini', 'gm-nano-banana-2', (req, d) => d.usdPerImage + d.usdInputAllowance),
];

function headers(key) {
  return { 'x-goog-api-key': key, 'Content-Type': 'application/json' };
}

function inputOf(prompt, image) {
  if (!image) return prompt;
  if (!image.data || !image.data.length) throw new Error(`${SERVICE} needs an image and none came.`);
  if (image.data.length > C.MAX_INLINE) throw new Error(`That image is too big to send to ${SERVICE}.`);
  return [
    { type: 'image', data: Buffer.from(image.data).toString('base64'), mime_type: image.type || 'image/jpeg' },
    { type: 'text', text: prompt },
  ];
}

// Every media item in a finished interaction: steps[].content[] (model_output steps), or outputs[].
function mediaOf(j, kind) {
  const items = [];
  for (const s of j.steps || []) {
    if (s && s.type && s.type !== 'model_output') continue;
    for (const c of (s && s.content) || []) items.push(c);
  }
  for (const o of j.outputs || []) items.push(o);
  if (j[`output_${kind}`]) items.push({ type: kind, ...j[`output_${kind}`] });
  return items.filter((c) => c && c.type === kind && (c.data || c.uri));
}

// Inline data comes back as bytes. A Files API uri needs our key to download, so we fetch it here
// (gen.js downloads plain links without headers).
async function filesOf(ctx, key, j, kind) {
  const out = [];
  for (const c of mediaOf(j, kind)) {
    const type = c.mime_type || c.mimeType || (kind === 'video' ? 'video/mp4' : 'image/png');
    if (c.data) {
      out.push({ data: Buffer.from(String(c.data), 'base64'), type });
    } else if (C.sameHost(c.uri, HOST)) {
      const u = new URL(c.uri);
      if (!u.pathname.includes(':download')) u.pathname += ':download';
      u.searchParams.set('alt', 'media');
      const got = await C.call(ctx, SERVICE, key, u.toString(), { headers: { 'x-goog-api-key': key }, timeoutMs: 60000, raw: true });
      out.push({ data: got.data, type: got.type || type });
    } else if (/^https:\/\//i.test(String(c.uri))) {
      out.push({ url: c.uri }); // somewhere else: fetched without our key
    }
    if (out.length) break; // one file per interaction
  }
  return out;
}

function failed(j, key) {
  const e = j.error || {};
  return C.jobError(SERVICE, typeof e === 'string' ? e : e.message || e.status || j.status_reason || '', key);
}

async function start(ctx, key, req) {
  const m = C.find(models, req.model);
  const d = m.data;
  const prompt = String(req.prompt || '').trim();
  if (!prompt) throw new Error(`${SERVICE} needs a prompt.`);
  let body;
  if (m.kind === 'video') {
    body = {
      model: d.model,
      input: inputOf(prompt, req.image),
      response_format: { type: 'video', aspect_ratio: req.aspect === '16:9' ? '16:9' : '9:16', resolution: d.resolution },
      generation_config: { video_config: { task: req.image ? 'image_to_video' : 'text_to_video' } },
      background: true,
    };
  } else {
    const image = req.image && m.from.includes('image') ? req.image : null;
    body = { model: d.model, input: inputOf(prompt, image), response_format: { type: 'image', aspect_ratio: req.aspect || '1:1', image_size: d.imageSize } };
  }
  const j = await C.call(ctx, SERVICE, key, `${BASE}/interactions`, { method: 'POST', headers: headers(key), body: JSON.stringify(body), timeoutMs: 60000 });
  const kind = m.kind === 'video' ? 'video' : 'image';
  if (j.status === 'failed' || j.status === 'cancelled') throw new Error(failed(j, key));
  if (j.status === 'completed' || (!j.status && mediaOf(j, kind).length)) {
    const files = await filesOf(ctx, key, j, kind);
    if (!files.length) throw new Error(`${SERVICE} finished but sent no ${kind} back.`);
    return { files };
  }
  if (!j.id || !/^[A-Za-z0-9_-]+$/.test(String(j.id))) throw new Error(`${SERVICE} did not start the job. Try again in a minute.`);
  return { job: { model: m.id, id: String(j.id), kind } };
}

async function check(ctx, key, job) {
  if (!job || !/^[A-Za-z0-9_-]+$/.test(String(job.id || ''))) return { status: 'failed', error: `${SERVICE} lost track of this job.` };
  const j = await C.call(ctx, SERVICE, key, `${BASE}/interactions/${job.id}`, { headers: { 'x-goog-api-key': key }, timeoutMs: 60000 });
  switch (j.status) {
    case 'queued':
      return { status: 'queued' };
    case 'completed': {
      const files = await filesOf(ctx, key, j, job.kind || 'video');
      return files.length ? { status: 'done', files } : { status: 'failed', error: `${SERVICE} finished but sent no ${job.kind || 'video'} back.` };
    }
    case 'failed':
      return { status: 'failed', error: failed(j, key) };
    case 'cancelled':
      return { status: 'failed', error: `${SERVICE} canceled this job.` };
    case 'requires_action':
      return { status: 'failed', error: `${SERVICE} stopped and asked for something we cannot answer. Try again.` };
    default:
      return { status: 'running' }; // in_progress
  }
}

module.exports = { id: 'gemini', service: SERVICE, ...C.legalOf(D), models, start, check, data: D };
