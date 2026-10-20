// The signature tool: the intake's household size, the way they eat, the foods to leave out and foods
// they avoid become a week of dinners, a shopping list by store section, a cook day schedule, printable
// labels (reheat steps, what each dish contains, eat-by and thaw dates from the FDA chart) and the menu
// text for the client. Cooking happens in the client's kitchen; the plan says, sourced, that selling
// meals cooked at home falls under state cottage food and health rules. Planning lives in lib/menu.js.
// Legal L73: the foods to leave out are just foods, and nothing the run shows or saves calls them
// allergies. They stay in the run and its files: never in the Pipeline, and memory keeps dish ids only.

const { views, files, save, time, text, brain, color } = require('../../_kit');
const C = require('../../_kit/common');
const M = require('../lib/menu');

const { plain, clip } = text;
const esc = files.esc;
const { usd } = require('../../_kit/money');

const S = M.STORAGE;
const COOK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CONTAINERS = ['One per dinner', 'One per serving'];
const MEMORY_KEY = 'menus';
const MAX_CLIENTS = 20;
const MAX_MEMORY = 3500; // ctx.remember keeps 4 KB a key

const src = (id) => S.sources[id];
const sourceList = (ids) => [...new Set(ids)].map(src).filter(Boolean);

function colors(ctx, input) {
  const typed = String(input.color || '').trim();
  const brand = ctx && ctx.brain && ctx.brain.packs && ctx.brain.packs.brand && ctx.brain.packs.brand.palette && ctx.brain.packs.brand.palette.primary;
  const seed = color.isHex(typed) ? typed : color.isHex(brand) ? brand : 'fresh';
  const p = color.palette(seed);
  // Headings and the label border are text-sized, so they get body-text contrast on white.
  return { ...p, heading: color.ensureContrast(p.primary, '#ffffff', 4.5) };
}

function css(p) {
  return `@page{size:letter;margin:0.5in}
body{font-family:Inter,Arial,sans-serif;color:#1d2433;margin:0;background:#fff}
main{max-width:780px;margin:0 auto;padding:24px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:26px 0 8px;color:${p.heading};border-bottom:2px solid ${p.line};padding-bottom:4px}
h3{font-size:14px;margin:14px 0 4px;text-transform:uppercase;letter-spacing:.04em;color:#5b6475}
p{line-height:1.5}.muted{color:#5b6475;font-size:14px}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid #e3e6eb;padding:7px 6px;text-align:left;vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#5b6475}
.box{background:${p.surface};border-radius:10px;padding:12px 14px;margin:12px 0;line-height:1.5}
ul{padding-left:20px;line-height:1.55}ul.check{list-style:none;padding-left:0;margin:4px 0 10px}
ul.check li{position:relative;padding:6px 0 6px 28px;border-bottom:1px solid #eef0f3}
ul.check li:before{content:"";position:absolute;left:2px;top:9px;width:13px;height:13px;border:2px solid #5b6475;border-radius:3px}
.why{color:#5b6475;font-size:13px}.flag{font-size:13px;font-weight:600;color:${p.heading}}
footer{margin-top:26px;font-size:12px;color:#5b6475;line-height:1.5}footer a{color:#5b6475}
@media (max-width:600px){main{padding:16px}table,tbody,tr,td{display:block;width:100%}thead{display:none}tr{border-bottom:1px solid #e3e6eb;padding:8px 0}td{border:0;padding:2px 0}td[data-k]:before{content:attr(data-k) ": ";font-weight:600}}
@media print{h2{break-after:avoid}tr,li{break-inside:avoid}}`;
}

function labelCss(p) {
  return `@page{size:letter;margin:0.4in}
body{font-family:Inter,Arial,sans-serif;color:#1d2433;margin:0;background:#fff}
.intro{max-width:780px;margin:16px auto 0;padding:0 16px;font-size:14px;color:#5b6475;line-height:1.5}
.sheet{display:grid;grid-template-columns:1fr 1fr;gap:0.18in;padding:0.2in;max-width:8in;margin:0 auto}
.label{border:2px solid ${p.heading};border-radius:12px;padding:12px 14px;break-inside:avoid;page-break-inside:avoid;display:flex;flex-direction:column;gap:4px;min-height:2.5in}
.label h2{font-size:17px;line-height:1.2;margin:0}.meta{font-size:12px;color:#5b6475}
.store{font-weight:700;font-size:14px;line-height:1.35}.freezer .store{color:${p.heading}}
.reheat,.contains,.extra{font-size:13px;line-height:1.35}.contains{font-weight:600}
.foot{margin-top:auto;font-size:11px;color:#5b6475;line-height:1.35}
@media (max-width:600px){.sheet{grid-template-columns:1fr;padding:12px}}
@media print{.intro{display:none}}`;
}

const cell = (k, v) => `<td data-k="${esc(k)}">${esc(v)}</td>`;

function menuRows(plan) {
  return plan.rows.map((r) => ({
    day: `${r.weekday.slice(0, 3)}, ${M.shortDate(r.date).replace(/^\w+, /, '')}`,
    dinner: r.recipe.name,
    store: r.store === 'fridge' ? 'Fridge' : 'Freezer',
    when: r.store === 'fridge' ? `Eat by ${M.shortDate(r.eat_by)}` : `Move to the fridge the night of ${M.shortDate(r.thaw_on)}`,
    contains: /^Contains: /.test(M.containsLine(r)) ? M.containsLine(r).replace(/^Contains: /, '').replace(/\.$/, '') : M.containsLine(r),
    without: r.dropped.length ? `Made without ${M.list(r.dropped.map((x) => x.toLowerCase()))}` : '',
  }));
}

function planHtml({ plan, me, client, cookDate, p, rows, intro, perServing, notes }) {
  const head = [me.business || 'Cook day plan', client ? `for ${client}` : ''].filter(Boolean).join(' ');
  // One "read the label" line per store section when every item in it needs one, else per item.
  const sections = [];
  const bySection = [];
  for (const s of plan.shopping) {
    const last = bySection[bySection.length - 1];
    if (last && last.name === s.section) last.items.push(s);
    else bySection.push({ name: s.section, items: [s] });
  }
  for (const sec of bySection) {
    const checks = [...new Set(sec.items.map((s) => s.label_check))];
    const whole = checks.length === 1 && checks[0];
    sections.push(`<h3>${esc(sec.name)}</h3>${whole ? `<p class="flag">Read every label in this section for: ${esc(whole)}</p>` : ''}<ul class="check">`);
    for (const s of sec.items) {
      const flag = !whole && s.label_check ? `<br><span class="flag">Read the label for: ${esc(s.label_check)}</span>` : '';
      sections.push(`<li><strong>${esc(s.item)}</strong>, ${esc(s.amount)} <span class="why">(for ${esc(s.for)})${s.pantry ? ' Pantry staple: check what they have first.' : ''}</span>${flag}</li>`);
    }
    sections.push('</ul>');
  }
  const temps = [...new Set(plan.rows.map((r) => M.tempLine(r.recipe)).filter(Boolean))];
  const ids = ['fda_chart', 'fda_handling', 'fda_chill', 'cdc_prevention', 'cdc_leftovers', 'fda_allergens', ...S.cottage.sources];
  const body = `<main>
<p class="muted">${esc(head)}</p>
<h1>Cook day plan: ${esc(M.shortDate(cookDate))}</h1>
<p class="muted">${esc(intro)}</p>
<div class="box">${[
    plan.diet !== 'Anything' ? `Cooked the way they eat: ${esc(plan.diet.toLowerCase())}.` : '',
    plan.leave_list.length ? `Left out: ${esc(plan.leave_list.join(', '))}.` : '',
    notes ? `Notes: ${esc(notes)}` : '',
    ...plan.notes.map(esc),
  ].filter(Boolean).join('<br>')}</div>
<h2>Menu</h2>
<table><thead><tr><th>Day</th><th>Dinner</th><th>Store</th><th>Eat by or thaw</th><th>Contains</th></tr></thead><tbody>
${rows.map((r) => `<tr>${cell('Day', r.day)}<td data-k="Dinner">${esc(r.dinner)}${r.without ? `<br><span class="why">${esc(r.without)}</span>` : ''}</td>${cell('Store', r.store)}${cell('Eat by or thaw', r.when)}${cell('Contains', r.contains)}</tr>`).join('\n')}
</tbody></table>
${perServing ? `<p class="muted">${esc(perServing)}</p>` : ''}
<h2>Shopping list</h2>
<p class="muted">${esc(S.lines.labels)}</p>
${sections.join('\n')}
<h2>Cook day schedule</h2>
<p class="muted">Start ${esc(plan.schedule.start)}, done about ${esc(plan.schedule.end)}. Times are estimates: shopping comes first.</p>
<table><thead><tr><th>Time</th><th>Step</th><th>Notes</th></tr></thead><tbody>
${plan.schedule.steps.map((s) => `<tr>${cell('Time', s.time)}${cell('Step', s.step)}${cell('Notes', s.detail)}</tr>`).join('\n')}
</tbody></table>
<h2>Food safety on cook day</h2>
<ul>${[S.lines.fridge, S.lines.hands, S.lines.separate, ...temps, S.lines.chill, S.lines.reheat, S.lines.thaw, S.lines.freezer_quality].map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
<h2>Selling meals cooked at home</h2>
<p>${esc(S.cottage.line)}</p>
<footer>Sources, checked ${esc(S.checked)}: ${sourceList(ids).map((s) => `${esc(s.publisher)}, <a href="${esc(s.url)}">${esc(s.title)}</a>`).join('; ')}. Fridge times use the short end of each range. Freezer times are for best quality.</footer>
</main>`;
  return files.htmlDoc({ title: `Cook day plan, ${M.shortDate(cookDate)}`, css: css(p), body, description: 'Week menu, shopping list, cook day schedule and food safety steps' });
}

function labelsHtml({ labels, me, p, cookDate }) {
  const foot = [me.business, me.phone].filter(Boolean).join(', ');
  const body = `<p class="intro">Labels for the cook day on ${esc(M.shortDate(cookDate))}: ${labels.length} in all, two across. Print on full-page sticker paper, or on plain paper and tape them on. ${esc(S.lines.check_packages)} Storage times from the FDA Refrigerator and Freezer Storage Chart; reheat to 165°F from CDC.</p>
<div class="sheet">
${labels
  .map(
    (l) => `<div class="label${l.freezer ? ' freezer' : ''}">
<h2>${esc(l.name)}</h2>
<div class="meta">${esc(`${l.serves}. ${l.dinner}. ${l.cooked}.`)}</div>
<div class="store">${esc(l.store)}</div>
<div class="reheat">Reheat: ${esc(l.reheat)}</div>
<div class="contains">${esc(l.contains)}</div>
${l.without || l.pack ? `<div class="extra">${esc([l.without, l.pack].filter(Boolean).join(' '))}</div>` : ''}
<div class="foot">Check 165°F with a food thermometer.${foot ? ` ${esc(foot)}` : ''}</div>
</div>`,
  )
  .join('\n')}
</div>`;
  return files.htmlDoc({ title: `Labels, ${M.shortDate(cookDate)}`, css: labelCss(p), body, description: 'Container labels with reheat steps, allergens and eat-by dates' });
}

function clientText({ plan, greet, cookDate, me }) {
  const lines = plan.rows.map((r) => `${r.weekday.slice(0, 3)}: ${r.recipe.name}${r.store === 'freezer' ? ` (from the freezer: move it to the fridge ${M.shortDate(r.thaw_on).split(',')[0]} night)` : ''}`);
  const left = plan.leave_list;
  return plain(
    [
      `Hi ${greet}! Here's the menu for your cook day on ${M.shortDate(cookDate)}:`,
      ...lines,
      `Every container gets a label with the eat-by date and reheat steps.${left.length ? ` I left out ${M.list(left)}, and I'll read every package label when I shop.` : ''}`,
      `Want to swap anything? I'll shop that morning.${me.first ? ` ${me.first}` : ''}`,
    ].join('\n'),
  );
}

const SHOP_COLUMNS = [
  { key: 'section', label: 'Section' },
  { key: 'item', label: 'Item' },
  { key: 'amount', label: 'Amount' },
  { key: 'for', label: 'For' },
  { key: 'label_check', label: 'Read the label for' },
  { key: 'got', label: 'Got it' },
];

function weekMenuTool(N) {
  return {
    name: 'mealprep.plan_week_menu',
    title: 'Week menu and labels',
    description: "A week of dinners that fits the household size, the way they eat and the foods to leave out, split between fridge and freezer by the FDA storage times, with a shopping list by store section, a cook day schedule, printable labels (reheat steps, what each dish contains, eat-by dates) and the menu text for the client. It cooks to preferences and doesn't replace a meal plan from a doctor or dietitian.",
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        client: { type: 'string', maxLength: 120, title: "Client's name (optional)" },
        household: { type: 'integer', minimum: 1, maximum: 10, default: 4, title: 'People eating at home' },
        dinners: { type: 'integer', minimum: 2, maximum: 6, default: 4, title: 'Dinners to cook', description: 'From the cook day on. Later dinners go in the freezer.' },
        diet: { type: 'string', enum: M.DIETS, default: 'Anything', title: 'The way they eat', description: 'What the client told you: a preference to cook to, not diet advice' },
        leave_out: { type: 'string', format: 'textarea', maxLength: 600, title: 'Foods to leave out (allergies included)', description: 'Like "peanuts, shellfish". Just the foods, no reasons. Who has an allergy and how serious it is stay on your paper intake.' },
        avoid: { type: 'string', maxLength: 400, title: 'Foods they avoid or dislike (optional)', description: 'Like "mushrooms, cilantro, no dairy". Nothing about their health.' },
        likes: { type: 'string', maxLength: 400, title: 'Favorites (optional)', description: 'Like "curry, tacos, salmon". Picked first when they fit.' },
        cook_day: { type: 'string', enum: COOK_DAYS, default: 'Monday', title: 'Cook day', description: 'The next one from today' },
        start: { type: 'string', maxLength: 10, default: '10:00', title: 'Start time', description: 'Like "10:00" or "1:30pm", after shopping' },
        containers: { type: 'string', enum: CONTAINERS, default: CONTAINERS[0], title: 'Containers' },
        notes: { type: 'string', format: 'textarea', maxLength: 600, title: 'Anything else from the intake (optional)', description: 'Printed on the cook day plan, like "dinner is at 5:30" or "extra freezer in the garage". Nothing about their health.' },
        price: { type: 'string', maxLength: 10, title: 'Your price per cook day (optional)', description: 'Left empty, the price from your Offer builder' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
        color: { type: 'string', maxLength: 7, title: 'Brand color (optional)', description: 'Like #2f6b3a' },
      },
    },
    output: {
      type: 'object',
      required: ['menu', 'shopping', 'schedule', 'text', 'plan', 'labels', 'list'],
      properties: {
        menu: { type: 'array' },
        shopping: { type: 'array' },
        schedule: { type: 'array' },
        text: { type: 'string' },
        plan: { type: 'object' },
        labels: { type: 'object' },
        list: { type: 'object' },
        notes: { type: 'array' },
        start: { type: 'string' },
        end: { type: 'string' },
        diet: { type: 'string' },
        leave_out: { type: 'array' },
        safety: { type: 'array' },
        cottage: { type: 'string' },
        cook_date: { type: 'string' },
        household: { type: 'integer' },
        dinners: { type: 'integer' },
        fridge: { type: 'integer' },
        freezer: { type: 'integer' },
        label_count: { type: 'integer' },
        per_serving: { type: 'string' },
        sources: { type: 'array' },
      },
    },
    async run(input, ctx) {
      const me = C.who(ctx, input);
      const client = clip(plain(input.client || ''), 80);
      const greet = C.firstWord(client) || 'there';
      const today = time.today(ctx);
      const day = COOK_DAYS.includes(input.cook_day) ? input.cook_day : 'Monday';
      const cookDate = time.nextWeekday(today, time.WEEKDAYS.indexOf(day), { after: true });
      const memory = brain.packMemory(ctx, N.id)[MEMORY_KEY] || {};
      const who = C.norm(client).slice(0, 40) || 'household';
      const last = memory[who] && memory[who].on !== cookDate ? memory[who].ids || [] : [];
      const plan = M.planWeek({
        household: input.household,
        dinners: input.dinners,
        diet: input.diet,
        leave_out: input.leave_out,
        avoid: input.avoid,
        likes: input.likes,
        start: input.start,
        cookDate,
        seed: `${who}|${cookDate}`,
        recent: last,
        perServing: input.containers === 'One per serving',
      });
      if (!plan.rows.length) throw new Error('No dinner on the list fits the foods to leave out, the way they eat and the foods they avoid. Check the intake answers, or plan this week with dishes of your own.');
      const p = colors(ctx, input);
      const rows = menuRows(plan);
      const fridge = plan.rows.filter((r) => r.store === 'fridge').length;
      const freezer = plan.rows.length - fridge;
      const intro = `For ${plan.household} ${plan.household === 1 ? 'person' : 'people'}, ${plan.rows.length} dinners: ${fridge} in the fridge${freezer ? `, ${freezer} in the freezer` : ''}.`;
      // Their own price over the servings this week, before groceries (no sourced claim, just their math).
      const offer = C.offerOf(N, { price: C.priceOf(ctx, N, input) });
      const servings = plan.rows.length * plan.household;
      const perServing = `At your price of ${usd(offer.price)} per cook day, these ${servings} servings come to about ${usd(Math.round((offer.price / servings) * 100) / 100, { cents: true })} a serving, before groceries.`;
      const name = client || me.business || 'household';
      const notes = clip(plain(input.notes || '').trim(), 600);
      const planFile = await save.saveFile(ctx, save.fileName(name, 'cook day plan', cookDate, '.html'), planHtml({ plan, me, client, cookDate, p, rows, intro, perServing, notes }));
      const labelFile = await save.saveFile(ctx, save.fileName(name, 'labels', cookDate, '.html'), labelsHtml({ labels: plan.labels, me, p, cookDate }));
      const csvRows = plan.shopping.map((s) => ({ ...s, got: '' }));
      const listFile = await save.saveFile(ctx, save.fileName(name, 'shopping list', cookDate, '.csv'), files.csv(csvRows, SHOP_COLUMNS));
      // Remembered so next week's menu puts these dishes at the back of the line.
      const keep = Object.entries({ ...memory, [who]: { on: cookDate, ids: plan.rows.map((r) => r.recipe.id) } })
        .filter(([, m]) => m && Array.isArray(m.ids))
        .sort((a, b) => String(b[1].on).localeCompare(String(a[1].on)))
        .slice(0, MAX_CLIENTS);
      while (keep.length > 1 && JSON.stringify(Object.fromEntries(keep)).length > MAX_MEMORY) keep.pop();
      await brain.remember(ctx, MEMORY_KEY, Object.fromEntries(keep));
      const ids = ['fda_chart', 'fda_handling', 'cdc_prevention', 'cdc_leftovers', 'fda_allergens', ...S.cottage.sources];
      return {
        menu: rows,
        shopping: plan.shopping.map((s) => ({ section: s.section, item: s.item, amount: s.amount, for: s.for, label_check: s.label_check })),
        schedule: plan.schedule.steps,
        start: plan.schedule.start,
        end: plan.schedule.end,
        text: clientText({ plan, greet, cookDate, me }),
        plan: planFile,
        labels: labelFile,
        list: listFile,
        notes: plan.notes,
        diet: plan.diet,
        leave_out: plan.leave_list,
        cook_date: cookDate,
        household: plan.household,
        dinners: plan.rows.length,
        fridge,
        freezer,
        label_count: plan.labels.length,
        per_serving: perServing,
        safety: [S.lines.fridge, S.lines.chill, S.lines.reheat, S.lines.labels],
        cottage: S.cottage.short,
        sources: sourceList(ids).map((s) => ({ publisher: s.publisher, url: s.url, says: s.says })),
      };
    },
    view(out) {
      return views.blocks(
        views.metric('Week menu', `${out.dinners} dinners`, `For ${out.household} ${out.household === 1 ? 'person' : 'people'}, cook day ${M.shortDate(out.cook_date)}. ${out.fridge} in the fridge${out.freezer ? `, ${out.freezer} in the freezer` : ''}.`),
        out.diet && out.diet !== 'Anything' ? views.text(`Cooked the way they eat: ${out.diet.toLowerCase()}.`) : null,
        out.leave_out && out.leave_out.length ? views.text(`Left out: ${out.leave_out.join(', ')}. Every label says what each dish contains.`) : null,
        (out.notes || []).map((n) => views.text(n)),
        views.table(
          [
            { key: 'day', label: 'Day' },
            { key: 'dinner', label: 'Dinner' },
            { key: 'store', label: 'Store' },
            { key: 'when', label: 'Eat by or thaw' },
            { key: 'contains', label: 'Contains' },
          ],
          out.menu,
        ),
        views.copy('Menu text for the client', out.text),
        views.file(out.labels, `Labels (${out.label_count}, print and stick)`),
        views.file(out.plan, 'Cook day plan: menu, shopping list, schedule and food safety'),
        views.file(out.list, 'Shopping list (CSV)'),
        views.table(
          [
            { key: 'time', label: 'Time' },
            { key: 'step', label: 'Step' },
            { key: 'detail', label: 'Notes' },
          ],
          out.schedule,
        ),
        views.table(
          [
            { key: 'section', label: 'Section' },
            { key: 'item', label: 'Item' },
            { key: 'amount', label: 'Amount' },
            { key: 'label_check', label: 'Read the label for' },
          ],
          out.shopping,
        ),
        views.text(`Food safety: ${(out.safety || []).join(' ')}`),
        views.text(out.cottage),
        out.per_serving ? views.text(out.per_serving) : null,
        (out.sources || []).map((s) => views.link(`${s.publisher}: ${s.says}`, s.url)),
      );
    },
  };
}

module.exports = { weekMenuTool, COOK_DAYS, CONTAINERS };
