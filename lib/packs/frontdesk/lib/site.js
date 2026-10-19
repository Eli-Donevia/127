// Reads a contractor's own website for the missed-call audit: hours, services, service area,
// phone, emergency or after-hours lines, booking, chat, forms, prices, offers and any FAQ. Every
// fact keeps the words we found and the page they came from. Nothing is guessed: a fact we can't
// find is reported as "not on your website". Sample sites (.example) are built by kit leads.

const kit = require('../../_kit');
const { plain, clip, copyProblems } = kit.text;

// Their words, quoted, but never a line our copy rules would refuse (banned words, dashes, claims).
const quotable = (s) => { try { return !copyProblems(String(s || '')).length; } catch (e) { return true; } };

const NICHE = require('../data/niche.json');

function decode(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&rsquo;|&lsquo;|&apos;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&ndash;|&mdash;/gi, ' to ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// Visible text, one block per line.
function pageText(html) {
  return decode(
    String(html || '')
      .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/tr|\/dt|\/dd|\/section|\/header|\/footer)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function tagTexts(html, tag) {
  const out = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m;
  while ((m = re.exec(String(html || '')))) {
    const t = decode(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out;
}

const cleanQuote = (s, n = 140) => clip(plain(String(s || '').replace(/\s+/g, ' ').trim()), n);

// Services: list items and headings that name the trade's work, plus "What we do" lists.
function servicesFrom(pages, trade) {
  const words = ((NICHE.trades[trade] || NICHE.trades.contractors).words || []).map((w) => w.toLowerCase());
  const generic = /^(repairs?|installs?|installations?|replacements?|maintenance|inspections?|emergency service|emergency repairs?|new construction|remodels?)$/i;
  const seen = new Set();
  const out = [];
  for (const p of pages) {
    const items = [...tagTexts(p.html, 'li'), ...tagTexts(p.html, 'h2'), ...tagTexts(p.html, 'h3')];
    for (const it of items) {
      const t = it.replace(/[:.]+$/, '').trim();
      if (t.length < 3 || t.length > 60 || /[?@]|©|\bcall\b|\bcontact\b|\bhome\b|\babout\b|\bblog\b|\breviews?\b|\bcareers?\b|\bfinancing\b|\bback\b|\bmenu\b|\bview all\b|\bsee all\b|\blearn more\b|\bcoupons?\b|\bspecials?\b/i.test(t) || !quotable(t)) continue;
      const low = t.toLowerCase();
      if (!(words.some((w) => low.includes(w)) || generic.test(t))) continue;
      if (seen.has(low)) continue;
      seen.add(low);
      out.push({ text: cleanQuote(t, 60), page: p.url });
      if (out.length >= 8) return out;
    }
  }
  return out;
}

const AREA_RE = /\b(?:proudly serving|serving|we serve|service areas?|areas we serve|we cover|serving the)\b[:\s]+([^.!?\n]{3,180})/i;

function areaFrom(pages) {
  for (const p of pages) {
    for (const line of p.lines) {
      const m = line.match(AREA_RE);
      if (!m) continue;
      const raw = m[1].replace(/\b(and surrounding areas?|and nearby|and beyond|since \d{4}.*)$/i, '').trim();
      const places = raw
        .split(/,|\band\b|\/|;/i)
        .map((s) => s.replace(/^(the|all of|greater)\s+/i, '').replace(/\s+(neighborhoods?|areas?|communities|metro|metroplex|region|county areas?)$/i, '').trim())
        .filter((s) => s && s.length <= 40 && /^[A-Z]/.test(s) && !/\d{3}/.test(s) && !/\b(hvac|plumbing|heating|cooling|electric|roofing|air|repair|service|customers?|homes?|families|residents|businesses)\b/i.test(s));
      if (places.length && quotable(line)) return { places: places.slice(0, 10), quote: cleanQuote(line, 160), page: p.url };
    }
  }
  return null;
}

function hoursFrom(scanHours, pages) {
  if (scanHours) return { text: cleanQuote(scanHours.replace(/^(our )?hours:?\s*/i, ''), 100), page: pages[0] && pages[0].url };
  for (const p of pages) {
    for (const line of p.lines) {
      if (/\b(mon(day)?|tue|wed|thu|fri|sat|sun)[a-z]*\b[^.\n]{0,40}\b\d{1,2}(:\d\d)?\s*(am|pm|a\.m\.|p\.m\.)/i.test(line) && line.length < 160) return { text: cleanQuote(line.replace(/^(our )?hours:?\s*/i, ''), 100), page: p.url };
    }
  }
  return null;
}

function sentenceWith(pages, re, max = 160) {
  for (const p of pages) {
    for (const line of p.lines) {
      if (!re.test(line)) continue;
      const s = line.split(/(?<=[.!?])\s+/).find((x) => re.test(x) && x.length >= 25 && x.split(' ').length >= 5 && quotable(x));
      if (s) return { text: cleanQuote(/[.!?]$/.test(s) ? s : `${s}.`, max), page: p.url };
    }
  }
  return null;
}

// Prices exactly as a short line on their pages shows them ("Service call $89").
function pricesFrom(pages) {
  const out = [];
  for (const p of pages) {
    for (const line of p.lines) {
      if (/\$\s?\d/.test(line) && line.length <= 45 && !/\b(only|save|off|warranty|financ|coupon|special|get a)\b/i.test(line) && quotable(line) && !out.includes(line)) out.push(cleanQuote(line, 45));
      if (out.length >= 4) return out;
    }
  }
  return out;
}

// Questions they already answer: <dt>/<h3>/<summary>/<strong> ending in "?" with the next text.
function faqFrom(pages) {
  const out = [];
  for (const p of pages) {
    const html = String(p.html || '');
    const re = /<(h[2-4]|dt|summary|strong|b|p)[^>]*>([^<]{8,140}\?)\s*<\/\1>\s*(?:<\/[a-z]+>\s*)*<(p|dd|div)[^>]*>([\s\S]{10,600}?)<\/\3>/gi;
    let m;
    while ((m = re.exec(html))) {
      const q = cleanQuote(decode(m[2]), 120);
      const a = cleanQuote(decode(m[4].replace(/<[^>]+>/g, ' ')), 280);
      if (q && a && quotable(q) && quotable(a) && !out.some((x) => x.q === q)) out.push({ q, a, page: p.url });
      if (out.length >= 6) return out;
    }
  }
  return out;
}

async function getPage(ctx, url) {
  if (!url) return null;
  const r = await kit.web.fetchPage(ctx, url, { timeoutMs: 9000, maxBytes: 900000 });
  if (!r || !r.html) return null;
  return { url: r.url || url, html: r.html, lines: pageText(r.html) };
}

// The site facts the audit is built from. lead: a kit leads lead (its scan is lead.site).
async function readSite(ctx, { website, scan, trade = 'contractors', now } = {}) {
  const leadsKit = kit.leads;
  const url = website && kit.web.normalizeUrl(website);
  const checked = new Date(now || (ctx && ctx.now ? ctx.now() : Date.now())).toISOString().slice(0, 10);
  if (!url) return { reachable: false, reason: 'No website listed.', checked, pages: [], facts: emptyFacts() };
  let s = scan || null;
  const pages = [];
  let sample = false;
  if (leadsKit.isSampleUrl(url)) {
    sample = true;
    const year = new Date(checked).getUTCFullYear();
    const built = leadsKit.sampleSiteHtml(url, { year });
    if (!s) s = leadsKit.sampleScan(url, { year });
    if (s && s.reachable) pages.push({ url: built.finalUrl, html: built.html, lines: pageText(built.html) });
  } else {
    if (!s || s.reachable === undefined) s = await leadsKit.scanFor(ctx, url);
    if (s && s.reachable) {
      const home = await getPage(ctx, s.url || url);
      if (home) pages.push(home);
      const links = s.links || {};
      const extra = [links.services, links.contact, links.about].filter(Boolean).filter((u, i, a) => a.indexOf(u) === i).slice(0, 3);
      for (const u of extra) {
        if (pages.some((p) => p.url === u)) continue;
        const pg = await getPage(ctx, u);
        if (pg) pages.push(pg);
      }
    }
  }
  if (!s || !s.reachable) return { reachable: false, reason: (s && s.reason) || "Couldn't read the website.", url, checked, pages: [], sample, facts: emptyFacts() };
  const phones = (s.contacts && s.contacts.phones) || [];
  const emails = (s.contacts && s.contacts.emails) || [];
  const booking = (s.booking || []).map((b) => (typeof b === 'string' ? b : b.name)).filter(Boolean);
  const facts = {
    name: leadsKit.siteName(s) || '',
    phone: phones[0] || '',
    tapToCall: !!s.tapToCall,
    email: emails[0] || '',
    hours: hoursFrom(s.hours, pages),
    services: servicesFrom(pages, trade),
    area: areaFrom(pages),
    emergency: sentenceWith(pages, /\b(24\/7|24 hours|24-hour|emergency|after[- ]hours)/i),
    licensed: sentenceWith(pages, /\b(licensed|insured|bonded)\b/i),
    booking: booking.length ? { tools: booking.slice(0, 2), link: (s.links && s.links.book) || null } : null,
    chat: (s.chat || []).map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean).slice(0, 2),
    forms: Number(s.forms) || 0,
    prices: pricesFrom(pages),
    offer: s.offer && s.offer.kind !== 'none' && s.offer.text ? cleanQuote(s.offer.text, 80) : '',
    faq: faqFrom(pages),
    owner: (leadsKit.ownerOf(s) || {}).first || '',
    colors: s.colors || {},
  };
  return { reachable: true, url: s.url || url, domain: s.domain || kit.web.domainOf(url), checked, pages: pages.map((p) => p.url), pagesRead: pages.length, sample, facts };
}

function emptyFacts() {
  return { name: '', phone: '', tapToCall: false, email: '', hours: null, services: [], area: null, emergency: null, licensed: null, booking: null, chat: [], forms: 0, prices: [], offer: '', faq: [], owner: '', colors: {} };
}

module.exports = { readSite, pageText, servicesFrom, areaFrom, hoursFrom, faqFrom, pricesFrom, sentenceWith, emptyFacts };
