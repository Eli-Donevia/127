// "Their playbook and how you beat it": what most competitors do (you need it too), what few do
// (your opening) and 5 exact changes for the member's offer and site. AI plans from the facts read
// off their sites; the code fallback builds the same moves from the patterns. Saves a one-page report.

const { views, ai, save, files, color, brain, text, leads, places } = require('../../_kit');
const { patterns, factsOf } = require('../lib/compete');

const MOVE = {
  offer: ['Lead with a first-visit offer', 'Put one simple first-visit offer at the top of your homepage and in your bio.'],
  prices: ['Show your prices', 'List starting prices for your main services so people know you fit before they ask.'],
  booking: ['Let people book online', 'Add a Book now button that opens your booking page.'],
  proof: ['Show real reviews', 'Put 3 real reviews (with permission) near the top of your homepage.'],
  video: ['Add a short video', 'Put a 15 to 30 second video of a real visit near the top of your homepage.'],
  emailSignup: ['Collect emails', 'Add an email signup with one reason to join, like first access to new openings.'],
  chat: ['Answer questions fast', 'Add a chat button or a short question form that goes to your phone.'],
  ads: ['Get ready for ads', 'Add the free Meta pixel now so you can show ads to past visitors later.'],
  mobile: ['Fix the phone view', 'Make sure your site reads well on a phone, with a tap-to-call button.'],
};

function fallbackMoves(pats, mine) {
  const has = (id) => (mine ? !!mine[id] : false);
  const open = pats.filter((p) => p.of && p.n / p.of < 0.5 && !has(p.id)).map((p) => ({ title: MOVE[p.id][0], why: p.n ? `Only ${p.n} of ${p.of} competitors do this, so it sets you apart.` : `None of the ${p.of} competitors do this, so it sets you apart.`, how: MOVE[p.id][1] }));
  const stakes = pats.filter((p) => p.of && p.n / p.of >= 0.5 && !has(p.id)).map((p) => ({ title: MOVE[p.id][0], why: `${p.n} of ${p.of} competitors already do this, so buyers expect it.`, how: MOVE[p.id][1] }));
  return open.slice(0, 3).concat(stakes).slice(0, 5);
}

const SCHEMA = { type: 'object', properties: { summary: { type: 'string', maxLength: 600 }, moves: { type: 'array', items: { type: 'object', properties: { title: { type: 'string', maxLength: 80 }, why: { type: 'string', maxLength: 240 }, how: { type: 'string', maxLength: 300 } }, required: ['title', 'why', 'how'] } }, offer_line: { type: 'string', maxLength: 200 } }, required: ['summary', 'moves'] };

module.exports = {
  name: 'intel.playbook',
  title: 'Their playbook and yours',
  description: 'Compares competitors from their own sites: what most of them do, what few do, and 5 exact changes for your offer and site. Saves a one-page report.',
  kind: 'ai',
  tasks: ['plan'],
  risk: 'draft',
  needs: [],
  credits: 12,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      competitors: { type: 'array', title: 'Competitors', description: 'Outputs of intel.scan_competitor' },
      mine: { type: 'string', title: 'Your website (optional)' },
      what: { type: 'string', title: 'What you sell (optional, else from your profile)' },
    },
    required: ['competitors'],
  },
  output: { type: 'object', properties: { patterns: { type: 'array' }, moves: { type: 'array' }, summary: { type: 'string' }, report: { type: 'object' }, ai: { type: 'boolean' } }, required: ['patterns', 'moves', 'summary', 'report', 'ai'] },
  async run(input, ctx) {
    const comps = (input.competitors || []).filter((c) => c && c.key && !c.error);
    if (!comps.length) throw new Error('None of the competitor sites could be read.');
    const br = brain.brainOf(ctx, input);
    const mineUrl = input.mine || br.website;
    let mine = null;
    if (mineUrl) {
      const scan = await leads.scanFor(ctx, mineUrl);
      if (scan && scan.reachable) {
        const f = factsOf({ website: mineUrl }, scan, null);
        mine = { name: f.name, offer: !!f.offer, prices: f.prices.length > 0, booking: f.booking.length > 0, proof: !!f.proof, video: f.video, emailSignup: f.emailSignup, chat: f.chat, ads: f.ads, mobile: f.mobile };
      }
    }
    const pats = patterns(comps);
    const read = pats[0] ? pats[0].of : 0;
    const base = fallbackMoves(pats, mine);
    const facts = comps.map((c) => ({ name: c.name, offer: c.offer, prices: c.prices.slice(0, 4).map((p) => `$${p.amount}${p.per ? ` per ${p.per}` : ''}`), booking: c.booking, proof: c.proof, video: c.video, emailSignup: c.emailSignup, ads: c.ads, store: c.shop && c.shop.products ? `${c.shop.products}${c.shop.capped ? '+' : ''} products, median $${c.shop.median}` : null }));
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'plan',
      system: 'You compare local competitors for a new business owner, using only the facts given. Plain text.',
      prompt: `The member sells: ${br.what || input.what || 'a local service'}${br.place ? ` in ${br.place}` : ''}.\nCompetitor facts read from their own websites (JSON):\n${JSON.stringify(facts)}\nThe member's own site: ${mine ? JSON.stringify(mine) : 'unknown'}.\nPatterns: ${pats.map((p) => `${p.label}: ${p.n} of ${p.of}`).join('; ')}.\nWrite a 2 to 3 sentence summary of how these competitors sell, then exactly 5 moves for the member (title, why it matters here, how to do it this week). Use only these facts; no invented numbers, no results promised, no income talk. Optionally one offer_line the member could put on their homepage.`,
      schema: SCHEMA,
      maxTokens: 1400,
      accept: ai.cleanCopy,
      fallback: () => {
        const most = pats.filter((p) => p.of && p.n / p.of >= 0.5).map((p) => p.label.toLowerCase());
        const few = pats.filter((p) => p.of && p.n / p.of < 0.5).map((p) => p.label.toLowerCase());
        const summary = `We read ${read} competitor ${read === 1 ? 'site' : 'sites'}. ${most.length ? `Most of them have: ${text.list(most.slice(0, 4))}. Buyers will expect these from you too.` : 'No feature is common to most of them.'} ${few.length ? `Few of them have: ${text.list(few.slice(0, 4))}. That is your opening.` : ''}`;
        return { summary: text.plain(summary), moves: base, offer_line: '' };
      },
    });
    const moves = (data.moves || []).slice(0, 5);
    const p = color.palette('clean');
    const yes = (b) => (b ? 'Yes' : 'No');
    const head = ['Competitor', ...pats.map((x) => x.label)];
    const rows = comps.map((c) => [c.name, ...pats.map((x) => yes(require('../lib/compete').FEATURES.find((f) => f[0] === x.id)[2](c)))]);
    if (mine) rows.push([`You (${mine.name})`, ...pats.map((x) => yes(mine[x.id]))]);
    const css = `@page{size:Letter landscape;margin:12mm}body{margin:0;background:${p.paper};color:${p.ink};font:15px/1.5 Inter,Arial,sans-serif;overflow-wrap:anywhere}.wrap{max-width:1000px;margin:0 auto;padding:24px 18px}.band{background:${p.primary};color:${p.onPrimary};border-radius:16px;padding:24px}h1{margin:0 0 6px;font-size:30px}h2{margin:26px 0 10px}.card{background:#fff;border:1px solid ${p.line};border-radius:12px;padding:14px 16px;margin:0 0 10px}table{border-collapse:collapse;width:100%;font-size:13px;background:#fff}th{overflow-wrap:normal}td,th{border-bottom:1px solid ${p.line};padding:7px 6px;text-align:left;vertical-align:top}.scroll{overflow-x:auto}footer{font-size:12px;color:${p.muted};margin-top:20px}`;
    const body = `<div class="wrap"><div class="band"><h1>Their playbook and how you beat it</h1><div>${files.esc(data.summary)}</div></div><h2>Your 5 moves</h2>${moves.map((m, i) => `<div class="card"><strong>${i + 1}. ${files.esc(m.title)}</strong><div>${files.esc(m.why)}</div><div><em>How:</em> ${files.esc(m.how)}</div></div>`).join('')}${data.offer_line ? `<div class="card"><strong>A line for your homepage:</strong> ${files.esc(data.offer_line)}</div>` : ''}<h2>Side by side</h2><div class="scroll"><table><tr>${head.map((h) => `<th>${files.esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${files.esc(c)}</td>`).join('')}</tr>`).join('')}</table></div><footer>Read from each business's own public website. Things change, so check before you act.${comps.some((c) => c.sample) ? ' Sample competitors: made up to show how it works.' : ''}${places.creditHtml(comps)}</footer></div>`;
    const report = await save.saveFile(ctx, save.fileName('competitor playbook', '.html'), files.htmlDoc({ title: 'Their playbook and how you beat it', css, body }));
    return { patterns: pats, moves, summary: text.plain(data.summary), offer_line: data.offer_line || '', mine, report, ai: usedAi, sample: comps.some((c) => c.sample) };
  },
  view(out) {
    return views.blocks(
      views.text(out.summary),
      views.cards(out.moves.map((m, i) => ({ title: `${i + 1}. ${m.title}`, subtitle: m.why, body: m.how }))),
      views.table([{ key: 'label', label: 'What they do' }, { key: 'count', label: 'How many' }], out.patterns.map((p) => ({ label: p.label, count: `${p.n} of ${p.of}` })), 10),
      views.file(out.report, 'Their playbook and how you beat it (one page)')
    );
  },
};
