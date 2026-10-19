// House style for anything a member reads: plain text, no markdown, no em or en dashes as
// punctuation, single spaces. Shared by the AI layer, the views and the packs.

function plain(s) {
  return String(s == null ? '' : s)
    .replace(/\r\n/g, '\n')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*•]\s+/gm, '- ')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)')
    .replace(/^(\s*)[—–]\s*/gm, '$1- ')
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+–\s+/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// plain() on every string inside a value.
function deepPlain(v) {
  if (typeof v === 'string') return plain(v);
  if (Array.isArray(v)) return v.map(deepPlain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepPlain(x)]));
  return v;
}

function clip(s, n) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, Math.max(0, n - 3)).trimEnd()}...` : t;
}

// Like clip, for text someone sends or reads as written (an email, a reply): keeps its line breaks.
function clipLines(s, n) {
  const t = String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t.length > n ? `${t.slice(0, Math.max(0, n - 3)).trimEnd()}...` : t;
}

// A server's error can echo the request, and some requests carry 127's key in the URL: in the path
// (Tracestrack's Overpass) or the query (LocationIQ's ?key=, the Graph API's access_token). What a pack
// or a server says goes through this before it's logged, saved or shown: a URL keeps only its scheme
// and host (no user:password@), anything after the host shows as /[hidden], and key-like values are
// hidden (the gym pack's G55, for every pack). A bare "https://" or "example.com." reads as written.
function scrubKeys(text) {
  return String(text == null ? '' : text)
    .replace(/\b(https?:\/\/)(?:[^\s/?#"'<>@]*@)?([^\s/?#"'<>@]+)([^\s"'<>]*)/gi, (m, scheme, host, rest) => `${scheme}${host}${rest ? '/[hidden]' : ''}`)
    .replace(/\/overpass\/[^\s/"'<>]+/gi, '/overpass/[hidden]')
    .replace(/([?&](?:key|api_?key|apikey|access_token|token|secret|signature|sig|password|auth)=)[^&\s"'<>]+/gi, '$1[hidden]')
    .replace(/\b(?=[A-Za-z0-9._-]*\d)(?=[A-Za-z0-9._-]*[A-Za-z])[A-Za-z0-9._-]{24,}/g, '[hidden]');
}

// An error for the server log, scrubbed: its stack (or message) and up to three causes.
function scrubError(err, depth = 0) {
  if (!err || typeof err !== 'object') return scrubKeys(err);
  const head = scrubKeys(err.stack || `${err.name || 'Error'}: ${err.message}`);
  return err.cause && depth < 3 ? `${head}\n  caused by: ${scrubError(err.cause, depth + 1)}` : head;
}

module.exports = { plain, deepPlain, clip, clipLines, scrubKeys, scrubError };
