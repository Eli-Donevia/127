// One door to every generative model (lib/providers): pick a model whose key is on and whose price
// fits the tool's credits, record the cost, start the job, wait for it, and bring the files back to
// this call's scratch folder. Returns null when no model can do it (every key off, as in production
// until Legal clears the services): the tool then makes its labeled sample (lib/samples.js).
//
// Price rule (contract 8): 1 credit is about $0.01 of our cost and a tool charges about 2x, so a tool
// worth `credits` may spend at most credits / 200 dollars on one call. lib/gen keeps to that, so a
// member is never charged less than the call cost us.
//
// Accounts (Legal row 8). For each provider, in this order:
//   1. the member's own account: ctx.secret(providers.MEMBER[id]) gives Hub's client (their key in
//      Connections, Media group; null on a sample run or when they haven't connected it). It's their
//      bill under their terms, so no ctx.spend and no credits / 200 cap; the tool returns ownAccount.
//   2. 127's account: ctx.secret(providers.OURS[id]), only for a provider whose account127 is
//      'cleared' (Gemini paid tier and Luma today). fal, Higgsfield, Runway and ElevenLabs never run
//      on 127's key.
// A tool declares the names it may use in wants (providers.keysFor()); an undeclared one counts as off.

const fs = require('fs');
const path = require('path');
const { media } = require('../../_kit');
const providers = require('./providers');

// Cheapest good first, per kind. A tool's `prefer` (or the member's pick) goes ahead of these.
const ORDER = {
  video: ['fal', 'higgsfield', 'runway', 'luma', 'gemini'],
  image: ['fal', 'gemini', 'higgsfield'],
  voice: ['voice', 'fal'],
  music: ['voice', 'fal'],
  sfx: ['voice', 'fal'],
  lipsync: ['fal'],
};

const KEYS = providers.IDS;


function maxUsdFor(credits) {
  return Math.max(0, Number(credits) || 0) / 200;
}

function read(ctx, name) {
  if (!name || !ctx || typeof ctx.secret !== 'function') return null;
  try {
    return ctx.secret(name) || null;
  } catch {
    return null; // the tool didn't declare it in wants
  }
}

// Which account a provider runs on right now: { key, account: 'member' | '127' } or null. key is the
// member's client or 127's key, as the plugin's start(ctx, key) takes it.
function accountFor(ctx, provider) {
  if (provider.ownAccount) {
    const mine = read(ctx, providers.MEMBER[provider.id]);
    if (providers.isClient(mine)) return { key: mine, account: 'member' };
  }
  if (provider.account127 === 'cleared') {
    const key = read(ctx, providers.OURS[provider.id]);
    if (key && !providers.isClient(key)) return { key, account: '127' };
  }
  return null;
}

// Kept for tools written against the first draft: accounts are read when choices() runs.
async function ready() {
  return {};
}

// The nearest allowed clip length at or under what was asked (else the shortest allowed).
function fitSeconds(model, want) {
  const list = (model.seconds || []).slice().sort((a, b) => a - b);
  if (!list.length || !want) return list[0] || want || null;
  const under = list.filter((s) => s <= want);
  return under.length ? under[under.length - 1] : list[0];
}

function takes(model, req) {
  const from = model.from || ['text'];
  if (model.kind === 'lipsync') return !!req.audio && (req.video ? from.includes('video') : req.image ? from.includes('image') : false);
  if (req.image && req.needImage) return from.includes('image');
  if (req.image) return from.includes('image') || from.includes('text');
  return from.includes('text');
}

// Every model that could do this request right now: [{ provider, model, key, account, usd, seconds }].
// usd is the list price of the call; maxUsd (the credits / 200 cap) applies only on 127's account.
function choices(ctx, kind, req = {}, { maxUsd = Infinity, prefer = [] } = {}) {
  const picked = [...new Set(prefer || [])];
  const order = [...new Set([...picked, ...(ORDER[kind] || []), ...KEYS])];
  const out = [];
  for (const { provider, model } of providers.models(kind)) {
    const acct = accountFor(ctx, provider);
    if (!acct) continue;
    const { key, account } = acct;
    if (!takes(model, req)) continue;
    if (req.aspect && model.aspects && !model.aspects.includes(req.aspect)) continue;
    if (req.model && req.model !== model.id) continue;
    const seconds = kind === 'video' || kind === 'lipsync' ? fitSeconds(model, req.seconds) : req.seconds;
    let usd;
    try {
      usd = Number(model.usd({ ...req, seconds }));
    } catch {
      continue;
    }
    if (!Number.isFinite(usd)) continue;
    if (account === '127' && usd > maxUsd + 1e-9) continue;
    out.push({ provider, model, key, account, usd, seconds });
  }
  // The image-capable ones first when there is a start frame (a product photo should be in the clip),
  // then a provider the tool or member picked, then the member's own accounts (they connected them to
  // use them), then preference order, then price.
  const rank = (c) => order.indexOf(c.provider.id);
  const pick = (c) => (picked.includes(c.provider.id) ? picked.indexOf(c.provider.id) : picked.length);
  out.sort((a, b) => {
    if (req.image) {
      const ai = (a.model.from || []).includes('image') ? 0 : 1;
      const bi = (b.model.from || []).includes('image') ? 0 : 1;
      if (ai !== bi) return ai - bi;
    }
    const am = a.account === 'member' ? 0 : 1;
    const bm = b.account === 'member' ? 0 : 1;
    return pick(a) - pick(b) || am - bm || rank(a) - rank(b) || a.usd - b.usd;
  });
  return out;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new Error('Stopped.'));
    const t = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('Stopped.'));
    }, { once: true });
  });
}

const EXT = { 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav' };
const MAX_BYTES = 200e6;

async function download(ctx, f, dir, n) {
  let data = f.data;
  let type = f.type || '';
  if (!data && f.url) {
    if (!/^https:\/\//i.test(String(f.url))) throw new Error('The service sent back a link we cannot open.');
    const res = await ctx.fetch(f.url, { timeoutMs: 60000 });
    if (!res.ok) throw new Error(`Downloading the result failed (${res.status}). Try again in a minute.`);
    type = type || String(res.headers.get('content-type') || '').split(';')[0].trim();
    data = Buffer.from(await res.arrayBuffer());
  }
  if (!data || !data.length) throw new Error('The service sent back an empty file.');
  if (data.length > MAX_BYTES) throw new Error('The result is too big to keep.');
  const ext = EXT[type] || path.extname(String(f.url || '').split('?')[0]) || '.bin';
  const file = path.join(dir, `gen-${n}${ext}`);
  fs.writeFileSync(file, data);
  return { path: file, type, bytes: data.length };
}

// kind: 'video' | 'image' | 'voice' | 'music' | 'sfx' | 'lipsync'. req as in lib/providers.
// opts: { credits (the tool's), prefer, timeoutSec, label (what the cost line says) }.
// Returns { files, provider, service, model, label, account, usd, seconds, audio, usage } or null when
// nothing can make it. account is 'member' (their own account: usd 0 to us, memberUsd is the list
// price on their bill) or '127' (usd is what we recorded with ctx.spend). usage is lib/providers
// usage(): { service, policy, attribution } for "Made with {service} · Usage rules".
async function generate(ctx, kind, req, { credits, prefer, timeoutSec = 840, label } = {}) {
  const list = choices(ctx, kind, req, { maxUsd: maxUsdFor(credits), prefer });
  if (!list.length) return null;
  const deadline = Date.now() + timeoutSec * 1000;
  let lastError = null;
  for (const c of list.slice(0, 2)) {
    const r = { ...req, model: c.model.id, seconds: c.seconds };
    try {
      const mine = c.account === 'member';
      if (!mine) await ctx.spend(c.usd, `${c.provider.service} ${c.model.label}${label ? `: ${label}` : ''}`);
      ctx.log(`Making it with ${c.provider.service}: ${c.model.label}, on ${mine ? `your own ${c.provider.service} account` : "127's account"}`);
      let res = await c.provider.start(ctx, c.key, r);
      let wait = 3000;
      while (!res.files) {
        if (Date.now() > deadline) throw new Error(`${c.provider.service} took too long. Try again in a few minutes.`);
        await sleep(wait, ctx.signal);
        wait = Math.min(15000, Math.round(wait * 1.5));
        const s = await c.provider.check(ctx, c.key, res.job);
        if (s.status === 'failed') throw new Error(s.error || `${c.provider.service} couldn't make this one.`);
        if (s.status === 'done') res = { files: s.files || [] };
      }
      if (!res.files.length) throw new Error(`${c.provider.service} sent nothing back.`);
      const dir = ctx.tmpdir();
      const files = [];
      for (let i = 0; i < res.files.length; i++) files.push(await download(ctx, res.files[i], dir, i));
      // Some models choose their own length (Luma from a photo, Gemini Omni): report what was made.
      let seconds = c.seconds;
      if ((kind === 'video' || kind === 'lipsync') && media.canRender(ctx)) {
        try {
          const d = (await media.probe(files[0].path)).duration;
          if (d > 0) seconds = Math.round(d * 10) / 10;
        } catch {
          /* keep the asked length */
        }
      }
      const out = { files, provider: c.provider.id, service: c.provider.service, model: c.model.id, label: c.model.label, account: c.account, usd: mine ? 0 : c.usd, seconds, audio: !!c.model.audio, usage: providers.usage(c.provider.id) };
      if (mine) out.memberUsd = c.usd;
      return out;
    } catch (e) {
      if (ctx.signal && ctx.signal.aborted) throw e;
      if (/cost limit|today's limit/i.test(e.message)) throw e; // ctx.spend's caps: don't try the next one
      lastError = e;
      ctx.log(`${c.provider.service} didn't finish: ${e.message}`);
    }
  }
  throw lastError || new Error('The model could not make this one. Try again in a minute.');
}

// What a member reads about which models are on, for a view: "fal: Kling 3.0 Standard (your own
// account)", or null.
function onFor(ctx, kind) {
  const seen = choices(ctx, kind, {}, {});
  if (!seen.length) return null;
  return `${seen[0].provider.service}: ${seen[0].model.label}${seen[0].account === 'member' ? ' (your own account)' : ''}`;
}

module.exports = { generate, choices, ready, maxUsdFor, fitSeconds, onFor, ORDER, KEYS, _sleep: sleep };
