// Kinetic-text scenes for promos and faceless shorts. A script is plain lines a member can edit:
//   HOOK: Homework fights every night?
//   OFFER: Bright Path Tutoring | Math and reading, grades 3 to 8
//   POINT: One on one, in person or online
//   PRICE: From $45 a session
//   LINE: (faceless) one spoken line shown big
//   CTA: Book a free 20 minute reading check | brightpathtutoring.example
// Each scene animates in (words rise into place, titles pop, points slide in with a check) and out.

const { media, text } = require('../../_kit');

const TYPES = ['HOOK', 'OFFER', 'POINT', 'PRICE', 'LINE', 'CTA'];

// Every labelled line of a script, in order (POINT lines not merged yet).
function lineList(script) {
  const out = [];
  for (const raw of String(script || '').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Za-z]+)\s*:\s*(.+)$/);
    if (!m) continue;
    const type = m[1].toUpperCase();
    if (!TYPES.includes(type)) continue;
    const [main, sub] = m[2].split('|').map((x) => text.oneLine(x));
    if (main) out.push({ type, text: main, sub: sub || '' });
  }
  return out;
}

// What a voice says for one line: the offer's name and what it is; never a web address or handle.
function spokenOf(line) {
  const t = line.type === 'OFFER' && line.sub ? `${line.text}. ${line.sub}` : line.text;
  return String(t).replace(/\s+/g, ' ').trim().replace(/([^.!?])$/, '$1.');
}

function parse(script) {
  const out = lineList(script);
  // Points that follow each other share one scene (up to 3).
  const scenes = [];
  for (const s of out) {
    const last = scenes[scenes.length - 1];
    if (s.type === 'POINT' && last && last.type === 'POINT' && last.items.length < 3) last.items.push(s.text);
    else scenes.push(s.type === 'POINT' ? { type: 'POINT', items: [s.text] } : s);
  }
  return scenes;
}

function words(s) {
  return String(s || '').split(/\s+/).filter(Boolean).length;
}

// Seconds per scene for a total length, by how much there is to read.
function timeline(scenes, total) {
  const need = scenes.map((s) => {
    if (s.type === 'POINT') return 1.2 + s.items.reduce((n, i) => n + 0.35 + words(i) * 0.28, 0);
    const base = { HOOK: 1.6, OFFER: 1.8, PRICE: 1.6, LINE: 1.1, CTA: 2.4 }[s.type] || 1.5;
    return base + words(s.text) * 0.24 + words(s.sub) * 0.18;
  });
  const sum = need.reduce((a, b) => a + b, 0);
  const k = total ? total / sum : 1;
  let t = 0;
  return scenes.map((s, i) => {
    const d = Math.max(1.4, need[i] * k);
    const out = { ...s, start: t, end: t + d };
    t += d;
    return out;
  });
}

const ff = (n) => Math.round(n * 10) / 10;

function wrap(str, size, maxW, weight) {
  const ws = String(str || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = [];
  for (const w of ws) {
    const next = [...cur, w].join(' ');
    if (cur.length && media.textWidth(next, size, { weight, mode: 'ass' }) > maxW) {
      lines.push(cur);
      cur = [w];
    } else cur.push(w);
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function fit(str, { maxW, max, min, maxLines, weight }) {
  for (let size = max; size >= min; size -= 4) {
    const lines = wrap(str, size, maxW, weight);
    if (lines.length <= maxLines) return { size, lines };
  }
  return { size: min, lines: wrap(str, min, maxW, weight) };
}

// The word to color: the longest word that isn't a filler.
function keyWord(lines) {
  const all = lines.flat();
  const skip = /^(the|and|for|with|your|you|this|that|from|into|every|still|what|when|our|are|was|have|has)$/i;
  let best = -1;
  let len = 0;
  all.forEach((w, i) => {
    const c = w.replace(/[^A-Za-z0-9$]/g, '');
    if (!skip.test(c) && c.length > len) {
      best = i;
      len = c.length;
    }
  });
  return best;
}

// ASS events for all scenes. W, H: frame; look: video colors.
function sceneEvents(scenes, { W = 1080, H = 1920, look, brand, watermark }) {
  const u = Math.min(W, H) / 1080;
  const tall = H > W;
  const ev = [];
  const C = (hex) => media.assTagColor(hex);
  const add = (layer, s, e, body, txt = '') => ev.push(media.assEvent({ layer, start: s, end: e, style: 'K', text: `{${body}}${txt}` }));
  const maxW = (tall ? 880 : W * 0.7) * u;
  const cy = tall ? H * 0.47 : H * 0.5;
  for (const sc of scenes) {
    const s = sc.start;
    const e = sc.end;
    const out = Math.max(0, (e - s) * 1000 - 220);
    const fadeOut = `\\t(${Math.round(out)},${Math.round(out + 200)},\\alpha&HFF&)`;
    if (sc.type === 'HOOK' || sc.type === 'LINE' || sc.type === 'CTA' || sc.type === 'OFFER' || sc.type === 'PRICE') {
      const weight = 900;
      const big = sc.type === 'HOOK' || sc.type === 'LINE' ? 118 : sc.type === 'OFFER' ? 104 : 96;
      const { size, lines } = fit(sc.type === 'HOOK' || sc.type === 'LINE' ? sc.text.toUpperCase() : sc.text, { maxW, max: big * u, min: 56 * u, maxLines: tall ? 4 : 3, weight });
      const lh = size * 0.98;
      const blockH = lines.length * lh;
      let top = cy - blockH / 2 - (sc.sub ? 40 * u : 0);
      if (sc.type === 'OFFER' && brand) {
        // kicker: the brand name, small and spaced, above the title
        add(3, s, e, `\\an5\\pos(${ff(W / 2)},${ff(top - 70 * u)})\\fnInter Bold\\fs${ff(38 * u)}\\fsp${ff(6 * u)}\\bord0\\shad0\\c${C(look.pop)}\\alpha&HFF&\\t(0,260,\\alpha&H00&)${fadeOut}`, media.assText(brand.toUpperCase()));
      }
      const key = sc.type === 'HOOK' || sc.type === 'LINE' ? keyWord(lines) : -1;
      let k = 0;
      lines.forEach((line, li) => {
        const widths = line.map((w) => media.textWidth(w, size, { weight, mode: 'ass' }));
        const space = media.textWidth(' ', size, { weight, mode: 'ass' }) + size * 0.06;
        const lw = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
        let x = W / 2 - lw / 2;
        const y = top + li * lh + lh / 2;
        line.forEach((w, wi) => {
          const cx = x + widths[wi] / 2;
          const delay = Math.round((sc.type === 'OFFER' || sc.type === 'PRICE' || sc.type === 'CTA' ? 0 : k * 85) + 60);
          const col = k === key ? C(look.pop) : '&HFFFFFF&';
          const anim = sc.type === 'OFFER' || sc.type === 'PRICE' ? `\\pos(${ff(cx)},${ff(y)})\\fscx70\\fscy70\\alpha&HFF&\\t(${delay},${delay + 160},\\fscx106\\fscy106\\alpha&H00&)\\t(${delay + 160},${delay + 280},\\fscx100\\fscy100)` : `\\move(${ff(cx)},${ff(y + 46 * u)},${ff(cx)},${ff(y)},${delay},${delay + 260})\\alpha&HFF&\\t(${delay},${delay + 200},\\alpha&H00&)`;
          add(4, s, e, `\\an5${anim}\\fnInter Black\\fs${ff(size)}\\bord${ff(4 * u)}\\3c${C(look.outline)}\\shad${ff(5 * u)}\\4c&H000000&\\4a&H90&\\c${col}${fadeOut}`, media.assText(w));
          x += widths[wi] + space;
          k++;
        });
      });
      const below = top + blockH;
      if (sc.type === 'OFFER') {
        // underline that wipes in under the title
        const bw = Math.min(maxW, 360 * u);
        const bx = W / 2 - bw / 2;
        const by = below + 26 * u;
        add(3, s, e, `\\an7\\pos(${ff(bx)},${ff(by)})\\bord0\\shad0\\c${C(look.pop)}\\clip(${ff(bx)},${ff(by - 2)},${ff(bx)},${ff(by + 14 * u)})\\t(250,600,\\clip(${ff(bx)},${ff(by - 2)},${ff(bx + bw)},${ff(by + 14 * u)}))${fadeOut}\\p1`, `${media.assRoundRect(bw, 12 * u, 6 * u)}{\\p0}`);
      }
      if (sc.sub) {
        const subY = below + (sc.type === 'OFFER' ? 96 : 70) * u;
        if (sc.type === 'CTA') {
          const fs0 = 46 * u;
          const tw = media.textWidth(sc.sub, fs0, { weight: 800, mode: 'ass' });
          const bw = tw + 90 * u;
          const bh = 104 * u;
          const pulse = '\\t(900,1150,\\fscx104\\fscy104)\\t(1150,1400,\\fscx100\\fscy100)\\t(2200,2450,\\fscx104\\fscy104)\\t(2450,2700,\\fscx100\\fscy100)';
          add(5, s, e, `\\an5\\pos(${ff(W / 2)},${ff(subY + bh / 2)})\\bord0\\shad${ff(6 * u)}\\4a&H90&\\c${C(look.box)}\\fscx80\\fscy80\\alpha&HFF&\\t(300,480,\\fscx100\\fscy100\\alpha&H00&)${pulse}${fadeOut}\\p1`, `${media.assRoundRect(bw, bh, bh / 2)}{\\p0}`);
          add(6, s, e, `\\an5\\pos(${ff(W / 2)},${ff(subY + bh / 2)})\\fnInter ExtraBold\\fs${ff(fs0)}\\bord0\\shad0\\c${C(look.onBox)}\\fscx80\\fscy80\\alpha&HFF&\\t(300,480,\\fscx100\\fscy100\\alpha&H00&)${pulse}${fadeOut}`, media.assText(sc.sub));
        } else {
          const subLines = fit(sc.sub, { maxW, max: 50 * u, min: 34 * u, maxLines: 3, weight: 600 }).lines;
          subLines.forEach((l, i) => add(4, s, e, `\\an5\\move(${ff(W / 2)},${ff(subY + i * 60 * u + 24 * u)},${ff(W / 2)},${ff(subY + i * 60 * u)},380,640)\\fnInter SemiBold\\fs${ff(48 * u)}\\bord0\\shad${ff(3 * u)}\\4a&HA0&\\c&HFFFFFF&\\alpha&HFF&\\t(380,600,\\alpha&H20&)${fadeOut}`, media.assText(l.join(' '))));
        }
      }
    } else if (sc.type === 'POINT') {
      const size = 62 * u;
      const rowH = 150 * u;
      const top = cy - (sc.items.length * rowH) / 2;
      const left = W / 2 - maxW / 2 + 10 * u;
      sc.items.forEach((item, i) => {
        const y = top + i * rowH + rowH / 2;
        const d = 120 + i * 420;
        const r = 38 * u;
        // check badge
        add(4, s, e, `\\an5\\pos(${ff(left + r)},${ff(y)})\\bord0\\shad${ff(4 * u)}\\4a&HA0&\\c${C(look.pop)}\\fscx40\\fscy40\\alpha&HFF&\\t(${d},${d + 180},\\fscx110\\fscy110\\alpha&H00&)\\t(${d + 180},${d + 300},\\fscx100\\fscy100)${fadeOut}\\p1`, `${media.assRoundRect(r * 2, r * 2, r)}{\\p0}`);
        // The path starts at 0,0 so libass centres the check itself (not its offset frame) on the badge.
        const ck = `m 0 ${ff(r * 0.46)} l ${ff(r * 0.3)} ${ff(r * 0.76)} l ${ff(r * 0.93)} ${ff(r * 0.12)} l ${ff(r * 0.81)} 0 l ${ff(r * 0.3)} ${ff(r * 0.52)} l ${ff(r * 0.12)} ${ff(r * 0.34)}`;
        add(5, s, e, `\\an5\\pos(${ff(left + r)},${ff(y)})\\bord${ff(3.5 * u)}\\3c${C(look.onPop)}\\shad0\\c${C(look.onPop)}\\fscx40\\fscy40\\alpha&HFF&\\t(${d + 60},${d + 240},\\fscx100\\fscy100\\alpha&H00&)${fadeOut}\\p1`, `${ck}{\\p0}`);
        const lines = wrap(item, size, maxW - r * 2 - 40 * u, 800).slice(0, 2);
        lines.forEach((l, li) => {
          const ty = y + (li - (lines.length - 1) / 2) * size * 0.95;
          const tx = left + r * 2 + 34 * u;
          add(4, s, e, `\\an4\\move(${ff(tx + 60 * u)},${ff(ty)},${ff(tx)},${ff(ty)},${d + 80},${d + 360})\\fnInter ExtraBold\\fs${ff(size)}\\bord0\\shad${ff(4 * u)}\\4a&H90&\\c&HFFFFFF&\\alpha&HFF&\\t(${d + 80},${d + 300},\\alpha&H00&)${fadeOut}`, media.assText(l.join(' ')));
        });
      });
    }
  }
  // An optional watermark (sample or spec labels).
  const total = scenes.length ? scenes[scenes.length - 1].end : 0;
  if (watermark) add(8, 0, total, `\\an5\\pos(${ff(W / 2)},${ff(tall ? 210 * u : 50 * u)})\\fnInter Bold\\fs${ff(30 * u)}\\fsp${ff(3 * u)}\\bord0\\shad${ff(2 * u)}\\c&HFFFFFF&\\alpha&H40&`, media.assText(watermark.toUpperCase()));
  return ev;
}

function promoAss(scenes, opts) {
  return media.assDoc({ width: opts.W, height: opts.H, styles: [media.assStyle({ name: 'K', font: 'Inter', size: 60, align: 5 })], events: sceneEvents(scenes, opts), title: 'Promo' });
}

// Scene times from a voiceover's line times (from Make the voiceover): each scene starts just before
// its first line is spoken and ends where the next begins. lead: seconds of silence before the voice.
function alignedTimeline(scenes, lines, { lead = 0.4, tail = 1.2 } = {}) {
  const spans = [];
  let li = 0;
  for (const s of scenes) {
    const n = s.type === 'POINT' ? s.items.length : 1;
    const first = lines[li];
    const last = lines[li + n - 1];
    if (!first || !last) return null;
    spans.push([Number(first.start) + lead, Number(last.end) + lead]);
    li += n;
  }
  if (li !== lines.length) return null;
  return scenes.map((s, i) => {
    const start = i === 0 ? 0 : Math.max(0, spans[i][0] - 0.15);
    const end = i === scenes.length - 1 ? spans[i][1] + tail : Math.max(start + 0.8, spans[i + 1][0] - 0.15);
    return { ...s, start, end };
  });
}

module.exports = { parse, lineList, spokenOf, timeline, alignedTimeline, promoAss, sceneEvents, TYPES };
