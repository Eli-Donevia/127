{% comment %}
  Hero split
  An image beside a headline, a short paragraph and two buttons.
  For Online Store 2.0 themes (Dawn and others). All styles are scoped to this section's id.
  No outside requests: images come from your own store, the placeholder is inline SVG.
{% endcomment %}

{%- assign sx_accent_brightness = section.settings.color_accent | color_brightness -%}
{%- if sx_accent_brightness > 160 -%}
  {%- assign sx_on_accent = '#111111' -%}
{%- else -%}
  {%- assign sx_on_accent = '#ffffff' -%}
{%- endif -%}

{%- style -%}
  #sx-hero-{{ section.id }} {
    --sx-bg: {{ section.settings.color_background }};
    --sx-fg: {{ section.settings.color_text }};
    --sx-accent: {{ section.settings.color_accent }};
    --sx-on-accent: {{ sx_on_accent }};
    background: var(--sx-bg);
    color: var(--sx-fg);
    padding-top: {{ section.settings.padding_top | times: 0.6 | round: 0 }}px;
    padding-bottom: {{ section.settings.padding_bottom | times: 0.6 | round: 0 }}px;
  }
  @media screen and (min-width: 750px) {
    #sx-hero-{{ section.id }} {
      padding-top: {{ section.settings.padding_top }}px;
      padding-bottom: {{ section.settings.padding_bottom }}px;
    }
  }
  #sx-hero-{{ section.id }} .sx-hero__inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
    display: grid;
    gap: 32px;
    align-items: center;
  }
  @media screen and (min-width: 750px) {
    #sx-hero-{{ section.id }} .sx-hero__inner {
      grid-template-columns: 1fr 1fr;
      gap: 72px;
      padding: 0 40px;
    }
    #sx-hero-{{ section.id }} .sx-hero--image-right .sx-hero__media { order: 2; }
  }
  #sx-hero-{{ section.id }} .sx-hero__media {
    position: relative;
    overflow: hidden;
    border-radius: {{ section.settings.corner_radius }}px;
    aspect-ratio: {{ section.settings.image_ratio }};
    background: color-mix(in srgb, var(--sx-fg) 6%, var(--sx-bg));
  }
  #sx-hero-{{ section.id }} .sx-hero__media img,
  #sx-hero-{{ section.id }} .sx-hero__media svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.02);
    transition: transform 1.2s cubic-bezier(.2, .7, .2, 1);
  }
  #sx-hero-{{ section.id }} .sx-hero__media:hover img { transform: scale(1.05); }
  #sx-hero-{{ section.id }} .sx-hero__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 18px;
    font-size: 13px;
    letter-spacing: .14em;
    text-transform: uppercase;
    opacity: .75;
  }
  #sx-hero-{{ section.id }} .sx-hero__eyebrow::before {
    content: "";
    width: 28px;
    height: 2px;
    background: var(--sx-accent);
    border-radius: 2px;
  }
  #sx-hero-{{ section.id }} .sx-hero__heading {
    margin: 0 0 20px;
    font-family: var(--font-heading-family, inherit);
    font-weight: var(--font-heading-weight, 600);
    line-height: 1.05;
    letter-spacing: -.02em;
    color: var(--sx-fg);
    font-size: {%- case section.settings.heading_size -%}{%- when 'small' -%}clamp(30px, 4vw, 44px){%- when 'large' -%}clamp(42px, 7vw, 84px){%- else -%}clamp(36px, 5.4vw, 64px){%- endcase -%};
  }
  #sx-hero-{{ section.id }} .sx-hero__text {
    font-size: 17px;
    line-height: 1.6;
    max-width: 34em;
    opacity: .85;
  }
  #sx-hero-{{ section.id }} .sx-hero__text p { margin: 0 0 12px; }
  #sx-hero-{{ section.id }} .sx-hero__buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 28px;
  }
  #sx-hero-{{ section.id }} .sx-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 26px;
    border-radius: {{ section.settings.button_radius }}px;
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
    transition: transform .2s ease, box-shadow .2s ease, background-color .2s ease;
  }
  #sx-hero-{{ section.id }} .sx-btn--primary {
    background: var(--sx-accent);
    color: var(--sx-on-accent);
    box-shadow: 0 8px 24px -12px var(--sx-accent);
  }
  #sx-hero-{{ section.id }} .sx-btn--secondary {
    color: var(--sx-fg);
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--sx-fg) 35%, transparent);
  }
  #sx-hero-{{ section.id }} .sx-btn:hover { transform: translateY(-2px); }
  #sx-hero-{{ section.id }} .sx-btn--secondary:hover { box-shadow: inset 0 0 0 1.5px var(--sx-fg); }
  #sx-hero-{{ section.id }} .sx-btn:focus-visible {
    outline: 2px solid var(--sx-fg);
    outline-offset: 3px;
  }
  #sx-hero-{{ section.id }} .sx-hero__content > * {
    animation: sx-hero-rise-{{ section.id }} .8s cubic-bezier(.2, .7, .2, 1) both;
  }
  #sx-hero-{{ section.id }} .sx-hero__content > *:nth-child(2) { animation-delay: .08s; }
  #sx-hero-{{ section.id }} .sx-hero__content > *:nth-child(3) { animation-delay: .16s; }
  #sx-hero-{{ section.id }} .sx-hero__content > *:nth-child(4) { animation-delay: .24s; }
  @keyframes sx-hero-rise-{{ section.id }} {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    #sx-hero-{{ section.id }} .sx-hero__content > * { animation: none; }
    #sx-hero-{{ section.id }} .sx-hero__media img,
    #sx-hero-{{ section.id }} .sx-btn { transition: none; transform: none; }
  }
{%- endstyle -%}

<div id="sx-hero-{{ section.id }}" class="sx-hero">
  <div class="sx-hero__inner sx-hero--image-{{ section.settings.image_position }}">
    <div class="sx-hero__media">
      {%- if section.settings.image != blank -%}
        {{
          section.settings.image
          | image_url: width: 1800
          | image_tag:
            loading: 'eager',
            fetchpriority: 'high',
            widths: '500, 800, 1100, 1400, 1800',
            sizes: '(min-width: 750px) 50vw, 100vw',
            alt: section.settings.image.alt
        }}
      {%- else -%}
        {{ 'lifestyle-1' | placeholder_svg_tag: 'sx-hero__placeholder' }}
      {%- endif -%}
    </div>
    <div class="sx-hero__content">
      {%- if section.settings.eyebrow != blank -%}
        <p class="sx-hero__eyebrow">{{ section.settings.eyebrow }}</p>
      {%- endif -%}
      {%- if section.settings.heading != blank -%}
        <h2 class="sx-hero__heading">{{ section.settings.heading }}</h2>
      {%- endif -%}
      {%- if section.settings.text != blank -%}
        <div class="sx-hero__text">{{ section.settings.text }}</div>
      {%- endif -%}
      {%- if section.settings.button_label_1 != blank or section.settings.button_label_2 != blank -%}
        <div class="sx-hero__buttons">
          {%- if section.settings.button_label_1 != blank -%}
            <a class="sx-btn sx-btn--primary" href="{{ section.settings.button_link_1 | default: routes.all_products_collection_url }}">{{ section.settings.button_label_1 }}</a>
          {%- endif -%}
          {%- if section.settings.button_label_2 != blank -%}
            <a class="sx-btn sx-btn--secondary" href="{{ section.settings.button_link_2 | default: routes.collections_url }}">{{ section.settings.button_label_2 }}</a>
          {%- endif -%}
        </div>
      {%- endif -%}
    </div>
  </div>
</div>

{% schema %}
{
  "name": "Hero split",
  "tag": "section",
  "class": "sx-section",
  "disabled_on": { "groups": ["header", "footer"] },
  "settings": [
    { "type": "image_picker", "id": "image", "label": "Image" },
    {
      "type": "select",
      "id": "image_position",
      "label": "Image position on desktop",
      "options": [
        { "value": "left", "label": "Left" },
        { "value": "right", "label": "Right" }
      ],
      "default": "left"
    },
    {
      "type": "select",
      "id": "image_ratio",
      "label": "Image shape",
      "options": [
        { "value": "1 / 1", "label": "Square" },
        { "value": "4 / 5", "label": "Portrait" },
        { "value": "4 / 3", "label": "Landscape" }
      ],
      "default": "4 / 5"
    },
    { "type": "range", "id": "corner_radius", "label": "Image corner radius", "min": 0, "max": 40, "step": 2, "unit": "px", "default": 16 },
    { "type": "header", "content": "Text" },
    { "type": "text", "id": "eyebrow", "label": "Small line above the heading", "default": "{{business.name}}" },
    { "type": "text", "id": "heading", "label": "Heading", "default": "Made with care, built to last" },
    {
      "type": "select",
      "id": "heading_size",
      "label": "Heading size",
      "options": [
        { "value": "small", "label": "Small" },
        { "value": "medium", "label": "Medium" },
        { "value": "large", "label": "Large" }
      ],
      "default": "medium"
    },
    {
      "type": "richtext",
      "id": "text",
      "label": "Text",
      "default": "<p>{{business.name}} makes thoughtful everyday goods, from {{business.city|our studio}} to your door. Say what you make and who it is for here.</p>"
    },
    { "type": "header", "content": "Buttons" },
    { "type": "text", "id": "button_label_1", "label": "First button label", "default": "Shop all", "info": "Leave the label empty to hide the button." },
    { "type": "url", "id": "button_link_1", "label": "First button link", "default": "/collections/all" },
    { "type": "text", "id": "button_label_2", "label": "Second button label", "default": "Browse collections" },
    { "type": "url", "id": "button_link_2", "label": "Second button link", "default": "/collections" },
    { "type": "range", "id": "button_radius", "label": "Button corner radius", "min": 0, "max": 40, "step": 2, "unit": "px", "default": 40 },
    { "type": "header", "content": "Colors" },
    { "type": "color", "id": "color_background", "label": "Background", "default": "#FAF9F6" },
    { "type": "color", "id": "color_text", "label": "Text", "default": "#111111" },
    { "type": "color", "id": "color_accent", "label": "Brand color (buttons and accents)", "default": "{{brand.color|#111111}}", "info": "Button text switches between dark and light on its own so it stays readable." },
    { "type": "header", "content": "Spacing" },
    { "type": "range", "id": "padding_top", "label": "Top padding", "min": 0, "max": 120, "step": 4, "unit": "px", "default": 64 },
    { "type": "range", "id": "padding_bottom", "label": "Bottom padding", "min": 0, "max": 120, "step": 4, "unit": "px", "default": 64 }
  ],
  "presets": [
    { "name": "Hero split" }
  ]
}
{% endschema %}
