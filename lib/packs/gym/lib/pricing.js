// Price the offer for one gym, two ways at once (pricing worksheet playbook):
//   your side:  hours x the hourly rate you want, so you never work for less than you meant to;
//   their side: what one new member is worth to the gym, from its own price on its website.
// The member-value numbers are math for the pitch, stated as "if", never a promise of results.

const { plain } = require('./util');

// Placeholder monthly membership by kind of gym, used only when the gym's site shows no price.
// Rough round numbers, not market data: shown to the member as an assumption to replace.
const DEFAULT_PRICE = { gym: 50, crossfit: 160, yoga: 120, pilates: 170, boxing: 130, martial_arts: 140, climbing: 75, cycling: 150, dance: 90, other: 80 };

const PACKAGES = [
  { id: 'starter', name: 'Starter', reels: 4, shoots: 1, extras: [], adminHours: 1 },
  { id: 'growth', name: 'Growth', reels: 8, shoots: 2, extras: ['Captions and a posting plan'], adminHours: 1.5 },
  { id: 'full', name: 'Full', reels: 12, shoots: 3, extras: ['3 ad cuts', 'A website video each quarter'], adminHours: 2, adCuts: 3 },
];

function nice(n) {
  if (n < 300) return Math.ceil(n / 25) * 25;
  if (n < 1000) return Math.ceil(n / 50) * 50;
  return Math.ceil(n / 100) * 100;
}

// input: { gym, monthlyPrice?, hourlyRate=35, editHoursPerReel=0.75, shootHours=2.5, stayMonths=8 }
function price(input) {
  const gym = input.gym || {};
  const seen = Number.isFinite(input.monthlyPrice) ? input.monthlyPrice : null;
  const memberPrice = seen || DEFAULT_PRICE[gym.category] || DEFAULT_PRICE.other;
  const rate = Number(input.hourlyRate) > 0 ? Number(input.hourlyRate) : 35;
  const perReel = Number(input.editHoursPerReel) > 0 ? Number(input.editHoursPerReel) : 0.75;
  const perShoot = Number(input.shootHours) > 0 ? Number(input.shootHours) : 2.5;
  const stay = Number(input.stayMonths) > 0 ? Number(input.stayMonths) : 8;
  const memberValue = Math.round(memberPrice * stay);
  const packages = PACKAGES.map((p) => {
    const hours = p.shoots * perShoot + (p.reels + (p.adCuts || 0)) * perReel + p.adminHours;
    const floor = hours * rate;
    const monthly = nice(floor);
    const paysBackEvery = memberValue > 0 ? monthly / memberValue : null;
    return {
      id: p.id,
      name: p.name,
      monthly,
      hours: Math.round(hours * 10) / 10,
      effectiveHourly: Math.round(monthly / hours),
      includes: [`${p.reels} Reels a month`, `${p.shoots} shoot${p.shoots > 1 ? 's' : ''} at the gym`, ...p.extras, '1 round of changes'],
      payback: paysBackEvery == null ? null : paysBackEvery <= 1 ? `pays for itself if it brings in 1 new member ${Math.floor(1 / paysBackEvery) > 1 ? `every ${Math.floor(1 / paysBackEvery)} months` : 'a month'}` : `pays for itself at ${Math.ceil(paysBackEvery)} new members a month`,
    };
  });
  return {
    memberPrice,
    memberPriceSource: seen ? 'their website' : 'a placeholder (their site shows no price: ask them)',
    stayMonths: stay,
    memberValue,
    hourlyRate: rate,
    packages,
    recommended: memberPrice >= 120 ? 'growth' : 'starter',
    assumptions: [
      `A member pays about $${memberPrice} a month (${seen ? 'from their website' : 'a placeholder: their site shows no price, so ask them'}).`,
      `A member stays about ${stay} months (change this if the owner tells you).`,
      `You edit a Reel in about ${Math.round(perReel * 60)} minutes and a shoot takes ${perShoot} hours with travel.`,
      `You want at least $${rate} an hour.`,
    ],
  };
}

function proposal({ gym, member = {}, business = {}, priced, report = {} }) {
  const rec = priced.packages.find((p) => p.id === priced.recommended) || priced.packages[0];
  const ideas = (report.ideas || []).slice(0, 3);
  const lines = [
    `Video for ${gym.name}`,
    `From ${member.firstName || 'me'}${business.name ? `, ${business.name}` : ''}`,
    '',
    'What I noticed',
    ...(report.gaps || []).slice(0, 3).map((g) => `- ${g.title}. ${g.fix}`),
    '',
    'What I would make first',
    ...ideas.map((i) => `- ${i.title}: "${i.hook}"`),
    '',
    'How it works',
    '- I film at the gym on a day that suits you (about 2 hours, no disruption to classes).',
    '- You get the edited Reels within 5 days, ready for Instagram and TikTok.',
    '- One round of changes on every batch. You own everything I make for you.',
    '',
    'Options',
    ...priced.packages.map((p) => `- ${p.name}: $${p.monthly} a month. ${p.includes.join(', ')}.${p.id === rec.id ? ' (My suggestion to start.)' : ''}`),
    '',
    `For context: if the videos bring in one new member who stays about ${priced.stayMonths} months at about $${priced.memberPrice} a month, that member is worth about $${priced.memberValue} to you. The ${rec.name} plan ${rec.payback || 'is priced to be easy to say yes to'}. That is math, not a promise of sign-ups.`,
    '',
    'Month to month. Cancel any time with 30 days notice.',
    '',
    'Next step: pick a shoot day.',
  ];
  return plain(lines.join('\n'));
}

module.exports = { price, proposal, DEFAULT_PRICE, PACKAGES };
