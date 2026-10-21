// Fine print (Legal L103, Eli Oct 21: the faint gray disclaimer text goes everywhere). Lines a reader must see stay
// readable and at full contrast beside the claim they qualify: earnings and typicality lines, price and renewal terms,
// consent and agreement text, and not-advice lines. This finds such a line set in faint gray fine print: an element whose
// class the site's CSS makes both small (13px or less) and gray, or whose inline style does the same.
//
// Severity "hold": listed by `node scripts/copy-check.js`, not failed, while pages move to readable copy. Rules and the
// words to use instead: v2/design/premium-pass.md "Fine print".

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Lines L103 keeps visible next to the claim, at readable size and full contrast.
const MUST_READ = /aren't typical|not typical|yours will differ|no results promised|not a promise of|results vary|auto-?renew|\brenews?\b|cancel any ?time|\bbilled\b|locked (?:as long as|while) you stay|by (?:continuing|signing up|clicking|joining|applying|checking)|you agree|i agree|not (?:financial|investment|tax|legal|medical|health) advice|not advice|isn't advice|educational only|for information only/i;

const SMALL = /font(?:-size)?\s*:[^;]*?(?<![\d.])(?:[0-9]|1[0-3])(?:\.\d+)?px/;
const MUTED_VAR = /var\(--(?:muted|faint|mut|ink-3|tp-mut|h2-mut)\)/;

// A gray: the channels within 24 of each other, between #50 and #a8. On void or on white it reads as fine print.
function gray(hex) {
  const h = hex.replace('#', '');
  const c = h.length === 3 ? [...h].map((x) => parseInt(x + x, 16)) : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hi = Math.max(...c);
  return hi - Math.min(...c) <= 24 && hi >= 0x50 && hi <= 0xa8;
}

function faintDecl(d) {
  const col = (d.match(/(?:^|;)\s*color\s*:\s*([^;]+)/) || [])[1] || '';
  const hex = (col.match(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/i) || [])[0];
  return SMALL.test(d) && (MUTED_VAR.test(col) || (!!hex && gray(hex)));
}

// Classes the CSS sets small and gray, from the last class of each selector (".v5 .ticker-note" counts .ticker-note).
function faintClasses(cssTexts) {
  const out = new Set(['tiny']);
  for (const raw of cssTexts) {
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!faintDecl(m[2])) continue;
      for (const sel of m[1].split(',')) {
        const k = sel.trim().match(/\.([a-zA-Z][\w-]*)(?:::?[\w-]+(?:\([^)]*\))?)*$/);
        if (k) out.add(k[1]);
      }
    }
  }
  return out;
}

let cached;
function siteFaintClasses() {
  if (cached) return cached;
  // The site's stylesheets and the funnel pages' own (public/funnels/*.css).
  const files = ['css', 'funnels'].flatMap((d) => {
    const dir = path.join(ROOT, 'public', d);
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => path.join(dir, f)) : [];
  });
  cached = faintClasses(files.map((f) => fs.readFileSync(f, 'utf8')));
  return cached;
}

// Findings for one .ejs or .html file: [{ rule, severity, line, col, match, why }].
function finePrint(text, opts = {}) {
  if (opts.file && !/\.(ejs|html?)$/i.test(opts.file)) return [];
  const faint = opts.faint || siteFaintClasses();
  // EJS tags and comments become spaces (lines kept), so a "%>" inside a tag doesn't end it early.
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  const t = String(text).replace(/<%[\s\S]*?%>/g, blank).replace(/<!--[\s\S]*?-->/g, blank);
  const out = [];
  const re = /<([a-z][a-z0-9]*)\b([^>]*)>([\s\S]{0,600}?)<\/\1>/gi;
  let m;
  while ((m = re.exec(t))) {
    const cls = (m[2].match(/\bclass\s*=\s*"([^"]*)"/) || [])[1] || '';
    const style = (m[2].match(/\bstyle\s*=\s*"([^"]*)"/) || [])[1] || '';
    if (!(cls.split(/\s+/).some((c) => faint.has(c)) || faintDecl(style))) continue;
    const words = m[3].replace(/<[^>]+>/g, ' ');
    const k = words.match(MUST_READ);
    if (!k) continue;
    const before = t.slice(0, m.index);
    out.push({ rule: 'fine-print', severity: 'hold', line: before.split('\n').length, col: m.index - before.lastIndexOf('\n'), match: words.replace(/\s+/g, ' ').trim().slice(0, 80),
      why: `"${k[0]}" sits in faint gray fine print. Legal L103: earnings, typicality, price and renewal, consent and not-advice lines stay readable at full contrast next to the claim.` });
  }
  return out;
}

module.exports = { finePrint, faintClasses, MUST_READ };
