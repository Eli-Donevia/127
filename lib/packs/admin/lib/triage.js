// Sorting email into four piles by rules a person can read: reply today, reply this week, FYI and
// ignore. Used on its own when AI is off, and to check the AI's answer. Each result says why.
// Also the template replies used when AI is off: every draft has [brackets] for what only the
// member knows, and nothing is sent.

const { findDate, daysBetween } = require('./dates');

const BUCKETS = ['today', 'week', 'fyi', 'ignore'];
const LABELS = { today: 'Reply today', week: 'Reply this week', fyi: 'FYI', ignore: 'Ignore' };

const NO_REPLY = /\b(no-?reply|donotreply|do-not-reply|notifications?|mailer-daemon|alerts?|updates?|news|newsletter|marketing|promo(tions)?|deals)@|@(e\.|news\.|mailer\.|notifications?\.)/i;
const PROMO = /(\d+%\s*off|\bsale\b|limited time|ends (tonight|today|soon)|special offer|exclusive (offer|deal)|act now|free trial|black friday|cyber monday|discount code|coupon|deal of the|flash sale|webinar|register now|save your seat|last day to)/i;
const PITCH = /\b(seo|rank (your site|higher|on google)|first page of google|web ?design services|lead gen(eration)?|more\s+leads?|grow your (business|sales|revenue)|book a (quick |short )?call|quick call|15[- ]minute (call|chat)|partnership opportunity|guest post|backlinks?|outsourc(e|ing)|virtual assistant services|we (help|work with) businesses like yours|i came across your (website|business))\b/i;
const NOTICE = /\b(receipt|your order|order (confirmed|confirmation)|has shipped|shipping (update|confirmation)|delivered|statement (is )?(ready|available)|payment (received|processed|confirmation)|invoice paid|you (were|have been) paid|password|security (alert|code)|verification code|sign-?in|log-?in attempt|newsletter|digest|weekly (update|summary)|monthly (update|summary)|terms of service|privacy policy|automatic reply|out of (the )?office)\b/i;
const URGENT = /\b(today|tonight|asap|a\.s\.a\.p|urgent|urgently|right away|immediately|this morning|this afternoon|by (noon|eod|end of (the )?day|tonight)|emergency|leak(ing)?|flood(ing|ed)?|no (power|heat|water|hot water)|broken|locked out|cancel(l?ing|l?ed)?|refund|complain(t|ing)?|unhappy|disappointed|not happy|upset|wrong|mistake|damaged|missed (appointment|visit)|didn't show|no[- ]show)\b/i;
const ASK = /\?|\b(can you|could you|would you|will you|please|let me know|are you (available|free|open)|do you (have|offer|do)|how much|what('s| is) the (price|cost|rate)|quote|estimate|when can|is it possible|send (me|over)|confirm|reschedul\w*|book(ing)?|appointment|availability)\b/i;
const MONEY = /\b(invoice|deposit|payment|pay|paid|balance|quote|estimate|price|refund|charge|bill)\b|\$\s?\d/i;

function classifyByRules(m, { today, known = [] } = {}) {
  const text = `${m.subject}\n${m.body}`;
  const from = String(m.from || '');
  const isKnown = known.some((k) => k && from.includes(k));
  if (m.autoReply) return { bucket: 'fyi', why: 'An automatic reply.' };
  if (!isKnown && PITCH.test(text) && !/\b(invoice|your (job|quote|estimate|appointment|booking))\b/i.test(text)) return { bucket: 'ignore', why: 'A sales pitch from someone you have not worked with.' };
  if (PROMO.test(text) && (m.unsubscribe || m.bulk || NO_REPLY.test(from))) return { bucket: 'ignore', why: 'A promotion or ad from a mailing list.' };
  if (NO_REPLY.test(from) || NOTICE.test(m.subject) || (m.bulk && m.unsubscribe)) {
    if (URGENT.test(m.subject) && /\b(security|password|sign-?in|payment (failed|declined)|account (locked|suspended))\b/i.test(text)) return { bucket: 'today', why: 'An account or payment alert to check today (open the site yourself, not a link in the email).' };
    return { bucket: 'fyi', why: NOTICE.test(m.subject) ? 'A receipt, notice or update. Nothing to answer.' : 'Sent from an address that does not take replies.' };
  }
  const due = findDate(text, today || '2026-01-01');
  const soon = due && today ? daysBetween(today, due.date) : null;
  const asks = ASK.test(text);
  if (URGENT.test(text) || (asks && soon != null && soon >= 0 && soon <= 1)) {
    const word = (text.match(URGENT) || [])[0];
    return { bucket: 'today', why: word ? `Time matters: "${word.toLowerCase()}".` : `They need an answer by ${due.match}.` };
  }
  const relaxed = /\b(no rush|no hurry|not urgent|whenever (you|is)|when you (get|have) a (chance|minute)|any ?time (this|next|in the next)|next couple of weeks)\b/i.test(text);
  if (asks && MONEY.test(text) && !relaxed) return { bucket: 'today', why: 'A question about money: a quote, payment or invoice.' };
  if (asks) return { bucket: 'week', why: soon != null && soon <= 7 && soon >= 0 ? `They asked something, needed ${due.match}.` : 'They asked you something, with no rush.' };
  return { bucket: 'fyi', why: 'Nothing to answer: no question or request.' };
}

function kindOf(m) {
  const t = `${m.subject}\n${m.body}`;
  if (/\b(complain\w*|unhappy|disappointed|not happy|upset|wrong|mistake|damaged|missed|didn't show|no[- ]show|refund)\b/i.test(t)) return 'problem';
  if (/\b(reschedul\w*|move (my|our|the) (appointment|visit|booking)|cancel\w*|available|availability|book(ing)?|appointment|what time|which day|come (by|out))\b/i.test(t)) return 'schedule';
  if (MONEY.test(t)) return 'money';
  return 'question';
}

const firstOf = (name, email) => {
  const n = String(name || '').trim().split(/\s+/)[0];
  if (n && /^[A-Za-z][A-Za-z'-]{1,20}$/.test(n)) return n;
  const local = String(email || '').split('@')[0].split(/[._-]/)[0];
  return /^[a-z]{2,15}$/i.test(local) && !/^(info|hello|team|office|admin|contact|sales|support|billing)$/i.test(local) ? local[0].toUpperCase() + local.slice(1).toLowerCase() : '';
};

// A template reply for a message that needs one today. [Brackets] are for the member to fill in.
function templateReply(m, { me = '', business = '' } = {}) {
  const hi = firstOf(m.fromName, m.from) ? `Hi ${firstOf(m.fromName, m.from)},` : 'Hi,';
  const sign = [me || '[Your name]', business].filter(Boolean).join('\n');
  const subject = /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`;
  const kind = kindOf(m);
  const body = {
    problem: `Thanks for telling me, and I'm sorry this happened. I want to put it right.\n\nHere is what I can do: [what you will do, and by when].\n\nIf a quick call is easier, I'm free [a time today].`,
    schedule: `Thanks for the note. I can do [day and time] or [another day and time]. Which works better for you?\n\nOnce you pick one, I'll confirm it here.`,
    money: `Thanks for asking. [The answer: the amount, what it covers, and how to pay or when it is due].\n\nIf anything looks off, reply here and I'll sort it out today.`,
    question: `Thanks for reaching out. [Your answer].\n\nLet me know if you need anything else.`,
  }[kind];
  return { subject, to: m.from, body: `${hi}\n\n${body}\n\n${sign}`, kind };
}

module.exports = { classifyByRules, templateReply, kindOf, firstOf, BUCKETS, LABELS, PITCH, PROMO, NOTICE, URGENT };
