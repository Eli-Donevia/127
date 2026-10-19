// The Builder map: everything in Builder as one picture, for the pricing page and for Video's stills and motion
// (scripts/builder-map.js). It's drawn from the product itself (content/resources.json, the AI tools in lib/ai.js,
// lib/plans.js), so what it shows matches the product on the day (Legal 05 rule 6). Only what conversion/offer.md sells
// is on it: the library by track, every AI tool linked to the playbooks it works with, Eli's Playbook and the 4 weeks.
// HQ's packs and the templates library join when offer.md lists them.
const { resources } = require('../content/resources.json');
const { TOOLS } = require('./ai');
const { PLANS } = require('./plans');

const TRACKS = { start: 'Start', build: 'Build', grow: 'Grow' };

// Nodes and the lines between them. "pair" lines join an AI tool to the playbooks it works from (its `resources`).
function graph() {
  const nodes = [];
  const edges = [];
  const ids = new Set();
  const node = (id, kind, label, group, sub) => { nodes.push({ id, kind, label, group, sub }); ids.add(id); };
  const edge = (a, b, kind) => edges.push({ a, b, kind });
  node('builder', 'center', 'Builder', 'center');
  for (const [k, label] of Object.entries(TRACKS)) { node(`hub-${k}`, 'hub', label, k); edge('builder', `hub-${k}`, 'hub'); }
  node('hub-ai', 'hub', "Eli's Playbook", 'ai', `About ${PLANS.builder.aiRunsPerMonth} messages a month`);
  edge('builder', 'hub-ai', 'hub');
  node('hub-weeks', 'hub', 'Your roadmap', 'weeks', 'All 4 weeks');
  edge('builder', 'hub-weeks', 'hub');
  for (const r of resources) { node(`r-${r.slug}`, 'item', r.title, r.track); edge(`hub-${r.track}`, `r-${r.slug}`, 'item'); }
  // "Ask Eli's Playbook" is the hub itself, so the tools are the other ones.
  for (const t of TOOLS.filter((x) => x.slug !== 'ask')) {
    node(`t-${t.slug}`, 'tool', t.name, 'ai');
    edge('hub-ai', `t-${t.slug}`, 'item');
    for (const s of t.resources || []) if (ids.has(`r-${s}`)) edge(`t-${t.slug}`, `r-${s}`, 'pair');
  }
  for (let w = 1; w <= 4; w++) { node(`w${w}`, 'week', `Week ${w}`, 'weeks'); edge(w === 1 ? 'hub-weeks' : `w${w - 1}`, `w${w}`, 'item'); }
  return { nodes, edges };
}

// The count line that goes with the map, in offer.md's own words (its "only these numbers" rule).
function countLine() {
  return `${resources.length} playbooks, worksheets and tools. Every AI tool. About ${PLANS.builder.aiRunsPerMonth} AI messages a month. All 4 weeks.`;
}

// A seeded random, so the map comes out the same on every server and in every render.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Three frames. Wide (desktop, 16:9 video) and tall (9:16 video) stack the tracks and the roadmap in two columns with
// every label facing out, so nothing overlaps by construction; each AI tool sits under the playbook it works from first.
// Phone has no room for 33 names, so it fans each group around its hub and names only the hubs.
const FRAMES = {
  wide: { w: 1600, h: 900, font: 19, kind: 'columns', hubs: 'gutter', core: [800, 360], ai: [800, 560], top: 78, bottom: 836, bow: 70,
    cols: [{ x: 420, side: 'left', hubX: 600, groups: ['start', 'build'] }, { x: 1180, side: 'right', hubX: 1000, groups: ['grow', 'weeks'] }] },
  tall: { w: 1080, h: 1500, font: 22, kind: 'columns', hubs: 'header', core: [540, 150], ai: [540, 318], top: 450, bottom: 1450, bow: 30,
    cols: [{ x: 430, side: 'left', groups: ['start', 'build'] }, { x: 650, side: 'right', groups: ['weeks', 'grow'] }] },
  phone: { w: 800, h: 940, font: 29, kind: 'fans', leafLabels: false, core: [400, 372], ai: [400, 590],
    fans: {
      start: { at: [168, 172], label: 'right', dir: 222, spread: 160, radii: [92, 138] },
      weeks: { at: [672, 150], label: 'left', dir: 0, spread: 120, radii: [96, 96] },
      build: { at: [150, 792], label: 'right', dir: 128, spread: 180, radii: [86, 128] },
      grow: { at: [652, 772], label: 'left', dir: 55, spread: 170, radii: [86, 126] },
    } },
};

const SIZE = { center: 30, hub: 13, item: 7, tool: 7, week: 6 };

function labelFor(n, F) {
  const f = F.font;
  if (n.kind === 'center') return { text: n.label, px: f * 2.1, caps: false, weight: 700 };
  if (n.kind === 'hub') return { text: n.label.toUpperCase(), px: f * (F.leafLabels === false ? 0.95 : 0.8), caps: true, weight: 500, sub: n.sub && n.sub.toUpperCase() };
  if (n.kind === 'week') return { text: n.label.toUpperCase(), px: f * 0.72, caps: true, weight: 500 };
  return { text: n.label, px: f, caps: false, weight: n.kind === 'tool' ? 500 : 400 };
}

// Each group's rows, top to bottom: the playbooks in library order, each followed by the tools that work from it first.
function rows(nodes, edges, group) {
  if (group === 'weeks') return nodes.filter((n) => n.kind === 'week');
  const items = nodes.filter((n) => n.kind === 'item' && n.group === group);
  const out = [];
  for (const it of items) {
    out.push(it);
    for (const t of nodes.filter((n) => n.kind === 'tool')) {
      const first = edges.find((e) => e.kind === 'pair' && e.a === t.id);
      if (first && first.b === it.id) out.push(t);
    }
  }
  return out;
}

function columns(F, nodes, edges, by, rnd) {
  for (const col of F.cols) {
    const groups = col.groups.map((g) => rows(nodes, edges, g));
    // A header hub takes a row and a half above its group; a gutter hub sits beside it.
    const head = F.hubs === 'header' ? 1.5 : 0;
    const gap = 1.4;
    const count = groups.reduce((a, g) => a + g.length + head, 0) + gap * (groups.length - 1);
    const pitch = (F.bottom - F.top) / (count - 1);
    const out = col.side === 'left' ? -1 : 1;
    const bowAt = (y) => { const t = ((y - F.top) / (F.bottom - F.top)) * 2 - 1; return out * F.bow * (1 - t * t); };
    let row = 0;
    groups.forEach((list, gi) => {
      const hub = by[`hub-${col.groups[gi]}`];
      if (head) {
        hub.y = F.top + row * pitch;
        hub.x = col.x + bowAt(hub.y) - out * 34;
        hub.side = col.side;
        row += head;
      }
      const ys = [];
      for (const n of list) {
        const y = F.top + row * pitch;
        // The columns bow out around the core, tools step in toward it, and a little jitter keeps it hand-drawn.
        n.x = col.x + bowAt(y) - (n.kind === 'tool' ? out * 22 : 0) + (rnd() - 0.5) * 14;
        n.y = y;
        // Depth rolls in a slow wave down each column, so rows that sit together stay together when the map turns.
        n.z = -0.1 + 0.35 * Math.sin(row * 0.55 + (out > 0 ? 2 : 0)) + (rnd() - 0.5) * 0.08;
        n.side = col.side;
        ys.push(y);
        row += 1;
      }
      if (!head) {
        hub.x = col.hubX + (rnd() - 0.5) * 30;
        hub.y = (ys[0] + ys[ys.length - 1]) / 2 - pitch * 0.4;
        hub.side = 'below';
      }
      row += gap;
    });
  }
}

function fans(F, nodes, edges, by, rnd) {
  for (const [g, fan] of Object.entries(F.fans)) {
    const hub = by[`hub-${g}`];
    [hub.x, hub.y] = fan.at;
    hub.side = fan.label;
    const list = rows(nodes, edges, g);
    list.forEach((n, i) => {
      const t = list.length > 1 ? i / (list.length - 1) - 0.5 : 0;
      const a = ((fan.dir + t * fan.spread) * Math.PI) / 180;
      const r = fan.radii[i % 2] + (rnd() - 0.5) * 16;
      n.x = hub.x + Math.cos(a) * r;
      n.y = hub.y + Math.sin(a) * r;
      n.side = 'none';
    });
  }
}

function layout(frame = 'wide', seed = 127) {
  const F = FRAMES[frame];
  const { nodes, edges } = graph();
  const rnd = seeded(seed);
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    n.r = SIZE[n.kind] * (F.kind === 'fans' && n.kind !== 'center' ? 1.35 : 1);
    n.lab = labelFor(n, F);
    // Depth for the 3D look and Video's motion: the core and hubs sit forward, the rest scatter front to back
    // (columns() sets its own, in a slow wave, so neighbors stay apart when the map turns).
    n.z = n.kind === 'center' ? 0.8 : n.kind === 'hub' ? 0.5 : rnd() * 1.6 - 0.8;
  }
  [by.builder.x, by.builder.y] = F.core;
  by.builder.side = 'below';
  [by['hub-ai'].x, by['hub-ai'].y] = F.ai;
  by['hub-ai'].side = 'below';
  (F.kind === 'fans' ? fans : columns)(F, nodes, edges, by, rnd);
  return { frame, w: F.w, h: F.h, font: F.font, leafLabels: F.leafLabels !== false, nodes, edges, by };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fx = (v) => Math.round(v * 10) / 10;

// Everything a renderer needs, in plain numbers: the static SVG below and Video's motion page (scripts/builder-map.js)
// both draw from this, so they can't drift apart. Labels are offsets from their node, so they move with it.
function scene(frame = 'wide') {
  const L = layout(frame);
  const near = (n) => (n.z + 1) / 2; // 0 far, 1 near
  const nodes = L.nodes.map((n) => {
    const r = n.r * (0.8 + 0.4 * near(n));
    const out = { id: n.id, kind: n.kind, group: n.group, x: fx(n.x), y: fx(n.y), z: fx(n.z * 100) / 100, r: fx(r), op: fx((0.5 + 0.5 * near(n)) * 100) / 100 };
    if (n.side === 'none' || (!L.leafLabels && n.kind !== 'center' && n.kind !== 'hub')) return out;
    const lab = n.lab;
    const gap = r + 8;
    const t = { text: lab.text, px: fx(lab.px), weight: lab.weight, caps: lab.caps,
      fill: n.kind === 'center' ? '#f4f5f9' : n.kind === 'hub' ? '#e3e6f1' : n.kind === 'tool' ? '#c9ccd6' : '#9b9ea9',
      ls: lab.caps ? fx(lab.px * 0.22) : n.kind === 'center' ? fx(-lab.px * 0.04) : 0,
      // A dark outline under the small labels keeps them clear of the lines behind them. The big ones don't need it.
      outline: n.kind === 'center' ? 0 : n.kind === 'hub' ? 3 : 5 };
    if (n.side === 'below') Object.assign(t, { dx: 0, dy: fx(gap + lab.px * 0.95), anchor: 'middle' });
    else Object.assign(t, { dx: fx(n.side === 'left' ? -gap : gap), dy: fx(lab.sub ? -lab.px * 0.12 : lab.px * 0.35), anchor: n.side === 'left' ? 'end' : 'start' });
    if (lab.sub) t.sub = { text: lab.sub, px: fx(lab.px * 0.82), ls: fx(lab.px * 0.12), dy: fx(t.dy + lab.px * (n.side === 'below' ? 1.3 : 1.2)) };
    out.label = t;
    return out;
  });
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  // Lines bend a little, alternately each way, so the map reads drawn rather than plotted.
  const edges = L.edges.map((e, i) => ({ a: e.a, b: e.b, kind: e.kind, bend: i % 2 ? 0.12 : -0.12,
    o: fx((e.kind === 'hub' ? 0.34 : e.kind === 'pair' ? 0.16 : 0.22) * Math.min(by[e.a].op, by[e.b].op) * 100) / 100,
    width: e.kind === 'hub' ? 1.6 : 1.1 }));
  const list = (g) => L.nodes.filter((n) => n.group === g && n.kind !== 'hub').map((n) => n.label).join(', ');
  const desc = `Builder at the center. Start: ${list('start')}. Build: ${list('build')}. Grow: ${list('grow')}. Eli's Playbook, with the AI tools, each linked to the playbooks it works from: ${list('ai')}. Your roadmap: weeks 1 to 4.`;
  return { frame, w: L.w, h: L.h, nodes, edges, desc };
}

const curve = (a, b, bend) => [(a.x + b.x) / 2 - (b.y - a.y) * bend, (a.y + b.y) / 2 + (b.x - a.x) * bend];

// The map as an SVG string. `id` keeps gradient ids apart when two maps share a page.
function svg(frame = 'wide', id = `bm-${frame}`) {
  const S = scene(frame);
  const by = Object.fromEntries(S.nodes.map((n) => [n.id, n]));
  const c = by.builder;
  const out = [];
  out.push(`<svg class="bm-svg bm-${frame}" viewBox="0 0 ${S.w} ${S.h}" role="img" aria-labelledby="${id}-t ${id}-d" xmlns="http://www.w3.org/2000/svg">`);
  out.push(`<title id="${id}-t">Everything in Builder, on one map</title><desc id="${id}-d">${esc(S.desc)}</desc>`);
  out.push(`<defs><radialGradient id="${id}-steel" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset=".42" stop-color="#b9bdc8"/><stop offset="1" stop-color="#34363e"/></radialGradient>`);
  out.push(`<radialGradient id="${id}-halo"><stop offset="0" stop-color="#e3e6f1" stop-opacity=".34"/><stop offset=".22" stop-color="#e3e6f1" stop-opacity=".19"/><stop offset=".45" stop-color="#e3e6f1" stop-opacity=".08"/><stop offset=".72" stop-color="#e3e6f1" stop-opacity=".022"/><stop offset="1" stop-color="#e3e6f1" stop-opacity="0"/></radialGradient></defs>`);
  out.push(`<circle class="bm-halo" cx="${c.x}" cy="${c.y}" r="${fx(S.h * 0.42)}" fill="url(#${id}-halo)"/>`);
  out.push('<g class="bm-lines" fill="none" stroke="#e3e6f1">');
  for (const e of S.edges) {
    const a = by[e.a];
    const b = by[e.b];
    const [qx, qy] = curve(a, b, e.bend);
    out.push(`<path class="bm-l bm-l-${e.kind}" d="M${a.x} ${a.y}Q${fx(qx)} ${fx(qy)} ${b.x} ${b.y}" stroke-opacity="${e.o}" stroke-width="${e.width}"${e.kind === 'pair' ? ' stroke-dasharray="3 5"' : ''}/>`);
  }
  out.push('</g><g class="bm-nodes">');
  // Far nodes first, so near ones draw on top.
  [...S.nodes].sort((p, q) => p.z - q.z).forEach((n, i) => {
    const g = `<g class="bm-n bm-${n.kind}" style="--i:${i}" opacity="${n.op}">`;
    if (n.kind === 'tool') out.push(`${g}<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="#060607" stroke="#e3e6f1" stroke-width="1.6"/><circle cx="${n.x}" cy="${n.y}" r="${fx(n.r * 0.36)}" fill="#ffffff"/></g>`);
    else if (n.kind === 'week') out.push(`${g}<rect x="${fx(n.x - n.r)}" y="${fx(n.y - n.r)}" width="${fx(n.r * 2)}" height="${fx(n.r * 2)}" rx="1.5" transform="rotate(45 ${n.x} ${n.y})" fill="url(#${id}-steel)"/></g>`);
    else out.push(`${g}<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="url(#${id}-steel)"/></g>`);
  });
  out.push('</g><g class="bm-labels" font-family="Geist, Inter, system-ui, sans-serif" stroke="#060607" stroke-linejoin="round" paint-order="stroke">');
  for (const n of S.nodes) {
    const t = n.label;
    if (!t) continue;
    const x = fx(n.x + t.dx);
    const y = fx(n.y + t.dy);
    out.push(`<text class="bm-t bm-t-${n.kind}" x="${x}" y="${y}" text-anchor="${t.anchor}" font-size="${t.px}" font-weight="${t.weight}" fill="${t.fill}"${t.ls ? ` letter-spacing="${t.ls}"` : ''}${t.outline ? ` stroke-width="${t.outline}"` : ' stroke="none"'}>${esc(t.text)}</text>`);
    if (t.sub) out.push(`<text class="bm-t bm-t-sub" x="${x}" y="${fx(n.y + t.sub.dy)}" text-anchor="${t.anchor}" font-size="${t.sub.px}" font-family="'Geist Mono', ui-monospace, monospace" letter-spacing="${t.sub.ls}" fill="#8b8b96" stroke-width="3">${esc(t.sub.text)}</text>`);
  }
  out.push('</g></svg>');
  return out.join('');
}

// What the pricing page shows, built once per process: the product only changes with a deploy.
let page;
function forPage() {
  page = page || { wide: svg('wide'), phone: svg('phone'), line: countLine() };
  return page;
}

module.exports = { graph, layout, scene, svg, forPage, countLine, FRAMES };
