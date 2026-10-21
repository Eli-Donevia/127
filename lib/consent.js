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
const THING = { 'founder-score': 'results', 'idea-test': 'results', 'day-one-stack': 'guide', 'first-25': 'list', 'store-audit': 'audit', 'brand-list': 'list', 'site-tonight': 'site', 'offer-score': 'results' };

function on() {
  return process.env.JOIN_IS_LAUNCH_CONSENT === 'true';
}

// Who gets the founding confirm email (lib/waitlist.js sendConfirm) and which form line shows. Without Klaviyo,
// everyone. With Klaviyo, only a ticked box (or JOIN_IS_LAUNCH_CONSENT), unless Eli approves D15
// (CONFIRM_EMAIL_TO_ALL=true): then every joiner gets the link and the form goes back to founding-off-v1
// (Legal + Offer's condition, Oct 16).
function confirmToAll() {
  return !process.env.KLAVIYO_PRIVATE_KEY || process.env.CONFIRM_EMAIL_TO_ALL === 'true';
}

// Launch emails stop at the founding close; after it the lead-magnet wording drops launch news.
function beforeClose() {
  const closes = launch.date('FOUNDING_CLOSES_AT');
  return !closes || Date.now() < closes;
}

// page: 'founding', 'challenge' or a lead source ('founder-score', 'day-one-stack', 'idea-test', 'first-25', or a front
// door: 'store-audit', 'brand-list', 'site-tonight', 'offer-score', which use First 25's wording with their own thing).
// box and line are plain text; terms is trusted HTML (links).
function copyV1Challenge(flag) {
  return flag === 'on'
    ? { version: 'challenge-on-v1', box: "Also send me Eli's founder emails and the weekly digest after November 24.", line: "You'll get one email a day from November 9 to 13, then founding-member updates until doors close on November 24. Unsubscribe anytime.", terms: TERMS_JOIN }
    : { version: 'challenge-off-v1', box: "Also send me launch news, founding-price reminders, and Eli's founder emails and weekly digest.", line: "You'll get the challenge: one email a day from November 9 to 13, reminders for the two lives, your wrap-up and, if you finish, your early-access link. Unsubscribe anytime.", terms: TERMS_JOIN };
}
function copy(page) {
  const flag = on() ? 'on' : 'off';
  if (page === 'challenge') {
    // The 14-day challenge (CHALLENGE_DAYS=v2) says its own dates and records its own version. Same wording otherwise.
    if (process.env.CHALLENGE_DAYS === 'v2') {
      const c = copyV1Challenge(flag);
      return { ...c, version: c.version.replace(/-v1$/, '-v2'), line: c.line.replace('November 9 to 13', 'November 3 to 16') };
    }
    return copyV1Challenge(flag);
  }
  if (page === 'founding') {
    return flag === 'on'
      ? { version: 'founding-on-v1', box: "Also send me Eli's founder emails and the weekly digest after November 24.", line: "We'll email your confirm link, then launch updates, the Day One Challenge invite and founding-price reminders until doors close on November 24. Unsubscribe anytime.", terms: TERMS_JOIN }
      : confirmToAll()
        ? { version: 'founding-off-v1', box: "Send me launch news, founding-price reminders, and Eli's founder emails and weekly digest.", line: "Without a tick, we'll only email your confirm link. Tick it to hear when doors open and before the founding price ends. Unsubscribe anytime.", terms: TERMS_JOIN }
        // Offer flag 5: while the always-send confirm patch (D15) waits for Eli, unticked joiners get no email at all
        // once Klaviyo is on, so the line can't promise a confirm link.
        : { version: 'founding-off-noconfirm-v1', box: "Send me launch news, founding-price reminders, and Eli's founder emails and weekly digest.", line: "Without a tick, we won't email you. Tick it to get your confirm link and hear when doors open and before the founding price ends. Unsubscribe anytime.", terms: TERMS_JOIN };
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

module.exports = { confirmToAll, on, copy, optins, record, beforeClose };
