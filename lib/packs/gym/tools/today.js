// gym.today: the member's list for today. A fixed number of reach-outs every day (25 by default, up to
// 100), done before anything else: replies and calls first, every follow-up that's due, then new gyms
// in rank order. Every item comes with its words already written.

const P = require('../lib/pipeline');
const { quickDrafts, emailFooter, withEmailFooter } = require('../lib/outreach');
const { OSM_CREDIT, OSM_COPYRIGHT } = require('../lib/sources');
const { plain } = require('../lib/util');

const MAX_COPIES = { followUps: 8, fresh: 15 };

module.exports = {
  name: 'gym.today',
  title: "Today's list",
  description: "Today's reach-outs with the words written: replies to answer, calls, the follow-ups that are due, and new gyms from your list until you hit your daily number. Plus how far you are from your goal.",
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 0,
  input: {
    type: 'object',
    properties: {
      daily: { type: 'integer', title: 'Reach-outs a day', description: 'Follow-ups and new gyms together. 25 takes about 20 minutes.', minimum: 5, maximum: 100, default: 25 },
      goalClients: { type: 'integer', title: 'Clients you want', minimum: 1, maximum: 50, default: 3 },
      newPerDay: { type: 'integer', title: 'At most this many new gyms a day (optional)', minimum: 1, maximum: 100 },
    },
  },
  output: { type: 'object', properties: { followUps: { type: 'array' }, fresh: { type: 'array' }, stats: { type: 'object' } }, required: ['followUps', 'fresh', 'stats'] },

  async run(input, ctx) {
    const now = ctx.now ? ctx.now() : Date.now();
    const brain = ctx.brain || {};
    const p = await P.load(ctx);
    const offer = brain.packs && brain.packs.gym && brain.packs.gym.offer;
    const radiusMiles = offer && offer.scarcity ? offer.scarcity.radiusMiles : 0;
    const daily = input.daily || 25;
    const t = P.today(p, now, { daily, newPerDay: input.newPerDay, radiusMiles, sample: !!ctx.sample });
    // Email follow-ups end like the first email: name, address and opt-out (Legal L55).
    const footer = emailFooter(ctx.member || {}, brain.business || {});
    const followUps = t.followUps.map((f) => {
      const text =
        f.text ||
        plain(
          f.checkIn
            ? f.last
              ? 'Last check-in from me. Should I close your file for now? Either answer is totally fine.'
              : 'Hi, just checking in on my last message. Is this still something you want to look at? Either answer is fine.'
            : f.day === 14
              ? 'Last one from me. Should I close your file, or is video something you want to sort out later this year? Either answer is totally fine.'
              : `Hey, just floating this back up in case it got buried. Happy to make one short video for ${f.name}, free. Want it?`
        );
      return { ...f, text: f.channel === 'Email' ? withEmailFooter(text, footer) : text };
    });
    // The first message for each new gym, on its best channel.
    const member = ctx.member || {};
    const business = brain.business || {};
    const fresh = t.fresh.map((f) => {
      const l = p.leads[f.key] || {};
      const row = l.row || {};
      const q = quickDrafts({
        gym: { name: l.name, city: l.city, ...(row.gym || {}) },
        score: { contact: row.contact || { instagram: l.instagram, email: l.email, phone: l.phone, owner: l.owner ? { name: l.owner } : null } },
        report: { gaps: row.gaps || [] },
        member,
        business,
        city: business.city || l.city,
        offer: row.site && row.site.offer,
      });
      const text = f.channel === 'Email' ? `Subject: ${q.email.subject}\n\n${q.email.body}` : f.channel === 'Phone' ? q.call : f.channel === 'Walk-in' ? `${q.walkIn}\n\n(No Instagram, email or phone found: walk in between classes and say this at the front desk.)` : q.dm;
      return { ...f, text, email: f.channel === 'Email' && q.email.to ? { to: q.email.to, subject: q.email.subject } : null, instagram: l.instagram || null };
    });
    const stats = P.stats(p, { goalClients: input.goalClients || 3, daily });
    const total = followUps.length + fresh.length;
    const minutes = Math.max(5, Math.round(total * 0.8) + t.replied.length * 3 + t.calls.length * 10);
    const plan = [];
    if (t.calls.length) plan.push(`Calls today: ${t.calls.map((c) => c.name).join(', ')}. Open "Prep for a call" first.`);
    if (t.replied.length) plan.push(`Answer first: ${t.replied.map((r) => r.name).join(', ')} replied. Paste their reply into "Answer a reply".`);
    if (followUps.length) plan.push(`${followUps.length} follow-up${followUps.length > 1 ? 's' : ''} due. Copy, send, then log "Followed up".`);
    if (fresh.length) plan.push(`${fresh.length} new gym${fresh.length > 1 ? 's' : ''}. Each message offers a free sample: when one says yes, run "Make a sample for a gym" and send it.`);
    // A gym the member knows goes in with "Check any gym", the way to build a list while 127's map search is off.
    // Its short name: a time next to "Your first 25 gyms" reads as a First 25 time claim (copy check, Legal S23).
    const check = '"Check any gym"';
    if (!Object.keys(p.leads).length) plan.push(`No gyms yet. Run "Your first 25 gyms" to build your list, or add a gym you know with ${check}.`);
    else if (!t.real && t.samples) plan.push(`No real gyms yet: the ${t.samples} from your search are made-up samples, so today has none to send. Add gyms you know with ${check}.`);
    else if (!t.left) plan.push(`This is the last of your list. Add more with "Your first 25 gyms" (more miles or the next town over) or ${check}.`);
    else if (t.left < daily) plan.push(`Only ${t.left} gym${t.left > 1 ? 's' : ''} left on your list after today. Add more soon with "Your first 25 gyms" or ${check}.`);
    if (t.real && t.samples) plan.push(`${t.samples} made-up sample gym${t.samples > 1 ? 's stay' : ' stays'} off today's list.`);
    if (t.blocked.length) plan.push(`${t.blocked.length} gym${t.blocked.length > 1 ? 's are' : ' is'} off limits because of your one-gym-per-area promise.`);
    // New gyms from the OpenStreetMap list carry its credit (ODbL, Legal L55).
    const osm = fresh.some((f) => (p.leads[f.key] || {}).source === 'openstreetmap');
    return { date: new Date(now).toISOString().slice(0, 10), total, daily, minutes, followUps, calls: t.calls, replied: t.replied, fresh, blocked: t.blocked, left: t.left, stats, plan, osm };
  },

  view(out) {
    const s = out.stats;
    const blocks = [
      { type: 'metric', label: "Today's reach-outs", value: out.total, note: `about ${out.minutes} minutes. So far: ${s.contacted} contacted, ${s.calls} calls, ${s.won} won` },
      { type: 'text', text: out.plan.join('\n') },
    ];
    const fu = out.followUps.slice(0, MAX_COPIES.followUps);
    for (const f of fu) blocks.push({ type: 'copy', label: `${f.name}: ${f.checkIn ? `check-in ${f.checkIn} after their reply` : `day ${f.day} follow-up`} (${f.channel})`, text: f.text });
    if (out.followUps.length > fu.length)
      blocks.push({
        type: 'table',
        title: 'More follow-ups due',
        columns: [
          { key: 'name', label: 'Gym' },
          { key: 'when', label: 'Which' },
          { key: 'text', label: 'Message' },
        ],
        rows: out.followUps.slice(fu.length).map((f) => ({ ...f, when: f.checkIn ? `check-in ${f.checkIn}` : `day ${f.day}` })),
      });
    const fr = out.fresh.slice(0, MAX_COPIES.fresh);
    for (const f of fr) blocks.push({ type: 'copy', label: `#${f.rank || '?'} ${f.name}: ${f.channel === 'Instagram' ? `Instagram DM${f.instagram ? ` to @${f.instagram}` : ''}` : f.channel === 'Email' ? 'email' : f.channel === 'Phone' ? 'call' : 'walk-in'}`, text: f.text, email: f.email || undefined });
    if (out.fresh.length > fr.length)
      blocks.push({
        type: 'table',
        title: 'More new gyms for today',
        columns: [
          { key: 'rank', label: '#', format: 'number' },
          { key: 'name', label: 'Gym' },
          { key: 'channel', label: 'How' },
          { key: 'text', label: 'Message' },
        ],
        rows: out.fresh.slice(fr.length),
      });
    if (out.osm) blocks.push({ type: 'link', label: OSM_CREDIT, href: OSM_COPYRIGHT });
    const more = s.goalClients - s.won;
    blocks.push({ type: 'text', text: `${s.note}${s.toGoal != null && more > 0 ? ` At that rate, ${more} more would take about ${s.toGoal} more gyms.` : ''}` });
    return blocks;
  },
};
