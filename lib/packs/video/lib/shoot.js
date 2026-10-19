// A shoot plan for one short video: the shot list (what to film, how close, how long, what to say),
// the order to film it in (shots grouped by setup, so the phone moves as little as possible), gear,
// sound and light, and a permission note for anyone on camera. Plain rules of thumb, labelled as such.

const { text, files, color } = require('../../_kit');

const KINDS = ['Promo for my offer', 'How-to or tip', 'Behind the scenes', 'Customer story', 'Product close-ups'];
const FRAMINGS = ['Wide', 'Medium', 'Close-up', 'Detail', 'Over the shoulder', 'Screen'];
const FRAMING_HOW = {
  Wide: 'the whole place and you in it',
  Medium: 'you from the waist up',
  'Close-up': 'your face and shoulders',
  Detail: 'hands, tools or the product, filling the frame',
  'Over the shoulder': 'from behind you, looking at what you work on',
  Screen: 'a screen recording of your phone or computer',
};

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n * 10) / 10;

// "a free 20 minute reading check, then weekly sessions" -> "free 20 minute reading check"
function firstPart(s) {
  return String(s || '').split(/,|;|\bthen\b|\.\s/)[0].replace(/^(a|an|the|our|my)\s+/i, '').trim();
}

// Facts the lines can use. Only what the member typed or their brain holds.
function factsOf(b, input) {
  const site = String(b.website || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return {
    name: b.name || '',
    what: firstPart(b.what || ''),
    offer: firstPart(b.offer || ''),
    about: text.oneLine(input.about || ''),
    where: text.oneLine(input.where || ''),
    people: text.oneLine(input.people || ''),
    site,
    handle: b.instagram ? `@${String(b.instagram).replace(/^@/, '')}` : b.tiktok ? `@${String(b.tiktok).replace(/^@/, '')}` : '',
  };
}

// "how to read with your kid" -> "Here's how to read with your kid." Anything else: "A quick tip on ...".
function tipLine(f) {
  const a = String(f.about || '').replace(/[.!?]+$/, '');
  if (!a) return '';
  if (/^how\b/i.test(a)) return `Here's ${a[0].toLowerCase()}${a.slice(1)}`;
  return `A quick tip on ${a[0].toLowerCase()}${a.slice(1)}`;
}

// Shot templates per kind: [name, framing, seconds, setup, action, line(f), optional].
const T = {
  'Promo for my offer': [
    ['Hook', 'Close-up', 3, 'Tripod, facing you', 'Look into the lens and say the first line before you smile or move.', (f) => (f.offer ? `Have you tried our ${f.offer}?` : '')],
    ['The place', 'Wide', 3, 'Handheld, walking', 'Walk in slowly, phone at chest height, so people see where it happens.', () => ''],
    ['The work', 'Medium', 6, 'Handheld, at the work', 'Do the real work for about 20 seconds. You will only use the best few.', () => ''],
    ['Close detail', 'Detail', 3, 'Handheld, at the work', 'Get close: hands, tools or the finished piece. Move the phone slowly.', () => ''],
    ['What you get', 'Medium', 8, 'Tripod, facing you', 'Say what someone gets and who it is for, in one or two sentences.', (f) => (f.name && f.what ? `At ${f.name}, we do ${f.what}` : '')],
    ['Someone using it', 'Medium', 5, 'Handheld, at the work', 'A customer or friend using it, only with their written OK.', () => '', true],
    ['Call to action', 'Close-up', 4, 'Tripod, facing you', 'Say the one next step. Point down or to the side where the link will be.', (f) => (f.offer && f.site ? `Book your ${f.offer} at ${f.site}` : f.site ? `Book at ${f.site}` : f.offer ? `Book your ${f.offer}` : '')],
    ['Cutaways', 'Detail', 8, 'Handheld, at the work', 'Five short clips of small things (a door, a tool, a sign, a hand). They hide the cuts.', () => '', true],
  ],
  'How-to or tip': [
    ['Show the result first', 'Detail', 3, 'Handheld, at the work', 'Open on the finished result, so people know why to watch.', () => ''],
    ['Say what they will learn', 'Close-up', 4, 'Tripod, facing you', 'One sentence: what they will be able to do by the end.', tipLine],
    ['Step 1', 'Over the shoulder', 6, 'Tripod, behind you', 'Do the first step slowly and say what you are doing as you do it.', () => ''],
    ['Step 2', 'Over the shoulder', 6, 'Tripod, behind you', 'The second step. Keep your hands in the frame.', () => ''],
    ['Step 3', 'Detail', 6, 'Handheld, at the work', 'The last step, close. Hold still for 2 seconds at the end.', () => ''],
    ['The common mistake', 'Close-up', 5, 'Tripod, facing you', 'Say the one mistake you see most and how to avoid it.', () => '', true],
    ['Result and next step', 'Medium', 5, 'Tripod, facing you', 'Show the result again and say where to find more.', (f) => (f.handle ? `Follow ${f.handle} for the next one` : f.site ? `More at ${f.site}` : '')],
  ],
  'Behind the scenes': [
    ['Arrive', 'Wide', 3, 'Handheld, walking', 'Film the door, the lights going on or the first coffee.', () => ''],
    ['Set up', 'Medium', 5, 'Handheld, at the work', 'Lay out the tools for the job. Real mess is fine.', () => ''],
    ['Tools close', 'Detail', 3, 'Handheld, at the work', 'The two or three tools you use most, one at a time.', () => '', true],
    ['The work, sped up', 'Wide', 8, 'Tripod, to the side', 'Set the phone on a stand and film 5 to 10 minutes of work to speed up later.', () => ''],
    ['A tricky moment', 'Close-up', 5, 'Handheld, at the work', 'The fiddly part. Say what makes it tricky.', () => '', true],
    ['The finished piece', 'Detail', 4, 'Handheld, at the work', 'The result, slowly, in good light.', () => ''],
    ['Why you like it', 'Medium', 6, 'Tripod, facing you', 'One or two sentences on the part of the job you like.', () => ''],
    ['Call to action', 'Close-up', 3, 'Tripod, facing you', 'Say the one next step.', (f) => (f.site ? `See more at ${f.site}` : f.handle ? `Follow ${f.handle} to see the next one` : '')],
  ],
  'Customer story': [
    ['Who they are', 'Medium', 5, 'Tripod, facing them', 'They say their first name and what they needed, in their own words.', () => ''],
    ['Before', 'Detail', 3, 'Handheld', 'The problem as it was (only if they say yes to showing it).', () => ''],
    ['The work', 'Medium', 6, 'Handheld, at the work', 'You doing the work for them.', () => ''],
    ['What changed', 'Medium', 10, 'Tripod, facing them', 'Ask the 3 questions in the plan and let them answer. Do not give them lines.', () => ''],
    ['After', 'Detail', 3, 'Handheld', 'The result, close.', () => ''],
    ['You, thanking them', 'Close-up', 4, 'Tripod, facing you', 'One sentence about working with them.', () => '', true],
    ['Call to action', 'Close-up', 3, 'Tripod, facing you', 'Say the one next step.', (f) => (f.offer ? `Want the same? Book your ${f.offer}` : '')],
  ],
  'Product close-ups': [
    ['Hero shot', 'Detail', 3, 'Tripod, at the table', 'The product on a plain background by a window. Move the phone in slowly.', () => ''],
    ['In hand', 'Close-up', 3, 'Handheld, at the table', 'Hold it so people see its size.', () => ''],
    ['Detail one', 'Detail', 3, 'Handheld, at the table', 'The part people ask about most.', () => ''],
    ['Detail two', 'Detail', 3, 'Handheld, at the table', 'A second detail: texture, label or the inside.', () => '', true],
    ['In use', 'Medium', 6, 'Handheld, where it is used', 'Someone using it the way a customer would.', () => ''],
    ['Opening it', 'Detail', 5, 'Tripod, at the table', 'Open the box or bag as a customer would.', () => '', true],
    ['Where it lives', 'Wide', 4, 'Handheld, where it is used', 'The product in a real room or place.', () => ''],
    ['End card', 'Detail', 3, 'Tripod, at the table', 'The product still, with space around it for your words.', (f) => (f.site ? `Shop at ${f.site}` : '')],
  ],
};

const QUESTIONS = ['What did you need help with?', 'What was it like working with us?', 'What would you tell a friend who asked about it?'];

// Seconds scaled to add up to the target exactly (largest remainders get the spare seconds).
function fitSeconds(list, target, min = 2) {
  const base = list.reduce((n, x) => n + x, 0) || 1;
  const raw = list.map((x) => Math.max(min, (x * target) / base));
  const out = raw.map(Math.floor);
  let left = Math.round(target) - out.reduce((n, x) => n + x, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length, left--) out[order[k][1]] += 1;
  // Over the target (every shot needs its minimum): take a second from the longest shots.
  while (left < 0) {
    const i = out.indexOf(Math.max(...out));
    if (out[i] <= min) break;
    out[i] -= 1;
    left += 1;
  }
  return out;
}

// Shot list from the template for a kind, timed to the length. Under 25 seconds, the extra shots
// (marked optional) are left out so each shot still gets 2 seconds or more.
function templatePlan(kind, f, seconds) {
  const all = T[kind] || T[KINDS[0]];
  const rows = seconds < 25 ? all.filter((r) => !r[6]) : all;
  const secs = fitSeconds(rows.map((r) => r[2]), seconds);
  return rows.map(([name, framing, , setup, action, line], i) => ({ n: i + 1, name, framing, seconds: secs[i], setup, action, line: line(f) || '' }));
}

// "Wide shot", "extreme close up", "insert" -> one of FRAMINGS (Medium when it can't tell).
function framingOf(v) {
  const x = String(v || '');
  if (FRAMINGS.includes(x)) return x;
  if (/shoulder/i.test(x)) return 'Over the shoulder';
  if (/screen/i.test(x)) return 'Screen';
  if (/detail|insert|macro|extreme/i.test(x)) return 'Detail';
  if (/close/i.test(x)) return 'Close-up';
  if (/wide|establish|long/i.test(x)) return 'Wide';
  return 'Medium';
}

// Normalize shots (from AI or template): numbered, known framings, whole seconds, plain text.
function cleanShots(list) {
  return (list || [])
    .filter((s) => s && s.name)
    .slice(0, 10)
    .map((s, i) => ({
      n: i + 1,
      name: text.clip(text.oneLine(s.name), 40),
      framing: framingOf(s.framing),
      seconds: Math.max(1, Math.min(30, Math.round(Number(s.seconds) || 4))),
      setup: text.clip(text.oneLine(s.setup || 'Handheld'), 40),
      action: text.clip(text.oneLine(s.action || ''), 200),
      line: text.clip(text.oneLine(s.line || ''), 160),
    }));
}

// Shots grouped by setup in the order they first come up: film each group in one go.
function filmingOrder(shots) {
  const groups = [];
  for (const s of shots) {
    let g = groups.find((x) => x.setup.toLowerCase() === s.setup.toLowerCase());
    if (!g) groups.push((g = { setup: s.setup, shots: [] }));
    g.shots.push(s.n);
  }
  // A rule of thumb: about 5 minutes to set up, then 3 tries of each shot at about a minute each.
  return groups.map((g, i) => ({ step: i + 1, setup: g.setup, shots: g.shots, minutes: 5 + g.shots.length * 3 }));
}

const GEAR = [
  'Your phone, with the lens wiped clean (a shirt corner works)',
  'Something to hold it still: a tripod, or a stack of books and a mug',
  'Phone on airplane mode and do not disturb, so nothing rings mid-take',
  'Battery above half and a few GB of free space',
  'A clip-on mic if you have one; if not, keep the phone within arm\'s length when you talk',
];
const SOUND = [
  'Film talking shots in a room with soft things in it (curtains, a couch, a rug): bare rooms echo.',
  'Turn off fans, fridges you can hear and background music. Music goes in later.',
  'Before you start, record 5 seconds of the room with nobody talking: it helps the edit.',
];
const LIGHT = [
  'Face a window. A window behind you turns you into a shadow.',
  'Film everything in the same light, so the shots match.',
  'Tap and hold on your face (or the product) to lock focus and brightness on most phones.',
];
const BEFORE_POST = [
  'Use music you have the rights to: the sounds inside the app you post from, or a free library like YouTube\'s Audio Library.',
  'Add captions: most people watch with the sound off.',
  'Keep faces, names on screens and car plates out of the video unless their owners said yes.',
];

// "2026-10-24" -> "Saturday, October 24"
function dayName(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return '';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });
}

function consentText(f, date) {
  const when = dayName(date) ? ` on ${dayName(date)}` : '';
  return `Hi [name], I'm filming a short video for ${f.name || '[your business]'}${when}. Is it OK if you are in it, and if we post it on our website and social media? Reply yes if that's OK. If you ever want it taken down, just tell me.`;
}

// When the people on camera include children: the text for their parent.
const MINORS = /\b(kids?|child|children|son|daughter|students?|teens?|minors?|under 18|boy|girl|toddler|baby)\b/i;
function parentConsentText(f, date, people) {
  if (!MINORS.test(String(people || ''))) return '';
  const when = dayName(date) ? ` on ${dayName(date)}` : '';
  return `Hi [parent's name], I'm filming a short video for ${f.name || '[your business]'}${when} and would love to include [child's name]. Is it OK if they are in it, and if we post it on our website and social media? Reply yes if that's OK. If you ever want it taken down, just tell me.`;
}

function csvOf(plan) {
  return files.csv(
    plan.shots.map((s) => ({ n: s.n, shot: s.name, framing: s.framing, seconds: s.seconds, step: (plan.order.find((g) => g.shots.includes(s.n)) || {}).step || '', setup: s.setup, action: s.action, line: s.line, done: '' })),
    [
      { key: 'n', label: '#' },
      { key: 'shot', label: 'Shot' },
      { key: 'framing', label: 'How close' },
      { key: 'seconds', label: 'Seconds in the video' },
      { key: 'step', label: 'Film in step' },
      { key: 'setup', label: 'Setup' },
      { key: 'action', label: 'What to film' },
      { key: 'line', label: 'What to say' },
      { key: 'done', label: 'Done' },
    ],
    { bom: true },
  );
}

// ---------- storyboard ----------

// A simple drawing of how close a shot is, in a w x h frame.
function frameArt(framing, w, h, accent) {
  const m = Math.min(w, h);
  const fig = '#9aa3b5';
  const dark = '#6b7487';
  let s = `<rect width="${w}" height="${h}" fill="#e9ecf2"/>`;
  const thirds = `<g stroke="#ffffff" stroke-width="1.5" opacity="0.9"><line x1="${r1(w / 3)}" y1="0" x2="${r1(w / 3)}" y2="${h}"/><line x1="${r1((2 * w) / 3)}" y1="0" x2="${r1((2 * w) / 3)}" y2="${h}"/><line x1="0" y1="${r1(h / 3)}" x2="${w}" y2="${r1(h / 3)}"/><line x1="0" y1="${r1((2 * h) / 3)}" x2="${w}" y2="${r1((2 * h) / 3)}"/></g>`;
  const person = (cx, cy, r, color = fig) => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${color}"/><rect x="${r1(cx - r * 1.9)}" y="${r1(cy + r * 1.15)}" width="${r1(r * 3.8)}" height="${r1(r * 4)}" rx="${r1(r * 1.3)}" fill="${color}"/>`;
  if (framing === 'Wide') {
    s += `<rect y="${r1(h * 0.68)}" width="${w}" height="${r1(h * 0.32)}" fill="#d6dbe4"/>${thirds}`;
    const r = m * 0.05;
    s += `<circle cx="${r1(w / 2)}" cy="${r1(h * 0.68 - r * 6.2)}" r="${r1(r)}" fill="${fig}"/><rect x="${r1(w / 2 - r * 1.4)}" y="${r1(h * 0.68 - r * 5)}" width="${r1(r * 2.8)}" height="${r1(r * 5)}" rx="${r1(r)}" fill="${fig}"/>`;
    s += `<rect x="${r1(w * 0.12)}" y="${r1(h * 0.68 - m * 0.22)}" width="${r1(m * 0.22)}" height="${r1(m * 0.22)}" fill="#c9cfda"/><rect x="${r1(w * 0.72)}" y="${r1(h * 0.68 - m * 0.3)}" width="${r1(m * 0.18)}" height="${r1(m * 0.3)}" fill="#c9cfda"/>`;
  } else if (framing === 'Medium') {
    s += thirds + person(w / 2, h * 0.4, m * 0.12);
  } else if (framing === 'Close-up') {
    s += thirds + person(w / 2, h * 0.46, m * 0.23);
  } else if (framing === 'Detail') {
    // Something filling the frame, with focus corners: get close.
    const ow = Math.min(w * 0.7, h * 1.2);
    const oh = Math.min(h * 0.5, ow * 0.8);
    const ox = (w - ow) / 2;
    const oy = (h - oh) / 2;
    s += thirds + `<rect x="${r1(ox)}" y="${r1(oy)}" width="${r1(ow)}" height="${r1(oh)}" rx="${r1(m * 0.06)}" fill="${fig}"/><circle cx="${r1(w / 2)}" cy="${r1(h / 2)}" r="${r1(Math.min(ow, oh) * 0.26)}" fill="${accent}"/><circle cx="${r1(w / 2 - Math.min(ow, oh) * 0.08)}" cy="${r1(h / 2 - Math.min(ow, oh) * 0.08)}" r="${r1(Math.min(ow, oh) * 0.07)}" fill="#ffffff" opacity="0.55"/>`;
    const c = m * 0.1;
    const fx = ox - m * 0.05;
    const fy = oy - m * 0.05;
    const fw2 = ow + m * 0.1;
    const fh2 = oh + m * 0.1;
    s += `<g fill="none" stroke="${dark}" stroke-width="${r1(m * 0.018)}" stroke-linecap="round"><path d="M ${r1(fx)} ${r1(fy + c)} V ${r1(fy)} H ${r1(fx + c)}"/><path d="M ${r1(fx + fw2 - c)} ${r1(fy)} H ${r1(fx + fw2)} V ${r1(fy + c)}"/><path d="M ${r1(fx)} ${r1(fy + fh2 - c)} V ${r1(fy + fh2)} H ${r1(fx + c)}"/><path d="M ${r1(fx + fw2 - c)} ${r1(fy + fh2)} H ${r1(fx + fw2)} V ${r1(fy + fh2 - c)}"/></g>`;
  } else if (framing === 'Over the shoulder') {
    s += thirds + `<rect x="${r1(w * 0.5)}" y="${r1(h * 0.34)}" width="${r1(w * 0.36)}" height="${r1(m * 0.3)}" rx="${r1(m * 0.03)}" fill="${accent}" opacity="0.8"/>`;
    s += `<circle cx="${r1(w * 0.18)}" cy="${r1(h * 0.62)}" r="${r1(m * 0.2)}" fill="${dark}"/><rect x="${r1(-m * 0.2)}" y="${r1(h * 0.62 + m * 0.16)}" width="${r1(m * 0.8)}" height="${r1(h)}" rx="${r1(m * 0.2)}" fill="${dark}"/>`;
  } else {
    s += `<rect x="${r1(w * 0.3)}" y="${r1(h * 0.18)}" width="${r1(w * 0.4)}" height="${r1(h * 0.64)}" rx="${r1(m * 0.05)}" fill="#ffffff" stroke="${dark}" stroke-width="3"/>`;
    for (let i = 0; i < 5; i++) s += `<rect x="${r1(w * 0.35)}" y="${r1(h * 0.26 + i * h * 0.1)}" width="${r1(w * (i % 2 ? 0.22 : 0.3))}" height="${r1(h * 0.04)}" rx="3" fill="${i === 0 ? accent : '#c9cfda'}"/>`;
  }
  return s;
}

function wrapWords(str, maxChars) {
  const out = [];
  let cur = '';
  for (const w of String(str || '').split(/\s+/).filter(Boolean)) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

// The storyboard: every shot as a frame with how close it is, its time and its line.
function storyboardSvg(plan, { shape = 'vertical', accent = '#1f7a8c' } = {}) {
  const tall = shape === 'vertical';
  const cols = tall ? 5 : 4;
  const W = 2000;
  const pad = 60;
  const gap = 34;
  const fw = (W - pad * 2 - gap * (cols - 1)) / cols;
  const fh = tall ? fw * (16 / 9) : shape === 'square' ? fw : fw * (9 / 16);
  const capH = 220;
  const rows = Math.ceil(plan.shots.length / cols);
  const top = 170;
  const H = Math.round(top + rows * (fh + capH + gap) + 20);
  let body = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  body += `<text x="${pad}" y="84" font-family="Inter" font-weight="800" font-size="44" fill="#111827">${esc(text.clip(`Storyboard: ${plan.title}`, 80))}</text>`;
  body += `<text x="${pad}" y="134" font-family="Inter" font-weight="500" font-size="26" fill="#4b5563">${esc(`${plan.shots.length} shots, about ${plan.seconds} seconds, ${tall ? 'vertical 9:16' : shape === 'square' ? 'square' : 'wide 16:9'}. Grey shapes show how close to film.`)}</text>`;
  plan.shots.forEach((s, i) => {
    const x = pad + (i % cols) * (fw + gap);
    const y = top + Math.floor(i / cols) * (fh + capH + gap);
    body += `<g transform="translate(${r1(x)} ${r1(y)})"><clipPath id="f${i}"><rect width="${r1(fw)}" height="${r1(fh)}" rx="14"/></clipPath><g clip-path="url(#f${i})">${frameArt(s.framing, fw, fh, accent)}</g><rect width="${r1(fw)}" height="${r1(fh)}" rx="14" fill="none" stroke="#c3c9d5" stroke-width="2"/>`;
    body += `<circle cx="34" cy="34" r="22" fill="#111827" stroke="#ffffff" stroke-width="4"/><text x="34" y="43" text-anchor="middle" font-family="Inter" font-weight="800" font-size="24" fill="#ffffff">${s.n}</text>`;
    body += `<text x="0" y="${r1(fh + 40)}" font-family="Inter" font-weight="800" font-size="27" fill="#111827">${esc(text.clip(s.name, 26))}</text>`;
    body += `<text x="0" y="${r1(fh + 76)}" font-family="Inter" font-weight="600" font-size="23" fill="${color.darken(accent, 0.15)}">${esc(`${s.framing}, ${s.seconds} s`)}</text>`;
    const say = s.line ? `"${s.line}"` : s.action;
    wrapWords(say, tall ? 30 : 38).slice(0, 4).forEach((l, k) => {
      body += `<text x="0" y="${r1(fh + 110 + k * 28)}" font-family="Inter" font-weight="500" font-size="21" fill="#4b5563">${esc(l)}</text>`;
    });
    body += '</g>';
  });
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`, W, H };
}

// ---------- printable page ----------

function htmlOf(plan, { board } = {}) {
  const css = `
  :root { --ink:#111827; --soft:#4b5563; --line:#d9dde5; --accent:${plan.accent}; }
  * { box-sizing: border-box; }
  body { font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: var(--ink); margin: 0; background: #f5f6f8; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  main { max-width: 900px; margin: 0 auto; padding: 32px 28px 48px; background: #fff; }
  h1 { font-size: 30px; margin: 0 0 6px; }
  h2 { font-size: 19px; margin: 28px 0 10px; padding-top: 12px; border-top: 2px solid var(--ink); }
  .meta { color: var(--soft); margin: 0 0 18px; font-size: 15px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; vertical-align: top; padding: 8px 6px; border-bottom: 1px solid var(--line); }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--soft); }
  td.n { font-weight: 800; width: 28px; }
  td.box { width: 28px; } td.box span { display: inline-block; width: 16px; height: 16px; border: 2px solid var(--ink); border-radius: 3px; }
  .say { font-style: italic; }
  .tag { display: inline-block; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 99px; background: #eef1f6; }
  ul { margin: 6px 0 0; padding-left: 20px; } li { margin: 4px 0; }
  .order li { margin: 6px 0; }
  .note { background: #f3f6fb; border-left: 4px solid var(--accent); padding: 10px 14px; margin: 10px 0; font-size: 14px; }
  .copy { white-space: pre-wrap; background: #fff; border: 1px dashed var(--line); padding: 12px; font-size: 14px; }
  img.board { width: 100%; border: 1px solid var(--line); border-radius: 8px; margin-top: 6px; }
  ul.lines { list-style: none; padding-left: 0; } .lines li { margin: 8px 0; }
  .when { white-space: nowrap; }
  @media (max-width: 600px) {
    main { padding: 22px 16px 36px; }
    thead { display: none; }
    table, tbody, tr, td { display: block; width: 100%; }
    tr { position: relative; padding: 12px 34px 12px 30px; border-bottom: 1px solid var(--line); }
    td { border: 0; padding: 2px 0; }
    td.n { position: absolute; left: 0; top: 12px; width: auto; }
    td.box { position: absolute; right: 0; top: 12px; width: auto; }
    td.setup { color: var(--soft); font-size: 13px; }
    td.setup::before { content: "Setup: "; font-weight: 700; }
  }
  @media print { body { background: #fff; } main { padding: 0; } h2 { break-after: avoid; } tr, li, .copy, .note { break-inside: avoid; } img.board { break-before: page; } @page { size: letter; margin: 0.5in; } }
  `;
  const shots = plan.shots
    .map((s) => `<tr><td class="n">${s.n}</td><td class="shot"><strong>${esc(s.name)}</strong><br><span class="when"><span class="tag">${esc(s.framing)}</span> ${s.seconds} s</span></td><td class="what">${esc(s.action)}${s.line ? `<div class="say">"${esc(s.line)}"</div>` : ''}</td><td class="setup">${esc(s.setup)}</td><td class="box"><span></span></td></tr>`)
    .join('');
  const nameOf = (n) => (plan.shots.find((s) => s.n === n) || {}).name || '';
  const order = plan.order.map((g) => `<li><strong>${esc(g.setup)}</strong> (about ${g.minutes} minutes): ${g.shots.map((n) => `${n}. ${esc(nameOf(n))}`).join(', ')}</li>`).join('');
  const lines = plan.shots.filter((s) => s.line).map((s) => `<li><strong>Shot ${s.n}</strong> (${esc(s.name)}): ${esc(s.line)}</li>`).join('');
  const list = (xs) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const body = `<main>
<h1>${esc(plan.title)}</h1>
<p class="meta">${esc([`${plan.kind}`, `about ${plan.seconds} seconds`, plan.shapeLabel, plan.where ? `at ${plan.where}` : '', dayName(plan.date) ? `shoot day ${dayName(plan.date)}` : ''].filter(Boolean).join(' · '))}</p>
<div class="note">Film each shot 3 times and keep the best. Plan on about ${plan.shootMinutes} minutes of filming (a rule of thumb: 5 minutes per setup and 3 minutes per shot).</div>
<h2>Shot list</h2>
<table><thead><tr><th>#</th><th>Shot</th><th>What to film and say</th><th>Setup</th><th>Done</th></tr></thead><tbody>${shots}</tbody></table>
<h2>Film in this order</h2>
<ol class="order">${order}</ol>
<p class="meta">Shots that share a setup are filmed together, so the phone moves as little as possible. You put them back in story order when you edit.</p>
${lines ? `<h2>Lines to say</h2><ul class="lines">${lines}</ul><p class="meta">Say them your way. Read each one out loud twice before you film.</p>` : ''}
${plan.questions && plan.questions.length ? `<h2>Questions to ask on camera</h2>${list(plan.questions)}<p class="meta">Let them answer in their own words. Don't give them lines, and don't pay or give them anything for it unless the post says so.</p>` : ''}
<h2>Gear</h2>${list(plan.gear)}
<h2>Sound</h2>${list(plan.sound)}
<h2>Light</h2>${list(plan.light)}
<h2>Permission from anyone on camera</h2>
<p>Get a written yes before you film anyone but yourself (a text message is fine). For anyone under 18, ask a parent.</p>
<div class="copy">${esc(plan.consent)}</div>
${plan.consentParent ? `<p>For a child, ask a parent:</p><div class="copy">${esc(plan.consentParent)}</div>` : ''}
<h2>Before you post</h2>${list(plan.beforePost)}
${board ? `<h2>Storyboard</h2><img class="board" alt="Storyboard: ${plan.shots.length} frames showing how close to film each shot" src="data:image/jpeg;base64,${board.toString('base64')}">` : ''}
</main>`;
  return files.htmlDoc({ title: `Shoot plan: ${plan.title}`, css, body, description: `Shot list, filming order and checklist for ${plan.title}` });
}

module.exports = { KINDS, FRAMINGS, FRAMING_HOW, QUESTIONS, GEAR, SOUND, LIGHT, BEFORE_POST, dayName, factsOf, fitSeconds, framingOf, parentConsentText, templatePlan, cleanShots, filmingOrder, consentText, csvOf, storyboardSvg, htmlOf, frameArt };
