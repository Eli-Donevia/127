// Reads a gym's own website the way a sharp sales rep would in 5 minutes, in about 3 seconds:
// where they post, whether they use video, what they book with, whether they buy ads, their real offer,
// their price, their colors and logo, and who runs the place. Public pages only, homepage plus at most
// two more (about or team, and pricing), robots.txt respected. Everything here is a fact read off the
// page; nothing is guessed about a real business.

const { getText, cached, normalizeUrl, domainOf, median, log } = require('./util');

// ---------- html helpers ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: '...' };
function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] != null ? ENTITIES[n.toLowerCase()] : m));
}
function safeChar(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return ' ';
  }
}

function textOf(html) {
  return decode(
    String(html || '')
      .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/tr)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\f\r ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function attr(tag, name) {
  const m = String(tag).match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decode(m[2] != null ? m[2] : m[3] != null ? m[3] : m[4]) : null;
}

function tags(html, name) {
  return String(html || '').match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || [];
}

function absolute(href, base) {
  try {
    const u = new URL(String(href || '').trim(), base);
    return /^https?:$/.test(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

function meta(html, key) {
  for (const t of tags(html, 'meta')) {
    const n = (attr(t, 'name') || attr(t, 'property') || '').toLowerCase();
    if (n === key) return attr(t, 'content');
  }
  return null;
}

// ---------- signals ----------

const BOOKING = [
  ['Mindbody', /mindbodyonline\.com|healcode\.com|brandedweb\.mindbody|mindbody\.io/i, 'pro'],
  ['Mariana Tek', /marianatek\.com|mariana-tek|marianaiframes/i, 'pro'],
  ['ClubReady', /clubready\.com/i, 'pro'],
  ['ABC Glofox', /glofox\.com/i, 'pro'],
  ['ABC Ignite', /abcfitness\.com|abcfinancial\.com|abcignite/i, 'pro'],
  ['Club OS', /club-os\.com/i, 'pro'],
  ['Zen Planner', /zenplanner\.com/i, 'pro'],
  ['Wodify', /wodify\.com/i, 'pro'],
  ['PushPress', /pushpress\.com/i, 'pro'],
  ['WellnessLiving', /wellnessliving\.com/i, 'pro'],
  ['Momence', /momence\.com/i, 'pro'],
  ['Arketa', /arketa\.co/i, 'pro'],
  ['Walla', /hellowalla\.com|walla\.app/i, 'pro'],
  ['bsport', /bsport\.io/i, 'pro'],
  ['Hapana', /hapana\.com/i, 'pro'],
  ['PerfectGym', /perfectgym\.com/i, 'pro'],
  ['Virtuagym', /virtuagym\.com/i, 'pro'],
  ['Triib', /triib\.com/i, 'pro'],
  ['Kicksite', /kicksite\.(com|net)/i, 'pro'],
  ['Spark Membership', /sparkmembership\.com/i, 'pro'],
  ['Gymdesk', /gymdesk\.com/i, 'basic'],
  ['TeamUp', /goteamup\.com/i, 'basic'],
  ['Punchpass', /punchpass\.com/i, 'basic'],
  ['Exercise.com', /exercise\.com\/(gym|book)|app\.exercise\.com/i, 'basic'],
  ['Trainerize', /trainerize\.(com|me)/i, 'basic'],
  ['Vagaro', /vagaro\.com/i, 'basic'],
  ['Acuity', /acuityscheduling\.com|squarespacescheduling\.com/i, 'basic'],
  ['Calendly', /calendly\.com/i, 'basic'],
];

const PLATFORMS = [
  ['Wix', /static\.wixstatic\.com|wix\.com\/|_wixCIDX|wix-warmup-data/i],
  ['Squarespace', /static1\.squarespace\.com|squarespace\.com\/|Static\.SQUARESPACE_CONTEXT/i],
  ['Shopify', /cdn\.shopify\.com/i],
  ['Webflow', /data-wf-site|webflow\.com|website-files\.com/i],
  ['GoDaddy', /img1\.wsimg\.com|godaddy/i],
  ['Duda', /irp\.cdn-website\.com|dudaone|multiscreensite/i],
  ['Weebly', /weebly\.com|editmysite\.com/i],
  ['WordPress', /wp-content\/|wp-includes\//i],
  ['Framer', /framerusercontent\.com|framer\.website/i],
];

const SOCIAL_SKIP = /^(p|reel|reels|explore|accounts|stories|tv|share|sharer|sharer\.php|plugins|dialog|tr|intent|home|login|signup|hashtag|watch|embed|results|feed|privacy|legal|about|help|policies|groups|events|pages|profile\.php|people|search)$/i;

function socialsFrom(html, base) {
  const out = { instagram: null, facebook: null, tiktok: null, youtube: null, x: null, linkedin: null };
  const hrefs = tags(html, 'a').map((t) => attr(t, 'href')).filter(Boolean);
  // Some builders keep social links in JSON blobs instead of <a> tags.
  const raw = String(html || '').match(/https?:\\?\/\\?\/(www\.)?(instagram|facebook|tiktok|youtube|twitter|x|linkedin)\.com[^"'\s<>)]*/gi) || [];
  for (const h0 of hrefs.concat(raw.map((r) => r.replace(/\\\//g, '/')))) {
    const h = absolute(h0, base);
    if (!h) continue;
    let u;
    try {
      u = new URL(h);
    } catch {
      continue;
    }
    const host = u.hostname.replace(/^(www|m|business|web)\./, '').toLowerCase();
    const seg = u.pathname.split('/').filter(Boolean);
    if (host === 'instagram.com' && seg[0] && !SOCIAL_SKIP.test(seg[0]) && !out.instagram) out.instagram = seg[0].replace(/^@/, '').toLowerCase();
    else if ((host === 'facebook.com' || host === 'fb.com') && seg[0] && !SOCIAL_SKIP.test(seg[0]) && !out.facebook) out.facebook = `https://www.facebook.com/${seg[0]}`;
    else if (host === 'tiktok.com' && seg[0] && seg[0].startsWith('@') && !out.tiktok) out.tiktok = seg[0].slice(1).toLowerCase();
    else if ((host === 'youtube.com' || host === 'youtu.be') && seg[0] && !out.youtube) {
      if (seg[0].startsWith('@')) out.youtube = `https://www.youtube.com/${seg[0]}`;
      else if (/^(channel|c|user)$/i.test(seg[0]) && seg[1]) out.youtube = `https://www.youtube.com/${seg[0]}/${seg[1]}`;
    } else if ((host === 'twitter.com' || host === 'x.com') && seg[0] && !SOCIAL_SKIP.test(seg[0]) && !out.x) out.x = seg[0].replace(/^@/, '');
    else if (host === 'linkedin.com' && /^(company|school)$/i.test(seg[0] || '') && seg[1] && !out.linkedin) out.linkedin = `https://www.linkedin.com/${seg[0]}/${seg[1]}`;
  }
  return out;
}

function videoFrom(html) {
  const s = String(html || '');
  const kinds = [];
  if (/youtube(-nocookie)?\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\//i.test(s)) kinds.push('YouTube');
  if (/player\.vimeo\.com\/video|vimeo\.com\/\d{6,}/i.test(s)) kinds.push('Vimeo');
  if (/fast\.wistia\.(com|net)|wistia_embed/i.test(s)) kinds.push('Wistia');
  if (/video\.wixstatic\.com|wix-video|"videoId"\s*:/i.test(s)) kinds.push('Wix video');
  if (/video\.squarespace-cdn\.com|sqs-video|data-block-type="32"/i.test(s)) kinds.push('Squarespace video');
  if (/<video[\s>]/i.test(s) || /\.(mp4|webm|m3u8)(\?[^"'\s]*)?["'\s)]/i.test(s)) kinds.push('Video file');
  return { onSite: kinds.length > 0, kinds };
}

function trackingFrom(html) {
  const s = String(html || '');
  return {
    metaPixel: /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*['"]init/i.test(s),
    googleAds: /googleadservices\.com|google_conversion_id|['"]AW-\d{6,}/i.test(s),
    tiktokPixel: /analytics\.tiktok\.com|ttq\.load\(/i.test(s),
    analytics: /googletagmanager\.com|google-analytics\.com|gtag\(|['"]G-[A-Z0-9]{6,}/i.test(s),
  };
}

const OFFER_RULES = [
  ['free_class', /\b(?:your\s+)?(?:first|1st)\s+(?:class|session|workout|visit|week)\s+(?:is\s+)?(?:free|on\s+us)\b|\bfree\s+(?:trial\s+|intro(?:ductory)?\s+)?(?:class|session|workout|visit|lesson)\b|\btry\s+(?:a|your\s+first)\s+class\s+(?:for\s+)?free\b/i],
  ['free_pass', /\bfree\s+(?:\d+|one|two|three|seven)?[- ]?(?:day|week)\s+(?:pass|trial)\b|\b(?:\d+|one|two|three|seven)[- ]day\s+(?:free\s+)?(?:pass|trial)\b|\bfree\s+(?:guest\s+)?pass\b|\bfree\s+week\b/i],
  ['free_consult', /\bfree\s+(?:consult(?:ation)?|assessment|fitness\s+assessment|strategy\s+session|intro\s+session)\b|\bno[- ]sweat\s+intro\b/i],
  ['intro_price', /\b(?:intro(?:ductory)?|new\s+(?:member|client|student))\s+(?:offer|special|deal|price|pricing|pack(?:age)?)\b|\$\s?\d{1,3}\s+for\s+(?:\d+|one|two|three|four)\s+(?:days?|weeks?|classes|sessions)\b/i],
  ['challenge', /\b\d{1,2}[- ](?:day|week)\s+(?:challenge|transformation|jumpstart|kickstart)\b/i],
];

function offerFrom(text) {
  const t = String(text || '');
  for (const [kind, re] of OFFER_RULES) {
    const m = t.match(re);
    if (m) {
      const i = m.index;
      const snippet = t.slice(Math.max(0, i - 40), Math.min(t.length, i + m[0].length + 60)).replace(/\s+/g, ' ').trim();
      return { kind, text: m[0].replace(/\s+/g, ' ').trim(), snippet };
    }
  }
  return { kind: 'none', text: null, snippet: null };
}

function pricesFrom(text) {
  const t = String(text || '');
  const out = [];
  const re = /\$\s?(\d{2,3})(?:\.\d{2})?\s*(?:\/\s*(?:mo|month)\b|per\s+month\b|a\s+month\b|monthly\b|\/m\b)/gi;
  let m;
  while ((m = re.exec(t))) {
    const n = Number(m[1]);
    if (n >= 15 && n <= 600) out.push(n);
  }
  // "Unlimited ... $149" within a short window
  const re2 = /\b(?:unlimited|membership|monthly)\b[^$\n]{0,40}\$\s?(\d{2,3})(?:\.\d{2})?/gi;
  while ((m = re2.exec(t))) {
    const n = Number(m[1]);
    if (n >= 15 && n <= 600) out.push(n);
  }
  return out;
}

function hexToRgb(h) {
  let s = String(h || '').replace('#', '').trim();
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function hsl([r, g, b]) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}
// Colors every site on a builder or plugin has, so they say nothing about the gym's brand.
const DEFAULT_COLORS = new Set([
  // WordPress core presets
  '#f78da7', '#cf2e2e', '#ff6900', '#fcb900', '#7bdcb5', '#00d084', '#8ed1fc', '#0693e3', '#9b51e0', '#abb8c3', '#eeeeee',
  // Wix, Squarespace, GoDaddy and Webflow UI defaults
  '#116dff', '#3899ec', '#0099ef', '#4eb7f5', '#3d9bf2', '#4353ff', '#146ef5', '#1a73e8', '#0d6efd',
  // cookie banners and widgets (CookieYes, Cookiebot, OneTrust, Elementor, reCAPTCHA, Mindbody widget)
  '#1863dc', '#1032cf', '#68b631', '#6ec1e4', '#61ce70', '#54595f', '#7a7a7a', '#4054b2', '#23a455', '#1a73e8', '#4285f4', '#34a853', '#fbbc05', '#ea4335',
  // generic link blues
  '#0000ff', '#0000ee', '#551a8b', '#337ab7', '#007bff', '#428bca', '#2271b1', '#2ea2cc', '#21759b',
]);
function isBrandish(hex) {
  if (DEFAULT_COLORS.has(String(hex || '').toLowerCase())) return false;
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const { s, l } = hsl(rgb);
  return s >= 0.35 && l >= 0.18 && l <= 0.82;
}
function colorsFrom(html) {
  const theme = meta(html, 'theme-color') || meta(html, 'msapplication-tilecolor');
  const counts = new Map();
  const css = (String(html).match(/<style\b[\s\S]*?<\/style>/gi) || []).join('\n') + '\n' + (String(html).match(/style="[^"]*"/gi) || []).join('\n');
  for (const m of css.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || []) {
    const hex = m.length === 4 ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : m;
    const k = hex.toLowerCase();
    if (isBrandish(k)) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const themeHex = theme && /^#?[0-9a-f]{3,6}$/i.test(theme.trim()) ? (theme.trim().startsWith('#') ? theme.trim() : `#${theme.trim()}`).toLowerCase() : null;
  const primary = themeHex && isBrandish(themeHex) ? themeHex : ranked[0] || null;
  const accent = ranked.find((c) => c !== primary) || null;
  return { primary, accent, source: primary ? (primary === themeHex ? 'theme-color' : 'site css') : null };
}

function imagesFrom(html, base) {
  const icons = tags(html, 'link')
    .filter((t) => /apple-touch-icon|icon/i.test(attr(t, 'rel') || ''))
    .map((t) => ({ href: absolute(attr(t, 'href'), base), rel: (attr(t, 'rel') || '').toLowerCase(), sizes: attr(t, 'sizes') || '' }))
    .filter((x) => x.href);
  const imgs = tags(html, 'img').map((t) => ({
    src: absolute(attr(t, 'src') || attr(t, 'data-src') || (attr(t, 'srcset') || '').split(/[\s,]/)[0], base),
    alt: attr(t, 'alt') || '',
    cls: `${attr(t, 'class') || ''} ${attr(t, 'id') || ''}`,
  }));
  let jsonLdLogo = null;
  for (const block of String(html).match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []) {
    const m = block.match(/"logo"\s*:\s*(?:\{[^}]*"url"\s*:\s*)?"([^"]+)"/i);
    if (m) {
      jsonLdLogo = absolute(m[1].replace(/\\\//g, '/'), base);
      if (jsonLdLogo) break;
    }
  }
  const logoImg = imgs.find((i) => i.src && /logo/i.test(`${i.src} ${i.alt} ${i.cls}`));
  const apple = icons.find((i) => i.rel.includes('apple-touch-icon'));
  const big = icons.filter((i) => !i.rel.includes('apple')).sort((a, b) => (parseInt(b.sizes, 10) || 0) - (parseInt(a.sizes, 10) || 0))[0];
  const og = absolute(meta(html, 'og:image') || meta(html, 'twitter:image'), base);
  const photos = imgs
    .map((i) => i.src)
    .filter((s) => s && /\.(jpe?g|webp|png)(\?|$)/i.test(s) && !/logo|icon|sprite|favicon|badge|avatar|pixel|1x1|blank|placeholder/i.test(s));
  return {
    logo: jsonLdLogo || (logoImg && logoImg.src) || (apple && apple.href) || null,
    icon: (apple && apple.href) || (big && big.href) || null,
    ogImage: og,
    photos: [...new Set([og, ...photos].filter(Boolean))].slice(0, 8),
  };
}

function contactsFrom(html, text, domain) {
  const emails = new Set();
  for (const t of tags(html, 'a')) {
    const h = attr(t, 'href') || '';
    if (/^mailto:/i.test(h)) emails.add(decodeURIComponent(h.slice(7).split('?')[0]).trim().toLowerCase());
  }
  for (const m of String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []) emails.add(m.toLowerCase());
  const clean = [...emails].filter(
    (e) =>
      /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e) &&
      !/\.(png|jpe?g|gif|webp|svg)$/i.test(e) &&
      !/example\.|sentry|wixpress|domain\.com|@email\.com|yourname|@2x|no-?reply|donotreply|do-not-reply|unsubscribe|\+subscribe|privacy@|abuse@|postmaster@|webmaster@|dpo@|legal@|careers@|jobs@|press@|media/i.test(e)
  );
  // Prefer an address on the gym's own domain, then a person's name over info@.
  const rank = (e) => (e.endsWith(`@${domain}`) ? 2 : 0) + (/^(info|hello|contact|admin|office|frontdesk|team|support)@/i.test(e) ? 0 : 1);
  clean.sort((a, b) => rank(b) - rank(a));
  const phones = new Set();
  for (const t of tags(html, 'a')) {
    const h = attr(t, 'href') || '';
    if (/^tel:/i.test(h)) {
      const digits = h.slice(4).replace(/[^\d+]/g, '');
      if (digits.replace(/\D/g, '').length >= 10) phones.add(digits);
    }
  }
  return { emails: clean.slice(0, 3), phones: [...phones].slice(0, 2) };
}

const ROLE = '([Oo]wner|[Cc]o-[Oo]wner|[Ff]ounder|[Cc]o-[Ff]ounder|[Hh]ead [Cc]oach|[Ss]tudio [Oo]wner|[Gg]ym [Oo]wner|[Gg]eneral [Mm]anager|[Ss]tudio [Mm]anager|[Ll]ead [Cc]oach|[Dd]irector|OWNER|FOUNDER|HEAD COACH)';
const NAME = "([A-Z][a-z]+(?:[-'][A-Z][a-z]+)? [A-Z][a-z]+(?:[-'][A-Z][a-z]+)?)";
const NOT_A_NAME = /^(Our|The|Meet|About|Contact|Free|Book|Join|Class|Classes|Personal|Group|Head|Your|New|Home|Get|Learn|Read|Thanks|Thank|Hello|Hi|Hey|Welcome|Dear|Call|Email|Visit|Follow|Find|Open|Opened|Grandmaster|Master|Sensei|Coach|Owner|Founder|Studio|Gym|Fitness|Yoga|Pilates|Crossfit|Martial|General|Director|Manager|Team|Staff|Member|Members|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|Des|West|East|North|South|United|Iowa|Lake|Saint|San|Los|New)\b/;
function peopleFrom(text) {
  const out = [];
  const seen = new Set();
  const push = (name, role) => {
    const n = String(name || '').trim();
    if (!n || seen.has(n) || NOT_A_NAME.test(n) || NOT_A_NAME.test(n.split(' ')[1] || '')) return;
    seen.add(n);
    out.push({ name: n, role: String(role || 'owner').toLowerCase().replace(/\s+/g, ' ') });
  };
  const t = String(text || '');
  let m;
  // "Barb Mendoza, Owner" / "Leah Johnson is the owner"
  const a = new RegExp(`${NAME}\\s*(?:[,|:\\-\\u2013\\u2014]\\s*|\\s+is\\s+(?:the\\s+|our\\s+)?|\\s+)${ROLE}\\b`, 'g');
  while ((m = a.exec(t)) && out.length < 4) push(m[1], m[2]);
  // "Owner: Barb Mendoza" / "Head Coach Trey Grask"
  const b = new RegExp(`\\b${ROLE}\\s*(?:[,:\\-\\u2013\\u2014]\\s*|\\s+)${NAME}\\b`, 'g');
  while ((m = b.exec(t)) && out.length < 4) push(m[2], m[1]);
  // "founded by Leah Johnson"
  const c = new RegExp(`\\b[Ff]ounded\\s+(?:in\\s+\\d{4}\\s+)?by\\s+${NAME}\\b`, 'g');
  while ((m = c.exec(t)) && out.length < 4) push(m[1], 'founder');
  return out.slice(0, 3);
}

function linksFrom(html, base) {
  const site = domainOf(base);
  const pick = { about: null, team: null, pricing: null, schedule: null, contact: null };
  for (const t of String(html || '').match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []) {
    const href = absolute(attr(t, 'href'), base);
    if (!href || domainOf(href) !== site) continue;
    const label = `${textOf(t)} ${href}`.toLowerCase();
    if (!pick.team && /\b(team|coaches|staff|instructors|trainers|meet the)\b/.test(label)) pick.team = href;
    else if (!pick.about && /\b(about|our story|who we are|why us)\b/.test(label)) pick.about = href;
    else if (!pick.pricing && /\b(pricing|prices|rates|memberships?|join now|plans)\b/.test(label)) pick.pricing = href;
    else if (!pick.schedule && /\b(schedule|timetable|book a class|classes)\b/.test(label)) pick.schedule = href;
    else if (!pick.contact && /\bcontact\b/.test(label)) pick.contact = href;
  }
  return pick;
}

function copyrightYear(text) {
  let best = null;
  const re = /(?:©|\(c\)|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const y = Number(m[1]);
    if (y >= 2000 && y <= 2100 && (!best || y > best)) best = y;
  }
  return best;
}

// Everything we can learn from one page. Pure: no network.
function parsePage(html, url) {
  const text = textOf(html);
  const domain = domainOf(url);
  const title = decode(((String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim()) || null;
  return {
    title,
    description: meta(html, 'description') || meta(html, 'og:description') || null,
    socials: socialsFrom(html, url),
    video: videoFrom(html),
    booking: BOOKING.filter(([, re]) => re.test(html)).map(([name, , tier]) => ({ name, tier })),
    tracking: trackingFrom(html),
    offer: offerFrom(text),
    prices: pricesFrom(text),
    colors: colorsFrom(html),
    images: imagesFrom(html, url),
    contacts: contactsFrom(html, text, domain),
    people: peopleFrom(text),
    links: linksFrom(html, url),
    platform: (PLATFORMS.find(([, re]) => re.test(html)) || [null])[0],
    copyrightYear: copyrightYear(text),
    mobileReady: /<meta[^>]+name=["']viewport["']/i.test(html),
    testimonials: /\b(testimonials?|reviews?|what (our )?members say|success stories|transformations?)\b/i.test(text),
    words: text.split(/\s+/).filter(Boolean).length,
  };
}

// Merge pages: homepage wins for identity, extra pages add contacts, people, prices and offers.
function mergePages(pages) {
  const [home, ...rest] = pages;
  const all = pages;
  const firstOffer = all.map((p) => p.offer).find((o) => o && o.kind !== 'none') || home.offer;
  const booking = [];
  for (const p of all) for (const b of p.booking) if (!booking.some((x) => x.name === b.name)) booking.push(b);
  const socials = { ...home.socials };
  for (const p of rest) for (const k of Object.keys(p.socials)) if (!socials[k] && p.socials[k]) socials[k] = p.socials[k];
  const prices = all.flatMap((p) => p.prices);
  const emails = [...new Set(all.flatMap((p) => p.contacts.emails))].slice(0, 3);
  const phones = [...new Set(all.flatMap((p) => p.contacts.phones))].slice(0, 2);
  const people = [];
  for (const p of all) for (const x of p.people) if (!people.some((y) => y.name === x.name)) people.push(x);
  return {
    ...home,
    socials,
    booking,
    offer: firstOffer,
    prices,
    monthlyPrice: median(prices),
    contacts: { emails, phones },
    people: people.slice(0, 3),
    // A page with almost no text is built in the browser by scripts, so "no video" there means "can't tell".
    video: {
      onSite: all.some((p) => p.video.onSite),
      kinds: [...new Set(all.flatMap((p) => p.video.kinds))],
      unknown: !all.some((p) => p.video.onSite) && all.every((p) => p.words < 120),
    },
    tracking: Object.fromEntries(Object.keys(home.tracking).map((k) => [k, all.some((p) => p.tracking[k])])),
    testimonials: all.some((p) => p.testimonials),
  };
}

// ---------- robots.txt ----------

function robotsAllows(robotsTxt, path, agent = '127-gym-pack') {
  const lines = String(robotsTxt || '').split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim());
  const groups = [];
  let cur = null;
  for (const l of lines) {
    const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase();
    const v = m[2].trim();
    if (k === 'user-agent') {
      if (!cur || cur.rules.length) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(v.toLowerCase());
    } else if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push({ allow: k === 'allow', path: v });
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.toLowerCase().includes(a)));
  const use = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  let best = null;
  for (const g of use) {
    for (const r of g.rules) {
      if (!r.path) continue;
      const rx = new RegExp(`^${r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')}`);
      if (rx.test(path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
    }
  }
  return !best || best.allow;
}

async function allowed(ctx, url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const robots = await cached(ctx, `gym:robots:${u.host}`, 24 * 7, async () => {
    try {
      const r = await getText(ctx, `${u.protocol}//${u.host}/robots.txt`, { timeoutMs: 6000, maxBytes: 200000, headers: { Accept: 'text/plain' } });
      return r.ok && !/<html/i.test(r.text.slice(0, 200)) ? r.text : '';
    } catch {
      return '';
    }
  });
  return robotsAllows(robots, u.pathname || '/');
}

// ---------- fetch and scan one site ----------

async function fetchPage(ctx, url) {
  if (!(await allowed(ctx, url))) return { url, blocked: 'robots' };
  try {
    const r = await getText(ctx, url, { timeoutMs: 12000, maxBytes: 1.5e6 });
    const type = r.headers && typeof r.headers.get === 'function' ? r.headers.get('content-type') || '' : '';
    if (!r.ok) return { url, status: r.status };
    if (type && !/html/i.test(type)) return { url, status: r.status, notHtml: true };
    return { url: r.url || url, status: r.status, html: r.text };
  } catch (e) {
    return { url, error: /abort/i.test(String(e && e.message)) ? 'timeout' : 'unreachable' };
  }
}

// Hosts where the root of the domain is someone else's site, not the gym's homepage.
const HOSTED = /(^|\.)(facebook\.com|instagram\.com|linktr\.ee|google\.com|business\.site|yelp\.com|mindbodyonline\.com|classpass\.com|groupon\.com|square\.site|squareup\.com|linkin\.bio|beacons\.ai|carrd\.co|tiktok\.com|youtube\.com|wixsite\.com|weebly\.com|wordpress\.com|blogspot\.com)$/i;

// includeRoot: when the listed page is a location page (climbiowa.com/east-village/), also read the
// homepage, where the hero video usually is. Off for a franchise page on its brand's domain.
async function scanSite(ctx, website, { extraPages = 2, includeRoot = true } = {}) {
  const url = normalizeUrl(website);
  if (!url) return { reachable: false, reason: 'No website listed.' };
  const domain = domainOf(url);
  const path = new URL(url).pathname.replace(/\/$/, '');
  return cached(ctx, `gym:site:v3:${domain}${path}${includeRoot ? '' : ':page'}`, 24 * 7, async () => {
    let home = await fetchPage(ctx, url);
    if (!home.html && (home.status === 404 || home.status === 410) && path.length > 0) {
      home = await fetchPage(ctx, `${new URL(url).origin}/`);
    }
    if (!home.html) {
      const reason = home.blocked ? 'The site asks bots not to read it.' : home.status ? `The site answered ${home.status}.` : home.error === 'timeout' ? 'The site took too long to answer.' : "Couldn't reach the site.";
      return { reachable: false, url, reason };
    }
    const pages = [parsePage(home.html, home.url)];
    const read = new Set([home.url.replace(/\/$/, '')]);
    const root = `${new URL(home.url).origin}/`;
    let budget = extraPages;
    if (includeRoot && !read.has(root.replace(/\/$/, '')) && !HOSTED.test(new URL(home.url).hostname)) {
      const r = await fetchPage(ctx, root);
      if (r.html) {
        pages.push(parsePage(r.html, r.url));
        read.add(r.url.replace(/\/$/, ''));
        budget -= 1;
      }
    }
    const pick = (k) => pages.map((p) => p.links[k]).find(Boolean);
    const extra = [pick('team') || pick('about'), pick('pricing')].filter((u) => u && !read.has(u.replace(/\/$/, ''))).slice(0, Math.max(0, budget));
    for (const u of extra) {
      const p = await fetchPage(ctx, u);
      if (p.html) pages.push(parsePage(p.html, p.url));
    }
    const merged = mergePages(pages);
    log(ctx, `Read ${domain} (${pages.length} page${pages.length > 1 ? 's' : ''})`);
    return { reachable: true, url: home.url, domain, pagesRead: pages.length, https: /^https:/i.test(home.url), ...merged };
  });
}

module.exports = {
  scanSite,
  HOSTED,
  parsePage,
  mergePages,
  robotsAllows,
  textOf,
  offerFrom,
  pricesFrom,
  colorsFrom,
  peopleFrom,
  socialsFrom,
  isBrandish,
  hexToRgb,
};
