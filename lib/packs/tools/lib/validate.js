// The safety check every app passes before a member gets it, whoever wrote it (our starters, the
// AI, or a file the member brings): one self-contained HTML file that makes no outside requests,
// sends nothing, runs no code built from strings, and stays under a size cap. Then harden() adds
// the content security policy that blocks outside requests in the browser too.
//
// validate(html, { maxBytes }) -> { ok, problems: [{ code, text }], bytes, scripts }
// Parsing is by pattern, not a full HTML parser, so it errs toward refusing.

const vm = require('vm');
const { CSP_META } = require('./shell');

const MAX_BYTES = 300 * 1024;

// [code, what the member reads, pattern on the whole file]
const HTML_RULES = [
  ['outside-script', 'loads a script from somewhere else', /<script\b[^>]*\bsrc\s*=/i],
  ['outside-style', 'loads a style sheet or file from somewhere else', /<link\b[^>]*\bhref\s*=\s*["']?\s*(?:https?:|\/\/|[a-z0-9.-]+\.[a-z]{2,}\/)/i],
  ['link-tag', 'loads a linked file (style sheet, font or preload)', /<link\b[^>]*\brel\s*=\s*["']?[^"'>]*(?:stylesheet|preload|prefetch|preconnect|dns-prefetch|modulepreload|import|manifest)/i],
  ['outside-resource', 'loads an image, video or file from the internet', /\b(?:src|srcset|poster|data|background|action|formaction|xlink:href|ping)\s*=\s*["']?\s*(?:https?:|\/\/)/i],
  ['css-import', 'pulls in outside styles or fonts', /@import\b|url\(\s*["']?\s*(?:https?:|\/\/)/i],
  ['frame', 'embeds another page (iframe, object or embed)', /<(?:iframe|frame|frameset|object|embed|applet|portal)\b/i],
  ['base-tag', 'changes where links point (base tag)', /<base\b/i],
  ['refresh', 'redirects the page on its own', /<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i],
  ['form-post', 'has a form that sends answers to a server', /<form\b[^>]*\b(?:action\s*=\s*["']?\s*(?!["'#\s>])[^"'\s>]|method\s*=\s*["']?post)/i],
  ['form-action', 'has a button that sends a form somewhere', /\bformaction\s*=/i],
  ['js-url', 'runs code from a link (javascript: URL)', /(?:href|src|action)\s*=\s*["']?\s*javascript:/i],
  ['module-script', 'uses a script module that can pull in other files', /<script\b[^>]*type\s*=\s*["']?module/i],
];

// [code, what the member reads, pattern inside running scripts and on* attributes]
const JS_RULES = [
  ['fetch', 'sends or loads data over the internet (fetch)', /\bfetch\s*\(/],
  ['xhr', 'sends or loads data over the internet (XMLHttpRequest)', /\bXMLHttpRequest\b|\bActiveXObject\b/],
  ['socket', 'opens a live connection (WebSocket or EventSource)', /\bWebSocket\b|\bEventSource\b|\bRTCPeerConnection\b|\bWebTransport\b/],
  ['beacon', 'sends data in the background (sendBeacon)', /\bsendBeacon\b/],
  ['worker', 'starts background code (worker)', /\b(?:Shared)?Worker\s*\(|\bserviceWorker\b|\bimportScripts\b/],
  ['dynamic-import', 'loads code from elsewhere (import)', /\bimport\s*\(|^\s*import\s+[\w{*]/m],
  ['eval', 'runs code built from text (eval)', /\beval\s*\(/],
  ['function-ctor', 'runs code built from text (new Function)', /\bnew\s+Function\b|\bFunction\s*\(\s*["'`]/],
  ['string-timer', 'runs code built from text (a timer with a string)', /\bset(?:Timeout|Interval)\s*\(\s*["'`]/],
  ['doc-write', 'rewrites the page with document.write', /\bdocument\s*\.\s*write(?:ln)?\s*\(/],
  ['cookie', 'reads or sets cookies', /\bdocument\s*\.\s*cookie\b/],
  ['redirect', 'sends the visitor to another address on its own', /\blocation\s*(?:\.\s*href\s*)?=(?!=)|\blocation\s*\.\s*(?:assign|replace)\s*\(|\bwindow\s*\.\s*open\s*\(/],
  ['outside-url', 'has an internet address inside its code', /\b(?:https?|wss?|ftp):\/\//i],
  ['image-ping', 'loads an image from code (a common way to send data out)', /\bnew\s+Image\s*\(/],
  ['parent-window', 'talks to other windows', /\b(?:window\s*\.\s*)?(?:opener|parent|top)\s*\.\s*(?:postMessage|location|document)\b/],
];

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const isData = (attrs) => /\btype\s*=\s*["']?(?:application\/(?:ld\+)?json|text\/template|text\/plain)/i.test(attrs);

function scriptsOf(html) {
  const out = [];
  let m;
  SCRIPT_RE.lastIndex = 0;
  while ((m = SCRIPT_RE.exec(html))) out.push({ attrs: m[1] || '', code: m[2] || '', data: isData(m[1] || '') });
  return out;
}

// Inline event handlers (onclick="...") run code too.
function handlersOf(html) {
  const out = [];
  const re = /\son[a-z]+\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(html))) out.push((m[2] != null ? m[2] : m[3]).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
  return out;
}

function validate(html, { maxBytes = MAX_BYTES } = {}) {
  const problems = [];
  const add = (code, t) => {
    if (!problems.some((p) => p.code === code)) problems.push({ code, text: t });
  };
  const src = String(html || '');
  const bytes = Buffer.byteLength(src, 'utf8');
  if (!src.trim()) return { ok: false, problems: [{ code: 'empty', text: 'The file is empty.' }], bytes, scripts: 0 };
  if (bytes > maxBytes) add('too-big', `is ${Math.round(bytes / 1024)} KB, over the ${Math.round(maxBytes / 1024)} KB limit`);
  if (!/<html[\s>]/i.test(src) || !/<\/html\s*>/i.test(src)) add('not-html', "isn't a complete HTML page");
  if (/<script\b/i.test(src) && (src.match(/<script\b/gi) || []).length !== (src.match(/<\/script\s*>/gi) || []).length) add('broken-script', 'has a script tag that is never closed');
  // Check HTML rules on the markup with script bodies taken out (so code strings don't count twice).
  const scripts = scriptsOf(src);
  const markup = src.replace(SCRIPT_RE, (m, attrs) => `<script${attrs}></script>`);
  for (const [code, t, re] of HTML_RULES) if (re.test(markup)) add(code, t);
  const running = scripts.filter((s) => !s.data).map((s) => s.code);
  const code = [...running, ...handlersOf(markup)];
  for (const c of code) for (const [k, t, re] of JS_RULES) if (re.test(c)) add(k, t);
  // Every script must at least compile. We compile it and never run it.
  running.forEach((c, i) => {
    try {
      new vm.Script(c, { filename: `script-${i + 1}.js` });
    } catch (e) {
      add('syntax', `has a script with a mistake in it (${String(e.message).slice(0, 80)})`);
    }
  });
  // Data scripts must be valid JSON (our apps read their settings from one).
  for (const s of scripts.filter((x) => x.data && /json/i.test(x.attrs))) {
    try {
      JSON.parse(s.code);
    } catch {
      add('bad-json', 'has settings that are not valid JSON');
    }
  }
  return { ok: problems.length === 0, problems, bytes, scripts: running.length };
}

// Our policy in every app: drop any policy the file brought, add ours first thing in <head>.
// Also swaps long dashes for plain ones in what people read.
function harden(html) {
  let out = String(html).replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy[^>]*>\s*/gi, '');
  if (/<head[^>]*>/i.test(out)) out = out.replace(/<head([^>]*)>/i, (m) => `${m}\n${CSP_META}`);
  else out = out.replace(/<html([^>]*)>/i, (m) => `${m}\n<head>\n${CSP_META}\n</head>`);
  return out.replace(/[\u2014\u2013]/g, '-');
}

const summary = (r) => (r.ok ? 'Passed every safety check.' : `Didn't pass: it ${r.problems.map((p) => p.text).join('; ')}.`);

module.exports = { validate, harden, summary, scriptsOf, MAX_BYTES, HTML_RULES, JS_RULES };
