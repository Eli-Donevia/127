// Instagram, two honest ways:
//   1. 127's own Instagram Business Discovery token (ctx.secret('instagram')): the official Graph API
//      returns a business account's public followers, post count and recent posts with likes, comments,
//      dates and type. Free; 200 calls an hour per token. Needs 127's Instagram professional account,
//      a Meta app and (for member use) Meta's app review. Works only for Business or Creator accounts,
//      which almost every gym is.
//   2. Screenshots the member takes of the gym's profile (gym.read_profile): read by AI, no API at all.
// No logged-out scraping of instagram.com: it breaks Instagram's terms and gets blocked anyway.

const { getText, round, median } = require('./util');

const GRAPH = 'https://graph.facebook.com';

// The harness hands over { token, userId } (IG_ACCESS_TOKEN and IG_USER_ID); a JSON string or
// "userId:token" also works for local runs.
function parseSecret(raw) {
  if (!raw) return null;
  const norm = (o) => {
    const id = o && (o.igUserId || o.userId);
    return id && o.token ? { igUserId: String(id), token: String(o.token) } : null;
  };
  if (typeof raw === 'object') return norm(raw);
  const s = String(raw).trim();
  if (s.startsWith('{')) {
    try {
      return norm(JSON.parse(s));
    } catch {
      return null;
    }
  }
  const [igUserId, token] = s.split(':');
  return igUserId && token ? { igUserId, token } : null;
}

// Raw Business Discovery media -> the numbers we score on. Pure.
function summarize(account, nowMs) {
  const media = (account.media && account.media.data) || [];
  const times = media.map((m) => Date.parse(m.timestamp)).filter(Number.isFinite).sort((a, b) => b - a);
  const day = 864e5;
  const last = times[0];
  const in30 = times.filter((t) => nowMs - t <= 30 * day).length;
  const span = times.length > 1 ? (times[0] - times[times.length - 1]) / day : null;
  const reels = media.filter((m) => m.media_product_type === 'REELS' || m.media_type === 'VIDEO').length;
  const eng = media.map((m) => (Number(m.like_count) || 0) + (Number(m.comments_count) || 0));
  const followers = Number(account.followers_count) || 0;
  const best = media.slice().sort((a, b) => (b.like_count || 0) + (b.comments_count || 0) - ((a.like_count || 0) + (a.comments_count || 0)))[0];
  return {
    source: 'instagram',
    handle: account.username,
    followers,
    posts: Number(account.media_count) || 0,
    bio: account.biography || null,
    sampled: media.length,
    daysSinceLastPost: last ? Math.floor((nowMs - last) / day) : null,
    postsLast30: in30,
    postsPerWeek: span && span > 0 ? round(((times.length - 1) / span) * 7, 1) : null,
    reelsShare: media.length ? round(reels / media.length, 2) : null,
    medianEngagement: median(eng),
    engagementRate: followers && eng.length ? round((median(eng) / followers) * 100, 2) : null,
    bestPost: best ? { url: best.permalink, type: best.media_product_type || best.media_type, likes: best.like_count || 0, comments: best.comments_count || 0, caption: String(best.caption || '').slice(0, 140) } : null,
  };
}

async function businessDiscovery(ctx, handle) {
  const sec = parseSecret(ctx.secret && ctx.secret('instagram'));
  if (!sec || !handle) return null;
  const h = String(handle).replace(/^@/, '').trim().toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(h)) return null;
  const key = `gym:ig:${h}`;
  if (ctx.cache) {
    try {
      const hit = await ctx.cache.get(key);
      if (hit) return hit;
    } catch {
      /* best effort */
    }
  }
  const version = sec.version || 'v23.0';
  const fields = `business_discovery.username(${h}){username,name,followers_count,media_count,biography,media.limit(12){timestamp,media_type,media_product_type,like_count,comments_count,permalink,caption}}`;
  const url = `${GRAPH}/${version}/${encodeURIComponent(sec.igUserId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(sec.token)}`;
  let out;
  try {
    const res = await getText(ctx, url, { timeoutMs: 15000, headers: { Accept: 'application/json' } });
    const json = JSON.parse(res.text);
    if (res.ok && json.business_discovery) out = summarize(json.business_discovery, ctx.now ? ctx.now() : Date.now());
    else {
      // Personal accounts, wrong handles and rate limits all land here: "not checked", never a guess.
      const limited = res.status === 429 || /rate|limit/i.test(String(json.error && json.error.message));
      out = { source: 'instagram', handle: h, unavailable: limited ? 'rate limit' : 'not a business account or not found' };
    }
  } catch {
    return null;
  }
  if (ctx.cache) {
    try {
      await ctx.cache.set(key, out, out.unavailable === 'rate limit' ? 0.25 : 24);
    } catch {
      /* best effort */
    }
  }
  return out;
}

module.exports = { businessDiscovery, summarize, parseSecret };
