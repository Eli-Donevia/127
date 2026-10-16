// Read-only token for the ad desk's joins export (/admin/joins.csv only). Growth's harness
// sends `Authorization: Bearer <JOINS_EXPORT_TOKEN>`; the CSV holds counts, no personal data.
// Blank or short tokens are refused so an empty secret can never open the route.
const crypto = require('crypto');

function bearer(req) {
  const m = /^Bearer\s+(\S+)$/i.exec(String((req.headers && req.headers.authorization) || ''));
  return m ? m[1] : '';
}

function valid(given, expected = process.env.JOINS_EXPORT_TOKEN) {
  if (!expected || String(expected).length < 24 || !given) return false;
  const a = crypto.createHash('sha256').update(String(given)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

// Lets the token through, otherwise falls back to the normal admin login chain.
function orAdmin(...chain) {
  return (req, res, next) => {
    if (valid(bearer(req))) return next();
    let i = 0;
    const step = (err) => (err ? next(err) : i < chain.length ? chain[i++](req, res, step) : next());
    step();
  };
}

module.exports = { bearer, valid, orAdmin };
