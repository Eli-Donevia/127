// Who to pitch first. Three plain scores a member can argue with, each with its reasons:
//   Can pay (0-40):    the owner decides, already pays for software and ads, charges enough per member.
//   Needs help (0-40): the video gap: no video on the site, quiet or photo-only Instagram, missing platforms.
//   Reachable (0-20):  an email, a phone, an Instagram to DM, an owner's name.
// Opportunity (0-100) = 100 x sqrt(needs help x can pay, each as a share of 40) x (0.6 + 0.4 x reachable/20),
// so a gym needs both a real video gap and the money to fix it. Tier A from 55, B from 35, and rank() also
// tiers by place in the list (see there).
// Content strength (0-100) is shown separately: how good their video presence is today, and how sure we are.
// Only facts we read (their website, their Instagram through the official API or the member's screenshots)
// move a score. Nothing unknown is guessed: unknown just scores neutral and says "not checked".

const { clamp, round } = require('./util');

const BOUTIQUE = new Set(['crossfit', 'pilates', 'yoga', 'cycling', 'boxing', 'climbing', 'martial_arts', 'dance']);
const YOUNG = new Set(['crossfit', 'boxing', 'climbing', 'dance', 'martial_arts', 'cycling']);
const WEIGHTS = {
  canPay: { independent: 12, franchise: 8, nonprofit: 3, corporate: 0, public: 0, proSoftware: 8, basicSoftware: 4, ads: 8, price120: 8, price60: 5, price30: 2, priceUnknown: 2, boutique: 4, multiLocation: 4 },
  needsHelp: { noSiteVideo: 8, noInstagram: 6, instagramUnchecked: 4, quiet30: 10, quiet14: 6, fewReels: 8, someReels: 4, slowPosting: 6, okPosting: 3, lowEngagement: 4, noTiktok: 4, noYoutube: 2, noTestimonials: 2, staleSite: 2 },
  reachable: { email: 6, emailOwnDomain: 2, phone: 4, instagram: 5, ownerName: 3 },
  tiers: { A: 55, B: 35 },
};

function pick(o, ...keys) {
  for (const k of keys) if (o && o[k] != null) return o[k];
  return null;
}

// gym: a find_gyms record. site: scanSite() result (or null). content: Instagram summary (or null).
function scoreGym(gym, site, content, { year = new Date().getUTCFullYear(), weights = WEIGHTS } = {}) {
  const W = weights;
  const why = { canPay: [], needsHelp: [], reachable: [] };
  const s = site && site.reachable ? site : null;
  const ig = content && !content.unavailable ? content : null;
  const socials = (s && s.socials) || {};
  const igHandle = (ig && ig.handle) || gym.localInstagram || (gym.brandSocials ? null : socials.instagram) || gym.instagram || null;
  const tiktok = gym.localTiktok || (gym.brandSocials ? null : socials.tiktok) || gym.tiktok || null;
  const youtube = gym.brandSocials ? null : socials.youtube || gym.youtube || null;

  // ---- can pay ----
  let canPay = 0;
  const own = W.canPay[gym.owner] != null ? W.canPay[gym.owner] : 0;
  canPay += own;
  if (gym.owner === 'independent') why.canPay.push('Independent: the owner decides and pays.');
  else if (gym.owner === 'franchise') why.canPay.push(`Franchise (${gym.brand || 'chain'}): a local owner, inside brand rules.`);
  else if (gym.owner === 'corporate') why.canPay.push('Corporate: head office runs marketing.');
  else if (gym.owner === 'nonprofit') why.canPay.push('Nonprofit: slow to buy.');
  const brandSite = !!(s && s.brandSite);
  if (brandSite) why.canPay.push("Its web page is the brand's, so only its local Instagram counts.");
  const booking = (s && !brandSite && s.booking) || [];
  const pro = booking.find((b) => b.tier === 'pro');
  if (pro) {
    canPay += W.canPay.proSoftware;
    why.canPay.push(`Pays for ${pro.name}, so it already spends on tools.`);
  } else if (booking.length) {
    canPay += W.canPay.basicSoftware;
    why.canPay.push(`Books through ${booking[0].name}.`);
  }
  const t = (s && !brandSite && s.tracking) || {};
  if (t.metaPixel || t.googleAds || t.tiktokPixel) {
    canPay += W.canPay.ads;
    const which = [t.metaPixel && 'Meta', t.googleAds && 'Google', t.tiktokPixel && 'TikTok'].filter(Boolean).join(' and ');
    why.canPay.push(`Has a ${which} ad pixel on the site, so it has paid for ads.`);
  }
  const price = s && s.monthlyPrice;
  if (Number.isFinite(price)) {
    if (price >= 120) canPay += W.canPay.price120;
    else if (price >= 60) canPay += W.canPay.price60;
    else if (price >= 30) canPay += W.canPay.price30;
    why.canPay.push(`Charges about $${Math.round(price)} a month (from its site).`);
  } else canPay += W.canPay.priceUnknown;
  if (BOUTIQUE.has(gym.category)) {
    canPay += W.canPay.boutique;
    why.canPay.push('Boutique studio: lives and dies on Instagram.');
  }
  if ((gym.locations || 1) > 1) {
    canPay += W.canPay.multiLocation;
    why.canPay.push(`${gym.locations} locations.`);
  }
  canPay = clamp(canPay, 0, 40);

  // ---- needs help ----
  let needsHelp = 0;
  if (s && !brandSite && !s.video.onSite && !s.video.unknown) {
    needsHelp += W.needsHelp.noSiteVideo;
    why.needsHelp.push('No video anywhere on its website.');
  }
  if (!igHandle) {
    if (s && !brandSite) {
      needsHelp += W.needsHelp.noInstagram;
      why.needsHelp.push('No Instagram linked from its website.');
    }
  } else if (!ig) {
    needsHelp += W.needsHelp.instagramUnchecked;
    why.needsHelp.push(`Instagram @${igHandle} not checked yet.`);
  } else {
    if (Number.isFinite(ig.daysSinceLastPost)) {
      if (ig.daysSinceLastPost > 30) {
        needsHelp += W.needsHelp.quiet30;
        why.needsHelp.push(`Last Instagram post ${ig.daysSinceLastPost} days ago.`);
      } else if (ig.daysSinceLastPost > 14) {
        needsHelp += W.needsHelp.quiet14;
        why.needsHelp.push(`Last Instagram post ${ig.daysSinceLastPost} days ago.`);
      }
    }
    if (Number.isFinite(ig.reelsShare)) {
      const pct = Math.round(ig.reelsShare * 100);
      if (ig.reelsShare < 0.25) {
        needsHelp += W.needsHelp.fewReels;
        why.needsHelp.push(`Only ${pct}% of recent posts are Reels.`);
      } else if (ig.reelsShare < 0.5) {
        needsHelp += W.needsHelp.someReels;
        why.needsHelp.push(`${pct}% of recent posts are Reels.`);
      }
    }
    const perWeek = Number.isFinite(ig.postsPerWeek) ? ig.postsPerWeek : Number.isFinite(ig.postsLast30) ? ig.postsLast30 / 4.3 : null;
    if (Number.isFinite(perWeek)) {
      if (perWeek < 1) {
        needsHelp += W.needsHelp.slowPosting;
        why.needsHelp.push(`Posts under once a week.`);
      } else if (perWeek < 2) {
        needsHelp += W.needsHelp.okPosting;
        why.needsHelp.push(`Posts about ${round(perWeek, 1)} times a week.`);
      }
    }
    if (Number.isFinite(ig.engagementRate) && ig.engagementRate < 1 && ig.followers >= 300) {
      needsHelp += W.needsHelp.lowEngagement;
      why.needsHelp.push(`Posts get likes and comments from under 1% of followers.`);
    }
  }
  if (s && !brandSite && !tiktok && YOUNG.has(gym.category)) {
    needsHelp += W.needsHelp.noTiktok;
    why.needsHelp.push('No TikTok, and its crowd skews young.');
  }
  if (s && !brandSite && !youtube) needsHelp += W.needsHelp.noYoutube;
  if (s && !brandSite && !s.testimonials) {
    needsHelp += W.needsHelp.noTestimonials;
    why.needsHelp.push('No member stories on the site.');
  }
  if (s && !brandSite && s.copyrightYear && s.copyrightYear <= year - 2) {
    needsHelp += W.needsHelp.staleSite;
    why.needsHelp.push(`Website footer still says ${s.copyrightYear}.`);
  }
  needsHelp = clamp(needsHelp, 0, 40);

  // ---- reachable ----
  let reachable = 0;
  const email = pick(gym, 'email') || (s && s.contacts && s.contacts.emails[0]) || null;
  const phone = pick(gym, 'phone') || (s && s.contacts && s.contacts.phones[0]) || null;
  const owner = (s && s.people && s.people[0]) || null;
  if (email) {
    reachable += W.reachable.email;
    if (s && s.domain && email.endsWith(`@${s.domain}`)) reachable += W.reachable.emailOwnDomain;
    why.reachable.push(`Email: ${email}`);
  }
  if (phone) {
    reachable += W.reachable.phone;
    why.reachable.push(`Phone: ${phone}`);
  }
  if (igHandle) {
    reachable += W.reachable.instagram;
    why.reachable.push(`DM: @${igHandle}`);
  }
  if (owner) {
    reachable += W.reachable.ownerName;
    why.reachable.push(`${owner.name} (${owner.role}), from the website.`);
  }
  reachable = clamp(reachable, 0, 20);

  // Needs it x can pay for it, nudged by how easy the owner is to reach. A gym with great video or no
  // budget scores low whatever else is true.
  const opportunity = Math.round(100 * Math.sqrt((needsHelp / 40) * (canPay / 40)) * (0.6 + 0.4 * (reachable / 20)));
  const tier = opportunity >= W.tiers.A ? 'A' : opportunity >= W.tiers.B ? 'B' : 'C';
  return {
    opportunity,
    tier,
    canPay,
    needsHelp,
    reachable,
    content: contentStrength({ site: s, ig, igHandle, tiktok, youtube }),
    why,
    contact: { email, phone, instagram: igHandle, tiktok, owner },
  };
}

// How strong is their video presence today (0-100) and what is that based on.
function contentStrength({ site, ig, igHandle, tiktok, youtube }) {
  if (!site && !ig) return { strength: null, label: 'Not checked', basis: 'nothing yet' };
  let p = 0;
  if (site && site.video.onSite) p += 15;
  if (tiktok) p += 8;
  if (youtube) p += 5;
  if (ig) {
    p += 10;
    if (Number.isFinite(ig.daysSinceLastPost)) p += ig.daysSinceLastPost <= 7 ? 15 : ig.daysSinceLastPost <= 14 ? 10 : ig.daysSinceLastPost <= 30 ? 4 : 0;
    if (Number.isFinite(ig.reelsShare)) p += Math.round(ig.reelsShare * 22);
    const perWeek = Number.isFinite(ig.postsPerWeek) ? ig.postsPerWeek : null;
    if (Number.isFinite(perWeek)) p += perWeek >= 4 ? 15 : perWeek >= 2 ? 10 : perWeek >= 1 ? 5 : 0;
    if (Number.isFinite(ig.engagementRate)) p += ig.engagementRate >= 3 ? 10 : ig.engagementRate >= 1 ? 5 : 0;
  } else if (igHandle) p += 10;
  const strength = clamp(Math.round(p), 0, 100);
  const label = strength >= 65 ? 'Strong' : strength >= 35 ? 'Okay' : 'Weak';
  const basis = ig ? (ig.source === 'screenshot' ? 'their Instagram (your screenshots) and website' : 'their Instagram and website') : 'their website only';
  return { strength, label, basis };
}

// Order by opportunity. Tiers are relative to this list as well as absolute, because what matters is
// who to pitch first here: the top fifth (at least 3) is A if it scores 25 or more; the next
// third is B if it scores 12 or more. A gym that clears the absolute bar keeps its tier anyway.
// (Website-only checks top out near 50; checking Instagram is what moves a gym higher.)
function rank(rows, { weights = WEIGHTS } = {}) {
  const sorted = rows
    .slice()
    .sort((a, b) => b.score.opportunity - a.score.opportunity || b.score.needsHelp - a.score.needsHelp || (a.gym.km || 0) - (b.gym.km || 0));
  const aCut = Math.max(3, Math.ceil(sorted.length * 0.2));
  const bCut = aCut + Math.ceil(sorted.length * 0.35);
  return sorted.map((r, i) => {
    const o = r.score.opportunity;
    const tier = o >= weights.tiers.A || (i < aCut && o >= 25) ? 'A' : o >= weights.tiers.B || (i < bCut && o >= 12) ? 'B' : 'C';
    return { ...r, rank: i + 1, score: { ...r.score, tier } };
  });
}

module.exports = { scoreGym, contentStrength, rank, WEIGHTS, BOUTIQUE, YOUNG };
