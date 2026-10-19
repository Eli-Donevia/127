// The three paid services the pack can use, each behind a key the harness holds (never logged):
//   transcribe  Deepgram nova-3, POST https://api.deepgram.com/v1/listen ($0.0043 a minute)
//   voice       ElevenLabs text to speech with word timings ($0.04 per 1,000 characters, Flash)
//   pexels      Pexels stock video search (free, 200 requests an hour)
// Prices and sources: data/providers.json (checked 2026-10-19). All calls go through ctx.fetch.

const PROVIDERS = require('../data/providers.json');

async function readJson(res, what) {
  const body = await res.text();
  if (!res.ok) {
    const short = body.replace(/\s+/g, ' ').slice(0, 160);
    throw new Error(`${what} answered ${res.status}${short ? `: ${short}` : ''}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${what} sent something that isn't JSON.`);
  }
}

// ---------- Deepgram ----------

// audio: { data: Buffer, type: 'audio/mpeg' } or { url: 'https://...' }. Returns { words, language, seconds }
// with words as { w, s, e } (punctuated, on the audio's own clock).
async function deepgram(ctx, key, audio, { language } = {}) {
  const q = new URLSearchParams({ model: 'nova-3', smart_format: 'true', punctuate: 'true' });
  if (language && language !== 'auto') q.set('language', language);
  else if (language === 'auto') q.set('detect_language', 'true');
  const headers = { Authorization: `Token ${key}` };
  let body;
  if (audio.url) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ url: audio.url });
  } else {
    headers['Content-Type'] = audio.type || 'audio/mpeg';
    body = audio.data;
  }
  const res = await ctx.fetch(`https://api.deepgram.com/v1/listen?${q}`, { method: 'POST', headers, body, timeoutMs: 300000 });
  const j = await readJson(res, 'Transcription');
  const ch = (j.results && j.results.channels && j.results.channels[0]) || {};
  const alt = (ch.alternatives && ch.alternatives[0]) || {};
  const words = (alt.words || []).map((x) => ({ w: String(x.punctuated_word || x.word || ''), s: Number(x.start), e: Number(x.end) })).filter((x) => x.w && Number.isFinite(x.s));
  return { words, language: ch.detected_language || language || 'en', seconds: Number((j.metadata && j.metadata.duration) || 0) };
}

// ---------- ElevenLabs ----------

let voiceList = null;
async function voices(ctx, key) {
  if (voiceList) return voiceList;
  const res = await ctx.fetch('https://api.elevenlabs.io/v2/voices?category=premade&page_size=100', { headers: { 'xi-api-key': key }, timeoutMs: 20000 });
  const j = await readJson(res, 'The voice service');
  voiceList = (j.voices || []).map((v) => ({ id: v.voice_id, name: v.name, gender: ((v.labels && v.labels.gender) || '').toLowerCase(), accent: ((v.labels && v.labels.accent) || '').toLowerCase(), use: ((v.labels && (v.labels.use_case || v.labels['use case'])) || '').toLowerCase() }));
  return voiceList;
}

// A premade voice: the gender asked for, American accent first, narration voices first.
async function pickVoice(ctx, key, { gender = 'female', seed = '' } = {}) {
  const list = await voices(ctx, key);
  if (!list.length) throw new Error('No voices came back from the voice service.');
  const want = list.filter((v) => !gender || v.gender === gender);
  const pool = (want.length ? want : list).slice().sort((a, b) => (b.accent.includes('american') ? 1 : 0) - (a.accent.includes('american') ? 1 : 0) || (/narrat|social|convers/.test(b.use) ? 1 : 0) - (/narrat|social|convers/.test(a.use) ? 1 : 0));
  const top = pool.slice(0, 3);
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return top[h % top.length];
}

// Speech for `text` with word timings. Returns { audio: Buffer (mp3), words: [{ w, s, e }], voice, chars, usd }.
async function speak(ctx, key, text, { gender, seed } = {}) {
  const v = await pickVoice(ctx, key, { gender, seed });
  const res = await ctx.fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v.id)}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: PROVIDERS.voice.model, voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true } }),
    timeoutMs: 120000,
  });
  const j = await readJson(res, 'The voice service');
  if (!j.audio_base64) throw new Error('The voice service sent no audio.');
  const al = j.alignment || j.normalized_alignment || {};
  const chars = al.characters || [];
  const st = al.character_start_times_seconds || [];
  const en = al.character_end_times_seconds || [];
  const words = [];
  let cur = null;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      if (cur) words.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = { w: '', s: Number(st[i]) || 0, e: Number(en[i]) || 0 };
    cur.w += c;
    cur.e = Number(en[i]) || cur.e;
  }
  if (cur) words.push(cur);
  const usd = (text.length / 1000) * PROVIDERS.voice.usdPer1kChars;
  return { audio: Buffer.from(j.audio_base64, 'base64'), words, voice: v.name, chars: text.length, usd };
}

// ---------- Pexels ----------

// Portrait (or landscape/square) stock clips for a search. Returns [{ id, link, width, height,
// duration, by, page }] best size first. Free; attribution: "Video by <by> on Pexels".
async function pexels(ctx, key, query, { orientation = 'portrait', count = 6, minSeconds = 4 } = {}) {
  const q = new URLSearchParams({ query, orientation, size: 'medium', per_page: String(Math.min(30, count * 3)) });
  const res = await ctx.fetch(`https://api.pexels.com/v1/videos/search?${q}`, { headers: { Authorization: key }, timeoutMs: 20000 });
  const j = await readJson(res, 'Pexels');
  const wantW = orientation === 'landscape' ? 1920 : 1080;
  const out = [];
  for (const v of j.videos || []) {
    if (Number(v.duration) < minSeconds) continue;
    const files = (v.video_files || []).filter((f) => /mp4/i.test(f.file_type || '') && f.link && f.width && f.height);
    if (!files.length) continue;
    // The smallest file that is at least our width, else the biggest there is.
    const sorted = files.slice().sort((a, b) => a.width - b.width);
    const f = sorted.find((x) => Math.min(x.width, x.height) >= Math.min(wantW, 1080) * 0.9) || sorted[sorted.length - 1];
    out.push({ id: v.id, link: f.link, width: f.width, height: f.height, duration: Number(v.duration), by: (v.user && v.user.name) || 'a Pexels creator', page: v.url });
    if (out.length >= count) break;
  }
  return out;
}

module.exports = { deepgram, speak, pexels, pickVoice, PROVIDERS, _reset: () => (voiceList = null) };
