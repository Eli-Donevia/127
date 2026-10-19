// One short, personal text per person, in the member's voice. The member is the sender. Straight
// apostrophes only so a text stays in one cheap encoding; aims for 2 SMS segments or fewer.

const { text } = require('../../_kit');

const GSM = /^[A-Za-z0-9 @£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/;

function segments(s) {
  const t = String(s || '');
  const gsm = GSM.test(t);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return { chars: t.length, gsm, segments: t.length <= single ? 1 : Math.ceil(t.length / multi) };
}

function straight(s) {
  return String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, ', ').replace(/…/g, '...');
}

function firstName(p) {
  return (p.first || String(p.name || '').split(' ')[0] || 'there').replace(/[^A-Za-z'\-À-ÿ]/g, '') || 'there';
}

// A personal opener from the member's own note, or a plain one.
function openerOf(p, seed) {
  const n = String(p.note || '').toLowerCase();
  if (/new (baby)/.test(n)) return 'Hope you and the baby are doing well!';
  if (/new (house|home)|just moved/.test(n)) return 'Hope the new place is treating you well!';
  if (/puppy|dog/.test(n)) return 'How is the pup doing?';
  if (/coworker|co-worker|old boss/.test(n)) return 'Hope work is treating you well.';
  if (/church/.test(n)) return 'Good to see you around church.';
  if (/neighbou?r/.test(n)) return 'Hope all is good on the street!';
  return text.pickBy(seed, ['Hope you are doing well!', 'Been too long!', 'Hope your week is going well.', 'Thought of you today.']);
}

// what: "mobile car detailing"; need: "a car that needs a deep clean"
function draft(p, o, seed = '') {
  const first = firstName(p);
  const hi = text.pickBy(`${seed}hi`, ['Hi', 'Hey']);
  const open = openerOf(p, seed);
  const where = o.city ? ` here in ${o.city}` : '';
  const price = o.priceText ? ` at ${o.priceText}` : '';
  let body;
  if (p.group === 'buy') {
    body = text.pickBy(`${seed}buy`, [
      `I just started ${o.what}${where}, and I thought of you. I'm taking my first few customers now${price}. Want me to save you a spot? No pressure at all.`,
      `Quick one: I started ${o.what}${where}. I'm doing my first few${price}, and I'd love to do yours. Want me to save you a spot?`,
    ]);
  } else if (p.group === 'advise') {
    body = text.pickBy(`${seed}adv`, [
      `I just started ${o.what}, and you've been down this road. Could I ask you 3 quick questions sometime this week? 15 minutes, whenever suits you.`,
      `I'm starting ${o.what}, and I'd value your take. Could I buy you a coffee and ask what you wish you'd known at the start?`,
    ]);
  } else {
    body = text.pickBy(`${seed}ref`, [
      `I just started ${o.what}${where}. Do you know anyone who ${o.need}? I'd be grateful for an intro, and I'll take good care of them.`,
      `Quick favor: I started ${o.what}${where}. Do you know anyone who ${o.need}? Even one name helps a lot.`,
    ]);
  }
  const out = straight(text.plain(`${hi} ${first}! ${open} ${body}`));
  return { text: out, ...segments(out) };
}

module.exports = { draft, segments, straight, firstName, openerOf };
