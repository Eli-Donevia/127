// 30 subject lines in six styles, each with preview text, plus checks that catch what hurts opens
// or breaks the rules: fake RE: or FWD:, ALL CAPS, piles of punctuation, length on a phone.

const { text } = require('../../_kit');

const STYLES = ['Straight', 'Question', 'Curious', 'Number', 'Personal', 'How to'];

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// topic: "New winter candles are here" -> short noun phrase for templates
function topicOf(raw) {
  const t = text.oneLine(raw || '').replace(/[.!?]+$/, '');
  const noun = t.replace(/\s+(is|are)\s+(here|live|open|back|out|coming)\b.*$/i, '').replace(/^(new|our|my|the)\s+/i, '');
  return { full: t, noun: noun.charAt(0).toLowerCase() + noun.slice(1) };
}

function subjectLines(rawTopic, f) {
  const { full, noun } = topicOf(rawTopic);
  const N = noun || 'this';
  const who = f.first || f.business;
  const bank = {
    Straight: [[cap(full), `Everything you need to know about ${N}`], [`New from ${f.business}: ${N}`, 'A first look, plus the link'], [cap(`${N}, explained`), 'The short version'], [`About ${N}`, 'What it is and who it is for'], [cap(`${N} at ${f.business}`), 'What it is and why I made it']],
    Question: [[`Have you seen ${N}?`, "Here's a first look"], [`Ready for ${N}?`, "Here's what to know first"], [`Which one would you pick?`, `A quick look at ${N}`], [`What would make ${N} better?`, 'Reply and tell me'], [`Can I show you something?`, `It's ${N}`]],
    Curious: [[`I changed one thing`, `And it's in ${N}`], [`The part nobody sees`, `Behind ${N}`], [`This took longer than I planned`, `Worth it, though`], [`A small detail I'm proud of`, `In ${N}`], [`I almost didn't send this`, `About ${N}`]],
    Number: [[`3 things about ${N}`, 'Number 2 surprises people'], [`${N}: 5 quick answers`, 'Price, timing and more'], [`2 ways to use ${N}`, 'And the one I like best'], [`1 minute on ${N}`, 'Short, I promise'], [`3 questions people ask about ${N}`, 'With straight answers']],
    Personal: [[`A quick note from ${who}`, `About ${N}`], [`Why I made ${N}`, 'The real story'], [`From me to you`, `${cap(N)}, first`], [`Thank you, plus ${N}`, 'You helped shape it'], [`What I'm working on`, `${cap(N)}, up close`]],
    'How to': [[`How to pick ${N}`, 'A 30 second guide'], [`How to get the most from ${N}`, 'Three easy tips'], [`How ${N} works`, 'Start to finish'], [`How to choose the right one`, `A guide to ${N}`], [`How I'd use ${N}`, 'My own favorite way']],
  };
  const out = [];
  for (const style of STYLES) for (const [subject, preview] of bank[style]) out.push({ style, subject: text.oneLine(subject), preview: text.oneLine(preview) });
  return out.map((x, i) => ({ key: `s${i + 1}`, ...x, ...checkSubject(x.subject) }));
}

function checkSubject(s) {
  const flags = [];
  const t = String(s || '');
  if (/^\s*(re|fwd?)\s*:/i.test(t)) flags.push('Fake RE: or FWD: breaks the FTC rule on honest subject lines');
  if ((t.match(/\b[A-Z]{4,}\b/g) || []).length) flags.push('ALL CAPS words look like spam');
  if (/[!?]{2,}|!/.test(t)) flags.push('Skip exclamation marks in subjects');
  if (/\$\$|100% free|act now|urgent|winner/i.test(t)) flags.push('Spammy phrase');
  if (t.length > 60) flags.push('Long: phones cut it off');
  const problems = text.copyProblems(t);
  if (problems.length) flags.push(...problems);
  return { chars: t.length, flags, ok: flags.length === 0 };
}

module.exports = { subjectLines, checkSubject, STYLES, topicOf };
