// Wraps a design's body and CSS in a complete, standalone HTML document: search and sharing tags,
// fonts, one inline stylesheet (no extra request) and JSON-LD. No scripts run on the page.

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

// opts: { c, t (tokens), fonts, design: { css, body, bodyClass, base }, files: { hasPng, hasIco, hasTouch }, noindex, title,
// jsonld: true (left out when noindex) or 'always' (a prospect's sample keeps it to show their business details) }
function pageDoc({ c, t, fonts, design, assets = {}, noindex = false, title, jsonld = true }) {
  const css = [theme.cssVars(t), baseCss(fonts, design.base || {}), design.css].map(tidyCss).join('\n');
  const head = [
    seo.headTags(c, { ...assets, themeColor: t.primary, noindex }),
    fonts.head,
    `<style>\n${css}\n</style>`,
    jsonld === 'always' || (jsonld && !noindex) ? seo.jsonLdTags(seo.jsonLd(c, assets)) : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title || c.seo.title)}</title>
${head}
</head>
<body id="top"${design.bodyClass ? ` class="${esc(design.bodyClass)}"` : ''}>
<a class="skip" href="#main">Skip to content</a>
${design.body}
</body>
</html>
`;
}

// thanks.html (where the form lands) and 404.html, in the same colors and type.
function simplePage({ c, t, fonts, title, heading, body, cta }) {
  const css = `
.simple{min-height:100vh;display:grid;place-items:center;padding:3rem 1rem;background:radial-gradient(60rem 40rem at 80% -10%,var(--primary-soft),transparent 60%),var(--bg)}
.simple-card{width:min(36rem,100%);display:grid;gap:1.1rem;justify-items:start}
.simple .mark{display:inline-grid;place-items:center;width:3rem;height:3rem;border-radius:.9rem;background:var(--primary);color:var(--on-primary);font-family:var(--font-display);font-weight:800}
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

module.exports = { pageDoc, simplePage, tidyCss };
