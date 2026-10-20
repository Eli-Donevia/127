// What every app-making tool hands back: the app checked and hardened, saved as a ZIP with a
// preview, and the same short view. Plus the input fields the tools share.

const { views, text } = require('../../_kit');
const { validate, harden, summary } = require('./validate');
const { saveApp } = require('./app-file');

const FACT_FIELDS = {
  business: { type: 'string', title: 'Business name (optional)', maxLength: 80 },
  prices: { type: 'string', title: 'Services and prices (optional)', description: 'One per line, like "Deep clean, $240" or "Labor $65/hr". Start a line with "Add-on:" for extras.', format: 'textarea', maxLength: 4000 },
  phone: { type: 'string', title: 'Phone (optional)', maxLength: 30 },
  email: { type: 'string', title: 'Email (optional)', maxLength: 120 },
  link: { type: 'string', title: 'Booking or payment link (optional)', description: 'An https link', maxLength: 300 },
  color: { type: 'string', title: 'Brand color (optional)', description: 'A hex code like #2dd4bf or a word like "teal"', maxLength: 30 },
};

const APP_OUTPUT = {
  type: 'object',
  properties: {
    app: { type: 'object' },
    zip: { type: 'object' },
    preview: { type: 'object' },
    notes: { type: 'array', items: { type: 'string' } },
    ai: { type: 'boolean' },
    sample: { type: 'boolean' },
  },
  required: ['app', 'zip', 'preview', 'notes'],
};

// html must already be built; checks it, hardens it, saves it. Throws when it doesn't pass (our own
// starters always pass; the tests check every one).
async function deliver(ctx, html, { business, title, starter, notes = [], ai = false, sample = false, listed = false, maxBytes }) {
  const safe = harden(html);
  const v = validate(safe, maxBytes ? { maxBytes } : {});
  if (!v.ok) throw new Error(`That app didn't pass the safety check. ${summary(v)}`);
  const files = await saveApp(ctx, safe, { business, title, listed });
  ctx.log(`Built ${title} (${Math.round(v.bytes / 1024)} KB), passed every safety check`);
  return {
    app: { title: text.clip(title, 80), starter: starter || 'custom', kb: Math.max(1, Math.round(v.bytes / 1024)), checks: 'passed' },
    zip: files.zip,
    preview: files.preview,
    notes: notes.filter(Boolean).map((n) => text.clip(n, 300)),
    ai: !!ai,
    sample: !!sample,
  };
}

function appView(out, label = 'Your app') {
  return views.blocks(
    views.sampleNote(out, 'This app'),
    views.metric(label, out.app.title, `${out.app.kb} KB, one file, works offline. Safety check: ${out.app.checks}.`),
    ...(out.notes || []).map((n) => views.text(n)),
    views.file(out.zip, 'Your app (ZIP). Unzip it and open index.html in any browser, or drag the ZIP onto app.netlify.com/drop to put it online.'),
    views.file(out.preview, 'Preview (the layout only; buttons work in the real app)'),
    views.text('What it saves stays in the browser it was used in, on that device only. Nothing is sent anywhere.')
  );
}

module.exports = { deliver, appView, FACT_FIELDS, APP_OUTPUT };
