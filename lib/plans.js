// Single source of truth for tiers and what each one unlocks.
// Change prices here AND in Stripe (the Stripe price IDs come from env vars).

const PLANS = {
  free: {
    key: 'free',
    name: 'Free',
    price: 0,
    tagline: 'Start with clarity.',
    features: [
      'Founder assessment and personalized 30-day roadmap',
      'Starter library: The Idea Test, interview scripts and the content calendar',
      "15 messages a month with Eli's Playbook (AI)",
      'Progress tracking, milestones and the member wins board',
    ],
    aiRunsPerMonth: 15,
    rank: 0,
  },
  builder: {
    key: 'builder',
    name: 'Builder',
    price: 29,
    tagline: 'Everything you need to execute.',
    features: [
      'Full library: every playbook, worksheet, calculator and template',
      "Every AI tool and about 300 Playbook messages a month",
      'Full roadmap with every step unlocked',
      'Saved worksheets and AI feedback on your answers',
      'New resources added monthly',
    ],
    aiRunsPerMonth: 300,
    rank: 1,
  },
  circle: {
    key: 'circle',
    name: "Founder's Circle",
    price: 299,
    tagline: 'A small room for committed, driven founders.',
    features: [
      'Everything in Builder',
      'Weekly 45-minute group call with Eli',
      'Submit questions before every call',
      'Private member group',
      'Call notes and action items after each session',
      'Two in-person gatherings a year',
    ],
    aiRunsPerMonth: 600,
    rank: 2,
    byApplication: true,
  },
};

function plan(key) {
  return PLANS[key] || PLANS.free;
}

function canAccess(user, requiredTier) {
  return plan(user && user.tier).rank >= plan(requiredTier).rank;
}

module.exports = { PLANS, plan, canAccess };
