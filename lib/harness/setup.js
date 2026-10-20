// "What to set up next": the tools and connections that make 127 work harder for this member, picked
// from what they sell, where they post and what they've connected. 127 earns nothing from any of
// these (no affiliate links); free tiers come first.

const ledger = require('./ledger');

const deps = { db: require('../db') };

const has = (v, x) => [].concat(v || []).includes(x);

const ITEMS = [
  {
    id: 'brain',
    title: 'Tell 127 about your business',
    why: 'Every workflow reads it: what you sell, who it is for, where you are, how you sound.',
    href: '/app/hq/brain',
    cta: 'Fill it in',
    when: () => true,
    done: (c) => !!(c.brain.business.what && c.brain.business.audience),
  },
  {
    id: 'ai',
    title: 'Put 127 inside Claude',
    why: 'Ask Claude to run a workflow, read what is waiting on you and log what you did, from any chat.',
    href: '/app/hq/connect#ai',
    cta: 'Get your AI link',
    when: (c) => c.tier !== 'free' && c.connect,
    done: (c) => !!c.conn.ai,
  },
  {
    id: 'admin',
    title: 'Make Claude your admin',
    why: 'Your own Claude, with your email and calendar, runs your morning and drafts replies from what your Brain knows.',
    href: '/app/hq/admin-setup',
    cta: 'Set it up',
    when: (c) => c.tier !== 'free' && c.connect && require('./flags').on('HQ_MCP_BRAIN', c.user),
    done: () => false,
  },
  {
    id: 'stripe',
    title: 'Connect Stripe',
    why: 'Sales and revenue fill your numbers by themselves, so your scoreboard is never stale.',
    href: '/app/hq/connect',
    cta: 'Connect',
    when: (c) => c.tier !== 'free' && c.connect && !has(c.a.model, 'product'),
    done: (c) => !!c.conn.stripe,
  },
  {
    id: 'shopify',
    title: 'Connect Shopify',
    why: 'Orders count toward your numbers the minute they come in.',
    href: '/app/hq/connect',
    cta: 'Connect',
    when: (c) => c.tier !== 'free' && c.connect && has(c.a.model, 'product'),
    done: (c) => !!c.conn.shopify,
  },
  {
    id: 'booking',
    title: 'A booking link',
    why: 'Every yes goes straight onto your calendar. Cal.com and Calendly both have free plans.',
    href: 'https://cal.com',
    cta: 'Set one up',
    when: (c) => ['service', 'local', 'software', 'digital'].some((m) => has(c.a.model, m)) || !c.a.model,
    done: (c) => !!c.brain.links.booking,
  },
  {
    id: 'manychat',
    title: 'ManyChat on your Instagram',
    why: 'Someone comments a word, they get your link by DM. The cheapest lead magnet there is, and the free plan covers it.',
    href: 'https://manychat.com',
    cta: 'Set it up',
    when: (c) => has(c.a.channels, 'instagram') || !!c.brain.links.instagram,
    done: () => false,
  },
  {
    id: 'gbp',
    title: 'Google Business Profile',
    why: 'Free, and it is how people nearby find you on Maps and in search.',
    href: 'https://www.google.com/business/',
    cta: 'Claim yours',
    when: (c) => has(c.a.model, 'local') || has(c.a.model, 'service'),
    done: () => false,
  },
  {
    id: 'capcut',
    title: 'CapCut',
    why: 'Free editing for the Reels and spec videos 127 drafts for you.',
    href: 'https://www.capcut.com',
    cta: 'Get it',
    when: (c) => has(c.a.model, 'creator') || ['instagram', 'tiktok', 'youtube'].some((ch) => has(c.a.channels, ch)),
    done: () => false,
  },
  {
    id: 'email',
    title: 'An email list',
    why: 'Followers belong to the app; an email list belongs to you. Kit and Beehiiv are free to start.',
    href: 'https://kit.com',
    cta: 'Start one',
    when: (c) => !has(c.a.channels, 'email') && (has(c.a.goal, 'audience') || has(c.a.model, 'creator') || has(c.a.model, 'digital')),
    done: () => false,
  },
  {
    id: 'site',
    title: 'Your own website',
    why: 'Somewhere to send people that you control. Site in a night builds one from your brain.',
    href: '/app/hq/start#site',
    cta: 'Build it',
    when: () => true,
    done: (c) => !!c.brain.links.website,
  },
];

// connect: HQ v1's connections page is on for this member (HQ_LIVE), so Stripe, Shopify and the AI link can be offered.
function list(user, brain, { connect = true } = {}) {
  const c = { user, a: (user && user.answers) || {}, tier: ledger.tierOf(user), brain, connect, conn: deps.db.get('hqConnections', user.id) || {} };
  const items = ITEMS.filter((i) => i.when(c)).map((i) => ({ id: i.id, title: i.title, why: i.why, href: i.href, cta: i.cta, done: !!i.done(c), external: /^https:/.test(i.href) }));
  return { items: items.filter((i) => !i.done).concat(items.filter((i) => i.done)), done: items.filter((i) => i.done).length, total: items.length };
}

module.exports = { list, ITEMS };
