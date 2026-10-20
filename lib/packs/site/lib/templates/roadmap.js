// The roadmap: a process or product story drawn from the member's own facts (their steps, services, menu groups or
// what's included) as nodes joined by a line, ending at the page's own button ("show the finished thing"). In the
// spirit of the Builder map (lib/builder-map.js): a diagram from real data whose line and nodes draw in, in sequence,
// as you scroll (the choreo runtime's data-rm hook, lib/choreo.md; backwards when scrolling up). JavaScript off and
// reduced motion: the whole diagram is drawn, still. Desktop runs it left to right on a gentle wave; phones run it down
// a rail. Nothing is invented: a node is only ever a fact the design passes in.

const { files } = require('../../../_kit');

const esc = files.esc;
const MAX = 6;

// The wave through the node centers (viewBox 0 0 1000 100, the dots on y = 50), one arc per gap, alternating.
function wave(n) {
  const x = (i) => ((i + 0.5) / n) * 1000;
  let d = `M${x(0).toFixed(1)} 50`;
  for (let i = 1; i < n; i++) {
    const mid = (x(i - 1) + x(i)) / 2;
    d += ` Q${mid.toFixed(1)} ${i % 2 ? 8 : 92} ${x(i).toFixed(1)} 50`;
  }
  return d;
}

// nodes: [{ title, sub?, meta? }] (2 or more, the first MAX kept); end: the button's HTML (optional), endLabel: a short
// real label over it (e.g. the business name). Returns '' when there is not enough to draw.
function roadmap({ id = 'roadmap', eyebrow = '', title = '', lead = '', nodes = [], end = '', endLabel = '', cls = '' } = {}) {
  const list = nodes.filter((n) => n && n.title).slice(0, MAX);
  if (list.length < 2) return '';
  const total = list.length + (end ? 1 : 0);
  const items = list
    .map((n, i) => `<li class="rm-node"><span class="rm-dot" aria-hidden="true"><b>${String(i + 1).padStart(2, '0')}</b></span><div class="rm-txt"><h3>${esc(n.title)}</h3>${n.meta ? `<p class="rm-meta">${esc(n.meta)}</p>` : ''}${n.sub ? `<p class="rm-sub">${esc(n.sub)}</p>` : ''}</div></li>`)
    .join('\n');
  const last = end ? `<li class="rm-node rm-end"><span class="rm-dot" aria-hidden="true"></span><div class="rm-txt">${endLabel ? `<p class="rm-meta">${esc(endLabel)}</p>` : ''}${end}</div></li>` : '';
  return `<section class="sec rm-sec ${cls}" id="${esc(id)}" aria-labelledby="${esc(id)}-title" data-rm>
<div class="wrap">
<div class="rm-head">${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h2 class="h2" id="${esc(id)}-title">${esc(title)}</h2>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</div>
<div class="rm" style="--n:${total}">
<svg class="rm-wave" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path class="rm-base" d="${wave(total)}" vector-effect="non-scaling-stroke"/><path class="rm-line" d="${wave(total)}" pathLength="1" vector-effect="non-scaling-stroke"/></svg>
<ol class="rm-nodes">
${items}
${last}
</ol>
</div>
</div>
</section>`;
}

// Light by default; a design sets its own colors through these variables (--rm-ink, --rm-muted, --rm-line,
// --rm-accent, --rm-dot-bg) on .rm-sec.
const ROADMAP_CSS = `
.rm-sec{--rm-ink:var(--ink);--rm-muted:var(--muted);--rm-line:var(--line);--rm-accent:var(--primary-text);--rm-dot-bg:var(--bg)}
.rm-head{display:grid;gap:.9rem;max-width:46rem;margin-bottom:clamp(2.5rem,1.8rem + 3vw,4.5rem)}
.rm{position:relative}
.rm-nodes{position:relative;display:grid;gap:2rem;padding-left:3.5rem}
.rm-nodes::before,.rm-nodes::after{content:'';position:absolute;left:1.35rem;top:1.4rem;bottom:1.4rem;width:3px;background:var(--rm-line)}
.rm-nodes::after{background:var(--rm-accent);transform-origin:50% 0}
html.rm-go .rm-nodes::after{transform:scaleY(var(--p,0))}
.rm-wave{display:none}
.rm-node{position:relative;display:grid;gap:.35rem}
.rm-dot{position:absolute;left:-3.5rem;top:0;z-index:1;display:grid;place-items:center;width:2.8rem;height:2.8rem;border-radius:50%;border:2px solid var(--rm-accent);background:var(--rm-dot-bg);color:var(--rm-accent);font-size:.8rem;font-weight:700;font-variant-numeric:tabular-nums}
.rm-end .rm-dot{background:var(--rm-accent)}
.rm-txt{display:grid;gap:.35rem;justify-items:start}
.rm-txt h3{font-size:clamp(1.25rem,1.1rem + .5vw,1.55rem);line-height:1.15;color:var(--rm-ink)}
.rm-meta{font-weight:600;color:var(--rm-accent)}
.rm-sub{color:var(--rm-muted);max-width:22rem}
.rm-end .btn{margin-top:.25rem}
html.rm-go .rm-node .rm-dot{transform:scale(.4);opacity:0;transition:transform .7s cubic-bezier(.34,1.9,.64,1),opacity .3s ease,background-color .3s ease,color .3s ease}
html.rm-go .rm-node .rm-txt{transform:translateY(.8rem);transition:transform .6s cubic-bezier(.16,1,.3,1)}
html.rm-go .rm-node.on .rm-dot{transform:none;opacity:1}
html.rm-go .rm-node.on .rm-txt{transform:none}
html.rm-go .rm-node.cur .rm-dot{transform:scale(1.18);background:var(--rm-accent);color:var(--rm-dot-bg)}
html.rm-go .rm-node.cur .rm-txt h3{color:var(--rm-accent)}
.rm-comet{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2;opacity:0;transition:opacity .25s ease}
.rm-comet.lit{opacity:1}
.rm-comet i{position:absolute;left:-.5rem;top:-.5rem;width:1rem;height:1rem;border-radius:50%;background:var(--rm-accent)}
.rm-comet i+i{opacity:.55}.rm-comet i+i+i{opacity:.35}.rm-comet i:last-child{opacity:.2}
@media (min-width:48rem){
.rm-wave{display:block;position:absolute;left:0;right:0;top:0;width:100%;height:2.8rem;overflow:visible}
.rm-wave path{fill:none;stroke-width:2;stroke-linecap:round}.rm-wave .rm-line{stroke-width:3.5}
.rm-base{stroke:var(--rm-line)}
.rm-line{stroke:var(--rm-accent)}
html.rm-go .rm-line{stroke-dasharray:1;stroke-dashoffset:calc(1 - var(--p,0))}
.rm-nodes{grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:1.5rem;padding-left:0}
.rm-nodes::before,.rm-nodes::after{display:none}
.rm-node{justify-items:center;text-align:center;padding-top:4.2rem}
.rm-dot{left:50%;top:0;margin-left:-1.4rem}
.rm-txt{justify-items:center}
}
`;

// Nodes from a menu or price list, grouped by category (each group: its name, its lowest listed price, the first few
// names), or one node per service when there are no groups. Only what the member listed.
function groupNodes(groups) {
  const gs = groups.filter((g) => g && g.items && g.items.length);
  if (gs.length >= 2) {
    return gs.map((g) => {
      const priced = g.items.filter((x) => typeof x.price === 'number');
      const low = priced.length ? priced.reduce((a, b) => (b.price < a.price ? b : a)) : null;
      const names = g.items.map((x) => x.name).filter(Boolean);
      return { title: g.title, meta: low && low.priceText ? (priced.length > 1 && !/^From /.test(low.priceText) ? `From ${low.priceText}` : low.priceText) : '', sub: names.slice(0, 3).join(', ') + (names.length > 3 ? ', and more' : '') };
    });
  }
  const items = gs.length ? gs[0].items : [];
  return items.map((x) => ({ title: x.name, meta: x.priceText || '', sub: x.duration || x.blurb || '' }));
}

function servicesByCategory(c) {
  const groups = [];
  for (const s of c.services) {
    const title = s.category || '';
    let g = groups.find((x) => x.title === title);
    if (!g) groups.push((g = { title, items: [] }));
    g.items.push(s);
  }
  return groups.length > 1 && groups.every((g) => g.title) ? groups : [{ title: '', items: c.services }];
}

module.exports = { roadmap, ROADMAP_CSS, wave, groupNodes, servicesByCategory };
