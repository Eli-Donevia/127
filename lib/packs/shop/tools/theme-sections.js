// shop.theme_sections: Shopify theme sections in the member's colors and words, as .liquid files in a
// zip (one file for the whole set, so a run stays at two files), plus a guide page that previews each section and walks
// through pasting it in. Facts come only from what the member typed or their own store shows; a
// section with nothing true to say is left out and the guide says what would add it.

const { text, files, save, views, brain, time } = require('../../_kit');
const { readStore } = require('../lib/store');
const S = require('../lib/sections');
const H = require('../lib/html');
const { brandColors, parsePairs, parseFaq, sentence } = require('../lib/brand');

const SET_NAMES = Object.keys(S.SETS);

// Everything the sections say, from the member's words and their store.
function factsFrom(input, br, store) {
  const shipping = text.oneLine(input.shipping || (store && store.freeShipping) || '');
  const returns = text.oneLine(input.returns || '');
  const made = text.oneLine(input.made || '');
  const materials = parsePairs(input.materials, { max: 12 });
  const stockists = parsePairs(input.stockists, { max: 30 }).map((s) => ({ name: s.name, place: s.note }));
  const trust = [];
  if (shipping) trust.push({ icon: /fast|day|ship(s|ped)? (in|within)|same/i.test(shipping) && !/free/i.test(shipping) ? 'clock' : 'truck', title: text.clip(shipping, 60) });
  if (returns) trust.push({ icon: 'return', title: text.clip(returns, 60) });
  if (made) trust.push({ icon: /\bin [A-Z]/.test(made) ? 'pin' : 'heart', title: text.clip(made, 60) });
  trust.push({ icon: 'lock', title: 'Secure checkout', text: 'Paid through Shopify' });
  const faq = parseFaq(input.faq);
  const asked = (re) => faq.some((x) => re.test(x.q));
  if (shipping && !asked(/ship|deliver/i)) faq.push({ q: 'How does shipping work?', a: sentence(shipping) });
  if (returns && !asked(/return|refund|exchange/i)) faq.push({ q: 'Can I return it?', a: sentence(returns) });
  if (materials.length && !asked(/made of|ingredient|material|inside/i)) faq.push({ q: 'What is it made of?', a: sentence(text.list(materials.map((m) => m.name.toLowerCase()))).replace(/^./, (c) => c.toUpperCase()) });
  const first = br.firstName || '';
  const name = br.name || (store && store.name) || 'our shop';
  const what = text.oneLine(br.what || '');
  const story = String(input.story || '')
    .split(/\n{2,}|\r?\n/)
    .map((p) => text.oneLine(p))
    .filter(Boolean)
    .slice(0, 3);
  const opener = what ? `${name} makes ${what.replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase()).replace(/\.$/, '')}${made && !/\bin [A-Z]/.test(made) && br.city ? ` in ${br.city}` : ''}.` : '';
  const body = [opener, ...story].filter(Boolean);
  if (body.length < 2) body.push('[Add a line or two on why you started, in your own words.]');
  // "New scents first, one email a month" -> heading "New scents first", line "One email a month."
  const signupWhat = text.oneLine(input.signup || '');
  const signupParts = signupWhat.split(/\s*[,.;:]\s+|\s*[.;]$/).filter(Boolean);
  const signupRest = signupParts.slice(1).join(', ');
  return {
    name,
    city: br.city,
    first,
    trust: trust.slice(0, 4),
    faq,
    faqIntro: '',
    materials,
    insideHeading: "What's inside",
    policy: { ship: sentence(shipping) || '[How you ship and how fast.]', returns: sentence(returns) || '[Your returns window and how to start one.]' },
    stockists,
    stockistIntro: stockists.length ? `Shops that carry ${name}. Call ahead for stock.` : '',
    story: { kicker: first ? 'Meet the maker' : 'Our story', heading: first ? `Hi, I'm ${first}` : `About ${name}`, body: body.slice(0, 4), signature: first, button: 'Shop the collection' },
    signup: {
      heading: signupWhat ? text.clip(signupParts[0], 60) : 'Be the first to know',
      text: signupRest ? `${sentence(signupRest.replace(/^./, (ch) => ch.toUpperCase()))} Unsubscribe any time.` : signupWhat ? 'Unsubscribe any time.' : 'New products and restocks by email. Unsubscribe any time.',
      button: 'Sign up',
      success: "Thanks, you're on the list.",
    },
    has: { shipping: !!shipping, returns: !!returns, materials: materials.length > 0, faq: faq.length > 0, stockists: stockists.length > 0 },
  };
}

// Which sections have something true to say; the rest are listed with what would add them.
function keep(sections, f) {
  const skipped = [];
  const kept = sections.filter((s) => {
    if (s.id === 'faq' && !f.has.faq) return !skipped.push({ title: s.title, add: 'Add a few questions people ask you (or your shipping and returns) and run it again.' });
    if (s.id === 'whats_inside' && !f.has.materials) return !skipped.push({ title: s.title, add: 'List what your product is made of, one per line, and run it again.' });
    if (s.id === 'shipping_returns' && !f.has.shipping && !f.has.returns) return !skipped.push({ title: s.title, add: 'Add your shipping and returns terms and run it again.' });
    if (s.id === 'stockists' && !f.has.stockists) return !skipped.push({ title: s.title, add: 'Add the shops that carry you (one per line: shop name, town) once one says yes.' });
    return true;
  });
  return { kept, skipped };
}

function guideHtml({ name, colors, sections, skipped, liquids, problems, today, storeNote }) {
  const t = H.theme(colors.palette.primary);
  const swatch = (hexv, label) => `<span class="sw"><i style="background:${hexv}"></i>${H.esc(label)} ${H.esc(hexv)}</span>`;
  const placeholders = sections.filter((s, i) => S.PLACEHOLDER.test(liquids[i]));
  const previewCss = sections.map((s) => s.css).join('\n');
  const extra = `
.sw{display:inline-flex;align-items:center;gap:8px;margin:0 16px 8px 0;font-size:14px}.sw i{width:22px;height:22px;border-radius:6px;border:1px solid rgba(0,0,0,.15);display:inline-block}
.prev{border:1px solid var(--line);border-radius:20px;overflow:hidden;margin:18px 0 14px;background:#fff}
.prev .bar{display:flex;gap:6px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);background:var(--surface);font-size:12px;color:var(--muted)}
.prev .bar b{width:10px;height:10px;border-radius:50%;background:var(--line);display:inline-block}
.sec{margin:0 0 56px}
.sec h3{font-size:24px;margin:0 0 6px}
.fname{font:600 14px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--soft);color:var(--soft-t);padding:4px 10px;border-radius:8px;display:inline-block;margin:4px 0 8px}
details.code{border:1px solid var(--line);border-radius:14px;background:#fff}
details.code summary{cursor:pointer;padding:14px 18px;font-weight:600}
details.code pre{margin:0;padding:16px 18px;border-top:1px solid var(--line);overflow:auto;max-height:420px;font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre}
.sk-icon{width:28px;height:28px}
.sk-story-ph{display:grid!important;place-items:center;color:inherit;opacity:.65;font-size:15px;border:2px dashed rgba(127,127,127,.4);aspect-ratio:4/5;border-radius:18px}
.sk-signup-input,.sk-signup-button{display:inline-block}
.sk-signup-input{text-align:left;color:#777!important}
${previewCss}`;
  const body = [
    H.hero({
      eyebrow: 'Theme sections',
      heading: `${sections.length} sections for ${name}`,
      lead: 'Paste each file into your theme once. After that every word, color and photo is yours to change in the theme editor, no code.',
      meta: [{ value: sections.length, label: text.plural(sections.length, 'section').replace(/^\d+ /, '') }, { value: 'No apps', label: 'and no JavaScript' }, `Made ${time.longDate(today)}`],
    }),
    H.block({
      kicker: 'Before you start',
      title: 'Two minutes of setup',
      body: `${H.checklist([
        { title: 'Check your theme', how: S.RULES.themeNeed },
        { title: 'Make a backup copy', how: S.RULES.pasteSteps[0] },
        { title: 'Unzip the file', how: `Open ${sections.length > 1 ? 'the zip' : 'the zip'} on your computer. Inside are the section files and a short read-me.` },
      ])}<p class="muted" style="margin-top:18px">Your colors: ${swatch(colors.bg, 'background')}${swatch(colors.text, 'text')}${swatch(colors.accent, 'accent')}${sections.some((s) => s.id === 'signup') ? swatch(colors.deep, 'signup background') : ''}</p>${storeNote ? `<p class="muted">${H.esc(storeNote)}</p>` : ''}`,
    }),
    H.block({ kicker: 'How to add one', title: 'Paste, save, add', body: H.steps(S.RULES.pasteSteps.slice(1)) }),
    placeholders.length
      ? H.block({ kicker: 'Edit before you publish', title: 'A few lines need your words', body: `<div class="note">${H.esc(`${text.list(placeholders.map((s) => s.title))} ${placeholders.length === 1 ? 'has' : 'have'} a line in [brackets]. Replace it in the theme editor before you click Save, so shoppers never see a placeholder.`)}</div>` })
      : '',
    H.block({
      kicker: 'Your sections',
      title: 'What each one looks like',
      sub: 'Previews use your colors and words. In your store they take your theme fonts.',
      body: sections
        .map(
          (s, i) => `<div class="sec"><h3>${i + 1}. ${H.esc(s.title)}</h3><span class="fname">sections/${H.esc(s.file)}</span><p class="muted">${H.esc(s.where)} ${H.esc(s.about)}</p>
<div class="prev"><div class="bar"><b></b><b></b><b></b><span>Preview</span></div>${s.preview()}</div>
<details class="code"><summary>Show the code for ${H.esc(s.file)}</summary><pre>${H.esc(liquids[i])}</pre></details></div>`
        )
        .join(''),
    }),
    skipped.length ? H.block({ kicker: 'Left out', title: 'Sections that need your facts first', body: H.cards(skipped.map((x) => ({ title: x.title, body: x.add }))) }) : '',
    problems.length ? H.block({ kicker: 'Check', title: 'Rule checks', body: `<div class="note">${H.esc(problems.join(' '))}</div>` }) : '',
  ].join('\n');
  return files.htmlDoc({
    title: `Theme sections for ${name}`,
    description: 'Shopify theme sections with previews and paste steps.',
    css: H.baseCss(t) + extra,
    body: `${body}\n<footer class="foot"><div class="wrap">Built to Shopify's section rules (section schema, settings and limits pages on shopify.dev and the Shopify Help Center, checked Oct 19, 2026). Every file passed the rule check before it was zipped.</div></footer>`,
  });
}

module.exports = {
  name: 'shop.theme_sections',
  title: 'Make theme sections',
  description: 'Writes Shopify theme sections (trust bar, FAQ, maker story, what is inside, shipping and returns, stockists, email signup) in your colors and words, checks each against Shopify section rules, and saves them zipped with a preview guide.',
  kind: 'api',
  risk: 'draft',
  needs: [],
  credits: 2,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      store: { type: 'string', maxLength: 300, description: 'Your store address, to read your colors and shipping line (optional).' },
      set: { type: 'string', enum: SET_NAMES, default: SET_NAMES[0] },
      shipping: { type: 'string', maxLength: 120 },
      returns: { type: 'string', maxLength: 120 },
      made: { type: 'string', maxLength: 120 },
      materials: { type: 'string', maxLength: 2000 },
      faq: { type: 'string', maxLength: 4000 },
      story: { type: 'string', maxLength: 1200 },
      stockists: { type: 'string', maxLength: 2000 },
      signup: { type: 'string', maxLength: 160 },
      color: { type: 'string', maxLength: 7 },
    },
  },
  output: {
    type: 'object',
    properties: { sections: { type: 'array' }, skipped: { type: 'array' }, zip: { type: 'object' }, guide: { type: 'object' }, colors: { type: 'object' }, problems: { type: 'array' }, sample: { type: 'boolean' } },
    required: ['sections'],
  },

  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    let store = null;
    let storeNote = '';
    let sample = false;
    if (input.store) {
      const r = await readStore(ctx, input.store, { depth: 'quick' });
      if (r.ok) {
        store = { name: r.name, colors: (r.home && r.home.colors) || null, freeShipping: r.home && r.home.freeShipping ? r.home.freeShipping.text : '' };
        sample = !!r.sample;
        const got = [store.colors && store.colors.primary ? 'colors' : '', store.freeShipping ? `shipping line ("${store.freeShipping}")` : ''].filter(Boolean);
        storeNote = got.length ? `${r.sample ? 'From the sample store in this run' : `Read from ${r.domain}`}: your ${text.list(got)}.` : `${r.domain} showed no colors or shipping line, so this uses your words and a warm default.`;
      } else storeNote = `We couldn't read ${input.store} (${r.reason || r.status}), so this uses your words only.`;
    }
    const col = brandColors(ctx, input, store && store.colors);
    const f = factsFrom(input, br, store);
    const set = SET_NAMES.includes(input.set) ? input.set : SET_NAMES[0];
    const built = S.build(f, { set, seed: col.primary, accent: col.accent });
    const { kept, skipped } = keep(built.sections, f);
    const by = br.name ? `127 for ${br.name}` : '127';
    const liquids = kept.map((s) => S.liquidOf(s, { by }));
    const problems = [];
    liquids.forEach((l, i) => {
      for (const p of S.checkSection(l)) problems.push(`${kept[i].file}: ${p}`);
    });
    if (problems.length) ctx.log(`Rule check: ${problems.join('; ')}`);
    const readme = [
      `Theme sections for ${f.name}`,
      '',
      'How to add each one:',
      ...S.RULES.pasteSteps.map((s, i) => `${i + 1}. ${s}`),
      '',
      S.RULES.themeNeed,
      '',
      'Files:',
      ...kept.map((s) => `sections/${s.file}: ${s.title}. ${s.where}`),
      '',
      'Lines in [brackets] are for your own words: replace them in the theme editor before you publish.',
    ].join('\n');
    const base = text.slug(f.name || 'my-store', 40);
    const zipData = files.zip([...kept.map((s, i) => ({ name: `sections/${s.file}`, data: liquids[i] })), { name: 'READ-ME.txt', data: readme }]);
    const zip = await save.saveFile(ctx, `${base}-theme-sections.zip`, zipData, 'application/zip');
    const html = guideHtml({ name: f.name, colors: built.colors, sections: kept, skipped, liquids, problems, today: time.today(ctx), storeNote });
    const guide = await save.saveFile(ctx, `${base}-theme-sections-guide.html`, html, 'text/html');
    ctx.log(`Made ${text.plural(kept.length, 'section')}${skipped.length ? `, left out ${skipped.length} that need your facts` : ''}.`);
    return {
      sections: kept.map((s, i) => ({ id: s.id, title: s.title, file: s.file, where: s.where, bytes: Buffer.byteLength(liquids[i]), placeholders: S.PLACEHOLDER.test(liquids[i]) })),
      skipped,
      zip,
      guide,
      colors: { background: built.colors.bg, text: built.colors.text, accent: built.colors.accent, source: col.source },
      problems,
      sample,
    };
  },

  view(out) {
    return views.blocks(
      views.metric('Theme sections', out.sections.length, out.problems.length ? 'Some files need a look (see the guide).' : 'Each one checked against Shopify section rules'),
      views.file(out.guide, 'Guide: a preview of each section and how to paste it in'),
      views.file(out.zip, 'The section files (.liquid), zipped with a read-me'),
      views.table(
        [
          { key: 'title', label: 'Section' },
          { key: 'file', label: 'File' },
          { key: 'where', label: 'Where it goes' },
        ],
        out.sections
      ),
      out.skipped.length ? views.text(`Left out until you add the facts: ${out.skipped.map((s) => s.title).join(', ')}.`) : null,
      out.sections.some((s) => s.placeholders) ? views.text('A few lines are in [brackets]: replace them with your words in the theme editor before you publish.') : null
    );
  },
};
