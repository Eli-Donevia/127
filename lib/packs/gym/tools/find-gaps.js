// gym.find_gaps: ranks every scored gym, compares each with its nearest competitors, and writes
// down its video gaps (with evidence), three video ideas and an opening line. Adds the list to the
// member's Pipeline so nothing lives only in this run.

const { rank } = require('../lib/score');
const P = require('../lib/pipeline');
const { report } = require('../lib/gaps');
const { quickDrafts } = require('../lib/outreach');
const { toCsv, slug } = require('../lib/util');
const src = require('../lib/sources');

const CSV_COLUMNS = [
  { key: 'rank', label: 'Rank' },
  { key: 'name', label: 'Gym' },
  { key: 'tier', label: 'Tier' },
  { key: 'opportunity', label: 'Score' },
  { key: 'kind', label: 'Kind' },
  { key: 'miles', label: 'Miles' },
  { key: 'website', label: 'Website' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'owner', label: 'Owner or manager' },
  { key: 'leadWith', label: 'Lead with' },
  { key: 'check', label: 'Check before you send' },
  { key: 'how', label: 'How to reach them' },
  { key: 'message', label: 'First message' },
];

module.exports = {
  name: 'gym.find_gaps',
  title: 'Rank them and find the gaps',
  description:
    'Ranks scored gyms by opportunity and, for each, lists its video gaps with the evidence (its own website and Instagram, and what its nearest competitors do), three video ideas and an opening line for outreach.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      scored: { title: 'Scored gyms', description: 'Outputs of gym.score_content (a list, or one)' },
      top: { type: 'integer', title: 'How many make your list', description: 'Your first 25 by default. Gyms past it still join your Pipeline if they rank A or B.', minimum: 1, maximum: 60, default: 25 },
      csv: { type: 'boolean', title: 'Save the list as a spreadsheet', default: true },
    },
    required: ['scored'],
  },
  output: { type: 'object', properties: { ranked: { type: 'array' }, counts: { type: 'object' } }, required: ['ranked'] },

  async run(input, ctx) {
    const rows = [].concat(input.scored || []).filter((r) => r && !r.error && r.gym && r.score);
    if (!rows.length) throw new Error('No gyms were scored, so there is nothing to rank yet.');
    const ranked = rank(rows).map((r) => {
      const rep = report(r, rows);
      return {
        key: r.gym.key,
        rank: r.rank,
        name: r.gym.locations > 1 ? `${r.gym.name} (${r.gym.locations} locations)` : r.gym.name,
        tier: r.score.tier,
        opportunity: r.score.opportunity,
        canPay: r.score.canPay,
        needsHelp: r.score.needsHelp,
        reachable: r.score.reachable,
        content: r.score.content,
        why: r.score.why,
        contact: r.score.contact,
        topGap: rep.gaps[0] ? rep.gaps[0].title : null,
        gaps: rep.gaps,
        ideas: rep.ideas,
        opener: rep.opener,
        competitors: rep.competitors,
        gym: r.gym,
        site: r.site,
        insta: r.content,
        sample: !!r.sample,
      };
    });
    const counts = { A: 0, B: 0, C: 0, total: ranked.length };
    for (const r of ranked) counts[r.tier]++;
    const topN = input.top || 25;
    // A first message for every gym on the list, offering to make its sample (no AI, so no cost).
    const brain = ctx.brain || {};
    const city = (brain.business && brain.business.city) || (ctx.inputs && ctx.inputs.city && !/^\s*\d/.test(ctx.inputs.city) ? String(ctx.inputs.city).split(',')[0].trim() : '');
    for (const r of ranked.slice(0, topN)) {
      const q = quickDrafts({ gym: r.gym, score: { contact: r.contact || {} }, report: { gaps: r.gaps }, member: ctx.member || {}, business: brain.business || {}, city, offer: r.site && r.site.offer });
      // The first message on this gym's best channel, the same one Today's list uses.
      const c = r.contact || {};
      r.channel = P.channelFor({ instagram: c.instagram, email: c.email, phone: c.phone || r.gym.phone });
      r.firstMessage = r.channel === 'Email' ? `Subject: ${q.email.subject}\n\n${q.email.body}` : r.channel === 'Phone' ? q.call : r.channel === 'Walk-in' ? q.walkIn : q.dm;
      r.firstEmail = q.email;
    }
    // The list goes into the member's Pipeline, so the daily list and later tools can pick gyms by name.
    const keep = ranked.filter((r, i) => i < topN || r.tier !== 'C');
    const pipe = await P.load(ctx);
    P.upsertFound(pipe, keep, ctx.now ? ctx.now() : Date.now());
    await P.save(ctx, pipe);
    let csv = null;
    if (input.csv !== false && typeof ctx.save === 'function') {
      const rows = ranked.slice(0, topN).map((r) => ({
        rank: r.rank,
        name: r.name,
        tier: r.tier,
        opportunity: r.opportunity,
        kind: r.gym.category,
        miles: r.gym.miles,
        website: r.gym.website,
        instagram: r.contact && r.contact.instagram ? `@${r.contact.instagram}` : '',
        email: r.contact && r.contact.email,
        phone: (r.contact && r.contact.phone) || r.gym.phone,
        owner: r.contact && r.contact.owner ? `${r.contact.owner.name} (${r.contact.owner.role})` : '',
        leadWith: r.gaps[0] ? r.gaps[0].evidence : 'Not checked yet',
        check: r.gaps[0] && r.gaps[0].check ? r.gaps[0].check : '',
        how: r.channel,
        message: r.firstMessage,
      }));
      // The OpenStreetMap credit travels with the list, spreadsheet included (ODbL, Legal L55).
      if (ranked.slice(0, topN).some((r) => r.gym.source === 'openstreetmap')) rows.push({ name: `${src.OSM_CREDIT}: ${src.OSM_COPYRIGHT}` });
      const day = new Date(ctx.now ? ctx.now() : Date.now()).toISOString().slice(0, 10);
      try {
        csv = await ctx.save(`lists/first-${Math.min(topN, ranked.length)}-gyms${city ? `-${slug(city)}` : ''}-${day}.csv`, toCsv(CSV_COLUMNS, rows), { type: 'text/csv' });
      } catch (e) {
        if (ctx.log) ctx.log(`Couldn't save the spreadsheet: ${e.message}`);
      }
    }
    if (ctx.log) ctx.log(`Ranked ${ranked.length} gyms: ${counts.A} worth pitching first, ${counts.B} maybe, ${counts.C} later`);
    return { ranked, counts, top: Math.min(topN, ranked.length), csv, osm: ranked.some((r) => r.gym.source === 'openstreetmap'), sample: ranked.some((r) => r.sample) };
  },

  view(out) {
    const top3 = out.ranked.slice(0, 3);
    const n = out.top || Math.min(25, out.ranked.length);
    return [
      { type: 'metric', label: `Your first ${n} gyms`, value: out.counts.A, note: `worth pitching first, ${out.counts.B} maybe, ${out.counts.C} later` },
      {
        type: 'table',
        columns: [
          { key: 'rank', label: '#', format: 'number' },
          { key: 'name', label: 'Gym' },
          { key: 'tier', label: 'Tier' },
          { key: 'opportunity', label: 'Score', format: 'number' },
          { key: 'content', label: 'Their video' },
          { key: 'topGap', label: 'Biggest gap' },
        ],
        rows: out.ranked.slice(0, n).map((r) => ({ rank: r.rank, name: r.name, tier: r.tier, opportunity: r.opportunity, content: r.content.label, topGap: r.topGap || 'Not checked' })),
        limit: 10,
      },
      ...(out.csv ? [{ type: 'file', asset: out.csv, label: `All ${n} gyms with their first message (spreadsheet)` }] : []),
      ...(out.osm ? [{ type: 'link', label: src.OSM_CREDIT, href: src.OSM_COPYRIGHT }] : []),
      {
        type: 'cards',
        items: top3.map((r) => ({
          title: `${r.rank}. ${r.name}`,
          subtitle: `Tier ${r.tier}, score ${r.opportunity}`,
          body: [...r.gaps.slice(0, 3).map((g) => `${g.title}: ${g.evidence}`), `Open with: ${r.opener}`, ...r.gaps.slice(0, 1).filter((g) => g.check).map((g) => `Before you send: ${g.check}`)].join('\n'),
          badge: r.tier,
          href: r.gym.website || undefined,
        })),
      },
    ];
  },
};
