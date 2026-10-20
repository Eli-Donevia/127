// What never reaches a model service (Legal L76, V1 and V5): sexual content, anyone under 18, real
// public figures and celebrities, and election or political content with real people. Checked in code
// first (words and names), then, when AI is on, by a quick classify call that catches names and
// phrasings the list misses. A blocked prompt stops the step with a plain reason; nothing is sent.

const { ai, text } = require('../../_kit');

const RULES = [
  {
    why: 'sexual content',
    re: /\b(nude|nudity|naked|topless|nsfw|porn\w*|erotic\w*|sexual\w*|sexy|seductive|lingerie model|strip(per|ping|tease)|onlyfans|fetish\w*|explicit|hentai|xxx|bikini model)\b/i,
  },
  {
    why: 'anyone under 18',
    re: /\b(child|children|kids?|kiddos?|toddlers?|bab(y|ies)|infants?|minors?|teens?|teenagers?|teenaged|boys?|girls?|schoolboys?|schoolgirls?|students? in (grade|high school|middle school)|preteens?|tweens?|under ?18|underage|(\d|1[0-7]) ?(years?|yrs?)[- ]old|youth)\b/i,
  },
  {
    why: 'elections and politics with real people',
    re: /\b(election\w*|ballots?|voting|vote for|polling place|candidates?|campaign rally|political (party|ad|rally)|democrats?|republicans?|gop|maga|senators?|congress(man|woman|person)?|governor|mayor|president(ial)?|prime minister|parliament)\b/i,
  },
  {
    why: 'a real public figure or celebrity',
    re: /\b(celebrit(y|ies)|famous (person|actor|actress|singer|rapper|athlete|influencer)|looks? like (a |the )?(famous|celebrity|real)|in the style of [A-Z][a-z]+ [A-Z][a-z]+|deepfake|face ?swap)\b/i,
  },
];

// Well-known names that come up in ad and video prompts. Not complete: the AI check below catches more.
const NAMES = [
  'taylor swift', 'beyonce', 'beyoncé', 'rihanna', 'drake', 'kanye', 'kim kardashian', 'kylie jenner', 'kardashian', 'oprah', 'elon musk', 'jeff bezos', 'mark zuckerberg', 'bill gates', 'steve jobs',
  'donald trump', 'trump', 'joe biden', 'biden', 'kamala harris', 'barack obama', 'obama', 'jd vance', 'vance', 'putin', 'zelensky', 'xi jinping', 'king charles', 'prince harry', 'meghan markle',
  'mrbeast', 'mr beast', 'joe rogan', 'logan paul', 'jake paul', 'kai cenat', 'ishowspeed', 'pewdiepie', 'charli d\'amelio', 'addison rae', 'khaby lame',
  'lebron', 'lebron james', 'michael jordan', 'cristiano ronaldo', 'ronaldo', 'messi', 'lionel messi', 'serena williams', 'tom brady', 'patrick mahomes', 'travis kelce', 'simone biles',
  'tom cruise', 'brad pitt', 'leonardo dicaprio', 'scarlett johansson', 'zendaya', 'dwayne johnson', 'the rock', 'keanu reeves', 'ryan reynolds', 'margot robbie', 'timothee chalamet', 'timothée chalamet', 'sydney sweeney', 'jennifer aniston', 'selena gomez', 'ariana grande', 'billie eilish', 'bad bunny', 'snoop dogg', 'eminem', 'ed sheeran', 'justin bieber', 'harry styles', 'dua lipa', 'lady gaga', 'olivia rodrigo', 'sabrina carpenter',
  'gary vee', 'gary vaynerchuk', 'tony robbins', 'andrew tate', 'jordan peterson', 'ben shapiro', 'tucker carlson',
];
const NAME_RE = new RegExp(`\\b(${NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');

// Code check. Returns null when the words are fine, else { why }.
function check(words) {
  const s = String(words || '');
  if (!s.trim()) return null;
  for (const r of RULES) if (r.re.test(s)) return { why: r.why };
  if (NAME_RE.test(s)) return { why: 'a real public figure or celebrity' };
  return null;
}

function message(why) {
  return `Studio can't make this: it looks like it includes ${why}, which Studio never sends to an AI model. Change the words and try again.`;
}

// The full check before anything goes to a model service. Throws a plain Error when blocked.
// AI (task classify) runs only when the harness gives one; its answer can block, never unblock.
async function guard(ctx, words) {
  const hit = check(words);
  if (hit) throw new Error(message(hit.why));
  if (!ctx || typeof ctx.ai !== 'function') return;
  const { data, ai: used } = await ai.aiJson(ctx, {
    task: 'classify',
    system: 'You check prompts before they go to an image or video model. Answer only from the words given.',
    prompt: `Does this prompt ask for any of: (a) sexual or nude content, (b) a person under 18, (c) a real, named public figure, celebrity or politician, or someone made to look like one, (d) election or political content with real people? Ordinary jobs, products and places are fine.\nPrompt: "${text.clip(String(words), 1500)}"`,
    schema: { type: 'object', properties: { blocked: { type: 'boolean' }, why: { type: 'string', enum: ['none', 'sexual content', 'anyone under 18', 'a real public figure or celebrity', 'elections and politics with real people'] } }, required: ['blocked', 'why'] },
    maxTokens: 60,
    fallback: () => ({ blocked: false, why: 'none' }),
  });
  if (used && data.blocked && data.why !== 'none') throw new Error(message(data.why));
}

module.exports = { check, guard, message, RULES, NAMES };
