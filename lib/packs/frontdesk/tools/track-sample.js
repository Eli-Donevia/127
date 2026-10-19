// After "Make a free sample": the missed-call plan goes on the lead in the member's Pipeline, in the
// message slot Do my day hands out next (contract 13). Not contacted yet: the plan is the first email
// (and a DM with the picture). Contacted: it is the next follow-up. Replied or a call booked: it is
// the answer. A business that isn't in the Pipeline yet is added with its facts, score and channel.
// Email versions end like every first email: name, business, mailing address and the opt-out (D28).

const kit = require('../../_kit');
const { text, views, brain, time, outreach } = kit;
const NICHE = require('../data/niche.json');
const talk = require('../../_kit/talk');
const { shortName } = require('../lib/plan');

const firstOf = (s) => {
  const t = text.oneLine(String(s || '')).replace(/^(mr|mrs|ms|dr)\.?\s+/i, '');
  const m = t.match(/^([A-Z][a-z]{1,15})(\s+[A-Z][a-z'-]+)?$/);
  return m ? m[1] : '';
};

module.exports = {
  name: 'frontdesk.track_sample',
  title: 'Save the plan',
  description: 'Puts the missed-call plan on the business in your Pipeline as the next message Do my day hands you (the first email, the next follow-up or the answer to their reply), or adds the business with its facts when it isn\'t there yet.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    required: ['lead', 'plan'],
    properties: {
      lead: { type: 'object' },
      plan: { type: 'object' },
      city: { type: 'string', maxLength: 120 },
      myName: { type: 'string', maxLength: 60 },
      myBusiness: { type: 'string', maxLength: 80 },
      myAddress: { type: 'string', maxLength: 160 },
    },
  },
  output: { type: 'object', required: ['slot', 'line'], properties: { slot: { type: 'string' }, line: { type: 'string' }, saved: { type: 'boolean' }, messages: { type: 'object' } } },
  timeoutSec: 30,
  async run(input, ctx) {
    const lead = input.lead || {};
    const plan = input.plan || {};
    const br = brain.brainOf(ctx, {});
    const me = text.plain(input.myName || br.firstName || '');
    const biz = text.plain(input.myBusiness || br.name || '');
    const city = text.plain(input.city || lead.city || br.city || '');
    const address = text.plain(input.myAddress || '') || outreach.ADDRESS_HOLD;
    const name = text.plain(plan.name || lead.name || 'This business');
    const s = shortName(name);
    const owner = firstOf(plan.owner);
    const hi = owner || `${s} team`;
    const missing = Array.isArray(plan.missing) ? plan.missing : [];
    const gap = missing.length ? `Right now a caller can't find ${text.list(missing.slice(0, 2), 'or')} on your website, so I started there.` : 'Your website already covers the basics, so the plan is about the calls nobody can pick up.';
    const what = 'the text your number would send when you miss a call, an after-hours reply and a booking flow';
    const who = (NICHE.trades[lead.trade] || NICHE.trades.contractors || {}).for || 'contractors';
    const town = city.split(',')[0].trim();
    const intro = `I'm ${me || '[your name]'}${biz ? ` from ${biz}` : ''}, and I set up missed-call text back and online booking for ${who}${town ? ` around ${town}` : ''}.`;
    const sign = [me || '[your name]', biz, address].filter(Boolean).join('\n');
    const asEmail = (...paras) => [`Hi ${hi},`, '', ...paras.flatMap((p) => [text.plain(p), '']), sign, '', outreach.OPT_OUT].join('\n');
    const [d1, d2] = talk.callDays(ctx);
    const checked = plan.checked || time.today(ctx);

    // Which message slot Do my day reads next for this lead.
    const stage = lead.inPipeline ? lead.stage || 'found' : 'new';
    const touches = Number(lead.touches) || 0;
    const byEmail = !lead.channel || ['email', 'site'].includes(lead.channel);
    let slot = 'first';
    if (stage === 'contacted') slot = touches >= 3 ? 'done' : touches >= 2 ? 'follow2' : 'follow1';
    else if (stage === 'replied' || stage === 'call') slot = 'answer';
    else if (stage === 'won') slot = 'won';
    else if (stage === 'lost') slot = 'lost';

    const subject = text.clip(`A missed-call plan for ${s}`, 70);
    const first = asEmail(`${intro} I made a one-page missed-call plan for ${s}, written from your website: ${what}.`, gap, "It's attached. Use it either way. If you want it running on your own number this week, I can set it up on your account.");
    const dm = text.plain(`Hi ${hi}! ${intro} I made a one-page plan for the calls ${s} misses, written from your website: the exact text your number would send back. Here's the picture. Want the full page?`);
    const followText = `It's ${me || '[your name]'} again. I went ahead and made the missed-call plan for ${s}, written from your website: ${what}. ${gap} It's attached. Use it either way.`;
    const follow = byEmail ? asEmail(followText) : text.plain(`Hi ${hi}, ${followText.charAt(0).toLowerCase()}${followText.slice(1)}`);
    const answer = text.plain(`Hi ${owner || 'there'}, here's the missed-call plan for ${s}, written from your website: ${what}. ${gap} The picture and the full page are attached. Want to walk through it for 15 minutes? Would ${d1} or ${d2} work?${me ? `\n\n${me}` : ''}`);
    // The first slot's follow-ups go the same way as the first message: email ones end like the email.
    const asDm = (body) => text.plain(`Hi ${hi}, ${body.charAt(0).toLowerCase()}${body.slice(1)}`);
    const nudge1Text = `Did the missed-call plan for ${s} come through okay? Happy to change anything in it. If you want it running on your number this week, I can set it up on your account.`;
    const nudge2Text = `Last note from me: the plan for ${s} is yours to keep either way. If the timing is wrong, no worries at all.`;
    const nudge1 = byEmail ? asEmail(nudge1Text) : asDm(nudge1Text);
    const nudge2 = byEmail ? asEmail(nudge2Text) : asDm(nudge2Text);

    const leads = (ctx && ctx.leads) || {};
    const own = !lead.pack || lead.pack === 'frontdesk';
    const factsFor = () => {
      const rows = Array.isArray(plan.rows) ? plan.rows.filter((r) => r && !r.ok) : [];
      const out = rows.slice(0, 3).map((r) => text.clip(`${r.item}: ${r.found}${plan.domain ? ` (${plan.domain}, checked ${checked})` : ''}`, 160));
      out.push(`Missed-call plan made ${checked}`);
      return out.slice(0, 5);
    };
    let saved = false;
    let line = '';
    let messages = {};
    try {
      if (slot === 'first') {
        messages = { subject, email: first, dm, follow1: nudge1, follow2: nudge2 };
        if (!lead.inPipeline) {
          if (typeof leads.upsert === 'function') {
            const dom = talk.domainOf(plan.website || lead.website);
            const links = {};
            if (plan.website || lead.website) links.website = plan.website || lead.website;
            if (plan.email) links.email = plan.email;
            if (plan.phone) links.phone = plan.phone;
            const found = Number(plan.found) || 0;
            const of = Array.isArray(plan.rows) ? plan.rows.length : 0;
            await leads.upsert({
              key: lead.key || (dom ? `site:${dom}` : `lead:${text.slug(name, 40)}`),
              name,
              company: name,
              source: `Missed-call plan${plan.sample ? ' (sample)' : ''}`,
              stage: 'found',
              links,
              note: text.clip(`Missed-call plan made ${checked}.`, 200),
              data: { trade: lead.trade || 'contractors', city, planMade: checked, sample: !!plan.sample },
              msg: messages,
              facts: factsFor(),
              // Fit: how much a caller can't do on their site today (more missing, a better fit).
              score: of ? Math.round(40 + 50 * ((of - found) / of)) : 50,
              channel: plan.email ? 'email' : 'site',
            });
            saved = true;
            line = `Added ${name} to your Pipeline with the plan email as the first message, so Do my day hands it to you.`;
          }
        } else if (own && typeof leads.upsert === 'function') {
          await leads.upsert({ key: lead.key, msg: messages, data: { ...(lead.data || {}), planMade: checked }, facts: factsFor() });
          saved = true;
          line = `Saved the plan email on ${name} in your Pipeline as the first message.`;
        } else if (typeof leads.update === 'function' && lead.id) {
          await leads.update(lead.id, { msg: messages });
          saved = true;
          line = `Saved the plan email on ${name} in your Pipeline as the first message.`;
        }
      } else if (slot === 'follow1' || slot === 'follow2') {
        messages = { [slot]: follow };
        if (typeof leads.update === 'function' && lead.id) await leads.update(lead.id, { msg: messages });
        else if (own && typeof leads.upsert === 'function') await leads.upsert({ key: lead.key, msg: messages });
        saved = true;
        line = `Saved the plan as ${name}'s next follow-up in your Pipeline.`;
      } else if (slot === 'answer') {
        messages = { answer };
        if (typeof leads.update === 'function' && lead.id) await leads.update(lead.id, { msg: messages });
        else if (own && typeof leads.upsert === 'function') await leads.upsert({ key: lead.key, msg: messages });
        saved = true;
        line = `Saved the plan as your answer to ${name} in your Pipeline.`;
      } else if (slot === 'done') {
        line = `${name} has had 3 messages with no reply, so nothing was saved. Let this one go, or send the plan only if they write back.`;
      } else if (slot === 'won') {
        line = `${name} is already a client. Use the plan in "Set up a new client".`;
      } else {
        line = `${name} is marked lost in your Pipeline, so nothing was saved. Only send the plan if they write to you first.`;
      }
    } catch (e) {
      saved = false;
      line = "Couldn't save to your Pipeline this time. Copy the messages from here.";
    }
    if (saved && (slot === 'first' || slot === 'follow1' || slot === 'follow2') && /\[Your business address/.test(JSON.stringify(messages))) {
      line += ' Save your mailing address in Your business so the email can go out with one tap.';
    }
    return { slot, saved, line, name, messages, attach: 'Attach the plan page and the picture when you send it.' };
  },
  view(out) {
    const m = out.messages || {};
    return views.blocks(
      views.text(out.line),
      m.email ? views.copy('First email with the plan', `Subject: ${m.subject}\n\n${m.email}`) : null,
      m.dm ? views.copy('Instagram or Facebook message (send the picture with it)', m.dm) : null,
      m.follow1 && !m.email ? views.copy('Follow-up with the plan', m.follow1) : null,
      m.follow2 && !m.email ? views.copy('Follow-up with the plan', m.follow2) : null,
      m.answer ? views.copy('Your answer with the plan', m.answer) : null,
      out.saved ? views.text(out.attach) : null,
    );
  },
};
