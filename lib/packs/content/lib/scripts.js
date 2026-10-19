// Film-ready short video scripts from a hook: what to say, what goes on screen, what to film, the
// caption and the call to action. The shape follows what works on short video: the hook in the first
// second (on screen and said), who you are in one line, three or four beats that pay off the hook,
// then one clear ask with the member's keyword. Templates use the hook's topic from hooks.js, the
// niche notes and the member's own facts; AI can rewrite them in the member's voice.

const { text } = require('../../_kit');
const { lowerFirst, withA } = require('./niches');
const { answerFor } = require('./questions');

const lc = lowerFirst;
const sc = (s) => text.sentenceCase(String(s || '').trim());
const end = (s) => {
  const t = String(s || '').trim();
  return !t || /[.?!"]$/.test(t) ? t : `${t}.`;
};
const noEnd = (s) => String(s || '').trim().replace(/[.?!]+$/, '');
const firstSentence = (s) => String(s || '').split(/(?<=[.!?])\s+/)[0];

const WPS = 2.5; // spoken words per second, a normal talking pace

function words(s) {
  return String(s || '').split(/\s+/).filter(Boolean).length;
}

function plural(t) {
  const s = String(t || '');
  if (!s || /s$/.test(s)) return s;
  if (/y$/.test(s) && !/[aeiou]y$/.test(s)) return `${s.slice(0, -1)}ies`;
  return `${s}s`;
}

// "#cardetailing #mobiledetailing #austin #austincardetailing", at most `max` (Instagram allows 5).
function hashtags(f, max = 5) {
  const city = text.slug(f.city || '', 30).replace(/-/g, '');
  const svc = text.slug(f.service || '', 30).replace(/-/g, '');
  const tags = [...(f.niche.tags || []).slice(0, 2), city, city && svc && `${city}${svc}`.length <= 28 ? `${city}${svc}` : '', ...(f.niche.tags || []).slice(2)];
  return [...new Set(tags.filter(Boolean))].slice(0, max).map((t) => `#${t}`);
}

const SHOTS = {
  aroll: 'Face to camera, phone at eye level, window light on your face',
  close: 'Face to camera, point down to the comments',
};

// The beats for each kind of topic. Each beat: { say, onScreen, shot }.
function beatsFor(h, f) {
  const n = f.niche;
  const t = h.topic || {};
  const proof = n.proof || [];
  const shot = (i) => `B-roll: ${proof[i % Math.max(1, proof.length)] || 'your work, close up'}`;
  const step = (i) => `B-roll: ${lc(n.process[i % n.process.length])}`;
  switch (t.type) {
    case 'mistake': {
      const m = t.item;
      const next = (t.all || n.mistakes).find((x) => x.m !== m.m) || n.mistakes[0];
      return [
        { say: m.why, onScreen: firstSentence(m.why), shot: shot(0) },
        { say: `Do this instead: ${lc(noEnd(m.fix))}.`, onScreen: `Instead: ${lc(noEnd(m.fix))}`, shot: shot(1) },
        { say: `And one more: ${lc(noEnd(next.m))}. ${next.fix}`, onScreen: `Also: ${lc(noEnd(next.m))}`, shot: shot(2) },
      ];
    }
    case 'mistakes':
      return (t.items || n.mistakes).slice(0, 4).map((m, i) => ({ say: `${i + 1}. ${end(m.m)} ${m.fix}`, onScreen: `${i + 1}. ${noEnd(m.m)}`, shot: shot(i) }));
    case 'myth': {
      const m = t.item;
      const tip = n.tips[text.hash(m.myth) % n.tips.length];
      return [
        { say: `The truth: ${lc(m.truth)}`, onScreen: `Truth: ${lc(noEnd(firstSentence(m.truth)))}`, shot: SHOTS.aroll },
        { say: `What to do instead: ${lc(noEnd(tip.tip))}. ${tip.why}`, onScreen: sc(noEnd(tip.tip)), shot: shot(0) },
        { say: `Save this so you have it next time.`, onScreen: 'Save this', shot: shot(1) },
      ];
    }
    case 'signs':
      return (t.items || n.signs).slice(0, 4).map((s, i) => ({ say: `Sign ${i + 1}: ${lc(end(s))}`, onScreen: `${i + 1}. ${noEnd(s)}`, shot: shot(i) }));
    case 'tip': {
      const tip = t.item;
      const next = (t.all || n.tips).find((x) => x.tip !== tip.tip) || n.tips[0];
      return [
        { say: tip.why, onScreen: firstSentence(tip.why), shot: shot(0) },
        { say: `Here is how it looks.`, onScreen: sc(noEnd(tip.tip)), shot: shot(1) },
        { say: `Bonus: ${lc(noEnd(next.tip))}. ${next.why}`, onScreen: `Bonus: ${lc(noEnd(next.tip))}`, shot: shot(2) },
      ];
    }
    case 'compare': {
      const c = t.item;
      return [
        { say: c.point, onScreen: `${sc(c.a)} vs ${c.b}`, shot: SHOTS.aroll },
        { say: `Not sure which one you need? Tell me what it is for and I will point you to the right one.`, onScreen: 'Not sure? Ask me', shot: shot(0) },
      ];
    }
    case 'question':
      return questionBeats(t, f, shot);
    case 'price': {
      const objection = n.objections.find((o) => /cost|price|expensive|cheap/i.test(o.o)) || n.objections[0];
      return [
        { say: f.offer ? `Here is what is included: ${lc(end(f.offer))}` : `Here is what is included in every ${f.short}.`, onScreen: f.priceText ? `${f.priceText}: what is included` : 'What is included', shot: shot(0) },
        { say: `How I do it: ${text.list(n.process.slice(0, 3).map(lc))}.`, onScreen: n.process.slice(0, 3).join(', '), shot: step(1) },
        { say: objection.a, onScreen: 'Is it worth it?', shot: SHOTS.aroll },
      ];
    }
    case 'process':
    case 'bts':
      return (t.items || n.process).slice(0, 4).map((s, i) => ({ say: `Step ${i + 1}: ${lc(end(s))}`, onScreen: `${i + 1}. ${noEnd(s)}`, shot: step(i) }));
    case 'local': {
      return [
        { say: `If ${t.pain || n.pains[0]}, you are not the only one.`, onScreen: sc(t.pain || n.pains[0]), shot: SHOTS.aroll },
        { say: f.offer ? end(f.offer) : f.vague ? `${f.where ? `I work in ${f.where}` : 'Here is how I work'}.` : `I do ${f.service}${f.where ? ` in ${f.where}` : ''}.`, onScreen: f.priceText ? `${sc(f.short)}: ${f.priceText}` : f.vague ? f.name || 'What I do' : sc(f.service), shot: shot(0) },
        { say: f.mobile ? `I come to you, anywhere in ${f.where || f.city || 'town'}.` : `It is easy to book, and you will know the price up front.`, onScreen: f.mobile ? 'I come to you' : 'Price up front', shot: shot(1) },
      ];
    }
    case 'pov':
    case 'proof':
      return [
        { say: '', onScreen: 'Before', shot: `B-roll: the before, wide, then close up` },
        { say: '', onScreen: noEnd(n.process[1] || 'The work'), shot: step(1) },
        { say: '', onScreen: noEnd(n.process[3] || 'Almost there'), shot: step(3) },
        { say: '', onScreen: 'After', shot: `B-roll: the reveal, same angle as the before` },
      ];
    case 'objection': {
      const o = t.item;
      return [
        { say: o.a, onScreen: `My answer`, shot: SHOTS.aroll },
        { say: f.offer ? `Here is what you get: ${lc(end(f.offer))}` : `Here is what you get when you book me.`, onScreen: 'What you get', shot: shot(0) },
        { say: f.priceText ? `And the price is ${f.priceText}, up front, no surprises.` : `And you get the price up front, no surprises.`, onScreen: f.priceText || 'Price up front', shot: shot(1) },
      ];
    }
    case 'checklist':
      return (t.items || n.tips.map((x) => x.tip)).slice(0, 4).map((s, i) => ({ say: `${i + 1}. ${end(s)}`, onScreen: `${i + 1}. ${noEnd(s)}`, shot: shot(i) }));
    case 'offer':
    case 'intro':
      return [
        { say: f.offer ? end(f.offer) : f.vague ? `${f.where ? `I work in ${f.where}` : 'Here is how I work'}.` : `I do ${f.service}${f.where ? ` in ${f.where}` : ''}.`, onScreen: f.offer ? text.clip(f.offer, 48) : f.vague ? f.name || 'What I do' : sc(f.service), shot: shot(0) },
        { say: f.priceText ? `It is ${f.priceText}, and you know the price before I start.` : `You know the price before I start.`, onScreen: f.priceText ? `${f.priceText}` : 'Price up front', shot: shot(1) },
        { say: `It is for ${f.buyers}${f.where ? ` in ${f.where}` : ''} who want ${lc(n.outcome)}.`, onScreen: `For ${f.buyers}`, shot: SHOTS.aroll },
      ];
    case 'seasonal':
      return n.tips.slice(0, 3).map((x, i) => ({ say: `${i + 1}. ${end(x.tip)} ${x.why}`, onScreen: `${i + 1}. ${noEnd(x.tip)}`, shot: shot(i) }));
    default:
      return n.tips.slice(0, 3).map((x, i) => ({ say: `${end(x.tip)} ${x.why}`, onScreen: noEnd(x.tip), shot: shot(i) }));
  }
}

// A real search question without a written answer still gets a useful script: the beats follow
// the kind of question (cost, worth it, how long, compare, a problem to fix).
function questionBeats(t, f, shot) {
  const n = f.niche;
  const a = t.a || answerFor(f, t.q);
  const beats = [];
  if (a) beats.push({ say: `Short answer: ${lc(end(a))}`, onScreen: text.clip(firstSentence(a), 48), shot: SHOTS.aroll });
  if (t.kind === 'cost') {
    if (f.priceText) beats.push({ say: `Mine is ${f.priceText}${f.offer ? ` for ${lc(noEnd(f.offer))}` : ''}.`, onScreen: `Mine: ${f.priceText}`, shot: shot(0) });
    beats.push({ say: `What changes the price: the size, the condition and anything extra you add.`, onScreen: 'Size, condition, extras', shot: shot(1) });
    beats.push({ say: `Always ask what is included before you compare prices.`, onScreen: 'Ask what is included', shot: SHOTS.aroll });
  } else if (t.kind === 'worth') {
    const myth = n.myths[0];
    beats.push({ say: `It is worth it when you want ${lc(n.outcome)} and you do not have the time to do it yourself.`, onScreen: 'When it is worth it', shot: shot(0) });
    beats.push({ say: `One thing to know: ${lc(myth.truth)}`, onScreen: `Myth: ${lc(noEnd(myth.myth))}`, shot: shot(1) });
  } else if (t.kind === 'often') {
    beats.push({ say: `What happens in ${withA(f.short)}: ${text.list(n.process.slice(0, 3).map(lc))}.`, onScreen: n.process.slice(0, 3).join(', '), shot: shot(0) });
    beats.push({ say: `Leave a little extra time if it has been a while.`, onScreen: 'Been a while? Add time', shot: shot(1) });
  } else if (t.kind === 'compare') {
    const c = n.compare[0];
    beats.push({ say: c.point, onScreen: `${sc(c.a)} vs ${c.b}`, shot: shot(0) });
  } else {
    n.tips.slice(0, 2).forEach((x, i) => beats.push({ say: `${end(x.tip)} ${x.why}`, onScreen: noEnd(x.tip), shot: shot(i) }));
  }
  return beats.slice(0, 4);
}

function caption(h, f, beats, { ask = false } = {}) {
  const lines = [];
  lines.push(h.hook);
  const points = beats.filter((b) => b.onScreen && !/^(Before|After)$/.test(b.onScreen)).slice(0, 4).map((b) => end(b.onScreen));
  if (points.length) lines.push('', ...points);
  lines.push('', ask ? f.ctaLine : `Save this for later. ${f.ctaLine}`);
  const sig = [f.name, f.where].filter(Boolean).join(', ');
  if (sig) lines.push('', sig);
  lines.push('', hashtags(f).join(' '));
  return text.plain(lines.join('\n')).slice(0, 2200);
}

// One script from one hook. ask: true for the offer posts (the CTA is the whole point).
function buildScript(h, f, { ask } = {}) {
  const isAsk = ask != null ? ask : h.pillar === 'offer';
  const beats = beatsFor(h, f).filter((b, i, all) => !(b.say && all.length > 2 && h.hook.includes(b.say))).map((b) => ({ say: text.oneLine(b.say), onScreen: text.clip(b.onScreen, 56), shot: text.oneLine(b.shot) }));
  const silent = beats.every((b) => !b.say);
  const hook = { say: silent ? '' : h.hook, onScreen: h.onScreen || text.clip(h.hook, 56), shot: silent ? 'B-roll: the most striking before shot' : 'Face to camera, start talking on frame one' };
  const intro = silent || !f.intro || h.topic?.type === 'intro' ? null : { say: f.intro, onScreen: '', shot: SHOTS.aroll };
  const close = {
    say: isAsk ? f.ctaLine : `Save this for later. ${f.ctaLine}`,
    onScreen: `Comment ${f.keyword}`,
    shot: silent ? 'End card: your keyword on screen for 2 seconds' : SHOTS.close,
  };
  const spokenParts = [hook.say, intro && intro.say, ...beats.map((b) => b.say), silent ? '' : close.say].filter(Boolean);
  const spoken = spokenParts.join('\n\n');
  const seconds = silent ? 12 + beats.length * 2 : Math.max(15, Math.round(words(spoken) / WPS) + beats.length);
  const shots = [...new Set([hook.shot, intro && intro.shot, ...beats.map((b) => b.shot), close.shot].filter(Boolean))];
  return {
    id: h.id,
    title: h.onScreen || text.clip(h.hook, 56),
    hookText: h.hook,
    format: h.formatLabel || 'Reel',
    pillar: h.pillar,
    ask: isAsk,
    seconds,
    hook,
    intro,
    beats,
    close,
    caption: caption(h, f, beats, { ask: isAsk }),
    hashtags: hashtags(f),
    keyword: f.keyword,
    shots,
    spoken,
    silent,
    tips: filmingTips(h, silent),
  };
}

function filmingTips(h, silent) {
  const tips = ['Film vertical. Put the phone at eye level and face a window.', 'Put the on-screen text in the middle of the frame, away from the edges where the app buttons sit.'];
  if (silent) tips.unshift('No talking needed: let the before and after carry it, with text on screen.');
  else tips.unshift('Say the hook in the first second. No hello, no logo first.');
  return tips;
}

module.exports = { buildScript, beatsFor, caption, hashtags, plural, words, WPS };
