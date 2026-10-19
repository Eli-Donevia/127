// Delivery for pet care: the intake form a client fills in before the first visit (printable HTML,
// no scripts) and the visit card the client reads after every visit (a text and a small HTML card).
// In the "new client" run, before any visit has happened, the visit card waits for the first visit.

const { views, files, save, time, text } = require('../../_kit');
const C = require('../../_kit/common');

const { plain } = text;
const esc = files.esc;

const FORM_CSS = `body{font-family:Inter,Arial,sans-serif;color:#1d2433;margin:0;background:#fff}
main{max-width:760px;margin:0 auto;padding:28px}h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px;color:#2a7a5c;border-bottom:2px solid #e3efe9;padding-bottom:4px}
.row{display:flex;gap:10px;margin:8px 0}.f{flex:1;font-size:13px;color:#5b6475}.f span{display:block;border-bottom:1px solid #9aa3b2;height:22px}
p{font-size:14px;line-height:1.5}.box{background:#f3faf6;border-radius:8px;padding:10px 14px}
.card{max-width:420px;margin:24px auto;border:2px solid #2a7a5c;border-radius:14px;padding:20px}.card dt{font-weight:700;margin-top:8px}.card dd{margin:2px 0 0}`;

const SECTIONS = [
  ['Owner', ['Name', 'Phone', 'Email', 'Address', 'How I get in (key, code, lockbox)']],
  ['Emergency contact', ['Name', 'Phone', 'Relationship']],
  ['Vet', ['Clinic', 'Phone', 'Address', 'Nearest emergency vet']],
  ['Pet', ['Name', 'Kind and breed', 'Age', 'Weight', 'Microchip number']],
  ['Health', ['Vaccines up to date? (date)', 'Medications and doses', 'Allergies', 'Health issues to watch']],
  ['Food and water', ['What and how much', 'When', 'Treats allowed?', 'Where food is kept']],
  ['Walks', ['Leash or harness', 'Pulls, lunges or slips out?', 'Places to avoid', 'Off-leash ever? (default: never)']],
  ['Behavior', ['With other dogs', 'With people and kids', 'Scared of', 'Escape risk at doors or gates?']],
  ['Home', ['Alarm or cameras', 'Rooms that are off limits', 'Where supplies and bags are', 'Other pets in the home']],
];

function intakeHtml(N, me, pet) {
  const field = (l) => `<div class="f">${esc(l)}<span></span></div>`;
  const sections = SECTIONS.map(([title, fields]) => {
    const rows = [];
    for (let i = 0; i < fields.length; i += 2) rows.push(`<div class="row">${field(fields[i])}${fields[i + 1] ? field(fields[i + 1]) : ''}</div>`);
    return `<h2>${esc(title)}</h2>${rows.join('')}`;
  }).join('\n');
  const body = `<main>
<h1>New client intake${pet ? `: ${esc(pet)}` : ''}</h1>
<p>${esc(me.business || N.name)}${me.phone ? `. Questions: ${esc(me.phone)}` : ''}. Please fill this in before the first visit. It stays private and is used only to care for your pet.</p>
${sections}
<h2>Emergency care</h2>
<p class="box">If your pet needs urgent care and I can't reach you or your emergency contact, I may take your pet to your vet or the nearest emergency vet, and you agree to pay for that care. I will keep trying to reach you the whole time.</p>
<div class="row"><div class="f">Owner signature<span></span></div><div class="f">Date<span></span></div></div>
<h2>Meet and greet checklist (for me)</h2>
<p>Pet came to me on its own. Saw leash, harness and supplies. Tried doors, gates and the lock. Walked the usual route together. Keys or code handed over and not labeled with the address. Vet and emergency contact checked.</p>
</main>`;
  return files.htmlDoc({ title: `Intake form${pet ? ` for ${pet}` : ''}`, css: FORM_CSS, body, description: 'New client intake form' });
}

function visitHtml(card) {
  const rows = card.rows.map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd>`).join('');
  const body = `<div class="card"><h1>${esc(card.title)}</h1><p>${esc(card.when)}</p><dl>${rows}</dl><p>${esc(card.sign)}</p></div>`;
  return files.htmlDoc({ title: card.title, css: FORM_CSS, body, description: card.title });
}

function intakeTool(N) {
  return {
    name: 'petcare.make_intake_form',
    title: 'Client intake form',
    description: 'A printable intake form for a new client (owner, emergency contact, vet, health, food, walks, behavior, home, emergency care consent) with a meet and greet checklist.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: { type: 'object', properties: { pet: { type: 'string', maxLength: 40, title: "Pet's name (optional)" }, business: { type: 'string', maxLength: 80, title: 'Business name (optional)' }, phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' } } },
    output: { type: 'object', required: ['form'], properties: { form: { type: 'object' } } },
    async run(input, ctx) {
      const me = C.who(ctx, input);
      const pet = plain(input.pet || '');
      const form = await save.saveFile(ctx, save.fileName(pet || 'new client', 'intake form', '.html'), intakeHtml(N, me, pet));
      return { form, pet, sections: SECTIONS.map(([t]) => t) };
    },
    view(out) {
      return views.blocks(views.text(`Send this before the meet and greet, or fill it in together. Sections: ${out.sections.join(', ')}, emergency care.`), views.file(out.form, 'Intake form (print or send)'));
    },
  };
}

function visitCardTool(N) {
  return {
    name: 'petcare.write_visit_card',
    title: 'Visit card',
    description: 'The card a client reads after every visit: times, walk, potty, food and water, meds and notes, as a text to send with your photo and a small printable card.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: {
      type: 'object',
      required: ['pet'],
      properties: {
        pet: { type: 'string', maxLength: 40, title: "Pet's name" },
        owner: { type: 'string', maxLength: 60, title: "Owner's name (optional)" },
        time_in: { type: 'string', maxLength: 20, title: 'Time in', default: '12:00' },
        time_out: { type: 'string', maxLength: 20, title: 'Time out', default: '12:30' },
        walk: { type: 'string', maxLength: 200, title: 'Walk (route, length)', default: '30 minutes around the block' },
        potty: { type: 'string', maxLength: 80, title: 'Potty', default: 'Pee and poop' },
        food: { type: 'string', maxLength: 160, title: 'Food and water (optional)' },
        meds: { type: 'string', maxLength: 160, title: 'Meds given (optional)' },
        notes: { type: 'string', maxLength: 300, title: 'Notes (optional)' },
        new_client: { type: 'boolean', default: false, title: 'A new client (no visit yet)' },
      },
    },
    output: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, card: { type: 'object' }, skipped: { type: 'boolean' } } },
    async run(input, ctx) {
      const me = C.who(ctx, input);
      const pet = plain(input.pet || 'your pet');
      if (input.new_client === true || input.new_client === 'true') return { text: '', skipped: true, pet };
      const date = time.shortDate(time.today(ctx));
      const rows = [
        ['Walk', input.walk],
        ['Potty', input.potty],
        ['Food and water', input.food],
        ['Meds', input.meds],
        ['Notes', input.notes],
      ]
        .filter(([, v]) => v && String(v).trim())
        .map(([label, v]) => ({ label, value: plain(v) }));
      const when = `${date}, ${plain(input.time_in || '')} to ${plain(input.time_out || '')}`.replace(/, to $/, '');
      const sign = me.first || me.business || 'Your walker';
      const hi = input.owner ? `Hi ${plain(input.owner).split(' ')[0]}! ` : '';
      const msg = `${hi}${pet}'s visit card, ${when}. ${rows.map((r) => `${r.label}: ${r.value}.`).join(' ')} Photo attached. ${sign}`.replace(/\.\./g, '.');
      const card = { title: `${pet}'s visit card`, when, rows, sign };
      const file = await save.saveFile(ctx, save.fileName(pet, 'visit card', date, '.html'), visitHtml(card));
      return { text: msg, card, file };
    },
    view(out) {
      if (out.skipped) return views.blocks(views.text(`After ${out.pet}'s first visit, run this again (leave New client off) for the visit card to send with your photo.`));
      return views.blocks(views.copy('Visit card text (send with your photo)', out.text), views.table([{ key: 'label', label: 'Item' }, { key: 'value', label: 'Today' }], out.card.rows), views.file(out.file, 'Visit card (printable)'));
    },
  };
}

module.exports = { intakeTool, visitCardTool };
