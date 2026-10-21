// Perks and grants in HQ (flag HQ_PERKS, lib/harness/flags.js): startup credits, software at a discount, grants,
// free advisers and courses, and the bigger bets (equity and R&D money), each read from the program's own page.
//
// The rules every row keeps (test/perks.test.js checks them):
// - `url` is the program's official page, `checked` the day someone read it there. An amount is only ever what that
//   page states, worded as the most a program offers ("Up to"), never as what a member will get. Where the page
//   gives no figure, `amount` is null and the row says so.
// - No affiliate or referral links. Plain links to the official page only (Legal PK2).
// - `source`, when set, is the official page a fact came from when the program's own page wouldn't load for us.
// - `fee` names any cost to apply or join, as the page states it.
// - A row older than STALE_DAYS since `checked` shows "recheck" to admins and drops off Closing soon. Past HIDE_DAYS it is
//   hidden from members altogether until someone rereads it (Legal L100 PF2). Never add the amounts up (PF5), and never
//   say 127 gives, includes or unlocks any of these (PF6): anyone can apply directly.
//
// What a member saves (saved, applying, sent, heard back) stays in their own browser, like Life (public/js/perks.js,
// one localStorage key per member, see scope()). There are no save routes, nothing is sent to AI, and nothing here
// calls another service. "Might fit" reads the Brain's place, kind of business and stage on the server, without AI, and
// says why (PM1, PM2); owner details are browser-only filters and never reach the Brain or AI (PM3). The application
// drafter is lib/perks/draft.js (PD1-PD6).

const crypto = require('crypto');

const CHECKED = '2026-10-21';
const STALE_DAYS = 45;
const HIDE_DAYS = 90;

// What kind of business a program fits. A member taps these on the page; `any` fits every one.
const FITS = [
  ['software', 'Software or AI'],
  ['service', 'Services'],
  ['store', 'Online store'],
  ['creator', 'Creator'],
  ['local', 'Local business'],
  ['women', 'Women-owned'],
  ['rnd', 'R&D'],
];

const SHELVES = [
  ['credits', 'Cloud and AI credits', 'Credits toward servers, storage and AI models. Most are for companies building software.'],
  ['tools', 'Software at a discount', 'Startup pricing on tools you may already be paying for.'],
  ['grants', 'Grants', 'Money you don’t pay back. Each one is a competition, and most applicants don’t win.'],
  ['help', 'Free advisers and courses', 'People and lessons that cost nothing, or close to it.'],
  ['bets', 'Bigger bets', 'Equity investment and federal R&D money. Large, competitive and slow.'],
];

// deadline: { kind: 'rolling' } | { kind: 'date', on: 'YYYY-MM-DD' } | { kind: 'monthly' } (last day of each month)
//           | { kind: 'quarterly' } (a window that closes at the end of each quarter) | { kind: 'closed' }
const PROGRAMS = [
  // ---------- credits ----------
  {
    id: 'aws-founders', shelf: 'credits', name: 'AWS Activate Founders', by: 'Amazon Web Services',
    amount: 'Up to $5,000', amountNote: 'Starts at $1,000 in AWS credits. Some companies qualify for more, up to $5,000.',
    fits: ['software'], who: ['Self-funded or bootstrapped', 'Pre-Series B, founded in the last 10 years', 'An AWS account on the paid tier plan'],
    notFor: 'Companies that already received Activate credits, unless asking for more than before.',
    ready: ['An AWS Builder ID on your work email', 'Your product, funding stage and company details'],
    deadline: { kind: 'rolling' }, answer: 'They say you hear back in 5 to 10 business days.',
    url: 'https://aws.amazon.com/startups/credits', checked: CHECKED,
  },
  {
    id: 'aws-portfolio', shelf: 'credits', name: 'AWS Activate Portfolio', by: 'Amazon Web Services',
    amount: 'Up to $200,000', amountNote: 'For pre-Series B companies backed by an Activate Provider.',
    fits: ['software'], who: ['Backed by an accelerator, angel or VC that is an Activate Provider', 'Pre-Series B, founded in the last 10 years'],
    notFor: 'Companies without an Org ID from an Activate Provider.',
    ready: ['The Org ID from your investor or accelerator', 'An AWS account on the paid tier plan'],
    deadline: { kind: 'rolling' }, url: 'https://aws.amazon.com/startups/credits', checked: CHECKED,
  },
  {
    id: 'google-cloud', shelf: 'credits', name: 'Google for Startups Cloud Program', by: 'Google Cloud',
    amount: 'Up to $200,000', amountNote: 'Up to $350,000 for AI startups in the Scale tier.',
    fits: ['software'], who: ['Start tier: a working product, a clear business model and plans to raise venture funding soon', 'Scale tier: venture-funded startups'],
    notFor: 'Businesses with no plan to raise outside money, at the Start tier.',
    ready: ['Your 18-character Google Cloud billing account ID'],
    deadline: { kind: 'rolling' }, url: 'https://cloud.google.com/startup/faq', checked: CHECKED,
  },
  {
    id: 'microsoft', shelf: 'credits', name: 'Microsoft for Startups', by: 'Microsoft',
    amount: 'Up to $150,000', amountNote: 'In Azure credits, plus developer tools and go-to-market help.',
    fits: ['software'], who: ['Startups building on Azure. The sign-up page sets the rules.'],
    notFor: null, ready: [],
    deadline: { kind: 'rolling' }, url: 'https://www.microsoft.com/en-us/startups', checked: CHECKED,
  },
  {
    id: 'cloudflare', shelf: 'credits', name: 'Cloudflare for Startups', by: 'Cloudflare',
    amount: 'Up to $350,000', amountNote: '$10,000 for bootstrapped companies that raised under $1M. $100,000 and $350,000 tiers are for companies funded by a Cloudflare partner. Credits last a year.',
    fits: ['software'], who: ['Incorporated in the last 10 years', 'Building a technology product', 'A live website and a public LinkedIn, X or GitHub page', 'An email on your company domain'],
    notFor: 'Anyone already approved for the program before.',
    ready: ['Your company website and domain email', 'Funding details'],
    deadline: { kind: 'rolling' }, answer: 'They say reviews take up to 48 hours.',
    url: 'https://www.cloudflare.com/forstartups/', checked: CHECKED,
  },
  {
    id: 'claude', shelf: 'credits', name: 'Claude for Startups', by: 'Anthropic',
    amount: 'Up to $45,000', amountNote: 'In discounts and credits from companies building with Claude. Founders backed by a partner VC may get up to $100,000 more in API credits through that VC.',
    fits: ['software'], who: ['Early-stage founders building on Claude'],
    notFor: null, ready: ['Join their newsletter to hear when the next group opens'],
    deadline: { kind: 'closed' }, statusNote: 'The current group is full. Applications are closed for now.',
    url: 'https://claude.com/programs/startups', checked: CHECKED,
  },
  {
    id: 'digitalocean', shelf: 'credits', name: 'DigitalOcean Startups', by: 'DigitalOcean',
    amount: null, amountNote: 'The amount varies and comes in your welcome email. Credits run 12 months, with 15 months of support.',
    fits: ['software'], who: ['Raised $10M or less', 'A company website and matching company email', 'New to DigitalOcean credits'],
    notFor: 'Service businesses such as agencies, consultants and dev shops.',
    ready: ['A DigitalOcean team account on your company email'],
    deadline: { kind: 'rolling' }, url: 'https://www.digitalocean.com/hatch', checked: CHECKED,
  },
  {
    id: 'mongodb', shelf: 'credits', name: 'MongoDB for Startups', by: 'MongoDB',
    amount: null, amountNote: 'Atlas credits in four tiers. They don’t publish the amounts.',
    fits: ['software'], who: ['Under 7 years old, Series A or earlier', 'One software product', 'An active website and LinkedIn page'],
    notFor: 'Development shops and agencies.',
    ready: ['A referral from your investor or accelerator, if you have one'],
    deadline: { kind: 'rolling' }, url: 'https://www.mongodb.com/solutions/startups', checked: CHECKED,
  },

  // ---------- tools ----------
  {
    id: 'notion', shelf: 'tools', name: 'Notion for Startups', by: 'Notion',
    amount: 'Up to 6 months free', amountNote: 'Business plan with Notion AI. 3 months with a business website and domain email, 6 with a partner, 1 for teams under 10.',
    fits: ['any'], who: ['Not paying for Notion today', 'Under 100 employees', 'A work email, not Gmail or Outlook'],
    notFor: 'Anyone who already used a Notion promotion.',
    ready: ['Your business website', 'A company domain email'],
    deadline: { kind: 'rolling' }, url: 'https://www.notion.com/startups', checked: CHECKED,
  },
  {
    id: 'hubspot', shelf: 'tools', name: 'HubSpot for Startups', by: 'HubSpot',
    amount: 'Up to 90% off year one', amountNote: 'Then 50% off year two and 25% off year three. Startups tied to an approved entrepreneur group get 30% off year one. An annual commitment.',
    fits: ['any'], who: ['Raised pre-seed, seed or Series A, or', 'Affiliated with an approved HubSpot partner'],
    notFor: 'Companies past Series A, for the 90% tier.',
    ready: ['Your funding on Crunchbase or a partner affiliation'],
    deadline: { kind: 'rolling' }, url: 'https://www.hubspot.com/startups', checked: CHECKED,
  },
  {
    id: 'intercom', shelf: 'tools', name: 'Intercom Early Stage', by: 'Intercom',
    amount: '93% off year one', amountNote: 'Then 50% off year two and 25% off year three, while you stay on the program.',
    fits: ['software', 'store'], who: ['Up to $10M raised', 'Fewer than 15 employees', 'Not an Intercom customer today'],
    notFor: null, ready: [],
    deadline: { kind: 'rolling' }, url: 'https://www.intercom.com/early-stage', checked: CHECKED,
  },
  {
    id: 'zendesk', shelf: 'tools', name: 'Zendesk for Startups', by: 'Zendesk',
    amount: '6 months free', amountNote: 'Professional Suite and Copilot. Up to 2 years through a partner VC or accelerator.',
    fits: ['software', 'store'], who: ['Under 10 years old', 'Angel through Series B', '50 employees or fewer without a partner referral'],
    notFor: 'Past or current paying Zendesk customers.',
    ready: ['Your work email'],
    deadline: { kind: 'rolling' }, url: 'https://www.zendesk.com/startups/', checked: CHECKED,
  },
  {
    id: 'atlas', shelf: 'tools', name: 'Stripe Atlas', by: 'Stripe',
    amount: '$2,500 in Stripe credits', amountNote: 'Plus access to more than $50,000 in partner discounts, after you incorporate.',
    fee: '$500 one time to incorporate in Delaware, then $100 a year for the registered agent. Delaware\u2019s yearly tax, and registering in your home state if you work there, cost extra.',
    fits: ['software', 'store'], who: ['Founders forming a Delaware C corp or LLC'],
    notFor: 'Businesses happy with a home-state LLC.',
    ready: [],
    deadline: { kind: 'rolling' }, url: 'https://stripe.com/atlas', checked: CHECKED,
  },

  // ---------- grants ----------
  {
    id: 'amber', draft: true, shelf: 'grants', name: 'Amber Grant', by: 'WomensNet',
    amount: '$15,000 a month', amountNote: 'Three $15,000 grants each month. Monthly winners are in the running for three $75,000 grants at year end.',
    fee: '$15 to apply. They waive it on request by email.',
    fits: ['women'], who: ['A woman 18 or older', 'At least 50% women-owned', 'Based in the US or Canada'],
    notFor: 'Charities whose main work is giving.',
    ready: ['Your story', 'Your plan to start or grow the business', 'What you’d do with the money'],
    deadline: { kind: 'monthly' }, answer: 'Winners are named by the 21st of the next month.',
    url: 'https://ambergrantsforwomen.com/faq/', checked: CHECKED,
  },
  {
    id: 'tory-burch', draft: true, shelf: 'grants', name: 'Tory Burch Foundation Fellows', by: 'Tory Burch Foundation',
    amount: null, amountNote: 'A grant for business education plus a year of workshops. The amount is in their Fellowship Rules.',
    fits: ['women'], who: ['51% or more owned and run by women', 'At least $75,000 a year in revenue', 'For-profit, formed and operating in the US', 'Applicant 21 or older and a legal US resident'],
    notFor: 'Businesses under $75,000 a year.',
    ready: ['Your revenue figures', 'The Fellowship Rules, read first'],
    deadline: { kind: 'date', on: '2026-11-17' }, answer: 'Fellows are picked in May 2027.',
    url: 'https://www.toryburchfoundation.org/fellows/', checked: CHECKED,
  },
  {
    id: 'nase', draft: true, shelf: 'grants', name: 'NASE Growth Grants', by: 'National Association for the Self-Employed',
    amount: 'Up to $4,000', amountNote: 'They can award more, less or nothing.',
    fee: 'Paid NASE membership. Annual, Veteran and Gold members apply right away; monthly members after 90 days.',
    fits: ['any'], who: ['A member in good standing'],
    notFor: 'Paying down debt, rent or a mortgage.',
    ready: ['How you’d use the grant', 'A business plan', 'A recent tax return or profit and loss (projections are fine if you’re new)', 'A photo of you or the business'],
    deadline: { kind: 'quarterly' }, answer: 'Reviewed after each quarter. Answers by email within about 30 days.',
    url: 'https://www.nase.org/become-a-member/member-benefits/business-resources/growth-grants', checked: CHECKED,
  },
  {
    id: 'grants-gov', shelf: 'grants', name: 'Grants.gov', by: 'US federal government',
    amount: null, amountNote: 'Every federal grant, searchable. Most are for organizations; each listing says who can apply.',
    fits: ['rnd', 'local'], who: ['Small businesses that meet SBA size standards, where a listing allows them'],
    notFor: 'Personal money. That isn’t what Grants.gov is for.',
    ready: ['The eligibility section of each listing, read first'],
    deadline: { kind: 'rolling' }, url: 'https://www.grants.gov/learn-grants/grant-eligibility', checked: CHECKED,
  },

  // ---------- help ----------
  {
    id: 'score', shelf: 'help', name: 'SCORE mentors', by: 'SCORE, an SBA partner',
    amount: 'Free', amountNote: 'A volunteer business mentor, at no cost.',
    fits: ['any'], who: ['Anyone starting or running a small business in the US'],
    notFor: null, ready: [],
    deadline: { kind: 'rolling' }, url: 'https://www.score.org/',
    source: 'https://www.sba.gov/local-assistance/resource-partners/small-business-development-centers-sbdc', sourceName: 'SBA.gov', checked: CHECKED,
  },
  {
    id: 'sbdc', shelf: 'help', name: 'Small Business Development Centers', by: 'SBA partners',
    amount: null, amountNote: 'One-on-one advising on planning, money, marketing and getting funded. Ask your center about cost.',
    fits: ['any'], who: ['Existing small businesses and people about to start one'],
    notFor: null, ready: ['Your ZIP code to find the nearest center'],
    deadline: { kind: 'rolling' }, url: 'https://www.sba.gov/local-assistance/resource-partners/small-business-development-centers-sbdc', checked: CHECKED,
  },
  {
    id: 'wbc', shelf: 'help', name: 'Women’s Business Centers', by: 'SBA partners',
    amount: 'Free to low cost', amountNote: 'Counseling and training, plus help with federal contracts and access to capital.',
    fits: ['women'], who: ['Women starting or growing a business'],
    notFor: null, ready: ['Your ZIP code to find the nearest center'],
    deadline: { kind: 'rolling' }, url: 'https://www.sba.gov/local-assistance/resource-partners/womens-business-centers', checked: CHECKED,
  },
  {
    id: 'hubspot-academy', shelf: 'help', name: 'HubSpot Academy', by: 'HubSpot',
    amount: 'Free', amountNote: 'Courses and certificates in social media, email, content marketing and sales.',
    fits: ['any'], who: ['Anyone'],
    notFor: null, ready: [],
    deadline: { kind: 'rolling' }, url: 'https://academy.hubspot.com/', checked: CHECKED,
  },
  {
    id: 'grow-google', shelf: 'help', name: 'Grow with Google', by: 'Google',
    amount: null, amountNote: 'AI training for small businesses, local coaches and YouTube lessons. Their AI certificate comes with three months of Google AI Pro if you redeem by January 1, 2027.',
    fits: ['any'], who: ['Small business owners'],
    notFor: null, ready: [],
    deadline: { kind: 'rolling' }, url: 'https://grow.google/', checked: CHECKED,
  },

  // ---------- bets ----------
  {
    id: 'sbir', draft: true, shelf: 'bets', name: 'SBIR and STTR', by: 'America’s Seed Fund, 11 federal agencies',
    amount: 'Up to $335,937', amountNote: 'For Phase I. Phase II goes up to $2,239,578. These are ceilings, and there’s no equity taken.',
    fits: ['rnd', 'software'], who: ['American small businesses doing scientific or technical R&D'],
    notFor: 'Businesses with no research to do.',
    ready: ['An open topic that matches your work, from their topics list'],
    deadline: { kind: 'rolling' }, statusNote: 'Each agency topic has its own deadline.',
    url: 'https://www.sbir.gov/about', checked: CHECKED,
  },
  {
    id: 'yc', draft: true, shelf: 'bets', name: 'Y Combinator', by: 'Y Combinator',
    amount: '$500,000 investment', amountNote: '$125,000 for 7% of the company, plus $375,000 on an uncapped MFN SAFE. This is investment, not a grant.',
    fits: ['software'], who: ['Startups aiming to grow very large'],
    notFor: 'A business you want to keep fully owned.',
    ready: [],
    deadline: { kind: 'rolling' }, statusNote: 'Batch dates are on their site.',
    url: 'https://www.ycombinator.com/deal', checked: CHECKED,
  },
];

// Read on the official pages Oct 21 but left off until their own page shows current terms: Hello Alice (page
// wouldn't load), FedEx Small Business Grant Contest (no 2026 terms yet), Comcast RISE (moved), Verizon Digital Ready,
// Techstars and MassChallenge (no terms on the page), Halstead Grant (page wouldn't load). See v2/perks/sources.md.

const SBA_LINE = { quote: 'SBA does not provide grants for starting and expanding a business.', url: 'https://www.sba.gov/funding-programs/grants', checked: CHECKED };

const dayMs = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));

// The next date a program closes, on or after `now`, or null (rolling or closed).
function nextDeadline(p, now = new Date()) {
  const d = p.deadline || {}, today = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (d.kind === 'date') { const on = new Date(`${d.on}T00:00:00Z`); return on >= today ? iso(on) : null; }
  if (d.kind === 'monthly') return iso(utc(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  if (d.kind === 'quarterly') { const q = Math.floor(today.getUTCMonth() / 3); return iso(utc(today.getUTCFullYear(), q * 3 + 3, 0)); }
  return null;
}

function daysLeft(on, now = new Date()) {
  const today = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((new Date(`${on}T00:00:00Z`) - today) / dayMs);
}

function stale(p, now = new Date()) { return daysLeft(p.checked, now) < -STALE_DAYS; }
function expired(p, now = new Date()) { return daysLeft(p.checked, now) < -HIDE_DAYS; }

function status(p) {
  const k = (p.deadline || {}).kind;
  if (k === 'closed') return 'closed';
  if (k === 'rolling') return 'rolling';
  return 'open';
}

function view(p, now = new Date()) {
  const due = nextDeadline(p, now);
  return { ...p, due, left: due ? daysLeft(due, now) : null, status: status(p), stale: stale(p, now), expired: expired(p, now) };
}

// { admin: true } keeps rows past HIDE_DAYS (marked) so someone can reread them; members never see those.
function list(now = new Date(), { admin = false } = {}) { return PROGRAMS.map((p) => view(p, now)).filter((p) => admin || !p.expired); }

function shelves(now = new Date(), opts = {}) {
  const all = list(now, opts);
  return SHELVES.map(([id, title, line]) => ({ id, title, line, items: all.filter((p) => p.shelf === id) }));
}

// Dated deadlines in the next `days`, soonest first. Stale rows drop off: a date we haven't rechecked isn't shown as fact.
function soon(now = new Date(), days = 60) {
  return list(now).filter((p) => p.due && !p.stale && p.left >= 0 && p.left <= days).sort((a, b) => a.left - b.left);
}

function get(id, now = new Date(), { admin = false } = {}) {
  const p = PROGRAMS.find((x) => x.id === id);
  if (!p) return null;
  const v = view(p, now);
  return admin || !v.expired ? v : null;
}

// The lede says one date while every row shown was read the same day; otherwise each row carries its own (PF1).
function readDates(rows) { const d = [...new Set(rows.map((p) => p.checked))]; return d.length === 1 ? d[0] : null; }

// "Read Oct 21", or "Read on SBA.gov, Oct 21" when the fact came from a page other than the program's own (PF1).
function readLine(p, fmt) { return p.sourceName ? `Read on ${p.sourceName}, ${fmt(p.checked)}` : `Read ${fmt(p.checked)}`; }

// ---------- Might fit (PM1, PM2): the Brain's kind of business, place and stage, on the server, no AI ----------
// Never "you qualify": each program decides. Owner details (women-owned and the like) are never read here (PM3).
const KIND = [
  ['software', /\b(software|saas|app|apps|ai|platform|developer|tech)\b/i, 'you\u2019re building software'],
  ['store', /\b(e-?commerce|online store|shop|store|physical product|products?|merch)\b/i, 'you sell products online'],
  ['creator', /\b(creator|content|youtube|tiktok|podcast|personal brand|influencer)\b/i, 'you\u2019re a creator'],
  ['service', /\b(service|services|freelance|agency|consult\w*|coach\w*|cleaning|tutor\w*)\b/i, 'you run a service business'],
  ['local', /\b(local business|salon|gym|restaurant|cafe|bakery|studio|shop in)\b/i, 'you run a local business'],
];
const US = /^(us|usa|u\.s\.a?\.?|united states( of america)?|america)$/i;
const CA = /^(ca|canada)$/i;

function kindsOf(brain) {
  const b = (brain && brain.business) || {};
  const text = [b.niche, b.what, b.offer].filter(Boolean).join(' ');
  return KIND.filter(([, re]) => re.test(text)).map(([k, , why]) => ({ k, why }));
}

// { id: reason } for the rows that might fit. A row fits on a kind of business it names (not "any"), and is left
// out when the Brain's country rules it out.
function mightFit(brain, rows) {
  const b = (brain && brain.business) || {};
  const kinds = kindsOf(brain);
  const country = String(b.country || '').trim();
  const out = {};
  if (!kinds.length) return out;
  for (const p of rows) {
    if (p.status === 'closed') continue;
    const usOnly = /\bUS\b|United States|American/.test(p.who.join(' ')) && !/Canada/.test(p.who.join(' '));
    if (country && usOnly && !US.test(country)) continue;
    if (country && p.id === 'amber' && !US.test(country) && !CA.test(country)) continue;
    const hit = kinds.find((x) => p.fits.includes(x.k));
    if (!hit) continue;
    const where = country && (US.test(country) || CA.test(country)) && (usOnly || p.id === 'amber') ? ` and that you\u2019re in ${US.test(country) ? 'the US' : 'Canada'}` : '';
    out[p.id] = `You said ${hit.why}${where}.`;
  }
  return out;
}

// One localStorage key per member, so two members on one device never see each other's list.
function scope(userId) { return crypto.createHash('sha256').update(`127-perks:${userId}`).digest('hex').slice(0, 16); }

module.exports = { list, shelves, soon, get, nextDeadline, daysLeft, stale, expired, scope, readDates, readLine, mightFit, kindsOf, PROGRAMS, SHELVES, FITS, SBA_LINE, CHECKED, STALE_DAYS, HIDE_DAYS };
