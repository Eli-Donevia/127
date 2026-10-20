// fal: one key for many models through fal's queue (submit, status, result). Endpoints, fields and
// prices: data/providers.json "fal" (checked 2026-10-20, sources there).
//   video   Kling 3.0 Standard (silent, $0.084 a second), Wan 3.0 720p with sound ($0.10 a second),
//           Kling 3.0 Pro from a start image with sound ($0.168 a second)
//   image   FLUX.2 ($0.012 a megapixel), FLUX.3 ($0.048 an image)
//   lipsync sync lipsync 1.9 on a video ($0.70 a minute), MiniMax H3 Max on a photo ($0.05 a second)
//   music   CassetteAI ($0.02 a minute); sfx Sonilo ($0.0018 a second)
// Files go in as data URIs (fal model pages: "a URL or a Base64 data URI").
// Legal row 8 (V6, V9): every request sends X-Fal-Store-IO: 0 so fal keeps no copy of inputs and
// outputs, result files expire after an hour (we save them to the Library at once), and only models
// fal marks Commercial use are offered. Through 127's account fal waits for Legal; a member's own fal
// key works now.

const C = require('./common');

const SERVICE = 'fal';
const D = C.DATA.fal;
const QUEUE = 'https://queue.fal.run';
const HOST = 'queue.fal.run';

const perSecond = (rateKey) => (req, d) => (Number(req.seconds) || d.seconds[0]) * d[rateKey];

function megapixels(w, h) {
  return Math.max(1, Math.ceil(((w * h) / 1048576) * 10) / 10);
}

function fluxSize(d, aspect) {
  return d.sizes[aspect] || d.sizes['1:1'];
}

const models = [
  C.model('fal', 'fal-kling-3-std', perSecond('usdPerSecond')),
  C.model('fal', 'fal-wan-3', perSecond('usdPerSecond')),
  C.model('fal', 'fal-kling-3-pro', perSecond('usdPerSecondAudio')),
  C.model('fal', 'fal-flux-2', (req, d) => {
    const [w, h] = fluxSize(d, req.aspect);
    return C.count(req, d.maxCount) * megapixels(w, h) * d.usdPerMegapixel;
  }),
  C.model('fal', 'fal-flux-3', (req, d) => d.usdPerImage),
  C.model('fal', 'fal-sync-lipsync', (req, d) => (C.audioSeconds(req) / 60) * d.usdPerMinute),
  C.model('fal', 'fal-h3-lipsync', (req, d) => {
    const s = Math.max(d.minSeconds, C.audioSeconds(req));
    return s * d.usdPerSecond * (s > d.longOverSeconds ? d.longMultiplier : 1);
  }),
  C.model('fal', 'fal-cassette-music', (req, d) => (clampSeconds(req.seconds, d, 30) / 60) * d.usdPerMinute),
  C.model('fal', 'fal-sonilo-sfx', (req, d) => clampSeconds(req.seconds, d, 8) * d.usdPerSecond),
].filter((m) => m.data.commercial === true); // V9: never a Research only model

function clampSeconds(want, d, dflt) {
  const s = Number(want) || dflt;
  return Math.min(d.maxSeconds, Math.max(d.minSeconds, s));
}

const STORE = D.storage.headers;

// Every call to fal: the key and "store nothing".
function pollHeaders(key) {
  return { Authorization: `Key ${key}`, 'X-Fal-Store-IO': STORE['X-Fal-Store-IO'] };
}

function headers(key) {
  return { ...pollHeaders(key), 'Content-Type': 'application/json' };
}

// The endpoint id and JSON input for a request.
function input(m, req) {
  const d = m.data;
  const prompt = String(req.prompt || '').trim();
  switch (m.id) {
    case 'fal-kling-3-std':
    case 'fal-kling-3-pro': {
      const body = { prompt, duration: String(req.seconds || 5), generate_audio: !!m.audio };
      if (req.negative) body.negative_prompt = String(req.negative);
      if (req.image && d.endpoints.image) {
        body.start_image_url = C.dataUri(req.image, SERVICE);
        return { endpoint: d.endpoints.image, body };
      }
      if (!d.endpoints.text) throw new Error(`${SERVICE} ${m.label} needs a start image.`);
      body.aspect_ratio = req.aspect || '9:16';
      return { endpoint: d.endpoints.text, body };
    }
    case 'fal-wan-3': {
      const body = { prompt, duration: Number(req.seconds) || 5, resolution: d.resolution, aspect_ratio: req.aspect || '9:16', audio: true };
      if (req.seed != null) body.seed = Number(req.seed);
      if (req.image) {
        body.start_image_url = C.dataUri(req.image, SERVICE);
        return { endpoint: d.endpoints.image, body };
      }
      return { endpoint: d.endpoints.text, body };
    }
    case 'fal-flux-2': {
      const [width, height] = fluxSize(d, req.aspect);
      const body = { prompt, image_size: { width, height }, num_images: C.count(req, d.maxCount), output_format: 'png' };
      if (req.seed != null) body.seed = Number(req.seed);
      return { endpoint: d.endpoints.text, body };
    }
    case 'fal-flux-3':
      return { endpoint: d.endpoints.text, body: { prompt, aspect_ratio: req.aspect || '1:1', resolution: d.resolution, output_format: 'png' } };
    case 'fal-sync-lipsync':
      if (!req.video || !req.audio) throw new Error(`${SERVICE} ${m.label} needs a video and a voice track.`);
      return { endpoint: d.endpoints.video, body: { video_url: C.dataUri(req.video, SERVICE), audio_url: C.dataUri(req.audio, SERVICE), sync_mode: 'cut_off' } };
    case 'fal-h3-lipsync':
      if (!req.image || !req.audio) throw new Error(`${SERVICE} ${m.label} needs a photo and a voice track.`);
      return { endpoint: d.endpoints.image, body: { image_url: C.dataUri(req.image, SERVICE), audio_url: C.dataUri(req.audio, SERVICE), resolution: d.resolution } };
    case 'fal-cassette-music':
      return { endpoint: d.endpoints.text, body: { prompt, duration: Math.round(clampSeconds(req.seconds, d, 30)) } };
    case 'fal-sonilo-sfx':
      return { endpoint: d.endpoints.text, body: { prompt, duration: clampSeconds(req.seconds, d, 8), audio_format: 'mp3' } };
    default:
      throw new Error('That model is not one we offer.');
  }
}

// owner/app of an endpoint id: fal-ai/kling-video/v3/standard/image-to-video -> fal-ai/kling-video.
function appOf(endpoint) {
  return String(endpoint).split('/').slice(0, 2).join('/');
}

async function start(ctx, key, req) {
  const m = C.find(models, req.model);
  if (!String(req.prompt || '').trim() && m.kind !== 'lipsync') throw new Error(`${SERVICE} needs a prompt.`);
  const { endpoint, body } = input(m, req);
  const h = { ...headers(key), 'X-Fal-Object-Lifecycle-Preference': JSON.stringify(STORE['X-Fal-Object-Lifecycle-Preference']) };
  const j = await C.call(ctx, SERVICE, key, `${QUEUE}/${endpoint}`, { method: 'POST', headers: h, body: JSON.stringify(body), timeoutMs: 60000 });
  const id = j.request_id;
  if (!id || !/^[A-Za-z0-9-]+$/.test(String(id))) throw new Error(`${SERVICE} did not start the job. Try again in a minute.`);
  const base = `${QUEUE}/${appOf(endpoint)}/requests/${id}`;
  // We send the key to these, so only fal's own queue host.
  const status = C.sameHost(j.status_url, HOST) ? j.status_url : `${base}/status`;
  const result = C.sameHost(j.response_url, HOST) ? j.response_url : base;
  return { job: { model: m.id, id, status, result } };
}

// The result's files. A content_type is kept only when it fits the field (fal's examples label some
// audio as image/png); otherwise the download's own header decides.
function filesOf(j) {
  const out = [];
  const add = (f, kind) => {
    if (!f || typeof f !== 'object' || !f.url) return;
    const t = String(f.content_type || '');
    out.push(t.startsWith(`${kind}/`) ? { url: f.url, type: t } : { url: f.url });
  };
  if (j.video) add(j.video, 'video');
  for (const im of j.images || []) add(im, 'image');
  if (j.image) add(j.image, 'image');
  if (j.audio_file) add(j.audio_file, 'audio');
  if (j.audios && j.audios.length) j.audios.forEach((a) => add(a, 'audio'));
  else if (j.audio) add(j.audio, 'audio');
  return out;
}

async function check(ctx, key, job) {
  if (!job || !C.sameHost(job.status, HOST) || !C.sameHost(job.result, HOST)) return { status: 'failed', error: `${SERVICE} lost track of this job.` };
  const s = await C.call(ctx, SERVICE, key, job.status, { headers: pollHeaders(key), timeoutMs: 30000 });
  if (s.status === 'IN_QUEUE') return { status: 'queued' };
  if (s.status === 'IN_PROGRESS') return { status: 'running' };
  if (s.status !== 'COMPLETED') return { status: 'running' };
  if (s.error) return { status: 'failed', error: C.jobError(SERVICE, s.error_type || s.error, key) };
  let r;
  try {
    r = await C.call(ctx, SERVICE, key, job.result, { headers: pollHeaders(key), timeoutMs: 60000 });
  } catch (e) {
    if (e.status && e.status >= 400 && e.status < 500) return { status: 'failed', error: e.message };
    throw e;
  }
  const files = filesOf(r);
  if (!files.length) return { status: 'failed', error: `${SERVICE} finished but sent no file back.` };
  return { status: 'done', files };
}

module.exports = { id: 'fal', service: SERVICE, ...C.legalOf(D), models, start, check, data: D, _input: input };
