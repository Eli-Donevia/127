// The kitchen intake form a new client fills in before the first cook day (printable HTML, no
// scripts): who eats at home, every food allergy against the FDA's 9 major allergens, the way they
// eat (a preference to cook to, never diet advice), foods they avoid, the kitchen and storage, and
// groceries, with a signed line that the allergy list is complete. Plus the member's own kitchen
// visit checklist. The form is blank and its answers stay on paper, so 127 never stores them: the
// week menu takes only the foods to leave out, never who has an allergy or how serious it is (L73).

const { views, files, save, text } = require('../../_kit');
const C = require('../../_kit/common');
const M = require('../lib/menu');

const { plain, clip } = text;
const esc = files.esc;
const S = M.STORAGE;

const FORM_CSS = `@page{size:letter;margin:0.5in}
body{font-family:Inter,Arial,sans-serif;color:#1d2433;margin:0;background:#fff}
main{max-width:760px;margin:0 auto;padding:24px}h1{font-size:24px;margin:0 0 4px}
h2{font-size:16px;margin:22px 0 6px;color:#24603a;border-bottom:2px solid #dcebe1;padding-bottom:4px}
.row{display:flex;gap:10px;margin:8px 0}.f{flex:1;font-size:13px;color:#5b6475}.f span{display:block;border-bottom:1px solid #9aa3b2;height:22px}
p{font-size:14px;line-height:1.5}.box{background:#f1f8f3;border-radius:8px;padding:10px 14px}
.ticks{display:flex;flex-wrap:wrap;gap:6px 16px;margin:8px 0;font-size:14px}.ticks span:before{content:"";display:inline-block;width:12px;height:12px;border:2px solid #5b6475;border-radius:3px;margin-right:6px;vertical-align:-2px}
.muted{color:#5b6475;font-size:12px;line-height:1.45}
@media (max-width:600px){main{padding:16px}.row{flex-direction:column;gap:4px}}
@media print{h2{break-after:avoid}.row{break-inside:avoid}}`;

const field = (l) => `<div class="f">${esc(l)}<span></span></div>`;
const rows = (fields) => {
  const out = [];
  for (let i = 0; i < fields.length; i += 2) out.push(`<div class="row">${field(fields[i])}${fields[i + 1] ? field(fields[i + 1]) : ''}</div>`);
  return out.join('');
};
const ticks = (items) => `<div class="ticks">${items.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`;

const SECTIONS = ['Client', 'Household', 'Food allergies', 'The way you eat', 'Foods you avoid and love', 'Your kitchen', 'Groceries and reheating', 'Signature'];

function intakeHtml(me, client) {
  const allergens = S.allergens.map((a) => a.label.charAt(0).toUpperCase() + a.label.slice(1));
  const fda = S.sources.fda_allergens;
  const body = `<main>
<h1>Kitchen intake${client ? `: ${esc(client)}` : ''}</h1>
<p>${esc(me.business || 'Your personal chef')}${me.phone ? `. Questions: ${esc(me.phone)}` : ''}. Please fill this in before the first cook day. It stays private and is used only to plan and cook your dinners.</p>
<h2>Client</h2>
${rows(['Name', 'Phone', 'Email', 'Address', 'How I get in on cook day (someone home, key, code)', 'Best time to reach you'])}
<h2>Household</h2>
${rows(['People eating at home (adults, and kids with ages)', 'Dinners a week', 'Cook day and time that work', 'Who to text on cook day'])}
<h2>Food allergies</h2>
<p>Tick every allergy anyone at home has, and who has it. These are the 9 major food allergens named by the FDA.</p>
${ticks([...allergens, 'Other', 'None'])}
${rows(['Other allergies or intolerances', 'Who has each one', 'How serious (for example hives, swelling, trouble breathing)', 'Can it be in the kitchen at all, or only kept out of their food?', 'Does anyone carry an epinephrine auto-injector? Where is it kept?', 'Their doctor or allergist (optional)'])}
<p class="box">I leave every allergen you list out of the recipes and read every package label for it when I shop. Traces can still be in a home kitchen, so tell me if even a trace is a problem.</p>
<h2>The way you eat</h2>
${ticks(M.DIETS.map((d) => (d === 'Anything' ? 'Anything goes' : d)).concat(['Other']))}
<p>This is how I cook for you, not diet advice. If a doctor or dietitian gave anyone a meal plan, please share it and I'll cook from that plan.</p>
${rows(['Other, in your words', 'Anything else I should know'])}
<h2>Foods you avoid and love</h2>
${rows(['Foods you avoid or dislike', 'Favorite dinners', 'Spice level (mild, medium, hot)', 'Foods the kids will eat'])}
<h2>Your kitchen</h2>
${ticks(['Oven works', 'Stove works', 'Microwave', 'Sheet pans', 'Large pot', 'Skillet', 'Baking dish', 'Food thermometer (I bring one)'])}
${rows(['Room in the fridge (shelves)', 'Room in the freezer', 'Containers: mine or yours?', 'Where trash and recycling go'])}
<h2>Groceries and reheating</h2>
${ticks(['I shop and bill groceries at cost with the receipt', 'You shop from my list'])}
${rows(['Store or brands you like', 'Who reheats dinners, and how (microwave or oven)'])}
<h2>Signature</h2>
<p class="box">I've listed every food allergy in my household, and I'll tell you before the next cook day if anything changes. I understand you cook in my kitchen with the groceries on our list, and label every container with its eat-by date, reheat steps and allergens.</p>
<div class="row"><div class="f">Signature<span></span></div><div class="f">Date<span></span></div></div>
<h2>Kitchen visit checklist (for me)</h2>
${ticks([
  'Allergies read back and confirmed',
  `Fridge at ${S.fridge_f}°F or below (appliance thermometer)`,
  `Freezer at ${S.freezer_f}°F or below`,
  'Oven and stove tried',
  'Pans, containers and storage room seen',
  'Groceries and receipts agreed',
  'Cook day, time and entry agreed',
])}
<p class="muted">Allergen list: ${esc(fda.publisher)}, ${esc(fda.title)} (${esc(fda.url)}), checked ${esc(fda.checked)}. Fridge and freezer temperatures: ${esc(S.sources.fda_storing.publisher)}, ${esc(S.sources.fda_storing.title)}${/[.?!]$/.test(S.sources.fda_storing.title) ? '' : '.'}</p>
</main>`;
  return files.htmlDoc({ title: `Kitchen intake${client ? ` for ${client}` : ''}`, css: FORM_CSS, body, description: 'Kitchen intake form for a new meal prep client' });
}

function intakeTool() {
  return {
    name: 'mealprep.make_intake_form',
    title: 'Kitchen intake form',
    description: "A printable intake form for a new client (household, every food allergy against the FDA's 9 major allergens, the way they eat, foods they avoid, kitchen and storage, groceries and a signature), with your kitchen visit checklist.",
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: {
      type: 'object',
      properties: {
        client: { type: 'string', maxLength: 80, title: "Client's name (optional)" },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
      },
    },
    output: { type: 'object', required: ['form', 'sections'], properties: { form: { type: 'object' }, client: { type: 'string' }, sections: { type: 'array' } } },
    async run(input, ctx) {
      const me = C.who(ctx, input);
      const client = clip(plain(input.client || ''), 80);
      const form = await save.saveFile(ctx, save.fileName(client || 'new client', 'kitchen intake', '.html'), intakeHtml(me, client));
      return { form, client, sections: SECTIONS };
    },
    view(out) {
      return views.blocks(
        views.text(`Send this before the kitchen visit, or fill it in together. Sections: ${M.list(out.sections.map((s) => s.toLowerCase()))}. Keep it on paper: the week menu needs only the foods to leave out, not who has an allergy or how serious it is.`),
        views.file(out.form, 'Kitchen intake form (print or send)'),
      );
    },
  };
}

module.exports = { intakeTool, intakeHtml, SECTIONS };
