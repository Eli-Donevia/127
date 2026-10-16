// Loads a local .env file if present (Replit uses the Secrets tab instead).
// Supports KEY=value, quoted values, full-line comments and inline " # comments".
const fs = require('fs');
const path = require('path');

function parseValue(raw) {
  const v = raw.trim();
  const q = v.match(/^(["'])(.*)\1(\s+#.*)?$/);
  if (q) return q[2];
  if (v.startsWith('#')) return ''; // empty value followed by a comment
  return v.replace(/\s+#.*$/, '').trim();
}

function load() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = parseValue(m[2]);
  }
}

module.exports = { load, parseValue };
