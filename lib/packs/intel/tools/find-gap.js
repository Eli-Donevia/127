// "Find the gap": what 5 to 10 competitors say on their own websites, side by side: what most of them
// say (buyers expect it), what only one or two say, and what none of them mention, which is where a
// business can stand out. AI picks the 3 open lanes that fit best and writes why, a line to use and
// how to check it; the template fallback picks by weight. "None of them" always means none of the
// websites we read: the report says so, and every lane says to check before claiming to be the only one.

const { views, ai, save, files, text, time, places, leads } = require('../../_kit');
const { tally, CLAIMS, FEATURE_CLAIMS, has, readClaims } = require('../lib/claims');
const { factsOf } = require('../lib/compete');
const { page, dots, esc } = require('../lib/page');

const ALL = CLAIMS.concat(FEATURE_CLAIMS);
const byId = Object.fromEntries(ALL.map((c) => [c.id, c]));
const order = (r) => ALL.findIndex((c) => c.id === r.id);

function laneOf(row, { many, youSay }) {
  const N = row.of;
  const you = youSay.has(row.id);
  const why = row.n === 0 ? `None of the ${N} ${many} we read mention it on their website.` : `Only ${row.n} of the ${N} ${many} we read mention it (${text.list(row.who.slice(0, 2))}).`;
  const check = you ? 'You already say it on your site: move it into your headline.' : row.n === 0 ? 'Before you lead with it, call one or two of them and ask whether they offer it.' : `Read how ${row.who[0]} says it, then say it more plainly and higher up.`;
  return { id: row.id, label: row.label, n: row.n, of: N, why, line: row.line, check, you, who: row.who, evidence: row.evidence };
}

// The template pick: open lanes first (by weight), then what only a few say (by gap score).
function pickLanes(rows, opts) {
  const zero = rows.filter((r) => r.n === 0).sort((a, b) => b.w - a.w || order(a) - order(b));
  const few = rows.filter((r) => r.n > 0 && r.n / r.of <= 1 / 3).sort((a, b) => b.score - a.score || order(a) - order(b));
  return zero.concat(few).slice(0, 3).map((r) => laneOf(r, opts));
}

function grounded(data, allowed) {
  const all = [data.summary, ...(data.lanes || []).flatMap((l) => [l.why, l.line, l.check])].join('\n');
  for (const m of all.matchAll(/\d+(\.\d+)?/g)) if (!allowed.has(m[0])) return false;
  return true;
}

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', maxLength: 400 },
    lanes: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', properties: { id: { type: 'string' }, why: { type: 'string', maxLength: 220 }, line: { type: 'string', maxLength: 130 }, check: { type: 'string', maxLength: 170 } }, required: ['id', 'why', 'line', 'check'] } },
  },
  required: ['summary', 'lanes'],
};

function reportHtml(out, comps) {
  const N = out.read;
  const lane = (l, i) =>
    `<div class="card"><div class="top"><span class="n">${i + 1}</span><div class="grow"><h3>${esc(l.label)}</h3><p>${l.you ? '<span class="tag you">You say it</span>' : ''}<span class="tag ${l.n ? 'few' : 'zero'}">${l.n} of ${l.of} say it</span></p><p>${esc(l.why)}</p><div class="say"><b>A line you could use, only if it's true for you</b>${esc(l.line)}</div><p class="muted small" style="margin-top:6px">${esc(l.check)}</p></div></div></div>`;
  const few = out.rows.filter((r) => r.n > 0 && r.n / r.of <= 1 / 3);
  const zero = out.rows.filter((r) => r.n === 0).sort((a, b) => a.label.localeCompare(b.label));
  const common = out.rows.filter((r) => r.n / r.of >= 0.5);
  const body = [
    `<h2>Your 3 open lanes</h2>${out.lanes.map(lane).join('')}`,
    few.length ? `<h2>Only one or two say it</h2><table class="t"><tr><th>What</th><th>Who says it</th><th>Their words</th></tr>${few.map((r) => `<tr><td><b>${esc(r.label)}</b><br><span class="muted small">${r.n} of ${r.of}</span></td><td>${esc(text.list(r.who))}</td><td class="small">${r.evidence.map((e) => `"${esc(e.text)}"`).join('<br>') || '<span class="muted">Shown on their site</span>'}</td></tr>`).join('')}</table>` : '',
    common.length ? `<h2>What most of them say</h2><p class="muted small" style="margin-bottom:8px">Buyers here will expect these from you too.</p><div class="chips">${common.map((r) => `<span class="chip">${esc(r.label)} <b>${r.n} of ${r.of}</b></span>`).join('')}</div>` : '',
    `<h2>Who says what</h2><table class="t"><tr><th>What</th><th>How many say it</th><th>Who</th></tr>${out.rows
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
      .map((r) => `<tr><td>${esc(r.label)}${out.youSay.includes(r.id) ? ' <span class="tag you">You</span>' : ''}</td><td class="num">${dots(r.n, r.of)}${r.n} of ${r.of}</td><td class="small">${r.n === r.of ? `All ${r.of}` : esc(r.who.join(', '))}</td></tr>`)
      .join('')}</table>`,
    zero.length ? `<h2>None of them mention</h2><p class="muted small" style="margin-bottom:8px">Each of these is open on their websites. Lead with one only if it's true for you.</p><div class="chips">${zero.map((r) => `<span class="chip">${esc(r.label)}${out.youSay.includes(r.id) ? ' <b>You say it</b>' : ''}</span>`).join('')}</div>` : '',
    out.unread.length ? `<h2>Couldn't read</h2><ul class="plain">${out.unread.map((u) => `<li>${esc(u.name)}: ${esc(u.why)}</li>`).join('')}</ul>` : '',
  ].join('');
  const footer = [
    `<p>Read from each business's own public website on ${esc(out.date)} (robots.txt respected): the homepage and up to 2 more pages each. A business may do something without saying it on its site, so check before you claim to be the only one.</p>`,
    places.creditHtml(comps),
    out.sample ? '<p>Sample businesses: made up to show how it works.</p>' : '',
  ].join('');
  return page({
    title: `Find the gap: ${out.category.many}`,
    eyebrow: `Find the gap: ${out.category.many}${out.city ? ` near ${places.cityShort(out.city)}` : ''}`,
    h1: out.city ? 'What nobody near you is saying' : 'What none of them are saying',
    sub: out.summary,
    pills: [`${N} websites read`, `${out.rows.filter((r) => r.n === 0).length} things none of them say`, out.date],
    body,
    footer,
  });
}

module.exports = {
  name: 'intel.find_gap',
  title: 'Find the gap',
  description: 'Compares what 5 to 10 competitors say on their own websites: what most say, what only one or two say, and what none of them mention, with the 3 open lanes that fit best. Saves a one-page report and a spreadsheet.',
  kind: 'ai',
  tasks: ['plan'],
  risk: 'draft',
  needs: [],
  credits: 12,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      competitors: { type: 'array', title: 'Competitors', description: 'Outputs of intel.scan_competitor with claims: true' },
      category: { type: ['object', 'string'], title: 'Kind of business' },
      city: { type: 'string', title: 'City' },
      mine: { type: 'string', title: 'Your website (optional)' },
    },
    required: ['competitors'],
  },
  output: {
    type: 'object',
    properties: { read: { type: 'integer' }, lanes: { type: 'array' }, rows: { type: 'array' }, summary: { type: 'string' }, report: { type: 'object' }, csv: { type: 'object' }, ai: { type: 'boolean' } },
    required: ['read', 'lanes', 'rows', 'summary', 'report', 'csv', 'ai'],
  },
  async run(input, ctx) {
    const comps = (input.competitors || []).filter((c) => c && c.key && !c.error);
    const cat = input.category && typeof input.category === 'object' ? input.category : places.categoryOf(input.category || 'other');
    const fam = cat.family || places.categoryOf(cat.id || cat.label || '').family || 'other';
    const many = cat.many || 'competitors';
    const readOk = comps.filter((c) => c.siteStatus === 'ok' && c.claims);
    if (readOk.length < 2) throw new Error(readOk.length ? 'Only one competitor website could be read. Paste 5 to 10 competitor websites and run it again.' : "None of the competitor websites could be read. Paste 5 to 10 competitor websites and run it again.");
    const rows = tally(comps, fam, cat.id && cat.id !== 'other' ? cat.id : null);
    const N = readOk.length;
    // The member's own site: what they already say.
    let mine = null;
    const youSay = new Set();
    if (input.mine) {
      const scan = await leads.scanFor(ctx, input.mine);
      if (scan && scan.reachable) {
        mine = factsOf({ website: input.mine }, scan, null);
        mine.claims = await readClaims(ctx, scan.url || input.mine);
        if (mine.claims) for (const r of rows) if (has(mine, byId[r.id])) youSay.add(r.id);
      }
    }
    const opts = { many, youSay };
    const fallbackLanes = pickLanes(rows, opts);
    const candidates = rows.filter((r) => r.n / r.of <= 1 / 3).sort((a, b) => b.score - a.score).slice(0, 10);
    const allowed = new Set([N, ...rows.map((r) => r.n), 1, 2, 3, 24, 7, 48, 30, 10, 60, ...candidates.flatMap((r) => r.line.match(/\d+/g) || [])].map(String));
    const zeroCount = rows.filter((r) => r.n === 0).length;
    const date = time.longDate(time.today(ctx));
    const fallback = () => ({
      summary: `We read the websites of ${N} ${many}${input.city ? ` near ${places.cityShort(input.city)}` : ''}. ${zeroCount ? `${zeroCount} of the things buyers look for aren't on any of them.` : 'Each thing we looked for is on at least one of them.'} The 3 below are where a ${cat.one || 'business'} could stand out, if they are true for you.`,
      lanes: fallbackLanes.map((l) => ({ id: l.id, why: l.why, line: l.line, check: l.check })),
    });
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'plan',
      system: 'You help a small local business owner stand out from competitors, using only facts read from those competitors\' websites. Plain text, second person, short sentences.',
      prompt: `Kind of business: ${cat.label || many}${input.city ? ` in ${input.city}` : ''}. We read ${N} competitor websites.\nWhat they say, as "label: how many of ${N}" (JSON): ${JSON.stringify(rows.map((r) => ({ id: r.id, label: r.label, says: r.n })))}\nCandidates for open lanes (none or few say it): ${JSON.stringify(candidates.map((r) => ({ id: r.id, label: r.label, says: r.n, example_line: r.line })))}\n${youSay.size ? `The member's own site already says: ${[...youSay].map((id) => byId[id].label).join(', ')}.\n` : ''}Pick the 3 candidate ids a ${cat.one || 'business'} here could most use to stand out, and for each write: why (using only these counts, and saying "on their websites"), line (one line for their homepage, true only if they really offer it; put details they must fill in [brackets]), check (how to confirm it's really open before they lead with it). Then a 2 sentence summary. Never promise results or income, never invent numbers, never name a competitor as bad.`,
      schema: SCHEMA,
      maxTokens: 1100,
      accept: (d) => ai.cleanCopy(d) && grounded(d, allowed) && new Set(d.lanes.map((l) => l.id)).size === 3 && d.lanes.every((l) => candidates.some((c) => c.id === l.id)),
      fallback,
    });
    const lanes = data.lanes.map((l) => {
      const row = rows.find((r) => r.id === l.id);
      const base = laneOf(row, opts);
      return { ...base, why: text.plain(l.why), line: text.plain(l.line), check: youSay.has(l.id) ? base.check : text.plain(l.check) };
    });
    const unread = comps.filter((c) => !(c.siteStatus === 'ok' && c.claims)).map((c) => ({ name: c.name, why: text.plain(c.siteNote || (c.siteStatus === 'ok' ? "Its pages didn't answer the second time." : 'No website we could read.')) }));
    const out = {
      read: N,
      category: { id: cat.id, label: cat.label, one: cat.one, many },
      city: input.city || '',
      date,
      summary: text.plain(data.summary),
      lanes,
      rows: rows.map(({ score, w, ...r }) => r),
      youSay: [...youSay],
      mine: mine ? { name: mine.name, website: mine.website } : null,
      unread,
      ai: usedAi,
      sample: comps.some((c) => c.sample),
      notes: unread.length ? [`${unread.length} of the ${comps.length} websites couldn't be read, so they aren't counted.`] : [],
    };
    const where = input.city ? places.cityShort(input.city) : '';
    out.report = await save.saveFile(ctx, save.fileName('find the gap', many, where, time.today(ctx), '.html'), reportHtml(out, comps));
    const cols = [{ key: 'name', label: 'Competitor' }, { key: 'website', label: 'Website' }, { key: 'from', label: 'Found by' }].concat(rows.map((r) => ({ key: r.id, label: r.label })));
    const matrix = comps
      .filter((c) => c.siteStatus === 'ok' && c.claims)
      .map((c) => Object.assign({ name: c.name, website: c.website || '', from: c.source === 'osm' ? 'OpenStreetMap' : c.source === 'pasted' ? 'You pasted it' : c.sample ? 'Sample' : 'Their website' }, ...rows.map((r) => ({ [r.id]: has(c, byId[r.id]) ? 'Yes' : '' }))));
    matrix.push(Object.assign({ name: `How many of ${N}` }, ...rows.map((r) => ({ [r.id]: r.n }))));
    const credit = places.creditLine(comps);
    if (credit) matrix.push({ name: credit });
    out.csv = await save.saveFile(ctx, save.fileName('who says what', many, where, time.today(ctx), '.csv'), files.csv(matrix, cols, { bom: true }));
    ctx.log(`${N} websites read: ${zeroCount} things none of them say`);
    out.credit = comps.filter((c) => c.source === 'osm').slice(0, 1).map((c) => ({ source: 'osm', ...(c.searchBy ? { searchBy: c.searchBy } : {}) }));
    return out;
  },
  view(out) {
    return views.blocks(
      views.metric('Things none of them say', out.rows.filter((r) => r.n === 0).length, `of ${out.rows.length} we looked for, on ${out.read} websites`),
      views.text(out.summary),
      views.cards(out.lanes.map((l, i) => ({ title: `${i + 1}. ${l.label}`, subtitle: `${l.n} of ${l.of} say it. ${l.why}`, body: `A line you could use, only if it's true: "${l.line}" ${l.check}`, badge: l.you ? 'You say it' : undefined }))),
      views.table([{ key: 'label', label: 'What they say' }, { key: 'count', label: 'How many' }], out.rows.slice().sort((a, b) => b.n - a.n).map((r) => ({ label: r.label, count: `${r.n} of ${r.of}` })), 12),
      views.file(out.report, 'Find the gap (one page)'),
      views.file(out.csv, 'Who says what (spreadsheet)'),
      ...places.creditBlocks(out.credit || []),
      out.notes.map((n) => views.text(n)),
      out.sample ? views.text('Sample businesses: made up to show how it works.') : null
    );
  },
};
