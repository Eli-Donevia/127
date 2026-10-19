// The page an ad sends people to, checked the way a buyer on a phone meets it: does it load fast and
// fit the screen, say the same thing as the ad, show the price and the area, give one clear way to
// act (a tap to call, a short form or a booking link), show proof, and can the member tell which ad
// brought the visit. Only what the page itself shows; a check we can't see is "not seen", never a
// claim about the business.

const { text } = require('../../_kit');
const C = require('./claims');

const IMPACT = { high: 3, medium: 2, low: 1 };
const STOP = new Set('a an and the for to of in on at by with your you our we us is are it this that from or be as get my me i'.split(' '));

const wordsOf = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9$ ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w.length > 2 && !STOP.has(w));

// The raw HTML facts parsePage doesn't keep.
function extras(html) {
  const s = String(html || '');
  const visible = s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ');
  const plainText = visible.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const forms = (s.match(/<form\b[\s\S]*?<\/form>/gi) || []).map((f) => {
    const fields = (f.match(/<(input|select|textarea)\b[^>]*>/gi) || []).filter((t) => !/type=["']?(hidden|submit|button|image|reset)\b/i.test(t));
    return { fields: fields.length };
  });
  const links = (s.match(/<a\b[^>]*href=["']([^"'#][^"']*)["']/gi) || []).filter((t) => !/href=["'](tel:|mailto:|sms:|javascript:)/i.test(t));
  const ctaRx = /\b(book|schedule|reserve|get (a|my|your) (quote|price|estimate)|request (a )?(quote|estimate)|call (now|us|today)|text (us|me)|buy|order|shop now|sign up|start)\b/i;
  const ctas = (s.match(/<(a|button)\b[^>]*>[\s\S]*?<\/(a|button)>/gi) || []).map((t) => t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 40 && ctaRx.test(t));
  const phoneText = (plainText.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/) || [])[0] || '';
  return {
    text: plainText,
    forms,
    links: links.length,
    ctas: [...new Set(ctas)].slice(0, 6),
    phoneText,
    tel: /href=["']tel:/i.test(s),
    sms: /href=["']sms:/i.test(s),
    privacy: /<a\b[^>]*>[^<]*privacy[^<]*<\/a>|href=["'][^"']*privacy/i.test(s),
    noindex: /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(s),
  };
}

// Every check: { id, title, status: pass|warn|fail, impact, evidence, fix }.
function checks(page, x, { url, ms, adWords, price, area, city } = {}) {
  const out = [];
  const add = (id, title, status, impact, evidence, fix = '') => out.push({ id, title, status, impact, evidence: text.oneLine(evidence), fix: text.oneLine(fix) });
  const hay = `${page.title || ''} ${page.h1 || ''} ${x.text.slice(0, 900)}`.toLowerCase();

  add('https', 'Secure address (https)', /^https:/i.test(url) ? 'pass' : 'fail', 'high', /^https:/i.test(url) ? 'The page loads over https.' : 'The page loads over plain http, and browsers mark it "Not secure".', 'Turn on SSL with your website host (most include it free), then send ads to the https address.');
  add('mobile', 'Fits a phone screen', page.mobileReady ? 'pass' : 'fail', 'high', page.mobileReady ? 'The page sets a mobile viewport.' : 'No mobile viewport tag, so phones show a shrunken desktop page.', 'Use a mobile-ready theme or add the viewport tag to the page head.');
  const kb = Math.round((page.bytes || 0) / 1024);
  const slow = ms != null && ms > 3000;
  add('speed', 'Loads fast', kb > 600 || slow ? 'warn' : 'pass', 'medium', `${ms != null ? `The page answered in ${(ms / 1000).toFixed(1)} s and ` : 'The page '}is ${kb} KB of HTML${page.scripts ? ` with ${page.scripts} script files` : ''}.`, 'Cut what the page loads before its first screen: big images, sliders and extra apps.');

  // Says what the ad says.
  const head = page.h1 || page.title || '';
  if (adWords && adWords.length) {
    const hits = adWords.filter((w) => hay.includes(w));
    const share = hits.length / adWords.length;
    add('match', 'Says what the ad says', share >= 0.5 ? 'pass' : share >= 0.25 ? 'warn' : 'fail', 'high', `${hits.length} of ${adWords.length} key words from your ad are in the page title, headline or first lines${hits.length ? ` (${hits.slice(0, 5).join(', ')})` : ''}.`, `Use the ad's words in the first headline, so the visitor knows they're in the right place: "${text.clip(head || 'your headline', 60)}" could say what the ad says.`);
  }
  add('headline', 'One clear headline', page.h1 ? 'pass' : 'warn', 'medium', page.h1 ? `Headline: "${text.clip(page.h1, 80)}".` : 'No main headline (h1) on the page.', 'Open with one headline that names the service and the area.');

  // Price and area.
  const prices = page.prices || [];
  const priceSeen = prices.length > 0 || /\$\s?\d/.test(x.text);
  const myPrice = price != null && new RegExp(`\\$\\s?${Math.round(price)}\\b`).test(x.text);
  add('price', 'Shows the price', priceSeen ? 'pass' : 'warn', 'medium', priceSeen ? `Price on the page${myPrice ? `, including your ${'$'}${Math.round(price)}` : ''}.` : 'No price on the page.', 'Show your price or a "from" price near the top. People who click a price ad expect to see it.');
  const place = [area, city].filter(Boolean).find((a) => hay.includes(String(a).toLowerCase()) || x.text.toLowerCase().includes(String(a).toLowerCase()));
  if (area || city) add('area', 'Names your area', place ? 'pass' : 'warn', 'low', place ? `The page mentions ${place}.` : `No mention of ${area || city}.`, `Say where you work (${area || city}) near the top so local buyers know it's for them.`);

  // One clear action.
  const form = x.forms[0];
  const book = (page.booking || []).map((b) => b.name);
  const ways = [x.tel ? 'tap to call' : '', x.sms ? 'tap to text' : '', form ? 'a form' : '', book.length ? `booking (${book.join(', ')})` : '', x.ctas.length ? `buttons (${x.ctas.slice(0, 3).map((c) => `"${c}"`).join(', ')})` : ''].filter(Boolean);
  add('action', 'A clear way to act', ways.length ? 'pass' : 'fail', 'high', ways.length ? `Ways to act: ${ways.join(', ')}.` : 'No button, form, booking link or tap-to-call link found.', 'Add one big button near the top: "Book now" or "Get a price", and the same button again at the bottom.');
  if (x.phoneText || x.tel) add('call', 'Tap to call', x.tel ? 'pass' : 'warn', 'medium', x.tel ? 'The phone number is a tap-to-call link.' : `The number ${x.phoneText} is shown as text, so phone visitors have to copy it.`, 'Make the number a link (tel:) so one tap calls you.');
  if (form) add('form', 'Short form', form.fields <= 5 ? 'pass' : form.fields <= 7 ? 'warn' : 'fail', 'high', `The first form asks for ${form.fields} things.`, 'Ask only what you need to reply: name, phone or email, and one question. Get the rest on the call.');

  // Proof and trust.
  const proof = page.testimonials || (page.reviewWidgets || []).length > 0;
  add('proof', 'Shows proof', proof ? 'pass' : 'warn', 'medium', proof ? `Reviews or testimonials on the page${(page.reviewWidgets || []).length ? ` (${page.reviewWidgets.join(', ')})` : ''}.` : 'No reviews, testimonials or real photos of past work found.', 'Add 2 or 3 real reviews (with permission) or before and after photos of your own jobs.');
  if (form) add('privacy', 'Privacy policy link', x.privacy ? 'pass' : 'warn', 'low', x.privacy ? 'A privacy policy is linked.' : 'The form collects details but no privacy policy is linked.', 'Link a short privacy policy near the form saying what you do with the details.');
  add('exits', 'Few ways to wander off', x.links <= 8 ? 'pass' : 'warn', 'low', `${text.plural(x.links, 'link')} lead${x.links === 1 ? 's' : ''} away from the action.`, 'On the page your ads point to, drop the full menu and keep one action. A page made just for the ad works best.');

  // Can the member tell which ad worked?
  const t = page.tracking || {};
  const tags = [t.metaPixel ? 'Meta Pixel' : '', t.googleAds ? 'Google Ads tag' : '', t.tiktokPixel ? 'TikTok Pixel' : '', t.analytics ? 'Google Analytics' : ''].filter(Boolean);
  add('tracking', 'Can tell which ad worked', tags.length ? 'pass' : 'warn', 'medium', tags.length ? `Seen: ${tags.join(', ')}.` : 'No ad or analytics tag seen in the page.', "Add the tag for the platform you'll run (Meta Pixel, Google tag or TikTok Pixel) before you spend, and use the tracking links from your ad plan.");

  // Words the ad platforms and buyers won't like.
  const flagged = C.problems(x.text.slice(0, 8000)).filter((p) => p.id !== 'house');
  add('claims', 'No claims you can be held to', flagged.length ? 'warn' : 'pass', 'medium', flagged.length ? claimEvidence(flagged[0], x.text) : 'No income claims, promised results or pressure lines found.', 'Ad reviewers read the page too. Say exactly what you do and what happens if something goes wrong, without promising a result.');
  if (x.noindex) add('noindex', 'Hidden from search', 'warn', 'low', 'The page asks search engines not to list it.', 'Fine for an ads-only page. Remove it if you want the page found on Google too.');
  return out;
}

// Where the page makes a claim. Words our own copy never uses are pointed at, not repeated.
function claimEvidence(p, pageText) {
  if (!text.copyProblems(p.match).length) return `The page says "${p.match}" (${p.why.toLowerCase()}).`;
  const sentence = String(pageText).split(/(?<=[.!?])\s+/).find((s) => s.toLowerCase().includes(p.match.toLowerCase())) || '';
  const lead = sentence.slice(0, sentence.toLowerCase().indexOf(p.match.toLowerCase())).trim().split(/\s+/).filter(Boolean).slice(-4).join(' ');
  return lead && !text.copyProblems(lead).length ? `${p.why} on the page, in the line that starts "${lead}".` : `${p.why} on the page.`;
}

// 0 to 100: what passes, weighted by impact.
function scoreOf(list) {
  let got = 0;
  let max = 0;
  for (const c of list) {
    const w = IMPACT[c.impact] || 1;
    max += w;
    got += c.status === 'pass' ? w : c.status === 'warn' ? w * 0.5 : 0;
  }
  return max ? Math.round((got / max) * 100) : 0;
}

// The fixes in order: failures first, then by impact.
function fixesOf(list) {
  const rank = { fail: 0, warn: 1 };
  return list.filter((c) => c.status !== 'pass').sort((a, b) => rank[a.status] - rank[b.status] || IMPACT[b.impact] - IMPACT[a.impact]);
}

module.exports = { extras, checks, scoreOf, fixesOf, wordsOf };
