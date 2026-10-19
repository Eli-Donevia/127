// A brand refresh from the member's own website: the colors and fonts the page's code sets, the
// pairs that are hard to read, the main line, and three ways forward (your colors fixed for
// contrast, your main color with a new accent, or a fresh start), plus tagline options, a before
// and after board and where to update, free things first. Everything "before" is read off the
// page; nothing is guessed about the business.

const { color, text } = require('../../_kit');
const svg = require('../../_kit/svg');
const scan = require('../../_kit/scan');
const P = require('./palettes');
const L = require('./logos');
const { nicheFor } = require('./lexicon');

const { contrast } = color;
const GENERIC_FONTS = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', '-apple-system', 'blinkmacsystemfont', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'inherit', 'initial', 'unset', 'revert', 'emoji', 'math', 'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji', 'var']);
const SCRIPT_FONTS = /lobster|pacifico|comic sans|brush script|papyrus|dancing script|great vibes|satisfy|kaushan|courgette|cookie|sacramento|amatic|permanent marker|indie flower|shadows into light|chewy|bangers|luckiest guy|curlz|jokerman|chiller/i;
const HYPE = /\b(best|#1|number one|top[- ]rated|amazing|incredible|unbeatable|like never before|world[- ]class|premier|ultimate)\b/i;
// Stylesheets that are a library's, not the brand's.
const SKIP_CSS = /font-?awesome|bootstrap|jquery|wp-includes|elementor\/assets\/lib|cookie|recaptcha|swiper|slick|animate\.(min\.)?css|normalize|reset\.css|fonts\.googleapis|use\.typekit|fonts\.bunny/i;

const lower = (s) => String(s || '').toLowerCase();
const cap = (s) => text.sentenceCase(String(s || '').trim());

// <style> blocks and style="" attributes.
function inlineCss(html) {
  const h = String(html || '');
  const blocks = (h.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).map((b) => b.replace(/<\/?style\b[^>]*>/gi, ''));
  const attrs = (h.match(/\sstyle\s*=\s*"[^"]*"/gi) || []).map((a) => `inline{${a.replace(/^\s*style\s*=\s*"/i, '').replace(/"$/, '')}}`);
  return [...blocks, ...attrs].join('\n');
}

// Up to 3 stylesheet links worth reading (the site's own, not a library's).
function stylesheetLinks(html, base) {
  const out = [];
  for (const tag of String(html || '').match(/<link\b[^>]*>/gi) || []) {
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue;
    const href = (tag.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!href || SKIP_CSS.test(href)) continue;
    try {
      const u = new URL(href, base).toString();
      if (/^https:\/\//.test(u) && !out.includes(u)) out.push(u);
    } catch {
      /* not a URL */
    }
    if (out.length >= 3) break;
  }
  return out;
}

function rulesOf(css) {
  const out = [];
  const t = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(t))) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    if (!selector || selector.startsWith('@')) continue;
    const decls = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const k = d.slice(0, i).trim().toLowerCase();
      const v = d.slice(i + 1).trim().replace(/\s*!important\s*$/i, '');
      if (k && v) decls[k] = v;
    }
    out.push({ selector: selector.replace(/^.*\}\s*/, ''), decls });
  }
  return out;
}

const pad2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

// "#abc", "#aabbcc", "#aabbccff", "rgb(1, 2, 3)", "rgba(1,2,3,.9)" -> "#rrggbb" (null when see-through).
function hexOf(v) {
  const s = String(v || '').trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return `#${m[1].split('').map((c) => c + c).join('')}`;
  m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) return m[2] && parseInt(m[2], 16) < 128 ? null : `#${m[1]}`;
  m = s.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    const a = m[4] == null ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (a < 0.5) return null;
    return `#${pad2(m[1])}${pad2(m[2])}${pad2(m[3])}`;
  }
  const named = { white: '#ffffff', black: '#000000' };
  return named[s] || null;
}
const COLOR_IN = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/gi;

function lightness(hex) {
  const rgb = color.hexToRgb(hex);
  return rgb ? color.rgbToHsl(rgb)[2] : 0.5;
}
function hue(hex) {
  const rgb = color.hexToRgb(hex);
  return rgb ? color.rgbToHsl(rgb)[0] : 0;
}
const hueGap = (a, b) => Math.abs(((hue(a) - hue(b) + 540) % 360) - 180);

// What a selector is, in plain words.
function plainSelector(sel) {
  const s = lower(sel);
  if (/^(html|body)\b|^body\s*,|^:root/.test(s)) return 'Body text';
  if (/\bh[1-3]\b|heading|title/.test(s)) return 'Headings';
  if (/\bbtn\b|\bbutton\b|\bcta\b/.test(s)) return 'Buttons';
  if (/^a\b|^a:|\blink\b/.test(s)) return 'Links';
  if (/footer/.test(s)) return 'Footer';
  if (/top|header|nav|banner|announce/.test(s)) return 'Top bar';
  if (/price/.test(s)) return 'Prices';
  if (/badge|tag|label/.test(s)) return 'Badges';
  if (s === 'inline') return 'A line styled on the page';
  return `"${text.clip(sel, 40)}"`;
}

function fontsFrom(rules, html) {
  const google = [];
  for (const href of String(html || '').match(/fonts\.googleapis\.com\/css2?\?[^"'\s>]+/gi) || []) {
    const q = href.replace(/&amp;/g, '&');
    for (const fam of q.match(/family=([^&]+)/gi) || []) {
      for (const one of fam.replace(/^family=/i, '').split('|')) {
        const name = decodeURIComponent(one.split(':')[0].replace(/\+/g, ' ')).trim();
        if (name && !google.includes(name)) google.push(name);
      }
    }
  }
  const counts = new Map();
  let heading = '';
  let body = '';
  for (const r of rules) {
    const v = r.decls['font-family'] || (r.decls.font && /,|["']/.test(r.decls.font) ? r.decls.font.replace(/^.*?\d(?:px|rem|em|pt|%)?(?:\/[\d.]+\w*)?\s+/, '') : '');
    if (!v) continue;
    const first = v.split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).find((x) => x && !GENERIC_FONTS.has(lower(x)) && !/^var\(/.test(x));
    if (!first) continue;
    counts.set(first, (counts.get(first) || 0) + 1);
    const label = plainSelector(r.selector);
    if (label === 'Headings' && !heading) heading = first;
    if (label === 'Body text' && !body) body = first;
  }
  const all = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  for (const g of google) if (!all.some((x) => lower(x) === lower(g))) all.push(g);
  return { heading: heading || all[0] || '', body: body || all.find((x) => x !== heading) || all[0] || '', all: all.slice(0, 6), google };
}

// Share and follow buttons wear other companies' colors, so their rules are left out.
const SOCIAL = /facebook|twitter|whatsapp|instagram|youtube|linkedin|pinterest|tiktok|snapchat|telegram|reddit|tumblr|mastodon|threads|spotify|\bshare|social|\bfb\b/i;

// Colors the page's code sets, counted by use, and the pairs it puts together.
function colorsFrom(rules, html) {
  const tally = new Map();
  const add = (hex, use, n = 1) => {
    if (!hex) return;
    const t = tally.get(hex) || { hex, count: 0, uses: new Set() };
    t.count += n;
    t.uses.add(use);
    tally.set(hex, t);
  };
  const named = {};
  const pairs = [];
  for (const r of rules) {
    const d = r.decls;
    if (SOCIAL.test(r.selector)) continue;
    for (const [k, v] of Object.entries(d)) {
      if (k.startsWith('--')) {
        const hex = hexOf(v);
        if (hex && /primary|brand|main/.test(k)) named.primary = named.primary || hex;
        if (hex && /accent|secondary|highlight/.test(k)) named.accent = named.accent || hex;
        if (hex) add(hex, 'variable');
        continue;
      }
      const found = (String(v).match(COLOR_IN) || []).map(hexOf).filter(Boolean);
      if (!found.length) continue;
      if (k === 'color') add(found[0], 'text');
      else if (k === 'background' || k === 'background-color') add(found[0], 'background', 2);
      else if (/border|outline|fill|stroke|shadow/.test(k)) add(found[0], 'line');
    }
    const fg = d.color ? hexOf((String(d.color).match(COLOR_IN) || [])[0]) : null;
    const bgRaw = d['background-color'] || d.background;
    const bg = bgRaw ? hexOf((String(bgRaw).match(COLOR_IN) || [])[0]) : null;
    if (fg) pairs.push({ selector: r.selector, fg, bg });
  }
  const theme = scan.meta(String(html || ''), 'theme-color');
  const themeHex = theme ? hexOf(theme) : null;
  const list = [...tally.values()].map((t) => ({ hex: t.hex, count: t.count, uses: [...t.uses] })).sort((a, b) => b.count - a.count);
  const brandish = list.filter((t) => scan.isBrandish(t.hex));
  const primary = (named.primary && scan.isBrandish(named.primary) && named.primary) || (themeHex && scan.isBrandish(themeHex) && themeHex) || (brandish[0] && brandish[0].hex) || null;
  const accentPick = (named.accent && named.accent !== primary && named.accent) || (brandish.find((t) => t.hex !== primary && hueGap(t.hex, primary) >= 25) || brandish.find((t) => t.hex !== primary) || {}).hex || null;
  const ink = (list.find((t) => t.uses.includes('text') && lightness(t.hex) < 0.5) || {}).hex || null;
  const paper = (list.find((t) => t.uses.includes('background') && lightness(t.hex) > 0.85) || {}).hex || '#ffffff';
  return { primary, accent: accentPick, ink, paper, found: list.slice(0, 10), pairs, source: named.primary ? 'css variables' : themeHex === primary && primary ? 'theme-color' : primary ? 'site css' : null };
}

// Text that sits on the page itself when its rule sets no background: page-level elements and
// single classes, never a selector inside something else (".site-header a" is on the header's color).
const ON_PAGE = /^(?:html|body|:root|main|article|p|li|a|h[1-6]|small|strong|em|span|label|\.[\w-]+)(?::[\w-]+(?:\([^)]*\))?)*$/i;

// The pairs the page actually uses, checked. A rule with no background is checked on the page color
// only when its text sits on the page and is not light (light text with no background of its own is
// on a dark band we can't see).
function checksFrom(cur) {
  const seen = new Set();
  const out = [];
  for (const p of cur.pairs) {
    // Helper classes (screen readers, color presets, focus rings) are not text a visitor reads.
    if (/screen-reader|sr-only|visually-hidden|skip-link|\.has-[\w-]*color|:focus/i.test(p.selector)) continue;
    if (!p.bg) {
      const parts = String(p.selector).split(',').map((x) => x.trim());
      if (!parts.every((x) => ON_PAGE.test(x)) || lightness(p.fg) > 0.75) continue;
    }
    const bg = p.bg || cur.paper;
    const use = plainSelector(p.selector);
    const key = `${use}|${p.fg}|${bg}`;
    if (seen.has(key) || p.fg === bg) continue;
    seen.add(key);
    const large = use === 'Headings';
    const need = large ? 3 : 4.5;
    const raw = contrast(p.fg, bg);
    // Rounded for show, compared unrounded: 4.48 is not 4.5.
    out.push({ use, selector: p.selector, fg: p.fg, bg, ratio: Math.floor(raw * 10) / 10, need, pass: raw >= need });
  }
  return out.sort((a, b) => Number(a.pass) - Number(b.pass) || a.ratio - b.ratio).slice(0, 8);
}

// Everything worth fixing that the page shows, in plain words.
function issuesFrom({ page, fonts, checks }) {
  const out = [];
  // One line per kind of text (the worst pair; the table lists them all).
  const told = new Set();
  for (const c of checks.filter((x) => !x.pass)) {
    if (told.has(c.use)) continue;
    told.add(c.use);
    out.push({ key: `contrast:${c.use}`, text: `${c.use}: ${c.fg.toUpperCase()} on ${c.bg.toUpperCase()} is ${c.ratio}:1. Text needs ${c.need}:1 to be easy to read.` });
  }
  if (fonts.all.length >= 3) out.push({ key: 'fonts', text: `${fonts.all.length} fonts on one page (${text.list(fonts.all.slice(0, 4))}). One family in two weights reads cleaner.` });
  const script = fonts.all.find((x) => SCRIPT_FONTS.test(x));
  if (script) out.push({ key: 'script', text: `${script} is a decorative font: fine in a logo, hard to read in headings and buttons.` });
  if (page.favicon === false) out.push({ key: 'favicon', text: 'No favicon, so the browser tab shows a blank icon.' });
  if (!page.description) out.push({ key: 'description', text: 'No page description, so Google picks any text from the page to show under your name.' });
  if (page.title && (page.title.length > 65 || HYPE.test(page.title))) out.push({ key: 'title', text: `Your page title is ${page.title.length} characters${HYPE.test(page.title) ? ` and says "${page.title.match(HYPE)[0]}"` : ''}. Long titles get cut off in search results; lead with your name, what you do and where.` });
  if (page.h1 && (/!\s*$/.test(page.h1) || /^(?:[A-Z][a-z']*\s+){3,}[A-Z]/.test(page.h1))) out.push({ key: 'h1', text: `Your main line, "${page.h1}", ${/!\s*$/.test(page.h1) ? 'ends in "!"' : ''}${/!\s*$/.test(page.h1) && /^(?:[A-Z][a-z']*\s+){3,}[A-Z]/.test(page.h1) ? ' and ' : ''}${/^(?:[A-Z][a-z']*\s+){3,}[A-Z]/.test(page.h1) ? 'capitalizes every word' : ''}. A plain sentence that says what you do reads calmer.` });
  if (!page.h1) out.push({ key: 'noh1', text: 'No main headline on the page, so visitors and Google have to guess what you do.' });
  if (page.mobileReady === false) out.push({ key: 'mobile', text: 'No mobile viewport tag, so phones may show the page shrunk.' });
  return out;
}

// What the business sells, read from its own page when nobody told us ("Car Detailing Austin TX" ->
// "car detailing"). Empty when the page doesn't say clearly.
function whatFromPage(page) {
  const hay = [page.title, page.h1, page.description, ...(page.headings || []).slice(0, 6)].filter(Boolean).join(' ').toLowerCase();
  const n = nicheFor(hay);
  return n.id === 'generic' ? '' : n.label;
}

// "blue", "orange", "gray": the plain word for a color in a sentence.
function hueWord(hex) {
  const rgb = color.hexToRgb(hex);
  if (!rgb) return 'color';
  const [h, s, l] = color.rgbToHsl(rgb);
  if (s < 0.15) return l < 0.2 ? 'black' : l > 0.9 ? 'white' : 'gray';
  if (l < 0.45 && h >= 15 && h < 50 && s < 0.6) return 'brown';
  const words = [[15, 'red'], [45, 'orange'], [70, 'yellow'], [165, 'green'], [195, 'teal'], [255, 'blue'], [290, 'purple'], [340, 'pink'], [361, 'red']];
  return (words.find(([max]) => h < max) || words[0])[1];
}

// Three ways forward. cur: what the page uses; spec: the business (brand kit spec).
function optionsFor(cur, spec, { seed } = {}) {
  const named = hueWord;
  const fresh = P.threePalettes(seed || spec.mood, { mood: spec.mood });
  const list = [];
  if (cur.primary) {
    const main = P.strongPrimary(cur.primary);
    const accents = P.accentsFor(main, spec.mood);
    const keepAccent = cur.accent || accents[0];
    list.push({ id: 'fixed', label: 'Your colors, fixed', why: `Keeps the look people know. ${main === cur.primary ? `Your ${named(cur.primary)} stays as it is` : `Your ${named(cur.primary)} gets just dark enough for white text`}, and every text pair passes.`, colors: P.buildPalette(main, keepAccent) });
    const other = accents.find((a) => !cur.accent || hueGap(a, cur.accent) >= 40) || accents[1];
    list.push({ id: 'new-accent', label: `Your ${named(cur.primary)}, a new accent`, why: `Same main color, with an accent picked to sit well next to it${cur.accent ? ` instead of ${named(cur.accent)}` : ''}.`, colors: P.buildPalette(main, other) });
    const f = fresh.find((p) => hueGap(p.colors.primary, cur.primary) >= 40) || fresh[0];
    list.push({ id: 'fresh', label: 'A fresh start', why: `New colors for ${spec.descriptor && spec.known !== false ? spec.descriptor.toLowerCase() : 'your kind of business'}. Bigger change: update everything at once.`, colors: f.colors });
  } else {
    fresh.forEach((p, i) => list.push({ id: `fresh-${i + 1}`, label: `Fresh start ${i + 1}`, why: 'We could not find brand colors in the page\'s code (your site builder may set them), so here are three to start from.', colors: p.colors }));
  }
  return list.map((o, i) => {
    const checks = P.checks(o.colors);
    return { ...o, n: i + 1, name: `${P.colorName(o.colors.primary)} and ${P.colorName(o.colors.accent)}`, checks, pass: checks.every((c) => c.pass), css: P.cssVars(o.colors) };
  });
}

// Niches that sell things rather than a service ("from Austin" reads better than "done right").
const PRODUCT = new Set(['candles', 'coffee', 'bakery', 'food', 'templates', 'resale', 'apparel', 'jewelry', 'plants', 'art']);

// Short lines from the business's own facts. The site's own line comes first when it already works.
function taglines(spec, page) {
  const n = spec.niche;
  const city = String(spec.city || '').split(',')[0].trim();
  const label = lower(spec.descriptor || n.label);
  const out = [];
  const h1 = text.oneLine(page && page.h1);
  if (h1 && h1.length <= 60 && !HYPE.test(h1) && !/!/.test(h1)) out.push({ text: cap(h1), from: 'Your current line' });
  out.push({ text: `${cap(n.result)}.`, from: 'What customers come for' });
  if (city && spec.known !== false) out.push({ text: PRODUCT.has(n.id) ? `${cap(label)} from ${city}.` : `${cap(label)} in ${city}, done right.`, from: 'What and where' });
  // "No more ..." reads well for a plain noun phrase; pains like "no time to ..." or "a website that ..." don't fit it.
  if (n.pain && !/^(no|not|hard|a|an|the)\s/i.test(n.pain)) out.push({ text: `No more ${n.pain}.`, from: 'The problem you take away' });
  // "Mobile" in what they sell or in their own name (not a mobile phone or app business).
  const goes = `${spec.what || ''} ${spec.name || ''}`;
  if (spec.known !== false && /\b(mobile|comes? to you|on[- ]site|in[- ]home|house calls?)\b/i.test(goes) && !/mobile (phone|app|device)/i.test(goes) && !PRODUCT.has(n.id)) out.push({ text: `${cap(label)} that comes to you.`, from: 'How you work' });
  if (n.promise && n.promise.length <= 68 && !lower(n.promise).startsWith(lower(n.result))) out.push({ text: `${cap(n.promise)}.`, from: 'What you promise' });
  if (spec.offer) out.push({ text: `${cap(text.clip(spec.offer, 56)).replace(/\.+$/, '')}.`, from: 'Your offer' });
  const seen = new Set();
  return out.filter((t) => t.text.length <= 70 && !HYPE.test(t.text) && text.copyProblems(t.text).length === 0 && !seen.has(lower(t.text)) && seen.add(lower(t.text))).slice(0, 5);
}

// Where to update, in order: free and fast first, printed things last.
function updateList({ issues, chosen, page, platform }) {
  const has = (k) => issues.some((i) => i.key === k || i.key.startsWith(`${k}:`));
  const c = chosen.colors;
  const list = [
    { where: 'Website colors', what: `${platform ? `Your site runs on ${platform}. ` : ''}In your site builder's theme or style settings, set Main ${c.primary.toUpperCase()}, Accent ${c.accent.toUpperCase()}, Text ${c.ink.toUpperCase()} and Page ${c.paper.toUpperCase()}. The CSS variables are in the zip.`, cost: 'Free, 15 minutes' },
    { where: 'Website fonts', what: 'Set headings to Inter Bold and text to Inter Regular (free from Google Fonts). One family, two weights.', cost: 'Free, 5 minutes' },
  ];
  if (has('contrast')) list.push({ where: 'Buttons and small text', what: `Use ${c.onPrimary.toUpperCase()} text on ${c.primary.toUpperCase()} buttons, and ${c.muted.toUpperCase()} or darker for small print. Every pair in the new colors passes.`, cost: 'Free, 10 minutes' });
  if (has('title') || has('description') || has('h1') || has('noh1')) list.push({ where: 'Page title and main line', what: 'Title: your name, what you do and where. Main line: one of the taglines on this page. Description: one sentence with your offer and area.', cost: 'Free, 10 minutes' });
  if (has('favicon')) list.push({ where: 'Favicon', what: 'Upload the square mark from the zip as your site icon.', cost: 'Free, 5 minutes' });
  list.push(
    { where: 'Google Business Profile', what: 'Update the logo and the cover photo so search and Maps match the site.', cost: 'Free, 5 minutes' },
    { where: 'Social profiles', what: 'Profile picture, highlight covers and bio links on Instagram, TikTok and Facebook. "Set up your social profiles" makes them in the new colors.', cost: 'Free, 10 minutes' },
    { where: 'Email signature, quotes and invoices', what: 'Swap the logo and the main color in your email signature and in your quote and invoice templates.', cost: 'Free, 10 minutes' },
    { where: 'Printed things', what: 'Use up the cards, flyers and magnets you have. Reprint in the new colors only when you reorder.', cost: 'When you reorder' }
  );
  return list.map((x, i) => ({ n: i + 1, ...x }));
}

// ---------- before and after board (1080 x 1350) ----------

function swatchRow(x, y, w, h, items, ink) {
  let out = '';
  const gap = 12;
  const cw = (w - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => {
    const cx = x + i * (cw + gap);
    out += svg.rect({ x: cx, y, w: cw, h, r: 16, fill: it.hex });
    out += svg.rect({ x: cx + 0.5, y: y + 0.5, w: cw - 1, h: h - 1, r: 16, fill: 'none', stroke: '#000000', strokeWidth: 1, opacity: 0.12 });
    const on = color.readableOn(it.hex, '#15161a', '#ffffff');
    out += svg.text({ x: cx + 14, y: y + 30, lines: [it.label], size: 18, weight: 700, fill: on });
    out += svg.text({ x: cx + 14, y: y + h - 16, lines: [it.hex.toUpperCase()], size: 16, weight: 600, fill: on });
  });
  return out;
}

// line: the site's main line now; newLine: the tagline to try. Both optional.
function boardSvg({ spec, cur, fonts, beforeChecks, chosen, line, newLine }) {
  const W = 1080;
  const H = 1350;
  const M = 64;
  const ink = '#15161a';
  const muted = '#5d6069';
  const c = chosen.colors;
  let b = '';
  b += svg.text({ x: M, y: 92, lines: ['BRAND REFRESH'], size: 22, weight: 700, fill: muted, letterSpacing: 4 });
  const t = svg.fit(spec.name || 'Your brand', { width: W - M * 2, maxSize: 60, minSize: 34, maxLines: 1, weight: 800 });
  b += svg.text({ x: M, y: 152, lines: t.lines, size: t.size, weight: 800, fill: ink, font: svg.FONTS.display });

  // Before: what the page uses now.
  const by = 196;
  const bh = 500;
  const quote = (label, t) => text.clip(`${label}: \u201c${text.oneLine(t).replace(/[.]+$/, '')}\u201d`, 62);
  b += svg.rect({ x: M, y: by, w: W - M * 2, h: bh, r: 28, fill: '#f3f3f5' });
  b += svg.text({ x: M + 32, y: by + 52, lines: ['Before'], size: 30, weight: 800, fill: ink });
  b += svg.text({ x: W - M - 32, y: by + 52, lines: ['Read from your website'], size: 18, weight: 600, fill: muted, anchor: 'end' });
  const now = [cur.primary && { label: 'Main', hex: cur.primary }, cur.accent && { label: 'Accent', hex: cur.accent }, cur.ink && { label: 'Text', hex: cur.ink }, { label: 'Page', hex: cur.paper }].filter(Boolean);
  b += swatchRow(M + 32, by + 80, W - M * 2 - 64, 150, now, ink);
  const fontLine = fonts.all.length ? `Fonts: ${text.list(fonts.all.slice(0, 3))}` : 'Fonts: set by your site builder';
  b += svg.text({ x: M + 32, y: by + 280, lines: [text.clip(fontLine, 60)], size: 24, weight: 600, fill: ink });
  if (line) b += svg.text({ x: M + 32, y: by + 324, lines: [quote('Main line', line)], size: 22, weight: 500, fill: ink });
  const fails = beforeChecks.filter((x) => !x.pass);
  const worst = fails[0];
  if (worst) {
    const top = line ? by + 356 : by + 320;
    const pill = svg.pill({ x: M + 32, y: top, label: worst.use === 'Buttons' ? 'Book now' : worst.use, size: 24, weight: 700, fill: worst.bg, color: worst.fg, padX: 1, padY: 0.55 });
    b += pill.svg;
    b += svg.text({ x: M + 32 + pill.width + 20, y: top + 36, lines: [`${worst.ratio}:1, hard to read (needs ${worst.need}:1)`], size: 22, weight: 600, fill: '#9a3b00' });
  }
  const summary = fails.length ? `${text.plural(fails.length, 'color pair')} hard to read` : 'Text pairs pass';
  b += svg.text({ x: M + 32, y: by + bh - 36, lines: [summary], size: 22, weight: 600, fill: muted });

  // After: the chosen colors, the logo in them, a button that passes.
  const ay = by + bh + 28;
  const ah = H - ay - M;
  b += svg.rect({ x: M, y: ay, w: W - M * 2, h: ah, r: 28, fill: c.paper });
  b += svg.rect({ x: M + 0.5, y: ay + 0.5, w: W - M * 2 - 1, h: ah - 1, r: 28, fill: 'none', stroke: '#000000', strokeWidth: 1, opacity: 0.1 });
  b += svg.text({ x: M + 32, y: ay + 52, lines: ['After'], size: 30, weight: 800, fill: c.ink });
  b += svg.text({ x: W - M - 32, y: ay + 52, lines: [text.clip(chosen.label, 40)], size: 18, weight: 600, fill: c.muted, anchor: 'end' });
  const d = L.draw('wordmark', { ...spec, colors: c }, 'color');
  const boxW = W - M * 2 - 64;
  const boxH = 120;
  const k = Math.min(boxW / d.logo.w, boxH / d.logo.h);
  b += svg.group(d.logo.body, { transform: `translate(${M + 32} ${ay + 80}) scale(${Math.round(k * 10000) / 10000})` });
  const items = [{ label: 'Main', hex: c.primary }, { label: 'Accent', hex: c.accent }, { label: 'Text', hex: c.ink }, { label: 'Soft', hex: c.surface }, { label: 'Page', hex: c.paper }];
  b += swatchRow(M + 32, ay + 80 + boxH + 28, W - M * 2 - 64, 110, items, c.ink);
  const py = ay + 80 + boxH + 28 + 110 + 36;
  const btn = svg.pill({ x: M + 32, y: py, label: 'Book now', size: 24, weight: 700, fill: c.primary, color: c.onPrimary, padX: 1, padY: 0.55 });
  b += btn.svg;
  const ratio = Math.round(contrast(c.onPrimary, c.primary) * 10) / 10;
  b += svg.text({ x: M + 32 + btn.width + 20, y: py + 36, lines: [`${ratio}:1, easy to read`], size: 22, weight: 600, fill: '#1d7a46' });
  if (newLine) b += svg.text({ x: M + 32, y: py + 106, lines: [quote('Main line', newLine)], size: 22, weight: 500, fill: c.ink });
  b += svg.text({ x: M + 32, y: ay + ah - 36, lines: ['Fonts: Inter Bold and Inter Regular'], size: 22, weight: 600, fill: c.muted });
  return svg.doc({ width: W, height: H, background: '#ffffff', body: b, title: `${spec.name || 'Brand'} refresh` });
}

module.exports = { whatFromPage, hueWord, inlineCss, stylesheetLinks, rulesOf, hexOf, fontsFrom, colorsFrom, checksFrom, issuesFrom, optionsFor, taglines, updateList, boardSvg, plainSelector, HYPE, SCRIPT_FONTS };
