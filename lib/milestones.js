// The progress map from first idea to first revenue (from Eli's intake: he named
// revenue and business creation; the steps between follow his validation method).
// Members check these off themselves; each one is worth XP and a shareable win.
const MILESTONES = [
  { id: 'roadmap', label: 'Roadmap created', xp: 0, auto: true, hint: 'Done when you finish the assessment.' },
  { id: 'idea_test', label: 'Idea passes the Idea Test', xp: 50, resource: 'idea-filter', hint: 'One idea, chosen on purpose, with proof.' },
  { id: 'conversations', label: '10 customer conversations', xp: 75, resource: 'validation-interviews', hint: 'Real people, about how they solve it today.' },
  { id: 'offer', label: 'Offer written', xp: 50, resource: 'offer-builder', hint: 'Your one-page offer, priced.' },
  { id: 'registered', label: 'Business registered', xp: 75, resource: 'launch-checklist', hint: 'Check your local rules for what that means where you live.' },
  { id: 'page_live', label: 'Landing page live', xp: 50, resource: 'landing-page-brief', hint: 'A page where someone can say yes.' },
  { id: 'first_lead', label: 'First lead', xp: 50, resource: 'dm-outreach-scripts', hint: 'Someone raised their hand.' },
  { id: 'first_sale', label: 'First sale', xp: 150, hint: 'Someone paid you. Tell us on the wins board.' },
  { id: 'revenue_1k', label: 'First repeat customer', xp: 200, resource: 'kpi-dashboard', hint: 'Someone who already bought from you buys again.' }, // id kept so saved progress carries over
  { id: 'repeatable', label: 'First repeatable month', xp: 250, resource: 'weekly-ceo-review', hint: 'A month of revenue you could do again.' },
];
module.exports = { MILESTONES };
