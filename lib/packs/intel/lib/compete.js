// Competitor facts from their own public pages (kit scan) plus a Shopify store's public
// products.json when the site runs on Shopify. Pure helpers for the intel tools and tests.

const { web, text, leads } = require('../../_kit');

// Pasted text -> [{ website, name }] (one per line or comma; "Name - site.com" works too).
function parseSites(raw, max = 5) {
  const out = [];
  const seen = new Set();
  for (const part of String(raw || '').split(/[\n,;]+/)) {
    const m = part.match(/((https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?)/i);
    if (!m) continue;
    const url = web.normalizeUrl(m[1]);
    const dom = url && web.domainOf(url);
    if (!dom || seen.has(dom)) continue;
    seen.add(dom);
    const name = text.plain(part.replace(m[0], '').replace(/[-|:]+\s*$/, '').replace(/^\s*[-|:]+/, '')).trim();
    out.push({ website: url, name: name.length >= 2 && name.length <= 60 ? name : '' });
    if (out.length >= max) break;
  }
  return out;
}

function median(nums) {
  const a = nums.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round(((a[m - 1] + a[m]) / 2) * 100) / 100;
}

// Public Shopify catalog (verified 2026-10-19: allbirds.com/products.json answers 200 with products and
// variant prices; some stores block it with a bot wall, which we report as unknown). Robots respected.
async function shopifyCatalog(ctx, siteUrl) {
  let origin;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return null;
  }
  return web.cached(ctx, `intel:shopify:v1:${origin}`, 24, async () => {
    const url = `${origin}/products.json?limit=250`;
    if (!(await web.allowed(ctx, url))) return { blocked: 'robots' };
    try {
      const r = await web.getJson(ctx, url, { timeoutMs: 12000, maxBytes: 4e6 });
      if (!r.ok || !r.data || !Array.isArray(r.data.products)) return { blocked: `answered ${r.status}` };
      const prices = [];
      const types = {};
      for (const p of r.data.products) {
        for (const v of p.variants || []) if (Number(v.price) > 0) prices.push(Number(v.price));
        if (p.product_type) types[p.product_type] = (types[p.product_type] || 0) + 1;
      }
      const top = Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t, n]) => ({ type: text.plain(t), count: n }));
      return { products: r.data.products.length, capped: r.data.products.length >= 250, low: prices.length ? Math.min(...prices) : null, median: median(prices), high: prices.length ? Math.max(...prices) : null, types: top, titles: r.data.products.slice(0, 5).map((p) => text.clip(text.plain(p.title || ''), 60)) };
    } catch {
      return { blocked: "didn't answer" };
    }
  });
}

// One competitor's facts in a compact, stable shape.
function factsOf(place, scan, shop) {
  const lead = leads.makeLead(place, scan, {});
  const s = lead.site;
  // A sample place keeps its "(sample)" name, so a made-up business is never mistaken for a real one.
  const name = ((place.sample && place.name) || lead.siteName || place.name || '').replace(/[\u2122\u00ae\u00a9]/g, '').trim() || (lead.website ? web.shortSite(lead.website) : 'Competitor');
  return {
    key: lead.key,
    name,
    // Where the business came from (pasted, osm, sample): lists and files that show it add the D27 credit.
    source: place.source || null,
    ...(place.searchBy ? { searchBy: place.searchBy } : {}),
    website: lead.website,
    siteStatus: lead.siteStatus,
    siteNote: lead.siteNote,
    sample: !!lead.sample,
    platform: s ? s.platform : null,
    offer: s && s.offer ? s.offer.text || s.offer.kind : null,
    prices: s ? s.prices.map((p) => ({ amount: p.amount, per: p.per, context: p.context })) : [],
    booking: s ? s.booking : [],
    proof: s ? (s.reviewWidgets.length ? `Review widget (${s.reviewWidgets.join(', ')})` : s.testimonials ? 'Testimonials on the site' : null) : null,
    socials: s ? Object.keys(s.socials || {}).filter((k) => s.socials[k]) : [],
    video: !!(s && s.video.onSite),
    emailSignup: !!(s && (s.emailCapture || s.emailTools.length)),
    chat: !!(s && s.chat.length),
    ads: !!(s && (s.tracking.metaPixel || s.tracking.googleAds)),
    mobile: !!(s && s.mobileReady),
    hours: s ? s.hours : null,
    headline: s ? s.h1 || s.title : null,
    description: s ? s.description : null,
    gaps: lead.gaps.filter((g) => g.source === 'website').map((g) => g.chip),
    shop: shop || null,
  };
}

const FEATURES = [
  ['offer', 'First-visit offer', (c) => !!c.offer],
  ['prices', 'Prices shown', (c) => c.prices.length > 0 || !!(c.shop && c.shop.median)],
  ['booking', 'Online booking or buying', (c) => c.booking.length > 0 || !!c.shop],
  ['proof', 'Reviews on the site', (c) => !!c.proof],
  ['video', 'Video on the homepage', (c) => c.video],
  ['emailSignup', 'Email signup', (c) => c.emailSignup],
  ['chat', 'Chat', (c) => c.chat],
  ['ads', 'Ad tracking', (c) => c.ads],
  ['mobile', 'Phone-ready site', (c) => c.mobile],
];

// What most of them do (table stakes) and what few do (your opening), from the checked sites only.
function patterns(comps) {
  const ok = comps.filter((c) => c.siteStatus === 'ok');
  return FEATURES.map(([id, label, has]) => {
    const n = ok.filter(has).length;
    return { id, label, n, of: ok.length, who: ok.filter(has).map((c) => c.name) };
  });
}

module.exports = { parseSites, shopifyCatalog, factsOf, patterns, FEATURES, median };
