// Top-of-funnel pages for ads and the bio link: Founder Score quiz, Day One Stack
// lead magnet and the free Idea Test. Mount in server.js (before the 404 handler):
//
//   app.use(require('./lib/funnels')({ requireAuth, requireAdmin }));
//
// Pages are static HTML in public/funnels/; this router serves them on clean URLs,
// injects share previews and tracking pixels, and handles lead capture + the Idea Test API.
//
// Env (all optional):
//   KLAVIYO_PRIVATE_KEY, KLAVIYO_LIST_ID   subscribe leads + send a "127 Lead Captured" event
//   LEAD_EMAILS=klaviyo                    let Klaviyo flows send the delivery emails instead of Resend
//   META_PIXEL_ID, TIKTOK_PIXEL_ID         ad pixels, loaded by public/js/consent.js only after "Accept" (Legal L7);
//                                          the Lead event fires only then. Server-side CAPI needs the same consent.
//   COOKIE_DOMAIN                          consent cookie domain (.127group.io), see lib/ad-consent.js
//   META_CAPI_TOKEN                        also send Lead server-side via Meta Conversions API (deduped with the pixel)
//   KLAVIYO_PUBLIC_KEY                     Klaviyo onsite tracking (klaviyo.js) on funnel pages
//   PLAUSIBLE_DOMAIN                       already used by the site; funnel pages send custom events
//   IDEA_TEST_DAILY_CAP (default 150)      max AI idea tests per day across everyone
//   IDEA_TEST_PER_IP (default 4)           max idea tests per visitor per day

const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('./db');
const integrations = require('./integrations');
const ideaTest = require('./idea-test');
const crypto = require('crypto');
const kl = require('./klaviyo');
const launch = require('./launch');
const waitlist = require('./waitlist');
const consent = require('./consent');
const utmLib = require('./utm');
const adConsent = require('./ad-consent');
const { PLANS } = require('./plans');

const DIR = path.join(__dirname, '..', 'public', 'funnels');
const BASE = () => (process.env.BASE_URL || 'https://127group.io').replace(/\/$/, '');
const ARCHETYPES = ['explorer', 'validator', 'launcher', 'amplifier', 'operator'];

const cache = {};
function readPage(file) {
  if (process.env.NODE_ENV === 'production' && cache[file]) return cache[file];
  return (cache[file] = fs.readFileSync(path.join(DIR, file), 'utf8'));
}

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function ogBlock({ title, description, image, url }) {
  return [
    `<title>${escAttr(title)}</title>`,
    `<meta name="description" content="${escAttr(description)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="127">',
    `<meta property="og:title" content="${escAttr(title)}">`,
    `<meta property="og:description" content="${escAttr(description)}">`,
    `<meta property="og:image" content="${escAttr(BASE() + image)}">`,
    '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
    `<meta property="og:url" content="${escAttr(url)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n');
}

// Plausible is cookieless and runs for everyone. Meta, TikTok and Klaviyo onsite never load from here: page() adds
// lib/ad-consent.js configScript(), and public/js/consent.js loads them only after "Accept" (Legal L7).
function trackers() {
  const out = [];
  if (process.env.PLAUSIBLE_DOMAIN) {
    out.push(`<script defer data-domain="${escAttr(process.env.PLAUSIBLE_DOMAIN)}" src="https://plausible.io/js/script.js"></script>`);
    out.push('<script>window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}</script>');
  }
  return out.join('\n');
}

function page(file, og, { noindex = false } = {}) {
  return (req, res) => {
    let html = readPage(file);
    if (og) html = html.replace(/<!--OG-->[\s\S]*?<!--\/OG-->/, ogBlock(og(req)));
    // The gate's consent wording (box, small line, terms) comes from lib/consent.js so the flag switches it everywhere.
    const page = { 'score.html': 'founder-score', 'stack.html': 'day-one-stack', 'idea-test.html': 'idea-test' }[file];
    const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
    const gate = page ? `<script>window.K127_CONSENT=${json(consent.copy(page))};</script>\n` : '';
    // Which result block to show after the email (A1, A2, B or C), read from the server's clock.
    const state = `<script>window.K127_LAUNCH=${json(launchInfo())};</script>\n`;
    // Meta, TikTok and Klaviyo onsite wait for "Accept": the consent config and script go after the trackers (Legal L7).
    html = html.replace('<!--TRACKERS-->', '<!--TRACKERS-->\n' + adConsent.configScript(req));
    html = html.replace('<!--TRACKERS-->', gate + state + trackers() + (noindex ? '\n<meta name="robots" content="noindex">' : ''));
    res.set('cache-control', 'no-cache').type('html').send(html);
  };
}

// ---------- launch state for the result screens (conversion/pages/quiz-results.md §1) ----------
// A1 waitlist open to challenge sign-up close, A2 to doors open, B founding window, C evergreen.
// Every date and price on the result screens comes from here, never typed into the pages.
const ET = 'America/New_York';
const etDate = (t, o) => new Date(t).toLocaleDateString('en-US', { timeZone: ET, ...o });
const etDay = (t) => etDate(t, { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', ''); // "Mon Nov 9"
function etTime(t) {
  const s = new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ET });
  return s.replace(':00', '').replace(/\s?([AP])M$/i, (m, x) => x.toLowerCase() + 'm') + ' ET'; // "8pm ET"
}
function launchInfo() {
  const v = launch.view();
  const now = Date.now();
  const regCloses = launch.date('CHALLENGE_REG_CLOSES_AT');
  const state = v.prelaunch ? (regCloses && now < regCloses ? 'A1' : 'A2') : v.foundingOpen ? 'B' : 'C';
  const start = launch.date('CHALLENGE_START_AT');
  const lives = ['CHALLENGE_LIVE_1_AT', 'CHALLENGE_LIVE_2_AT'].map(launch.date);
  const closesLast = v.closesAt && v.closesAt - 60 * 1000;
  return {
    state,
    flag: consent.on() ? 'on' : 'off',
    price: v.foundingPrice,
    builderPrice: PLANS.builder.price,
    cap: v.cap,
    refN: v.referralsForReward,
    // Only real and only when it matters (spec §2): 25 or fewer, during the founding window.
    spotsLeft: state === 'B' && v.spotsLeft <= 25 ? v.spotsLeft : null,
    lastDay: state === 'B' && !!closesLast && etDate(now, {}) === etDate(closesLast, {}),
    doors: v.launchAt ? etDate(v.launchAt, { weekday: 'short', month: 'short', day: 'numeric' }) : null, // "Tue, Nov 17"
    doorsShort: v.launchAt ? etDate(v.launchAt, { month: 'short', day: 'numeric' }) : null, // "Nov 17"
    doorsTime: v.launchTime, // "10am ET"
    closes: v.closesDay, // "Tuesday, November 24"
    closesDate: v.closesDate, // "November 24"
    closesTime: v.closesTime, // "11:59pm ET"
    challenge: start && v.challenge.on ? {
      open: v.challenge.open,
      live: now >= start,
      days: [0, 1, 2, 3, 4].map((i) => etDay(start + i * 864e5)),
      range: `${etDate(start, { month: 'short', day: 'numeric' })} to ${etDate(start + 4 * 864e5, { day: 'numeric' })}`, // "Nov 9 to 13"
      lives: lives.map((t) => (t ? etDay(t) : null)),
      liveTime: lives[0] ? etTime(lives[0]) : null,
      regCloses: regCloses ? `${etDay(regCloses)} at ${etTime(regCloses)}` : null,
    } : null,
  };
}

// Signed links for the result page, always with a purpose so one can't stand in for another.
function sign(email, purpose) {
  const msg = `${purpose}:${String(email).trim().toLowerCase()}`;
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev').update(msg).digest('hex');
}
function sameSig(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
const ipHashOf = (req) => crypto.createHash('sha256').update(`${process.env.SESSION_SECRET || 'dev'}:${req.ip}`).digest('hex').slice(0, 24);
const POSTOPT = { 'founder-score': 'score', 'day-one-stack': 'stack', 'idea-test': 'idea-test' };

// ---------- tiny per-IP daily limiter (single instance, in memory) ----------
const hits = new Map();
function limited(key, max) {
  const day = new Date().toISOString().slice(0, 10);
  const h = hits.get(key);
  if (!h || h.day !== day) { hits.set(key, { day, n: 1 }); return false; }
  h.n += 1;
  return h.n > max;
}
setInterval(() => { const day = new Date().toISOString().slice(0, 10); for (const [k, v] of hits) if (v.day !== day) hits.delete(k); }, 36e5).unref();

// ---------- storage that never loses a lead ----------
async function store(collection, doc) {
  try {
    return await db.save(collection, doc);
  } catch (err) {
    // lib/db.js only knows the collections listed in COLLECTIONS. Until 'leads' and
    // 'ideaTests' are added there, keep the record in events so nothing is lost.
    console.warn(`[funnels] ${collection} collection missing in lib/db.js, saved to events`);
    return db.save('events', { type: `funnel.${collection}`, payload: doc, at: new Date().toISOString() });
  }
}
function findLead(email, source) {
  try { return db.find('leads', (l) => l.email === email && l.source === source); } catch { return null; }
}

// ---------- Klaviyo ----------
// Every lead gets the "127 Lead Captured" event and profile properties. Only people who
// ticked the email box are subscribed to a marketing list (same rule as the rest of the site).
async function klaviyo(lead, optIn) {
  if (!kl.on()) return;
  const props = { source: lead.source, ...flat(lead.data), ...prefix('utm_', lead.utm) };
  // launch_optin / ongoing_optin are always set, so a lead who left the box unticked never passes a marketing gate.
  await kl.track('127 Lead Captured', lead.email, props, { first_name: lead.name || undefined, ['127 ' + lead.source]: true, ...profileProps(lead), ...consent.optins(optIn) });
  const list = process.env.KLAVIYO_LIST_ID || process.env.KLAVIYO_WAITLIST_LIST_ID;
  if (optIn && list) await kl.subscribe(list, lead.email);
}
function flat(o, pre = '') {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flat(v, pre + k + '_'));
    else out[pre + k] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}
const prefix = (p, o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k.startsWith(p) ? k : p + k, v]));
function profileProps(lead) {
  const d = lead.data || {};
  if (lead.source === 'founder-score') return { '127 archetype': d.archetype, '127 founder score': d.score, '127 track': d.track, '127 stage': d.stage };
  if (lead.source === 'idea-test') return { '127 idea score': d.score, '127 idea verdict': d.verdict };
  return {};
}

function cookiesOf(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => {
    const i = c.indexOf('=');
    try { return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; } catch (e) { return [c.slice(0, i), c.slice(i + 1)]; }
  }));
}

// ---------- Meta Conversions API (server-side Lead, deduped with the browser pixel by event_id) ----------
async function metaCapi(req, lead, eventId) {
  const pixel = process.env.META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
  // Only with ad consent: body ad_consent === true and the 127_consent cookie starting v1.ads1 (Legal L7).
  if (!pixel || !token || !adConsent.serverSideAllowed(req)) return;
  const cookies = cookiesOf(req);
  const sha = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId || undefined,
          action_source: 'website',
          event_source_url: BASE() + (lead.page || ''),
          user_data: {
            em: [sha(lead.email)],
            ...(lead.name ? { fn: [sha(lead.name)] } : {}),
            client_ip_address: req.ip,
            client_user_agent: String(req.headers['user-agent'] || '').slice(0, 400),
            ...(cookies._fbp ? { fbp: cookies._fbp } : {}),
            ...(cookies._fbc ? { fbc: cookies._fbc } : {}),
          },
          custom_data: { content_name: lead.source },
        }],
      }),
    });
    if (!r.ok) console.warn('[meta capi]', r.status, (await r.text()).slice(0, 300));
  } catch (err) {
    console.warn('[meta capi] failed', err.message);
  }
}

// ---------- Founder Score, rebuilt on the server from the answers ----------
// The result email carries the same reasons, #1 move and roadmap preview as the page, from the same
// copy file (public/funnels/score-data.js), so a lead can't put their own text into an email.
const dataCache = {};
function pageData(file, key) {
  if (dataCache[file] && process.env.NODE_ENV === 'production') return dataCache[file];
  const sandbox = { window: {} };
  require('vm').runInNewContext(fs.readFileSync(path.join(DIR, file), 'utf8'), sandbox);
  return (dataCache[file] = sandbox.window[key]);
}
const scoreData = () => pageData('score-data.js', 'SCORE');
const resultsData = () => pageData('results-data.js', 'RESULTS');
const article = (w) => (/^[AEIOU]/i.test(w) ? 'an' : 'a');
function scoreSummary(answers) {
  const S = scoreData();
  const a = answers || {};
  const QS = S.questions;
  const opt = (q) => q.options.find((o) => o.v === a[q.id]);
  if (!QS.every(opt)) return null;
  const dims = {};
  let total = 0;
  QS.forEach((q) => { if (q.dim) { dims[q.dim] = opt(q).pts; total += opt(q).pts; } });
  const archKey = a.stage;
  const arch = S.archetypes[archKey];
  const eligible = archKey === 'exploring' ? ['focus', 'validation', 'execution'] : ['validation', 'proof', 'focus', 'reach', 'execution'];
  const weakest = eligible.reduce((w, d) => (dims[d] < dims[w] ? d : w), eligible[0]);
  const band = S.bands.find((b) => total >= b.min);
  const track = S.tracks[arch.track];
  const trimmed = opt(QS.find((q) => q.id === 'hours')).time === 'lt3';
  const stage = opt(QS[0]);
  const blocker = opt(QS.find((q) => q.id === 'blocker'));
  const reasons = [`Because you said "${stage.label}", you're ${article(arch.name)} ${arch.name}.`]
    .concat(QS.filter((q) => q.dim).map((q) => `Because you said "${opt(q).label}": ${S.dims[q.dim]} ${opt(q).pts}/20. ${opt(q).reason || ''}`.trim()))
    .concat(S.blockerNotes[blocker.v] ? [`Because you said "${blocker.label}": ${S.blockerNotes[blocker.v]}`] : []);
  return {
    archKey, arch, total, band, weakest, track, reasons,
    move: S.moves[weakest],
    week1: track.weeks[0].tasks.slice(0, trimmed ? 2 : 3).map((t) => t[0]),
    themes: track.weeks.map((w) => w.theme),
  };
}

// ---------- delivery emails (Resend), unless Klaviyo flows send them ----------
// The block for the launch state, in plain text, from the same copy as the page (results-data.js).
// founding: the waitlist fields from /api/lead (state A). magnet: score, stack or idea. key: archetype key or verdict.
function stateText(L, founding, optin, magnet, key, startUrl) {
  const D = resultsData();
  const fill = (s) => { const t = D.fill(s, { ...L, thing: magnet === 'stack' ? 'guide' : 'results' }); return /\{\w+\}/.test(t) ? '' : t; };
  const lines = magnet === 'score' ? D.score[key] || {} : magnet === 'stack' ? D.stack : { a2: D.idea.a2, start: D.idea.start, ...(D.idea[key] || {}) };
  const offer = D.offer.map(fill);
  const offerText = offer.every(Boolean) ? offer.join('\n') : '';
  const from = { score: 'score', stack: 'stack', idea: 'idea-test' }[magnet];
  const out = [];
  if (L.state === 'A1' || L.state === 'A2') {
    if (founding) {
      out.push(`${D.founding.heading} ${fill(optin ? D.founding.optedIn : D.founding.notOptedIn)}`);
      if (offerText) out.push(offerText);
      out.push(`${D.founding.calendar}: ${BASE()}/founding/doors-open.ics`);
      out.push(`${fill(D.bring3.heading)} ${fill(D.bring3.body)}\nYour link: ${founding.referral_link}\n${D.bring3.track}: ${founding.status_url}`);
    } else {
      out.push(`${fill(D.doors.heading)} ${D.doors.free}`);
    }
    const ch = L.challenge;
    if (L.state === 'A1' && ch && ch.open) {
      out.push([fill(D.challenge.heading), fill(ch.live ? D.challenge.bodyLive : D.challenge.body), fill(D.challenge.lives), fill(lines.a1), `${BASE()}/challenge`].filter(Boolean).join(' '));
    } else if (lines.a2) out.push(fill(lines.a2));
  } else if (L.state === 'B') {
    out.push([L.lastDay ? fill(D.open.lastDay) : '', D.open.heading, fill(lines.resource), D.open.shared].filter(Boolean).join(' '));
    if (offerText) out.push(offerText);
    out.push(`${D.open.roadmap} (${D.open.zero.replace(/\.$/, '').toLowerCase()}): ${startUrl}\n${fill(D.open.lock)}: ${BASE()}/founding/lock?from=${from}`);
    out.push(D.open.small.join(' '));
  } else {
    out.push(`${D.evergreen.heading} ${fill(lines.start)}\n${D.evergreen.start}: ${startUrl}`);
    out.push(`${fill(lines.builder)} ${BASE()}/pricing`);
  }
  return out.filter(Boolean).join('\n\n');
}

function deliveryEmail(lead, founding, L = launchInfo()) {
  const hi = `Hi ${lead.name || 'there'},`;
  const optin = consent.optins(lead.consent && lead.consent.box).launch_optin;
  const W = resultsData().who;
  const who = `${W.name} ${W.points.join('. ')}. ${W.note}`;
  const sign = `\n\nMake today day one.\nEli\n127\n\n${who}\n127 is education and tools, not a promise of income. Results vary. ${BASE()}/earnings-disclaimer\n\nUnless the Lord builds the house, the builders labor in vain. (Psalm 127:1)`;
  const d = lead.data || {};
  if (lead.source === 'founder-score') {
    // Rebuilt from the answers, so the email can't carry text the visitor typed into the request.
    const sc = scoreSummary(d.answers);
    if (!sc) return null;
    const start = `${BASE()}/start?stage=${encodeURIComponent(sc.archKey)}&from=score`;
    const week1 = sc.week1.map((t, i) => `${i + 1}. ${t}`).join('\n');
    const later = sc.themes.slice(1).map((t, i) => `Week ${i + 2}: ${t}`).join('\n');
    return {
      subject: `Your Founder Score: ${sc.arch.name}, ${sc.total}/100`,
      text: `${hi}\n\nYou're ${article(sc.arch.name)} ${sc.arch.name}. Your Founder Score is ${sc.total}/100 (${sc.band.label}).\n\nWhy you got this score.\n${sc.reasons.join('\n')}\n\nYour #1 move this week: ${sc.move.title}\n${sc.move.body}\n\nYour roadmap preview, ${sc.track.name} track.\nWeek 1: ${sc.themes[0]}\n${week1}\n${later}\nWeeks 1 and 2 are free in your 127 account. Weeks 3 and 4 come with Builder.\n\n${stateText(L, founding, optin, 'score', sc.archKey, start)}${sign}`,
    };
  }
  if (lead.source === 'day-one-stack') {
    return {
      subject: 'The Day One Stack is inside',
      text: `${hi}\n\nHere's the Day One Stack: the tools I actually use, the order to set them up, and 30 AI prompts you can copy and paste today.\n\nRead it here: ${BASE()}/stack/guide\nPDF version: ${BASE()}/funnels/day-one-stack.pdf\n\nOne rule before you open it: add a tool only when the pain of not having it is real. Day one costs $0.\n\n${stateText(L, founding, optin, 'stack', null, `${BASE()}/start?from=stack`)}\n\nNot sure where to start? Take the 90-second Founder Score: ${BASE()}/score${sign}`,
    };
  }
  if (lead.source === 'idea-test') {
    const r = d.report || {};
    const plan = (r.seven_day_test || []).map((s, i) => `Day ${i + 1}: ${s}`).join('\n');
    const qs = (r.questions_to_ask || []).map((q) => `- ${q}`).join('\n');
    const verdict = ['Build it', 'Promising', 'Rework it'].includes(d.verdict) ? d.verdict : 'Rework it';
    return {
      subject: `Your Idea Test: ${d.score}/100, ${verdict}`,
      text: `${hi}\n\nYour idea: "${String(d.idea || '').slice(0, 200)}"\nScore: ${d.score}/100. ${r.verdict_line || ''}\n\nBiggest risk: ${r.biggest_risk || ''}\n\nSharper pitch: ${r.sharper_pitch || ''}\n\nYour 7-day test:\n${plan}\n\nAsk real customers:\n${qs}\n\nWho to talk to on the inside: ${r.insider || ''}\n\n${stateText(L, founding, optin, 'idea', verdict, `${BASE()}/start?stage=validating&from=idea-test`)}\n\nTest another idea: ${BASE()}/idea-test\nTurn it into a 30-day plan: ${BASE()}/score${sign}`,
    };
  }
  return null;
}

// ---------- router ----------
module.exports = function funnels({ requireAuth, requireAdmin } = {}) {
  const r = express.Router();
  const json = express.json({ limit: '24kb' });

  r.get('/score', page('score.html', (req) => {
    const arch = String(req.query.r || '').toLowerCase();
    const s = parseInt(req.query.s, 10);
    if (ARCHETYPES.includes(arch) && s >= 0 && s <= 100) {
      const name = arch[0].toUpperCase() + arch.slice(1);
      return {
        title: `I'm a ${name}. Founder Score ${s}/100.`,
        description: 'What kind of founder are you? 7 questions, 90 seconds, free 30-day roadmap.',
        image: `/funnels/og/score-${arch}.png`,
        url: `${BASE()}/score?r=${arch}&s=${s}`,
      };
    }
    return { title: 'What kind of founder are you? · 127', description: '7 questions, 90 seconds. Get your Founder Score, your #1 move this week and a free 30-day roadmap.', image: '/funnels/og/score.png', url: `${BASE()}/score` };
  }));
  r.get('/quiz', (req, res) => res.redirect(301, '/score' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));
  r.get('/idea', (req, res) => res.redirect(301, '/idea-test' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));

  r.get('/stack', page('stack.html', () => ({ title: 'The Day One Stack · 127', description: "Eli Christiansen's founder tool stack, the order to set it up, and 30 copy-paste AI prompts. Free.", image: '/funnels/og/stack.png', url: `${BASE()}/stack` })));
  r.get('/stack/guide', page('stack-guide.html', null, { noindex: true }));

  r.get('/idea-test', page('idea-test.html', () => ({ title: 'Idea Test · 127', description: 'Score your business idea in 60 seconds on the 5 questions that decide if it can work. Free, no signup.', image: '/funnels/og/idea-test.png', url: `${BASE()}/idea-test` })));

  // Lead capture for all three funnels.
  // Anonymous quiz-start count for the revenue dashboard (events collection only, no Klaviyo).
  r.post('/api/quiz-start', json, (req, res) => {
    const quiz = ['founder-score', 'idea-test', 'day-one-stack'].includes(req.body && req.body.quiz) ? req.body.quiz : null;
    if (!quiz || limited('qstart:' + req.ip, 200)) return res.status(204).end();
    const utm = utmLib.cleanUtm(req.body);
    integrations.emit('quiz.started', { quiz, utm_source: utm.utm_source });
    // Durable per-day, per-ad count for the ad desk's joins export (events are trimmed in memory).
    utmLib.countQuizStart(quiz, utm).catch((e) => console.warn('[funnels] quiz start count', e.message));
    res.status(204).end();
  });

  r.post('/api/lead', json, async (req, res) => {
    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
    const source = ['founder-score', 'day-one-stack', 'idea-test'].includes(b.source) ? b.source : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
    if (!source) return res.status(400).json({ error: 'Unknown form.' });
    if (b.website) return res.json({ ok: true }); // honeypot
    if (limited('lead:' + req.ip, 30)) return res.status(429).json({ error: 'Too many tries. Try again tomorrow.' });

    const data = sanitize(b.data);
    const utm = sanitize(b.utm);
    let lead = findLead(email, source);
    lead = await store('leads', {
      ...(lead || {}),
      email,
      name: String(b.name || '').trim().slice(0, 60) || (lead && lead.name) || '',
      source,
      data,
      utm,
      page: String(b.page || '').slice(0, 80),
      count: ((lead && lead.count) || 0) + 1,
      // Proof of what they saw and ticked, kept 5 years (Legal).
      consent: consent.record(source, b.optin === true, ipHashOf(req)),
      consentHistory: lead && lead.consent ? [...(lead.consentHistory || []), lead.consent].slice(-20) : [],
    });

    const optIn = b.optin === true;
    integrations.emit('lead.captured', { email, name: lead.name, source, data, utm, marketing_opt_in: optIn });
    klaviyo(lead, optIn);
    metaCapi(req, lead, String(b.event_id || '').slice(0, 60));
    // Before launch, every lead joins the founding waitlist so they get the founding price.
    // The page gets the invite link back (same fields as /api/waitlist) and shows it instead of signup.
    let founding = null;
    if (launch.prelaunch()) {
      const wsource = { 'founder-score': 'quiz', 'day-one-stack': 'stack', 'idea-test': 'idea-test' }[source];
      // A friend who came in through /f/CODE carries the httpOnly ref cookie, not a URL param.
      const ref = utm.ref || cookiesOf(req).ref || null;
      try {
        const base = process.env.BASE_URL ? BASE() : `${req.protocol}://${req.get('host')}`;
        if (!process.env.BASE_URL) waitlist.useHost(base);
        const w = await waitlist.join({ email, firstName: lead.name, optIn, source: wsource, ref, utm, ip: req.ip });
        if (w && w.entry) {
          const v = launch.view();
          founding = {
            prelaunch: true,
            existing: !!w.existing,
            confirmed: !!w.entry.confirmedAt,
            referral_code: w.entry.referralCode,
            referral_link: waitlist.link(w.entry),
            status_url: `${base}/founding/status?code=${w.entry.referralCode}`,
            referrals_for_reward: v.referralsForReward,
            launch_date: v.launchDate,
            launch_at: v.launchAt,
          };
        }
      } catch (e) {
        console.warn('[funnels] waitlist', e.message);
      }
    }
    // What the result page needs to pick its block (quiz-results.md §5 to §7).
    const L = launchInfo();
    const opt = consent.optins(optIn);
    const extra = { launch: L, launch_optin: opt.launch_optin, waitlist: !!founding };
    // "Yes, send them" for someone who left the box unticked: a signed one-tap opt-in for this email only.
    if (!opt.launch_optin && consent.beforeClose()) extra.optin_sig = sign(email, 'optin');
    // Doors open: a lead who agreed to launch email joins the founding reminders (the ON wording promises it).
    if (L.state === 'B' && opt.launch_optin) integrations.syncConsent(email, true, 'KLAVIYO_WAITLIST_LIST_ID');
    if (process.env.LEAD_EMAILS !== 'klaviyo') {
      const m = deliveryEmail(lead, founding, L);
      if (m) integrations.sendEmail({ to: email, ...m });
    }
    res.json({ ok: true, ...(founding || {}), ...extra });
  });

  // "Yes, send them" on the result page (quiz-results.md §5.1): the same consent as ticking the box,
  // recorded with its own wording version. Only works with the signature /api/lead gave this email.
  r.post('/api/lead/optin', json, async (req, res) => {
    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
    const source = POSTOPT[b.source] ? b.source : null;
    if (!source || !sameSig(b.s, sign(email, 'optin'))) return res.status(400).json({ error: 'Tick the box on the form instead.' });
    if (limited('optin:' + req.ip, 20)) return res.status(429).json({ error: 'Too many tries. Try again tomorrow.' });
    const rec = { ...consent.record(source, true, ipHashOf(req)), version: `${POSTOPT[source]}-postopt-v1` };
    const lead = findLead(email, source);
    if (lead) {
      lead.consentHistory = [...(lead.consentHistory || []), lead.consent].filter(Boolean).slice(-20);
      lead.consent = rec;
      await store('leads', lead);
    }
    // Same lists a ticked box joins.
    const list = process.env.KLAVIYO_LIST_ID || process.env.KLAVIYO_WAITLIST_LIST_ID;
    if (kl.on() && list) kl.subscribe(list, email);
    const w = launch.onWaitlist(email);
    if (w && !w.marketingOptIn) {
      w.marketingOptIn = true;
      w.consentHistory = [...(w.consentHistory || []), w.consent].filter(Boolean);
      w.consent = { ...rec, page: w.consent ? w.consent.page : rec.page };
      await db.save('waitlist', w);
    }
    if (w || launchInfo().state === 'B') integrations.syncConsent(email, true, 'KLAVIYO_WAITLIST_LIST_ID');
    integrations.emit('lead.optin', { email, source, profile: { launch_optin: true, ongoing_optin: true } });
    res.json({ ok: true, launch_optin: true });
  });

  // Free AI Idea Test. No signup. Capped per visitor and per day to protect the AI budget.
  r.post('/api/idea-test', json, async (req, res) => {
    const b = req.body || {};
    const input = {
      idea: String(b.idea || '').trim().slice(0, 800),
      customer: String(b.customer || '').trim().slice(0, 300),
      money: String(b.money || '').trim().slice(0, 300),
      edge: String(b.edge || '').trim().slice(0, 300),
    };
    if (input.idea.length < 12) return res.status(400).json({ error: 'Describe the idea in a sentence or two.' });
    if (b.website) return res.status(400).json({ error: 'Something went wrong.' });
    if (limited('idea:' + req.ip, parseInt(process.env.IDEA_TEST_PER_IP || '4', 10))) {
      return res.status(429).json({ error: "You've tested a few ideas today. Come back tomorrow, or create a free account for more AI runs." });
    }
    if (limited('idea:all', parseInt(process.env.IDEA_TEST_DAILY_CAP || '150', 10))) {
      return res.status(503).json({ error: 'The Idea Test is at capacity for today. Try again tomorrow.' });
    }
    const result = await ideaTest.run(input);
    if (result.error) return res.status(502).json({ error: result.error });
    const saved = await store('ideaTests', { input, result: result.report, demo: !!result.demo, utm: sanitize(b.utm) });
    integrations.emit('idea_test.completed', { id: saved.id, score: result.report.score, verdict: result.report.verdict_label, demo: !!result.demo });
    res.json({ ok: true, id: saved.id, demo: !!result.demo, report: result.report });
  });

  if (requireAuth && requireAdmin) {
    r.get('/admin/leads.csv', requireAuth, requireAdmin, (req, res) => {
      const esc = (v) => {
        let t = String(v == null ? '' : v);
        if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; // no spreadsheet formulas from visitor text
        return `"${t.replace(/"/g, '""')}"`;
      };
      let leads = [];
      try { leads = db.all('leads'); } catch {}
      const rows = [['email', 'name', 'source', 'created', 'archetype', 'score', 'track', 'idea_verdict', 'utm_source', 'utm_campaign', 'utm_content'].map(esc).join(',')];
      for (const l of leads) {
        const d = l.data || {}, u = l.utm || {};
        rows.push([l.email, l.name, l.source, l.createdAt, d.archetype, d.score, d.track, d.verdict, u.utm_source, u.utm_campaign, u.utm_content].map(esc).join(','));
      }
      res.set('content-type', 'text/csv').set('content-disposition', 'attachment; filename="127-leads.csv"').send(rows.join('\n'));
    });
  }

  return r;
};

// Keep only small, plain values from client-sent objects.
function sanitize(o, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 3) return {};
  const out = {};
  for (const [k, v] of Object.entries(o).slice(0, 40)) {
    const key = String(k).slice(0, 40);
    if (v == null) continue;
    if (typeof v === 'number' || typeof v === 'boolean') out[key] = v;
    else if (typeof v === 'string') out[key] = v.slice(0, 1000);
    else if (Array.isArray(v)) out[key] = v.slice(0, 10).map((x) => (typeof x === 'object' ? sanitize(x, depth + 1) : String(x).slice(0, 300)));
    else out[key] = sanitize(v, depth + 1);
  }
  return out;
}

module.exports.deliveryEmail = deliveryEmail;
module.exports._test = { launchInfo, sign, scoreSummary, stateText };
