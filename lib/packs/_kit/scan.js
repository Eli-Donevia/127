// Reads a business's own website the way a sharp sales rep would in 5 minutes, in about 3 seconds:
// what it runs on, whether it works on phones, where they post, how customers book or order, whether
// they buy ads, collect emails or show reviews, their offer, prices, colors, logo and who runs it.
// Public pages only (homepage plus at most two more), robots.txt respected, cached for every member.
// Everything here is a fact read off the page; nothing is guessed about a real business.
// Adapted from the gym pack's site-scan.js (v2/workflows/gym-video), generalized to any business.

const { getText, cached, normalizeUrl, domainOf, fetchPage, robotsAllows } = require('./web');
const { plain } = require('./text');

function median(nums) {
  const a = nums.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function log(ctx, t) {
  if (ctx && typeof ctx.log === 'function') ctx.log(plain(t));
}

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

// How customers book, order or buy. tier: 'pro' (a real system), 'basic' (a link), 'order' (food or goods).
const BOOKING = [
  // fitness and studios (from the gym pack)
  ['Mindbody', /mindbodyonline\.com|healcode\.com|brandedweb\.mindbody|mindbody\.io/i, 'pro'],
  ['Mariana Tek', /marianatek\.com|mariana-tek|marianaiframes/i, 'pro'],
  ['ClubReady', /clubready\.com/i, 'pro'],
  ['ABC Glofox', /glofox\.com/i, 'pro'],
  ['Zen Planner', /zenplanner\.com/i, 'pro'],
  ['Wodify', /wodify\.com/i, 'pro'],
  ['PushPress', /pushpress\.com/i, 'pro'],
  ['WellnessLiving', /wellnessliving\.com/i, 'pro'],
  ['Momence', /momence\.com/i, 'pro'],
  ['Arketa', /arketa\.co/i, 'pro'],
  ['Walla', /hellowalla\.com|walla\.app/i, 'pro'],
  ['Gymdesk', /gymdesk\.com/i, 'basic'],
  ['TeamUp', /goteamup\.com/i, 'basic'],
  ['Trainerize', /trainerize\.(com|me)/i, 'basic'],
  // salons, spas, health
  ['Vagaro', /vagaro\.com/i, 'pro'],
  ['Boulevard', /joinblvd\.com|blvd\.co/i, 'pro'],
  ['Booksy', /booksy\.com/i, 'pro'],
  ['Fresha', /fresha\.com/i, 'pro'],
  ['GlossGenius', /glossgenius\.com/i, 'pro'],
  ['StyleSeat', /styleseat\.com/i, 'basic'],
  ['Schedulicity', /schedulicity\.com/i, 'basic'],
  ['Zenoti', /zenoti\.com/i, 'pro'],
  ['Jane', /\.janeapp\.com/i, 'pro'],
  ['NexHealth', /nexhealth\.com/i, 'pro'],
  ['Zocdoc', /zocdoc\.com/i, 'pro'],
  ['LocalMed', /localmed\.com/i, 'pro'],
  // home services
  ['Housecall Pro', /housecallpro\.com/i, 'pro'],
  ['Jobber', /getjobber\.com|clienthub\.getjobber/i, 'pro'],
  ['ServiceTitan', /servicetitan\.com|scheduler\.servicetitan/i, 'pro'],
  ['Workiz', /workiz\.com/i, 'pro'],
  ['Thumbtack', /thumbtack\.com/i, 'basic'],
  ['Angi', /angi\.com|homeadvisor\.com/i, 'basic'],
  // general schedulers
  ['Square Appointments', /squareup\.com\/appointments|book\.squareup|app\.squareup\.com\/appointments/i, 'pro'],
  ['Acuity', /acuityscheduling\.com|squarespacescheduling\.com/i, 'basic'],
  ['Calendly', /calendly\.com/i, 'basic'],
  ['Setmore', /setmore\.com/i, 'basic'],
  ['SimplyBook', /simplybook\.(me|it)/i, 'basic'],
  ['Cal.com', /cal\.com\/[a-z0-9-]+/i, 'basic'],
  ['HubSpot Meetings', /meetings\.hubspot\.com/i, 'basic'],
  ['Google booking', /calendar\.app\.google|calendar\.google\.com\/calendar\/appointments/i, 'basic'],
  // restaurants
  ['OpenTable', /opentable\.com/i, 'pro'],
  ['Resy', /resy\.com/i, 'pro'],
  ['Tock', /exploretock\.com/i, 'pro'],
  ['SevenRooms', /sevenrooms\.com/i, 'pro'],
  ['Toast', /toasttab\.com/i, 'order'],
  ['ChowNow', /chownow\.com/i, 'order'],
  ['Olo', /olo\.com|\.olo\.com/i, 'order'],
  ['Square Online', /square\.site|squareup\.com\/store/i, 'order'],
  ['Clover', /clover\.com\/online-ordering/i, 'order'],
  ['Popmenu', /popmenu\.com/i, 'order'],
  ['BentoBox', /getbento\.com/i, 'order'],
  ['DoorDash', /doordash\.com/i, 'order'],
  ['Uber Eats', /ubereats\.com/i, 'order'],
  ['Grubhub', /grubhub\.com/i, 'order'],
];

// Chat on the site (a missed lead after hours has nowhere else to go).
const CHAT = [
  ['Intercom', /widget\.intercom\.io|intercomcdn/i],
  ['Drift', /js\.driftt\.com|drift\.com\/include/i],
  ['Tidio', /code\.tidio\.co/i],
  ['LiveChat', /cdn\.livechatinc\.com/i],
  ['tawk.to', /embed\.tawk\.to/i],
  ['Podium', /podium\.com\/podium-widget|connect\.podium\.com/i],
  ['Birdeye', /birdeye\.com\/embed|widget\.birdeye/i],
  ['HubSpot chat', /js\.usemessages\.com|js\.hs-scripts\.com/i],
  ['Zendesk', /static\.zdassets\.com/i],
  ['Crisp', /client\.crisp\.chat/i],
  ['Smith.ai', /smith\.ai/i],
  ['Facebook Messenger', /connect\.facebook\.net\/[^"']*\/sdk\/xfbml\.customerchat|fb-customerchat/i],
];

// Review widgets and review apps (Shopify ones too).
const REVIEWS = [
  ['Birdeye', /birdeye\.com/i],
  ['Podium', /podium\.com/i],
  ['Trustpilot', /widget\.trustpilot\.com/i],
  ['Elfsight', /elfsight\.com/i],
  ['Yotpo', /yotpo\.com/i],
  ['Judge.me', /judge\.me/i],
  ['Stamped', /stamped\.io/i],
  ['Okendo', /okendo\.io/i],
  ['Loox', /loox\.io/i],
  ['Google reviews embed', /google\.com\/maps\/reviews|grwapi|reviews-widget/i],
];

// Email capture (a list they can sell to again).
const EMAIL_TOOLS = [
  ['Mailchimp', /list-manage\.com|chimpstatic\.com|mc\.us\d+\.list-manage/i],
  ['Klaviyo', /static\.klaviyo\.com|klaviyo\.com\/onsite/i],
  ['Kit', /convertkit\.com|ck\.page|kit\.com\/forms/i],
  ['Constant Contact', /constantcontact\.com|ctctcdn\.com/i],
  ['Omnisend', /omnisnippet|omnisend\.com/i],
  ['Privy', /privy\.com|widget\.privy/i],
  ['Beehiiv', /beehiiv\.com/i],
  ['Flodesk', /flodesk\.com/i],
  ['MailerLite', /mailerlite\.com|ml\.mlcdn/i],
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
  ['Carrd', /carrd\.co/i],
  ['Google Sites', /sites\.google\.com|googleusercontent\.com\/sites/i],
  ['Square Online', /square\.site|squareup\.com\/online-store/i],
  ['HubSpot', /hs-sites\.com|hubspotusercontent/i],
  ['Jimdo', /jimdo/i],
  ['GoSite', /gosite\.com/i],
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

// The front-door offer, if the site has one. Order matters: the first match wins.
const OFFER_RULES = [
  ['free_quote', /\bfree\s+(?:quote|estimate|inspection|bid)s?\b|\bget\s+(?:a|your)\s+(?:free\s+)?(?:quote|estimate)\b/i],
  ['free_consult', /\bfree\s+(?:consult(?:ation)?|assessment|strategy\s+(?:call|session)|discovery\s+call|intro\s+(?:call|session))\b/i],
  ['free_class', /\b(?:your\s+)?(?:first|1st)\s+(?:class|session|workout|visit|lesson|week)\s+(?:is\s+)?(?:free|on\s+us)\b|\bfree\s+(?:trial\s+|intro(?:ductory)?\s+)?(?:class|session|workout|visit|lesson)\b/i],
  ['free_trial', /\bfree\s+(?:\d+|one|two|three|seven|fourteen|thirty)?[- ]?(?:day|week|month)\s+(?:pass|trial)\b|\bfree\s+trial\b/i],
  ['discount', /\b\d{1,2}\s?%\s+off\b|\$\s?\d{1,3}\s+off\b|\b(?:new\s+(?:customer|client|patient|member)|first[- ]time)\s+(?:special|discount|offer|deal)\b/i],
  ['intro_price', /\b(?:intro(?:ductory)?|new\s+(?:member|client|student|patient))\s+(?:offer|special|deal|price|pricing|pack(?:age)?)\b|\$\s?\d{1,3}\s+for\s+(?:\d+|one|two|three|four)\s+(?:days?|weeks?|classes|sessions|visits)\b/i],
  ['free_shipping', /\bfree\s+shipping\b/i],
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

// Dollar amounts on the page with a few words of context ("$149 / month", "from $85").
function pricesFrom(text) {
  const t = String(text || '');
  const out = [];
  const re = /\$\s?(\d{1,3}(?:,\d{3})*|\d{1,5})(?:\.(\d{2}))?\b/g;
  let m;
  while ((m = re.exec(t)) && out.length < 40) {
    const n = Number(m[1].replace(/,/g, '')) + (m[2] ? Number(m[2]) / 100 : 0);
    if (n < 5 || n > 20000) continue;
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 24).toLowerCase();
    const per = /^\s*(?:\/|per|a)\s*(mo|month)/.test(after) ? 'month' : /^\s*(?:\/|per|an?)\s*(hr|hour)/.test(after) ? 'hour' : /^\s*(?:\/|per|a)\s*(wk|week)/.test(after) ? 'week' : /^\s*(?:\/|per|a)\s*(yr|year)/.test(after) ? 'year' : /^\s*(?:\/|per|a)\s*(visit|session|class|lesson|car|room|job)/.test(after) ? after.match(/(visit|session|class|lesson|car|room|job)/)[1] : null;
    out.push({ amount: n, per, context: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 20).replace(/\s+/g, ' ').trim() });
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

// Addresses that belong to the site builder, not the business (a dead GoSite page lists help@gosite.com).
const PLATFORM_EMAIL = /(^|\.)(gosite|wix|wixpress|squarespace|godaddy|secureserver|weebly|shopify|mailchimp|wordpress|duda|webflow|hubspot|jimdo|strikingly|carrd|sentry|example)\.(com|io|net|org|co)$/i;

// US numbers with a 555 area code or exchange are fictional (used in templates and demos).
function fictionalPhone(digits) {
  const d = String(digits).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 && (d.slice(0, 3) === '555' || d.slice(3, 6) === '555');
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
      !/example\.|sentry|wixpress|domain\.com|@email\.com|yourname|@2x|no-?reply|donotreply|do-not-reply|unsubscribe|\+subscribe|privacy@|abuse@|postmaster@|webmaster@|dpo@|legal@|careers@|jobs@|press@|media/i.test(e) &&
      !PLATFORM_EMAIL.test(e.split('@')[1] || '')
  );
  // Prefer an address on the gym's own domain, then a person's name over info@.
  const rank = (e) => (e.endsWith(`@${domain}`) ? 2 : 0) + (/^(info|hello|contact|admin|office|frontdesk|team|support)@/i.test(e) ? 0 : 1);
  clean.sort((a, b) => rank(b) - rank(a));
  const phones = new Set();
  for (const t of tags(html, 'a')) {
    const h = attr(t, 'href') || '';
    if (/^tel:/i.test(h)) {
      const digits = h.slice(4).replace(/[^\d+]/g, '');
      if (digits.replace(/\D/g, '').length >= 10 && !fictionalPhone(digits)) phones.add(digits);
    }
  }
  return { emails: clean.slice(0, 3), phones: [...phones].slice(0, 2) };
}

const ROLE = '([Oo]wner|[Cc]o-[Oo]wner|[Ff]ounder|[Cc]o-[Ff]ounder|[Pp]resident|CEO|[Pp]rincipal|[Hh]ead [Cc]oach|[Ss]tudio [Oo]wner|[Gg]ym [Oo]wner|[Gg]eneral [Mm]anager|[Ss]tudio [Mm]anager|[Oo]ffice [Mm]anager|[Ll]ead [Cc]oach|[Hh]ead [Cc]hef|[Ee]xecutive [Cc]hef|[Dd]irector|[Bb]roker|OWNER|FOUNDER|HEAD COACH)';
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
  const pick = { about: null, team: null, pricing: null, services: null, menu: null, shop: null, book: null, schedule: null, contact: null, reviews: null };
  for (const t of String(html || '').match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []) {
    const href = absolute(attr(t, 'href'), base);
    if (!href || domainOf(href) !== site) continue;
    const label = `${textOf(t)} ${href}`.toLowerCase();
    if (!pick.team && /\b(team|coaches|staff|instructors|trainers|meet the|our people|providers|doctors)\b/.test(label)) pick.team = href;
    else if (!pick.about && /\b(about|our story|who we are|why us)\b/.test(label)) pick.about = href;
    else if (!pick.pricing && /\b(pricing|prices|rates|memberships?|join now|plans|packages)\b/.test(label)) pick.pricing = href;
    else if (!pick.services && /\b(services|what we do|treatments|our work)\b/.test(label)) pick.services = href;
    else if (!pick.menu && /\bmenus?\b/.test(label)) pick.menu = href;
    else if (!pick.shop && /\b(shop|store|products|collections)\b/.test(label)) pick.shop = href;
    else if (!pick.book && /\b(book|appointment|reserve|reservations|schedule now|get a quote|request a quote|estimate)\b/.test(label)) pick.book = href;
    else if (!pick.schedule && /\b(schedule|timetable|classes)\b/.test(label)) pick.schedule = href;
    else if (!pick.reviews && /\b(reviews|testimonials)\b/.test(label)) pick.reviews = href;
    else if (!pick.contact && /\bcontact\b/.test(label)) pick.contact = href;
  }
  return pick;
}

// schema.org types the page declares in JSON-LD (LocalBusiness, Restaurant, Product...).
function schemaTypesFrom(html) {
  const out = new Set();
  for (const block of String(html).match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []) {
    for (const m of block.match(/"@type"\s*:\s*(?:"([^"]+)"|\[([^\]]+)\])/g) || []) {
      for (const t of m.replace(/"@type"\s*:\s*/, '').replace(/[[\]"]/g, '').split(',')) if (t.trim()) out.add(t.trim());
    }
  }
  return [...out].slice(0, 12);
}

// "Mon-Fri 8am-6pm" style hours on the page.
function hoursFrom(text) {
  const m = String(text || '').match(/\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b[^\n]{0,40}?\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)(?:\s*(?:-|\u2013|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))?/i);
  return m ? m[0].replace(/\s+/g, ' ').trim() : null;
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
  const h1s = (String(html).match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || []).map((h) => textOf(h)).filter(Boolean);
  const imgTags = tags(html, 'img');
  const scripts = tags(html, 'script').filter((t) => attr(t, 'src')).length;
  const forms = tags(html, 'form').length;
  return {
    title,
    description: meta(html, 'description') || meta(html, 'og:description') || null,
    h1: h1s[0] || null,
    h1Count: h1s.length,
    lang: attr((String(html).match(/<html\b[^>]*>/i) || [''])[0], 'lang'),
    socials: socialsFrom(html, url),
    video: videoFrom(html),
    booking: BOOKING.filter(([, re]) => re.test(html)).map(([name, , tier]) => ({ name, tier })),
    chat: CHAT.filter(([, re]) => re.test(html)).map(([name]) => name),
    reviewWidgets: REVIEWS.filter(([, re]) => re.test(html)).map(([name]) => name),
    emailTools: EMAIL_TOOLS.filter(([, re]) => re.test(html)).map(([name]) => name),
    // Attributes with or without quotes (type=email, href=tel:..., name=viewport).
    emailCapture: EMAIL_TOOLS.some(([, re]) => re.test(html)) || tags(html, 'input').some((t) => (attr(t, 'type') || '').toLowerCase() === 'email'),
    forms,
    tracking: trackingFrom(html),
    offer: offerFrom(text),
    prices: pricesFrom(text),
    colors: colorsFrom(html),
    images: imagesFrom(html, url),
    imagesWithoutAlt: imgTags.filter((t) => !(attr(t, 'alt') || '').trim()).length,
    imageCount: imgTags.length,
    contacts: contactsFrom(html, text, domain),
    tapToCall: tags(html, 'a').some((t) => /^tel:/i.test((attr(t, 'href') || '').trim())),
    mapEmbed: /google\.com\/maps\/embed|maps\.googleapis\.com|maps\.google\.com\/maps\?/i.test(html),
    hours: hoursFrom(text),
    people: peopleFrom(text),
    links: linksFrom(html, url),
    platform: (PLATFORMS.find(([, re]) => re.test(html)) || [null])[0],
    schemaTypes: schemaTypesFrom(html),
    copyrightYear: copyrightYear(text),
    mobileReady: tags(html, 'meta').some((t) => (attr(t, 'name') || '').toLowerCase() === 'viewport'),
    testimonials: /\b(testimonials?|reviews?|what (our )?(clients|customers|members|patients) say|success stories)\b/i.test(text),
    scripts,
    bytes: Buffer.byteLength(String(html), 'utf8'),
    words: text.split(/\s+/).filter(Boolean).length,
    headings: (String(html).match(/<h[23]\b[^>]*>[\s\S]*?<\/h[23]>/gi) || []).map((h) => textOf(h)).filter((h) => h && h.length < 90).slice(0, 12),
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
  const prices = all.flatMap((p) => p.prices).slice(0, 40);
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
    monthlyPrice: median(prices.filter((x) => x.per === 'month').map((x) => x.amount)),
    chat: [...new Set(all.flatMap((p) => p.chat))],
    reviewWidgets: [...new Set(all.flatMap((p) => p.reviewWidgets))],
    emailTools: [...new Set(all.flatMap((p) => p.emailTools))],
    emailCapture: all.some((p) => p.emailCapture),
    tapToCall: all.some((p) => p.tapToCall),
    mapEmbed: all.some((p) => p.mapEmbed),
    hours: all.map((p) => p.hours).find(Boolean) || null,
    schemaTypes: [...new Set(all.flatMap((p) => p.schemaTypes))],
    headings: [...new Set(all.flatMap((p) => p.headings))].slice(0, 16),
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

// A page that is up but isn't a working business site: parked, for sale, suspended, a host's default page.
const PARKED = /(no longer in service|domain (is )?for sale|buy this domain|this domain (is|has been|may be) (parked|for sale|registered)|parked (free|domain)|account (has been )?suspended|site (is )?(not found|unavailable|under construction)|under construction|coming soon|website (is )?(expired|coming soon)|default web ?page|welcome to nginx|apache2? (ubuntu )?default page|index of \/|future home of)/i;
function parkedFrom(page) {
  const hay = `${page.title || ''} ${page.h1 || ''} ${(page.headings || []).join(' ')}`;
  if (PARKED.test(hay) && page.words < 400) return hay.match(PARKED)[0].toLowerCase();
  if (page.words < 25 && !page.forms && !page.contacts.phones.length) return 'almost no content';
  return null;
}

// Facts that get quoted to members: plain text, no dashes or emoji (copy rules), whatever the site wrote.
function tidy(page) {
  const t = (x) => (x == null ? x : plain(x));
  return {
    ...page,
    title: t(page.title),
    description: t(page.description),
    h1: t(page.h1),
    headings: (page.headings || []).map(t),
    hours: t(page.hours),
    offer: page.offer && { ...page.offer, text: t(page.offer.text), snippet: t(page.offer.snippet) },
    prices: (page.prices || []).map((p) => ({ ...p, context: t(p.context) })),
  };
}

// ---------- fetch and scan one site ----------

// Hosts where the root of the domain is someone else's site, not the business's homepage.
const HOSTED = /(^|\.)(facebook\.com|instagram\.com|linktr\.ee|google\.com|business\.site|yelp\.com|mindbodyonline\.com|classpass\.com|groupon\.com|square\.site|squareup\.com|linkin\.bio|beacons\.ai|carrd\.co|tiktok\.com|youtube\.com|wixsite\.com|weebly\.com|wordpress\.com|blogspot\.com)$/i;

// includeRoot: when the listed page is a location page (climbiowa.com/east-village/), also read the
// homepage, where the hero video usually is. Off for a franchise page on its brand's domain.
async function scanSite(ctx, website, { extraPages = 2, includeRoot = true } = {}) {
  const url = normalizeUrl(website);
  if (!url) return { reachable: false, reason: 'No website listed.' };
  const domain = domainOf(url);
  const path = new URL(url).pathname.replace(/\/$/, '');
  // A site read is kept a week; one that didn't answer is tried again after 6 hours.
  return cached(ctx, `scan:v2:${domain}${path}${includeRoot ? '' : ':page'}`, (v) => (v && v.reachable === false ? 6 : 24 * 7), async () => {
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
    const extra = [pick('about') || pick('team'), pick('pricing') || pick('services') || pick('menu')].filter((u) => u && !read.has(u.replace(/\/$/, ''))).slice(0, Math.max(0, budget));
    for (const u of extra) {
      const p = await fetchPage(ctx, u);
      if (p.html) pages.push(parsePage(p.html, p.url));
    }
    const merged = tidy(mergePages(pages));
    const finalDomain = domainOf(home.url);
    const parked = parkedFrom(pages[0]);
    log(ctx, `Read ${finalDomain} (${pages.length} page${pages.length > 1 ? 's' : ''})${parked ? `, looks ${parked}` : ''}`);
    return {
      reachable: true,
      url: home.url,
      domain: finalDomain,
      redirectedFrom: finalDomain !== domain ? domain : null,
      parked: !!parked,
      parkedReason: parked,
      pagesRead: pages.length,
      https: /^https:/i.test(home.url),
      ...merged,
    };
  });
}

module.exports = {
  scanSite,
  parkedFrom,
  fictionalPhone,
  tidy,
  hoursFrom,
  schemaTypesFrom,
  BOOKING,
  CHAT,
  REVIEWS,
  EMAIL_TOOLS,
  PLATFORMS,
  HOSTED,
  parsePage,
  mergePages,
  robotsAllows,
  textOf,
  attr,
  meta,
  offerFrom,
  pricesFrom,
  colorsFrom,
  peopleFrom,
  socialsFrom,
  isBrandish,
  hexToRgb,
};
