// sales.read_prospect: one prospect's facts before a call or a proposal. Reads their own public site
// (kit scan: robots respected, a few pages, cached a week) and the member's pasted notes. Offline or
// blocked, it says so and works from the notes. Nothing is guessed about the business.

const kit = require('../../_kit');
const { text, time, views, web } = kit;
const { factsOf } = require('../lib/facts');
const prospect = require('../lib/prospect');

module.exports = {
  name: 'sales.read_prospect',
  title: 'Read a prospect',
  description: "Reads a prospect's own website (public pages only) and your notes, and returns what they do, what they charge, who runs it, and what's missing that your service fixes, each fact dated.",
  kind: 'api',
  risk: 'read',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', maxLength: 120, title: 'Their name or business name' },
      website: { type: 'string', maxLength: 300, title: 'Their website (optional)' },
      notes: { type: 'string', maxLength: 4000, title: 'What you know or what they told you (optional)' },
    },
  },
  output: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      website: { type: 'string' },
      domain: { type: 'string' },
      reachable: { type: 'boolean' },
      sample: { type: 'boolean' },
      reason: { type: 'string' },
      readOn: { type: 'string' },
      about: { type: 'string' },
      services: { type: 'array', items: { type: 'string' } },
      prices: { type: 'array', items: { type: 'object', properties: { amount: { type: 'number' }, per: { type: ['string', 'null'] }, context: { type: 'string' } } } },
      people: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } } } },
      phone: { type: 'string' },
      email: { type: 'string' },
      hours: { type: 'string' },
      socials: { type: 'object' },
      colors: { type: 'array', items: { type: 'string' } },
      gaps: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, label: { type: 'string' } } } },
      relevant: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, label: { type: 'string' } } } },
      facts: { type: 'array', items: { type: 'string' } },
      notes: { type: 'array', items: { type: 'string' } },
    },
  },
  async run(input, ctx) {
    const f = factsOf(ctx, {});
    const readOn = time.today(ctx);
    const notes = prospect.noteLines(input.notes);
    const out = { name: text.clip(input.name || '', 120), website: '', domain: '', reachable: false, reason: '', readOn, about: '', services: [], prices: [], people: [], phone: '', email: '', hours: '', socials: {}, colors: [], gaps: [], relevant: [], facts: [], notes };
    const url = web.normalizeUrl(input.website || '');
    if (!url) {
      out.reason = input.website ? "That doesn't look like a web address." : 'No website given, so this works from your notes.';
      return out;
    }
    out.website = url;
    out.domain = web.domainOf(url) || '';
    let s;
    try {
      // A sample business's .example site gets the kit's labeled sample scan, as in Your first 25.
      s = await kit.leads.scanFor(ctx, url, { extraPages: 2 });
    } catch (e) {
      s = { reachable: false, reason: "Couldn't read the site." };
    }
    if (!s || !s.reachable) {
      out.reason = (s && s.reason) || "Couldn't read the site.";
      return out;
    }
    if (s.parked) {
      out.reason = `The site looks ${s.parkedReason || 'parked'}, so there's nothing to read on it yet.`;
      out.gaps = [{ key: 'parked', label: `Their website looks ${s.parkedReason || 'parked'}.` }];
      out.relevant = out.gaps;
      return out;
    }
    out.reachable = true;
    if (s.sample) out.sample = true;
    out.domain = s.domain || out.domain;
    out.website = s.url || url;
    if (!out.name) out.name = text.clip((s.title || '').split(/[|,:]/)[0], 80);
    out.about = text.clip(s.description || s.h1 || s.title || '', 300);
    out.services = (s.headings || []).filter((h) => h && h.length > 3 && h.length < 60).slice(0, 10);
    out.prices = (s.prices || []).slice(0, 8).map((p) => ({ amount: p.amount, per: p.per || null, context: text.clip(p.context, 90) }));
    out.people = (s.people || []).slice(0, 3);
    out.phone = (s.contacts && s.contacts.phones && s.contacts.phones[0]) || '';
    out.email = (s.contacts && s.contacts.emails && s.contacts.emails[0]) || '';
    out.hours = s.hours || '';
    out.socials = Object.fromEntries(Object.entries(s.socials || {}).filter(([, v]) => v));
    out.colors = [s.colors && s.colors.primary, s.colors && s.colors.accent].filter((c) => typeof c === 'string' && c);
    out.gaps = prospect.gapsFrom(s, { year: f.year });
    out.relevant = prospect.relevantGaps(out.gaps, f.profile.id, f.arch).slice(0, 4);
    out.facts = prospect.factsFrom(s, readOn);
    return out;
  },
  view(out) {
    return views.blocks(
      out.reachable
        ? views.text(`${out.name || out.domain}: read from ${out.domain}${out.sample ? ' (a sample site)' : ''} on ${out.readOn}.`)
        : views.text(out.reason || 'Working from your notes.'),
      out.about ? views.text(`What they say they do: ${out.about}`) : null,
      out.relevant.length ? views.cards(out.relevant.map((g) => ({ title: g.label, badge: 'Missing' }))) : null,
      out.facts.length ? views.text(out.facts.join('\n')) : null,
      out.notes.length ? views.text(`Your notes:\n${out.notes.join('\n')}`) : null
    );
  },
};
