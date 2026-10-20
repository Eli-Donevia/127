// The rules the AI gets when it writes or changes an app. The validator checks every one of them
// afterwards, so a rule the model skips sends the member the closest ready-made app instead.

const { CSP } = require('./shell');

const RULES = [
  'Write one complete HTML file: <!doctype html>, <html>, <head>, <body>. All CSS in one <style> tag, all JavaScript in <script> tags in the same file.',
  'It must work with no internet. Never load anything from outside the file: no script src, no link tags, no web fonts, no images or icons from URLs, no CDNs, no @import. Draw icons with CSS or inline SVG.',
  'Never send or load data: no fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, workers, import(), and no internet addresses in the code. Forms never post anywhere: no action attribute, no method="post"; handle submit in JavaScript with preventDefault.',
  'No eval, no new Function, no setTimeout or setInterval with a string, no document.write, no cookies, no window.open, no changing location, no iframes, objects or embeds.',
  'Save data only with localStorage, under keys that start with the app name, wrapped in try and catch. Say on the page that saved data stays in this browser on this device only. Offer a CSV download (a Blob and an a element with download) or a Copy button wherever records are kept.',
  'Mobile first: one column at phone width, max-width about 760px centered, inputs at least 44px tall with font-size 16px, no sideways scrolling.',
  `Look: near-black page (#0a0a0a), panels #141414 with 1px #262626 borders and 16px radius, text #fafafa, muted text #a3a3a3, font-family "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif. Buttons are pills (border-radius 999px); the main button uses the accent color given.`,
  'Plain words a busy owner understands. No emoji, no long dashes, no lorem ipsum, no made-up reviews or numbers. Use the business name, services and prices given; where prices are missing, use clearly labeled examples the owner can edit.',
  'Keep it under 60 KB. Plain modern JavaScript that runs in Safari and Chrome on phones.',
  `The page gets this content security policy, so anything it blocks will break: ${CSP}.`,
];

function businessBlock(f) {
  return [
    `Business: ${f.business}${f.what ? ` (${f.what})` : ''}${f.city ? ` in ${f.city}` : ''}`,
    `Accent color: ${f.accent.accent} (text on it: ${f.accent.onAccent})`,
    f.phone ? `Phone: ${f.phone}` : '',
    f.email ? `Email: ${f.email}` : '',
    f.booking ? `Booking or payment link: ${f.booking}` : '',
    `Services and prices${f.sampleItems ? ' (examples, label them as examples)' : ''}:\n${f.items.map((x) => `- ${x.name}: $${x.price}${x.unit ? ` per ${x.unit}` : ''}${x.detail ? ` (${x.detail})` : ''}`).join('\n')}`,
  ].filter(Boolean).join('\n');
}

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 60 },
    html: { type: 'string', maxLength: 200000 },
    changes: { type: 'string', maxLength: 600 },
  },
  required: ['title', 'html'],
};

module.exports = { RULES, businessBlock, SCHEMA };
