// Media providers for the studio pack (W4). One plugin per outside service, each behind one harness
// key (contract section 6): fal, higgsfield, runway, luma, voice (ElevenLabs) and gemini. Every one is
// on the HELD list in lib/harness/needs.js until Legal clears it, so in production ctx.secret gives
// null and the tools make labeled samples instead. Prices and endpoints: data/providers.json (each with
// a checked date and its sources).
//
// A plugin exports:
//   id         'fal'       the plugin's id (a tool's provider pick; MEMBER and OURS below name its keys)
//   service    'fal'       the name a member reads ("Made with fal: Kling 2.1 Standard")
//   policy     the provider's usage policy URL ("Made with fal · Usage rules", Legal part 5 and V8)
//   attribution  null, or { text, url } a provider requires wherever it is used ("Powered by Runway")
//   account127 'cleared' | 'waits': whether 127's own key (ctx.secret(OURS[id])) may be used (Legal row 8)
//   ownAccount true when a member may connect their own account (ctx.secret(MEMBER[id])), cleared for all six
//   models     [{ id, kind, label, from, seconds, aspects, audio, usd(req) }]
//                kind     'video' | 'image' | 'voice' | 'music' | 'sfx' | 'lipsync'
//                from     what it takes: 'text', 'image' (a start frame), 'audio' + 'image' or 'video' (lipsync)
//                seconds  clip lengths it makes (video), like [5, 10]
//                aspects  ['9:16', '1:1', '16:9'] (video and image)
//                audio    true when the clip comes with sound
//                usd(req) our cost in dollars for this request (seconds, count, characters)
// key is 127's key (a string, or { key, secret }) or the member's client from Hub's connectors,
// { request(pathOrUrl, opts) }, which adds their key itself; common.call takes either.
//   async start(ctx, key, req)  -> { job } to poll, or { files } when the answer came at once
//   async check(ctx, key, job)  -> { status: 'queued' | 'running' | 'done' | 'failed', files, error }
//     files: [{ url }] (https, fetched with ctx.fetch) or [{ data: Buffer, type }]
//
// req (what lib/gen.js passes): { model, kind, prompt, negative, image, audio, video, seconds, aspect,
//   voice, count, seed } where image, audio and video are { data: Buffer, type, name } read from the
//   member's Library. Plugins send them as data URIs or uploads the way their API takes them.
//
// All web calls go through common.call (ctx.fetch, or the member's client). Never log or return a key; errors a member reads never quote the
// service's raw answer past its status and a short reason.

const IDS = ['fal', 'higgsfield', 'runway', 'luma', 'voice', 'gemini'];

// The two ways in (Legal L76 row 8). MEMBER: the member's own account, a Media connector in HQ;
// ctx.secret gives Hub's client, never the key. OURS: 127's own server key in lib/harness/needs.js,
// used only where account127 is 'cleared'. The names differ where both exist, since a name in needs
// is 127's account and wins over a member connector of the same name.
const MEMBER = { fal: 'fal', higgsfield: 'higgsfield', runway: 'runway', luma: 'luma', voice: 'elevenlabs', gemini: 'google_gemini' };
const OURS = { luma: 'luma_ai', voice: 'voice', gemini: 'gemini' };

// The key names a tool declares in wants for these providers.
function keysFor(ids = IDS) {
  const out = [];
  for (const id of ids) for (const k of [MEMBER[id], OURS[id]]) if (k && !out.includes(k)) out.push(k);
  return out;
}

let cache = null;
function all() {
  if (!cache) {
    cache = [];
    for (const id of IDS) {
      try {
        cache.push(require(`./${id === 'voice' ? 'elevenlabs' : id}`));
      } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') throw e;
      }
    }
  }
  return cache;
}

function get(id) {
  return module.exports.all().find((p) => p.id === id) || null;
}

// Every model of a kind, with its plugin: [{ provider, model }].
function models(kind) {
  const out = [];
  for (const p of module.exports.all()) for (const m of p.models || []) if (!kind || m.kind === kind) out.push({ provider: p, model: m });
  return out;
}

// What a tool shows with a result: "Made with {service} · [Usage rules]({policy})", plus the
// provider's required attribution when it has one ("Powered by Runway" linking runwayml.com).
// Returns { service, policy, attribution } or null for an unknown provider.
function usage(id) {
  const p = module.exports.get(id);
  if (!p) return null;
  const a = p.attribution;
  return { service: p.service, policy: p.policy || null, attribution: a && a.text ? { text: a.text, url: a.url || null } : null };
}

const { isClient } = require('./common');

module.exports = { IDS, MEMBER, OURS, keysFor, isClient, all, get, models, usage, _reset: () => (cache = null) };
