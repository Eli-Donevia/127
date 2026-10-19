// After "Make a free sample": the review card goes on the shop in the member's Pipeline, in the message
// slot Do my day hands out next (contract 13). Not contacted yet: the card is the first email (and a
// DM and a walk-in line with the picture). Contacted: it is the next follow-up. Replied or a call
// booked: it is the answer. A shop that isn't in the Pipeline yet is added with its facts, score and
// channel. Email versions end like every first email: name, business, mailing address and the
// opt-out (D28). Nothing here offers anything for a review.

const kit = require('../../_kit');
const { text, views, brain, time, outreach } = kit;
const talk = require('../../_kit/talk');
const { shortName } = require('../lib/close');

const firstOf = (s) => {
  const t = text.oneLine(String(s || '')).replace(/^(mr|mrs|ms|dr)\.?\s+/i, '');
  const m = t.match(/^([A-Z][a-z]{1,15})(\s+[A-Z][a-z'-]+)?$/);
  return m ? m[1] : '';
};

module.exports = {
  name: 'reviews.track_sample',
  title: 'Save the card',
  description: 'Puts the review card on the shop in your Pipeline as the next message Do my day hands you (the first email, the next follow-up or the answer to their reply), or adds the shop with its facts when it isn\'t there yet.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    required: ['lead', 'card'],
    properties: {
      lead: { type: 'object' },
      card: { type: 'object' },
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
    const card = input.card || {};
    const br = brain.brainOf(ctx, {});
    const me = text.plain(input.myName || br.firstName || '');
    const biz = text.plain(input.myBusiness || br.name || '');
    const city = text.plain(input.city || lead.city || card.city || br.city || '');
    const address = text.plain(input.myAddress || '') || outreach.ADDRESS_HOLD;
    const name = text.plain(card.name || lead.name || 'This shop');
    const s = shortName(name);
    const owner = firstOf(card.owner);
    const hi = owner || 'there';
    const checked = card.checked || time.today(ctx);
    const day = talk.longDate(checked);
    const site = card.website || {};
    const domain = talk.domainOf(site.url || lead.website);
    const gap = site.checked && site.reachable && !site.shown ? `I also noticed your website doesn't show any reviews yet (I checked on ${day}).` : '';
    const what = 'a counter card and handout cards with a code that opens your Google listing';
    const town = city.split(',')[0].trim();
    const intro = `I'm ${me || '[your name]'}${biz ? ` from ${biz}` : ''}, and I help shops${town ? ` around ${town}` : ''} get more Google reviews the honest way.`;
    const sign = [me || '[your name]', biz, address].filter(Boolean).join('\n');
    const asEmail = (...paras) => [`Hi ${hi},`, '', ...paras.filter(Boolean).flatMap((p) => [text.plain(p), '']), sign, '', outreach.OPT_OUT].join('\n');
    const asDm = (body) => text.plain(`Hi ${hi}, ${body.charAt(0).toLowerCase()}${body.slice(1)}`);
    const [d1, d2] = talk.callDays(ctx);

    // Which message slot Do my day reads next for this shop.
    const stage = lead.inPipeline ? lead.stage || 'found' : 'new';
    const touches = Number(lead.touches) || 0;
    const byEmail = !lead.channel || ['email', 'site'].includes(lead.channel);
    let slot = 'first';
    if (stage === 'contacted') slot = touches >= 3 ? 'done' : touches >= 2 ? 'follow2' : 'follow1';
    else if (stage === 'replied' || stage === 'call') slot = 'answer';
    else if (stage === 'won') slot = 'won';
    else if (stage === 'lost') slot = 'lost';

    const subject = text.clip(`A free review card for ${s}`, 70);
    const first = asEmail(`${intro} I made a free review card for ${s}: ${what}, so every customer can leave a review in one tap.`, gap, 'The picture is attached. Use it either way. Want me to drop off a few printed cards this week?');
    const dm = text.plain(`Hi ${hi}! ${intro} I made a free review card for ${s} with a code that opens your Google listing, so customers can leave a review in one tap. Here's the picture. Want me to drop off a few printed ones?`);
    const walkin = text.plain(`Hi, I'm ${me || '[your name]'}. I made a free review card for ${s} with a code that opens your Google listing. Can I leave a few with you? Every customer gets asked the same way, and it takes them 30 seconds.`);
    const nudge1Text = `Did the review card for ${s} come through okay? Happy to change the colors or the wording. Want me to drop off a few printed cards this week?`;
    const nudge2Text = `Last note from me: the review card for ${s} is yours to keep either way. If the timing is wrong, no worries at all.`;
    const nudge1 = byEmail ? asEmail(nudge1Text) : asDm(nudge1Text);
    const nudge2 = byEmail ? asEmail(nudge2Text) : asDm(nudge2Text);
    const followText = `It's ${me || '[your name]'} again. I went ahead and made the free review card for ${s}: ${what}. It's attached. Use it either way, or I can drop off a few printed ones this week.`;
    const follow = byEmail ? asEmail(followText, gap) : asDm(followText);
    const answer = text.plain(`Hi ${owner || 'there'}, here's the review card for ${s}: ${what}. The picture and the print-ready page are attached. Could I stop by for 15 minutes on ${d1} or ${d2} to set it up at your counter?${me ? `\n\n${me}` : ''}`);

    const leads = (ctx && ctx.leads) || {};
    const own = !lead.pack || lead.pack === 'reviews';
    const factsFor = () => {
      const out = [];
      if (gap && domain) out.push(`No reviews or testimonials on ${domain} (checked ${day})`);
      else if (!site.checked) out.push('No website listed: the card and the receipt line do all the work');
      out.push(`Review card made ${day}`);
      return out.slice(0, 5);
    };
    let saved = false;
    let line = '';
    let messages = {};
    try {
      if (slot === 'first') {
        messages = { subject, email: first, dm, walkin, follow1: nudge1, follow2: nudge2 };
        if (!lead.inPipeline) {
          if (typeof leads.upsert === 'function') {
            const links = {};
            if (site.url || lead.website) links.website = site.url || lead.website;
            if (card.email) links.email = card.email;
            if (card.phone) links.phone = card.phone;
            if (card.link && card.link.kind === 'place') links.maps = card.link.url;
            await leads.upsert({
              key: lead.key || (domain ? `site:${domain}` : `lead:${text.slug(name, 40)}`),
              name,
              company: name,
              source: `Review card${card.sample ? ' (sample)' : ''}`,
              stage: 'found',
              links,
              note: text.clip(`Review card made ${day}.`, 200),
              data: { shop: card.shop || lead.shop || 'salons', city, cardMade: checked, sample: !!card.sample },
              msg: messages,
              facts: factsFor(),
              // Fit: a shop whose website shows no reviews needs the card most.
              score: gap ? 70 : site.checked ? 50 : 60,
              channel: card.email ? 'email' : domain ? 'site' : 'call',
            });
            saved = true;
            line = `Added ${name} to your Pipeline with the card email as the first message, so Do my day hands it to you.`;
          }
        } else if (own && typeof leads.upsert === 'function') {
          // The facts the shop was found with stay; a shop saved without any gets the card's.
          await leads.upsert({ key: lead.key, msg: messages, data: { ...(lead.data || {}), cardMade: checked }, ...((lead.facts || []).length ? {} : { facts: factsFor() }) });
          saved = true;
          line = `Saved the card email on ${name} in your Pipeline as the first message.`;
        } else if (typeof leads.update === 'function' && lead.id) {
          await leads.update(lead.id, { msg: messages });
          saved = true;
          line = `Saved the card email on ${name} in your Pipeline as the first message.`;
        }
      } else if (slot === 'follow1' || slot === 'follow2') {
        messages = { [slot]: follow };
        if (typeof leads.update === 'function' && lead.id) await leads.update(lead.id, { msg: messages });
        else if (own && typeof leads.upsert === 'function') await leads.upsert({ key: lead.key, msg: messages });
        saved = true;
        line = `Saved the card as ${name}'s next follow-up in your Pipeline.`;
      } else if (slot === 'answer') {
        messages = { answer };
        if (typeof leads.update === 'function' && lead.id) await leads.update(lead.id, { msg: messages });
        else if (own && typeof leads.upsert === 'function') await leads.upsert({ key: lead.key, msg: messages });
        saved = true;
        line = `Saved the card as your answer to ${name} in your Pipeline.`;
      } else if (slot === 'done') {
        line = `${name} has had 3 messages with no reply, so nothing was saved. Let this one go, or bring the card only if they write back.`;
      } else if (slot === 'won') {
        line = `${name} is already a client. Make their real kit with their own review link in "Set up a new client".`;
      } else {
        line = `${name} is marked lost in your Pipeline, so nothing was saved. Only send the card if they write to you first.`;
      }
    } catch (e) {
      saved = false;
      line = "Couldn't save to your Pipeline this time. Copy the messages from here.";
    }
    if (saved && (slot === 'first' || ((slot === 'follow1' || slot === 'follow2') && byEmail)) && /\[Your business address/.test(JSON.stringify(messages))) {
      line += ' Save your mailing address in Your business so the email can go out with one tap.';
    }
    return { slot, saved, line, name, messages, byEmail, attach: 'Attach the card picture (and the print-ready page) when you send it.' };
  },
  view(out) {
    const m = out.messages || {};
    const viaEmail = out.byEmail !== false;
    return views.blocks(
      views.text(out.line),
      m.email ? views.copy('First email with the card', `Subject: ${m.subject}\n\n${m.email}`) : null,
      m.dm ? views.copy('Instagram or Facebook message (send the picture with it)', m.dm) : null,
      m.walkin ? views.copy('Walk-in line (bring a printed card)', m.walkin) : null,
      m.follow1 && !m.email ? views.copy(viaEmail ? 'Follow-up email with the card' : 'Follow-up with the card', m.follow1) : null,
      m.follow2 && !m.email ? views.copy(viaEmail ? 'Follow-up email with the card' : 'Follow-up with the card', m.follow2) : null,
      m.answer ? views.copy('Your answer with the card', m.answer) : null,
      out.saved ? views.text(out.attach) : null,
    );
  },
};
