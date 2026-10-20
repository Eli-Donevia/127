// The idea pack's shared pieces: who the member is, their idea in one line, the conversation
// questions (about what people did in the past, never "would you buy it?"), the offer the offer
// draft and landing page share, and reading a conversation log for the scorecard.

const path = require('path');
const { text, brain } = require('../../_kit');
const C = require('../../_kit/common');
const U = require('./util');

const { plain } = text;
const N = C.load(path.join(__dirname, '..'));

function me(ctx, input = {}) {
  const br = brain.brainOf(ctx, input);
  const mem = brain.packMemory(ctx, 'idea');
  return {
    first: br.firstName || '',
    name: plain(input.name || br.name || ''),
    idea: plain(input.idea || mem.idea || br.what || 'my idea'),
    who: plain(input.who || mem.who || br.audience || 'people who have this problem'),
    problem: plain(input.problem || mem.problem || ''),
    city: plain(input.city || br.place || ''),
    email: plain(input.email || ''),
  };
}

// Questions about what happened, what they did and what it cost them. No pitching, no "would you".
const QUESTIONS = [
  { q: 'Tell me about the last time {problem}.', why: 'A real, recent story. If they can\'t remember one, it isn\'t a big problem for them.' },
  { q: 'What did you do about it?', why: 'What they already do is what you compete with.' },
  { q: 'What have you tried so far? What did that cost you, in time or money?', why: 'People who already spend on a problem are the ones who pay to fix it.' },
  { q: 'What was the hardest part?', why: 'Their words for the problem: use them in your offer.' },
  { q: 'How often does it come up?', why: 'Weekly beats once a year.' },
  { q: 'Is there anyone else I should talk to about this?', why: 'Each good conversation can lead to the next one.' },
];
const AVOID = [
  'Would you buy this? (People say yes to be kind.)',
  'Do you like my idea? (Same: they will be nice.)',
  'How much would you pay? (A guess, not a fact. Ask what they pay now.)',
  'Explaining your idea for the first 10 minutes. (Listen first; show it at the end if they ask.)',
];

const problemPhrase = (m) => (m.problem ? m.problem.replace(/[.!?]$/, '') : `you dealt with ${m.idea.replace(/^(a|an|the) /i, '')}`);

function questionsFor(m) {
  const p = problemPhrase(m);
  return QUESTIONS.map((x) => ({ q: x.q.replace('{problem}', /^(you|your)\b/i.test(p) ? p : `you had to deal with ${p}`), why: x.why }));
}

// The offer the offer draft and the landing page share: only the member's words.
function offerOf(input, m) {
  const steps = C.linesOf(input.steps, 5).map((s) => plain(s).replace(/^[-*\d.)\s]+/, '').replace(/[.]$/, ''));
  const included = C.linesOf(input.included, 8).map((s) => plain(s).replace(/^[-*\s]+/, '').replace(/[.]$/, ''));
  const price = U.fit(plain(input.price || ''), 60);
  return {
    name: plain(input.offer_name || input.name || m.name || ''),
    who: m.who,
    problem: m.problem,
    what: plain(input.what || m.idea),
    steps: steps.length ? steps : ['You tell me what you need', 'I do the work', 'You check it and pay'],
    stepsTyped: steps.length > 0,
    included,
    price,
    first_offer: plain(input.first_offer || ''),
    contact: plain(input.email || m.email || ''),
  };
}

// Conversation log rows (from the first-25 CSV, an upload, or pasted lines) -> signals.
const YES = /^(y|yes|true|1|x|✓|yep|yeah)$/i;
const COLS = {
  name: ['name', 'person', 'who'],
  had: ['had the problem', 'had problem', 'problem recently', 'had it recently', 'recent'],
  spent: ['already spends', 'spent', 'spends time or money', 'pays now', 'paying now'],
  committed: ['committed', 'asked to buy', 'pre-order', 'preorder', 'deposit', 'signed up', 'commitment'],
  intro: ['intro', 'introduced someone', 'referral', 'who else'],
  notes: ['notes', 'their words', 'quote', 'note'],
  talked: ['talked', 'date talked', 'date', 'when'],
};

function logRows(src) {
  const { head, rows } = U.csvObjects(src);
  const col = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, names.find((n) => head.includes(n)) || head.find((h) => names.some((n) => h.startsWith(n))) || null]));
  if (!col.name || !(col.had || col.spent || col.committed)) throw new Error('That doesn\'t look like a conversation log. Use the CSV from Your first 25 (columns: Name, Talked, Had the problem, Already spends, Committed, Intro, Notes), or paste one line per person.');
  return rows.map((r) => ({
    name: plain(r[col.name] || ''),
    talked: col.talked ? String(r[col.talked] || '').trim() : '',
    had: col.had ? YES.test(String(r[col.had] || '').trim()) : false,
    spent: col.spent ? YES.test(String(r[col.spent] || '').trim()) : false,
    committed: col.committed ? YES.test(String(r[col.committed] || '').trim()) : false,
    intro: col.intro ? YES.test(String(r[col.intro] || '').trim()) : false,
    notes: plain(r[col.notes] || ''),
  })).filter((r) => r.name);
}

// Pasted lines: "Dana | yes | yes | no | no | had to redo the schedule twice last week"
function pastedRows(v) {
  return C.linesOf(v, 60).map((l) => {
    const [name, had, spent, committed, intro, ...rest] = l.split(/\s*\|\s*/);
    const y = (x) => YES.test(String(x || '').trim());
    return { name: plain(name), talked: '', had: y(had), spent: y(spent), committed: y(committed), intro: y(intro), notes: plain(rest.join(' | ')) };
  }).filter((r) => r.name);
}

module.exports = { N, C, me, QUESTIONS, AVOID, questionsFor, problemPhrase, offerOf, logRows, pastedRows, YES };
