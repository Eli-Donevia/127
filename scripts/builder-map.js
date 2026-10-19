#!/usr/bin/env node
// Writes the Builder map's stills and its motion page, for Video (lib/builder-map.js draws the map from the product):
//   node scripts/builder-map.js <folder>
// builder-map-wide.svg, -tall.svg and -phone.svg are the stills. builder-map-motion.html builds the map in 10 seconds
// with a slow 3D turn, then each AI tool in turn sends a pulse to the playbooks it works from. Open it in a browser: ?frame=tall (9:16, the default) or ?frame=wide (16:9), ?t=4.5 holds one
// moment, and ?text=0 leaves out the title and the count line. window.seek(t) draws any moment, so a recorder can step
// through it frame by frame. Run it again after the library or the AI tools change.
const fs = require('fs');
const path = require('path');
const map = require('../lib/builder-map');

const ROOT = path.join(__dirname, '..');
const font = (file, family, weight) => {
  const data = fs.readFileSync(path.join(ROOT, 'public', 'fonts', file)).toString('base64');
  return `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${data}) format('woff2');font-weight:${weight}}`;
};

const fonts = () => [font('Geist-Regular.woff2', 'Geist', 400), font('Geist-Medium.woff2', 'Geist', 500), font('Geist-Bold.woff2', 'Geist', 700), font('GeistMono-Regular.woff2', 'Geist Mono', 400)].join('');

// A still that carries its own fonts, so it looks the same wherever it's opened.
const still = (frame) => map.svg(frame).replace(/^(<svg[^>]*>)/, `$1<style>${fonts()}</style>`);

function motionPage() {
  const scenes = { tall: map.scene('tall'), wide: map.scene('wide') };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Builder map, motion</title>
<style>${fonts()}
html,body{margin:0;background:#060607;overflow:hidden}
#stage{position:relative;transform-origin:0 0}
svg{position:absolute;inset:0;overflow:visible}
.cap{position:absolute;left:0;right:0;text-align:center;font-family:Geist,system-ui,sans-serif;color:#ededf2}
.cap.top{font-size:var(--top);font-weight:500;letter-spacing:.24em;text-transform:uppercase;color:#8b8b96}
.cap.bottom{font-size:var(--bottom);line-height:1.35;padding:0 8%}
</style></head><body>
<div id="stage"><svg id="map" xmlns="http://www.w3.org/2000/svg"></svg><div class="cap top" id="title">Everything in Builder</div><div class="cap bottom" id="line">${map.countLine()}</div></div>
<script>
const SCENES = ${JSON.stringify(scenes)};
const q = new URLSearchParams(location.search);
const FRAME = q.get('frame') === 'wide' ? 'wide' : 'tall';
const S = SCENES[FRAME];
// The canvas: 9:16 or 16:9, with room above and below the map for the title and the count line.
const W = FRAME === 'tall' ? 1080 : 1920;
const H = FRAME === 'tall' ? 1920 : 1080;
const OX = (W - S.w) / 2;
const OY = FRAME === 'tall' ? 236 : 104;
const D = FRAME === 'tall' ? 300 : 260; // depth spread
const DUR = 10;
const stage = document.getElementById('stage');
stage.style.width = W + 'px';
stage.style.height = H + 'px';
const fit = () => { const k = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = 'scale(' + k + ')'; };
fit();
addEventListener('resize', fit);
const title = document.getElementById('title');
const line = document.getElementById('line');
title.style.top = (FRAME === 'tall' ? 150 : 48) + 'px';
line.style.top = (FRAME === 'tall' ? 1784 : 1018) + 'px';
stage.style.setProperty('--top', FRAME === 'tall' ? '30px' : '22px');
stage.style.setProperty('--bottom', FRAME === 'tall' ? '38px' : '26px');
if (q.get('text') === '0') { title.remove(); line.remove(); }

const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('map');
svg.setAttribute('width', W);
svg.setAttribute('height', H);
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); (parent || svg).appendChild(e); return e; };
const defs = el('defs', {});
const steel = el('radialGradient', { id: 'steel', cx: '35%', cy: '30%', r: '75%' }, defs);
[['0', '#ffffff'], ['.42', '#b9bdc8'], ['1', '#34363e']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, steel));
const haloG = el('radialGradient', { id: 'halo' }, defs);
[['0', .34], ['.22', .19], ['.45', .08], ['.72', .022], ['1', 0]].forEach(([o, a]) => el('stop', { offset: o, 'stop-color': '#e3e6f1', 'stop-opacity': a }, haloG));
const by = Object.fromEntries(S.nodes.map((n) => [n.id, n]));
const core = by.builder;
const halo = el('circle', { r: S.h * 0.46, fill: 'url(#halo)' });
const gLines = el('g', { fill: 'none', stroke: '#e3e6f1' });
const gPulses = el('g', { fill: '#ffffff' });
const gNodes = el('g', {});
const gText = el('g', { 'font-family': 'Geist, system-ui, sans-serif', stroke: '#060607', 'stroke-linejoin': 'round', 'paint-order': 'stroke' });

// When each piece arrives. The groups bloom in reading order, then Eli's Playbook reaches every tool.
const order = FRAME === 'tall' ? ['start', 'weeks', 'build', 'grow'] : ['start', 'grow', 'build', 'weeks'];
const at = {};
at.builder = 0.2;
['hub-start', 'hub-build', 'hub-grow', 'hub-weeks', 'hub-ai'].forEach((id, i) => { at[id] = 0.9 + i * 0.12; });
order.forEach((g, gi) => {
  S.nodes.filter((n) => n.group === g && n.kind !== 'hub').forEach((n, i) => { at[n.id] = 1.7 + gi * 0.7 + i * 0.06; });
});
S.nodes.filter((n) => n.kind === 'tool').forEach((n, i) => { at[n.id] = 4.6 + i * 0.09; });

const lines = S.edges.map((e) => {
  const p = el('path', { 'stroke-width': e.width, 'stroke-opacity': e.o }, gLines);
  if (e.kind === 'pair') p.setAttribute('stroke-dasharray', '3 5');
  else p.setAttribute('pathLength', '1');
  // A line draws as its far end arrives; tool lines draw from Eli's Playbook; pair lines fade in last.
  const start = e.kind === 'pair' ? 6.0 + (S.edges.indexOf(e) % 9) * 0.05 : (at[e.b] || 1) - 0.35;
  return { e, p, start };
});
// Once it's all there, each AI tool fires in turn: a pulse runs down each dashed line to a playbook it works from.
const tools = S.nodes.filter((n) => n.kind === 'tool').map((n) => n.id);
const fireAt = Object.fromEntries(tools.map((id, i) => [id, 7.0 + i * 0.26]));
const PULSE = 0.8;
const arrive = {};
const pulses = lines.filter((l) => l.e.kind === 'pair').map((l) => {
  const t0 = fireAt[l.e.a];
  (arrive[l.e.b] = arrive[l.e.b] || []).push(t0 + PULSE);
  return { l, t0, glow: el('circle', { r: 12, opacity: 0 }, gPulses), dot: el('circle', { r: 3.8, opacity: 0 }, gPulses) };
});
const dots = S.nodes.map((n) => {
  const g = el('g', {}, gNodes);
  let body;
  if (n.kind === 'tool') { body = [el('circle', { fill: '#060607', stroke: '#e3e6f1', 'stroke-width': 1.6 }, g), el('circle', { fill: '#ffffff' }, g)]; }
  else if (n.kind === 'week') { body = [el('rect', { fill: 'url(#steel)', rx: 1.5 }, g)]; }
  else { body = [el('circle', { fill: 'url(#steel)' }, g)]; }
  const texts = [];
  if (n.label) {
    const t = n.label;
    const a = { 'font-size': t.px, 'font-weight': t.weight, fill: t.fill, 'text-anchor': t.anchor };
    if (t.ls) a['letter-spacing'] = t.ls;
    if (t.outline) a['stroke-width'] = t.outline; else a.stroke = 'none';
    const tx = el('text', a, gText);
    tx.textContent = t.text;
    texts.push([tx, t.dx, t.dy]);
    if (t.sub) {
      const sx = el('text', { 'font-size': t.sub.px, 'font-family': "'Geist Mono', ui-monospace, monospace", 'letter-spacing': t.sub.ls, fill: '#8b8b96', 'stroke-width': 3, 'text-anchor': t.anchor }, gText);
      sx.textContent = t.sub.text;
      texts.push([sx, t.dx, t.sub.dy]);
    }
  }
  return { n, g, body, texts };
});

const clamp = (v) => Math.max(0, Math.min(1, v));
const easeOut = (v) => 1 - Math.pow(1 - clamp(v), 3);
const pop = (v) => { v = clamp(v); return v === 0 ? 0 : 1 + 0.18 * Math.sin(v * Math.PI) * (1 - v) + (easeOut(v) - 1); };
const inOut = (v) => { v = clamp(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const bell = (v) => (v <= -1 || v >= 1 ? 0 : 0.5 + 0.5 * Math.cos(v * Math.PI));

function seek(t) {
  // A slow turn on two axes and a gentle pull back: the depth in each node's z is what makes it read as 3D.
  const yaw = (-11 + 20 * inOut(t / DUR)) * Math.PI / 180;
  const pitch = (5 - 3 * inOut(t / DUR)) * Math.PI / 180;
  const zoom = 1.03 - 0.07 * easeOut(t / DUR);
  const cx = core.x;
  const cy = S.h / 2;
  const P = 2400;
  const proj = {};
  for (const n of S.nodes) {
    const X = n.x - cx;
    const Y = n.y - cy;
    const Z = n.z * D;
    const x1 = X * Math.cos(yaw) + Z * Math.sin(yaw);
    const z1 = -X * Math.sin(yaw) + Z * Math.cos(yaw);
    const y1 = Y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = Y * Math.sin(pitch) + z1 * Math.cos(pitch);
    const s = P / (P - z2);
    proj[n.id] = { x: OX + cx + x1 * s * zoom, y: OY + cy + y1 * s * zoom, s: s * zoom };
  }
  const c = proj.builder;
  const curve = new Map();
  halo.setAttribute('cx', c.x);
  halo.setAttribute('cy', c.y);
  halo.setAttribute('opacity', easeOut((t - 0.2) / 1.4));
  for (const { e, p, start } of lines) {
    const a = proj[e.a];
    const b = proj[e.b];
    const qx = (a.x + b.x) / 2 - (b.y - a.y) * e.bend;
    const qy = (a.y + b.y) / 2 + (b.x - a.x) * e.bend;
    p.setAttribute('d', 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + 'Q' + qx.toFixed(1) + ' ' + qy.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1));
    curve.set(e, [a.x, a.y, qx, qy, b.x, b.y]);
    const v = e.kind === 'pair' ? easeOut((t - start) / 0.8) : easeOut((t - start) / 0.45);
    if (e.kind === 'pair') p.setAttribute('opacity', v);
    else p.setAttribute('stroke-dasharray', v.toFixed(4) + ' 1');
  }
  for (const { l, t0, glow, dot } of pulses) {
    const u = inOut((t - t0) / PULSE);
    const on = t > t0 && t < t0 + PULSE ? Math.sin(u * Math.PI) : 0;
    const [ax, ay, qx, qy, bx, by] = curve.get(l.e);
    const x = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * qx + u * u * bx;
    const y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * qy + u * u * by;
    for (const [d, o] of [[glow, 0.26], [dot, 1]]) { d.setAttribute('cx', x.toFixed(1)); d.setAttribute('cy', y.toFixed(1)); d.setAttribute('opacity', (o * on).toFixed(3)); }
  }
  for (const { n, g, body, texts } of dots) {
    const pr = proj[n.id];
    const k = pop((t - at[n.id]) / 0.45);
    // A playbook swells for a moment when a tool's pulse reaches it.
    const hit = Math.max(0, ...(arrive[n.id] || []).map((ta) => bell((t - ta) / 0.3)));
    const r = n.r * pr.s * k * (1 + 0.6 * hit);
    g.setAttribute('opacity', (n.op * clamp((t - at[n.id]) / 0.2)).toFixed(3));
    if (n.kind === 'tool') {
      body[0].setAttribute('cx', pr.x); body[0].setAttribute('cy', pr.y); body[0].setAttribute('r', Math.max(0, r));
      // The tool's core flashes when Eli's Playbook reaches it and again when it fires, then breathes.
      const flash = Math.max(1 - clamp((t - at[n.id] - 0.2) / 0.6), bell((t - fireAt[n.id]) / 0.35));
      body[1].setAttribute('cx', pr.x); body[1].setAttribute('cy', pr.y); body[1].setAttribute('r', Math.max(0, r * (0.36 + 0.3 * flash)));
      body[1].setAttribute('opacity', 0.65 + 0.35 * Math.cos((t + at[n.id]) * 1.7));
    } else if (n.kind === 'week') {
      body[0].setAttribute('x', pr.x - r); body[0].setAttribute('y', pr.y - r); body[0].setAttribute('width', Math.max(0, r * 2)); body[0].setAttribute('height', Math.max(0, r * 2));
      body[0].setAttribute('transform', 'rotate(45 ' + pr.x + ' ' + pr.y + ')');
    } else {
      body[0].setAttribute('cx', pr.x); body[0].setAttribute('cy', pr.y); body[0].setAttribute('r', Math.max(0, r));
    }
    for (const [tx, dx, dy] of texts) {
      tx.setAttribute('x', pr.x + dx * pr.s);
      tx.setAttribute('y', pr.y + dy * pr.s);
      tx.setAttribute('opacity', easeOut((t - at[n.id] - 0.15) / 0.35));
    }
  }
  if (title.isConnected) title.style.opacity = easeOut((t - 0.3) / 0.8);
  if (line.isConnected) line.style.opacity = easeOut((t - 6.8) / 0.8);
}
window.seek = seek;
window.DUR = DUR;
if (q.has('t')) seek(parseFloat(q.get('t')) || 0);
else {
  let t0 = null;
  const loop = (ts) => { if (t0 === null) t0 = ts; seek(((ts - t0) / 1000) % (DUR + 1.5)); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
</script></body></html>
`;
}

if (require.main === module) {
  const out = process.argv[2];
  if (!out) { console.error('usage: node scripts/builder-map.js <folder>'); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  for (const frame of Object.keys(map.FRAMES)) fs.writeFileSync(path.join(out, `builder-map-${frame}.svg`), still(frame));
  fs.writeFileSync(path.join(out, 'builder-map-motion.html'), motionPage());
  console.log(`Wrote the Builder map to ${out}: builder-map-{${Object.keys(map.FRAMES).join(',')}}.svg and builder-map-motion.html`);
}

module.exports = { motionPage };
