// Show up with the work done: a one-page missed-call plan for one contractor, built only from their
// own website. What a caller can and can't find today, the text their number would send after a
// missed call, an after-hours reply, a booking flow, FAQ answers drafted from their pages and a
// sample conversation. A printable HTML page plus a picture to send with the follow-up.

const kit = require('../../_kit');
const { text, views, save, media, brain } = kit;
const NICHE = require('../data/niche.json');
const { readSite } = require('../lib/site');
const plan = require('../lib/plan');
const { auditHtml } = require('../lib/pages');
const { auditCard } = require('../lib/card');
const { longDate } = require('../../_kit/talk');

module.exports = {
  name: 'frontdesk.audit',
  title: 'Missed-call plan',
  description: 'Reads one contractor\'s website and makes their missed-call plan: what callers can\'t find, the text back, an after-hours reply, a booking flow, FAQ answers from their pages and a sample conversation. Printable page plus a picture.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      website: { type: 'string', maxLength: 300 },
      lead: { type: 'object' },
      business: { type: 'string', maxLength: 100 },
      trade: { type: 'string', enum: Object.keys(NICHE.trades) },
      city: { type: 'string', maxLength: 120 },
      myName: { type: 'string', maxLength: 60 },
      myBusiness: { type: 'string', maxLength: 80 },
      myContact: { type: 'string', maxLength: 160 },
      myAddress: { type: 'string', maxLength: 160 },
      sendCopy: { type: 'boolean' },
    },
  },
  output: { type: 'object', required: ['name', 'texts', 'page'], properties: { name: { type: 'string' }, texts: { type: 'array' }, page: { type: 'object' } } },
  timeoutSec: 120,
  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const lead = input.lead || {};
    const trade = input.trade || lead.trade || 'contractors';
    const city = text.plain(input.city || lead.city || br.place || '');
    const website = input.website || lead.website || '';
    const site = await readSite(ctx, { website, trade });
    const facts = site.facts;
    if (input.business) facts.name = text.plain(input.business);
    if (!facts.name) facts.name = lead.name && lead.name !== 'Open the map link' ? text.plain(lead.name) : site.domain || 'Your business';
    const checked = longDate(site.checked);
    const rows = site.reachable
      ? plan.auditRows(facts, site)
      : [{ item: 'Website', miss: 'a website', found: site.reason || 'No website found', ok: false, page: '' }, ...plan.auditRows(facts, { url: '' }).slice(1)];
    const texts = plan.texts(facts, { trade, city });
    const faq = plan.faq(facts, { trade, city });
    const flow = plan.bookingFlow(facts, { trade });
    const convo = plan.conversation(facts, { trade });
    const stats = NICHE.missed_call_facts.slice(0, trade === 'hvac' ? 3 : 2).concat(NICHE.missed_call_facts.slice(3, 4));
    const member = { name: text.plain(input.myName || br.firstName || ''), business: text.plain(input.myBusiness || br.name || ''), contact: text.plain(input.myContact || '') };
    // A business found on OpenStreetMap keeps the ODbL credit on its page (D27).
    const html = auditHtml({ site, facts, rows, texts, faq, flow, convo, stats, member, checked, credit: kit.places.creditHtml([lead]) });
    const base = facts.name;
    const page = await save.saveFile(ctx, save.fileName(base, 'missed-call-plan', '.html'), html);
    const inside = ['The after-hours reply', `A booking flow in ${flow.length} steps`, `${faq.length} answers to the questions callers ask`, 'A sample conversation'];
    const svgText = auditCard({ name: plan.shortName(facts.name), rows, text: texts[0].text, checked, domain: site.domain, hex: facts.colors && facts.colors.primary, inside });
    let picture = null;
    if (media.canRender(ctx)) {
      try {
        const png = await media.svgToPng(ctx, svgText, { width: 1080, height: 1350 });
        picture = await save.saveFile(ctx, save.fileName(base, 'missed-call-plan', '.png'), png, 'image/png');
      } catch (e) {
        picture = null;
      }
    }
    if (!picture) picture = await save.saveFile(ctx, save.fileName(base, 'missed-call-plan', '.svg'), svgText);
    const missing = rows.filter((r) => !r.ok).map((r) => r.miss || r.item.toLowerCase());
    const svc = NICHE.service;
    const sendEmail = {
      subject: text.clip(text.fill(svc.subject, { biz: plan.shortName(facts.name) }), 70),
      body: [
        `Hi ${facts.owner || `${plan.shortName(facts.name)} team`},`,
        '',
        `I made a one-page missed-call plan for ${plan.shortName(facts.name)}, written from your website: the text your number would send when you miss a call, an after-hours reply, a booking flow and answers to the questions callers ask.`,
        missing.length ? `Right now a caller can't find ${missing.slice(0, 2).join(' or ')} on your site, so I started there.` : 'Your site already covers the basics, so the plan is about the calls you can\'t pick up.',
        '',
        'It\'s attached. Use it either way. If you want it running on your own number this week, I can set it up on your account.',
        '',
        member.name || '[your name]',
        member.business || '',
        text.plain(input.myAddress || '') || kit.outreach.ADDRESS_HOLD,
        '',
        kit.outreach.OPT_OUT,
      ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n'),
    };
    const sendText = text.plain(`Hi, it's ${member.name || '[your name]'} again. I put together the missed-call plan for ${plan.shortName(facts.name)}, written from your website. Here's the picture; the full page is in my email. Want it running on your number this week?`);
    return {
      name: facts.name,
      domain: site.domain || '',
      reachable: !!site.reachable,
      sample: !!site.sample,
      checked,
      pagesRead: site.pagesRead || 0,
      rows,
      found: rows.filter((r) => r.ok).length,
      texts,
      faq,
      flow,
      convo,
      stats,
      page,
      picture,
      sendEmail,
      sendText,
      mapsUrl: lead.mapsUrl || '',
      missing,
      key: lead.key || '',
      // From their own website, for the Pipeline row "Make a free sample" saves.
      email: facts.email || '',
      phone: facts.phone || '',
      owner: facts.owner || '',
      website: site.url || website || '',
      sendCopy: input.sendCopy !== false,
    };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text('Sample business: the website is made up so you can see how the plan reads.') : null,
      views.metric(`What a caller can do on ${out.domain || 'their website'}`, `${out.found} of ${out.rows.length}`, `Checked ${out.checked}`),
      views.table([{ key: 'item', label: 'Callers look for' }, { key: 'found', label: 'What we found' }, { key: 'status', label: '' }], out.rows.map((r) => ({ ...r, status: r.ok ? 'Yes' : 'Fix' }))),
      views.image(out.picture && /png/.test(out.picture.type || out.picture.name || '') ? out.picture : null, 'Send this picture with your follow-up'),
      views.file(out.page, 'Missed-call plan (printable page)'),
      out.picture && !/png/.test(out.picture.type || out.picture.name || '') ? views.file(out.picture, 'Plan picture') : null,
      views.copy('The missed-call text', out.texts[0].text),
      views.copy('The after-hours text', out.texts[1].text),
      out.sendCopy === false ? null : views.copy('Email to send with the plan', `Subject: ${out.sendEmail.subject}\n\n${out.sendEmail.body}`),
      out.sendCopy === false ? null : views.copy('Short follow-up with the picture (DM or email reply, not a cold text)', out.sendText),
      views.cards(out.faq.slice(0, 4).map((f) => ({ title: f.q, body: f.a, badge: f.from.startsWith('From') ? 'From their site' : 'Suggested' }))),
    );
  },
};
