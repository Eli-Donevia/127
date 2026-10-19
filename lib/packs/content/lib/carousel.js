// What goes on each carousel slide, from a topic and the member's facts. One idea per slide: a cover
// that names the payoff, 3 to 6 slides that deliver it, and a last slide with the member's keyword.
// Instagram takes up to 20 slides in the app and 10 through scheduling tools, so we stay at 10 or
// fewer. The design (colors, type, layout) is in design.js.

const { text } = require('../../_kit');
const { lowerFirst, withA, askFor } = require('./niches');
const { hashtags } = require('./scripts');

const lc = lowerFirst;
const sc = (s) => text.sentenceCase(String(s || '').trim());
const noEnd = (s) => String(s || '').trim().replace(/[.?!]+$/, '');
const end = (s) => {
  const t = String(s || '').trim();
  return !t || /[.?!"]$/.test(t) ? t : `${t}.`;
};

const TYPES = ['mistakes', 'myths', 'tips', 'signs', 'steps', 'questions', 'compare', 'checklist'];

// The label pill on the cover: the service in a few words, plus the area when it's short.
function labelFor(f) {
  const where = f.where && f.where.length <= 16 ? f.where : f.city && f.city.length <= 16 ? f.city : '';
  // Nothing says what they sell: the business name, or just the area.
  const svc = f.vague ? text.clip(f.name || '', 24).replace(/\.\.\.$/, '') : text.clip(f.service, 24).replace(/\.\.\.$/, '');
  if (!svc) return where;
  return where ? `${svc} in ${where}` : svc;
}

function ctaSlide(f, { title } = {}) {
  return {
    kind: 'cta',
    title: title || `Ready for ${lc(noEnd(f.niche.outcome))}?`,
    keyword: f.keyword,
    promise: end(sc(f.promise)),
    note: f.where && !f.vague ? `${sc(f.service)} for ${f.buyers} in ${f.where}.` : '',
    save: true,
  };
}

// Slides for a topic type. Returns { type, title, slides, caption }.
function planCarousel(f, { type, topic } = {}) {
  const n = f.niche;
  const t = TYPES.includes(type) ? type : pickType(f, topic);
  const label = labelFor(f);
  let title;
  let slides = [];
  let sub = '';
  if (t === 'mistakes') {
    const items = n.mistakes.slice(0, 4);
    title = topic || `${items.length} ${f.vague ? '' : `${f.service} `}mistakes to stop making`;
    sub = 'And what to do instead.';
    slides = items.map((m, i) => ({ kind: 'point', n: i + 1, title: end(m.m), body: m.why, callout: { label: 'Do this instead', text: m.fix } }));
  } else if (t === 'myths') {
    const items = n.myths.slice(0, 3);
    title = topic || `${items.length} ${f.vague ? '' : `${f.service} `}myths people still believe`;
    sub = 'Swipe for the truth.';
    slides = items.map((m) => ({ kind: 'mythtruth', title: 'Myth vs truth', myth: noEnd(m.myth), truth: m.truth }));
  } else if (t === 'tips') {
    const items = n.tips.slice(0, 4);
    title = topic || `${items.length} ${f.vague ? '' : `${f.service} `}tips worth saving`;
    sub = `From your ${f.pro}${f.where ? ` in ${f.where}` : ''}.`;
    slides = items.map((x, i) => ({ kind: 'point', n: i + 1, title: end(x.tip), body: x.why }));
  } else if (t === 'signs') {
    title = topic || sc(`${n.signs.length} ${n.signsTitle}`);
    sub = 'How many can you check?';
    slides = [
      { kind: 'list', title: 'Check all that apply', items: n.signs.slice(0, 5).map(end), checks: true },
      { kind: 'statement', title: 'Checked two or more? It is time.', body: f.offer ? end(f.offer) : `${askFor(f.short)} and start fresh.` },
    ];
  } else if (t === 'steps') {
    title = topic || `What happens in ${withA(f.short)}, step by step`;
    sub = f.name ? `How ${f.name} does it.` : 'No surprises.';
    const steps = n.process.slice(0, 6);
    slides = [
      ...steps.map((p, i) => ({ kind: 'point', n: i + 1, title: end(p), body: `Step ${i + 1} of ${steps.length}` })),
      { kind: 'statement', title: f.priceText ? `${f.priceText}, and you know the price before I start.` : 'You know the price before I start.', body: f.offer ? end(f.offer) : '' },
    ];
  } else if (t === 'questions') {
    const items = n.questions.slice(0, 4);
    title = topic || `${items.length} questions people ask about ${f.service}`;
    sub = 'Straight answers.';
    slides = items.map((q, i) => ({ kind: 'point', n: i + 1, title: q.q, body: q.a }));
    if (f.priceText) slides.splice(1, 0, { kind: 'statement', title: `My price: ${f.priceText}.`, body: f.offer ? end(f.offer) : `For ${withA(f.short)}, start to finish.` });
  } else if (t === 'compare') {
    const c = n.compare[0];
    title = topic || `${sc(c.a)} or ${c.b}?`;
    sub = 'Here is how to pick.';
    const c2 = n.compare[1];
    slides = [compareSlide(c)];
    if (c2) slides.push(compareSlide(c2));
    slides.push({ kind: 'statement', title: 'Not sure which one you need?', body: 'Tell me what it is for and I will point you to the right one.' });
  } else {
    title = topic || (f.vague ? 'The checklist before you book' : `The ${f.service} checklist`);
    sub = 'Save it for later.';
    slides = [{ kind: 'list', title: 'Before you book', items: n.tips.slice(0, 5).map((x) => end(x.tip)), checks: true }, { kind: 'list', title: 'Signs it is time', items: n.signs.slice(0, 4).map(end), checks: true }];
  }
  const all = [{ kind: 'cover', label, title: sc(noEnd(title)), sub }, ...slides, ctaSlide(f)].slice(0, 10);
  return { type: t, title: sc(noEnd(title)), slides: all, caption: captionFor(f, sc(noEnd(title)), all) };
}

// "One costs your weekend. The other costs money." -> two columns: "Costs your weekend." and "Costs money."
function compareSlide(c) {
  const parts = String(c.point).split(/(?<=\.)\s+/);
  const side = (t) => sc(String(t || '').replace(/^(one|the other|the first|the second)\s+(is\s+)?/i, (m, a, b) => (b ? 'Is ' : '')));
  return {
    kind: 'compare',
    title: `${sc(c.a)} vs ${c.b}`,
    a: { label: sc(c.a), text: side(parts[0]) },
    b: { label: sc(c.b), text: side(parts.slice(1).join(' ') || parts[0]) },
  };
}

// Turn plain slides from AI or from the repurpose tool ({ title, body }) into designed ones.
function fromPlain(f, { title, slides }) {
  const body = (slides || []).slice(0, 8).map((s, i) => ({ kind: 'point', n: i + 1, title: end(text.oneLine(s.title || s.heading || '')), body: text.oneLine(s.body || ''), ...(s.callout ? { callout: { label: 'Do this instead', text: text.oneLine(s.callout) } } : {}) }));
  const all = [{ kind: 'cover', label: labelFor(f), title: sc(noEnd(title)), sub: 'Swipe through.' }, ...body, ctaSlide(f)].slice(0, 10);
  return { type: 'custom', title: sc(noEnd(title)), slides: all, caption: captionFor(f, sc(noEnd(title)), all) };
}

function pickType(f, topic) {
  const t = String(topic || '').toLowerCase();
  if (/mistake|stop|don't|do not|wrong/.test(t)) return 'mistakes';
  if (/myth|truth|lie|believe/.test(t)) return 'myths';
  if (/sign|need a|time to/.test(t)) return 'signs';
  if (/step|process|how i|what happens/.test(t)) return 'steps';
  if (/\bvs\b|versus|or a|which/.test(t)) return 'compare';
  if (/question|faq|ask/.test(t)) return 'questions';
  if (/checklist|before you/.test(t)) return 'checklist';
  if (/tip|how to|ways/.test(t)) return 'tips';
  return 'mistakes';
}

function captionFor(f, title, slides) {
  const points = slides.filter((s) => s.kind === 'point' || s.kind === 'mythtruth').slice(0, 5).map((s, i) => `${i + 1}. ${noEnd(s.title || s.myth)}`);
  const lines = [`${end(title)} Swipe through, then save it.`];
  if (points.length) lines.push('', ...points);
  lines.push('', f.ctaLine);
  const sig = [f.name, f.where].filter(Boolean).join(', ');
  if (sig) lines.push('', sig);
  lines.push('', hashtags(f).join(' '));
  return text.plain(lines.join('\n')).slice(0, 2200);
}

module.exports = { TYPES, planCarousel, fromPlain, pickType, labelFor, ctaSlide, captionFor };
