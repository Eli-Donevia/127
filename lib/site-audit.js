// Website check for First 25 (lib/first25.js): fetches one business homepage and reads the signals
// the gaps are built from (video, socials, booking, chat, pixel, footer year, phone-ready, https).
// It only ever reports what it saw on that page, and anything it couldn't read stays "unchecked",
// so a blocked or script-only site never becomes a claim about the business.
//
// Safety: the URLs come from business listings (anyone can edit OpenStreetMap), so every request and
// every redirect resolves DNS first, refuses private, loopback, link-local and reserved addresses,
// and connects to the address it checked (no DNS rebinding). http and https on ports 80 and 443 only.

const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const zlib = require('zlib');

const UA = 'Mozilla/5.0 (compatible; 127-First25/1.0; +https://127group.io/first-25)';
const MAX_BYTES = 900 * 1024;
const MAX_REDIRECTS = 4;

const blocked = new net.BlockList();
[
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
].forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv4'));
[['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32], ['100::', 64], ['64:ff9b::', 96], ['2002::', 16]]
  .forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv6'));

function privateAddress(address) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return privateAddress(mapped[1]);
  const family = net.isIP(address);
  if (!family) return true;
  return blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

// Resolve once, refuse the whole host if any address is private, and hand the socket that address.
function safeLookup(hostname, options, cb) {
  if (typeof options === 'function') { cb = options; options = {}; }
  if (net.isIP(hostname)) {
    if (privateAddress(hostname)) return cb(Object.assign(new Error('blocked address'), { code: 'EBLOCKED' }));
    const fam = net.isIP(hostname);
    return options && options.all ? cb(null, [{ address: hostname, family: fam }]) : cb(null, hostname, fam);
  }
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some((a) => privateAddress(a.address))) return cb(Object.assign(new Error('blocked address'), { code: 'EBLOCKED' }));
    if (options && options.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

function checkUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  if (u.username || u.password) return null;
  if (!u.hostname || u.hostname === 'localhost' || /\.(local|internal|localhost|example|invalid|test)$/i.test(u.hostname)) return null;
  // An IP literal never goes through DNS lookup, so check it here.
  const literal = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(literal) && privateAddress(literal)) return null;
  return u;
}

// One GET with the guard above. Resolves { status, headers, body, url, ms } or rejects with err.code.
function fetchOnce(u, deadline, lookup = safeLookup) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    const started = Date.now();
    const req = lib.request(u, {
      method: 'GET',
      lookup,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-encoding': 'gzip, deflate, br', 'accept-language': 'en-US,en;q=0.8' },
      agent: false,
    });
    const timer = setTimeout(() => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), Math.max(500, deadline - Date.now()));
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.on('response', (res) => {
      const ms = Date.now() - started;
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); clearTimeout(timer);
        return resolve({ status: res.statusCode, headers: res.headers, redirect: res.headers.location, ms });
      }
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      const chunks = []; let size = 0; let done = false;
      const finish = () => {
        if (done) return; done = true; clearTimeout(timer);
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), ms });
      };
      stream.on('data', (c) => {
        size += c.length;
        if (size > MAX_BYTES) { chunks.push(c.subarray(0, Math.max(0, c.length - (size - MAX_BYTES)))); finish(); req.destroy(); return; }
        chunks.push(c);
      });
      stream.on('end', finish);
      stream.on('error', (e) => { if (!done) { clearTimeout(timer); done = true; reject(e); } });
    });
    req.end();
  });
}

// ---------- reading the page ----------
const BOOKING = [
  ['Mindbody', /mindbodyonline\.com|healcode\.com|brandedweb\.mindbody/], ['Glofox', /glofox/], ['Zen Planner', /zenplanner/], ['PushPress', /pushpress/],
  ['Wodify', /wodify/], ['TeamUp', /goteamup\.com|teamup\.com\/[a-z]/], ['Mariana Tek', /marianatek|mariana\.tech/], ['Momence', /momence/],
  ['ClubReady', /clubready/], ['ABC', /abcfitness|abcevo/], ['WellnessLiving', /wellnessliving/], ['Arketa', /arketa/], ['Punchpass', /punchpass/],
  ['Exercise.com', /exercise\.com\/(?:gym|book)/], ['Calendly', /calendly\.com/], ['Acuity', /acuityscheduling|as\.me\//], ['Square', /squareup\.com\/appointments|square\.site\/book|book\.squareup/],
  ['Vagaro', /vagaro/], ['Booksy', /booksy/], ['Fresha', /fresha\.com/], ['Schedulicity', /schedulicity/], ['GlossGenius', /glossgenius/], ['Boulevard', /joinblvd|blvd\.co/],
  ['Setmore', /setmore/], ['SimplyBook', /simplybook/], ['OpenTable', /opentable\./], ['Resy', /resy\.com/], ['Tock', /exploretock/], ['Toast', /toasttab\.com/],
  ['ChowNow', /chownow/], ['Clover', /clover\.com\/online-ordering/], ['Zocdoc', /zocdoc/], ['NexHealth', /nexhealth/], ['LocalMed', /localmed/], ['Weave', /getweave|weavehelp/],
  ['Jane', /janeapp\.com/], ['ChiroTouch', /chirotouch/], ['Housecall Pro', /housecallpro/], ['Jobber', /getjobber|clienthub\.getjobber/], ['ServiceTitan', /servicetitan/],
  ['Shopify', /cdn\.shopify\.com|myshopify\.com/], ['Book online', /book\s*(?:now|online|an appointment|a class)<|schedule\s*(?:now|online)</],
];
const CHAT = [
  ['Intercom', /widget\.intercom\.io|intercomcdn/], ['Drift', /js\.driftt\.com|drift\.com\/include/], ['Tidio', /tidio/], ['LiveChat', /livechatinc/], ['tawk.to', /tawk\.to/],
  ['Crisp', /crisp\.chat/], ['HubSpot', /js\.hs-scripts\.com|js\.usemessages\.com/], ['Zendesk', /zopim|zdassets|zendesk\.com\/embeddable/], ['Podium', /podium\.com|connect\.podium/],
  ['Birdeye', /birdeye/], ['Olark', /olark/], ['Smartsupp', /smartsupp/], ['Freshchat', /freshchat|wchat\.freshchat/], ['Gorgias', /gorgias/], ['Chatbot', /chatbot\.com|botpress|voiceflow/],
];
const SIGNUP = /list-manage\.com|mailchimp|klaviyo|constantcontact|ctctcdn|mailerlite|convertkit|beehiiv|sendinblue|brevo\.com|omnisend|flodesk|aweber|newsletter|join (?:our|the) (?:email|mailing) list|sign up for (?:our|email)/;
const PLATFORM = [['Wix', /static\.wixstatic\.com|wix\.com\b/], ['Squarespace', /static1\.squarespace\.com|squarespace-cdn/], ['Shopify', /cdn\.shopify\.com/], ['WordPress', /wp-content|wp-includes/],
  ['GoDaddy', /img1\.wsimg\.com|godaddysites/], ['Weebly', /weebly/], ['Duda', /dudaone|multiscreensite|dudamobile/], ['Webflow', /webflow/], ['Showit', /showit/]];

const first = (re, s) => { const m = re.exec(s); return m ? m[1] : null; };

function parse(html, finalUrl, now = new Date()) {
  const raw = String(html || '');
  const s = raw.toLowerCase();
  const year = now.getFullYear();
  const socials = {
    instagram: first(/instagram\.com\/(?!p\/|reels?\/|explore\/|accounts\/|stories\/|tv\/|share|sharer|developer|about\/|legal\/|direct\/)([a-z0-9_.]{2,30})/, s),
    tiktok: first(/tiktok\.com\/@([a-z0-9_.]{2,24})/, s),
    youtube: first(/youtube\.com\/((?:@[\w.-]{2,})|(?:channel\/[\w-]{10,})|(?:c\/[\w.-]{2,})|(?:user\/[\w.-]{2,}))/, s),
    facebook: first(/facebook\.com\/(?!sharer|share|dialog|plugins|tr[/?]|tr$|login|policy|privacy|help|legal|business|watch|events\/?["'])([a-z0-9.\-]{2,60})/, s),
  };
  if (socials.instagram) socials.instagram = socials.instagram.replace(/\.+$/, '');
  if (socials.facebook && /^(tr|pages|profile\.php|groups)$/.test(socials.facebook)) socials.facebook = socials.facebook === 'profile.php' || socials.facebook === 'pages' ? 'page' : null;

  const years = [];
  const yre = /(?:©|&copy;|&#169;|&#xa9;|copyright)\s*(?:<[^>]{0,80}>\s*)*(?:copyright\s*)?(?:(?:19|20)\d{2}\s*(?:-|–|—|&ndash;|&mdash;|&#8211;|to)\s*)?((?:19|20)\d{2})/gi;
  let m;
  while ((m = yre.exec(raw))) { const y = parseInt(m[1], 10); if (y <= year) years.push(y); }

  // Text left after scripts, styles and tags: a near-empty page is a script-only site we can't judge.
  const text = s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const thin = text.length < 280;
  const emails = (s.match(/mailto:([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/g) || []).map((x) => x.slice(7)).filter((e) => !/example\.|sentry|wixpress|domain\.com|email\.com$|yourname|godaddy/.test(e));

  const gtm = /googletagmanager\.com\/gtm\.js|['"]gtm-[a-z0-9]{4,}['"]/.test(s);
  return {
    title: (first(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i, raw) || '').replace(/\s+/g, ' ').trim().slice(0, 120) || null,
    https: /^https:/i.test(finalUrl || ''),
    video: /<video[\s>]|youtube(?:-nocookie)?\.com\/embed|player\.vimeo\.com|vimeo\.com\/video|fast\.wistia|wistia\.(?:com|net)\/(?:embed|medias)|vidyard|video\.wixstatic\.com|wix-video|sqs-video|video-block|\.mp4(?:["'?#\s)]|$)|\.webm(?:["'?#\s)]|$)|\.m3u8|youtu\.be\/|loom\.com\/(?:embed|share)|tiktok\.com\/embed|instagram\.com\/(?:reel|p)\/[\w-]+\/embed|mux\.com|videopress/.test(s),
    socials,
    booking: (BOOKING.find(([, re]) => re.test(s)) || [])[0] || null,
    chat: (CHAT.find(([, re]) => re.test(s)) || [])[0] || null,
    // A pixel loaded through Google Tag Manager isn't in the HTML, so with GTM and no direct pixel we don't know (null).
    pixel: /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init|facebook\.com\/tr\?id=/.test(s) || (gtm ? null : false),
    gads: /googletagmanager\.com\/gtag\/js\?id=aw-|gtag\(\s*['"]config['"]\s*,\s*['"]aw-|googleadservices\.com\/pagead/.test(s) || (gtm ? null : false),
    form: /<form[\s\S]{0,4000}?(?:type=["']?(?:email|tel)|name=["']?(?:[\w\[\]-]*email|[\w\[\]-]*phone))/.test(s) || /jotform|typeform|hsforms|hs-form|wpcf7|gform_|wpforms|formstack|cognitoforms|wixforms|form-wrapper|sqs-block-form|ninja-forms/.test(s),
    signup: SIGNUP.test(s),
    viewport: /<meta[^>]+name=["']?viewport/.test(s),
    description: /<meta[^>]+name=["']?description["']?[^>]*content=["'][^"']{10,}/.test(s) || /<meta[^>]+content=["'][^"']{10,}["'][^>]*name=["']?description/.test(s),
    footerYear: years.length ? Math.max(...years) : null,
    images: Math.min(99, (s.match(/<img\b(?![^>]*\b(?:width|height)=["']?1["'\s>])/g) || []).length + (s.match(/background-image:\s*url\(/g) || []).length),
    platform: (PLATFORM.find(([, re]) => re.test(s)) || [])[0] || null,
    email: emails[0] || null,
    thin,
  };
}

// ---------- one site ----------
// Returns { checked, ok, url, ms, ...signals } or { checked:false, why } when we couldn't judge.
// checked:true ok:false means it really didn't load (DNS gone, refused, timed out, 5xx), so the page can say so.
// lookup is only for tests against a local server; callers in the app never pass it.
async function audit(url, { timeoutMs = 6000, now, lookup } = {}) {
  let u = checkUrl(/^https?:\/\//i.test(String(url || '')) ? url : 'http://' + url);
  if (!u) return { checked: false, why: 'bad_url' };
  const deadline = Date.now() + timeoutMs;
  const started = Date.now();
  let brokenLink = false;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const r = await fetchOnce(u, deadline, lookup);
      if (r.redirect) {
        const next = checkUrl(new URL(r.redirect, u).toString());
        if (!next) return { checked: false, why: 'bad_redirect' };
        u = next;
        continue;
      }
      const ms = Date.now() - started;
      if (r.status >= 500 && r.status !== 503) return { checked: true, ok: false, url: u.toString(), error: `http_${r.status}`, ms };
      // A listing that links to a page that's gone: check the homepage once, and report the broken link.
      if ((r.status === 404 || r.status === 410) && !brokenLink && u.pathname !== '/') { brokenLink = true; u = new URL('/', u); continue; }
      // 401, 403, 429, 503 and friends are usually bot walls (Cloudflare and co.), not a broken site.
      if (r.status >= 400) return r.status === 404 || r.status === 410 ? { checked: true, ok: false, url: u.toString(), error: `http_${r.status}`, ms } : { checked: false, why: `http_${r.status}` };
      const type = String(r.headers['content-type'] || 'text/html');
      if (!/html|xml/i.test(type)) return { checked: false, why: 'not_html' };
      const signals = parse(r.body, u.toString(), now);
      if (signals.thin) return { checked: false, why: 'script_only', url: u.toString() };
      return { checked: true, ok: true, url: u.toString(), ms, ...signals, ...(brokenLink ? { brokenLink: true } : {}) };
    }
    return { checked: false, why: 'redirect_loop' };
  } catch (e) {
    const code = e && e.code;
    if (code === 'EBLOCKED') return { checked: false, why: 'blocked_address' };
    if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN'].includes(code) || /timeout/i.test(e.message)) {
      return { checked: true, ok: false, url: u.toString(), error: code || 'timeout', ms: Date.now() - started };
    }
    // TLS errors (expired or wrong certificate) are a real problem a visitor would hit too.
    if (/CERT|SSL|TLS/i.test(code || e.message)) return { checked: true, ok: false, url: u.toString(), error: 'tls', ms: Date.now() - started };
    return { checked: false, why: code || 'error' };
  }
}

// Many sites at once, inside a time budget. Sites still waiting when it runs out stay unchecked.
async function auditAll(list, { concurrency = 8, budgetMs = 14000, perMs = 6000, onProgress, now, cache } = {}) {
  const todo = list.filter((b) => b.website);
  const end = Date.now() + budgetMs;
  let i = 0, done = 0;
  async function worker() {
    while (i < todo.length) {
      const b = todo[i++];
      const left = end - Date.now();
      if (left < 800) { b.site = { checked: false, why: 'time' }; continue; }
      const key = String(b.website).toLowerCase();
      const hit = cache && cache.get(key);
      b.site = hit || await audit(b.website, { timeoutMs: Math.min(perMs, left), now });
      if (cache && !hit && b.site.checked) cache.set(key, b.site);
      done++;
      if (onProgress) onProgress({ checked: done, of: todo.length });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  return list;
}

module.exports = { audit, auditAll, parse, checkUrl, privateAddress, safeLookup };
