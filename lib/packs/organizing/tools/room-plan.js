// The signature tool: one room, the client's problem items and the hours booked give time per zone, a
// supply list priced from dated retailer listings, a donation and recycling checklist ("check your
// city" where rules vary) and a before-and-after photo plan, as a printable sheet plus the text to
// send the day before. The math lives in lib/plan.js and the data in data/room-plan.json.

const { views, save, time, text, money } = require('../../_kit');
const C = require('../../_kit/common');
const P = require('../lib/plan');
const { sheetHtml } = require('../lib/sheet');

const { plain, clip } = text;
const { usd } = money;

const range = (lo, hi) => (lo === hi ? usd(lo) : `${usd(lo)} to ${usd(hi)}`);
const hoursText = (h) => String(Math.round(Number(h) * 100) / 100);
const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

// The text the member sends the day before: what to expect, and the photo question, asked first.
function prepText(o) {
  const hi = o.greet ? `Hi ${o.greet}` : 'Hi';
  const sign = o.sign ? ` ${o.sign}` : '';
  return plain(
    `${hi}, I'm looking forward to ${o.when || 'our visit'}! No need to tidy or buy anything before I come. We'll sort the ${o.room} together first, then measure, and buy only what fits. If you can, think about where you'd like donations to go. One question: may I take before and after photos of the space? They're only for us to see the progress, and I'd never share them without your written okay. A quick yes or no is perfect.${sign}`,
  );
}

function checklistText(room, donation) {
  return [`Donation and recycling checklist: ${room}`, ...donation.map((d) => `${d.title}: ${d.line}`)].join('\n');
}

function photoText(photo) {
  return [
    photo.permission,
    ...photo.steps.map((s, i) => `${i + 1}. ${s}`),
    `Shots, before and after from the same spot: ${photo.shots.join('; ')}.`,
  ].join('\n');
}

function roomPlanTool(N) {
  return {
    name: `${N.id}.plan_room`,
    title: 'Room plan and supply list',
    description:
      "For one room, the client's problem items and the hours booked give time per zone, a supply list with price ranges from dated retailer listings, a donation and recycling checklist and a before-and-after photo plan, as a printable sheet and a text for the day before.",
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      required: ['room'],
      properties: {
        room: { type: 'string', enum: P.ROOMS, default: 'Kitchen', title: 'Room' },
        problems: {
          type: 'string',
          maxLength: 2000,
          format: 'textarea',
          title: "Problem items, in the client's words (optional)",
          description: 'One per line, like "Tupperware lids that never match" or "Old paint cans by the door". Left empty, the plan covers the room basics.',
        },
        hours: { type: 'number', minimum: 1, maximum: 12, default: 3, title: 'Hours booked for this visit' },
        people: { type: 'integer', minimum: 1, maximum: 3, default: 1, title: 'Organizers on the job', description: 'You alone is 1. With a helper, each zone takes about half as long.' },
        client: { type: 'string', maxLength: 120, title: "Client's name (optional)" },
        when: { type: 'string', maxLength: 60, title: 'Visit day and time (optional)', description: 'Like "Tuesday, Oct 27 at 9am"' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
      },
    },
    output: {
      type: 'object',
      required: ['room', 'zones', 'supplies', 'donation', 'photo_plan', 'sheet'],
      properties: {
        room: { type: 'string' },
        client: { type: 'string' },
        hours: { type: 'number' },
        people: { type: 'integer' },
        time: { type: 'object' },
        zones: { type: 'array' },
        later: { type: 'array' },
        unmatched: { type: 'array' },
        typical: { type: 'array' },
        supplies: { type: 'object' },
        donation: { type: 'array' },
        photo_plan: { type: 'object' },
        prep: { type: 'string' },
        sheet: { type: 'object' },
        saved: { type: 'boolean' },
        checked: { type: 'string' },
      },
    },
    async run(input, ctx) {
      const room = P.roomOf(input.room);
      if (!room) throw new Error(`Pick a room from the list: ${P.ROOMS.join(', ')}.`);
      const me = C.who(ctx, input);
      const client = clip(plain(input.client || ''), 120);
      const greet = C.firstWord(client);
      const when = clip(plain(input.when || ''), 60);
      const lines = P.linesOf(plain(input.problems || ''));
      const plan = P.planTime(room, lines, { hours: input.hours, people: input.people });
      const supplies = P.supplyList(plan);
      const donation = P.donationList(room, lines);
      const photo = P.photoPlan(plan);
      const typical = P.typicalFor(room);
      const today = time.today(ctx);
      const html = sheetHtml({
        room: room.label,
        client,
        when,
        date: time.longDate(today),
        business: me.business || 'Home organizing',
        color: /^#[0-9a-f]{6}$/i.test(String(N.color || '')) ? N.color : C.PALETTE[N.id],
        sort: P.DATA.sort,
        time: plan,
        typical,
        supplies,
        donation,
        photo_plan: photo,
      });
      const sheet = await save.saveFile(ctx, save.fileName(greet || room.label, 'room plan', '.html'), html);
      const prep = prepText({ greet, when, room: room.label.toLowerCase(), sign: me.first || me.business });
      // On the client's own row in this pack's Pipeline, so the next visit starts from this plan.
      let saved = false;
      if (client) {
        const lead = await C.findLead(ctx, N.id, client);
        if (lead && C.isOwn(lead, N.id)) {
          const r = await C.saveLead(ctx, N.id, lead, {
            data: {
              plan: {
                room: room.label,
                hours: plan.hours,
                on: today,
                today: plan.zones.map((z) => z.name),
                next: plan.later.map((z) => z.name),
                supplies: range(supplies.low, supplies.high),
              },
            },
          });
          saved = !!r.saved;
        }
      }
      return {
        room: room.label,
        client,
        hours: plan.hours,
        people: plan.people,
        time: plan,
        zones: plan.zones,
        later: plan.later,
        unmatched: plan.unmatched,
        typical,
        supplies,
        donation,
        photo_plan: photo,
        prep,
        sheet,
        saved,
        checked: P.DATA.checked,
      };
    },
    view(out) {
      const t = out.time;
      const S = out.supplies;
      const rows = [
        { time: t.walk.time, name: t.walk.name, minutes: t.walk.minutes, focus: 'Ask about photos first' },
        ...out.zones.map((z) => ({ time: z.time, name: z.name, minutes: z.clock, focus: z.focus_text })),
        { time: t.wrap.time, name: t.wrap.name, minutes: t.wrap.minutes, focus: 'Donations go where the client chose' },
      ];
      const team = out.people > 1 ? ` with ${out.people} organizers` : '';
      const later = out.later.length
        ? `Next visit, about ${hoursText(t.later_hours)} more ${t.later_hours === 1 ? 'hour' : 'hours'}: ${out.later.map((z) => (z.from_list ? `${z.name} (on their list)` : z.name)).join('; ')}.`
        : 'Every zone in this room fits in this visit.';
      const listings = S.items.reduce((n, it) => n + it.listings, 0);
      const where = [...new Set(S.items.flatMap((it) => it.where))];
      const supplyRows = S.items.map((it) => ({ item: it.unit === 'each' ? it.item : `${it.item} (${it.unit})`, qty: it.qty, each: range(it.each_low, it.each_high), total: range(it.low, it.high) }));
      const kit = `Your own kit, not billed: ${S.kit.map((k) => `${k.item.toLowerCase()} ${range(k.each_low, k.each_high)}`).join(', ')}; ${S.kit_unpriced.join(', ').toLowerCase()}.`;
      const typical = out.typical.map((x) => x.says).join(' ');
      const links = [];
      const seen = new Set();
      for (const s of [...out.typical, ...out.donation.flatMap((d) => d.sources), ...out.photo_plan.sources]) {
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        links.push(views.link(`${s.publisher}: ${s.says}`, s.url));
      }
      return views.blocks(
        views.metric('Room plan', out.room, `${hoursText(out.hours)} ${out.hours === 1 ? 'hour' : 'hours'}${team}: ${plural(out.zones.length, 'zone')} today${out.later.length ? `, ${out.later.length} for the next visit` : ''}`),
        out.saved ? views.text(`Saved on ${out.client}'s row in your Pipeline.`) : null,
        views.table(
          [
            { key: 'time', label: 'Clock' },
            { key: 'name', label: 'Zone' },
            { key: 'minutes', label: 'Minutes', format: 'number' },
            { key: 'focus', label: 'In their words' },
          ],
          rows,
          20,
        ),
        views.text(later),
        out.unmatched.length ? views.text(`Not matched to a zone, so look at these on the walk-through: ${out.unmatched.join('; ')}.`) : null,
        views.text(`Typical time, as a check: ${typical}`),
        views.table(
          [
            { key: 'item', label: 'Supply' },
            { key: 'qty', label: 'Qty', format: 'number' },
            { key: 'each', label: 'Each' },
            { key: 'total', label: 'Total' },
          ],
          supplyRows,
          20,
        ),
        views.text(
          `Supplies: ${range(S.low, S.high)} before tax, from ${listings} listings at ${text.list(where)}, checked ${S.checked}. Buy after the sort and the measuring, only what fits, at cost with receipts.${S.unpriced.length ? ` Also: ${S.unpriced.join(', ')} (check current rates).` : ''}`,
        ),
        views.text(kit),
        views.copy('Text the day before (asks about photos first)', out.prep),
        views.copy('Donation and recycling checklist', checklistText(out.room, out.donation)),
        views.copy('Before-and-after photo plan', photoText(out.photo_plan)),
        views.file(out.sheet, 'Room plan (print it or share it)'),
        links,
      );
    },
  };
}

module.exports = { roomPlanTool };
