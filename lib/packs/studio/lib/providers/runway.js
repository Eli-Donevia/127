// Runway developer API (api.dev.runwayml.com, X-Runway-Version 2024-11-06): Gen-4 Turbo from a start
// image, Gen-4.5 from text or an image, Gen-4 Image. Start a task, then poll GET /v1/tasks/{id}.
// Images go in as data URIs (5 MB at most each). Prices: 1 credit is $0.01; data/providers.json
// "runway" (checked 2026-10-20).

const C = require('./common');

const SERVICE = 'Runway';
const D = C.DATA.runway;
const BASE = D.base;
const MAX_IMAGE = 5e6;

const models = [
  C.model('runway', 'rw-gen4-turbo', (req, d) => (Number(req.seconds) || d.seconds[0]) * d.usdPerSecond),
  C.model('runway', 'rw-gen4.5', (req, d) => (Number(req.seconds) || d.seconds[0]) * d.usdPerSecond),
  C.model('runway', 'rw-gen4-image', (req, d) => d.usdPerImage),
];

function headers(key) {
  return { Authorization: `Bearer ${key}`, 'X-Runway-Version': D.version, 'Content-Type': 'application/json' };
}

function ratio(d, aspect) {
  return d.ratios[aspect] || d.ratios['9:16'] || Object.values(d.ratios)[0];
}

async function start(ctx, key, req) {
  const m = C.find(models, req.model);
  const d = m.data;
  const prompt = String(req.prompt || '').trim().slice(0, 1000);
  let path;
  let body;
  if (m.kind === 'image') {
    if (!prompt) throw new Error(`${SERVICE} needs a prompt.`);
    path = 'text_to_image';
    body = { model: d.model, promptText: prompt, ratio: ratio(d, req.aspect) };
  } else if (req.image) {
    path = 'image_to_video';
    body = { model: d.model, promptImage: C.dataUri(req.image, SERVICE, MAX_IMAGE), ratio: ratio(d, req.aspect), duration: Number(req.seconds) || 5 };
    if (prompt) body.promptText = prompt;
  } else {
    if (!m.from.includes('text')) throw new Error(`${SERVICE} ${m.label} needs a start image.`);
    if (!prompt) throw new Error(`${SERVICE} needs a prompt.`);
    path = 'text_to_video';
    body = { model: d.model, promptText: prompt, ratio: ratio(d, req.aspect), duration: Number(req.seconds) || 5 };
  }
  if (req.seed != null && Number.isFinite(Number(req.seed))) body.seed = Math.floor(Number(req.seed));
  const j = await C.call(ctx, SERVICE, key, `${BASE}/${path}`, { method: 'POST', headers: headers(key), body: JSON.stringify(body), timeoutMs: 60000 });
  if (!j.id || !/^[A-Za-z0-9-]+$/.test(String(j.id))) throw new Error(`${SERVICE} did not start the job. Try again in a minute.`);
  return { job: { model: m.id, id: String(j.id) } };
}

async function check(ctx, key, job) {
  if (!job || !/^[A-Za-z0-9-]+$/.test(String(job.id || ''))) return { status: 'failed', error: `${SERVICE} lost track of this job.` };
  const t = await C.call(ctx, SERVICE, key, `${BASE}/tasks/${job.id}`, { headers: headers(key), timeoutMs: 30000 });
  switch (t.status) {
    case 'PENDING':
    case 'THROTTLED':
      return { status: 'queued' };
    case 'RUNNING':
      return { status: 'running' };
    case 'SUCCEEDED': {
      const files = (t.output || []).filter((u) => typeof u === 'string' && u).map((url) => ({ url }));
      return files.length ? { status: 'done', files } : { status: 'failed', error: `${SERVICE} finished but sent no file back.` };
    }
    case 'CANCELLED':
      return { status: 'failed', error: `${SERVICE} canceled this job.` };
    case 'FAILED':
      return { status: 'failed', error: C.jobError(SERVICE, `${t.failureCode || ''} ${t.failure || ''}`.trim(), key) };
    default:
      return { status: 'running' };
  }
}

module.exports = { id: 'runway', service: SERVICE, ...C.legalOf(D), models, start, check, data: D };
