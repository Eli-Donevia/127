// The composer (HQ Post): write a post once, check how it looks on each place, OK it, and it goes out at
// its time. Instagram and Facebook first, through the member's own accounts (connectors/social.js).
//
// HQ_POSTS=admins|on, default off ("on" reaches members only while the Terms and Privacy pages are live).
// Every post is an act step (Legal A1): the member's OK covers exactly what the review showed, an edit
// after the OK takes it back, and a scheduled post goes at its time without another tap unless cancelled.
// Each place is also held by its act name in the engine's ACT_CLEARED (posts.instagram, posts.facebook);
// until Legal clears one, only admins can post there.
//
// Photos are cropped in the browser (public/js/hq-posts.js) and arrive as one JPEG per place. Instagram
// fetches the photo from a link, so each post has a random token and /p/m/:id/:place/:token serves its
// photo only while the post is waiting or going out. Photos are deleted 7 days after the post is done.
// Posts are in the `hqPosts` collection, photos in blobs `post_<id>_<place>`.

const crypto = require('crypto');
const hq = require('../hq');
const needsLib = require('./needs');
const connectors = require('./connectors');
const engine = require('./engine');
const llm = require('./llm');
const ledger = require('./ledger');
const brain = require('./brain');

const deps = { db: require('../db'), now: () => Date.now(), base: () => process.env.BASE_URL || 'https://127group.io' };
function _setDeps(over) {
  Object.assign(deps, over);
}

const DAY = 864e5;
const MAX_TEXT = 5000;
const MAX_PHOTO = 8 * 1024 * 1024;
const MAX_AHEAD = 75 * DAY;
const PER_DAY = 25; // posts per place per member per day, under Meta's own caps
const KEEP_PHOTOS = 7 * DAY;
const LINK_AFTER = 60 * 60 * 1000; // a finished post's photo link works for an hour more (Meta may fetch late)
const TRIES = 3;

const PLACES = {
  instagram: { name: 'Instagram', act: 'posts.instagram', max: 2200, photo: 'required', ratios: [0.8, 1.91], crops: [['4:5', 0.8], ['1:1', 1], ['1.91:1', 1.91]] },
  facebook: { name: 'Facebook', act: 'posts.facebook', max: 60000, photo: 'optional', ratios: null, crops: [['4:5', 0.8], ['1:1', 1], ['1.91:1', 1.91], ['Original', 0]] },
};
const placeIds = Object.keys(PLACES);
const STATES = { draft: 'Draft', ok: 'Waiting', posting: 'Going out', done: 'Out', failed: 'Needs a look', cancelled: 'Cancelled' };

class PostError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function flag() {
  const v = String(process.env.HQ_POSTS || '').toLowerCase();
  if (v === 'on' || v === 'true') return needsLib.pagesLive() ? 'on' : 'admins';
  return v === 'admins' ? 'admins' : 'off';
}
function on(user) {
  const m = flag();
  return !!user && hq.canUse(user) && connectors.on(user) && (m === 'on' || (m === 'admins' && connectors.isAdmin(user)));
}
// A place is open to this member when Legal cleared its act step, or they're an admin.
const cleared = (user, place) => engine.actCleared(PLACES[place].act) || connectors.isAdmin(user);

// ---------- photos ----------

// Width and height from a JPEG's frame header, or null when it isn't a JPEG.
function jpegSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
const blobOf = (post, place) => `post_${post.id}_${place}`;

// ---------- store ----------

const mine = (user) => deps.db.filter('hqPosts', (p) => p.memberId === user.id);
function get(user, id) {
  const p = deps.db.get('hqPosts', String(id || ''));
  return p && p.memberId === user.id ? p : null;
}
function list(user) {
  return mine(user).sort((a, b) => String(a.when || a.createdAt).localeCompare(String(b.when || b.createdAt)));
}

function blank(user) {
  const at = new Date(deps.now()).toISOString();
  return {
    id: deps.db.id(), memberId: user.id, text: '', places: {}, media: {}, when: null, ai: false,
    status: 'draft', ok: null, results: {}, tries: 0, token: crypto.randomBytes(24).toString('base64url'), createdAt: at, changedAt: at,
  };
}

// What the member wrote and picked. Any change takes back an OK.
async function save(user, post, body = {}) {
  if (post && !['draft', 'ok', 'failed'].includes(post.status)) throw new PostError("This post already went out, so it can't change.");
  const p = post || blank(user);
  if (!post && mine(user).filter((x) => x.status === 'draft').length >= 50) throw new PostError('You have 50 drafts. Delete some first.');
  p.text = String(body.text == null ? p.text : body.text).replace(/\r\n/g, '\n').slice(0, MAX_TEXT);
  for (const id of placeIds) {
    const b = (body.places || {})[id];
    if (!b) continue;
    const was = p.places[id] || {};
    p.places[id] = {
      on: b.on === true || b.on === 'on' || b.on === '1',
      target: b.target && b.target.id ? { id: String(b.target.id).replace(/\D/g, '').slice(0, 30), name: String(b.target.name || '').slice(0, 120) } : was.target || null,
      caption: b.caption == null ? was.caption || '' : String(b.caption).replace(/\r\n/g, '\n').slice(0, PLACES[id].max),
    };
  }
  if (body.when !== undefined) {
    const t = body.when ? Date.parse(body.when) : NaN;
    p.when = Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  if (body.ai !== undefined) p.ai = body.ai === true || body.ai === 'on' || body.ai === '1';
  unOk(p);
  p.changedAt = new Date(deps.now()).toISOString();
  await deps.db.save('hqPosts', p);
  return p;
}

function unOk(p) {
  if (p.status === 'ok' || p.status === 'failed') p.status = 'draft';
  p.ok = null;
}

async function setPhoto(user, post, place, buf) {
  if (!PLACES[place]) throw new PostError('Pick Instagram or Facebook.');
  if (post.status !== 'draft' && post.status !== 'ok' && post.status !== 'failed') throw new PostError("This post already went out, so it can't change.");
  if (!Buffer.isBuffer(buf) || !buf.length) throw new PostError('That photo is empty.');
  if (buf.length > MAX_PHOTO) throw new PostError('That photo is over 8 MB.');
  const size = jpegSize(buf);
  if (!size || !size.w || !size.h) throw new PostError('Use a JPEG photo.');
  const r = PLACES[place].ratios;
  const ratio = size.w / size.h;
  if (r && (ratio < r[0] - 0.01 || ratio > r[1] + 0.01)) throw new PostError(`${PLACES[place].name} takes photos from 4:5 to 1.91:1. Pick a crop.`);
  if (size.w < 320 || size.w > 4096 || size.h > 4096) throw new PostError('Use a photo between 320 and 4096 pixels wide.');
  await deps.db.putBlob(blobOf(post, place), buf);
  post.media[place] = { w: size.w, h: size.h, bytes: buf.length };
  unOk(post);
  post.changedAt = new Date(deps.now()).toISOString();
  await deps.db.save('hqPosts', post);
  return post.media[place];
}

async function dropPhoto(user, post, place) {
  if (!PLACES[place] || !post.media[place]) return;
  await deps.db.removeBlob(blobOf(post, place));
  delete post.media[place];
  unOk(post);
  await deps.db.save('hqPosts', post);
}

// ---------- where it can go ----------

// For each place: whether it's connected and open, and the accounts the member can post to there.
async function places(user) {
  const out = {};
  for (const id of placeIds) {
    const row = { id, name: PLACES[id].name, crops: PLACES[id].crops, photo: PLACES[id].photo, max: PLACES[id].max, connected: false, held: !cleared(user, id), accounts: [], error: null };
    const c = row.held ? null : connectors.clientFor(user, id, { tool: PLACES[id].act });
    if (c && typeof c.places === 'function') {
      row.connected = true;
      try {
        row.accounts = await c.places();
      } catch (err) {
        row.error = err.message;
      }
    }
    out[id] = row;
  }
  return out;
}

// ---------- OK, cancel ----------

const captionOf = (p, place) => String((p.places[place] && p.places[place].caption) || p.text || '').trim();
const hashOf = (p) => crypto.createHash('sha256').update(JSON.stringify({ text: p.text, places: p.places, media: p.media, when: p.when, ai: p.ai })).digest('hex');
const onPlaces = (p) => placeIds.filter((id) => p.places[id] && p.places[id].on);
const dayOf = (iso) => String(iso).slice(0, 10);

// What stops this post being OK'd, as plain lines; empty when it's ready.
function problems(user, p) {
  const out = [];
  const go = onPlaces(p);
  if (!go.length) out.push('Pick where it goes.');
  const when = p.when ? Date.parse(p.when) : deps.now();
  if (when > deps.now() + MAX_AHEAD) out.push('Pick a time within 75 days.');
  for (const id of go) {
    const P = PLACES[id];
    const pl = p.places[id];
    if (!cleared(user, id)) out.push(`${P.name} posting is waiting on Legal.`);
    else if (!connectors.ready(user, id)) out.push(`Connect ${P.name} first.`);
    if (!pl.target) out.push(`Pick which ${P.name} account.`);
    const cap = captionOf(p, id);
    if (cap.length > P.max) out.push(`The ${P.name} caption is over ${P.max.toLocaleString('en-US')} characters.`);
    if (P.photo === 'required' && !p.media[id]) out.push(`${P.name} needs a photo.`);
    if (!cap && !p.media[id]) out.push(`The ${P.name} post is empty.`);
    // Meta's posting API has no switch for its AI label (Terms 4, Studio), so these go from the app.
    if (p.ai) out.push(`Posts with an AI-made person or voice go from the ${P.name} app, where you can turn on its AI label.`);
    const sameDay = mine(user).filter((x) => x.id !== p.id && ['ok', 'posting', 'done'].includes(x.status) && x.places[id] && x.places[id].on && dayOf(x.when || x.changedAt) === dayOf(new Date(when).toISOString())).length;
    if (sameDay >= PER_DAY) out.push(`That's ${PER_DAY} ${P.name} posts on one day already.`);
  }
  return out;
}

async function approve(user, p) {
  if (p.status !== 'draft' && p.status !== 'failed') throw new PostError(p.status === 'ok' ? 'This one is already OK’d.' : "This post can't be OK'd now.");
  const bad = problems(user, p);
  if (bad.length) throw new PostError(bad.join(' '));
  if (!p.when || Date.parse(p.when) < deps.now()) p.when = new Date(deps.now()).toISOString();
  p.status = 'ok';
  p.ok = { by: user.id, at: new Date(deps.now()).toISOString(), hash: hashOf(p) };
  p.tries = 0;
  p.results = Object.fromEntries(Object.entries(p.results || {}).filter(([, r]) => r.state === 'out'));
  await deps.db.save('hqPosts', p);
  await connectors.log.add(user.id, { who: 'you', kind: 'approve', app: onPlaces(p)[0], what: `OK'd a post for ${onPlaces(p).map((x) => PLACES[x].name).join(' and ')}, going ${p.when}.`, runId: p.id, tool: 'posts' });
  return p;
}

async function cancel(user, p) {
  if (p.status !== 'ok') throw new PostError('Only a waiting post can be cancelled.');
  p.status = 'draft';
  p.ok = null;
  await deps.db.save('hqPosts', p);
  return p;
}

async function remove(user, p) {
  if (p.status === 'posting') throw new PostError("It's going out right now. Try again in a minute.");
  for (const id of placeIds) if (p.media[id]) await deps.db.removeBlob(blobOf(p, id));
  await deps.db.remove('hqPosts', p.id);
}

// ---------- going out ----------

const mediaUrl = (p, place) => `${deps.base()}/p/m/${p.id}/${place}/${p.token}`;

async function send(p) {
  const user = deps.db.get('users', p.memberId);
  if (!user) return;
  // An OK covers exactly what was shown: if anything changed since, it doesn't go.
  if (!p.ok || p.ok.hash !== hashOf(p)) {
    unOk(p);
    await deps.db.save('hqPosts', p);
    return;
  }
  p.status = 'posting';
  p.sentAt = new Date(deps.now()).toISOString();
  await deps.db.save('hqPosts', p);
  let retry = false;
  for (const id of onPlaces(p)) {
    if (p.results[id] && p.results[id].state === 'out') continue;
    const P = PLACES[id];
    const at = new Date(deps.now()).toISOString();
    if (!cleared(user, id)) {
      p.results[id] = { state: 'failed', error: `${P.name} posting is waiting on Legal.`, at };
      continue;
    }
    const c = connectors.clientFor(user, id, { write: true, approvedBy: p.ok.by, runId: p.id, tool: P.act });
    if (!c || !c.writes || !c.writes.post) {
      p.results[id] = { state: 'failed', error: `Reconnect ${P.name}, then OK it again.`, at };
      continue;
    }
    try {
      const out = await c.writes.post({ id: p.places[id].target.id, caption: captionOf(p, id), imageUrl: p.media[id] ? mediaUrl(p, id) : null });
      p.results[id] = { state: 'out', id: out.id, url: out.url, at };
    } catch (err) {
      const again = (err.status === 503 || err.status === 429 || err.status === 0 || err.status >= 500) && p.tries + 1 < TRIES;
      if (again) retry = true;
      p.results[id] = { state: again ? 'retry' : 'failed', error: String(err.message || 'It didn’t go.').slice(0, 300), at };
    }
  }
  const states = onPlaces(p).map((id) => (p.results[id] || {}).state);
  if (retry) {
    p.tries += 1;
    p.status = 'ok';
  } else p.status = states.every((s) => s === 'out') ? 'done' : 'failed';
  if (p.status === 'done' || p.status === 'failed') p.doneAt = new Date(deps.now()).toISOString();
  await deps.db.save('hqPosts', p);
}

let busy = false;
// Every minute (server.js): posts whose time has come go out, one at a time.
async function tick() {
  if (busy || flag() === 'off') return 0;
  busy = true;
  let n = 0;
  try {
    const due = deps.db.filter('hqPosts', (p) => (p.status === 'ok' && Date.parse(p.when) <= deps.now()) || (p.status === 'posting' && Date.parse(p.sentAt) < deps.now() - 15 * 60 * 1000));
    for (const p of due) {
      await send(p);
      n += 1;
    }
  } finally {
    busy = false;
  }
  return n;
}

// The photo link Instagram and Facebook fetch. Works only with the post's token, and only while it's
// waiting, going out, or just out.
async function media(id, place, token) {
  const p = deps.db.get('hqPosts', String(id || ''));
  if (!p || !PLACES[place] || !p.media[place]) return null;
  const a = Buffer.from(String(token || ''));
  const b = Buffer.from(p.token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const live = p.status === 'ok' || p.status === 'posting' || ((p.status === 'done' || p.status === 'failed') && Date.parse(p.doneAt || p.changedAt) > deps.now() - LINK_AFTER);
  if (!live) return null;
  return deps.db.getBlob(blobOf(p, place));
}

// Once a day: photos of posts done, failed or cancelled more than 7 days ago go.
async function sweep() {
  let n = 0;
  for (const p of deps.db.filter('hqPosts', (x) => ['done', 'failed', 'draft'].includes(x.status) && Object.keys(x.media || {}).length && Date.parse(x.doneAt || x.changedAt) < deps.now() - KEEP_PHOTOS)) {
    if (p.status === 'draft' && Date.parse(p.changedAt) > deps.now() - 30 * DAY) continue; // drafts keep theirs for 30 days
    for (const id of Object.keys(p.media)) await deps.db.removeBlob(blobOf(p, id));
    p.media = {};
    p.photosGone = true;
    await deps.db.save('hqPosts', p);
    n += 1;
  }
  return n;
}

async function forget(userId) {
  for (const p of deps.db.filter('hqPosts', (x) => x.memberId === userId)) {
    for (const id of Object.keys(p.media || {})) await deps.db.removeBlob(blobOf(p, id));
    await deps.db.remove('hqPosts', p.id);
  }
}

// For the HQ pulse (nudges): posts out from `since` up to `until` (now when left out), and posts waiting
// to go right now.
function counts(user, { since = deps.now() - 7 * DAY, until = Infinity } = {}) {
  let out = 0;
  let waiting = 0;
  for (const p of mine(user)) {
    if (p.status === 'ok') waiting += 1;
    for (const r of Object.values(p.results || {})) if (r.state === 'out' && Date.parse(r.at) >= since && Date.parse(r.at) < until) out += 1;
  }
  return { out, waiting };
}

// ---------- captions ----------

const CAPTIONS = {
  type: 'object',
  properties: {
    instagram: { type: 'string', maxLength: 2200 },
    facebook: { type: 'string', maxLength: 3000 },
  },
  required: ['instagram', 'facebook'],
};
const CAPTION_RULES = `You rewrite one social post from a small business owner for each place it goes. Keep their facts and their voice; add nothing they didn't say.
- instagram: the post as a caption. Line breaks are fine. At most 5 hashtags, at the end, only ones that fit the business. No links (they don't work there).
- facebook: the post for their Page, a little more plain, no hashtags. A link they gave can stay.
Never add prices, offers, dates, results or claims that aren't in their words.`;

async function captions(user, p) {
  if (!String(p.text || '').trim()) throw new PostError('Write the post first.');
  const r = await llm.call({
    task: 'write',
    tier: ledger.tierOf(user),
    brain: brain.snapshot(user),
    system: CAPTION_RULES,
    prompt: String(p.text).slice(0, MAX_TEXT),
    schema: CAPTIONS,
    maxTokens: 1500,
    onCost: async (meta) => ledger.cost(user, meta.usd, { tool: 'posts.captions' }),
  });
  const d = r.data || {};
  const body = { places: {} };
  for (const id of placeIds) if (typeof d[id] === 'string') body.places[id] = { ...(p.places[id] || {}), caption: d[id] };
  return { post: await save(user, p, body), sample: !!r.sample };
}

// ---------- view ----------

function view(user, p) {
  return {
    id: p.id, text: p.text, when: p.when, ai: p.ai, status: p.status, label: STATES[p.status] || p.status,
    places: Object.fromEntries(placeIds.map((id) => [id, { ...(p.places[id] || { on: false, target: null, caption: '' }), name: PLACES[id].name, caption: captionOf(p, id), media: p.media[id] ? { ...p.media[id], src: `/app/hq/post/${p.id}/photo/${id}` } : null, result: (p.results || {})[id] || null }])),
    problems: p.status === 'draft' || p.status === 'failed' ? problems(user, p) : [],
    photosGone: !!p.photosGone,
  };
}

module.exports = { PLACES, STATES, PostError, flag, on, cleared, jpegSize, list, get, save, setPhoto, dropPhoto, places, problems, approve, cancel, remove, tick, send, media, sweep, forget, counts, captions, view, hashOf, _setDeps };
