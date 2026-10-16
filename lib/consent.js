// Email consent wording for every pre-launch form, from Legal (legal/handoffs/launch-email-consent-and-challenge.md §1).
//
// JOIN_IS_LAUNCH_CONSENT=true   joining (or taking a lead magnet before the founding close) is consent to
//                               launch emails until the close; the box is only the ongoing digest after it.
// unset / false (default)       Eli's standing rule: only a ticked box gets launch or ongoing email.
//                               The confirm link and the requested result or guide go to everyone.
//
// Every joiner and lead stores a consent record (time, page, wording version, box, hashed IP) for 5 years.

const launch = require('./launch');

const TERMS_JOIN = 'By joining, you confirm you\'re 18 or older and agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.';
const TERMS_CONTINUE = 'By continuing, you confirm you\'re 18 or older and agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.';
const THING = { 'founder-score': 'results', 'idea-test': 'results', 'day-one-stack': 'guide' };

function on() {
  return process.env.JOIN_IS_LAUNCH_CONSENT === 'true';
}

// Launch emails stop at the founding close; after it the lead-magnet wording drops launch news.
function beforeClose() {
  const closes = launch.date('FOUNDING_CLOSES_AT');
  return !closes || Date.now() < closes;
}

// page: 'founding' or a lead source ('founder-score', 'day-one-stack', 'idea-test').
// box and line are plain text; terms is trusted HTML (links).
function copy(page) {
  const flag = on() ? 'on' : 'off';
  if (page === 'founding') {
    return flag === 'on'
      ? { version: 'founding-on-v1', box: "Also send me Eli's founder emails and the weekly digest after November 24.", line: "We'll email your confirm link, then launch updates, the Day One Challenge invite and founding-price reminders until doors close on November 24. Unsubscribe anytime.", terms: TERMS_JOIN }
      : { version: 'founding-off-v1', box: "Send me launch news, founding-price reminders, and Eli's founder emails and weekly digest.", line: "Without a tick, we'll only email your confirm link. Tick it to hear when doors open and before the founding price ends. Unsubscribe anytime.", terms: TERMS_JOIN };
  }
  const thing = THING[page] || 'results';
  if (!beforeClose()) {
    return { version: `${page}-after-v1`, box: "Also send me Eli's founder emails and the weekly digest.", line: `We'll email your ${thing}. Unsubscribe anytime.`, terms: TERMS_CONTINUE };
  }
  return flag === 'on'
    ? { version: `${page}-on-v1`, box: "Also send me Eli's founder emails and the weekly digest after November 24.", line: `We'll email your ${thing} and add you to the founding list, so you'll also get launch updates until doors close on November 24. Unsubscribe anytime.`, terms: TERMS_CONTINUE }
    : { version: `${page}-off-v1`, box: "Also send me launch news, founding-price reminders, and Eli's founder emails and weekly digest.", line: `We'll email your ${thing}. Unsubscribe anytime.`, terms: TERMS_CONTINUE };
}

// What a joiner agreed to. Off: the box covers both. On: joining covers launch emails until the close.
function optins(box) {
  return { launch_optin: on() ? beforeClose() : !!box, ongoing_optin: !!box };
}

function record(page, box, ipHash) {
  return { at: new Date().toISOString(), page, version: copy(page).version, box: !!box, ipHash: ipHash || null };
}

module.exports = { on, copy, optins, record, beforeClose };
