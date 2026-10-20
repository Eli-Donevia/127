// Generated images for a site: abstract placeholder art in the member's colors (never stock photos of
// people), the social share card (Open Graph, 1200 x 630) and the favicon. Placeholders are meant to
// look finished until the member swaps in their own photos with the same file names.

const { svg: S, color, text } = require('../../_kit');

// Small deterministic random from a seed, so the same business gets the same art every build.
function rng(seed) {
  let h = text.hash(seed) || 1;
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

function grain(id, opacity = 0.08) {
  return {
    defs: `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${opacity} 0"/></filter>`,
    use: (w, h) => `<rect width="${w}" height="${h}" filter="url(#${id})"/>`,
  };
}

function blur(id, sd) {
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
}

// Placeholders are window light: daylight falling through a window onto a wall in the member's own colour, with
// grain and a soft fall-off, like a quiet photograph of a room. No blobs, no glows, no shapes pretending to be a
// product or a person, and no text (an <img> SVG can't load the page's fonts). The style picks the window:
//   sweep, portrait, object: a four-pane window    arch: an arched window    mesh, plates, grid: blinds
//   tile: each index picks one of the three, so a gallery reads as one room at different hours
function wall({ style = 'mesh', w = 1600, h = 1000, p, seed = 'x', index = 0, quiet = false }) {
  const r = rng(`${seed}:${style}:${index}`);
  const m = Math.min(w, h);
  const dark = color.luminance(p.paper) < 0.2;
  // The wall: the member's colour, quietened toward the page; the light: the same wall, lit.
  // Quietened toward the page and toward grey, so a bright brand colour doesn't turn the photo salmon or lavender.
  const tone = color.mix(p.primary, dark ? '#3a3a3a' : '#b9b5ad', 0.45);
  const wall = dark ? color.mix(color.mix(tone, p.ink, 0.2), p.paper, quiet ? 0.78 : 0.66) : color.mix(tone, p.paper, quiet ? 0.78 : 0.64);
  const lit = color.mix(wall, dark ? color.mix(p.primary, '#ffffff', 0.5) : '#fffaf2', dark ? 0.34 : 0.5);
  const shade = color.mix(wall, '#000000', dark ? 0.45 : 0.28);
  const kinds = ['window', 'arch', 'blinds'];
  const kind = style === 'tile' ? kinds[index % 3] : style === 'arch' ? 'arch' : /^(mesh|plates|grid)$/.test(style) ? 'blinds' : 'window';
  // The sun's angle: the light falls from the upper left or right, sheared down the wall.
  const dir = r() > 0.5 ? 1 : -1;
  const shear = (0.32 + r() * 0.28) * dir;
  // The window's light is bigger than the frame and runs off its edges, like a crop of a real wall.
  const ww = w * (kind === 'blinds' ? 0.95 : 0.62 + r() * 0.14);
  const wh = h * (kind === 'blinds' ? 1.05 : 0.95 + r() * 0.2);
  const x0 = w * (dir > 0 ? -0.08 + r() * 0.2 : 0.3 + r() * 0.16) - (kind === 'blinds' ? w * 0.12 * dir : 0);
  const y0 = h * (-0.18 + r() * 0.14);
  // A rectangle on the wall, sheared by the sun (x moves with y).
  const quad = (x, y, qw, qh) => {
    const sx = (yy) => (yy - y0) * shear;
    return `M${(x + sx(y)).toFixed(1)} ${y.toFixed(1)}H${(x + qw + sx(y)).toFixed(1)}L${(x + qw + sx(y + qh)).toFixed(1)} ${(y + qh).toFixed(1)}H${(x + sx(y + qh)).toFixed(1)}Z`;
  };
  const bar = m * 0.028;
  let shape = '';
  let mullion = '';
  if (kind === 'window') {
    const pw = (ww - bar) / 2;
    const ph = (wh - bar) / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) shape += quad(x0 + i * (pw + bar), y0 + j * (ph + bar), pw, ph);
  } else if (kind === 'blinds') {
    const n = 9 + Math.floor(r() * 4);
    const gap = wh / n;
    for (let i = 0; i < n; i++) shape += quad(x0, y0 + i * gap, ww, gap * (0.52 + r() * 0.08));
  } else {
    // An arch: two tall panes under a round head, drawn as one path, then sheared like the rest.
    const pw = (ww - bar) / 2;
    const top = y0 + ww / 2;
    const sx = (yy) => (yy - y0) * shear;
    const R = ww / 2;
    const cx = x0 + R;
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const t = Math.PI + (k / 24) * Math.PI;
      const yy = top + Math.sin(t) * R;
      pts.push(`${(cx + Math.cos(t) * R + sx(yy)).toFixed(1)} ${yy.toFixed(1)}`);
    }
    shape += `M${pts.join('L')}L${(x0 + ww + sx(y0 + wh)).toFixed(1)} ${(y0 + wh).toFixed(1)}H${(x0 + sx(y0 + wh)).toFixed(1)}Z`;
    // The mullion down the middle is shade, painted over the light.
    mullion = quad(x0 + pw, y0, bar, wh);
  }
  const soft = m * 0.009;
  const defs =
    `<radialGradient id="v${index}" cx="${dir > 0 ? 0.35 : 0.65}" cy=".35" r=".9"><stop offset="0" stop-color="${wall}"/><stop offset="1" stop-color="${shade}"/></radialGradient>` +
    `<linearGradient id="l${index}" x1="${dir > 0 ? 0.1 : 0.9}" y1="0" x2="${dir > 0 ? 0.7 : 0.3}" y2="1"><stop offset="0" stop-color="${lit}"/><stop offset=".6" stop-color="${lit}" stop-opacity=".7"/><stop offset="1" stop-color="${lit}" stop-opacity=".25"/></linearGradient>` +
    `<filter id="s${index}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${soft.toFixed(1)}"/></filter>` +
    `<filter id="b${index}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${(m * 0.05).toFixed(1)}"/></filter>` +
    `<filter id="g${index}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" seed="${Math.floor(r() * 90)}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${dark ? 0.1 : 0.075} 0"/></filter>`;
  const body =
    `<rect width="${w}" height="${h}" fill="url(#v${index})"/>` +
    // The light's bounce, very soft and low, so the patch sits in the room rather than on a flat colour.
    `<path d="${shape}" fill="${lit}" opacity="${dark ? 0.16 : 0.22}" filter="url(#b${index})"/>` +
    `<path d="${shape}" fill="url(#l${index})" opacity="${dark ? 0.7 : 0.85}" filter="url(#s${index})"/>` +
    (mullion ? `<path d="${mullion}" fill="${wall}" opacity=".9" filter="url(#s${index})"/>` : '') +
    `<rect width="${w}" height="${h}" filter="url(#g${index})"/>`;
  return { defs, body, wall, lit, shade, dark };
}

// The window-light placeholder on its own: a whole SVG.
function placeholder(o) {
  const { defs, body } = wall(o);
  return svgDoc(o.w || 1600, o.h || 1000, defs, body);
}

// For a design's own drawn placeholder (T.art): wrap defs and shapes in one SVG of that size.
function svgDoc(w, h, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
}

// The share card: what people see when the link is posted in a text, on Facebook or on LinkedIn.
function ogImage({ name, line, url, p }) {
  const W = 1200;
  const H = 630;
  const bg = color.mix(p.ink, '#000000', 0.2);
  const P = p.primary;
  const A = p.accent;
  const nameFit = S.fit(name, { width: 760, height: 260, maxSize: 104, minSize: 52, maxLines: 2, weight: 800, lineHeight: 1.04 });
  const lineFit = S.fit(line || '', { width: 760, height: 110, maxSize: 38, minSize: 26, maxLines: 2, weight: 500, lineHeight: 1.25 });
  const nameH = nameFit.lines.length * nameFit.size * 1.04;
  const top = 150;
  const initials = text.initials(String(name || '').replace(/['\u2019]/g, ''), 2);
  const host = String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const urlPill = host ? S.pill({ x: 80, y: 520, label: host, size: 24, weight: 600, fill: P, color: color.readableOn(P) }).svg : '';
  return S.doc({
    width: W,
    height: H,
    title: name,
    defs: `<filter id="bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter><pattern id="gr" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#ffffff" stroke-opacity=".05"/></pattern>`,
    background: bg,
    body:
      `<rect width="${W}" height="${H}" fill="url(#gr)"/>` +
      `<g filter="url(#bl)"><circle cx="1010" cy="170" r="220" fill="${P}" opacity=".85"/><circle cx="1120" cy="560" r="180" fill="${A}" opacity=".55"/></g>` +
      `<circle cx="1000" cy="315" r="150" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="2"/>` +
      `<text x="1000" y="345" text-anchor="middle" font-family="${S.FONTS.display}" font-size="92" font-weight="800" fill="#ffffff" letter-spacing="-2">${S.esc(initials)}</text>` +
      S.text({ x: 80, y: top + nameFit.size * 0.8, lines: nameFit.lines, size: nameFit.size, weight: 800, fill: '#ffffff', font: S.FONTS.display, lineHeight: 1.04, letterSpacing: -1.5 }) +
      (line ? S.text({ x: 80, y: top + nameH + 28 + lineFit.size, lines: lineFit.lines, size: lineFit.size, weight: 500, fill: color.mix('#ffffff', bg, 0.25), font: S.FONTS.sans, lineHeight: 1.25 }) : '') +
      urlPill,
  });
}

// Favicon: initials on the brand color. size 64 for favicon.svg; 180 for the iPhone home screen icon.
function favicon({ name, p, size = 64, rounded = true }) {
  const initials = text.initials(String(name || '').replace(/['\u2019]/g, ''), name && name.split(/\s+/).length > 1 ? 2 : 1) || 'S';
  const fs = initials.length > 1 ? size * 0.44 : size * 0.58;
  const fg = color.readableOn(p.primary);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="${p.primary}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Inter,'Helvetica Neue',Arial,system-ui,sans-serif" font-size="${Math.round(fs)}" font-weight="800" letter-spacing="-.02em" fill="${fg}">${S.esc(initials)}</text></svg>`;
}

function dataUri(svgText) {
  return `data:image/svg+xml;base64,${Buffer.from(svgText, 'utf8').toString('base64')}`;
}

module.exports = { placeholder, wall, svgDoc, ogImage, favicon, dataUri, rng };
