// Three 1080x1920 story frames in the member's colors: a dark hook frame, a light "what it is"
// frame and a bold call-to-action frame with the keyword in a pill and an arrow to the reply box.
// Text stays inside Instagram's safe area (clear of the top bar and the reply box). SVG strings;
// the frames tool turns them into PNGs and a short video when ffmpeg is available.

const { svg, color, text } = require('../../_kit');

const W = 1080;
const H = 1920;
const X = 96;
const INNER = W - X * 2;
const TOP = 300;

function radial(id, c, opacity = 0.5) {
  return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${svg.esc(c)}" stop-opacity="${opacity}"/><stop offset="100%" stop-color="${svg.esc(c)}" stop-opacity="0"/></radialGradient>`;
}

function kickerText(s) {
  return text.oneLine(s).toUpperCase().slice(0, 34);
}

function handleLine(f) {
  if (f.instagram) return `@${f.instagram}`;
  return f.business || '';
}

// Frame 1: the hook. Deep background, soft glow in the brand color, giant type.
function hookFrame(story, p, f) {
  const glowA = radial('g1', p.primary, 0.55);
  const glowB = radial('g2', p.accent, 0.28);
  const kicker = kickerText(story.kicker || f.business);
  const t = svg.fit(story.title, { width: INNER, height: 820, maxSize: 156, minSize: 72, maxLines: 5, weight: 800, lineHeight: 1.04 });
  const titleY = 560 + t.size * 0.78;
  const lines = (story.lines || []).slice(0, 2);
  const linesY = titleY + t.lines.length * t.size * 1.04 + 40;
  const soft = color.mix(p.primary, '#ffffff', 0.55);
  return svg.doc({
    width: W,
    height: H,
    background: p.deep,
    defs: glowA + glowB,
    title: story.title,
    body: [
      `<circle cx="930" cy="330" r="720" fill="url(#g1)"/>`,
      `<circle cx="80" cy="1760" r="640" fill="url(#g2)"/>`,
      svg.text({ x: X, y: TOP + 40, lines: [kicker], size: 30, weight: 700, fill: soft, letterSpacing: 6, font: svg.FONTS.sans }),
      svg.rect({ x: X, y: TOP + 78, w: 84, h: 8, r: 4, fill: p.primary }),
      svg.text({ x: X, y: titleY, lines: t.lines, size: t.size, weight: 800, fill: '#ffffff', font: svg.FONTS.display, lineHeight: 1.04, letterSpacing: -2 }),
      lines.length ? svg.text({ x: X, y: linesY + 44, lines: lines.map((l) => text.clip(l, 40)), size: 46, weight: 500, fill: '#ffffff', opacity: 0.82, lineHeight: 1.3 }) : '',
      svg.line({ x1: X, y1: 1478, x2: X + INNER, y2: 1478, stroke: '#ffffff', strokeWidth: 2, opacity: 0.18 }),
      svg.text({ x: X, y: 1536, lines: [handleLine(f)], size: 32, weight: 600, fill: '#ffffff', opacity: 0.72 }),
      svg.text({ x: X + INNER, y: 1536, lines: ['1 / 3'], size: 30, weight: 600, fill: '#ffffff', opacity: 0.5, anchor: 'end' }),
    ].join(''),
  });
}

// Frame 2: what it is. Light paper, big ink title, numbered cards.
function listFrame(story, p, f) {
  const kicker = kickerText(story.kicker || 'What it is');
  const t = svg.fit(story.title, { width: INNER, height: 380, maxSize: 118, minSize: 64, maxLines: 3, weight: 800, lineHeight: 1.05 });
  const titleY = TOP + 150 + t.size * 0.78;
  let y = titleY + (t.lines.length - 1) * t.size * 1.05 + 110;
  const cards = [];
  const items = (story.lines || []).slice(0, 3);
  const numFill = p.primary;
  items.forEach((line, i) => {
    // 46px on up to 2 lines; a longer line drops to 38px on up to 3 so no words go missing.
    let size = 46;
    let wrapped = svg.wrap(text.clip(String(line).charAt(0).toUpperCase() + String(line).slice(1), 90), { width: INNER - 220, size, weight: 600 });
    if (wrapped.length > 2) {
      size = 38;
      wrapped = svg.wrap(text.clip(String(line).charAt(0).toUpperCase() + String(line).slice(1), 90), { width: INNER - 220, size, weight: 600 }).slice(0, 3);
    }
    const h = Math.max(160, Math.round(wrapped.length * size * 1.22 + 98));
    cards.push(svg.rect({ x: X, y, w: INNER, h, r: 40, fill: '#ffffff', stroke: p.line, strokeWidth: 2 }));
    cards.push(svg.circle({ cx: X + 92, cy: y + h / 2, r: 48, fill: numFill }));
    cards.push(svg.text({ x: X + 92, y: y + h / 2 + 17, lines: [String(i + 1)], size: 48, weight: 800, fill: p.onPrimary, anchor: 'middle', font: svg.FONTS.display }));
    cards.push(svg.text({ x: X + 176, y: y + h / 2 + size * 0.35 - ((wrapped.length - 1) * size * 1.22) / 2, lines: wrapped, size, weight: 600, fill: p.ink, lineHeight: 1.22 }));
    y += h + 32;
  });
  return svg.doc({
    width: W,
    height: H,
    background: p.paper,
    defs: radial('g3', p.primary, 0.14),
    title: story.title,
    body: [
      `<circle cx="1010" cy="1820" r="700" fill="url(#g3)"/>`,
      svg.text({ x: X, y: TOP + 40, lines: [kicker], size: 30, weight: 700, fill: color.ensureContrast(p.primary, p.paper, 4.5), letterSpacing: 6 }),
      svg.text({ x: X, y: titleY, lines: t.lines, size: t.size, weight: 800, fill: p.ink, font: svg.FONTS.display, lineHeight: 1.05, letterSpacing: -2 }),
      ...cards,
      svg.text({ x: X, y: 1536, lines: [handleLine(f)], size: 32, weight: 600, fill: p.muted }),
      svg.text({ x: X + INNER, y: 1536, lines: ['2 / 3'], size: 30, weight: 600, fill: p.muted, anchor: 'end' }),
    ].join(''),
  });
}

// Frame 3: the ask. Brand color background, "Reply" and the keyword in a white pill, an arrow
// pointing at Instagram's reply box.
function ctaFrame(story, p, f, keyword) {
  const bg = p.primary;
  const on = p.onPrimary;
  const deeper = color.darken(bg, 0.18);
  const K = String(keyword || '').toUpperCase();
  const kicker = text.oneLine(story.kicker || 'Want it?');
  // Keyword size: as big as fits in the pill.
  let ks = 190;
  while (ks > 90 && svg.textWidth(K, ks, 800) > INNER - 140) ks -= 6;
  const pillW = Math.min(INNER, Math.round(svg.textWidth(K, ks, 800) + 150));
  const pillH = Math.round(ks * 1.42);
  const pillX = Math.round((W - pillW) / 2);
  const pillY = 840;
  const kColor = color.ensureContrast(color.darken(bg, 0.05), '#ffffff', 4.5);
  const sub = (story.lines || [])[0] || '';
  const subLines = svg.wrap(sub, { width: INNER, size: 54, weight: 500 }).slice(0, 2);
  return svg.doc({
    width: W,
    height: H,
    background: bg,
    defs: svg.linearGradient('g4', [bg, deeper], { x1: 0, y1: 0, x2: 1, y2: 1 }) + radial('g5', '#ffffff', 0.16),
    title: `Reply ${K}`,
    body: [
      `<rect width="${W}" height="${H}" fill="url(#g4)"/>`,
      `<circle cx="540" cy="960" r="760" fill="url(#g5)"/>`,
      svg.text({ x: W / 2, y: 560, lines: [kicker], size: 56, weight: 600, fill: on, opacity: 0.86, anchor: 'middle' }),
      svg.text({ x: W / 2, y: 770, lines: ['Reply'], size: 176, weight: 800, fill: on, anchor: 'middle', font: svg.FONTS.display, letterSpacing: -4 }),
      svg.rect({ x: pillX, y: pillY, w: pillW, h: pillH, r: pillH / 2, fill: '#ffffff' }),
      svg.text({ x: W / 2, y: pillY + pillH / 2 + ks * 0.36, lines: [K], size: ks, weight: 800, fill: kColor, anchor: 'middle', font: svg.FONTS.display, letterSpacing: 2 }),
      subLines.length ? svg.text({ x: W / 2, y: pillY + pillH + 130, lines: subLines, size: 54, weight: 500, fill: on, anchor: 'middle', lineHeight: 1.25, opacity: 0.94 }) : '',
      svg.path({ d: `M540 1330 L540 1500 M470 1432 L540 1502 L610 1432`, stroke: on, strokeWidth: 12, linecap: 'round', linejoin: 'round', opacity: 0.9 }),
      svg.text({ x: W / 2, y: 1590, lines: [handleLine(f)], size: 32, weight: 600, fill: on, opacity: 0.75, anchor: 'middle' }),
    ].join(''),
  });
}

function storyFrames(stories, palette, facts, keyword) {
  const s = stories || [];
  return [hookFrame(s[0] || { title: 'Want it?' }, palette, facts), listFrame(s[1] || { title: facts.thing || 'What it is', lines: [] }, palette, facts), ctaFrame(s[2] || { title: `Reply ${keyword}` }, palette, facts, keyword)];
}

module.exports = { storyFrames, hookFrame, listFrame, ctaFrame, W, H };
