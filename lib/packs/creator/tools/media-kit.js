// Media kit: one printable page for brands, in the member's colors. Every number on it is one the
// member typed, shown exactly as typed and dated "as of"; a number they leave empty is a blank line to
// fill in by hand, never an estimate (Legal L76: the media kit shows only numbers the member gives).
// Brands they worked with and a brand's quote appear only as typed or pasted, word for word (D4).
// Code only: no AI sees or writes any of it.

const { views, save, time, text } = require('../../_kit');
const U = require('../lib/util');
const K = require('../lib/creator');

const { plain } = text;
const { esc } = U;

// The numbers a brand asks for, in the order they read them. Each is the member's, or blank.
const STATS = [
  { key: 'ig_followers', where: 'Instagram', label: 'Followers' },
  { key: 'ig_avg_views', where: 'Instagram', label: 'Average views per Reel' },
  { key: 'ig_engagement', where: 'Instagram', label: 'Engagement rate' },
  { key: 'tiktok_followers', where: 'TikTok', label: 'Followers' },
  { key: 'tiktok_avg_views', where: 'TikTok', label: 'Average views per video' },
  { key: 'youtube_subscribers', where: 'YouTube', label: 'Subscribers' },
  { key: 'youtube_avg_views', where: 'YouTube', label: 'Average views per video' },
  { key: 'newsletter_subscribers', where: 'Newsletter', label: 'Subscribers' },
  { key: 'newsletter_open_rate', where: 'Newsletter', label: 'Open rate' },
];
const AUDIENCE = [
  { key: 'audience_ages', label: 'Top age groups' },
  { key: 'audience_places', label: 'Top places' },
  { key: 'audience_split', label: 'Women / men / other' },
];

const statProps = Object.fromEntries([...STATS, ...AUDIENCE].map((s) => [s.key, { type: 'string', maxLength: 60, title: `${s.where ? `${s.where}: ` : 'Audience: '}${s.label.toLowerCase()} (optional)`, description: 'Exactly as your app shows it. Leave empty for a blank to fill in.' }]));

// Exactly what they typed (plain text, trimmed). Nothing is rounded, added up or worked out.
const typedValue = (v) => plain(v == null ? '' : String(v)).trim();

function linesWithPrice(v) {
  return K.C.linesOf(v, 12).map((l) => {
    const [what, price] = l.split(/\s*\|\s*/);
    return { what: plain(what), price: typedValue(price || '') };
  });
}

module.exports = {
  name: 'creator.media_kit',
  title: 'Make your media kit',
  description: 'A printable one-page media kit in your colors: who you are, your numbers exactly as you type them (blanks for any you leave out), what you offer and how to reach you.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', maxLength: 80, title: 'Your name or creator name' },
      handle: { type: 'string', maxLength: 60, title: 'Your handle (optional)' },
      niche: { type: 'string', maxLength: 80, title: 'What you post about (optional)' },
      about: { type: 'string', format: 'textarea', maxLength: 500, title: 'About you, in 2 or 3 sentences (optional)' },
      audience: { type: 'string', maxLength: 160, title: 'Who follows you, in your words (optional)' },
      as_of: { type: 'string', format: 'date', title: 'Numbers as of (optional)', description: 'The day you read them. Leave empty for today.' },
      ...statProps,
      offers: { type: 'string', format: 'textarea', maxLength: 1000, title: 'What you offer (optional)', description: 'One per line, a price after | if you want it shown: "One Instagram Reel | $250". Run Build your rate card for prices from your own hours.' },
      worked_with: { type: 'string', format: 'textarea', maxLength: 600, title: 'Brands you have worked with (optional)', description: 'One per line, only ones you really did paid or gifted work with' },
      quote: { type: 'string', format: 'textarea', maxLength: 400, title: 'A quote from a brand (optional)', description: 'Paste it word for word from their email or message. Shown exactly as pasted.' },
      quote_from: { type: 'string', maxLength: 100, title: 'Who said it (optional)', description: 'Name and brand, with their OK to share it' },
      email: { type: 'string', maxLength: 120, title: 'Email for brands' },
      link: { type: 'string', maxLength: 200, title: 'Link (optional)' },
      color: { type: 'string', maxLength: 7, title: 'Your color (optional)', description: 'A hex color like #2a5bd7' },
    },
  },
  output: { type: 'object', required: ['stats', 'blanks', 'file'], properties: { name: { type: 'string' }, as_of: { type: 'string' }, stats: { type: 'array' }, audience: { type: 'array' }, blanks: { type: 'array' }, offers: { type: 'array' }, worked_with: { type: 'array' }, quote: { type: ['object', 'null'] }, file: { type: 'object' }, notes: { type: 'array' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const today = time.today(ctx);
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(input.as_of || '')) && input.as_of <= today ? input.as_of : today;
    const name = m.name || 'Your name';
    const stats = STATS.map((s) => ({ ...s, value: typedValue(input[s.key]) }));
    const audience = AUDIENCE.map((s) => ({ ...s, value: typedValue(input[s.key]) }));
    const shown = stats.filter((s) => s.value);
    const blanks = [...stats, ...audience].filter((s) => !s.value).map((s) => (s.where ? `${s.where}: ${s.label.toLowerCase()}` : `Audience: ${s.label.toLowerCase()}`));
    const offers = linesWithPrice(input.offers);
    const worked = K.C.linesOf(input.worked_with, 12).map(plain);
    const quoteText = String(input.quote || '').trim();
    const quote = quoteText ? { text: quoteText, from: plain(input.quote_from || '') } : null;
    const notes = [];
    if (!shown.length) notes.push('No numbers yet, so every number on the page is a blank line. Type them from your app\'s insights and run this again, or write them in by hand after printing.');
    if (quote && !quote.from) notes.push('Add who said the quote, and only use it with their OK.');
    if (!input.email) notes.push('Add an email for brands so they can reach you.');

    // Platforms: a card for each with at least one number typed, plus a blank card for the rest.
    const byWhere = [...new Set(STATS.map((s) => s.where))].map((w) => ({ where: w, rows: stats.filter((s) => s.where === w) }));
    const statCard = (g) => `<div class="card stat"><h3>${esc(g.where)}</h3><table>${g.rows.map((s) => `<tr><th>${esc(s.label)}</th><td class="n">${s.value ? esc(s.value) : '<span class="blank"></span>'}</td></tr>`).join('')}</table></div>`;
    const used = byWhere.filter((g) => g.rows.some((s) => s.value));
    const grid = (used.length ? used : byWhere).map(statCard).join('');
    const audRows = audience.map((s) => `<tr><th>${esc(s.label)}</th><td>${s.value ? esc(s.value) : '<span class="blank"></span>'}</td></tr>`).join('');
    const body = [
      `<div class="band"><h1>${esc(name)}</h1><p>${esc([m.handle, m.niche !== 'my topic' ? m.niche : ''].filter(Boolean).join(' · '))}</p></div>`,
      input.about ? `<p>${esc(plain(input.about))}</p>` : '',
      m.audience ? `<p><b>Who follows:</b> ${esc(m.audience)}</p>` : '',
      `<h2>Numbers</h2><p class="muted small">As of ${esc(time.longDate(asOf))}, from my own app insights.${blanks.length ? ' Blank lines are numbers to add.' : ''}</p>`,
      `<div class="grid">${grid}</div>`,
      `<h2>Audience</h2><div class="wrap"><table>${audRows}</table></div>`,
      offers.length ? `<h2>What I offer</h2><div class="wrap"><table>${offers.map((o) => `<tr><td>${esc(o.what)}</td><td class="n">${o.price ? esc(o.price) : 'Ask me'}</td></tr>`).join('')}</table></div>` : '',
      worked.length ? `<h2>Brands I have worked with</h2><p>${worked.map((w) => `<span class="tag">${esc(w)}</span>`).join('')}</p>` : '',
      quote ? `<h2>In their words</h2><blockquote class="card">${esc(quote.text)}${quote.from ? `<br><span class="muted small">${esc(quote.from)}</span>` : ''}</blockquote>` : '',
      `<h2>Work with me</h2><p>${esc(m.email || input.email || '[your email]')}${m.link ? ` · <a href="${esc(m.link)}">${esc(m.link)}</a>` : ''}</p>`,
      '<p class="muted small">Sponsored posts are marked as ads, as the FTC asks.</p>',
    ].filter(Boolean).join('\n');
    const css = '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.stat table{background:none}.stat th{background:none;font-weight:400;color:var(--muted)}.stat td.n{font-weight:700;font-size:18px}blockquote{margin:12px 0;font-style:italic}';
    const html = U.page({ title: `${name} media kit`, seed: input.color, body, css, description: `Media kit for ${name}` });
    const file = await save.saveFile(ctx, save.fileName(name, 'media kit', asOf, '.html'), html);
    return {
      name,
      as_of: asOf,
      stats: shown.map(({ where, label, value }) => ({ where, label, value })),
      audience: audience.filter((s) => s.value).map(({ label, value }) => ({ label, value })),
      blanks,
      offers,
      worked_with: worked,
      quote,
      file,
      notes,
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Media kit', out.name, `${out.stats.length} of your numbers shown, ${out.blanks.length} left blank, as of ${out.as_of}`),
      out.stats.length ? views.table([{ key: 'where', label: 'Where' }, { key: 'label', label: 'Number' }, { key: 'value', label: 'Yours' }], out.stats) : null,
      out.blanks.length ? views.text(`Blank on the page: ${out.blanks.join(', ')}.`) : null,
      out.notes.length ? views.text(out.notes.join(' ')) : null,
      views.text('Update the numbers each month and change the "as of" date, so a brand always sees current ones.'),
      views.file(out.file, 'Media kit (printable page)'),
    );
  },
};
