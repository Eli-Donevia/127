// ElevenLabs (harness key 'voice'): speech (Flash v2.5 and Eleven v3), sound effects and music. Each
// call answers at once with MP3 bytes, so start() returns files and nothing is polled. Prices and
// endpoints: data/providers.json "voice" (checked 2026-10-20). Speech with word timings for captions
// stays in packs/video/lib/providers.js; this is the plain studio voice.

const C = require('./common');

const SERVICE = 'ElevenLabs';
const D = C.DATA.voice;
const BASE = D.base;
const MP3 = 'output_format=mp3_44100_128';

const chars = (req) => String(req.text || req.prompt || '').length;

function clampSeconds(want, d, dflt) {
  const s = Number(want) || dflt;
  return Math.min(d.maxSeconds, Math.max(d.minSeconds, s));
}

const models = [
  C.model('voice', 'el-flash-2.5', speechUsd),
  C.model('voice', 'el-v3', speechUsd),
  C.model('voice', 'el-sfx', (req, d) => (clampSeconds(req.seconds, d, d.maxSeconds) / 60) * d.usdPerMinute),
  C.model('voice', 'el-music', (req, d) => (clampSeconds(req.seconds, d, 30) / 60) * d.usdPerMinute),
];

function speechUsd(req, d) {
  const n = chars(req);
  if (n > d.maxChars) throw new Error('Too long for this voice model.');
  return (Math.max(1, n) / 1000) * d.usdPer1kChars;
}

function headers(key) {
  return { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' };
}

let voiceList = null;

// req.voice: a voice id (20 letters and digits), or 'female' / 'male' for a premade voice.
async function voiceId(ctx, key, want) {
  if (want && /^[A-Za-z0-9]{20}$/.test(String(want))) return String(want);
  if (!voiceList) {
    const j = await C.call(ctx, SERVICE, key, `${BASE}/v2/voices?category=premade&page_size=100`, { headers: { 'xi-api-key': key }, timeoutMs: 20000 });
    voiceList = (j.voices || []).map((v) => ({ id: v.voice_id, gender: String((v.labels && v.labels.gender) || '').toLowerCase(), accent: String((v.labels && v.labels.accent) || '').toLowerCase() }));
  }
  if (!voiceList.length) throw new Error(`${SERVICE} sent no voices back.`);
  const gender = /^(fe)?male$/i.test(String(want || '')) ? String(want).toLowerCase() : 'female';
  const pool = voiceList.filter((v) => v.gender === gender);
  const list = (pool.length ? pool : voiceList).slice().sort((a, b) => (b.accent.includes('american') ? 1 : 0) - (a.accent.includes('american') ? 1 : 0));
  return list[0].id;
}

async function start(ctx, key, req) {
  const m = C.find(models, req.model);
  const d = m.data;
  const text = String(req.text || req.prompt || '').trim();
  if (!text) throw new Error(`${SERVICE} needs some text.`);
  let url;
  let body;
  if (m.kind === 'voice') {
    if (text.length > d.maxChars) throw new Error(`That script is too long for ${SERVICE} ${m.label} (the most is ${d.maxChars} characters).`);
    const id = await voiceId(ctx, key, req.voice);
    url = `${BASE}/v1/text-to-speech/${encodeURIComponent(id)}?${MP3}`;
    body = { text, model_id: d.model };
  } else if (m.kind === 'sfx') {
    url = `${BASE}/v1/sound-generation?${MP3}`;
    body = { text, model_id: d.model };
    if (Number(req.seconds) > 0) body.duration_seconds = clampSeconds(req.seconds, d, d.maxSeconds);
  } else {
    url = `${BASE}/v1/music?${MP3}`;
    body = { prompt: text, music_length_ms: Math.round(clampSeconds(req.seconds, d, 30) * 1000), model_id: d.model, force_instrumental: !req.vocals };
  }
  const out = await C.call(ctx, SERVICE, key, url, { method: 'POST', headers: headers(key), body: JSON.stringify(body), timeoutMs: 60000, raw: true });
  if (!out.data.length) throw new Error(`${SERVICE} sent back an empty file.`);
  return { files: [{ data: out.data, type: /^audio\//.test(out.type) ? out.type : 'audio/mpeg' }] };
}

// Nothing to poll: every answer comes at once.
async function check() {
  return { status: 'failed', error: `${SERVICE} has no job to check.` };
}

module.exports = { id: 'voice', service: SERVICE, ...C.legalOf(D), models, start, check, data: D, _reset: () => (voiceList = null) };
