// Small pieces of markup and CSS more than one design uses. Each design still sets its own look.

const { files } = require('../../../_kit');

const esc = files.esc;

// Real facts for the hero's tick row: never more than the member told us.
function heroFacts(c, max = 3) {
  const out = [];
  if (c.mobile && c.template === 'local-service') out.push('We come to you');
  const priced = c.services.filter((s) => typeof s.price === 'number');
  if (priced.length) {
    const min = priced.reduce((a, b) => (b.price < a.price ? b : a));
    out.push(`Prices from ${min.priceText.replace(/^From /, '')}`);
  }
  if (c.hoursLine) out.push(c.hoursLine);
  if (c.booking) out.push('Book online');
  else if (c.area && !c.mobile && !c.online) out.push(`Serving ${c.area}`);
  return out.slice(0, max);
}

function cheapest(c) {
  const priced = c.services.filter((s) => typeof s.price === 'number');
  if (!priced.length) return null;
  return priced.reduce((a, b) => (b.price < a.price ? b : a));
}

// Section heading block.
function head({ eyebrow, title, lead, id, cls = '' }) {
  return `<div class="sec-head ${cls}">
${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
<h2 class="h2"${id ? ` id="${id}"` : ''}>${esc(title)}</h2>
${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
</div>`;
}

const FOOTER_CSS = `
.ftr{padding-block:3.5rem 2rem;border-top:1px solid var(--line)}
.ftr-in{display:grid;gap:2.25rem}
@media (min-width:56rem){.ftr-in{grid-template-columns:1.4fr 1fr 1.3fr}}
.ftr-name{font-family:var(--font-display);font-weight:700;font-size:1.35rem;letter-spacing:-.01em}
.ftr-line{margin-top:.4rem;color:var(--muted)}
.ftr-social{margin-top:1.25rem}
.ftr-links{display:grid;gap:.55rem}
.ftr-links a{text-decoration:none;color:var(--muted)}
.ftr-links a:hover{color:var(--ink);text-decoration:underline}
.ftr-base{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem 1.5rem;margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--line);font-size:.875rem;color:var(--muted)}
`;

const HEAD_CSS = `
.sec-head{display:grid;gap:.9rem;max-width:46rem;margin-bottom:clamp(2rem,1.4rem + 2.2vw,3.5rem)}
.sec-head.center{margin-inline:auto;text-align:center;justify-items:center}
`;

const REVIEWS_CSS = `
.reviews{display:grid;gap:1rem}
@media (min-width:48rem){.reviews{grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))}}
.review{display:grid;gap:1rem;align-content:start;padding:1.75rem;border-radius:var(--radius);background:var(--surface);border:1px solid var(--line)}
.review blockquote{margin:0;font-size:1.125rem;line-height:1.55}
.review figcaption{font-weight:600;color:var(--muted)}
`;

module.exports = { heroFacts, cheapest, head, FOOTER_CSS, HEAD_CSS, REVIEWS_CSS, esc };
