// The workspace offer (conversion/offer.md section 1A, W10): 127 HQ sold as the core of Builder, with what comes with it
// as named rows, for /pricing and the plan cards. Every count and row is built from the product on the day, the way the
// Builder map is (Legal 05 rule 6): a workflow counts only when every service its tools need or want is on, so a page
// never sells a sample, and a row shows only while what it names is on for members.
//
// HQ_OFFER=on turns it on, and only while HQ v2 is on for every member (HARNESS_V2=on with the Terms and Privacy pages
// live) and its AI answers for real. Until then the pages sell the roadmap (offer.md sections 1 to 3), and an admin can
// see this version on /pricing?preview=hq. Prices never change here (lib/plans.js, lib/launch.js).
// Legal L62: no line says a plan gets members clients, customers or leads, and no line names a workflow that finds them.
// HQ's own switches (lib/harness/flags.js) add rows only when set to "on", for every member; "admins" sells nothing.

const harness = require('./harness');
const llm = require('./harness/llm');
const connectors = require('./harness/connectors');
const flags = require('./harness/flags');
const skills = require('./harness/skills');
const prompts = require('./harness/prompts');
const hq = require('./hq');
const templates = require('./templates');
const { resources } = require('../content/resources.json');
const { PLANS } = require('./plans');

const on = (k) => /^(on|true)$/i.test(String(process.env[k] || ''));
// On for every member: live() already needs the Terms and Privacy pages live, which flags.on() asks for too.
const forAll = (name) => flags.value(name) === 'on';
const fmt = (n) => Number(n).toLocaleString('en-US');
// "a, b, c or d" and "a, b, c and d"
const join = (word) => (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${word} ${xs[xs.length - 1]}`);
const orList = join('or');
const andList = join('and');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The jobs the workflows row names, each only while its workflow runs for real. None of them finds anyone (L62).
const EXAMPLES = [
  ['offer.price_it', 'pricing your offer'],
  ['content.plan_week', 'planning a week of posts'],
  ['email.welcome', 'writing your welcome emails'],
  ['sales.send_quote', 'sending a quote'],
];
// The skills the Skills row names (lib/harness/skills.js CATALOG), each only while its workflow runs for real. HQ's own
// hidden workflows count here, since they run only as skills. Never the Monday card (the week's sends) or the follow-up
// sweep: both are about reaching people, which L62 keeps off paid copy.
const SKILLS = [
  ['daily_numbers', 'your numbers every morning'],
  ['weekly_working', "what's working every Friday"],
  ['content_week', "next week's posts every Sunday"],
];
// Legal's risk-reversal line (L76), next to "14 days to change your mind". It's true because everything a member makes
// lands in their HQ Library and Brain, which survive a downgrade (Legal B7, Terms 13C), so it shows only with Brain docs
// on for every member. Never "download": 127's own catalog items lock again when a plan ends. Eli turns HQ_OFFER_KEEP
// on together with HQ_OFFER.
const KEEP = 'Anything you make is yours to keep, even if you cancel.';
// Studio is the video pack's videos. A video with sample voice or stock footage isn't one to sell, so each counts only
// once its services are on (render on the server; Deepgram, ElevenLabs and Pexels once Legal clears them, needs.js).
const VIDEO = [
  ['video.caption', 'caption a video'],
  ['video.long_to_clips', 'cut a long video into clips'],
  ['video.promo', 'make a promo video for your offer'],
  ['video.faceless_short', 'turn your points into a short video'],
];

// Runs for real today: every service its tools need (else the run is a sample) and want (else part of it is labeled
// samples) is on. Hidden workflows are HQ's own steps and never count.
function runsForReal(wf) {
  const names = [...(wf.needs || []), ...(wf.wants || [])];
  for (const s of wf.steps || []) {
    const t = s.tool && harness.packs.tool(s.tool);
    if (t) names.push(...(t.needs || []), ...(t.wants || []));
  }
  return names.every((n) => harness.needs.available(n));
}

const hqForMembers = () => process.env.HQ_LIVE === 'true';
// Connections, by the gallery's own rules (lib/harness/connectors, W1): an app counts once its gallery is on for members
// and the gallery would let any member connect it (Legal has cleared it, it doesn't wait, its CONNECTOR_<ID> switch is
// on) and, for "Sign in with", 127's app with that provider exists. HQ's own Stripe and Shopify sales (Legal L48) count
// while HQ is on for members with HQ_SECRET set. All of it lives on HQ's connections page, Builder and up (lib/hq.js).
const MEMBER = { email: '' }; // any signed-in member who isn't an admin
function connections() {
  if (!hqForMembers() || !hq.secretReady()) return { apps: 0, hqSales: false };
  const apps = connectors.mode() !== 'on' ? 0 : connectors.catalog.APPS.filter((a) => (a.auth === 'key' || a.auth === 'oauth') && connectors.allowed(MEMBER, a.id) && (a.auth !== 'oauth' || connectors.oauth.ready(a.provider))).length;
  return { apps, hqSales: true };
}
// The AI link: HQ inside the member's Claude or ChatGPT (lib/hq-harness.js and lib/harness/mcp.js), Builder and up.
const aiLink = () => hqForMembers() && process.env.HQ_HARNESS === 'true' && hq.secretReady();

function counts() {
  const all = [...harness.packs.registry.workflows.values()].filter((wf) => !wf.hidden && runsForReal(wf));
  const free = all.filter((wf) => wf.tier === 'free');
  const types = new Set(all.map((wf) => wf.pack).filter((id) => (harness.packs.pack(id) || {}).business === true));
  const repeat = (list) => (String(process.env.HARNESS_REPEATS || '').toLowerCase() === 'off' ? 0 : list.filter((wf) => wf.suggestSchedule).length);
  const ok = new Set(all.map((wf) => wf.id));
  const conn = connections();
  const sk = !forAll('HQ_SKILLS') ? [] : SKILLS.map(([id, w]) => {
    const s = skills.get(id);
    const wf = s && skills.workflowOf(s);
    return wf && runsForReal(wf) ? { name: s.name, w, tier: wf.tier } : null;
  }).filter(Boolean);
  const lib = forAll('HQ_PROMPTS') ? prompts.load().prompts : [];
  return {
    workflows: all.length,
    free: free.length,
    types: types.size,
    repeats: repeat(all),
    freeRepeats: repeat(free),
    templates: templates.list.length,
    freeTemplates: templates.list.filter((t) => t.tier === 'free').length,
    playbooks: resources.length,
    credits: harness.ledger.allowances(),
    freeRun: process.env.HARNESS_FREE_RUN !== 'off',
    examples: EXAMPLES.filter(([id]) => ok.has(id)).map(([, w]) => w),
    newsletter: ok.has('email.newsletter'),
    video: VIDEO.filter(([id]) => ok.has(id)).map(([, w]) => w),
    connectors: conn.apps,
    hqSales: conn.hqSales,
    aiLink: aiLink(),
    skills: sk.map((x) => x.w),
    freeSkills: sk.filter((x) => x.tier === 'free').map((x) => x.name),
    prompts: lib.length,
    freePrompts: lib.filter((p) => !p.tier || p.tier === 'free').length,
    agent: forAll('HQ_AGENT'),
    brainDocs: forAll('BRAIN_DOCS'),
    activity: forAll('HQ_ACTIVITY'),
    mcpBrain: forAll('HQ_MCP_BRAIN'),
  };
}

// On for members: the flag, HQ v2 on for everyone, real AI answers, and something to sell.
function live(n = counts()) {
  return on('HQ_OFFER') && harness.mode() === 'on' && llm.live() && n.workflows > 0;
}

// What 127 is, in one line (offer.md 1A). "Your accounts connected" only while a connection is on for members.
function line(n = counts()) {
  return n.connectors || n.hqSales
    ? 'Your business HQ: real tools, your accounts connected, every template, and AI that does the work with your OK.'
    : 'Your business HQ: real tools, every template, and AI that does the work with your OK.';
}

// The count line, in offer.md 1A's words (its "only these numbers" rule).
function countLine(n = counts()) {
  const lib = n.prompts ? ` ${n.prompts} prompts.` : '';
  return `${fmt(n.workflows)} workflows. ${fmt(n.templates)} templates.${lib} ${n.playbooks} playbooks. ${fmt(n.credits.builder)} credits a month. All 4 weeks of your roadmap.`;
}

// Builder as a stack: each row is one thing members say stops them, and the part of Builder for it.
// group: 'core' (HQ itself) or 'more' (what comes with it). free: what the free plan has of it, true for all of it, or null.
function stack(n = counts()) {
  const rows = [];
  const add = (id, group, name, says, does, free = null) => rows.push({ id, group, name, says, does, free });
  if (n.types) add('path', 'core', 'Your path', "I don't know where to start.", `Tell HQ what you're building, one of ${n.types} kinds of business so far, and it lays out your steps and works through them with you.`, true);
  const like = n.examples.length ? `, like ${orList(n.examples)}` : '';
  add('workflows', 'core', 'Workflows', "I don't have time to do it all.", `${fmt(n.workflows)} workflows that each finish a whole job on your business${like}. Each one shows its credits and the minutes of yours it needs before it starts.`, n.freeRun ? `${n.free}, plus any Builder workflow free, once` : `${n.free}`);
  const docs = n.brainDocs ? ' Add your own docs and house rules, and every workflow uses them too.' : '';
  add('brain', 'core', 'Your Brain', 'I keep explaining my business to AI.', `HQ remembers your business: your answers, your numbers and your settings. Every workflow starts from it, never from a blank page.${docs}`, true);
  if (n.agent) add('ask', 'core', 'Ask 127', 'I need help right now.', 'Ask about your business and HQ answers from your Brain, then lines up the workflow or the next step for your OK.', true);
  // The Activity log's own words (Legal L76, part 5). Site chat (HQ_SITE_AGENT) isn't built, so nothing here names it.
  const log = n.activity ? ' Your Activity log shows what you approved and what HQ did.' : '';
  add('ok', 'core', 'Your OK on everything', "I don't want AI sending things for me.", `Nothing is sent, posted or changed in your accounts until you say OK, and everything waiting on you sits in one inbox.${log}`, true);
  add('credits', 'core', `${fmt(n.credits.builder)} credits a month`, 'Will I get a surprise bill?', 'Each run shows its credits before it starts. Sample runs and runs that fail cost nothing, and running out never adds a charge: your credits come back on the 1st.', `${fmt(n.credits.free)} a month`);
  if (n.templates) add('templates', 'more', 'Every template', 'I need a template for this.', `${n.templates} sheets, docs, checklists and automation recipes so far, in the formats you already use, like Word, Excel, Google Sheets, Notion and PDF.`, `${n.freeTemplates}, plus what weeks 1 and 2 use`);
  if (n.prompts) add('prompts', 'more', 'Prompts', "I never know what to ask AI.", `${n.prompts} prompts, from picking your idea to knowing your numbers, each a short form. Fill in the blanks and use it in any AI${n.agent ? ', or send it to Ask 127' : ''}.`, n.freePrompts ? `${n.freePrompts} of them` : null);
  // Skills replace repeats once they're on (W3). Never a weekly list here: most pack repeats are "Your next 25" every
  // Monday, which waits for the lawyer on a paid plan (L62).
  if (n.skills.length) add('skills', 'more', 'Skills', 'I forget the things I do every week.', `Jobs HQ does on a schedule, like ${andList(n.skills)}. Turn on the ones you want, and anything one drafts waits for your OK.${n.aiLink && n.mcpBrain ? ' Add any skill to your own Claude too.' : ''}`, n.freeSkills.length ? andList(n.freeSkills) : null);
  else if (n.repeats && !forAll('HQ_SKILLS')) add('repeats', 'more', 'Repeats', 'I forget the things I do every month.', `Set a workflow to run again on its own${n.newsletter ? ', like your newsletter on the 1st of each month' : ''}. Keep up to ${harness.schedules.MAX} going, and each run still waits for your OK before anything goes out.`, n.freeRepeats ? true : null);
  if (n.video.length) add('studio', 'more', 'Studio', "I can't make video.", `${cap(orList(n.video))}, right in HQ.`, null);
  if (n.connectors) add('connections', 'more', 'Connections', "I'm buried in tools.", `Connect the apps you already use, ${n.connectors} so far. HQ reads what a job needs, and anything it would change waits for your OK.`, null);
  else if (n.hqSales) add('connections', 'more', 'Connections', "I'm buried in tools.", 'Connect Stripe or Shopify and your sales count themselves each week.', null);
  if (n.aiLink) {
    if (n.mcpBrain) add('ailink', 'more', 'Make Claude your admin', 'I already live in ChatGPT or Claude.', 'Add HQ to your own Claude or ChatGPT. It can search your Brain, log a number or a decision and start a workflow, and anything that sends still waits for your OK in HQ.', null);
    else add('ailink', 'more', 'Your AI link', 'I already live in ChatGPT or Claude.', 'Use HQ from Claude or ChatGPT: find a workflow, start it and follow it from the chat you already use.', null);
  }
  add('roadmap', 'more', 'Your roadmap and playbooks', 'What do I do this week?', `All 4 weeks of your roadmap, all ${n.playbooks} playbooks, worksheets and tools, and Eli's Playbook with about ${PLANS.builder.aiRunsPerMonth} messages a month.`, 'Weeks 1 and 2, with their playbooks');
  return rows;
}

// The plan cards' lines and items while the offer is on (views/partials/plans.ejs keeps prices, flags and buttons).
function cards(n = counts()) {
  const circle = PLANS.circle.features.slice(1);
  return {
    free: {
      line: 'Try HQ on your own business first.',
      items: [
        n.freeRun ? `${n.free} workflows, plus any Builder workflow free, once` : `${n.free} workflows`,
        `${fmt(n.credits.free)} credits a month`,
        'Weeks 1 and 2 of your roadmap, with the playbooks and templates they use',
        `${PLANS.free.aiRunsPerMonth} Eli's Playbook messages a month`,
        'Progress, milestones and the wins board',
      ],
    },
    builder: {
      flag: 'The full HQ',
      line: 'Your business HQ: every workflow, every template, and AI that does the work with your OK.',
      items: [
        `All ${fmt(n.workflows)} workflows, with ${fmt(n.credits.builder)} credits a month`,
        n.prompts ? `Every template, ${n.templates} so far, and all ${n.prompts} prompts` : `Every template, ${n.templates} so far`,
        n.agent ? 'Your Brain and Ask 127: every answer and workflow starts from your business' : 'Your Brain: every workflow starts from your business',
        ...(n.aiLink ? ['Your AI link: HQ inside Claude or ChatGPT'] : []),
        `All 4 weeks of your roadmap and all ${n.playbooks} playbooks`,
        `Eli's Playbook, about ${PLANS.builder.aiRunsPerMonth} messages a month`,
      ],
    },
    circle: {
      items: [`Everything in Builder, with ${fmt(n.credits.circle)} credits and about ${PLANS.circle.aiRunsPerMonth} Eli's Playbook messages a month`, ...circle],
    },
  };
}

// Rows for the top of the compare table: [what, Free, Builder, Founder's Circle].
function compare(n = counts()) {
  const rows = [
    ['HQ workflows that run on your business', n.freeRun ? `${n.free}, plus any Builder workflow free, once` : `${n.free}`, `All ${fmt(n.workflows)}`, `All ${fmt(n.workflows)}`],
    ['Credits a month', fmt(n.credits.free), fmt(n.credits.builder), fmt(n.credits.circle)],
    ['Templates', `${n.freeTemplates}, plus what weeks 1 and 2 use`, `All ${n.templates}`, `All ${n.templates}`],
    [cap(andList(['your Brain', ...(n.agent ? ['Ask 127'] : []), 'the approvals inbox', ...(n.activity ? ['the Activity log'] : [])])), '✓', '✓', '✓'],
  ];
  if (n.prompts) rows.push(['Prompts', `${n.freePrompts}`, `All ${n.prompts}`, `All ${n.prompts}`]);
  if (n.skills.length) rows.push(['Skills on a schedule', n.freeSkills.length ? andList(n.freeSkills) : '–', '✓', '✓']);
  else if (n.repeats && !forAll('HQ_SKILLS')) rows.push([`Repeats on a schedule (up to ${harness.schedules.MAX})`, n.freeRepeats ? '✓' : '–', '✓', '✓']);
  if (n.aiLink) rows.push(['Your AI link (Claude or ChatGPT)', '–', '✓', '✓']);
  if (n.hqSales && !n.connectors) rows.push(['Stripe and Shopify sales, counted for you', '–', '✓', '✓']);
  return rows;
}

// Everything /pricing needs. preview: an admin looking before it's on for members (/pricing?preview=hq).
// Off (the default) costs nothing, so every page can ask: server.js puts it on res.locals for the plan cards.
function forPage({ preview = false } = {}) {
  if (!preview && !on('HQ_OFFER')) return { show: false, live: false };
  const n = counts();
  const isLive = live(n);
  const show = isLive || (preview && n.workflows > 0);
  if (!show) return { show: false, live: false };
  return { show, live: isLive, preview: !isLive, line: line(n), count: countLine(n), stack: stack(n), cards: cards(n), compare: compare(n), keep: on('HQ_OFFER_KEEP') && n.brainDocs ? KEEP : '', n };
}

module.exports = { forPage, live, counts, line, countLine, stack, cards, compare, runsForReal, EXAMPLES, VIDEO, SKILLS, KEEP };
