// Fix my website (FIX_MY_SITE, lib/doors.js): reads a business's own website the way a visitor sees it and turns what
// it says into the site pack's facts and words, so a design can rebuild it with the owner's own words and photos.
// The owner ticked "I own or run this website" first. Reads go through the door's guarded fetch (Legal G3's rules for
// the store audit: public pages only, at most 50 requests, never a cart, checkout, account or login page) and follow
// robots.txt. Nothing is invented: what the site doesn't say stays empty and the design leaves that part out.
//
// readSite(ctx, url) -> { ok, url, domain, facts, copy, photos, before, kept } or { ok: false, status, reason }
// fixesFor(read) -> what the rebuild fixes, each from something read off their homepage.

const fs = require('fs');
const path = require('path');
const { web, text, media } = require('../../_kit');
const scan = require('../../_kit/scan');

const MORE_PAGES = 4; // after the homepage: about, services or menu, contact, reviews
const PHOTOS = 6;
const TRIES = 10; // photo downloads at most
const PHOTO_BYTES = 4e6;
const PHOTO_WIDE = 1600;

const clean = (s) => text.plain(String(s == null ? '' : s)).replace(/\s+/g, ' ').trim();
const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Mostly capitals ("WELCOME TO FERN HILL") reads as shouting in a design's type: sentence case instead.
const calm = (s) => (/[A-Z]/.test(s) && s.replace(/[^A-Za-z]/g, '').length > 6 && s === s.toUpperCase() ? text.sentenceCase(s.toLowerCase()) : s);
// The start of a line up to n characters, cut after a clause or a word (never with "...").
function upTo(s, n) {
  const t = clean(s);
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const at = cut.lastIndexOf(',') > n * 0.5 ? cut.lastIndexOf(',') : cut.lastIndexOf(' ');
  return cut.slice(0, at).replace(/\s+(?:and|or|the|a|an|with|for|of|in|to|by|at|from|our|your)$/i, '').replace(/[\s,;:]+$/, '');
}
// Whole sentences up to n characters (never cut mid-sentence with "...").
function sentences(s, n) {
  const all = clean(s).match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [];
  let out = '';
  for (const x of all.map((t) => t.trim())) {
    if (!out && x.length > n) return '';
    if ((out + ' ' + x).trim().length > n) break;
    out = (out + ' ' + x).trim();
  }
  return out;
}

// ---------- what a page says ----------

// JSON-LD on the page, flattened (@graph and lists), the bad blocks skipped.
function jsonLd(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let j;
    try {
      j = JSON.parse(m[1].trim().replace(/^<!--|-->$/g, ''));
    } catch {
      continue;
    }
    const walk = (x) => {
      if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === 'object') {
        out.push(x);
        if (x['@graph']) walk(x['@graph']);
      }
    };
    walk(j);
  }
  return out;
}
const typesOf = (o) => [].concat((o && o['@type']) || []).map(String);
const NOT_BIZ = /^(WebSite|WebPage|BreadcrumbList|ListItem|ItemList|ImageObject|SearchAction|Person|Product|Offer|AggregateOffer|FAQPage|Question|Answer|Article|BlogPosting|NewsArticle|VideoObject|SiteNavigationElement|ReadAction|EntryPoint|PostalAddress|GeoCoordinates|OpeningHoursSpecification|AggregateRating|Review|Rating|ContactPoint|CollectionPage|AboutPage|ContactPage|Event)$/;
// The business itself: a LocalBusiness, an Organization or one of their kinds, with a name.
function bizOf(objs) {
  const named = objs.filter((o) => typeof o.name === 'string' && o.name.trim() && typesOf(o).length && !typesOf(o).every((t) => NOT_BIZ.test(t)));
  return named.find((o) => o.address || o.telephone || o.openingHours || o.openingHoursSpecification) || named[0] || null;
}
// "HairSalon" -> "Hair salon". The broad kinds say nothing about the business.
function kindOf(biz) {
  const t = typesOf(biz).find((x) => !/^(LocalBusiness|Organization|Corporation|ProfessionalService|Store|Place|Thing|Service)$/.test(x) && !NOT_BIZ.test(x));
  return t ? text.sentenceCase(t.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()) : '';
}

const DAY = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun' };
// "17:00" -> "5pm", "08:30" -> "8:30am".
function t12(hm) {
  const m = String(hm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(hm || '');
  const h = Number(m[1]) % 24;
  return `${h % 12 || 12}${m[2] === '00' ? '' : `:${m[2]}`}${h < 12 ? 'am' : 'pm'}`;
}
// schema.org opening hours in the words hours.js reads ("Mon, Tue 8am to 5pm; Sat 9am to 1pm").
function hoursOfLd(biz) {
  if (!biz) return '';
  const spec = [].concat(biz.openingHoursSpecification || []).filter((s) => s && s.opens);
  if (spec.length) {
    return spec
      .map((s) => {
        const days = [].concat(s.dayOfWeek || []).map((d) => String(d).replace(/^https?:\/\/schema\.org\//, '').slice(0, 3)).filter(Boolean);
        return days.length ? `${days.join(', ')} ${t12(s.opens)} to ${t12(s.closes)}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }
  return [].concat(biz.openingHours || []).join('; ').replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (d) => DAY[d]).replace(/\b\d{1,2}:\d{2}\b/g, t12);
}
// Hours written on the page: the lines after the word "hours" that hours.js can read.
function hoursOfText(t) {
  const { parseHours } = require('./hours');
  for (const m of String(t).matchAll(/\b(?:hours|we'?re open|open)\b[^\n]{0,4}/gi)) {
    const near = String(t).slice(m.index, m.index + 260).replace(/\n/g, ' ');
    const h = parseHours(near);
    if (h.rows && h.rows.length) return h.rows.map((r) => `${r.days} ${r.time}`).join('; ');
  }
  return '';
}

// US phone numbers written as text (many sites never make them tap to call).
function phonesOfText(t) {
  const out = [];
  for (const m of String(t).matchAll(/(?:\+?1[\s.-]?)?\(?\b([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})\b/g)) {
    const d = `${m[1]}${m[2]}${m[3]}`;
    if (!scan.fictionalPhone(d) && !out.includes(d)) out.push(d);
  }
  return out;
}
// A US street address: "123 Main St, Des Moines, IA 50309".
const ADDRESS = /\b(\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,5}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway|Hwy|Highway|Cir|Circle|Ter|Terrace|Trl|Trail|Sq|Square)\.?(?:,?\s*(?:Suite|Ste\.?|Unit|#)\s*[\w-]+)?),?\s+([A-Z][A-Za-z.' ]{1,30}?),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/;
function addressOf(biz, t) {
  const a = biz && biz.address;
  if (a && typeof a === 'object' && (a.streetAddress || a.addressLocality)) {
    const street = clean(a.streetAddress), city = clean(a.addressLocality), region = clean(a.addressRegion), zip = clean(a.postalCode);
    return { address: [street, city, [region, zip].filter(Boolean).join(' ')].filter(Boolean).join(', '), city, region };
  }
  const m = String(t).replace(/\n/g, ' ').match(ADDRESS);
  if (m) return { address: `${clean(m[1])}, ${clean(m[2])}, ${m[3]} ${m[4]}`, city: clean(m[2]), region: m[3] };
  if (typeof a === 'string' && a.trim()) return { address: clean(a), city: '', region: '' };
  return { address: '', city: '', region: '' };
}

// The page cut at its headings: each heading with the paragraphs and list items under it. Navigation, forms and the
// footer stay out (the footer's contact details are read from the whole page).
function sectionsOf(html) {
  const body = String(html)
    .replace(/<(script|style|noscript|svg|template|iframe|nav|form|select|button)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, (h) => (/<h1\b/i.test(h) ? h : ' '));
  return body.split(/(?=<h[1-4]\b)/i).map((part) => {
    const m = part.match(/^<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/i);
    const rest = m ? part.slice(m[0].length) : part;
    const paras = (rest.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []).map((p) => clean(scan.textOf(p))).filter((p) => words(p) >= 4);
    const lines = paras.length ? paras : scan.textOf(rest).split('\n').map(clean).filter((l) => words(l) >= 8);
    const items = (rest.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || []).map((l) => clean(scan.textOf(l))).filter((l) => l && words(l) <= 14);
    return { level: m ? Number(m[1]) : 0, heading: m ? calm(clean(scan.textOf(m[2]))) : '', paras: lines, items, html: rest };
  });
}

// Headings that name a part of a page, not a service.
const GENERIC = /^(home|about|about us|our story|who we are|contact|contact us|get in touch|reach us|services|our services|what we do|what we offer|testimonials|reviews|what (our )?(clients|customers|people) say|faq|faqs|frequently asked questions|gallery|our work|portfolio|blog|news|latest news|hours|our hours|location|locations|find us|visit us|follow us|menu|our menu|book now|book online|schedule|team|our team|meet the team|why choose us|why us|welcome|quick links|links|newsletter|subscribe|sign up|join us|careers|privacy|privacy policy|terms|cart|shop|store|search|share|log ?in|areas we serve|service areas?|get started|learn more|read more|call us|call now|request a quote|get a quote|free estimate|thank you|thanks)\b[\s!.:?]*$/i;
const SERVICE_HEAD = /\b(services?|what we (?:do|offer|make|bake|sell|cook|serve|build|fix|clean|teach)|offerings?|treatments?|menu|classes|programs?|packages?|pricing|prices|rates|specialt(?:y|ies)|solutions|repairs?|products?)\b/i;
const PRICE = /\$\s?\d[\d,]*(?:\.\d{2})?(?:\s*(?:\/|per\s+)(?:hr|hour|mo|month|session|class|visit|person|night))?/i;
const ABOUT_HEAD = /\b(about|our story|who we are|meet|our mission|history|why choose|why us)\b/i;

// Services: the business's own list, from schema.org, a section that lists them, or the cards under its heading.
function servicesOf(biz, homeSections, servicePages) {
  const out = [];
  // "Sourdough loaf, $9" is the name "Sourdough loaf" at $9: the price comes out of the name and the line under it.
  const add = (name, desc, price) => {
    const p = price ? clean(price).replace(/\$\s+/, '$') : '';
    const bare = p.replace(/^(?:from|starting at|starts at)\s+/i, '');
    const strip = (t) => clean(p ? clean(t).replace(new RegExp(`[\\s,(–—-]*(?:\\b(?:from|starting at|starts at)\\s+)?${escRe(bare)}\\)?`, 'i'), ' ') : t);
    const n = calm(strip(name)).replace(/[.:!,]+$/, '');
    if (!n || words(n) > 8 || n.length > 60 || GENERIC.test(n) || out.some((s) => squash(s.name) === squash(n))) return;
    out.push({ name: n, desc: sentences(strip(desc), 140), price: p });
  };
  const priceIn = (t) => (String(t).match(new RegExp(`(?:\\b(?:from|starting at|starts at)\\s+)?(?:${PRICE.source})`, 'i')) || [])[0];
  const catalog = biz && biz.hasOfferCatalog && [].concat(biz.hasOfferCatalog.itemListElement || []);
  for (const it of catalog || []) {
    const o = (it && (it.itemOffered || it)) || {};
    add(o.name, o.description, it.price != null ? `$${it.price}` : '');
  }
  for (const it of [].concat((biz && biz.makesOffer) || [])) add(((it && it.itemOffered) || it || {}).name, ((it && it.itemOffered) || it || {}).description, it && it.price != null ? `$${it.price}` : '');
  const fromSections = (secs, all) => {
    for (let i = 0; i < secs.length && out.length < 8; i++) {
      const s = secs[i];
      if (!(all || SERVICE_HEAD.test(s.heading))) continue;
      // A list under the heading ("Drain cleaning", "Water heaters")...
      for (const it of s.items) add(it.split(/\s*[:|]\s*|\s+[-–—]\s+/)[0], it.split(/\s*[:|]\s*|\s+[-–—]\s+/).slice(1).join(' '), priceIn(it));
      // ...or the cards under it: the smaller headings that follow, each with its first line.
      for (let j = i + 1; j < secs.length && secs[j].level > s.level && out.length < 8; j++) {
        const c = secs[j];
        add(c.heading, c.paras[0] || '', priceIn(`${c.heading} ${c.paras.join(' ')}`));
      }
      if (all) {
        // A services page: its own headings are the services.
        if (s.level >= 2) add(s.heading, s.paras[0] || '', priceIn(`${s.heading} ${s.paras.join(' ')}`));
      }
    }
  };
  if (out.length < 3) fromSections(homeSections, false);
  for (const page of servicePages) if (out.length < 3) fromSections(page, true);
  return out.slice(0, 8);
}

// Testimonials written as text on the site's own pages, word for word with the name as the site shows it (Legal G8:
// never edited, shortened, merged or given stars). Only the spaces are tidied and the quote marks around a quote go,
// since the design sets it as a quote. Review widgets and embeds (Google, Yelp, Facebook, Trustpilot, a post from
// Instagram or X) are left out: their terms bar copying.
const WIDGET = /google|yelp|facebook|trustpilot|trustindex|elfsight|birdeye|podium|reviews\.io|judge\.?me|yotpo|stamped|grw-|ti-widget|instagram|twitter|tiktok|\bx\.com|embed/i;
const exact = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
// Is this spot inside someone else's widget or embed? The elements still open before it (read back a little way) say.
const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;
function inWidget(html, at) {
  const open = [];
  for (const t of String(html).slice(Math.max(0, at - 4000), at).matchAll(/<(\/?)([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const tag = t[2].toLowerCase();
    if (VOID.test(tag) || /\/\s*$/.test(t[3])) continue;
    if (!t[1]) open.push({ tag, attrs: t[3] });
    else {
      const i = open.map((o) => o.tag).lastIndexOf(tag);
      if (i >= 0) open.length = i;
    }
  }
  return open.some((o) => WIDGET.test(o.attrs));
}
function reviewsOf(pagesHtml) {
  const out = [];
  const add = (name, quote) => {
    const q = exact(quote).replace(/^["“](.*)["”]$/s, '$1').trim();
    const n = exact(name).replace(/^[-–—~]+\s*/, '');
    if (words(q) < 8 || q.length > 600 || out.some((r) => r.quote === q)) return;
    out.push({ name: n && words(n) <= 5 && /^[A-Z]/.test(n) && !/read more|see more|review/i.test(n) ? n : '', quote: q });
  };
  for (const html of pagesHtml) {
    for (const m of String(html).matchAll(/<blockquote\b([^>]*)>([\s\S]*?)<\/blockquote>(?=\s*(?:<(?!blockquote\b)[^>]+>\s*){0,4}([^<]{0,60}))/gi)) {
      if (WIDGET.test(m[1]) || WIDGET.test(m[2].slice(0, 400)) || inWidget(html, m.index)) continue;
      const cite = (m[2].match(/<(?:cite|footer)\b[^>]*>([\s\S]*?)<\/(?:cite|footer)>/i) || [])[1];
      add(cite ? scan.textOf(cite) : m[3], scan.textOf(m[2].replace(/<(cite|footer)\b[\s\S]*?<\/\1>/gi, ' ')));
    }
    for (const m of String(html).matchAll(/<(div|li|figure|article)\b([^>]*class="[^"]*(?:testimonial|review)[^"]*"[^>]*)>([\s\S]{0,1600}?)<\/\1>/gi)) {
      if (WIDGET.test(m[2]) || WIDGET.test(m[3]) || inWidget(html, m.index)) continue;
      const lines = scan.textOf(m[3]).split('\n').map(exact).filter(Boolean);
      const quote = lines.filter((l) => words(l) >= 8).sort((a, b) => b.length - a.length)[0];
      const name = lines.find((l) => l !== quote && words(l.replace(/^[-–—~]+\s*/, '')) <= 4 && /^[-–—~\s]*[A-Z]/.test(l));
      if (quote) add(name || '', quote);
    }
    if (out.length >= 3) break;
  }
  return out.slice(0, 3);
}

// ---------- photos ----------

const NOT_PHOTO = /logo|icon|sprite|favicon|badge|avatar|pixel|1x1|blank|placeholder|spinner|loader|payment|visa|mastercard|paypal|stripe|bbb|arrow|emoji|flag|star|rating|seal|award|trust|as-?seen|featured-in|press|map|qr/i;
// Images from someone else's service on the page: an Instagram or Facebook feed, a video's thumbnail, a map, a review
// widget, and stock photo previews (watermarked). Legal G8 leaves them out.
const NOT_THEIRS = /(^|\.)(cdninstagram\.com|instagram\.com|fbcdn\.net|facebook\.com|ytimg\.com|youtube\.com|vimeocdn\.com|tiktokcdn\.com|twimg\.com|googleusercontent\.com|ggpht\.com|gstatic\.com|googleapis\.com|yelpcdn\.com|yelp\.com|trustpilot\.com|shutterstock\.com|istockphoto\.com|gettyimages\.com|stock\.adobe\.com|ftcdn\.net|depositphotos\.com|dreamstime\.com|123rf\.com|alamy\.com|bigstockphoto\.com)$/i;
// Photo addresses in page order: the share image, then each <img> (its largest srcset entry) and inline backgrounds.
// Only files the pages themselves show (Legal G8: no browsing the image host for others).
function photoCandidates(pages) {
  const seen = new Set();
  const out = [];
  const push = (raw, base, alt, w) => {
    const abs = raw && !/^data:/i.test(raw) ? (() => { try { return new URL(raw.trim(), base).toString(); } catch { return null; } })() : null;
    if (!abs || !/^https?:/i.test(abs) || /\.(svg|gif|ico)(\?|$)/i.test(abs) || NOT_PHOTO.test(`${abs.replace(/^https?:\/\/[^/]+/, '')} ${alt || ''}`)) return;
    if (NOT_THEIRS.test(new URL(abs).hostname) || (w && w < 300)) return;
    const u = abs;
    const key = u.replace(/\?(?!format=).*$/, '');
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url: u, alt: clean(alt || '') });
  };
  pages.forEach((p, i) => {
    if (i === 0) push(scan.meta(p.html, 'og:image') || scan.meta(p.html, 'twitter:image'), p.url, '', 0);
    for (const m of String(p.html).matchAll(/<img\b[^>]*>|style="[^"]*background(?:-image)?\s*:[^"]*url\(([^)]+)\)[^"]*"/gi)) {
      if (m[1]) {
        push(m[1].replace(/&quot;/g, '"').replace(/^['"\s]+|['"\s]+$/g, ''), p.url, '', 0);
        continue;
      }
      const t = m[0];
      const set = scan.attr(t, 'srcset') || scan.attr(t, 'data-srcset') || '';
      const best = set
        .split(',')
        .map((x) => x.trim().split(/\s+/))
        .filter((x) => x[0])
        .sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0))[0];
      const src = (best && best[0]) || scan.attr(t, 'data-src') || scan.attr(t, 'data-lazy-src') || scan.attr(t, 'src');
      const cls = `${scan.attr(t, 'class') || ''} ${scan.attr(t, 'id') || ''}`;
      if (NOT_PHOTO.test(cls)) continue;
      push(src, p.url, scan.attr(t, 'alt'), parseInt(scan.attr(t, 'width'), 10) || 0);
    }
  });
  return out;
}

async function bytesOf(ctx, url, max) {
  const res = await ctx.fetch(url, { redirect: 'follow', headers: { 'User-Agent': web.UA, Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*;q=0.5' } });
  if (!res.ok) return null;
  const type = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
  if (type && !/^image\/(jpe?g|png|webp)/i.test(type)) return null;
  const chunks = [];
  let size = 0;
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > max ? null : buf;
}

// Up to PHOTOS of their photos as JPEGs no wider than PHOTO_WIDE, the small ones (icons, thumbnails) left out.
// Without ffmpeg only their JPEGs come over, as they are.
async function photosOf(ctx, cands) {
  const out = [];
  const can = media.hasFfmpeg();
  const dir = can ? fs.mkdtempSync(path.join(typeof ctx.tmpdir === 'function' ? ctx.tmpdir() : require('os').tmpdir(), 'fix-')) : null;
  let tries = 0;
  for (const c of cands) {
    if (out.length >= PHOTOS || tries >= TRIES) break;
    tries += 1;
    let buf;
    try {
      buf = await bytesOf(ctx, c.url, PHOTO_BYTES);
    } catch {
      buf = null;
    }
    if (!buf || buf.length < 6000) continue;
    const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
    if (!can) {
      if (jpeg && buf.length < 1.2e6) out.push({ jpg: buf.toString('base64'), alt: c.alt, from: c.url });
      continue;
    }
    try {
      const src = path.join(dir, `in${tries}`);
      const dst = path.join(dir, `out${tries}.jpg`);
      fs.writeFileSync(src, buf);
      const info = await media.probe(src, { timeoutSec: 20, signal: ctx.signal });
      if (!info.width || Math.max(info.width, info.height) < 500) continue;
      await media.ffmpeg(['-i', src, '-frames:v', '1', '-vf', `scale='min(${PHOTO_WIDE},iw)':-2`, '-q:v', '4', dst], { timeoutSec: 30, signal: ctx.signal });
      out.push({ jpg: fs.readFileSync(dst).toString('base64'), alt: c.alt, from: c.url, w: Math.min(PHOTO_WIDE, info.width), h: Math.round((Math.min(PHOTO_WIDE, info.width) / info.width) * info.height) });
    } catch {
      /* a photo ffmpeg can't read (AVIF, a broken file) is left out */
    }
  }
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

// ---------- reading the site ----------

const NAMES = { home: /^(home|homepage|welcome|index)$/i };
function nameOf(biz, home, html, domain) {
  if (biz && clean(biz.name).length <= 60) return clean(biz.name);
  const site = clean(scan.meta(html, 'og:site_name'));
  if (site && site.length <= 60 && !NAMES.home.test(site)) return site;
  const label = squash(domain.split('.')[0]);
  const parts = clean(home.title || '').split(/\s+[|\-·:•»~]\s+|\s*[|•»]\s*|,\s+/).map(clean).filter((p) => p && !NAMES.home.test(p));
  const match = parts.find((p) => squash(p).length > 2 && (label.includes(squash(p)) || squash(p).includes(label)));
  if (match) return match;
  // "Plumber in Des Moines | Joe's Plumbing": the shorter part is the name.
  if (parts.length > 1) return [...parts].sort((a, b) => a.length - b.length)[0];
  if (parts.length === 1 && words(parts[0]) <= 6) return parts[0];
  return text.sentenceCase(domain.split('.')[0].replace(/[-_]+/g, ' '));
}

// What it does, in a line (it also picks the designs): their own description's first sentence, else their kind.
function whatOf(biz, home, name, city) {
  // What the business is, short, the way the builder takes it: "Crumb & Co. is a neighborhood bakery in Des Moines
  // baking sourdough, pastries..." reads "Neighborhood bakery baking sourdough". The business's own name and "is a" come
  // off, and so does the city (the site says where it is on its own), so nothing is cut short with "...".
  const first = squash(name).slice(0, 4);
  const lead = (s) => {
    let t = clean(s);
    // Their name can carry a period of its own ("Crumb & Co."), so it's matched before the first sentence is cut.
    const m = t.match(/^(.{2,60}?)\s*,?\s+(?:is|are)\s+(?:an?|the|your)\s+/i);
    if (m && first && squash(m[1]).startsWith(first)) t = t.slice(m[0].length);
    else if (first && squash(t).startsWith(first)) return '';
    t = (t.match(/^[^.!?]+/) || [''])[0];
    if (city) t = t.replace(new RegExp(`\\s*(?:,\\s*|\\b(?:in|near|around|serving|across)\\s+)(?:the\\s+)?(?:greater\\s+)?${escRe(city)}(?:\\s+(?:area|metro))?\\b`, 'gi'), '');
    return upTo(t.trim(), 60);
  };
  const d = lead((biz && biz.description) || home.description || '');
  if (words(d) >= 2) return d.charAt(0).toUpperCase() + d.slice(1);
  const kind = kindOf(biz);
  if (kind) return kind;
  const h = calm(clean(home.h1 || ''));
  return h && words(h) <= 12 && squash(h) !== squash(name) && !GENERIC.test(h) ? h : '';
}

function headlineOf(home, sections, name) {
  const h = calm(clean(home.h1 || (sections.find((s) => s.level === 1) || {}).heading || '')).replace(/[.!]+$/, '');
  if (!h || words(h) < 2 || words(h) > 14 || GENERIC.test(h) || squash(h) === squash(name) || /^welcome\b/i.test(h)) return '';
  return h;
}

function aboutOf(aboutPage, homeSections) {
  const paras = (secs) => secs.flatMap((s) => s.paras).filter((p) => words(p) >= 12 && !/cookie|privacy|copyright|all rights reserved/i.test(p));
  let ps = aboutPage ? paras(aboutPage) : [];
  if (!ps.length) ps = paras(homeSections.filter((s) => ABOUT_HEAD.test(s.heading)));
  if (!ps.length) ps = paras(homeSections).filter((p) => words(p) >= 25).sort((a, b) => b.length - a.length).slice(0, 1);
  const out = [];
  let size = 0;
  for (const p of ps) {
    const s = sentences(p, 420);
    if (!s || size + s.length > 700) break;
    out.push(s);
    size += s.length;
    if (out.length >= 3) break;
  }
  return out.join('\n\n');
}

async function page(ctx, url) {
  const p = await web.fetchPage(ctx, url, { timeoutMs: 12000, maxBytes: 1.5e6 });
  return p.html ? { url: p.url || url, html: p.html } : { url, failed: p.blocked ? 'blocked' : p.status ? `status ${p.status}` : p.error || 'not html' };
}

// photosStart: called as the photos start downloading (the door ticks its second step).
async function readSite(ctx, raw, { photosStart } = {}) {
  const url = web.normalizeUrl(raw);
  if (!url) return { ok: false, status: 'bad', reason: "That doesn't look like a website address." };
  const domain = web.domainOf(url);
  if (scan.HOSTED.test(new URL(url).hostname)) return { ok: false, status: 'hosted', reason: `${domain} is another company's site, so there's no website of yours there to rebuild.`, domain };
  let first = await page(ctx, url);
  if (!first.html && new URL(url).pathname !== '/') first = await page(ctx, `${new URL(url).origin}/`);
  if (!first.html) {
    const blocked = first.failed === 'blocked';
    return { ok: false, status: blocked ? 'blocked' : 'unreachable', reason: blocked ? 'Your website asks bots not to read it, so we left it alone.' : "We couldn't open that website.", domain };
  }
  const home = scan.parsePage(first.html, first.url);
  const parked = scan.parkedFrom(home);
  if (parked) return { ok: false, status: 'parked', reason: `That address shows "${parked}", not a working website.`, domain };
  if (home.words < 40) return { ok: false, status: 'thin', reason: 'Your website draws itself in the browser, so its pages have almost no words for us to read.', domain };

  // The pages that hold the rest: about, services (or menu or pricing), contact and reviews, on the same site.
  const finalDomain = web.domainOf(first.url);
  const want = ['about', 'services', 'menu', 'pricing', 'contact', 'reviews'].map((k) => home.links[k]).filter((u) => u && web.domainOf(u) === finalDomain);
  const urls = [...new Set(want.map((u) => u.replace(/#.*$/, '')))].filter((u) => u.replace(/\/$/, '') !== first.url.replace(/\/$/, '')).slice(0, MORE_PAGES);
  const more = [];
  for (const u of urls) {
    const p = await page(ctx, u).catch(() => ({ url: u, failed: 'error' }));
    if (p.html) more.push(p);
  }
  const pages = [first, ...more];
  const parsed = pages.map((p) => scan.parsePage(p.html, p.url));
  const merged = scan.mergePages(parsed);
  const ld = pages.flatMap((p) => jsonLd(p.html));
  const biz = bizOf(ld);
  const allText = parsed.map((p, i) => scan.textOf(pages[i].html)).join('\n');
  const sections = pages.map((p) => sectionsOf(p.html));
  const kindOfPage = (p) => Object.entries(home.links).find(([, u]) => u && u.replace(/#.*$/, '').replace(/\/$/, '') === p.url.replace(/\/$/, ''));
  const pageFor = (re) => more.findIndex((p) => {
    const k = kindOfPage(p);
    return k && re.test(k[0]);
  });
  const aboutAt = pageFor(/^about$/);
  const serviceAt = more.map((p, i) => (kindOfPage(p) && /^(services|menu|pricing)$/.test(kindOfPage(p)[0]) ? i : -1)).filter((i) => i >= 0);

  const name = nameOf(biz, home, first.html, finalDomain);
  const where = addressOf(biz, allText);
  const tel = (biz && biz.telephone && phonesOfText(biz.telephone)[0]) || merged.contacts.phones.map((p) => p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''))[0] || phonesOfText(allText)[0] || '';
  const email = (biz && typeof biz.email === 'string' && biz.email.replace(/^mailto:/i, '').trim()) || merged.contacts.emails[0] || '';
  const hours = hoursOfLd(biz) || hoursOfText(allText);
  const services = servicesOf(biz, sections[0], serviceAt.map((i) => sections[i + 1]));
  const reviews = reviewsOf(pages.map((p) => p.html));
  const socials = { ...merged.socials };
  for (const s of [].concat((biz && biz.sameAs) || [])) Object.assign(socials, Object.fromEntries(Object.entries(scan.socialsFrom(`<a href="${String(s).replace(/"/g, '')}">`, first.url)).filter(([k, v]) => v && !socials[k])));
  // How customers book or order: their booking or ordering system's own page, never a page of the old site.
  const hrefs = pages.flatMap((p) => (p.html.match(/<a\b[^>]*>/gi) || []).map((t) => scan.attr(t, 'href')).filter(Boolean).map((h) => { try { return new URL(h, p.url).toString(); } catch { return null; } }).filter((h) => h && /^https:/i.test(h)));
  const bookAt = (tier) => hrefs.find((h) => !/thumbtack|angi\.com|homeadvisor|yelp|groupon/i.test(h) && scan.BOOKING.some(([, re, t]) => (tier === 'order' ? t === 'order' : t !== 'order') && re.test(h)));
  const heroTitle = headlineOf(home, sections[0], name);
  const desc = clean(home.description || '');
  const heroSub = words(desc) >= 8 && words(desc) <= 40 && squash(desc) !== squash(heroTitle) ? sentences(desc, 200) : '';
  const about = aboutOf(aboutAt >= 0 ? sections[aboutAt + 1] : null, sections[0]);
  if (photosStart) photosStart();
  const photos = await photosOf(ctx, photoCandidates(pages));

  const facts = {
    business: name,
    what: whatOf(biz, home, name, where.city),
    city: where.city,
    region: where.region,
    address: where.address,
    phone: tel,
    email,
    hours,
    services: services.map((s) => `${s.name}${s.price ? `, ${s.price}` : ''}${s.desc ? `: ${s.desc}` : ''}`).join('\n'),
    // Word for word (facts.js reviewsExact), never through the typed-reviews parser, which tidies and shortens.
    reviewsExact: reviews.length ? reviews : null,
    booking: bookAt('book') || '',
    order: bookAt('order') || '',
    instagram: socials.instagram || '',
    facebook: socials.facebook || '',
    tiktok: socials.tiktok || '',
    youtube: socials.youtube || '',
    linkedin: socials.linkedin || '',
    x: socials.x || '',
    color: (merged.colors && merged.colors.primary) || '',
    // The rebuilt site goes up at their own address.
    siteUrl: `${new URL(first.url).origin}/`,
  };
  for (const k of Object.keys(facts)) if (!facts[k]) delete facts[k];
  const copy = {};
  if (heroTitle) copy.heroTitle = heroTitle;
  if (heroSub) copy.heroSub = heroSub;
  if (about) copy.about = about;

  const extScripts = (first.html.match(/<script\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi) || []).filter((t) => {
    const src = (t.match(/src\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    try {
      return web.domainOf(new URL(src, first.url).toString()) !== finalDomain;
    } catch {
      return false;
    }
  }).length;
  // Images a visitor sees (not a tracking pixel inside <noscript>, not a 1 pixel image), and the ones with no alt text.
  const imgs = (first.html.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ').match(/<img\b[^>]*>/gi) || []).filter((t) => !/^[01]$/.test(scan.attr(t, 'width') || '') && !/^[01]$/.test(scan.attr(t, 'height') || ''));
  // What their homepage does today, for the list of fixes.
  const before = {
    https: /^https:/i.test(first.url),
    mobile: home.mobileReady,
    h1: home.h1Count,
    description: !!desc,
    images: imgs.length,
    noAlt: imgs.filter((t) => !(scan.attr(t, 'alt') || '').trim()).length,
    tapToCall: merged.tapToCall,
    year: home.copyrightYear || null,
    schema: !!biz,
    share: !!(scan.meta(first.html, 'og:image') || scan.meta(first.html, 'twitter:image')),
    scripts: extScripts,
    platform: home.platform || null,
  };
  ctx.log(`Read ${finalDomain} (${pages.length} page${pages.length > 1 ? 's' : ''}, ${photos.length} photo${photos.length === 1 ? '' : 's'})`);
  return {
    ok: true,
    url: first.url,
    domain: finalDomain,
    pages: pages.length,
    facts,
    copy,
    photos: photos.map((p) => ({ jpg: p.jpg, alt: p.alt })),
    before,
    kept: { services: services.length, reviews: reviews.length, photos: photos.length, phone: !!tel, email: !!email, hours: !!hours, address: !!where.address, about: !!about },
  };
}

// ---------- what the rebuild fixes ----------
// Only what their homepage showed. Each line says what was there and what the new site does instead, and nothing is
// claimed about speed or sales.
function fixesFor(read, { year = new Date().getUTCFullYear() } = {}) {
  const b = read.before || {};
  const f = read.facts || {};
  const out = [];
  const add = (title, line) => out.push({ title, line });
  if (!b.mobile) add('Built for phones', "Your site didn't tell phones how to size it, so it opened zoomed out. The new one is built for phones first.");
  if (f.phone && !b.tapToCall) add('Tap to call', 'Your phone number was text only. On the new site it calls you in one tap.');
  if (!b.h1) add('One clear headline', 'Your homepage had no main headline. The new one opens with what you do.');
  else if (b.h1 > 1) add('One clear headline', `Your homepage had ${b.h1} main headlines competing. The new one has one.`);
  if (!b.description) add('A description for Google', 'Your homepage had no description for Google to show under your name. The new one has one, written from your words.');
  if (b.noAlt) add('Every photo described', `${b.noAlt} of your ${b.images} images had no description for screen readers and search. Every photo on the new site has one.`);
  if (!b.https) add('A secure address', 'Your site opened without https, so browsers can mark it "Not secure". Netlify gives the new one https free.');
  if (b.year && b.year < year - 1) add('Up to date', `Your footer still said ${b.year}. The new one shows this year.`);
  if (!b.share) add('A picture when shared', 'Links to your site showed no picture in texts and on social. The new one has a share image.');
  if (!b.schema) add('Details Google can read', 'Your site gave search engines no business details in the form they read. The new one gives them your name and contact details that way.');
  if (b.scripts > 6) add('Nothing loaded from other sites', `Your homepage loaded ${b.scripts} scripts from other sites. The new page loads none.`);
  return out.slice(0, 6);
}

// "your words, 4 photos, phone, hours and address"
function keptLine(read) {
  const k = read.kept || {};
  const items = ['your words'];
  if (k.photos) items.push(`${k.photos} photo${k.photos === 1 ? '' : 's'}`);
  if (k.services) items.push(`${k.services} service${k.services === 1 ? '' : 's'}`);
  if (k.reviews) items.push(`${k.reviews} review${k.reviews === 1 ? '' : 's'}`);
  for (const [key, label] of [['phone', 'phone'], ['email', 'email'], ['hours', 'hours'], ['address', 'address']]) if (k[key]) items.push(label);
  return text.list(items);
}

module.exports = { readSite, fixesFor, keptLine, sectionsOf, servicesOf, reviewsOf, photoCandidates, jsonLd, bizOf, nameOf, hoursOfLd, hoursOfText, addressOf, phonesOfText };
