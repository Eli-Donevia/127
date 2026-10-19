// A posting plan for a week or a month: which day, which format, which pillar, which hook, the
// caption and the call to action. The rhythm is give, give, give, ask: three posts that help for
// free, then one clear ask with the member's keyword, so people know what to do when they're ready.
// Every caption still ends with the keyword, softly. Holidays in the range get a practical note.

const { text, time } = require('../../_kit');
const { PILLARS } = require('./hooks');
const { beatsFor, caption } = require('./scripts');
const { planCarousel } = require('./carousel');
const holidays = require('./holidays');

// Which weekdays to post on (0 = Sunday) for a number of posts a week.
const DAYS = { 1: [2], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };

// Eight posts: three gives, an ask, three gives, an ask.
const CYCLE = ['teach', 'myths', 'proof', 'offer', 'teach', 'bts', 'myths', 'offer'];

// Hook topics that make good carousels (a list you swipe through), and the slide set each one gets.
const CAROUSEL_FOR = { mistake: 'mistakes', mistakes: 'mistakes', myth: 'myths', signs: 'signs', checklist: 'checklist', compare: 'compare', tip: 'tips', process: 'steps' };

function pillarName(key) {
  const p = PILLARS.find((x) => x.key === key);
  return p ? p.name : key;
}

function postingDates(start, days, perWeek) {
  const set = DAYS[Math.max(1, Math.min(7, Math.round(perWeek) || 5))];
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = time.addDays(start, i);
    if (set.includes(time.weekdayOf(d))) out.push(d);
  }
  return out;
}

function hhmm(t) {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '18:00';
  return `${String(Math.min(23, Number(m[1]))).padStart(2, '0')}:${String(Math.min(59, Number(m[2]))).padStart(2, '0')}`;
}

// "18:00" -> "6:00 PM"
function clock(t) {
  const [h, m] = hhmm(t).split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// hooks: ranked hooks from hooks.js. Returns { posts, filming, holidays, carousel, reels, start, end, mix }.
function planPosts(f, hooks, { start, days = 7, perWeek = 5, at = '18:00', platforms = 'Instagram and TikTok', carouselsPerWeek = 1, scripts = 5 } = {}) {
  const per = Math.max(1, Math.min(7, Math.round(perWeek) || 5));
  const end = time.addDays(start, days - 1);
  const dates = postingDates(start, days, per);
  const pool = hooks.slice();
  const used = new Set();
  const take = (pillar, wantCarousel) => {
    const fits = (h) => !used.has(h.id) && h.pillar === pillar;
    let h = wantCarousel ? pool.find((x) => fits(x) && CAROUSEL_FOR[x.topic && x.topic.type]) : null;
    h = h || pool.find(fits) || pool.find((x) => !used.has(x.id)) || pool[used.size % Math.max(1, pool.length)];
    if (h) used.add(h.id);
    return h;
  };
  const hol = holidays.inRange(start, end);
  const weekCarousels = {};
  const usedTypes = new Set();
  let firstCarousel = null;
  const posts = dates.map((date, i) => {
    const pillar = CYCLE[i % CYCLE.length];
    const week = Math.floor(i / per);
    const wantCarousel = pillar !== 'offer' && pillar !== 'proof' && (weekCarousels[week] || 0) < carouselsPerWeek && i % per >= 1;
    const h = take(pillar, wantCarousel);
    const type = h && wantCarousel ? CAROUSEL_FOR[h.topic && h.topic.type] : null;
    const isCarousel = !!(type && !usedTypes.has(type));
    const ask = pillar === 'offer';
    const holiday = hol.find((x) => x.date === date) || null;
    let post;
    if (isCarousel) {
      weekCarousels[week] = (weekCarousels[week] || 0) + 1;
      usedTypes.add(type);
      const car = planCarousel(f, { type });
      if (!firstCarousel) firstCarousel = { type, title: car.title, date };
      post = { format: 'Carousel', hook: car.title, onScreen: car.title, caption: car.caption, carouselType: type, slides: car.slides.length };
    } else {
      const silent = !!(h && /^(pov|proof)$/.test(h.format));
      post = { format: silent ? 'Reel, no talking' : 'Reel', hook: h ? h.hook : '', onScreen: h ? h.onScreen : '', caption: h ? caption(h, f, beatsFor(h, f), { ask }) : '' };
    }
    return {
      n: i + 1,
      date,
      day: time.shortDate(date),
      weekday: time.WEEKDAYS[time.weekdayOf(date)],
      time: hhmm(at),
      timeText: clock(at),
      platform: platforms,
      pillar,
      pillarName: pillarName(pillar),
      ask,
      hookId: h ? h.id : '',
      formatLabel: isCarousel ? 'Carousel' : h ? h.formatLabel : '',
      ...post,
      cta: ask ? f.ctaLine : `Save this. ${f.ctaLine}`,
      filmBy: post.format === 'Carousel' ? '' : time.addDays(date, -1),
      holiday: holiday ? `${holiday.name}: ${holiday.idea}` : '',
      title: text.clip(post.onScreen || post.hook, 70),
    };
  });
  // Batch filming: one session the day before each week's first post covers that week's Reels.
  const filming = [];
  for (let i = 0; i < posts.length; i += per) {
    const chunk = posts.slice(i, i + per).filter((p) => p.format !== 'Carousel');
    if (!chunk.length) continue;
    const date = time.addDays(posts[i].date, -1);
    for (const p of chunk) p.filmBy = date;
    filming.push({ date, day: time.shortDate(date), count: chunk.length, posts: chunk.map((p) => p.n), list: chunk.map((p) => p.onScreen || p.hook) });
  }
  const mix = {};
  for (const p of posts) mix[p.pillar] = (mix[p.pillar] || 0) + 1;
  const byId = new Map(hooks.map((h) => [h.id, h]));
  const reels = posts
    .filter((p) => p.format !== 'Carousel' && byId.has(p.hookId))
    .slice(0, scripts)
    .map((p) => ({ ...byId.get(p.hookId), ask: p.ask, date: p.date, day: p.day }));
  return { posts, filming, holidays: hol, carousel: firstCarousel, reels, start, end, mix, asks: posts.filter((p) => p.ask).length };
}

module.exports = { planPosts, postingDates, CYCLE, DAYS, CAROUSEL_FOR, pillarName, hhmm, clock };
