// Shopify theme sections the member pastes into their own theme (Online Store 2.0): a trust bar, an
// FAQ, a maker story, a "what's inside" list, shipping and returns, a stockist list and an email
// signup. Each file is one section: markup, a {% style %} block for the color settings (they update
// live in the theme editor), a {% stylesheet %} block for the rest (no Liquid inside it), and one
// {% schema %} built from an object, so the JSON is always valid. Rules from data/theme-rules.json
// (checked 2026-10-19, sources inside); checkSection() enforces them and is run on every file.
// No JavaScript: the FAQ opens with <details>, the signup is Shopify's own customer form.
// The same specs draw a static preview (previewHtml) so the member sees each section before pasting.

const { text, color } = require('../../_kit');
const { esc } = require('./html');
const RULES = require('../data/theme-rules.json');

const PREFIX = 'sk';

// ---------- icons (drawn here, 24 x 24, stroke only) ----------
const ICONS = {
  truck: '<path d="M2 6h11v9H2z"/><path d="M13 9h4l3 3v3h-7z"/><circle cx="6" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  return: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c3-4 6-6 9-8"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6 1 6-1.5S14 5 12 9z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  pin: '<path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
};
const ICON_OPTIONS = [
  { value: 'truck', label: 'Delivery truck' },
  { value: 'clock', label: 'Clock' },
  { value: 'return', label: 'Return arrow' },
  { value: 'lock', label: 'Lock' },
  { value: 'heart', label: 'Heart' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'gift', label: 'Gift' },
  { value: 'chat', label: 'Chat' },
  { value: 'pin', label: 'Map pin' },
];
const svgIcon = (id) => `<svg class="${PREFIX}-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[id] || ICONS.heart}</svg>`;
const iconCase = (expr) => `{%- case ${expr} -%}\n${Object.keys(ICONS)
  .map((id) => `            {%- when '${id}' -%}${svgIcon(id)}`)
  .join('\n')}\n          {%- endcase -%}`;

// ---------- shared settings ----------
function colorSettings(c, { padding = 48 } = {}) {
  return [
    { type: 'header', content: 'Colors and spacing' },
    { type: 'color', id: 'color_bg', label: 'Background', default: c.bg },
    { type: 'color', id: 'color_text', label: 'Text', default: c.text },
    { type: 'color', id: 'color_accent', label: 'Accent (icons, links, buttons)', default: c.accent },
    { type: 'range', id: 'padding', label: 'Space above and below', min: 0, max: 100, step: 4, unit: 'px', default: padding },
  ];
}
const styleBlock = (cls) => `{%- style -%}
  #shopify-section-{{ section.id }} .${cls} {
    --sk-bg: {{ section.settings.color_bg }};
    --sk-text: {{ section.settings.color_text }};
    --sk-accent: {{ section.settings.color_accent }};
    padding-top: {{ section.settings.padding }}px;
    padding-bottom: {{ section.settings.padding }}px;
  }
{%- endstyle -%}`;
// The base every section shares (container, heading), kept inside each file so any one stands alone.
const baseCss = (cls) => `.${cls}{background:var(--sk-bg);color:var(--sk-text)}
.${cls} .${PREFIX}-wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.${cls} .${PREFIX}-h{font-size:clamp(24px,3.2vw,34px);line-height:1.15;margin:0 0 12px;color:inherit}
.${cls} .${PREFIX}-sub{margin:0 0 28px;max-width:60ch;opacity:.85}
.${cls} a{color:var(--sk-accent)}
.${cls} .${PREFIX}-icon{color:var(--sk-accent);flex:none}`;

// ---------- the sections ----------
// Each: { id, file, name (schema, 25 max), title, where, about, settings, blocks?, maxBlocks?, preset, markup, css, preview(values) }

function trustBar(f, c) {
  const items = f.trust.slice(0, 4);
  return {
    id: 'trust_bar',
    file: `${PREFIX}-trust-bar.liquid`,
    name: 'Trust bar',
    title: 'Trust bar',
    where: 'Product pages, under the product. Also works on the home page.',
    about: 'Up to 4 short lines with an icon: shipping, returns, how it is made, secure checkout. Shoppers look for these before they pay.',
    settings: [{ type: 'text', id: 'heading', label: 'Heading (optional)', default: '' }, ...colorSettings(c, { padding: 28 })],
    maxBlocks: 4,
    blocks: [
      {
        type: 'item',
        name: 'Line',
        settings: [
          { type: 'select', id: 'icon', label: 'Icon', options: ICON_OPTIONS, default: 'heart' },
          { type: 'text', id: 'title', label: 'Line', default: 'A short promise you keep' },
          { type: 'text', id: 'text', label: 'Small print (optional)', default: '' },
        ],
      },
    ],
    preset: { name: 'Trust bar', blocks: items.map((t) => ({ type: 'item', settings: { icon: t.icon, title: t.title, text: t.text || '' } })) },
    markup: `<div class="${PREFIX}-trust">
  <div class="${PREFIX}-wrap">
    {%- if section.settings.heading != blank -%}
      <h2 class="${PREFIX}-h">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    <ul class="${PREFIX}-trust-list" role="list">
      {%- for block in section.blocks -%}
        <li class="${PREFIX}-trust-item" {{ block.shopify_attributes }}>
          ${iconCase('block.settings.icon')}
          <span class="${PREFIX}-trust-text">
            <strong>{{ block.settings.title | escape }}</strong>
            {%- if block.settings.text != blank -%}
              <span>{{ block.settings.text | escape }}</span>
            {%- endif -%}
          </span>
        </li>
      {%- endfor -%}
    </ul>
  </div>
</div>`,
    css: `${baseCss(`${PREFIX}-trust`)}
.${PREFIX}-trust-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px 28px}
.${PREFIX}-trust-item{display:flex;gap:14px;align-items:flex-start}
.${PREFIX}-trust-text{display:flex;flex-direction:column;gap:2px;line-height:1.35}
.${PREFIX}-trust-text strong{font-size:16px}
.${PREFIX}-trust-text span{font-size:14px;opacity:.8}`,
    preview: () => `<div class="${PREFIX}-trust" style="${vars(c, 28)}"><div class="${PREFIX}-wrap"><ul class="${PREFIX}-trust-list">${items
      .map((t) => `<li class="${PREFIX}-trust-item">${svgIcon(t.icon)}<span class="${PREFIX}-trust-text"><strong>${esc(t.title)}</strong>${t.text ? `<span>${esc(t.text)}</span>` : ''}</span></li>`)
      .join('')}</ul></div></div>`,
  };
}

function faq(f, c) {
  const qs = f.faq.slice(0, 8);
  return {
    id: 'faq',
    file: `${PREFIX}-faq.liquid`,
    name: 'FAQ',
    title: 'FAQ',
    where: 'Product pages or a FAQ page. Works anywhere.',
    about: 'Questions that open on tap, no app and no code that slows the page. Answer what people ask you in messages.',
    settings: [
      { type: 'text', id: 'heading', label: 'Heading', default: 'Questions, answered' },
      { type: 'text', id: 'intro', label: 'Line under the heading (optional)', default: f.faqIntro || '' },
      { type: 'checkbox', id: 'open_first', label: 'Open the first question', default: true },
      ...colorSettings(c),
    ],
    maxBlocks: 20,
    blocks: [
      {
        type: 'question',
        name: 'Question',
        settings: [
          { type: 'text', id: 'question', label: 'Question', default: 'A question people ask you' },
          { type: 'richtext', id: 'answer', label: 'Answer', default: '<p>Your answer, in a sentence or two.</p>' },
        ],
      },
    ],
    preset: { name: 'FAQ', blocks: qs.map((q) => ({ type: 'question', settings: { question: q.q, answer: `<p>${esc(q.a)}</p>` } })) },
    markup: `<div class="${PREFIX}-faq">
  <div class="${PREFIX}-wrap ${PREFIX}-faq-wrap">
    <h2 class="${PREFIX}-h">{{ section.settings.heading | escape }}</h2>
    {%- if section.settings.intro != blank -%}
      <p class="${PREFIX}-sub">{{ section.settings.intro | escape }}</p>
    {%- endif -%}
    <div class="${PREFIX}-faq-list">
      {%- for block in section.blocks -%}
        <details class="${PREFIX}-faq-item" {{ block.shopify_attributes }}{% if forloop.first and section.settings.open_first %} open{% endif %}>
          <summary class="${PREFIX}-faq-q">{{ block.settings.question | escape }}</summary>
          <div class="${PREFIX}-faq-a">{{ block.settings.answer }}</div>
        </details>
      {%- endfor -%}
    </div>
  </div>
</div>`,
    css: `${baseCss(`${PREFIX}-faq`)}
.${PREFIX}-faq .${PREFIX}-faq-wrap{max-width:820px}
.${PREFIX}-faq-list{border-top:1px solid currentColor;border-color:rgba(127,127,127,.35)}
.${PREFIX}-faq-item{border-bottom:1px solid rgba(127,127,127,.35)}
.${PREFIX}-faq-q{cursor:pointer;list-style:none;padding:18px 40px 18px 0;font-size:17px;font-weight:600;position:relative}
.${PREFIX}-faq-q::-webkit-details-marker{display:none}
.${PREFIX}-faq-q:after{content:"+";position:absolute;right:4px;top:12px;font-size:26px;line-height:1;color:var(--sk-accent)}
.${PREFIX}-faq-item[open] .${PREFIX}-faq-q:after{content:"\\2212"}
.${PREFIX}-faq-a{padding:0 0 20px;opacity:.9;line-height:1.6}
.${PREFIX}-faq-a p{margin:0 0 10px}`,
    preview: () => `<div class="${PREFIX}-faq" style="${vars(c, 48)}"><div class="${PREFIX}-wrap ${PREFIX}-faq-wrap"><h2 class="${PREFIX}-h">Questions, answered</h2>${f.faqIntro ? `<p class="${PREFIX}-sub">${esc(f.faqIntro)}</p>` : ''}<div class="${PREFIX}-faq-list">${qs
      .map((q, i) => `<details class="${PREFIX}-faq-item"${i === 0 ? ' open' : ''}><summary class="${PREFIX}-faq-q">${esc(q.q)}</summary><div class="${PREFIX}-faq-a"><p>${esc(q.a)}</p></div></details>`)
      .join('')}</div></div></div>`,
  };
}

function makerStory(f, c) {
  const s = f.story;
  return {
    id: 'maker_story',
    file: `${PREFIX}-maker-story.liquid`,
    name: 'Maker story',
    title: 'Maker story',
    where: 'Home page or About page.',
    about: 'A photo of you or your workspace with a few lines on who makes this and why. Add your own photo in the theme editor.',
    settings: [
      { type: 'image_picker', id: 'image', label: 'Photo (you, your hands or your workspace)' },
      { type: 'select', id: 'image_side', label: 'Photo side', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }], default: 'left' },
      { type: 'text', id: 'kicker', label: 'Small line above the heading', default: s.kicker },
      { type: 'text', id: 'heading', label: 'Heading', default: s.heading },
      { type: 'richtext', id: 'body', label: 'Story', default: s.body.map((p) => `<p>${esc(p)}</p>`).join('') },
      { type: 'text', id: 'signature', label: 'Signed (optional)', default: s.signature },
      { type: 'text', id: 'button_label', label: 'Button text (optional)', default: s.button },
      { type: 'url', id: 'button_link', label: 'Button link' },
      ...colorSettings(c, { padding: 64 }),
    ],
    preset: { name: 'Maker story' },
    markup: `<div class="${PREFIX}-story{% if section.settings.image_side == 'right' %} ${PREFIX}-story--right{% endif %}">
  <div class="${PREFIX}-wrap ${PREFIX}-story-grid">
    <div class="${PREFIX}-story-media">
      {%- if section.settings.image != blank -%}
        {{ section.settings.image | image_url: width: 1400 | image_tag: loading: 'lazy', class: '${PREFIX}-story-img', sizes: '(min-width: 750px) 50vw, 100vw', widths: '400, 700, 1000, 1400' }}
      {%- else -%}
        {{ 'lifestyle-1' | placeholder_svg_tag: '${PREFIX}-story-img ${PREFIX}-story-ph' }}
      {%- endif -%}
    </div>
    <div class="${PREFIX}-story-text">
      {%- if section.settings.kicker != blank -%}
        <p class="${PREFIX}-story-kicker">{{ section.settings.kicker | escape }}</p>
      {%- endif -%}
      <h2 class="${PREFIX}-h">{{ section.settings.heading | escape }}</h2>
      <div class="${PREFIX}-story-body">{{ section.settings.body }}</div>
      {%- if section.settings.signature != blank -%}
        <p class="${PREFIX}-story-sign">{{ section.settings.signature | escape }}</p>
      {%- endif -%}
      {%- if section.settings.button_label != blank and section.settings.button_link != blank -%}
        <a class="${PREFIX}-btn" href="{{ section.settings.button_link }}">{{ section.settings.button_label | escape }}</a>
      {%- endif -%}
    </div>
  </div>
</div>`,
    css: `${baseCss(`${PREFIX}-story`)}
.${PREFIX}-story-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.${PREFIX}-story--right .${PREFIX}-story-media{order:2}
.${PREFIX}-story-img{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover;border-radius:18px;background:rgba(127,127,127,.12)}
.${PREFIX}-story-kicker{font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--sk-accent);margin:0 0 10px}
.${PREFIX}-story-body{line-height:1.65;opacity:.92}
.${PREFIX}-story-body p{margin:0 0 14px}
.${PREFIX}-story-sign{font-style:italic;margin:6px 0 18px}
.${PREFIX}-btn{display:inline-block;background:var(--sk-accent);color:var(--sk-bg);text-decoration:none;font-weight:600;padding:13px 22px;border-radius:999px}
@media (max-width:749px){.${PREFIX}-story-grid{grid-template-columns:1fr;gap:24px}.${PREFIX}-story--right .${PREFIX}-story-media{order:0}}`,
    preview: () => `<div class="${PREFIX}-story" style="${vars(c, 56)}"><div class="${PREFIX}-wrap ${PREFIX}-story-grid"><div class="${PREFIX}-story-media"><div class="${PREFIX}-story-img ${PREFIX}-story-ph" role="img" aria-label="Your photo goes here"><span>Your photo here</span></div></div><div class="${PREFIX}-story-text"><p class="${PREFIX}-story-kicker">${esc(s.kicker)}</p><h2 class="${PREFIX}-h">${esc(s.heading)}</h2><div class="${PREFIX}-story-body">${s.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>${s.signature ? `<p class="${PREFIX}-story-sign">${esc(s.signature)}</p>` : ''}${s.button ? `<span class="${PREFIX}-btn">${esc(s.button)}</span>` : ''}</div></div></div>`,
  };
}

function whatsInside(f, c) {
  const items = f.materials.slice(0, 12);
  return {
    id: 'whats_inside',
    file: `${PREFIX}-whats-inside.liquid`,
    name: "What's inside",
    title: "What's inside",
    where: 'Product pages, near the description.',
    about: 'What it is made of, one line each. Shoppers who care read every word of this.',
    settings: [
      { type: 'text', id: 'heading', label: 'Heading', default: f.insideHeading },
      { type: 'text', id: 'intro', label: 'Line under the heading (optional)', default: '' },
      { type: 'range', id: 'columns', label: 'Columns on wide screens', min: 1, max: 4, step: 1, default: Math.min(3, Math.max(1, items.length >= 3 ? 3 : items.length || 1)) },
      ...colorSettings(c),
    ],
    maxBlocks: 12,
    blocks: [
      {
        type: 'item',
        name: 'Ingredient or material',
        settings: [
          { type: 'text', id: 'name', label: 'Name', default: 'Material' },
          { type: 'text', id: 'note', label: 'One line about it', default: '' },
        ],
      },
    ],
    preset: { name: "What's inside", blocks: items.map((m) => ({ type: 'item', settings: { name: m.name, note: m.note || '' } })) },
    markup: `<div class="${PREFIX}-inside">
  <div class="${PREFIX}-wrap">
    <h2 class="${PREFIX}-h">{{ section.settings.heading | escape }}</h2>
    {%- if section.settings.intro != blank -%}
      <p class="${PREFIX}-sub">{{ section.settings.intro | escape }}</p>
    {%- endif -%}
    <ul class="${PREFIX}-inside-grid" role="list" style="--sk-cols: {{ section.settings.columns }};">
      {%- for block in section.blocks -%}
        <li class="${PREFIX}-inside-item" {{ block.shopify_attributes }}>
          <strong>{{ block.settings.name | escape }}</strong>
          {%- if block.settings.note != blank -%}
            <span>{{ block.settings.note | escape }}</span>
          {%- endif -%}
        </li>
      {%- endfor -%}
    </ul>
  </div>
</div>`,
    css: `${baseCss(`${PREFIX}-inside`)}
.${PREFIX}-inside-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(var(--sk-cols,3),minmax(0,1fr));gap:14px}
.${PREFIX}-inside-item{display:flex;flex-direction:column;gap:4px;padding:18px 20px;border-radius:14px;border:1px solid rgba(127,127,127,.3);border-top:4px solid var(--sk-accent)}
.${PREFIX}-inside-item strong{font-size:16px}
.${PREFIX}-inside-item span{font-size:14px;opacity:.82;line-height:1.45}
@media (max-width:749px){.${PREFIX}-inside-grid{grid-template-columns:1fr}}`,
    preview: () => `<div class="${PREFIX}-inside" style="${vars(c, 48)}"><div class="${PREFIX}-wrap"><h2 class="${PREFIX}-h">${esc(f.insideHeading)}</h2><ul class="${PREFIX}-inside-grid" style="--sk-cols:${Math.min(3, Math.max(1, items.length >= 3 ? 3 : items.length || 1))}">${items
      .map((m) => `<li class="${PREFIX}-inside-item"><strong>${esc(m.name)}</strong>${m.note ? `<span>${esc(m.note)}</span>` : ''}</li>`)
      .join('')}</ul></div></div>`,
  };
}

function shippingReturns(f, c) {
  const s = f.policy;
  return {
    id: 'shipping_returns',
    file: `${PREFIX}-shipping-returns.liquid`,
    name: 'Shipping and returns',
    title: 'Shipping and returns',
    where: 'Product pages, or the cart page.',
    about: 'Your shipping and return terms in plain words, with links to your full policy pages when you have them (Settings, then Policies).',
    settings: [
      { type: 'text', id: 'heading', label: 'Heading', default: 'Shipping and returns' },
      { type: 'text', id: 'ship_title', label: 'Shipping title', default: 'Shipping' },
      { type: 'richtext', id: 'ship_text', label: 'Shipping', default: `<p>${esc(s.ship)}</p>` },
      { type: 'text', id: 'return_title', label: 'Returns title', default: 'Returns' },
      { type: 'richtext', id: 'return_text', label: 'Returns', default: `<p>${esc(s.returns)}</p>` },
      { type: 'checkbox', id: 'show_links', label: 'Link to my policy pages', default: true },
      ...colorSettings(c),
    ],
    preset: { name: 'Shipping and returns' },
    markup: `<div class="${PREFIX}-policy">
  <div class="${PREFIX}-wrap">
    <h2 class="${PREFIX}-h">{{ section.settings.heading | escape }}</h2>
    <div class="${PREFIX}-policy-grid">
      <div class="${PREFIX}-policy-col">
        ${svgIcon('truck')}
        <h3>{{ section.settings.ship_title | escape }}</h3>
        <div class="${PREFIX}-policy-text">{{ section.settings.ship_text }}</div>
        {%- if section.settings.show_links and shop.shipping_policy != blank -%}
          <a href="{{ shop.shipping_policy.url }}">{{ shop.shipping_policy.title | escape }}</a>
        {%- endif -%}
      </div>
      <div class="${PREFIX}-policy-col">
        ${svgIcon('return')}
        <h3>{{ section.settings.return_title | escape }}</h3>
        <div class="${PREFIX}-policy-text">{{ section.settings.return_text }}</div>
        {%- if section.settings.show_links and shop.refund_policy != blank -%}
          <a href="{{ shop.refund_policy.url }}">{{ shop.refund_policy.title | escape }}</a>
        {%- endif -%}
      </div>
    </div>
  </div>
</div>`,
    css: `${baseCss(`${PREFIX}-policy`)}
.${PREFIX}-policy-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.${PREFIX}-policy-col{padding:24px;border-radius:16px;border:1px solid rgba(127,127,127,.3)}
.${PREFIX}-policy-col h3{margin:10px 0 6px;font-size:18px}
.${PREFIX}-policy-text{line-height:1.6;opacity:.9}
.${PREFIX}-policy-text p{margin:0 0 10px}
@media (max-width:749px){.${PREFIX}-policy-grid{grid-template-columns:1fr}}`,
    preview: () => `<div class="${PREFIX}-policy" style="${vars(c, 48)}"><div class="${PREFIX}-wrap"><h2 class="${PREFIX}-h">Shipping and returns</h2><div class="${PREFIX}-policy-grid"><div class="${PREFIX}-policy-col">${svgIcon('truck')}<h3>Shipping</h3><div class="${PREFIX}-policy-text"><p>${esc(s.ship)}</p></div><a href="#shipping">Shipping policy</a></div><div class="${PREFIX}-policy-col">${svgIcon('return')}<h3>Returns</h3><div class="${PREFIX}-policy-text"><p>${esc(s.returns)}</p></div><a href="#returns">Refund policy</a></div></div></div></div>`,
  };
}

function stockists(f, c) {
  const list = f.stockists.slice(0, 30);
  return {
    id: 'stockists',
    file: `${PREFIX}-stockists.liquid`,
    name: 'Stockists',
    title: 'Where to find us',
    where: 'Home page, About page or a Stockists page.',
    about: 'The shops that carry your products, with a link to each. Add a shop as soon as it says yes, and only shops that stock you today.',
    settings: [
      { type: 'text', id: 'heading', label: 'Heading', default: 'Find us in person' },
      { type: 'text', id: 'intro', label: 'Line under the heading (optional)', default: f.stockistIntro || '' },
      ...colorSettings(c),
    ],
    maxBlocks: 30,
    blocks: [
      {
        type: 'stockist',
        name: 'Shop',
        settings: [
          { type: 'text', id: 'name', label: 'Shop name', default: 'Shop name' },
          { type: 'text', id: 'place', label: 'Town or neighborhood', default: '' },
          { type: 'url', id: 'link', label: 'Their website (optional)' },
        ],
      },
    ],
    preset: { name: 'Stockists', blocks: list.length ? list.map((s) => ({ type: 'stockist', settings: { name: s.name, place: s.place || '' } })) : [{ type: 'stockist', settings: { name: 'Your first stockist', place: f.city || '' } }] },
    markup: `<div class="${PREFIX}-stock">
  <div class="${PREFIX}-wrap">
    <h2 class="${PREFIX}-h">{{ section.settings.heading | escape }}</h2>
    {%- if section.settings.intro != blank -%}
      <p class="${PREFIX}-sub">{{ section.settings.intro | escape }}</p>
    {%- endif -%}
    <ul class="${PREFIX}-stock-grid" role="list">
      {%- for block in section.blocks -%}
        <li class="${PREFIX}-stock-item" {{ block.shopify_attributes }}>
          ${svgIcon('pin')}
          <span>
            {%- if block.settings.link != blank -%}
              <a href="{{ block.settings.link }}"><strong>{{ block.settings.name | escape }}</strong></a>
            {%- else -%}
              <strong>{{ block.settings.name | escape }}</strong>
            {%- endif -%}
            {%- if block.settings.place != blank -%}
              <br><small>{{ block.settings.place | escape }}</small>
            {%- endif -%}
          </span>
        </li>
      {%- endfor -%}
    </ul>
  </div>
</div>`,
    css: `${baseCss(`${PREFIX}-stock`)}
.${PREFIX}-stock-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.${PREFIX}-stock-item{display:flex;gap:12px;align-items:flex-start;padding:16px 18px;border-radius:14px;border:1px solid rgba(127,127,127,.3);line-height:1.4}
.${PREFIX}-stock-item a{text-decoration:none}
.${PREFIX}-stock-item small{opacity:.8;font-size:14px}`,
    preview: () => `<div class="${PREFIX}-stock" style="${vars(c, 48)}"><div class="${PREFIX}-wrap"><h2 class="${PREFIX}-h">Find us in person</h2>${f.stockistIntro ? `<p class="${PREFIX}-sub">${esc(f.stockistIntro)}</p>` : ''}<ul class="${PREFIX}-stock-grid">${(list.length ? list : [{ name: 'Your first stockist', place: f.city || '' }])
      .map((s) => `<li class="${PREFIX}-stock-item">${svgIcon('pin')}<span><strong>${esc(s.name)}</strong>${s.place ? `<br><small>${esc(s.place)}</small>` : ''}</span></li>`)
      .join('')}</ul></div></div>`,
  };
}

function signup(f, c) {
  const s = f.signup;
  return {
    id: 'signup',
    file: `${PREFIX}-email-signup.liquid`,
    name: 'Email signup',
    title: 'Email signup',
    where: 'Home page, or above the footer on any page.',
    about: "Shopify's own signup form (no app): new signups land in Customers, subscribed to email marketing. Say what they get and how often.",
    settings: [
      { type: 'text', id: 'heading', label: 'Heading', default: s.heading },
      { type: 'text', id: 'text', label: 'What they get, and how often', default: s.text },
      { type: 'text', id: 'label', label: 'Field label', default: 'Your email' },
      { type: 'text', id: 'button', label: 'Button text', default: s.button },
      { type: 'text', id: 'success', label: 'Thank-you line', default: s.success },
      ...colorSettings({ bg: c.deep, text: c.onDeep, accent: c.accentOnDeep }, { padding: 56 }),
    ],
    preset: { name: 'Email signup' },
    markup: `<div class="${PREFIX}-signup">
  <div class="${PREFIX}-wrap ${PREFIX}-signup-wrap">
    <h2 class="${PREFIX}-h">{{ section.settings.heading | escape }}</h2>
    {%- if section.settings.text != blank -%}
      <p class="${PREFIX}-sub">{{ section.settings.text | escape }}</p>
    {%- endif -%}
    {%- form 'customer', class: '${PREFIX}-signup-form' -%}
      <input type="hidden" name="contact[tags]" value="newsletter">
      {%- if form.posted_successfully? -%}
        <p class="${PREFIX}-signup-done" role="status">{{ section.settings.success | escape }}</p>
      {%- else -%}
        <label class="${PREFIX}-signup-label" for="SkEmail-{{ section.id }}">{{ section.settings.label | escape }}</label>
        <div class="${PREFIX}-signup-row">
          <input id="SkEmail-{{ section.id }}" class="${PREFIX}-signup-input" type="email" name="contact[email]" autocomplete="email" required>
          <button type="submit" class="${PREFIX}-signup-button">{{ section.settings.button | escape }}</button>
        </div>
        {%- if form.errors -%}
          <div class="${PREFIX}-signup-error" role="alert">{{ form.errors | default_errors }}</div>
        {%- endif -%}
      {%- endif -%}
    {%- endform -%}
  </div>
</div>`,
    css: `${baseCss(`${PREFIX}-signup`)}
.${PREFIX}-signup .${PREFIX}-signup-wrap{max-width:720px;text-align:center}
.${PREFIX}-signup .${PREFIX}-sub{margin-left:auto;margin-right:auto}
.${PREFIX}-signup-label{display:block;font-size:14px;margin:0 0 8px;opacity:.85}
.${PREFIX}-signup-row{display:flex;gap:10px;max-width:520px;margin:0 auto}
.${PREFIX}-signup-input{flex:1;min-width:0;font:inherit;padding:14px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:#fff;color:#1a1a1a}
.${PREFIX}-signup-button{font:inherit;font-weight:700;padding:14px 22px;border-radius:999px;border:0;background:var(--sk-accent);color:var(--sk-bg);cursor:pointer}
.${PREFIX}-signup-done{font-weight:600}
.${PREFIX}-signup-error{margin-top:10px;font-size:14px}
@media (max-width:520px){.${PREFIX}-signup-row{flex-direction:column}}`,
    preview: () => `<div class="${PREFIX}-signup" style="${vars({ bg: c.deep, text: c.onDeep, accent: c.accentOnDeep }, 56)}"><div class="${PREFIX}-wrap ${PREFIX}-signup-wrap"><h2 class="${PREFIX}-h">${esc(s.heading)}</h2><p class="${PREFIX}-sub">${esc(s.text)}</p><div class="${PREFIX}-signup-form"><span class="${PREFIX}-signup-label">Your email</span><div class="${PREFIX}-signup-row"><span class="${PREFIX}-signup-input">you@example.com</span><span class="${PREFIX}-signup-button">${esc(s.button)}</span></div></div></div></div>`,
  };
}

const BUILDERS = { trust_bar: trustBar, faq, maker_story: makerStory, whats_inside: whatsInside, shipping_returns: shippingReturns, stockists, signup };
const SETS = {
  'All seven sections': ['trust_bar', 'whats_inside', 'faq', 'shipping_returns', 'maker_story', 'stockists', 'signup'],
  'Product page sections': ['trust_bar', 'whats_inside', 'faq', 'shipping_returns'],
  'Home page sections': ['maker_story', 'stockists', 'signup', 'trust_bar'],
};

function vars(c, pad) {
  return `--sk-bg:${c.bg};--sk-text:${c.text};--sk-accent:${c.accent};padding-top:${pad}px;padding-bottom:${pad}px`;
}

// The member's colors for the sections: light background, dark text, an accent that reads on both.
function colorsFor(seed, accentSeed) {
  const p = color.palette(color.isHex(seed) ? seed : seed || 'warm');
  const bg = p.paper;
  const text = p.ink;
  const accent = color.ensureContrast(p.primary, bg, 4.5);
  const deep = color.ensureContrast(color.mix(p.primary, '#000000', 0.35), '#ffffff', 7);
  const onDeep = color.readableOn(deep);
  // The signup button: accent background with the section's background color as its text.
  const accentOnDeep = [accentSeed, p.accent].find((x) => color.isHex(x) && color.contrast(x, deep) >= 4.5) || onDeep;
  return { bg, text, accent, deep, onDeep, accentOnDeep, palette: p };
}

// ---------- the file ----------
// Blank defaults are left out (a setting with no default starts empty in the theme editor).
const dropBlank = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));
const cleanSettings = (list) => (list || []).map(dropBlank);

function schemaOf(s) {
  const out = { name: s.name, tag: 'section', class: `${PREFIX}-section`, settings: cleanSettings(s.settings) };
  if (s.blocks) {
    out.max_blocks = s.maxBlocks || 12;
    out.blocks = s.blocks.map((b) => ({ ...b, settings: cleanSettings(b.settings) }));
  }
  const preset = { ...s.preset };
  if (preset.blocks) preset.blocks = preset.blocks.map((pb) => ({ type: pb.type, ...(pb.settings ? { settings: dropBlank(pb.settings) } : {}) }));
  out.presets = [preset];
  return out;
}

function liquidOf(s, { by = '127' } = {}) {
  const head = `{% comment %}
  ${s.title} section, made with ${by}.
  File name: sections/${s.file}
  Where it goes: ${s.where}
  Paste it as a new file in your theme's sections folder, save, then add it in the theme editor (Add section).
  Every word, color and photo is editable in the theme editor. Uses no apps and no JavaScript.
{% endcomment %}`;
  return `${head}
${styleBlock(cssClassOf(s))}
${s.markup}

{% stylesheet %}
${s.css}
{% endstylesheet %}

{% schema %}
${JSON.stringify(schemaOf(s), null, 2)}
{% endschema %}
`;
}
const cssClassOf = (s) => ({ trust_bar: `${PREFIX}-trust`, faq: `${PREFIX}-faq`, maker_story: `${PREFIX}-story`, whats_inside: `${PREFIX}-inside`, shipping_returns: `${PREFIX}-policy`, stockists: `${PREFIX}-stock`, signup: `${PREFIX}-signup` })[s.id];

// ---------- the checker (data/theme-rules.json) ----------
const STANDARD_TYPES = new Set(['text', 'textarea', 'richtext', 'inline_richtext', 'image_picker', 'color', 'color_background', 'range', 'checkbox', 'select', 'radio', 'url', 'number', 'html', 'video_url', 'product', 'collection', 'page', 'link_list', 'font_picker', 'blog', 'article', 'liquid', 'text_alignment', 'color_scheme', 'video', 'product_list', 'collection_list', 'metaobject', 'metaobject_list']);

function checkSettings(list, where, problems) {
  const ids = new Set();
  for (const st of list || []) {
    if (RULES.settings.sidebarTypes.includes(st.type)) {
      if (!st.content) problems.push(`${where}: ${st.type} needs content`);
      continue;
    }
    for (const k of RULES.settings.standardRequired) if (st[k] == null || st[k] === '') problems.push(`${where}: a setting is missing ${k}`);
    if (!STANDARD_TYPES.has(st.type)) problems.push(`${where}: unknown setting type ${st.type}`);
    if (ids.has(st.id)) problems.push(`${where}: setting id ${st.id} is used twice`);
    ids.add(st.id);
    if (st.type === 'range') {
      for (const k of ['min', 'max', 'default']) if (typeof st[k] !== 'number') problems.push(`${where}: range ${st.id} needs a number ${k}`);
      if (st.default < st.min || st.default > st.max) problems.push(`${where}: range ${st.id} default is outside min and max`);
      if ((st.max - st.min) / (st.step || 1) > 101) problems.push(`${where}: range ${st.id} has more than 101 steps`);
    }
    if (st.type === 'richtext' && st.default != null && !/^\s*<(p|ul)[\s>]/i.test(st.default)) problems.push(`${where}: richtext ${st.id} default must start with <p> or <ul>`);
    if (st.type === 'inline_richtext' && st.default != null && /<p[\s>]|\n/.test(st.default)) problems.push(`${where}: inline_richtext ${st.id} default can't have <p> or line breaks`);
    if (st.type === 'image_picker' && st.default !== undefined) problems.push(`${where}: image_picker ${st.id} can't have a default`);
    if (st.type === 'select' && !(Array.isArray(st.options) && st.options.length)) problems.push(`${where}: select ${st.id} needs options`);
    if (st.type === 'select' && st.default != null && !st.options.some((o) => o.value === st.default)) problems.push(`${where}: select ${st.id} default isn't one of its options`);
    if (st.type === 'color' && st.default != null && !color.isHex(st.default)) problems.push(`${where}: color ${st.id} default isn't a hex color`);
  }
  return ids;
}

// A section file -> a list of problems (empty means it follows the rules).
function checkSection(liquid) {
  const problems = [];
  const src = String(liquid || '');
  const bytes = Buffer.byteLength(src, 'utf8');
  if (bytes > RULES.limits.liquidFileKB * 1024) problems.push(`file is ${Math.round(bytes / 1024)} KB, over ${RULES.limits.liquidFileKB} KB`);
  const tags = src.match(/{%-?\s*schema\s*-?%}/g) || [];
  if (tags.length !== 1) return [...problems, `needs exactly one {% schema %} tag (found ${tags.length})`];
  const m = src.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  if (!m) return [...problems, 'schema tag is not closed'];
  let schema;
  try {
    schema = JSON.parse(m[1]);
  } catch (e) {
    return [...problems, `schema isn't valid JSON: ${e.message}`];
  }
  // The schema can't sit inside another Liquid tag: nothing may open before it without closing.
  const before = src.slice(0, m.index).replace(/{%\s*comment\s*%}[\s\S]*?{%\s*endcomment\s*%}/g, '');
  const opens = (before.match(/{%-?\s*(if|for|unless|case|capture|form)\b/g) || []).length;
  const closes = (before.match(/{%-?\s*end(if|for|unless|case|capture|form)\b/g) || []).length;
  if (opens !== closes) problems.push('the schema sits inside another Liquid tag');
  for (const k of Object.keys(schema)) if (!RULES.schema.attributes.includes(k)) problems.push(`unknown schema attribute ${k}`);
  if (!schema.name || String(schema.name).length > RULES.limits.schemaName) problems.push(`schema name must be 1 to ${RULES.limits.schemaName} characters`);
  if (schema.tag && !RULES.schema.tagValues.includes(schema.tag)) problems.push(`tag must be one of ${RULES.schema.tagValues.join(', ')}`);
  if (schema.limit != null && !RULES.schema.limitValues.includes(schema.limit)) problems.push('limit must be 1 or 2');
  if (schema.enabled_on && schema.disabled_on) problems.push('use only one of enabled_on or disabled_on');
  const sectionIds = checkSettings(schema.settings, 'section', problems);
  const blockTypes = new Set();
  const blockNames = new Set();
  const blockIds = new Set();
  for (const b of schema.blocks || []) {
    for (const k of RULES.schema.blockRequired) if (!b[k]) problems.push(`a block is missing ${k}`);
    if (blockTypes.has(b.type)) problems.push(`block type ${b.type} is used twice`);
    if (blockNames.has(b.name)) problems.push(`block name ${b.name} is used twice`);
    blockTypes.add(b.type);
    blockNames.add(b.name);
    for (const id of checkSettings(b.settings, `block ${b.type}`, problems)) blockIds.add(id);
  }
  if (schema.max_blocks != null && (schema.max_blocks < 1 || schema.max_blocks > RULES.limits.blocksPerSection)) problems.push(`max_blocks must be 1 to ${RULES.limits.blocksPerSection}`);
  for (const p of schema.presets || []) {
    for (const k of RULES.schema.presetRequired) if (!p[k]) problems.push(`a preset is missing ${k}`);
    for (const pb of p.blocks || []) {
      if (!blockTypes.has(pb.type)) problems.push(`preset block type ${pb.type} isn't defined`);
      for (const k of Object.keys(pb.settings || {})) if (!blockIds.has(k)) problems.push(`preset block setting ${k} isn't defined`);
    }
    if ((p.blocks || []).length > (schema.max_blocks || RULES.limits.blocksPerSection)) problems.push('preset has more blocks than max_blocks');
  }
  if (!(schema.presets || []).length) problems.push("no preset, so it won't show under Add section");
  // Every setting the markup reads must exist (catches typos before the member sees a blank).
  const body = src.slice(0, m.index);
  for (const [, id] of body.matchAll(/section\.settings\.([a-z0-9_]+)/g)) if (!sectionIds.has(id)) problems.push(`markup reads section.settings.${id}, which isn't defined`);
  for (const [, id] of body.matchAll(/block\.settings\.([a-z0-9_]+)/g)) if (!blockIds.has(id)) problems.push(`markup reads block.settings.${id}, which isn't defined`);
  // Liquid isn't rendered inside {% stylesheet %}.
  const sheet = src.match(/{%\s*stylesheet\s*%}([\s\S]*?){%\s*endstylesheet\s*%}/);
  if (sheet && /{{|{%/.test(sheet[1])) problems.push('Liquid inside {% stylesheet %} is not rendered');
  // Tags opened in the markup are closed.
  for (const t of ['if', 'for', 'unless', 'case', 'form', 'style', 'comment']) {
    const o = (body.match(new RegExp(`{%-?\\s*${t}\\b`, 'g')) || []).length;
    const cl = (body.match(new RegExp(`{%-?\\s*end${t}\\b`, 'g')) || []).length;
    if (o !== cl) problems.push(`{% ${t} %} opened ${o} times, closed ${cl}`);
  }
  if (/<script\b/i.test(src)) problems.push('has a script tag');
  return problems;
}

// ---------- facts -> section content ----------
// f: { name, city, what, shipping, returns, made, materials: [{ name, note }], faq: [{ q, a }],
//      stockists: [{ name, place }], first, freeShipping } (all from the member or their store).
function build(f, { set = 'All seven sections', seed, accent } = {}) {
  const c = colorsFor(seed, accent);
  const ids = SETS[set] || SETS['All seven sections'];
  return { colors: c, sections: ids.map((id) => BUILDERS[id](f, c)) };
}

// A line left for the member's own words: "[Add a line on why you started.]" (never contact[email] or JSON).
const PLACEHOLDER = /\[[A-Z][a-z]+(?: [^\][\n"]+)+\]/;

module.exports = { build, liquidOf, checkSection, schemaOf, colorsFor, svgIcon, SETS, ICONS, PREFIX, PLACEHOLDER, RULES };
