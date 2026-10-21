// The application drafter (Perks and grants, Legal L100 PK4, legal/handoffs/perks.md PD1-PD6). For a program with a
// written application (`draft: true` in lib/perks), the member pastes one of its questions, adds any facts they want
// used, and taps "Draft by AI" with the credits shown first. The draft:
//
// - is written only from the member's Brain (the business fields llm.brainNote sends), their own notes and the
//   question; a fact it doesn't have becomes a marked blank like "[your yearly revenue]" (PD2);
// - never states eligibility or owner details as fact; a sentence that does is replaced with a blank for the member to
//   write (PD3, PD4), and owner details never reach the Brain, so they never reach the AI with it;
// - has every number that isn't in what the member gave marked "Check this" (PD2);
// - is labeled "Draft by AI", kept in `perkDrafts` like other AI tool results, and can be deleted (PD5);
// - leaves HQ only through the member's own Copy button. 127 never submits, fills in a program's form or contacts a
//   program (PD6).

const crypto = require('crypto');

const deps = { db: require('../db'), now: () => Date.now() };
const llm = require('../harness/llm');
const ledger = require('../harness/ledger');
const brain = require('../harness/brain');
const { clip } = require('../harness/text');

const COL = 'perkDrafts';
const credits = () => Math.max(0, Math.round(Number(process.env.PERKS_DRAFT_CREDITS || 2)));
const MAX_QUESTION = 1200;
const MAX_NOTES = 2000;
const KEEP = 20;

// PD1, exactly as Legal wrote it.
const REVIEW_LINE = 'You review and submit it yourself. 127 doesn’t apply for you and can’t promise any award. Check every fact before you send it: it’s your application. Some programs don’t accept AI-written answers, so check its rules.';

const SYSTEM = `You help a small business owner draft their own answer to one question on a grant, fellowship or program application. They will edit and submit it themselves.
Rules:
- Write in first person, as the owner, in plain short sentences. No headings, no lists unless the question asks for one, no em dashes.
- Use only facts given to you: the owner's business profile, their notes, and the question. Never make up numbers, customers, sales, awards, team members, dates, places or results.
- When the answer needs a fact you don't have, leave a blank in square brackets that names it, like [your yearly revenue] or [how many customers you've served].
- Never state eligibility or ownership as fact: who owns the business, women-owned, veteran-owned, minority-owned, citizenship, residency, age, race, ethnicity, sex, disability, revenue thresholds. Leave a blank like [eligibility: write this part yourself] instead.
- Never promise results, growth or income, and never say what the money will certainly achieve. Say what the owner plans to do.
- Don't mention 127, AI, or that this is a draft. Keep to the question's length limit if it gives one; otherwise under 250 words.`;

// PD3: a sentence that states eligibility or an owner detail becomes a blank for the member to write.
const OWNER = /\b(women[- ]owned|woman[- ]owned|female[- ]owned|veteran[- ]owned|minority[- ]owned|black[- ]owned|latin[ao]?[- ]owned|i am a (?:woman|veteran|citizen|u\.?s\.? citizen|legal (?:u\.?s\.? )?resident)|i'?m a (?:woman|veteran|citizen|u\.?s\.? citizen)|u\.?s\.? citizen|legal resident|\d{2,3}% (?:women|woman|female|owned)|majority[- ]owned|owned and (?:controlled|operated) by|eligible|qualif(?:y|ies|ied)|disab(?:led|ility)|my race|my ethnicity)\b/i;
const OWNER_BLANK = '[eligibility: write this part yourself]';

function scrubOwner(text) {
  return String(text || '').split(/(?<=[.!?])\s+/).map((s) => (OWNER.test(s) ? OWNER_BLANK : s)).join(' ').replace(/(\[eligibility: write this part yourself\]\s*){2,}/g, `${OWNER_BLANK} `).trim();
}

// PD2: numbers in the draft that aren't in what the member gave. Returns [{ start, end }] over the text; blanks
// ("[...]") are skipped. A number counts as given when its digits appear in the source.
const NUM = /\$?\d[\d,]*(?:\.\d+)?%?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million)\b/gi;
const digits = (s) => String(s).replace(/[^\d.]/g, '').replace(/\.$/, '');
function unchecked(text, source) {
  const src = String(source || '').toLowerCase();
  const srcDigits = (src.match(/\d[\d,]*(?:\.\d+)?/g) || []).map(digits);
  const out = [];
  const blanks = [];
  for (const m of String(text).matchAll(/\[[^\]]*\]/g)) blanks.push([m.index, m.index + m[0].length]);
  for (const m of String(text).matchAll(NUM)) {
    const at = m.index, end = at + m[0].length;
    if (blanks.some(([a, b]) => at >= a && end <= b)) continue;
    const d = digits(m[0]);
    const given = d ? srcDigits.includes(d) : src.includes(m[0].toLowerCase());
    if (!given) out.push({ start: at, end });
  }
  return out;
}

// Parts for the page: [{ t, kind: 'text' | 'blank' | 'check' }], so the view escapes every piece.
function parts(text, source) {
  const marks = [];
  for (const m of String(text).matchAll(/\[[^\]]*\]/g)) marks.push({ start: m.index, end: m.index + m[0].length, kind: 'blank' });
  for (const u of unchecked(text, source)) marks.push({ ...u, kind: 'check' });
  marks.sort((a, b) => a.start - b.start);
  const out = [];
  let i = 0;
  for (const m of marks) {
    if (m.start < i) continue;
    if (m.start > i) out.push({ t: text.slice(i, m.start), kind: 'text' });
    out.push({ t: text.slice(m.start, m.end), kind: m.kind });
    i = m.end;
  }
  if (i < text.length) out.push({ t: text.slice(i), kind: 'text' });
  return out;
}

function mine(userId, programId) {
  return deps.db.filter(COL, (d) => d.memberId === userId && (!programId || d.program === programId)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

class DraftError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

async function write(user, program, { question, notes } = {}) {
  if (!program || !program.draft) throw new DraftError('This program has no written application to draft for.', 404);
  const q = clip(question, MAX_QUESTION).trim();
  const n = clip(notes, MAX_NOTES).trim();
  if (q.length < 8) throw new DraftError('Paste the question from the application first.');
  const cost = credits();
  if (ledger.left(user) < cost) throw new DraftError(`This takes ${cost} credits and you have ${ledger.left(user)} left this month.`, 402);
  const snap = brain.snapshot(user);
  const prompt = `The program: ${program.name}, run by ${program.by}.\n\nThe application question:\n${q}\n\n${n ? `The owner's notes for this answer:\n${n}\n\n` : ''}Write the owner's draft answer.`;
  let r;
  try {
    r = await llm.call({
      task: 'write',
      system: SYSTEM,
      prompt,
      maxTokens: 1200,
      tier: ledger.tierOf(user),
      spentUsd: ledger.spentUsd(user),
      brain: { business: snap.business, voice: snap.voice },
      onCost: async (meta) => ledger.cost(user, meta.usd, { tool: 'perks_draft' }),
    });
  } catch (err) {
    throw new DraftError(err && err.message ? err.message : 'The draft didn’t come out. Try again.', 503);
  }
  if (!r.sample) await ledger.charge(user, cost, { tool: 'perks_draft' });
  const text = scrubOwner(r.text);
  // What the member gave, for the "Check this" marks: the Brain's business fields, their notes and the question.
  const source = [llm.brainNote(snap), n, q].join('\n');
  const doc = {
    id: crypto.randomBytes(9).toString('base64url'), memberId: user.id, program: program.id, question: q, notes: n, text, source,
    label: 'Draft by AI', sample: !!r.sample, credits: r.sample ? 0 : cost, at: new Date(deps.now()).toISOString(),
  };
  await deps.db.save(COL, doc);
  // Keep the newest few per program.
  for (const old of mine(user.id, program.id).slice(KEEP)) await deps.db.remove(COL, old.id);
  return doc;
}

async function remove(user, id) {
  const d = deps.db.get(COL, String(id || ''));
  if (!d || d.memberId !== user.id) return false;
  await deps.db.remove(COL, d.id);
  return true;
}

async function removeAll(user) {
  for (const d of mine(user.id)) await deps.db.remove(COL, d.id);
}

function _setDeps(over) { Object.assign(deps, over); }

module.exports = { write, remove, removeAll, mine, parts, unchecked, scrubOwner, credits, REVIEW_LINE, SYSTEM, COL, DraftError, _setDeps };
