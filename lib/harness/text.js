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

module.exports = { plain, deepPlain, clip, clipLines };
