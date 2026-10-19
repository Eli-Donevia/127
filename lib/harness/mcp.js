// The harness on the member's AI link (lib/hq-harness.js): Claude or ChatGPT can find a workflow, start
// it, follow the run, answer its approvals and work the Pipeline. Shown only while HQ v2 is on for the
// member (HARNESS_V2). An approval that unlocks an `act` step (anything that does something outside
// HQ) can only be answered in HQ itself, so text a model read on the web can't approve it.

const engine = require('./engine');
const packs = require('./packs');
const inbox = require('./inbox');
const pipeline = require('./pipeline');
const places = require('./places');
// A Google business has no stored name (Legal L53): the member's AI gets its Google Maps link instead.
const who = (l) => l.name || (l.placeId ? `a business on Google Maps (${places.mapsLink(l.placeId)})` : l.key);
const ledger = require('./ledger');
const blocks = require('./blocks');
const { clip, scrubKeys } = require('./text');

const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const ro = { readOnlyHint: true, openWorldHint: false };

const TOOLS = [
  {
    name: 'list_workflows',
    title: 'List 127 workflows',
    description: "The workflows the member can run in 127 HQ (each one does a whole job: finds leads, writes the outreach, makes the spec video, plans the launch). With a query, the best matches first. Each shows its id, what it delivers, the member's minutes and about how many credits it uses.",
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'What the member wants done, in a few words.' } } },
    annotations: ro,
  },
  {
    name: 'start_workflow',
    title: 'Start a 127 workflow',
    description: 'Start a workflow for the member. Tell them what it will do and about how many credits it uses, and get their yes first. Runs in the background; follow it with get_run. Nothing is sent or posted without the member approving it.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: { type: 'string', description: 'The workflow id from list_workflows, like "gym.first_clients".' },
        inputs: { type: 'object', description: "The workflow's form, as field to value. list_workflows shows the fields." },
      },
      required: ['workflow'],
    },
    annotations: { ...write, openWorldHint: true },
  },
  {
    name: 'get_run',
    title: 'Check a 127 run',
    description: "A run's progress, what it's waiting on, and its results. Without a run id, the member's recent runs.",
    inputSchema: { type: 'object', properties: { run: { type: 'string', description: 'The run id from start_workflow or the list.' } } },
    annotations: ro,
  },
  {
    name: 'list_inbox',
    title: "What's waiting on the member",
    description: "Approvals waiting in the member's 127 Inbox: picks to make and drafts to read, with each option's key.",
    inputSchema: { type: 'object', properties: {} },
    annotations: ro,
  },
  {
    name: 'answer_inbox',
    title: 'Answer an approval',
    description: "Answer an approval for the member, only with their explicit say-so: pick options by key, edit draft text, or skip. Approvals that let 127 do something outside HQ can only be answered in HQ.",
    inputSchema: {
      type: 'object',
      properties: {
        run: { type: 'string' },
        step: { type: 'string' },
        approved: { type: 'boolean', description: 'false skips it.' },
        chosen: { type: 'array', items: { type: 'string' }, description: 'Option keys to pick.' },
        edits: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, text: { type: 'string' } }, required: ['key', 'text'] }, description: 'New text for drafts, by key.' },
      },
      required: ['run', 'step', 'approved'],
    },
    annotations: write,
  },
  {
    name: 'get_pipeline',
    title: "The member's pipeline",
    description: 'The people and businesses the member is working on, by stage: found, contacted, replied, call, won, lost.',
    inputSchema: { type: 'object', properties: { stage: { type: 'string', enum: pipeline.STAGES } } },
    annotations: ro,
  },
  {
    name: 'move_lead',
    title: 'Move a lead',
    description: "Move a lead to a new stage when the member says what happened (\"I messaged Iron Gym\", \"they booked a call\"). Confirm which lead first if more than one could match.",
    inputSchema: {
      type: 'object',
      properties: { lead: { type: 'string', description: 'The lead id from get_pipeline.' }, stage: { type: 'string', enum: pipeline.STAGES }, note: { type: 'string' } },
      required: ['lead', 'stage'],
    },
    annotations: write,
  },
];

const NAMES = new Set(TOOLS.map((t) => t.name));
const text = (s, isError) => ({ content: [{ type: 'text', text: s }], ...(isError ? { isError: true } : {}) });

function fields(wf) {
  const props = (wf.inputs && wf.inputs.properties) || {};
  const req = new Set((wf.inputs && wf.inputs.required) || []);
  const file = (p) => p.format === 'asset' || (p.items && p.items.format === 'asset');
  const list = Object.entries(props).map(([k, p]) => `${k}${req.has(k) ? '' : ' (optional)'}${p.enum ? ` one of: ${p.enum.join(' | ')}` : ''}${file(p) ? ' (a file the member added to their 127 Library; they pick it in HQ)' : ''}${p.options === 'pipeline' ? " (a business in the member's Pipeline, by name)" : ''}${p.title ? `: ${p.title}` : ''}`);
  return list.length ? list.join('; ') : 'none';
}

const STOP = new Set('a an and are as at be by for from get i in is it me my of on or so that the this to we with you your'.split(' '));
const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

function listWorkflows(user, query) {
  const tier = ledger.tierOf(user);
  // Hidden workflows (HQ's own queue tools) run from Do my day, not from a list.
  let list = packs.workflows({ tier }).filter((wf) => !wf.hidden);
  const want = words(query);
  if (want.length) {
    const score = (wf) => {
      const hay = new Set(words(`${wf.title} ${wf.promise} ${(packs.pack(wf.pack) || {}).title || ''} ${((packs.pack(wf.pack) || {}).niches || []).join(' ')}`));
      return want.reduce((n, w) => n + (hay.has(w) ? 1 : 0), 0);
    };
    list = list.map((wf) => [wf, score(wf)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([wf]) => wf).slice(0, 10);
    if (!list.length) return `No workflow matches "${clip(query, 60)}". Call list_workflows with no query to see the list.`;
  } else {
    // Start's order for this member: their own business first, another business's workflows last.
    const rank = new Map(require('./index').catalog(user).map((c, i) => [c.id, i]));
    list.sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e9) - (rank.has(b.id) ? rank.get(b.id) : 1e9));
  }
  const u = ledger.usage(user);
  const shown = list.slice(0, 60);
  const lines = shown.map((wf) => `- ${wf.id}: ${wf.title}. ${wf.promise} About ${wf.minutes} min of the member's time, about ${engine.estimate(wf, {})} credits.${wf.locked ? ` Needs ${wf.tier === 'circle' ? "the Founder's Circle" : 'Builder'}.` : ''} Fields: ${fields(wf)}.`);
  if (list.length > shown.length) lines.push(`And ${list.length - shown.length} more: call list_workflows with a few words of what the member wants done to find them.`);
  return [`The member has ${u.left} of ${u.allowance} credits left this month.`, ...lines].join('\n');
}

function runText(v, base) {
  const out = [`${v.title} (run ${v.id}): ${v.status}${v.sample ? ', with sample data' : ''}.`];
  for (const s of v.steps) {
    const p = s.progress && s.progress.total ? ` ${s.progress.done} of ${s.progress.total}` : '';
    out.push(`- ${s.title}: ${s.status}${p}${s.error ? `. ${s.error}` : ''}`);
  }
  if (v.waitingOn && v.waitingOn.ask) out.push('', askText(v.id, v.waitingOn));
  if (v.wakeAt && v.status === 'sleeping') out.push(`Picks up on its own at ${v.wakeAt}.`);
  if (v.result.length) out.push('', 'Results:', blocks.toText(v.result, { base }));
  out.push('', `In HQ: ${base}/app/hq/runs/${v.id}`);
  return out.join('\n');
}

function askText(runId, step) {
  const a = step.ask;
  const out = [`Waiting on the member: ${a.title} (run ${runId}, step ${step.id}).${a.note ? ` ${a.note}` : ''}`];
  if (a.options) out.push(`Options${a.max ? ` (pick up to ${a.max})` : ''}:`, ...a.options.map((o) => `  [${o.key}] ${o.label}${o.detail ? `: ${o.detail}` : ''}`));
  if (a.items) out.push(`Drafts${a.edit === 'text' ? ' (text can be edited)' : ''}:`, ...a.items.map((o) => `  [${o.key}] ${o.label}:\n${String(o.text).replace(/^/gm, '    ')}`));
  return out.join('\n');
}

// Does answering this approval let an act step run?
function gatesAct(run, stepId) {
  const wf = packs.workflow(run.workflowId);
  return !!wf && wf.steps.some((s) => s.approvedBy === stepId && packs.tool(s.tool) && packs.tool(s.tool).risk === 'act');
}

async function call(user, name, args = {}, { base = '' } = {}) {
  if (!NAMES.has(name)) return null;
  const a = args && typeof args === 'object' ? args : {};
  try {
    switch (name) {
      case 'list_workflows':
        return text(listWorkflows(user, a.query));
      case 'start_workflow': {
        const run = await engine.start(user, String(a.workflow || ''), a.inputs && typeof a.inputs === 'object' ? a.inputs : {}, { source: 'ai' });
        return text(`Started ${run.title} (run ${run.id}${run.freeRun ? ', on us' : `, about ${run.credits.estimate} credits`}). It runs in the background: check it with get_run. In HQ: ${base}/app/hq/runs/${run.id}`);
      }
      case 'get_run': {
        if (!a.run) {
          const runs = engine.list(user, { limit: 10 });
          if (!runs.length) return text('No runs yet. Use list_workflows to find one.');
          return text(runs.map((r) => `- ${r.id}: ${r.title}, ${r.status}, started ${String(r.createdAt).slice(0, 16).replace('T', ' ')} UTC`).join('\n'));
        }
        const run = engine.get(user, String(a.run));
        if (!run) return text("That run doesn't exist.", true);
        return text(runText(engine.view(run), base));
      }
      case 'list_inbox': {
        const open = inbox.list(user.id, { status: 'open', limit: 20 });
        if (!open.length) return text('Nothing is waiting on the member.');
        const parts = [];
        for (const item of open) {
          const run = engine.get(user, item.runId);
          if (!run) continue;
          const step = engine.view(run).steps.find((s) => s.id === item.stepId);
          if (step && step.ask) parts.push(`${item.workflow}\n${askText(run.id, step)}${gatesAct(run, step.id) ? '\nThis one can only be answered in HQ.' : ''}`);
        }
        return text(parts.join('\n\n') || 'Nothing is waiting on the member.');
      }
      case 'answer_inbox': {
        const run = engine.get(user, String(a.run || ''));
        if (!run) return text("That run doesn't exist.", true);
        if (gatesAct(run, String(a.step || ''))) return text(`This approval lets 127 act outside HQ, so the member answers it in HQ: ${base}/app/hq/runs/${run.id}`, true);
        const items = {};
        for (const e of Array.isArray(a.edits) ? a.edits : []) if (e && e.key !== undefined && typeof e.text === 'string') items[String(e.key)] = e.text;
        const next = await engine.answer(user, run.id, String(a.step), { approved: a.approved !== false, chosen: Array.isArray(a.chosen) ? a.chosen.map(String) : [], items });
        return text(`Answered. The run is ${next.status}.`);
      }
      case 'get_pipeline': {
        const leads = pipeline.list(user.id, { stage: pipeline.STAGES.includes(a.stage) ? a.stage : undefined, limit: 100 });
        if (!leads.length) return text(a.stage ? `No leads at ${pipeline.LABELS[a.stage]}.` : 'The pipeline is empty. Workflows that find leads fill it.');
        const c = pipeline.counts(user.id);
        const head = pipeline.STAGES.map((s) => `${pipeline.LABELS[s]} ${c[s] || 0}`).join(', ');
        return text([head, ...leads.map((l) => `- ${l.id}: ${who(l)}${l.company ? ` (${l.company})` : ''}, ${pipeline.LABELS[l.stage]}${l.note ? `. ${clip(l.note, 140)}` : ''}`)].join('\n'));
      }
      case 'move_lead': {
        const lead = await pipeline.move(user.id, String(a.lead || ''), String(a.stage || ''));
        if (!lead) return text("That lead doesn't exist.", true);
        if (a.note) await pipeline.note(user.id, lead.id, String(a.note));
        return text(`${who(lead)} is now at ${pipeline.LABELS[lead.stage]}.`);
      }
      default:
        return null;
    }
  } catch (err) {
    return text(scrubKeys((err && err.message) || 'That did not work.'), true);
  }
}

const INSTRUCTIONS = `127 HQ also runs workflows that do whole jobs for the member (find and rank leads, write outreach, make spec videos, plan launches). Use list_workflows to find one, get the member's yes, then start_workflow and follow it with get_run. When a run waits on the member, show them the options and answer with answer_inbox only after they choose. Log what they did with move_lead.`;

module.exports = { TOOLS, call, INSTRUCTIONS, _askText: askText };
