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
//   META_PIXEL_ID, TIKTOK_PIXEL_ID         ad pixels on funnel pages (Lead event fires on email submit)
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

function trackers() {
  const out = [];
  if (process.env.PLAUSIBLE_DOMAIN) {
    out.push(`<script defer data-domain="${escAttr(process.env.PLAUSIBLE_DOMAIN)}" src="https://plausible.io/js/script.js"></script>`);
    out.push('<script>window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}</script>');
  }
  if (process.env.META_PIXEL_ID) {
    const id = escAttr(process.env.META_PIXEL_ID);
    out.push(`<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');</script>`);
  }
  if (process.env.TIKTOK_PIXEL_ID) {
    const id = escAttr(process.env.TIKTOK_PIXEL_ID);
    out.push(`<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${id}');ttq.page();}(window,document,'ttq');</script>`);
  }
  if (process.env.KLAVIYO_PUBLIC_KEY) {
    out.push(`<script async src="https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${escAttr(process.env.KLAVIYO_PUBLIC_KEY)}"></script>`);
  }
  return out.join('\n');
}

function page(file, og, { noindex = false } = {}) {
  return (req, res) => {
    let html = readPage(file);
    if (og) html = html.replace(/<!--OG-->[\s\S]*?<!--\/OG-->/, ogBlock(og(req)));
    html = html.replace('<!--TRACKERS-->', trackers() + (noindex ? '\n<meta name="robots" content="noindex">' : ''));
    res.set('cache-control', 'no-cache').type('html').send(html);
  };
}

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
  await kl.track('127 Lead Captured', lead.email, props, { first_name: lead.name || undefined, ['127 ' + lead.source]: true, ...profileProps(lead) });
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

// ---------- Meta Conversions API (server-side Lead, deduped with the browser pixel by event_id) ----------
async function metaCapi(req, lead, eventId) {
  const pixel = process.env.META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return;
  const cookies = Object.fromEntries(String(req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
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

// ---------- delivery emails (Resend), unless Klaviyo flows send them ----------
function deliveryEmail(lead) {
  const hi = `Hi ${lead.name || 'there'},`;
  const sign = '\n\nMake today day one.\nEli\n127\n\nUnless the Lord builds the house, the builders labor in vain. (Psalm 127:1)';
  const d = lead.data || {};
  if (lead.source === 'founder-score') {
    return {
      subject: `Your Founder Score: ${d.archetype || 'your result'}, ${d.score ?? ''}/100`,
      text: `${hi}\n\nYou're a ${d.archetype}. Your Founder Score is ${d.score}/100, on the ${d.track} track.\n\nYour full 30-day roadmap is here, with week one ready to start today:\n${BASE()}/score\n\nWant it to track your progress and give you the templates for every step? Save it to a free account (your answers carry over):\n${BASE()}/start?stage=${encodeURIComponent(d.stage || '')}&from=score${sign}`,
    };
  }
  if (lead.source === 'day-one-stack') {
    return {
      subject: 'The Day One Stack is inside',
      text: `${hi}\n\nHere's the Day One Stack: the tools I actually use, the order to set them up, and 30 AI prompts you can copy and paste today.\n\nRead it here: ${BASE()}/stack/guide\nPDF version: ${BASE()}/funnels/day-one-stack.pdf\n\nOne rule before you open it: add a tool only when the pain of not having it is real. Day one costs $0.\n\nNot sure where to start? Take the 90-second Founder Score and get a 30-day roadmap: ${BASE()}/score${sign}`,
    };
  }
  if (lead.source === 'idea-test') {
    const r = d.report || {};
    const plan = (r.seven_day_test || []).map((s, i) => `Day ${i + 1}: ${s}`).join('\n');
    const qs = (r.questions_to_ask || []).map((q) => `- ${q}`).join('\n');
    return {
      subject: `Your Idea Test: ${d.score}/100, ${d.verdict || ''}`.trim(),
      text: `${hi}\n\nYour idea: "${String(d.idea || '').slice(0, 200)}"\nScore: ${d.score}/100. ${r.verdict_line || ''}\n\nBiggest risk: ${r.biggest_risk || ''}\n\nSharper pitch: ${r.sharper_pitch || ''}\n\nYour 7-day test:\n${plan}\n\nAsk real customers:\n${qs}\n\nWho to talk to on the inside: ${r.insider || ''}\n\nTest another idea: ${BASE()}/idea-test\nTurn it into a 30-day plan: ${BASE()}/score${sign}`,
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

  r.get('/idea-test', page('idea-test.html', () => ({ title: 'Idea Test · 127', description: 'Score your business idea in 60 seconds on the six questions that decide if it can work. Free, no signup.', image: '/funnels/og/idea-test.png', url: `${BASE()}/idea-test` })));

  // Lead capture for all three funnels.
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
    });

    const optIn = b.optin === true;
    integrations.emit('lead.captured', { email, name: lead.name, source, data, utm, marketing_opt_in: optIn });
    klaviyo(lead, optIn);
    metaCapi(req, lead, String(b.event_id || '').slice(0, 60));
    // Before launch, every lead joins the founding waitlist so they get the founding price.
    if (launch.prelaunch()) {
      const wsource = { 'founder-score': 'quiz', 'day-one-stack': 'stack', 'idea-test': 'idea-test' }[source];
      waitlist.join({ email, firstName: lead.name, optIn, source: wsource, ref: utm.ref, utm, ip: req.ip }).catch((e) => console.warn('[funnels] waitlist', e.message));
    }
    if (process.env.LEAD_EMAILS !== 'klaviyo') {
      const m = deliveryEmail(lead);
      if (m) integrations.sendEmail({ to: email, ...m });
    }
    res.json({ ok: true });
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
