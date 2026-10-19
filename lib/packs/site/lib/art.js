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

// style: sweep | arch | plates | portrait | object | grid | tile | mesh
function placeholder({ style = 'mesh', w = 1600, h = 1000, p, seed = 'x', index = 0, grain: withGrain = false }) {
  const r = rng(`${seed}:${style}:${index}`);
  const P = p.primary;
  const A = p.accent;
  const paper = p.paper;
  const ink = p.ink;
  const soft = color.mix(P, paper, 0.78);
  const g = grain(`g${index}`, 0.07);
  const m = Math.min(w, h);
  let defs = g.defs;
  let body = '';
  if (style === 'sweep') {
    defs += `<linearGradient id="b${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color.mix(P, ink, 0.35)}"/><stop offset=".55" stop-color="${P}"/><stop offset="1" stop-color="${color.mix(P, paper, 0.35)}"/></linearGradient>${blur(`f${index}`, m * 0.09)}`;
    body += `<rect width="${w}" height="${h}" fill="url(#b${index})"/>`;
    body += `<g filter="url(#f${index})" opacity=".9"><ellipse cx="${w * (0.62 + r() * 0.2)}" cy="${h * 0.22}" rx="${w * 0.34}" ry="${h * 0.16}" fill="${color.mix(P, '#ffffff', 0.7)}" transform="rotate(-18 ${w * 0.7} ${h * 0.22})"/><circle cx="${w * 0.15}" cy="${h * 0.9}" r="${m * 0.32}" fill="${color.mix(A, P, 0.4)}"/></g>`;
    for (let i = 0; i < 3; i++) {
      const x = w * (0.2 + i * 0.28 + r() * 0.05);
      body += `<path d="M${x} ${-h * 0.1} L${x + w * 0.42} ${h * 1.1}" stroke="#ffffff" stroke-opacity="${0.05 + i * 0.03}" stroke-width="${m * (0.05 + r() * 0.06)}"/>`;
    }
  } else if (style === 'arch') {
    const base = color.mix(paper, P, 0.16);
    defs += blur(`f${index}`, m * 0.06);
    body += `<rect width="${w}" height="${h}" fill="${base}"/>`;
    body += `<g filter="url(#f${index})"><circle cx="${w * (0.25 + r() * 0.5)}" cy="${h * 0.25}" r="${m * 0.22}" fill="${color.mix(A, paper, 0.45)}" opacity=".85"/></g>`;
    const aw = w * 0.56;
    const ax = (w - aw) / 2 + (r() - 0.5) * w * 0.1;
    body += `<path d="M${ax} ${h} V${h * 0.45} a${aw / 2} ${aw / 2} 0 0 1 ${aw} 0 V${h} Z" fill="${color.mix(P, paper, 0.25)}"/>`;
    body += `<path d="M${ax + aw * 0.18} ${h} V${h * 0.6} a${aw * 0.32} ${aw * 0.32} 0 0 1 ${aw * 0.64} 0 V${h} Z" fill="${color.mix(P, ink, 0.2)}" opacity=".55"/>`;
    body += `<circle cx="${w * 0.82}" cy="${h * 0.78}" r="${m * 0.06}" fill="${A}" opacity=".7"/>`;
  } else if (style === 'plates') {
    const bg = color.mix(ink, P, 0.22);
    defs += `<radialGradient id="v${index}" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="${color.mix(bg, '#ffffff', 0.1)}"/><stop offset="1" stop-color="${color.mix(bg, '#000000', 0.35)}"/></radialGradient>${blur(`f${index}`, m * 0.025)}`;
    body += `<rect width="${w}" height="${h}" fill="url(#v${index})"/>`;
    const plates = [
      [0.32, 0.5, 0.3],
      [0.74, 0.3, 0.2],
      [0.8, 0.82, 0.14],
    ];
    plates.forEach(([cx, cy, rr], i) => {
      const x = w * (cx + (r() - 0.5) * 0.05);
      const y = h * (cy + (r() - 0.5) * 0.05);
      const R = m * rr;
      body += `<circle cx="${x + R * 0.06}" cy="${y + R * 0.1}" r="${R}" fill="#000000" opacity=".28" filter="url(#f${index})"/>`;
      body += `<circle cx="${x}" cy="${y}" r="${R}" fill="${color.mix(paper, bg, 0.12)}"/>`;
      body += `<circle cx="${x}" cy="${y}" r="${R * 0.78}" fill="none" stroke="${color.mix(paper, bg, 0.3)}" stroke-width="${R * 0.02}"/>`;
      body += `<circle cx="${x}" cy="${y}" r="${R * 0.52}" fill="${i === 0 ? P : i === 1 ? A : color.mix(P, A, 0.5)}" opacity=".9"/>`;
      body += `<circle cx="${x - R * 0.14}" cy="${y - R * 0.12}" r="${R * 0.16}" fill="${color.mix(i === 1 ? P : A, paper, 0.3)}" opacity=".85"/>`;
    });
  } else if (style === 'portrait') {
    // Abstract and calm: a low sun, a tall rounded form and fine arcs. Never a figure.
    defs += `<linearGradient id="b${index}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color.mix(P, paper, 0.62)}"/><stop offset="1" stop-color="${color.mix(P, paper, 0.3)}"/></linearGradient><radialGradient id="s${index}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${color.mix(A, paper, 0.25)}"/><stop offset="1" stop-color="${color.mix(A, paper, 0.25)}" stop-opacity="0"/></radialGradient>${blur(`f${index}`, m * 0.05)}`;
    body += `<rect width="${w}" height="${h}" fill="url(#b${index})"/>`;
    body += `<circle cx="${w * (0.3 + r() * 0.4)}" cy="${h * 0.34}" r="${m * 0.42}" fill="url(#s${index})"/>`;
    const pw = w * 0.34;
    const px = w * (0.5 + (r() - 0.5) * 0.18) - pw / 2;
    body += `<rect x="${px}" y="${h * 0.38}" width="${pw}" height="${h * 0.72}" rx="${pw / 2}" fill="${color.mix(P, ink, 0.12)}" opacity=".9"/>`;
    body += `<rect x="${px + pw * 0.62}" y="${h * 0.52}" width="${pw * 0.9}" height="${h * 0.6}" rx="${pw * 0.45}" fill="${color.mix(P, paper, 0.12)}" opacity=".85"/>`;
    for (let i = 0; i < 4; i++) body += `<circle cx="${w * 0.5}" cy="${h * 1.05}" r="${m * (0.45 + i * 0.12)}" fill="none" stroke="#ffffff" stroke-opacity="${0.22 - i * 0.04}" stroke-width="${Math.max(1, m * 0.004)}"/>`;
  } else if (style === 'object') {
    const bg1 = color.mix(P, paper, 0.82);
    const bg2 = color.mix(A, paper, 0.7);
    defs += `<linearGradient id="b${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient><linearGradient id="o${index}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${color.mix(P, ink, 0.25)}"/><stop offset=".45" stop-color="${P}"/><stop offset=".62" stop-color="${color.mix(P, '#ffffff', 0.35)}"/><stop offset="1" stop-color="${color.mix(P, ink, 0.3)}"/></linearGradient>${blur(`f${index}`, m * 0.03)}`;
    body += `<rect width="${w}" height="${h}" fill="url(#b${index})"/>`;
    const ow = m * 0.36;
    const oh = m * 0.56;
    const ox = w / 2 - ow / 2 + (r() - 0.5) * w * 0.04;
    const oy = h * 0.5 - oh / 2 + h * 0.03;
    body += `<ellipse cx="${ox + ow / 2}" cy="${oy + oh + m * 0.02}" rx="${ow * 0.62}" ry="${m * 0.035}" fill="${ink}" opacity=".22" filter="url(#f${index})"/>`;
    body += `<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" rx="${ow * 0.16}" fill="url(#o${index})"/>`;
    body += `<rect x="${ox + ow * 0.12}" y="${oy - oh * 0.1}" width="${ow * 0.76}" height="${oh * 0.14}" rx="${ow * 0.06}" fill="${color.mix(ink, P, 0.25)}"/>`;
    body += `<rect x="${ox + ow * 0.18}" y="${oy + oh * 0.36}" width="${ow * 0.64}" height="${oh * 0.26}" rx="${ow * 0.04}" fill="${paper}" opacity=".92"/>`;
    body += `<rect x="${ox + ow * 0.28}" y="${oy + oh * 0.43}" width="${ow * 0.44}" height="${oh * 0.035}" rx="2" fill="${ink}" opacity=".7"/><rect x="${ox + ow * 0.34}" y="${oy + oh * 0.51}" width="${ow * 0.32}" height="${oh * 0.025}" rx="2" fill="${ink}" opacity=".35"/>`;
    body += `<circle cx="${w * 0.16}" cy="${h * 0.24}" r="${m * 0.05}" fill="${A}" opacity=".55"/><circle cx="${w * 0.86}" cy="${h * 0.7}" r="${m * 0.08}" fill="${P}" opacity=".25"/>`;
  } else if (style === 'grid') {
    const bg = color.mix(ink, '#000000', 0.2);
    defs += `<pattern id="p${index}" width="${m / 10}" height="${m / 10}" patternUnits="userSpaceOnUse"><path d="M${m / 10} 0H0V${m / 10}" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="1"/></pattern>${blur(`f${index}`, m * 0.12)}`;
    body += `<rect width="${w}" height="${h}" fill="${bg}"/><rect width="${w}" height="${h}" fill="url(#p${index})"/>`;
    body += `<g filter="url(#f${index})"><circle cx="${w * (0.6 + r() * 0.2)}" cy="${h * 0.35}" r="${m * 0.3}" fill="${P}" opacity=".75"/><circle cx="${w * 0.25}" cy="${h * 0.8}" r="${m * 0.24}" fill="${A}" opacity=".45"/></g>`;
    const cards = [
      [0.12, 0.2, 0.36, 0.2],
      [0.52, 0.48, 0.36, 0.3],
      [0.18, 0.56, 0.26, 0.16],
    ];
    cards.forEach(([x, y, cw, ch], i) => {
      body += `<rect x="${w * x}" y="${h * y}" width="${w * cw}" height="${h * ch}" rx="${m * 0.025}" fill="#ffffff" fill-opacity="${0.07 + i * 0.02}" stroke="#ffffff" stroke-opacity=".16"/>`;
      body += `<rect x="${w * x + m * 0.03}" y="${h * y + m * 0.035}" width="${w * cw * 0.45}" height="${m * 0.018}" rx="${m * 0.009}" fill="#ffffff" fill-opacity=".55"/>`;
      body += `<rect x="${w * x + m * 0.03}" y="${h * y + m * 0.075}" width="${w * cw * 0.7}" height="${m * 0.012}" rx="${m * 0.006}" fill="#ffffff" fill-opacity=".22"/>`;
    });
  } else if (style === 'tile') {
    const fields = [P, A, color.mix(P, ink, 0.45), color.mix(A, paper, 0.4), color.mix(P, paper, 0.55), color.mix(P, A, 0.5)];
    const bg = fields[index % fields.length];
    const fg = fields[(index + 2) % fields.length];
    const fg2 = color.mix(paper, bg, 0.15);
    body += `<rect width="${w}" height="${h}" fill="${bg}"/>`;
    const kind = index % 4;
    if (kind === 0) body += `<circle cx="${w * 0.62}" cy="${h * 0.42}" r="${m * 0.3}" fill="${fg}"/><circle cx="${w * 0.3}" cy="${h * 0.72}" r="${m * 0.12}" fill="${fg2}" opacity=".9"/>`;
    else if (kind === 1) body += `<path d="M0 ${h} A${w * 0.6} ${w * 0.6} 0 0 1 ${w * 1.2} ${h} Z" fill="${fg}"/><rect x="${w * 0.12}" y="${h * 0.14}" width="${m * 0.16}" height="${m * 0.16}" fill="${fg2}" opacity=".9"/>`;
    else if (kind === 2) {
      for (let i = 0; i < 6; i++) body += `<rect x="0" y="${h * (0.1 + i * 0.15)}" width="${w}" height="${h * 0.06}" fill="${i % 2 ? fg : fg2}" opacity="${i % 2 ? 0.85 : 0.5}"/>`;
    } else body += `<rect x="${w * 0.18}" y="${h * 0.18}" width="${w * 0.64}" height="${h * 0.64}" rx="${m * 0.32}" fill="${fg}"/><rect x="${w * 0.38}" y="${h * 0.38}" width="${w * 0.24}" height="${h * 0.24}" rx="${m * 0.12}" fill="${fg2}"/>`;
  } else {
    defs += `<linearGradient id="b${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color.mix(P, paper, 0.4)}"/><stop offset="1" stop-color="${color.mix(A, paper, 0.3)}"/></linearGradient>${blur(`f${index}`, m * 0.1)}`;
    body += `<rect width="${w}" height="${h}" fill="url(#b${index})"/>`;
    body += `<g filter="url(#f${index})"><circle cx="${w * (0.2 + r() * 0.3)}" cy="${h * (0.2 + r() * 0.3)}" r="${m * 0.3}" fill="${P}" opacity=".7"/><circle cx="${w * (0.6 + r() * 0.3)}" cy="${h * (0.5 + r() * 0.3)}" r="${m * 0.34}" fill="${A}" opacity=".6"/><circle cx="${w * 0.5}" cy="${h * 0.5}" r="${m * 0.2}" fill="${soft}" opacity=".8"/></g>`;
  }
  if (withGrain) body += g.use(w, h);
  else defs = defs.replace(g.defs, '');
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

module.exports = { placeholder, ogImage, favicon, dataUri, rng };
