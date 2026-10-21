// Wraps a design's body and CSS in a complete, standalone HTML document: search and sharing tags,
// fonts, one inline stylesheet (no extra request) and JSON-LD. No scripts run on the page, except an animated design's
// own small script (design.script, lib/motion.js), inline at the end of the body; a one-line one in the head marks the
// page for motion before it paints, so nothing shows and then hides.

const { files } = require('../../_kit');
const seo = require('./seo');
const theme = require('./theme');
const { baseCss } = require('./base-css');

const esc = files.esc;

function tidyCss(css) {
  return String(css)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// opts: { c, t (tokens), fonts, design: { css, body, bodyClass, base, head (extra head tags: a choreo design's deferred bundle) }, files: { hasPng, hasIco, hasTouch }, noindex, title,
// jsonld: true (left out when noindex) or 'always' (a prospect's sample keeps it to show their business details) }
// A two-mode design (c.modes): its own mode's tokens on :root, the other's under html[data-theme=<other>]. The head
// script picks the start before paint: the visitor's saved choice, else the phone's setting when the member chose auto.
const MODE_HEAD = "<script>(function(d){var m;try{m=localStorage.getItem('site-mode')}catch(e){}if(m!=='light'&&m!=='dark'&&d.hasAttribute('data-auto'))m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(m==='light'||m==='dark')d.setAttribute('data-theme',m)})(document.documentElement)</script>";
const MODE_SCRIPT = "(function(){var d=document.documentElement,bs=document.querySelectorAll('.mode-tg');function sync(){var l=d.getAttribute('data-theme')==='light';bs.forEach(function(b){b.setAttribute('aria-pressed',String(!l));b.setAttribute('aria-label',l?'Switch to dark mode':'Switch to light mode')})}bs.forEach(function(b){b.hidden=false;b.addEventListener('click',function(){var n=d.getAttribute('data-theme')==='light'?'dark':'light';d.setAttribute('data-theme',n);try{localStorage.setItem('site-mode',n)}catch(e){}sync()})});sync()})();";

function pageDoc({ c, t, t2, fonts, design, assets = {}, noindex = false, title, jsonld = true }) {
  const m = c.modes && t2 ? c.modes : null;
  const css = [fonts.face || '', theme.cssVars(t), m ? theme.cssVars(t2, {}, `html[data-theme="${m.other}"]`) : '', m ? `html{color-scheme:${m.native === 'dark' ? 'dark' : 'light'}}html[data-theme="${m.other}"]{color-scheme:${m.other === 'dark' ? 'dark' : 'light'}}` : '', baseCss(fonts, design.base || {}), design.css].filter(Boolean).map(tidyCss).join('\n');
  const head = [
    m ? MODE_HEAD : '',
    seo.headTags(c, { ...assets, themeColor: t.primary, noindex }),
    fonts.head,
    `<style>\n${css}\n</style>`,
    design.script ? `<script>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.add('m')</script>` : '',
    design.head || '',
    jsonld === 'always' || (jsonld && !noindex) ? seo.jsonLdTags(seo.jsonLd(c, assets)) : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `<!doctype html>
<html lang="en"${m ? ` data-theme="${m.start}"${m.auto ? ' data-auto' : ''}` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title || c.seo.title)}</title>
${head}
</head>
<body id="top"${design.bodyClass ? ` class="${esc(design.bodyClass)}"` : ''}>
<a class="skip" href="#main">Skip to content</a>
${design.body}
${design.script ? `<script>\n${design.script}\n</script>\n` : ''}${m ? `<script>${MODE_SCRIPT}</script>\n` : ''}</body>
</html>
`;
}

// thanks.html (where the form lands) and 404.html, in the same colors and type.
function simplePage({ c, t, fonts, title, heading, body, cta }) {
  const css = `
.simple{min-height:100vh;display:grid;place-items:center;padding:3rem 1rem;background:radial-gradient(60rem 40rem at 80% -10%,var(--primary-soft),transparent 60%),var(--bg)}
.simple-card{width:min(36rem,100%);display:grid;gap:1.1rem;justify-items:start}
.simple .mark{display:inline-grid;place-items:center;width:3rem;height:3rem;border-radius:.9rem;background:var(--button);color:var(--on-button);font-family:var(--font-display);font-weight:800}
.simple h1{font-size:clamp(2.4rem,1.6rem + 3.5vw,4rem);letter-spacing:-.035em}
.simple p{font-size:1.15rem;color:var(--muted)}
`;
  const { monogram } = require('./parts');
  const html = `<main id="main" class="simple"><div class="simple-card">
<span class="mark" aria-hidden="true">${esc(monogram(c.name))}</span>
<h1>${esc(heading)}</h1>
<p>${esc(body)}</p>
<a class="btn btn-primary btn-lg" href="${esc(cta.href)}">${esc(cta.label)}</a>
</div></main>`;
  return pageDoc({ c, t, fonts, design: { css, body: html }, noindex: true, title, jsonld: false });
}

// A plain reading page (the privacy notice, shipping and returns) in the site's own colors and fonts.
function docPage({ c, t, fonts, title, heading, html }) {
  const css = `
.doc{padding:clamp(2.5rem,2rem + 3vw,5rem) max(1.25rem,env(safe-area-inset-left,0px)) 4rem;background:var(--bg)}
.doc-in{max-width:42rem;margin:0 auto;display:grid;gap:1rem}
.doc-back{font-size:.95rem;color:var(--muted)}
.doc h1{font-size:clamp(2.2rem,1.6rem + 2.6vw,3.4rem);letter-spacing:-.03em;line-height:1.05;margin:.25rem 0 .5rem}
.doc h2{font-size:1.3rem;margin-top:1.25rem}
.doc p,.doc li{color:var(--ink);line-height:1.7}
.doc ul{margin:0;padding-left:1.25rem;display:grid;gap:.35rem}
.doc a{color:var(--primary);text-underline-offset:2px}
.doc-date{color:var(--muted);font-size:.95rem}
`;
  const body = `<main id="main" class="doc"><div class="doc-in">
<a class="doc-back" href="./">&larr; ${esc(c.name)}</a>
<h1>${esc(heading)}</h1>
${html}
</div></main>`;
  return pageDoc({ c, t, fonts, design: { css, body }, title, jsonld: false });
}

module.exports = { pageDoc, simplePage, docPage, tidyCss };
