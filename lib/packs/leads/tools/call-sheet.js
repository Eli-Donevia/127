// A printable call sheet for today: call-backs that are due first, then businesses in the Pipeline not
// called yet, then fresh ones from OpenStreetMap when the Pipeline runs short (each read on its own
// website, ranked for what the member sells and saved to the Pipeline with channel 'call'). Each
// business gets an opener built on a fact from its own website, the voicemail, boxes to tick for how
// the call went, and the sheet ends with answers to what people usually say. Calls are dialed by
// hand, never followed by a cold text (FCC rules in data/rules.json).

const { text, time, places, outreach, views, save, files } = require('../../_kit');
const { serviceOf, senderOf, cityOf } = require('../lib/services');
const V = require('../lib/visits');
const S = require('../lib/sheets');

const OUTCOMES = ['No answer', 'Left voicemail', 'Talked', 'Wants the sample'];

function since(row) {
  const at = Date.parse(row.lastTouchAt || row.sentAt || '');
  return Number.isFinite(at) ? new Date(at).toISOString().slice(0, 10) : null;
}

// How a day sounds on the phone: "yesterday", "on Wednesday", "on October 12".
function spoken(day, today) {
  if (!day) return 'last week';
  const diff = Math.round((Date.parse(today) - Date.parse(day)) / V.DAY);
  if (diff <= 0) return 'earlier today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `on ${time.WEEKDAYS[time.weekdayOf(day)]}`;
  return `on ${time.longDate(day).replace(/, \d{4}$/, '')}`;
}

// "Monday, October 19"
const dayTitle = (d) => `${time.WEEKDAYS[time.weekdayOf(d)]}, ${time.longDate(d).replace(/, \d{4}$/, '')}`;

// A second try by phone, for a business already sent a first message.
function callBack({ lead, svc, sender, when }) {
  const d = outreach.draft({ lead, service: svc, sender, cityName: places.cityShort(lead.city || sender.city) });
  const me = sender.first || '[your name]';
  const biz = d.name;
  const say = d.cites && d.cites[0] ? `${d.cites[0]} ` : '';
  return {
    say: text.plain(`Hi, this is ${me}. Is this the owner or the manager? ... Thanks, I'll be quick. I reached out ${when} with an idea for ${biz}, so I'm following up by phone. ${say}${d.freeThing} Where's the best place to send it?`),
    voicemail: text.plain(`Hi, this is ${me}, following up on my note from ${when} about ${biz}. ${d.freeThing} My number is [your number]. Thanks!`),
    fact: d.facts[0] || null,
  };
}

// What people usually say on a cold call, and a short answer to each (prices and days in brackets).
function answers({ lead, service, sender }) {
  const r = Object.fromEntries(outreach.replies({ lead, service, sender }).map((x) => [x.id, x.text]));
  return [
    { say: '"The owner isn\'t here."', answer: "No problem. What's their name, and when is a good time to catch them? (Write it next to Call back.)" },
    { say: '"Just email it to me."', answer: "Sure. What's the best email? I'll send it today, short, with the free sample." },
    { say: '"How much is it?"', answer: r.price },
    { say: '"Who is this?"', answer: r.who },
    { say: '"We already have someone."', answer: r.covered },
    { say: '"Not right now."', answer: r.later },
    { say: '"Don\'t call us again."', answer: "Understood, I won't call again. Have a good day. (Tick Don't call again, and mark them Lost in your Pipeline.)" },
  ];
}

const RULES = [
  'Dial each number by hand. No autodialers and no recorded messages.',
  'Call while they are open, and skip their busiest hour (lunch for restaurants, first thing for trades).',
  'Say your name and why you are calling in the first two sentences.',
  "Never text these numbers. They didn't ask for texts.",
  "If anyone asks you not to call, don't call again: tick the box and mark them Lost.",
];

module.exports = {
  name: 'leads.call_sheet',
  title: 'Make your call sheet',
  description: 'A printable list of businesses to call today: phone number, an opener built on their own website, the voicemail and boxes to tick for how each call went. Starts with your Pipeline (call-backs first) and finds more on OpenStreetMap when it runs short.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['osm'],
  credits: 5,
  timeoutSec: 150,
  input: {
    type: 'object',
    properties: {
      service: { type: 'string', title: 'What you sell', description: 'For example "websites" or "short videos"' },
      category: { type: 'string', title: 'Who to call (optional)', description: 'Like "dentists". Empty: everyone in your Pipeline with a phone number' },
      city: { type: 'string', title: 'City (optional)', description: "Used to find more when your Pipeline runs short. Empty: your profile's city" },
      calls: { type: 'integer', title: 'How many calls', minimum: 5, maximum: 30, default: 15 },
      your_name: { type: 'string', title: 'Your first name (optional)', maxLength: 40 },
      your_phone: { type: 'string', title: 'Your number for voicemails (optional)', maxLength: 30 },
    },
    required: ['service'],
  },
  output: {
    type: 'object',
    properties: { calls: { type: 'integer' }, callbacks: { type: 'integer' }, fromPipeline: { type: 'integer' }, fresh: { type: 'integer' }, saved: { type: 'integer' }, sheet: { type: 'object' }, csv: { type: 'object' }, entries: { type: 'array' }, notes: { type: 'array' } },
    required: ['calls', 'sheet', 'csv', 'entries'],
  },
  async run(input, ctx) {
    const service = serviceOf(input.service);
    const sender = senderOf(ctx, input);
    const me = { first: sender.first, phone: text.clip(text.oneLine(input.your_phone || ''), 30) };
    const want = Math.max(5, Math.min(30, input.calls || 15));
    const now = ctx.now();
    const city = cityOf(ctx, input);
    const notes = [];

    // 1. The Pipeline: follow-ups that are due, then businesses not called yet (best fit first).
    const { list, rows } = await V.pipelineBusinesses(ctx, { category: input.category, now });
    const callable = list.filter((x) => V.phoneOf(x.lead));
    const due = callable.filter((x) => x.due).sort((a, b) => String(a.row.nextAt || '').localeCompare(String(b.row.nextAt || '')));
    const first = callable.filter((x) => !x.due).sort((a, b) => (b.lead.score || 0) - (a.lead.score || 0));
    const picked = [...due, ...first].slice(0, want);
    const today = time.today(ctx);
    const entries = picked.map((x) => {
      const svc = x.row.data && x.row.data.service ? serviceOf(x.row.data.service) : service;
      const d = outreach.draft({ lead: x.lead, service: svc, sender, cityName: places.cityShort(x.lead.city || city) });
      const stored = x.row.data || {};
      const when = spoken(since(x.row), today);
      const cb = x.due ? callBack({ lead: x.lead, svc, sender, when }) : null;
      return {
        key: x.lead.key,
        name: x.lead.name,
        phone: V.phoneOf(x.lead),
        kind: x.due ? 'callback' : 'first',
        since: x.due ? since(x.row) : null,
        fact: (cb && cb.fact) || d.facts[0] || (x.row.facts && x.row.facts[0]) || null,
        say: V.personal(cb ? cb.say : stored.call || d.call, me),
        voicemail: V.personal(cb ? cb.voicemail : stored.voicemail || d.voicemail, me),
        website: x.lead.website,
        map: (x.row.links && x.row.links.maps) || V.mapLinkOf(x.lead),
        hours: V.hoursText(x.lead.hours || (x.lead.site && x.lead.site.hours)),
        source: x.lead.source,
        sample: !!x.lead.sample,
        ...(x.lead.searchBy ? { searchBy: x.lead.searchBy } : {}),
      };
    });

    // 2. Fresh businesses when the Pipeline runs short (needs who to call and a city).
    let fresh = { leads: [] };
    let saved = 0;
    if (entries.length < want) {
      if (input.category && city) {
        fresh = await V.freshLeads(ctx, { category: input.category, city, need: want - entries.length, rows, service, want: 'phone' });
        const items = fresh.leads.map((lead) => ({ lead, draft: outreach.draft({ lead, service, sender, cityName: places.cityShort(lead.city || city) }) }));
        for (const { lead, draft } of items) {
          entries.push({
            key: lead.key,
            name: lead.sample ? lead.name : draft.name || lead.name,
            phone: V.phoneOf(lead),
            kind: 'new',
            since: null,
            fact: draft.facts[0] || null,
            say: V.personal(draft.call, me),
            voicemail: V.personal(draft.voicemail, me),
            website: lead.website,
            map: V.mapLinkOf(lead),
            hours: V.hoursText(lead.hours || (lead.site && lead.site.hours)),
            source: lead.source,
            sample: !!lead.sample,
            ...(lead.searchBy ? { searchBy: lead.searchBy } : {}),
          });
        }
        saved = await V.saveFresh(ctx, items, { service, channel: 'call' });
        if (fresh.note) notes.push(fresh.note);
        if (entries.length < want) notes.push(`Found ${entries.length} with a phone number. OpenStreetMap doesn't list a number for every business, so try a nearby city or another kind of business for more.`);
      } else if (!entries.length) {
        throw new Error('Your Pipeline has no businesses with a phone number yet. Say who to call (like "dentists") and your city, and this finds them.');
      } else notes.push(`Your Pipeline had ${entries.length} businesses with a phone number. Say who to call and your city to fill the rest of the sheet.`);
    }
    if (!entries.length) throw new Error(`No ${places.categoryOf(input.category).many} with a phone number turned up near ${places.cityShort(city)}. Try a nearby city or another kind of business.`);

    // 3. The sheet, the spreadsheet and what to say back.
    const lead0 = picked[0] ? picked[0].lead : fresh.leads[0];
    const sample = entries.some((e) => e.sample);
    const callbacks = entries.filter((e) => e.kind === 'callback').length;
    // The answers are for any business on the sheet: no name in them, the city in short.
    const anyLead = { ...(lead0 || {}), name: '', siteName: '', source: 'web', city: places.cityShort((lead0 && lead0.city) || city) };
    const html = sheetHtml({ entries, today, service, city, answers: answers({ lead: anyLead, service, sender }), sample, me });
    const base = save.fileName('call sheet', service.label, time.shortDate(today));
    const sheet = await save.saveFile(ctx, `${base}.html`, html);
    const credit = places.creditLine(entries);
    const cols = [
      { key: 'order', label: '#' },
      { key: 'type', label: 'Type' },
      { key: 'name', label: 'Business' },
      { key: 'phone', label: 'Phone' },
      { key: 'fact', label: 'What we saw' },
      { key: 'say', label: 'What to say' },
      { key: 'voicemail', label: 'Voicemail' },
      { key: 'hours', label: 'Hours' },
      { key: 'website', label: 'Website' },
      { key: 'map', label: 'Map' },
      { key: 'outcome', label: 'How it went' },
      { key: 'call_back', label: 'Call back on' },
      { key: 'notes', label: 'Notes' },
    ];
    const csvRows = entries.map((e, i) => ({ order: i + 1, type: { callback: 'Call back', first: 'First call', new: 'New' }[e.kind], name: e.name, phone: e.phone, fact: e.fact || '', say: e.say, voicemail: e.voicemail, hours: e.hours, website: e.website || '', map: e.map || '', outcome: '', call_back: '', notes: '' }));
    const csv = await save.saveFile(ctx, `${base}.csv`, files.csv(credit ? csvRows.concat([{ order: credit }]) : csvRows, cols, { bom: true }));
    ctx.log(`Call sheet: ${entries.length} businesses (${callbacks} call-backs, ${fresh.leads.length} new)`);
    return {
      calls: entries.length,
      callbacks,
      fromPipeline: picked.length,
      fresh: fresh.leads.length,
      saved,
      sheet,
      csv,
      date: today,
      entries: entries.map((e) => ({ name: e.name, phone: e.phone, kind: e.kind, fact: e.fact, say: e.say, voicemail: e.voicemail, source: e.source, ...(e.searchBy ? { searchBy: e.searchBy } : {}) })),
      notes,
      sample,
    };
  },
  view(out) {
    const kinds = { callback: 'Call back', first: 'First call', new: 'New' };
    const first = out.entries[0];
    return views.blocks(
      views.metric('Calls on your sheet', out.calls, [out.callbacks && `${out.callbacks} call-backs`, out.fromPipeline - out.callbacks > 0 && `${out.fromPipeline - out.callbacks} from your Pipeline`, out.fresh && `${out.fresh} new`].filter(Boolean).join(', ')),
      views.file(out.sheet, 'Your call sheet (print it or keep it open)'),
      views.file(out.csv, 'The same list as a spreadsheet (CSV)'),
      first ? views.copy(`#1 ${first.name}: what to say`, first.say) : null,
      views.table([{ key: 'n', label: '#', format: 'number' }, { key: 'name', label: 'Business' }, { key: 'phone', label: 'Phone' }, { key: 'kind', label: 'Type' }, { key: 'fact', label: 'What we saw' }], out.entries.map((e, i) => ({ n: i + 1, name: e.name, phone: e.phone, kind: kinds[e.kind], fact: e.fact || '' })), 10),
      out.saved ? views.text(`Added ${out.saved} new businesses to your Pipeline. Mark each one Contacted once you've called.`) : views.text("Mark each one in your Pipeline after you call: Contacted, Replied if they want the sample, Lost if they said no."),
      (out.notes || []).map((n) => views.text(n)),
      places.creditBlocks(out.entries),
      (out.notes || []).some((n) => /sample/i.test(n)) ? null : views.sampleNote(out, 'These businesses')
    );
  },
};

function card(e, i) {
  const tag = e.kind === 'callback' ? `<span class="tag due">Call back${e.since ? `: reached out ${S.esc(time.shortDate(e.since))}` : ''}</span>` : e.kind === 'new' ? '<span class="tag new">New</span>' : '<span class="tag">First call</span>';
  const tel = String(e.phone || '').replace(/[^\d+]/g, '');
  const links = [e.website && `<a href="${S.esc(e.website)}">Website</a>`, e.map && `<a href="${S.esc(e.map)}">Map</a>`, e.hours && `Hours: ${S.esc(e.hours)}`].filter(Boolean).join(' · ');
  return `<div class="card"><div class="top"><span class="n">${i + 1}</span><div class="grow"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 14px;align-items:baseline"><h3>${S.esc(e.name)}</h3><a class="phone" href="tel:${S.esc(tel)}">${S.esc(e.phone)}</a></div>${tag}${e.fact ? `<p class="fact"><b>What we saw:</b> ${S.esc(e.fact)}</p>` : ''}
<div class="say"><b>Say</b>${S.esc(e.say)}</div><div class="say vm"><b>Voicemail</b>${S.esc(e.voicemail)}</div>${links ? `<div class="links">${links}</div>` : ''}
<div class="ticks">${OUTCOMES.map(S.tick).join('')}${S.tickLine('Call back')}${S.tick('Not interested')}${S.tick("Don't call again")}</div><div class="notes">Notes <i class="line"></i></div></div></div></div>`;
}

function sheetHtml({ entries, today, service, city, answers: ans, sample, me }) {
  const callbacks = entries.filter((e) => e.kind === 'callback').length;
  const minutes = Math.round((entries.length * 3) / 5) * 5;
  const pills = [`${entries.length} calls`, callbacks ? `${callbacks} call-backs first` : null, `About ${minutes} minutes`, me.phone ? null : 'Add your number to the voicemails'].filter(Boolean);
  const how = `<div class="grid"><div class="card"><h3>How each call goes</h3><ol class="steps"><li>Ask for the owner or the manager.</li><li>Say who you are and why you're calling, in one breath.</li><li>Mention the one thing you saw on their website.</li><li>Offer the free sample and ask where to send it.</li></ol></div><div class="card"><h3>Before you dial</h3><ul class="plain">${RULES.map((r) => `<li>${S.esc(r)}</li>`).join('')}</ul></div></div>`;
  const list = entries.map(card).join('');
  const said = `<div class="grid">${ans.map((a) => `<div class="card"><h3>${S.esc(a.say)}</h3><p style="margin-top:6px">${S.esc(a.answer)}</p></div>`).join('')}</div>`;
  const after = `<div class="card"><h3>After your calls</h3><ul class="plain"><li>Mark each business in your Pipeline: Contacted when you talked or left a voicemail, Replied when they want the sample, Lost when they said no.</li><li>Send the free sample within 2 days to everyone who said yes.</li><li>No answer twice? Send an email instead, or walk in.</li></ul></div>`;
  const body = `<h2>How it works</h2>${how}<h2>Your calls</h2>${list}<h2>If they say</h2>${said}${after}`;
  const footer = `${places.creditHtml(entries)}${sample ? '<p>Sample businesses: made up to show how the sheet works. Their numbers are not real.</p>' : ''}<p>Made ${S.esc(time.longDate(today))}. Every fact comes from the business's own website.</p>`;
  return S.page({ title: `Call sheet: ${dayTitle(today)}`, eyebrow: `Call sheet · ${service.label}`, h1: `${entries.length} calls for ${dayTitle(today)}`, sub: `${service.label}${city ? ` in ${places.cityShort(city)}` : ''}. Call-backs first, then the best fits. Tick a box after each call.`, pills, body, footer });
}
