// Product illustrations for sample stores (and for real products that have no photo yet): a soft
// studio backdrop, a floor shadow and a simple, recognizable object in the store's colors. Pure SVG,
// so it works in HTML, in the video frames and in tests. Sample images are written as
// "sample-art:<kind>:<seed>" and turned into data URIs here.

const { color, text } = require('../../_kit');

const SHAPE = {
  candle: 'jar', melt: 'cubes', giftset: 'box', kit: 'box', box: 'box', matches: 'tall', trimmer: 'tool', mug: 'mug', towel: 'fold', throw: 'fold',
  jar: 'jar', hoops: 'hoops', ring: 'hoops', card: 'flat', print: 'flat', notebook: 'flat', tag: 'flat', ribbon: 'flat', spoon: 'tool', brush: 'tool',
  opener: 'tool', poles: 'tool', tote: 'bag', pack: 'bag', dish: 'dish', coaster: 'dish', taper: 'tall', vase: 'tall', diffuser: 'tall', bottle: 'bottle',
  lamp: 'bottle', sachet: 'cubes', puzzle: 'cubes', scrunchie: 'hoops', flowers: 'plant', planter: 'plant', tin: 'tin', bar: 'tin', basket: 'dish',
  beanie: 'fold', shirt: 'shirt', sweater: 'shirt', dress: 'shirt', jacket: 'shirt', pants: 'fold', belt: 'hoops', socks: 'fold', scarf: 'fold',
  hammock: 'fold', board: 'flat', bag: 'bag',
};

function tones(seed, palette) {
  const p = palette || color.palette('warm');
  const h = text.hash(seed);
  const hues = [p.accent, p.primary, color.mix(p.accent, '#c9a27a', 0.5), color.mix(p.primary, '#9fb8a8', 0.5)];
  const main = hues[h % hues.length];
  return {
    bg1: color.mix(p.paper || '#faf7f2', main, 0.1),
    bg2: color.mix(p.surface || '#efe9e1', main, 0.22),
    main,
    dark: color.darken(main, 0.35),
    light: color.lighten(main, 0.55),
    glass: color.mix('#c98a3a', main, 0.25),
    paper: '#fbf8f3',
    ink: p.ink || '#2a2420',
  };
}

function object(shape, c) {
  switch (shape) {
    case 'jar':
      return `<rect x="205" y="250" width="190" height="230" rx="34" fill="${c.glass}" opacity="0.92"/>
<rect x="205" y="250" width="190" height="230" rx="34" fill="url(#shine)"/>
<rect x="222" y="262" width="156" height="34" rx="12" fill="${c.paper}" opacity="0.9"/>
<rect x="232" y="330" width="136" height="92" rx="8" fill="${c.paper}"/>
<rect x="252" y="352" width="96" height="10" rx="5" fill="${c.dark}"/>
<rect x="266" y="374" width="68" height="7" rx="3.5" fill="${c.main}" opacity="0.7"/>
<rect x="274" y="392" width="52" height="6" rx="3" fill="${c.main}" opacity="0.45"/>
<rect x="298" y="226" width="4" height="38" rx="2" fill="#3b2f2a"/>
<path d="M300 170 C318 196 318 214 300 228 C282 214 282 196 300 170 Z" fill="#f4b23c"/>
<path d="M300 192 C308 204 308 214 300 222 C292 214 292 204 300 192 Z" fill="#fff3c4"/>
<circle cx="300" cy="206" r="54" fill="url(#glow)"/>`;
    case 'cubes':
      return [0, 1, 2]
        .flatMap((r) => [0, 1].map((col) => `<rect x="${222 + col * 82}" y="${300 + r * 62 - col * 10}" width="74" height="56" rx="12" fill="${r % 2 ? c.light : c.main}" opacity="${0.85 + col * 0.1}"/>`))
        .join('\n');
    case 'box':
      return `<rect x="170" y="290" width="260" height="190" rx="10" fill="${c.main}"/>
<rect x="160" y="262" width="280" height="56" rx="10" fill="${c.dark}"/>
<rect x="286" y="262" width="28" height="218" fill="${c.light}"/>
<path d="M300 262 C268 214 232 226 252 252 C262 264 286 262 300 262 C314 262 338 264 348 252 C368 226 332 214 300 262 Z" fill="${c.light}"/>`;
    case 'tall':
      return `<rect x="258" y="190" width="84" height="290" rx="18" fill="${c.main}"/>
<rect x="270" y="210" width="20" height="250" rx="10" fill="#ffffff" opacity="0.25"/>
<rect x="272" y="168" width="56" height="30" rx="8" fill="${c.dark}"/>`;
    case 'tool':
      return `<rect x="290" y="170" width="20" height="250" rx="10" fill="${c.dark}" transform="rotate(-18 300 300)"/>
<ellipse cx="300" cy="420" rx="54" ry="64" fill="${c.main}" transform="rotate(-18 300 300)"/>`;
    case 'mug':
      return `<path d="M392 318 C452 318 452 410 392 410" fill="none" stroke="${c.dark}" stroke-width="22"/>
<rect x="200" y="280" width="200" height="200" rx="30" fill="${c.main}"/>
<ellipse cx="300" cy="284" rx="100" ry="16" fill="${c.dark}"/>
<circle cx="250" cy="350" r="5" fill="#ffffff" opacity="0.5"/><circle cx="330" cy="410" r="4" fill="#ffffff" opacity="0.45"/><circle cx="292" cy="380" r="3" fill="#ffffff" opacity="0.5"/>`;
    case 'fold':
      return `<rect x="160" y="400" width="280" height="70" rx="14" fill="${c.dark}"/>
<rect x="160" y="340" width="280" height="70" rx="14" fill="${c.main}"/>
<rect x="160" y="280" width="280" height="70" rx="14" fill="${c.light}"/>
<rect x="160" y="300" width="280" height="8" fill="${c.main}" opacity="0.5"/><rect x="160" y="362" width="280" height="8" fill="${c.light}" opacity="0.5"/>`;
    case 'hoops':
      return `<circle cx="248" cy="350" r="70" fill="none" stroke="${c.main}" stroke-width="16"/>
<circle cx="356" cy="370" r="70" fill="none" stroke="${c.dark}" stroke-width="16"/>`;
    case 'flat':
      return `<rect x="190" y="200" width="220" height="280" rx="6" fill="${c.paper}" transform="rotate(-4 300 340)"/>
<rect x="190" y="200" width="220" height="280" rx="6" fill="none" stroke="${c.light}" stroke-width="2" transform="rotate(-4 300 340)"/>
<path d="M214 420 L270 330 L304 380 L338 318 L392 420 Z" fill="${c.main}" transform="rotate(-4 300 340)"/>
<circle cx="360" cy="262" r="20" fill="${c.light}" transform="rotate(-4 300 340)"/>`;
    case 'bag':
      return `<path d="M246 300 C246 220 354 220 354 300" fill="none" stroke="${c.dark}" stroke-width="14"/>
<path d="M190 300 L410 300 L432 480 L168 480 Z" fill="${c.main}"/>
<rect x="250" y="360" width="100" height="56" rx="6" fill="${c.light}" opacity="0.7"/>`;
    case 'dish':
      return `<ellipse cx="300" cy="400" rx="150" ry="52" fill="${c.dark}"/>
<ellipse cx="300" cy="390" rx="150" ry="52" fill="${c.main}"/>
<ellipse cx="300" cy="384" rx="112" ry="36" fill="${c.light}"/>`;
    case 'bottle':
      return `<rect x="236" y="250" width="128" height="230" rx="30" fill="${c.main}"/>
<rect x="276" y="190" width="48" height="70" rx="10" fill="${c.dark}"/>
<rect x="252" y="320" width="96" height="86" rx="8" fill="${c.paper}"/>
<rect x="266" y="344" width="68" height="9" rx="4.5" fill="${c.dark}"/>`;
    case 'plant':
      return `<path d="M300 300 C260 240 230 230 214 250 C236 252 260 268 300 320 Z" fill="${c.light}"/>
<path d="M300 300 C340 220 380 214 396 232 C372 238 340 262 300 324 Z" fill="${c.main}"/>
<path d="M300 320 C292 250 300 214 312 200 C316 236 312 272 306 320 Z" fill="${c.dark}"/>
<path d="M226 330 L374 330 L352 480 L248 480 Z" fill="#b86f4b"/>`;
    case 'tin':
      return `<rect x="170" y="350" width="260" height="120" rx="20" fill="${c.main}"/>
<rect x="164" y="336" width="272" height="34" rx="14" fill="${c.dark}"/>
<rect x="236" y="390" width="128" height="48" rx="6" fill="${c.paper}"/>`;
    case 'shirt':
      return `<path d="M232 210 L198 222 L150 290 L196 320 L214 296 L214 480 L386 480 L386 296 L404 320 L450 290 L402 222 L368 210 C356 240 244 240 232 210 Z" fill="${c.main}"/>
<path d="M262 214 C276 236 324 236 338 214" fill="none" stroke="${c.dark}" stroke-width="6"/>`;
    default:
      return `<circle cx="300" cy="360" r="110" fill="${c.main}"/>`;
  }
}

// kind: candle, mug, ... ; seed varies the color; size in px (square).
function productSvg(kind, seed, { palette, size = 600, label } = {}) {
  const c = tones(`${kind}:${seed}`, palette);
  const shape = SHAPE[kind] || 'box';
  const tag = label ? `<text x="300" y="560" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" fill="${c.ink}" opacity="0.55">${String(label).replace(/[<&>]/g, '')}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 600 600">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.bg1}"/><stop offset="1" stop-color="${c.bg2}"/></linearGradient>
<linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="0.35" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.12"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.45"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
<radialGradient id="floor"><stop offset="0" stop-color="#000000" stop-opacity="0.18"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
</defs>
<rect width="600" height="600" fill="url(#bg)"/>
<ellipse cx="300" cy="488" rx="190" ry="26" fill="url(#floor)"/>
${object(shape, c)}
${tag}
</svg>`;
}

function dataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

// "sample-art:candle:juniper-3" -> a data URI; anything else passes through.
function resolveImage(src, { palette, size = 600 } = {}) {
  const m = String(src || '').match(/^sample-art:([a-z]+):(.+)$/);
  if (!m) return src || null;
  return dataUri(productSvg(m[1], m[2], { palette, size }));
}

const isSampleArt = (src) => /^sample-art:/.test(String(src || ''));

module.exports = { productSvg, dataUri, resolveImage, isSampleArt, SHAPE };
