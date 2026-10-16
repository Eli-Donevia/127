// Small security helpers: in-memory rate limits, safe redirects, one-time tokens,
// response headers. Fine for a single Reserved VM instance.
const crypto = require('crypto');

const buckets = new Map();
// Returns true when the action is allowed, false when the limit is hit.
function allow(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset <= now) b = { count: 0, reset: now + windowMs };
  b.count += 1;
  buckets.set(key, b);
  return b.count <= max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
}, 60 * 1000).unref();

function ip(req) {
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Only same-site relative paths. Rejects //host, /\host, schemes and encoded tricks.
function safeNext(next, fallback = '/app') {
  const n = String(next || '');
  if (!n.startsWith('/') || n.startsWith('//') || n.includes('\\')) return fallback;
  try {
    const u = new URL(n, 'http://local.invalid');
    if (u.origin !== 'http://local.invalid') return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

function token() {
  return crypto.randomBytes(32).toString('hex');
}
function hash(t) {
  return crypto.createHash('sha256').update(String(t)).digest('hex');
}
function sameHash(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function isHttpUrl(s) {
  try {
    const u = new URL(String(s));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function headers(prod) {
  return (req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (prod) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

module.exports = { allow, ip, safeNext, token, hash, sameHash, isHttpUrl, headers };
