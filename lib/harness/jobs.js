// The jobs a workflow does, and which one is the member's bottleneck right now. Start groups
// workflows by job; Today and the catalog put the bottleneck's workflows first. Hormozi's order for
// a first business: an offer people want, then enough leads (the core four), then closing them,
// and ads only once something already sells.

const JOBS = [
  { id: 'offer', title: 'Build the offer', blurb: 'Validate it, price it and make it hard to say no to.' },
  { id: 'leads', title: 'Get leads', blurb: 'Find the people, write the messages, fill the pipeline.' },
  { id: 'content', title: 'Make content', blurb: 'Hooks, scripts, Reels and a week of posts.' },
  { id: 'sales', title: 'Close sales', blurb: 'Calls, proposals, objections and follow-ups.' },
  { id: 'ads', title: 'Run ads', blurb: 'Small, capped tests once something already sells.' },
  { id: 'site', title: 'Build the site or store', blurb: 'Websites, landing pages and Shopify stores.' },
  { id: 'money', title: 'Run the numbers', blurb: 'Forecasts, cash and what to charge.' },
  { id: 'ops', title: 'Get your time back', blurb: 'Automations, systems and handing work off.' },
];
const IDS = new Set(JOBS.map((j) => j.id));

const GUESS = [
  ['ads', /\b(ads?|ad spend|campaigns?|meta ads|google ads|boost)\b/],
  ['site', /\b(site|website|landing|shopify|store|domain|web page|storefront|theme)\b/],
  ['sales', /\b(sales|close|closing|proposal|objections?|follow.?ups?|call prep|quote)\b/],
  ['content', /\b(content|posts?|reels?|videos?|hooks?|captions?|tiktok|youtube|scripts?|shorts|edit)\b/],
  ['leads', /\b(leads?|prospects?|outreach|clients|customers|dms?|cold|emails?|find)\b/],
  ['offer', /\b(offer|pric(e|ing)|validat\w*|idea|niche|guarantee|interview)\b/],
  ['money', /\b(forecast|cash|revenue|profit|finance|invoice|numbers|budget)\b/],
  ['ops', /\b(automat\w*|system|hire|delegat\w*|sops?|workflow recommender)\b/],
];

function jobOf(wf) {
  if (wf && IDS.has(wf.job)) return wf.job;
  const text = `${wf.id} ${wf.title} ${wf.promise}`.toLowerCase().replace(/[._]/g, ' ');
  const hit = GUESS.find(([, re]) => re.test(text));
  return hit ? hit[0] : 'ops';
}

const has = (v, x) => [].concat(v || []).includes(x);

// The member's bottleneck: { job, why }. Uses their pipeline first (it's what they're doing), then
// what they told 127 in onboarding.
function constraint(user, brain, counts = {}) {
  const a = (user && user.answers) || {};
  const b = (brain && brain.business) || {};
  const warmish = (counts.replied || 0) + (counts.call || 0);
  if (warmish && !counts.won) return { job: 'sales', why: `${warmish} ${warmish === 1 ? 'person is' : 'people are'} talking to you and nobody has bought yet, so closing is the bottleneck.` };
  if (has(a.obstacles, 'sales')) return { job: 'sales', why: "You said people look but don't buy, so closing is the bottleneck." };
  if (!b.offer && (has(a.goal, 'pick_idea') || has(a.goal, 'validate') || has(a.obstacles, 'offer') || a.stage === 'exploring' || a.stage === 'validating')) {
    return { job: 'offer', why: 'Nothing sells without an offer people want, so that comes first.' };
  }
  if (counts.won && (has(a.goal, 'revenue') || a.stage === 'growing' || a.stage === 'scaling')) return { job: 'ads', why: 'Something already sells, so paid ads can buy more of it.' };
  if (has(a.goal, 'audience')) return { job: 'content', why: 'You want an audience that buys, so content is the lever.' };
  if (has(a.goal, 'systems') || has(a.obstacles, 'time') || has(a.obstacles, 'tools')) {
    if (counts.won) return { job: 'ops', why: 'You said time is short, so the next win is getting hours back.' };
  }
  return { job: 'leads', why: 'Most first businesses are short on leads. More people hearing the offer fixes most problems.' };
}

module.exports = { JOBS, IDS, jobOf, constraint };
