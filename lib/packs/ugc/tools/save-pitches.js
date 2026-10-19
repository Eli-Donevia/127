// After the member approves the pitches: each brand's approved DM, email and follow-ups go on its row
// in the Pipeline, in the slot Do my day hands out next (contract 13). Not contacted yet: they are
// the first message. Contacted already: the concept preview becomes the next follow-up. Replied or a
// call booked: it is the answer. A brand that isn't in the Pipeline yet is added with its store
// facts, score and channel. The concept preview's file is named on the row, to attach when sending.

const kit = require('../../_kit');
const { text, views, time } = kit;
const U = require('../lib/ugc');
const talk = require('../../_kit/talk');

// The approved texts for one brand, by the labels write_pitches gave them.
function approvedFor(items, name) {
  const pick = (suffix) => {
    const it = (items || []).find((x) => x && String(x.label || '') === `${name}: ${suffix}`);
    return it ? String(it.text == null ? '' : it.text).trim() : '';
  };
  const rawEmail = pick('email');
  const m = rawEmail.match(/^Subject:\s*(.+)\n+([\s\S]*)$/);
  return { dm: pick('DM'), subject: m ? text.oneLine(m[1]) : '', email: m ? m[2].trim() : rawEmail, follow1: pick('follow-up day 4'), follow2: pick('follow-up day 10') };
}

module.exports = {
  name: 'ugc.save_pitches',
  title: 'Save the pitches',
  description: "Puts each brand's approved DM, email and follow-ups on its row in your Pipeline as the next message Do my day hands you, or adds the brand with its store facts when it isn't there yet.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    required: ['brands', 'items'],
    properties: {
      brands: { type: 'array', items: { type: 'object' } },
      items: { type: 'array', items: { type: 'object' } },
      concept: { type: ['object', 'boolean'] },
      name: { type: 'string', maxLength: 60 },
      business: { type: 'string', maxLength: 80 },
      myAddress: { type: 'string', maxLength: 160 },
    },
  },
  output: { type: 'object', required: ['saved', 'lines'], properties: { saved: { type: 'integer' }, lines: { type: 'array' }, slots: { type: 'array' } } },
  timeoutSec: 30,
  async run(input, ctx) {
    const today = time.today(ctx);
    const br = kit.brain.brainOf(ctx, {});
    const me = text.plain(input.name || br.firstName || '') || '[your name]';
    const footer = `\n\n${[me, text.plain(input.business || br.name || ''), text.plain(input.myAddress || br.address || '') || kit.outreach.ADDRESS_HOLD].filter(Boolean).join('\n')}\n\n${kit.outreach.OPT_OUT}`;
    const c = input.concept;
    const video = c && typeof c === 'object' && c.video ? c.video : null;
    const brands = (input.brands || []).filter((b) => b && b.name && b.domain).slice(0, 5);
    const rows = await talk.pipelineRows(ctx);
    const leads = (ctx && ctx.leads) || {};
    const slots = [];
    const copies = [];
    let saved = 0;
    for (let i = 0; i < brands.length; i++) {
      const b = brands[i];
      const a = approvedFor(input.items, b.name);
      if (!a.dm && !a.email) {
        slots.push({ brand: b.name, slot: 'skipped', line: `Nothing approved for ${b.name}, so nothing changed for them.` });
        continue;
      }
      const concept = i === 0 && !!video;
      const short = U.shortTitle(b.product ? b.product.title : b.name);
      const lead = talk.leadOf(talk.findIn(rows, { name: b.name, website: b.url }), { name: b.name, website: b.url });
      const row = lead.inPipeline ? rows.find((r) => r && r.id === lead.id) || {} : {};
      const touches = Number(row.touches) || 0;
      const stage = lead.inPipeline ? lead.stage || 'found' : 'new';
      const channel = lead.channel || b.channel || 'site';
      const own = !lead.pack || lead.pack === 'ugc';
      const attach = concept ? { conceptMade: today, concept: { id: video.id || null, name: video.name || '' } } : {};
      const note = concept ? `Attach ${video.name || 'the concept preview'} from your Library when you send it.` : '';
      // The concept as a follow-up or an answer, in the form their channel takes.
      // The approved email's own sign-off and opt-out (with any edits), else the standard one (D28).
      const sign = (a.email.match(/\n\n([^\n]+(\n[^\n]+)*)\n\nP\.S\.[\s\S]*$/) || [])[0] || footer;
      const conceptLine = `I went ahead and made a 15-second concept for ${short}, from your product page and only for you. It's attached. If you like the direction, I can film the real one once I have the product.`;
      const conceptEmail = `Hi ${b.name} team,\n\n${conceptLine}${sign}`;
      const conceptDm = `Hi again! ${conceptLine.replace("It's attached.", "Want me to send it here?")}`;
      let slot = 'first';
      if (stage === 'contacted') slot = touches >= 3 ? 'done' : touches >= 2 ? 'follow2' : 'follow1';
      else if (stage === 'replied' || stage === 'call') slot = 'answer';
      else if (stage === 'won' || stage === 'lost') slot = stage;
      let line = '';
      try {
        if (stage === 'new') {
          const contact = b.contact ? { reachable: true, ...b.contact } : null;
          const msgs = { dm: a.dm, subject: a.subject, email: a.email, follow1: a.follow1, follow2: a.follow2, follow1Email: a.follow1, follow2Email: a.follow2, concept };
          const out = U.pipelineRow({ ...b, conceptMade: concept ? today : '' }, msgs, contact);
          out.data = { ...out.data, ...attach };
          if (note) out.note = text.clip(`${note} ${out.note || ''}`, 1000);
          if (typeof leads.upsert === 'function') {
            await leads.upsert(out);
            saved++;
            line = `Added ${b.name} to your Pipeline with your approved ${channelName(out.channel)} as the first message.`;
          }
        } else if (slot === 'first') {
          const msg = { dm: a.dm, subject: a.subject, email: a.email, follow1: a.follow1, follow2: a.follow2 };
          if (own && typeof leads.upsert === 'function') await leads.upsert({ key: lead.key, msg, data: { ...attach }, ...(note ? { note } : {}) });
          else if (typeof leads.update === 'function' && lead.id) await leads.update(lead.id, { msg, ...(note ? { note } : {}) });
          saved++;
          line = `Saved your approved pitch on ${b.name}. Do my day hands it to you as the first message${concept ? ', with the concept to attach' : ''}.`;
        } else if ((slot === 'follow1' || slot === 'follow2') && concept) {
          const text1 = channel === 'ig' ? conceptDm : conceptEmail;
          if (own && typeof leads.upsert === 'function') await leads.upsert({ key: lead.key, msg: { [slot]: text1 }, data: { ...attach }, note });
          else if (typeof leads.update === 'function' && lead.id) await leads.update(lead.id, { msg: { [slot]: text1 }, note });
          saved++;
          line = `You've already written to ${b.name}, so the concept goes out as your next follow-up.`;
        } else if (slot === 'answer' && concept) {
          const answer = `Here's the 15-second concept I made for ${short}, from your product page and only for you. If you like the direction, I can film the real one once I have the product. Want to talk through the details this week?`;
          if (own && typeof leads.upsert === 'function') await leads.upsert({ key: lead.key, msg: { answer }, data: { ...attach }, note });
          else if (typeof leads.update === 'function' && lead.id) await leads.update(lead.id, { msg: { answer }, note });
          saved++;
          line = `${b.name} already replied, so the concept goes with your answer.`;
        } else if (slot === 'done') line = `${b.name} already had 3 messages from you. Send the concept only if they write back.`;
        else if (slot === 'won') line = `${b.name} is already a client. Use the concept as the brief's first idea.`;
        else if (slot === 'lost') line = `${b.name} is marked lost in your Pipeline, so nothing was saved. Don't send it.`;
        else line = `${b.name} is in your Pipeline (${talk.stageLabel(stage)}). Nothing new to save without a concept.`;
      } catch {
        line = `Couldn't save ${b.name} to your Pipeline this time. Copy the messages from the step above.`;
      }
      slots.push({ brand: b.name, slot, line, stage });
      // What to send now, as approved: the first message in their channel, or the concept follow-up or answer.
      if (slot === 'first' || stage === 'new') {
        const to = (b.contact && b.contact.email) || lead.email || '';
        if (channel === 'email' || (!a.dm && a.email)) copies.push({ label: `${b.name}: email${to ? ` to ${to}` : ''}`, text: a.email, email: to ? { to, subject: a.subject } : null, note });
        else copies.push({ label: `${b.name}: ${channel === 'ig' ? 'Instagram DM' : 'message for their contact page or a DM'}`, text: a.dm || a.email, email: null, note });
      } else if (concept && (slot === 'follow1' || slot === 'follow2' || slot === 'answer')) {
        const to = lead.email || '';
        const t = slot === 'answer' ? `Here's the 15-second concept I made for ${short}, from your product page and only for you. If you like the direction, I can film the real one once I have the product. Want to talk through the details this week?` : channel === 'ig' ? conceptDm : conceptEmail;
        copies.push({ label: `${b.name}: the concept ${slot === 'answer' ? 'with your answer' : 'as your next follow-up'}`, text: t, email: to && channel !== 'ig' ? { to, subject: `A 15-second concept for ${short}` } : null, note });
      }
    }
    ctx.log(`Saved ${saved} approved pitch${saved === 1 ? '' : 'es'} to your Pipeline`);
    return { saved, slots, lines: slots.map((s) => s.line), copies };
  },
  view(out) {
    return views.blocks(
      ...(out.lines || []).map((l) => views.text(l)),
      ...(out.copies || []).flatMap((c) => [views.copy(c.label, c.text, c.email || undefined), c.note ? views.text(c.note) : null]),
    );
  },
};

function channelName(ch) {
  return ch === 'ig' ? 'Instagram DM' : ch === 'email' ? 'email' : 'message';
}
