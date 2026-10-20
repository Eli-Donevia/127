// The homepage's own CSS, inlined so its first paint doesn't wait on style.css (which then loads without blocking).
// It's cut from style.css when first asked for (and again if style.css changes), so it can't go stale: a rule stays
// when every class, id and attribute it names appears somewhere in the homepage's sources (home.ejs, every partial
// it includes, and the scripts it loads), in the same order, so the cascade is unchanged. @font-face rules stay, and
// @keyframes do when a kept rule names them. Rules for other pages drop out. Anything the cut misses still arrives
// with style.css a moment later; test/critical-css.test.js keeps the cut honest.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS = path.join(ROOT, 'public/css/style.css');

// style.css as a tree: rules { sel, body } and at-rules { at, kids } (block at-rules) or { at, body } (the rest)
function parse(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  const block = () => {
    const out = [];
    while (i < src.length) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (i >= src.length) break;
      if (src[i] === '}') { i++; return out; }
      const open = src.indexOf('{', i), semi = src.indexOf(';', i);
      if (src[i] === '@' && semi !== -1 && (open === -1 || semi < open)) { out.push({ at: src.slice(i, semi).trim(), body: null }); i = semi + 1; continue; }
      if (open === -1) break;
      const head = src.slice(i, open).trim();
      i = open + 1;
      if (/^@(media|supports|layer|container|document)\b/.test(head)) { out.push({ at: head, kids: block() }); continue; }
      // a declaration block, to its matching brace (keyframes nest one level)
      let depth = 1, j = i;
      for (; j < src.length && depth; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; }
      out.push(head.startsWith('@') ? { at: head, body: src.slice(i, j - 1) } : { sel: head, body: src.slice(i, j - 1) });
      i = j;
    }
    return out;
  };
  return block();
}

// selectors split at top-level commas (not inside :is(), :not() or [..])
function split(sel) {
  const out = []; let d = 0, s = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--;
    if (ch === ',' && !d) { out.push(s.trim()); s = ''; } else s += ch;
  }
  if (s.trim()) out.push(s.trim());
  return out;
}

// every word in the homepage's sources: home.ejs, the partials it includes (all the way down) and its scripts
function homeWords() {
  const seen = new Set(), words = new Set();
  const read = (f) => {
    if (seen.has(f) || !fs.existsSync(f)) return; seen.add(f);
    const t = fs.readFileSync(f, 'utf8');
    for (const w of t.match(/[A-Za-z_][\w-]*/g) || []) words.add(w);
    for (const m of t.matchAll(/include\(\s*['"]((?:partials\/)?[\w/-]+)['"]/g)) {
      const name = m[1].startsWith('partials/') ? m[1] : 'partials/' + m[1];
      read(path.join(ROOT, 'views', name + '.ejs'));
    }
    for (const m of t.matchAll(/src=["']\/(js\/[\w./-]+\.js)["']|import\(\s*['"]\/(js\/[\w./-]+\.js)['"]/g)) read(path.join(ROOT, 'public', m[1] || m[2]));
  };
  read(path.join(ROOT, 'views/home.ejs'));
  return words;
}

const named = (s) => [...s.matchAll(/[.#]([A-Za-z_][\w-]*)|\[([A-Za-z_][\w-]*)/g)].map((m) => m[1] || m[2]);

function cut(tree, words) {
  const anims = new Set();
  const keep = (nodes) => nodes.map((n) => {
    if (n.sel) {
      const sels = split(n.sel).filter((s) => named(s).every((w) => words.has(w)));
      if (!sels.length) return null;
      for (const m of n.body.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) for (const w of m[1].split(/[\s,]+/)) anims.add(w);
      return { sel: sels.join(','), body: n.body };
    }
    if (n.kids) { const kids = keep(n.kids).filter(Boolean); return kids.length ? { at: n.at, kids } : null; }
    if (/^@font-face/.test(n.at) || n.body === null) return n;
    return n;   // @keyframes and the like: filtered below, once every rule has had its say
  }).filter(Boolean);
  const kept = keep(tree);
  const prune = (nodes) => nodes.filter((n) => !/^@(-webkit-)?keyframes\s/.test(n.at || '') || anims.has(n.at.split(/\s+/)[1]))
    .map((n) => (n.kids ? { at: n.at, kids: prune(n.kids) } : n));
  return prune(kept);
}

const min = (s) => s.replace(/\s+/g, ' ').replace(/\s*([{};:,>])\s*/g, '$1').replace(/;}/g, '}').trim();
function print(nodes) {
  return nodes.map((n) => (n.sel ? `${min(n.sel)}{${min(n.body)}}` : n.kids ? `${min(n.at)}{${print(n.kids)}}` : n.body === null ? `${min(n.at)};` : `${min(n.at)}{${min(n.body)}}`)).join('');
}

let memo = null;
function homeCritical() {
  let st; try { st = fs.statSync(CSS); } catch { return ''; }
  if (memo && memo.mtime === st.mtimeMs) return memo.css;
  let css = '';
  try { css = print(cut(parse(fs.readFileSync(CSS, 'utf8')), homeWords())); } catch { css = ''; }
  // a cut that comes out empty or broken falls back to the plain stylesheet link
  if ((css.match(/{/g) || []).length !== (css.match(/}/g) || []).length) css = '';
  memo = { mtime: st.mtimeMs, css };
  return css;
}

module.exports = { homeCritical, parse, split, cut, print, homeWords };
