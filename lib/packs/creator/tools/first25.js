// "Your first 25" for a creator: up to 15 people the member knows, each with a personal DM inviting them
// to follow along or join the email list and to say what they'd want to see, plus up to 10 communities:
// the groups the member names (a post draft for each that gives something useful first, with the
// group's rules to read first), filled with local libraries, community centers, bookshops and
// coworking spaces from OpenStreetMap (an ask to host a free talk). People and real places go to the
// Pipeline for Do my day; groups and made-up sample places don't. Nothing is posted or sent.

const { views, save, time, text, files, first25, crowd, brain } = require('../../_kit');
const K = require('../lib/creator');
const L = require('../lib/local');

const { plain } = text;
const { C, N } = K;

const DMS = [
  "Hey {greet}! I'm starting to post about {niche}{where}. You were one of the first people I thought of. Would you follow along and tell me what you'd want to see?{gift}",
  "Hi {greet}, small ask: I've started sharing {niche}{where}. Would you take a look and tell me honestly which post you'd want more of?{gift}",
  "Hey {greet}! Remember the {niche} posts I kept talking about? They're live{where}. If it sounds like your thing, I'd love you to follow along, and any idea for a post is welcome.{gift}",
];
const FOLLOW = 'Hi {greet}, no pressure on my last note. If you know one person who is into {niche}, passing it on would mean a lot.';
const GROUP_POST = [
  'Something that helped me with {niche}: {tip} Happy to answer questions in the comments.{gift}',
  'A question for this group: what was the hardest part of {niche} when you started? I post about it{where2}, and I want to cover what people here actually need.{gift}',
  'I put together {giftname} for anyone here getting into {niche}. No strings: comment and I will send it, or grab it from the link if the rules allow links.',
];
const PLACE_NOTE = "Hi {biz} team, I'm {me}, and I share {niche} with people{area}. A lot of your {their} {why}. Would you be open to letting me {ask}? There's no cost to you or anyone who comes, and I'll bring everything.";
const PLACE_WALK = "{who} I'm {me}, and I post about {niche}. I'd love to {ask} for your {their}. Who would I talk to about that?";

const PEOPLE_COLUMNS = [
  { key: 'name', label: 'Person' },
  { key: 'note', label: 'How you know them' },
  { key: 'message', label: 'DM to send' },
  { key: 'follow_up', label: 'Follow-up in 3 days' },
];

module.exports = {
  name: 'creator.list_first25',
  title: 'Your first 25 list',
  description: 'Up to 15 people you know with a personal DM each, plus up to 10 communities: the groups you name with a post draft for each, and local libraries, community centers, bookshops and coworking spaces from OpenStreetMap with a free-talk ask.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['osm'],
  credits: 2,
  timeoutSec: 240,
  input: {
    type: 'object',
    properties: {
      people: { type: 'string', format: 'textarea', maxLength: 4000, title: '15 people you know', description: 'One per line: name, how you know them, phone or email if you like. Nothing is pulled from your phone.' },
      niche: { type: 'string', maxLength: 80, title: 'What you post about', description: 'Like "growing houseplants in small apartments"' },
      groups: { type: 'string', format: 'textarea', maxLength: 2000, title: 'Groups you are already in (optional)', description: 'One per line: a subreddit, Facebook group, Discord, forum or club. We write a post for each.' },
      tip: { type: 'string', maxLength: 240, title: 'One useful tip you could share (optional)', description: 'Your words, for the group posts' },
      gift: { type: 'string', maxLength: 120, title: 'A free thing you give (optional)', description: 'Like "my one-page watering cheat sheet"' },
      handle: { type: 'string', maxLength: 60, title: 'Your handle (optional)', description: 'Like @leafandloft' },
      link: { type: 'string', maxLength: 200, title: 'Link to follow or subscribe (optional)' },
      city: { type: 'string', maxLength: 80, title: 'Your city and state (optional)', description: 'For local libraries and community spaces where you could give a free talk' },
      exclude: { type: 'string', maxLength: 4000, title: 'Names already contacted (optional)' },
    },
  },
  output: {
    type: 'object',
    required: ['people', 'groups', 'places', 'plan'],
    properties: { card: { type: 'object' }, people: { type: 'array' }, groups: { type: 'array' }, places: { type: 'array' }, rules: { type: 'array' }, own_post: { type: 'string' }, plan: { type: 'array' }, first: { type: ['object', 'null'] }, file: { type: 'object' }, notes: { type: 'array' }, saved: { type: 'integer' }, sample: { type: 'boolean' } },
  },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const today = time.today(ctx);
    const skip = new Set(C.linesOf(input.exclude, 300).map((s) => s.toLowerCase()));
    const where = m.handle ? ` on ${m.handle}` : '';
    const giftName = plain(input.gift || '');
    const gift = giftName ? ` I also made ${giftName}, free, if you want it.` : '';
    const link = m.link ? `\n\n${m.link}` : '';
    const tidy = (s) => s.replace(/\.\.(?!\.)/g, '.');
    const people = first25
      .parsePeople(input.people, { max: 40 })
      .filter((p) => !skip.has(p.name.toLowerCase()))
      .slice(0, 15)
      .map((p, i) => ({
        ...p,
        message: `${tidy(C.fill(DMS[(i + p.name.length) % DMS.length], { greet: p.greet, niche: m.niche, where, gift }))}${link}`,
        follow_up: C.fill(FOLLOW, { greet: p.greet, niche: m.niche }),
      }));

    const tip = input.tip ? C.sentence(plain(input.tip)) : '';
    const groups = C.linesOf(input.groups, 10).map((g, i) => {
      let t = GROUP_POST[i % GROUP_POST.length];
      if (t.includes('{tip}') && !tip) t = GROUP_POST[1];
      if (t.includes('{giftname}') && !giftName) t = GROUP_POST[1];
      return { group: g, post: tidy(C.fill(t, { niche: m.niche, tip, gift: giftName && !t.includes('{giftname}') ? ` I also made ${giftName}, free: comment if you want it.` : '', giftname: giftName, where2: where })) };
    });

    const notes = [];
    const room = Math.max(0, 10 - groups.length);
    const types = N.partners.map((t) => ({ ...t, ask: t.ask.replace('{topic}', m.niche) }));
    const found = m.city && room ? await L.findLocal(ctx, types, { city: m.city, limit: room, skip }) : { places: [], held: false, notes: [] };
    const places = found.places.map((b) => {
      const t = types.find((x) => x.id === b.type) || types[0];
      const vars = { biz: b.name, me: m.first || 'a local creator', niche: m.niche, area: m.city ? ` around ${m.city.split(',')[0]}` : '', their: t.their_customers, why: t.why, ask: t.ask, who: first25.whoToAsk(t) };
      return { ...b, kind: t.label, message: C.fill(PLACE_NOTE, vars), walk_in: C.fill(PLACE_WALK, vars) };
    });
    const anySample = places.some((b) => b.sample);
    if (anySample) notes.push('Places marked (sample) are made up so you can see how it works. They are never saved to your Pipeline.');
    if (anySample && found.held) notes.push(L.places().HELD_NOTE);
    if (!groups.length) notes.push('Add the groups you are already in (a subreddit, a Facebook group, a Discord) to get a post for each. Only ones you belong to: a new account posting links reads as spam.');
    if (!m.city && room) notes.push('Add your city to list libraries and community spaces where you could give a free talk.');
    if (!people.length) notes.push('Add up to 15 people you know, one per line, to get a personal DM for each.');

    const rows = people.map((p, i) => C.personLead(p, { dm: p.message, follow1: p.follow_up, subject: `I started posting about ${m.niche}`, source: 'Creator: first 25', score: 90 - Math.min(15, i) }));
    for (const b of places) {
      if (b.sample) continue;
      const t = types.find((x) => x.id === b.type) || types[0];
      rows.push(C.placeLead(b, { ...t, give: 'bring everything and share the event with my followers' }, { me: { first: m.first, business: m.name }, what: `free talks on ${m.niche}`, area: m.city.split(',')[0] || 'town', source: 'Creator: first 25 (OpenStreetMap)', weight: 2 }));
    }
    const saved = await C.saveRows(ctx, rows);
    if (input.niche) await brain.remember(ctx, 'niche', plain(input.niche));

    const own_post = tidy(`I'm starting something: I'll be posting about ${m.niche}${where}. If that's your kind of thing, follow along, and tell me the one question you'd want answered first.${giftName ? ` Comment and I'll send you ${giftName}, free.` : ''}`);
    const day = (n) => time.shortDate(time.addDays(today, n));
    const plan = [
      `Today: send the ${people.length || 15} DMs. Ask what they'd want to see, not for a favor.`,
      groups.length ? `${day(1)}: read each group's rules, then post in ${Math.min(3, groups.length)} of them. Answer every comment.` : `${day(1)}: write down the groups you are in and run this again to get a post for each.`,
      places.length ? `${day(2)}: call or visit the places about a free talk. Bring one page on what you'd cover.` : `${day(2)}: post your own "I'm starting" post (below).`,
      `${day(7)}: count who followed or subscribed, and ask the first 5 what they want next.`,
    ];
    const csvRows = [
      ...people.map((p) => ({ who: 'Person you know', name: p.name, contact: p.phone || p.email || '', message: p.message, follow: p.follow_up, on: time.addDays(today, 3) })),
      ...groups.map((g) => ({ who: 'Group you are in', name: g.group, contact: '', message: g.post, follow: 'Read the rules first. Answer every comment.', on: time.addDays(today, 1) })),
      ...places.map((b) => ({ who: `Place: ${b.kind}`, name: b.name, contact: [b.phone, b.website, b.address].filter(Boolean).join(' '), message: b.message, follow: b.walk_in, on: time.addDays(today, 2) })),
    ];
    const credit = L.places().creditLine(places);
    if (credit) csvRows.push({ who: credit });
    const file = await save.saveFile(ctx, save.fileName('creator', 'first 25', today, '.csv'), files.csv(csvRows, [
      { key: 'who', label: 'Who' },
      { key: 'name', label: 'Name' },
      { key: 'contact', label: 'Contact' },
      { key: 'message', label: 'Message or post' },
      { key: 'follow', label: 'Follow-up or in-person line' },
      { key: 'on', label: 'When' },
    ]));
    return {
      card: C.crowdCard(ctx, N),
      people,
      groups,
      places,
      rules: K.RULES.groups,
      own_post,
      plan,
      first: people[0] ? { to: people[0].name, text: people[0].message } : groups[0] ? { to: groups[0].group, text: groups[0].post } : null,
      file,
      notes,
      saved,
      sample: anySample,
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Your first 25', `${out.people.length + out.groups.length + out.places.length} ready`, `${out.people.length} people, ${out.groups.length} groups, ${out.places.length} places${out.saved ? `. ${out.saved} saved to your Pipeline` : ''}`),
      crowd.blocks(out.card),
      out.first ? views.copy(`First message: to ${out.first.to}`, out.first.text) : null,
      out.people.length ? views.table(PEOPLE_COLUMNS, out.people) : null,
      out.groups.length ? views.text(`Before you post in a group: ${out.rules.join(' ')}`) : null,
      ...out.groups.map((g) => views.copy(`Post for ${g.group}`, g.post)),
      out.places.length ? views.table([{ key: 'name', label: 'Place' }, { key: 'kind', label: 'Kind' }, { key: 'address', label: 'Address' }, { key: 'message', label: 'Message' }, { key: 'walk_in', label: 'In person' }], out.places) : null,
      views.copy('Your own "I\'m starting" post', out.own_post),
      views.text(`Plan: ${out.plan.join(' ')}`),
      out.notes.length ? views.text(out.notes.join(' ')) : null,
      L.places().creditBlocks(out.places),
      views.file(out.file, 'Your first 25 (CSV)'),
    );
  },
};
