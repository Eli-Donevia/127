// Profile picture and story highlight covers in the member's colors, drawn from the chosen logo
// concept. Profile pictures are cropped to a circle by Instagram, TikTok and Facebook, so the mark
// sits inside the middle 70 percent. Covers are 1080 x 1920 with the icon in the center circle.

const svg = require('../../_kit/svg');
const L = require('./logos');

const COVERS = [
  { key: 'prices', label: 'Prices', icon: 'tag' },
  { key: 'work', label: 'Our work', icon: 'image' },
  { key: 'book', label: 'Book', icon: 'calendar' },
  { key: 'faq', label: 'FAQ', icon: 'chat' },
  { key: 'about', label: 'About', icon: 'user' },
];

function profileSvg(spec, conceptId, { size = 1080 } = {}) {
  const d = L.draw(conceptId, spec, 'reverse');
  const c = spec.colors;
  const inner = size * 0.5;
  const k = inner / d.mark.size;
  const off = (size - inner) / 2;
  const body = svg.rect({ x: 0, y: 0, w: size, h: size, fill: c.primary }) + svg.group(d.mark.body, { transform: `translate(${off} ${off}) scale(${Math.round(k * 10000) / 10000})` });
  return svg.doc({ width: size, height: size, body, title: `${spec.name} profile picture` });
}

function coverSvg(spec, cover, i) {
  const W = 1080;
  const H = 1920;
  const c = spec.colors;
  const bg = i % 2 ? c.ink : c.primary;
  const fg = i % 2 ? c.paper : c.onPrimary;
  const r = 300;
  let body = svg.rect({ x: 0, y: 0, w: W, h: H, fill: bg });
  body += svg.circle({ cx: W / 2, cy: H / 2, r, fill: 'none', stroke: fg, strokeWidth: 6, opacity: 0.35 });
  body += svg.icon(cover.icon, { x: W / 2 - 170, y: H / 2 - 170, size: 340, color: fg, weight: 1.6 });
  return svg.doc({ width: W, height: H, body, title: `${spec.name} ${cover.label} cover` });
}

module.exports = { profileSvg, coverSvg, COVERS };
