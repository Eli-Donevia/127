// The AI link's Brain, skills and activity tools (HQ_MCP_BRAIN, BUILD-PLAN W3): the member's own
// Claude (with their own Gmail and Calendar connected inside Claude) becomes their admin, reading
// and writing their 127 Brain. Search and notes need BRAIN_DOCS too; skills need HQ_SKILLS.
// Every call lands in the Activity log as "Your Claude".

const flags = require('./flags');
const docs = require('./docs');
const skills = require('./skills');
const activity = require('./activity');
const { clip } = require('./text');

const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const ro = { readOnlyHint: true, openWorldHint: false };

const TOOLS = [
  {
    name: 'brain_search',
    title: "Search the member's 127 Brain",
    description: "Searches the member's own docs, house rules and decisions in 127 (their offers, FAQs, SOPs, notes). Returns passages with the doc's title and its link in HQ. Use it before answering anything about their business, and cite the doc you used.",
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'What to look for, in a few words.' }, limit: { type: 'integer', minimum: 1, maximum: 10 } }, required: ['query'] },
    annotations: ro,
    needs: ['BRAIN_DOCS'],
  },
  {
    name: 'add_note',
    title: "Add a note to the member's 127 Brain",
    description: 'Saves a note to the member\'s Brain in 127 as a doc (meeting notes, a client fact, a process). Only what the member asked you to save. Never save passwords, card numbers or other people\'s private details.',
    inputSchema: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string', description: 'Markdown is fine. [[Title]] links to another doc.' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['title', 'text'] },
    annotations: write,
    needs: ['BRAIN_DOCS'],
  },
  {
    name: 'log_decision',
    title: 'Log a decision in 127',
    description: "Logs a decision the member made, and why, in their 127 Brain's decisions log. Only after they say it's decided.",
    inputSchema: { type: 'object', properties: { decision: { type: 'string' }, why: { type: 'string' } }, required: ['decision'] },
    annotations: write,
    needs: ['BRAIN_DOCS'],
  },
  {
    name: 'log_number',
    title: 'Log a number in 127',
    description: 'Logs one number the member tracks (calls booked, revenue this week, followers) in their 127 Brain. Their daily and weekly reports read these.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Like "Calls booked".' }, value: { type: 'number' }, note: { type: 'string' } }, required: ['name', 'value'] },
    annotations: write,
    needs: ['BRAIN_DOCS'],
  },
  {
    name: 'list_skills',
    title: "The member's 127 skills",
    description: "Skills are jobs 127 does on a schedule (daily numbers, follow-up sweep, what's working). Shows each one's id, what it does, when it runs and whether it's on.",
    inputSchema: { type: 'object', properties: {} },
    annotations: ro,
    needs: ['HQ_SKILLS'],
  },
  {
    name: 'run_skill',
    title: 'Run a 127 skill now',
    description: 'Runs one skill now and returns the run id; follow it with get_run. Uses its usual credits. Anything it drafts waits for the member in their 127 Inbox.',
    inputSchema: { type: 'object', properties: { skill: { type: 'string', description: 'The skill id from list_skills.' } }, required: ['skill'] },
    annotations: write,
    needs: ['HQ_SKILLS'],
  },
  {
    name: 'activity',
    title: "What's been done in 127",
    description: "The member's 127 Activity log: runs, approvals, Brain changes and connection reads and writes, newest first, with who did each (the member, Ask 127, their AI team, a schedule or you).",
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } } },
    annotations: ro,
    needs: ['HQ_ACTIVITY'],
  },
];

const text = (s, isError) => ({ content: [{ type: 'text', text: s }], ...(isError ? { isError: true } : {}) });

function on(user) {
  return flags.on('HQ_MCP_BRAIN', user);
}

function toolsFor(user) {
  if (!on(user)) return [];
  return TOOLS.filter((t) => t.needs.every((n) => flags.on(n, user))).map(({ needs, ...t }) => t);
}

const NAMES = new Set(TOOLS.map((t) => t.name));
const by = 'Your Claude';

async function call(user, name, args = {}, { base = '' } = {}) {
  if (!NAMES.has(name)) return null;
  if (!toolsFor(user).some((t) => t.name === name)) return null;
  const a = args && typeof args === 'object' ? args : {};
  const log = (action, what, ref) => activity.note(user, { who: by, kind: 'ai_link', action, what, ref });
  try {
    switch (name) {
      case 'brain_search': {
        const hits = docs.search(user.id, String(a.query || ''), { limit: Math.max(1, Math.min(10, Number(a.limit) || 5)) });
        log('searched the Brain', clip(a.query, 80));
        if (!hits.length) return text(`Nothing in the member's Brain matches "${clip(a.query, 80)}".`);
        return text(hits.map((h, i) => `[${i + 1}] ${h.title}${h.heading ? ` > ${h.heading}` : ''} (${base}${h.link})\n${h.text}`).join('\n\n'));
      }
      case 'add_note': {
        const d = await docs.save(user.id, { title: a.title, body: a.text, tags: Array.isArray(a.tags) ? a.tags : [], source: 'note' });
        log('added a note', d.title, `/app/hq/brain/docs/${d.id}`);
        return text(`Saved "${d.title}" to the member's Brain: ${base}/app/hq/brain/docs/${d.id}`);
      }
      case 'log_decision': {
        const e = await docs.logDecision(user.id, { text: a.decision, why: a.why, by });
        log('logged a decision', e.text);
        return text(`Logged: ${e.text}`);
      }
      case 'log_number': {
        const e = await docs.logNumber(user.id, { name: a.name, value: a.value, note: a.note, by });
        log('logged a number', e.name);
        return text(`Logged ${e.name}: ${e.value}.`);
      }
      case 'list_skills': {
        const list = skills.list(user);
        const st = { on: 'on', off: 'off', locked: 'needs Builder', coming: 'coming soon', builtIn: 'always on' };
        return text(list.map((s) => `- ${s.id}: ${s.name}. ${s.what} ${s.label}. ${st[s.status]}${s.status === 'on' || s.status === 'off' ? `, about ${s.credits} credit${s.credits === 1 ? '' : 's'} a run` : ''}.`).join('\n') + `\nTurn skills on or off in HQ: ${base}/app/hq/skills`);
      }
      case 'run_skill': {
        const run = await skills.runNow(user, String(a.skill || ''), { source: 'ai' });
        return text(`Started ${run.title} (run ${run.id}, about ${run.credits.estimate} credit${run.credits.estimate === 1 ? '' : 's'}). Check it with get_run. In HQ: ${base}/app/hq/runs/${run.id}`);
      }
      case 'activity': {
        const rows = activity.list(user.id, { limit: Math.max(1, Math.min(100, Number(a.limit) || 30)) });
        if (!rows.length) return text('Nothing in the Activity log yet.');
        return text(rows.map((r) => `- ${r.at.slice(0, 16).replace('T', ' ')} UTC, ${r.who}: ${r.action}${r.what ? `: ${r.what}` : ''}`).join('\n'));
      }
      default:
        return null;
    }
  } catch (err) {
    return text(clip((err && err.message) || 'That did not work.', 300), true);
  }
}

const INSTRUCTIONS = "The member's 127 Brain holds their own docs, house rules and decisions: search it with brain_search before answering about their business and follow their house rules. Save what they ask with add_note, log_decision and log_number. Their skills run jobs on a schedule (list_skills, run_skill). activity shows what has been done in their name.";

module.exports = { TOOLS, toolsFor, call, on, INSTRUCTIONS };
