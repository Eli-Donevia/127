// Reads a professional Instagram account's public posts through Meta's Business Discovery API
// (graph.facebook.com/<127's IG user id>?fields=business_discovery.username(handle){...}) with 127's
// `instagram` key ({ token, userId }), then ranks the posts by the comments they already get.
// Comments are what trigger a keyword automation, so the best homes for the keyword are the posts
// people already comment on. Never logs or returns the token.

const { web, text } = require('../../_kit');

const FIELDS_FULL = 'username,name,followers_count,media_count,media.limit(40){caption,comments_count,like_count,media_type,media_product_type,permalink,timestamp}';
const FIELDS_BASIC = 'username,followers_count,media_count,media.limit(40){caption,comments_count,like_count,media_type,permalink,timestamp}';

function cleanHandle(h) {
  const s = String(h || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split(/[/?#]/)[0];
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s.toLowerCase() : '';
}

async function discovery(ctx, key, handle, fields) {
  const url = `https://graph.facebook.com/${encodeURIComponent(key.userId)}?fields=business_discovery.username(${handle}){${fields}}&access_token=${encodeURIComponent(key.token)}`;
  const r = await web.getJson(ctx, url, { timeoutMs: 15000, maxBytes: 2e6 });
  return r;
}

// { status: 'ok' | 'not_found' | 'error', profile, posts }
async function readAccount(ctx, key, handle) {
  let r;
  try {
    r = await discovery(ctx, key, handle, FIELDS_FULL);
    // Some fields aren't offered on every API version: ask again with the basic set.
    if (!r.ok && r.data && r.data.error && /field|param/i.test(String(r.data.error.message))) r = await discovery(ctx, key, handle, FIELDS_BASIC);
  } catch (e) {
    return { status: 'error', message: "Instagram didn't answer. Try again in a minute." };
  }
  const bd = r && r.data && r.data.business_discovery;
  if (!r.ok || !bd) {
    const msg = String((r && r.data && r.data.error && r.data.error.message) || '');
    if (/cannot be found|does not exist|not.*business|invalid user|username/i.test(msg)) return { status: 'not_found' };
    return { status: 'error', message: "Instagram didn't answer. Try again in a minute." };
  }
  const posts = ((bd.media && bd.media.data) || []).map((m) => ({
    id: String(m.id || ''),
    caption: text.oneLine(m.caption || ''),
    comments: Number(m.comments_count) || 0,
    likes: m.like_count == null ? null : Number(m.like_count) || 0,
    type: typeLabel(m.media_product_type, m.media_type),
    permalink: /^https:\/\/(www\.)?instagram\.com\//.test(String(m.permalink || '')) ? m.permalink : '',
    date: String(m.timestamp || '').slice(0, 10),
  }));
  return { status: 'ok', profile: { handle: bd.username || handle, followers: Number(bd.followers_count) || 0, mediaCount: Number(bd.media_count) || posts.length }, posts };
}

function typeLabel(product, type) {
  if (String(product).toUpperCase() === 'REELS') return 'Reel';
  if (String(type).toUpperCase() === 'CAROUSEL_ALBUM') return 'Carousel';
  if (String(type).toUpperCase() === 'VIDEO') return 'Video';
  return 'Photo';
}

function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function daysBetween(a, b) {
  const t = (s) => Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t(a)) && Number.isFinite(t(b)) ? Math.round((t(b) - t(a)) / 86400000) : null;
}

// Ranks posts: comments first (that's what fires the automation), then how recent, then likes.
// Returns the top posts, the format that gets the most comments, and plain advice.
function rank(posts, { today, followers = 0 } = {}) {
  const scored = posts.map((p) => {
    const age = today && p.date ? daysBetween(p.date, today) : null;
    const fresh = age == null ? 0.6 : age <= 30 ? 1 : age <= 90 ? 0.8 : age <= 365 ? 0.5 : 0.3;
    const score = (p.comments * 3 + (p.likes || 0) * 0.05) * fresh;
    return { ...p, age, score: Math.round(score * 10) / 10, per1k: followers ? Math.round((p.comments / followers) * 10000) / 10 : null };
  });
  const top = scored.slice().sort((a, b) => b.score - a.score || b.comments - a.comments).slice(0, 5);
  const byType = {};
  for (const p of scored) (byType[p.type] = byType[p.type] || []).push(p.comments);
  const formats = Object.entries(byType)
    .map(([type, list]) => ({ type, posts: list.length, medianComments: median(list) }))
    .sort((a, b) => b.medianComments - a.medianComments || b.posts - a.posts);
  // Posts people like but rarely comment on: a keyword line in the caption gives them a reason to.
  const quiet = scored.filter((p) => (p.likes || 0) >= 20 && p.comments <= Math.max(1, (p.likes || 0) * 0.02)).sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 3);
  return { top, formats, quiet, counted: scored.length, medianComments: median(scored.map((p) => p.comments)) };
}

module.exports = { readAccount, rank, cleanHandle, typeLabel, median };
