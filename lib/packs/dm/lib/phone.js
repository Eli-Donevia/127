// A phone mockup of the funnel from the customer's side: their comment and your public reply, then
// the DM thread with your buttons, their tap, the link and the follow-up. Built from the approved
// messages, so it shows the member's real words. Returns an SVG string (inline in the guide, and a
// PNG preview in HQ when ffmpeg is available).

const { svg, text } = require('../../_kit');

const IG_BLUE = '#3797F0';
const GREY = '#EFEFEF';
const INK = '#111111';
const MUTED = '#737373';

const W = 840;
const PHONE_X = 50;
const PHONE_W = 740;
const SCREEN_X = PHONE_X + 22;
const SCREEN_W = PHONE_W - 44;
const PAD = 36;
const SIZE = 27;
const LH = 1.32;
const MAXB = 470;

function bubble(y, lines, { mine = false, fill, color, w } = {}) {
  const bw = Math.min(MAXB, Math.max(...lines.map((l) => svg.textWidth(l, SIZE, 400))) + 56);
  const bh = Math.round(lines.length * SIZE * LH + 38);
  const x = mine ? SCREEN_X + SCREEN_W - PAD - bw : SCREEN_X + PAD + 56;
  const out = svg.rect({ x, y, w: w || bw, h: bh, r: 30, fill }) + svg.text({ x: x + 28, y: y + 19 + SIZE, lines, size: SIZE, weight: 400, fill: color, lineHeight: LH });
  return { svg: out, h: bh, x, w: w || bw };
}

function avatar(cx, cy, r, initials, p) {
  return svg.circle({ cx, cy, r, fill: p.primary }) + svg.text({ x: cx, y: cy + r * 0.36, lines: [initials], size: Math.round(r * 0.95), weight: 700, fill: p.onPrimary, anchor: 'middle' });
}

// messages: from flow.messagesFrom(); facts: business, instagram; keyword.
function phoneSvg(messages, p, facts, keyword) {
  const handle = facts.instagram || text.slug(facts.business || 'yourbusiness', 24).replace(/-/g, '');
  const ini = text.initials(facts.business || handle);
  const parts = [];
  let y = 150;
  // Header
  parts.push(avatar(SCREEN_X + PAD + 34, y + 30, 34, ini, p));
  parts.push(svg.text({ x: SCREEN_X + PAD + 86, y: y + 22, lines: [text.clip(handle, 26)], size: 28, weight: 700, fill: INK }));
  parts.push(svg.text({ x: SCREEN_X + PAD + 86, y: y + 56, lines: ['Business chat'], size: 22, weight: 400, fill: MUTED }));
  y += 92;
  parts.push(svg.line({ x1: SCREEN_X, y1: y, x2: SCREEN_X + SCREEN_W, y2: y, stroke: '#DBDBDB', strokeWidth: 2 }));
  y += 34;

  const pub = messages.find((m) => m.type === 'public_reply');
  if (pub) {
    // The comment and the public reply, as a small card.
    const cardH = 150;
    parts.push(svg.rect({ x: SCREEN_X + PAD, y, w: SCREEN_W - PAD * 2, h: cardH, r: 26, fill: '#FAFAFA', stroke: '#E6E6E6', strokeWidth: 2 }));
    parts.push(svg.text({ x: SCREEN_X + PAD + 26, y: y + 44, lines: [text.clip(`Comments on ${handle}'s reel`, 40)], size: 21, weight: 600, fill: MUTED }));
    parts.push(svg.text({ x: SCREEN_X + PAD + 26, y: y + 84, lines: [`you: ${keyword}`], size: 25, weight: 600, fill: INK }));
    parts.push(svg.text({ x: SCREEN_X + PAD + 26, y: y + 122, lines: [text.clip(`${handle}: ${pub.texts[0]}`, 46)], size: 23, weight: 400, fill: '#363636' }));
    y += cardH + 40;
  }

  const dm = messages.filter((m) => m.type !== 'public_reply');
  if (!pub) {
    // Story reply: their reply starts the chat.
    const b = bubble(y, [`${keyword}`], { mine: true, fill: IG_BLUE, color: '#ffffff' });
    parts.push(svg.text({ x: b.x + b.w, y: y - 12, lines: ['Replied to your story'], size: 20, weight: 400, fill: MUTED, anchor: 'end' }));
    parts.push(b.svg);
    y += b.h + 34;
  }
  let first = true;
  for (const m of dm) {
    if (m.id === 'followUp') {
      parts.push(svg.text({ x: SCREEN_X + SCREEN_W / 2, y: y + 18, lines: ['About 20 hours later, if the link was not opened'], size: 20, weight: 500, fill: MUTED, anchor: 'middle' }));
      y += 50;
    }
    const lines = svg.wrap(text.clip(m.text, 220), { width: MAXB - 56, size: SIZE, weight: 400 }).slice(0, 7);
    const b = bubble(y, lines, { fill: GREY, color: INK });
    parts.push(svg.circle({ cx: SCREEN_X + PAD + 22, cy: y + b.h - 22, r: 22, fill: p.primary }));
    parts.push(svg.text({ x: SCREEN_X + PAD + 22, y: y + b.h - 14, lines: [ini.slice(0, 1)], size: 22, weight: 700, fill: p.onPrimary, anchor: 'middle' }));
    parts.push(b.svg);
    y += b.h + 8;
    const buttons = (m.buttons || []).slice(0, 3);
    for (const btn of buttons) {
      const bw = Math.max(b.w, 300);
      parts.push(svg.rect({ x: b.x, y, w: bw, h: 64, r: 20, fill: '#ffffff', stroke: '#DBDBDB', strokeWidth: 2 }));
      parts.push(svg.text({ x: b.x + bw / 2, y: y + 41, lines: [`${btn.title}${btn.action === 'url' ? '  >' : ''}`], size: 25, weight: 600, fill: IG_BLUE, anchor: 'middle' }));
      y += 72;
    }
    y += 22;
    // Their tap shows up as their own message.
    if (buttons.length && buttons[0].action === 'next' && first) {
      const t = bubble(y, [buttons[0].title], { mine: true, fill: IG_BLUE, color: '#ffffff' });
      parts.push(t.svg);
      y += t.h + 30;
    } else if (m.id === 'question' && buttons.length) {
      const t = bubble(y, [buttons[0].title], { mine: true, fill: IG_BLUE, color: '#ffffff' });
      parts.push(t.svg);
      y += t.h + 30;
    } else if (m.type === 'email_ask') {
      const t = bubble(y, ['you@email.example'], { mine: true, fill: IG_BLUE, color: '#ffffff' });
      parts.push(t.svg);
      y += t.h + 30;
    }
    if (m.id === 'opening') first = false;
  }
  y += 40;
  const screenH = y - 70;
  const H = y + 90;
  const phone = [
    svg.rect({ x: PHONE_X, y: 40, w: PHONE_W, h: H - 80, r: 96, fill: '#111214' }),
    svg.rect({ x: SCREEN_X, y: 62, w: SCREEN_W, h: screenH + 30, r: 76, fill: '#ffffff' }),
    svg.rect({ x: W / 2 - 80, y: 84, w: 160, h: 40, r: 20, fill: '#111214' }),
  ];
  return svg.doc({
    width: W,
    height: H,
    background: p.surface,
    defs: svg.linearGradient('pbg', [p.surface, p.paper], { x1: 0, y1: 0, x2: 0, y2: 1 }),
    title: `${facts.business || 'Your'} DM funnel preview`,
    body: `<rect width="${W}" height="${H}" fill="url(#pbg)"/>` + phone.join('') + parts.join(''),
  });
}

module.exports = { phoneSvg };
