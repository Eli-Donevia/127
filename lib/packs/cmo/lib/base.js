// The kpi pack's readers, ledger, metrics and page, plus what every cmo tool repeats: the business
// name, the sample banner, and the "read from" and "advice only" lines at the foot of each page.

const C = require('../../kpi/lib/common');
const R = require('../../kpi/lib/report');
const M = require('../../kpi/lib/metrics');
const T = require('../../kpi/lib/table');
const L = require('../../kpi/lib/ledger');
const P = require('../../kpi/lib/page');
const X = require('./mkt');

const ADVICE = 'Advice and drafts only: 127 never posts, sends, or changes an ad or a budget. You make each change yourself.';

const nameOf = (ctx, d) => (d.sample ? C.SAMPLE_NAME : (ctx.brain && ctx.brain.business && ctx.brain.business.name) || 'Your business');

function wrap(d, body, notes = []) {
  return `${d.sample ? `<section><div class="card"><p class="big">${P.esc(C.sampleLine)}</p></div></section>` : ''}
${body}
${notes.length ? `<section><h2>Notes</h2><div class="card">${P.list(notes)}</div></section>` : ''}
<section><div class="card small muted"><p>${P.esc(C.sourcesLine(d))} ${P.esc(C.privacyLine)} ${P.esc(ADVICE)}</p></div></section>`;
}

// A brain snapshot for an AI prompt: what the business is, never people or contact details.
function businessLine(ctx, d) {
  if (d.sample) return 'Juniper Lane Candles: small-batch soy candles, sold online, at Saturday markets and in candle making classes, in Madison, WI. Voice: warm and plain.';
  const b = (ctx.brain && ctx.brain.business) || {};
  const v = (ctx.brain && ctx.brain.voice) || {};
  const bits = [b.name, b.what || b.offer || b.niche, b.audience ? `for ${b.audience}` : '', b.city ? `in ${b.city}${b.region ? `, ${b.region}` : ''}` : ''].filter(Boolean);
  return `${bits.join(', ') || 'A small business'}.${v.tone ? ` Voice: ${v.tone}.` : ''}`.slice(0, 400);
}

module.exports = { C, R, M, T, L, P, X, ADVICE, nameOf, wrap, businessLine };
