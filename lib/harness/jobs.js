// The jobs a workflow does, and which one is the member's bottleneck right now. Start groups
// workflows by job; Today and the catalog put the bottleneck's workflows first. Hormozi's order for
// a first business: an offer people want, then enough leads (the core four), then closing them,
// and ads only once something already sells.

const JOBS = [
  { id: 'offer', title: 'Build the offer', blurb: 'Validate it, price it and make it hard to say no to.' },
  { id: 'leads', title: 'Reach out', blurb: 'Find and rank who to contact, draft the messages, line them up in your pipeline.' },
  { id: 'content', title: 'Make content', blurb: 'Hooks, scripts, Reels and a week of posts.' },
  { id: 'sales', title: 'Close sales', blurb: 'Calls, proposals, objections and follow-ups.' },
  { id: 'ads', title: 'Run ads', blurb: 'Small, capped tests once something already sells.' },
  { id: 'site', title: 'Build the site or store', blurb: 'Websites, landing pages and Shopify stores.' },
  { id: 'money', title: 'Run the numbers', blurb: 'Forecasts, cash and what to charge.' },
  { id: 'ops', title: 'Get your time back', blurb: 'Automations, systems and handing work off.' },
];
const IDS = new Set(JOBS.map((j) => j.id));

const GUESS = [
  ['ads', /\b(ads?|ad spend|campaigns?|meta ads|google ads|boost)\b/g],
  ['site', /\b(site|website|landing|shopify|store|domain|web page|storefront|theme|brand|logos?)\b/g],
  ['sales', /\b(sales|close|closing|proposal|objections?|follow.?ups?|call prep|quote)\b/g],
  ['content', /\b(content|posts?|reels?|videos?|hooks?|captions?|tiktok|youtube|scripts?|shorts|edit|social)\b/g],
  ['leads', /\b(leads?|prospects?|outreach|clients|customers|dms?|cold|emails?|find|first 25|25 a day|daily 25|pitch|referrals?|reconnect|nudge|reach out|research|reviews?)\b/g],
  ['offer', /\b(offer|pric(e|ing)|validat\w*|idea|niche|guarantee|interview)\b/g],
  ['money', /\b(forecast|cash|revenue|profit|finance|invoice|numbers|budget)\b/g],
  ['ops', /\b(automat\w*|system|hire|delegat\w*|sops?|workflow recommender|tools|stack)\b/g],
];

// A workflow that leaves `job` out gets the job its words name most: words in its id and title
// count twice, words in its promise once, and a tie goes to the job listed first above.
function jobOf(wf) {
  if (wf && IDS.has(wf.job)) return wf.job;
  const clean = (s) => String(s || '').toLowerCase().replace(/[._]/g, ' ');
  const head = clean(`${wf.id} ${wf.title}`);
  const body = clean(wf.promise);
  let best = null;
  for (const [job, re] of GUESS) {
    const n = 2 * (head.match(re) || []).length + (body.match(re) || []).length;
    if (n && (!best || n > best.n)) best = { job, n };
  }
  return best ? best.job : 'ops';
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
