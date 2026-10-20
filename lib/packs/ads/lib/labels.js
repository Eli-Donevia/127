// D5 (Legal row 12): AI labels. A creative made or much changed by AI (a Studio picture, video, person
// or voice) carries each network's AI label; one with an AI-made person or voice also carries Legal's
// burned-in label. What this desk renders itself from the member's photo and words isn't AI-made.

const BULK = require('../data/bulk-files.json');
const LINES = require('../data/screen-lines.json');
const SC = require('../data/special-categories.json');

const AI_CHOICES = ['No AI in my pictures or videos', 'AI made or changed a picture or video', 'It shows an AI-made person', 'It has an AI-made voice', 'AI-made person and voice'];

const AI_INPUT = {
  type: 'string',
  title: 'Did AI make any of your pictures or videos?',
  description: 'From Studio or another AI tool. The ads then carry each network\'s AI label, and an AI-made person or voice gets the label on the ad itself.',
  enum: AI_CHOICES,
  default: AI_CHOICES[0],
};

// { aiMade, person, voice, burn, lines: [what to do, per network] }
function labelsFor(choice) {
  const i = Math.max(0, AI_CHOICES.indexOf(choice));
  const aiMade = i > 0;
  const person = i === 2 || i === 4;
  const voice = i === 3 || i === 4;
  if (!aiMade) return { aiMade, person, voice, burn: '', lines: [] };
  const lines = [
    `TikTok: ${SC.tiktokChecklist.ai}. ${BULK.ai.tiktokRules} ${SC.tiktokChecklist.aiDuplicate}`,
    `Meta: ${BULK.ai.meta}`,
    `Google: ${BULK.ai.google}`,
  ];
  if (person || voice) lines.push(`On the ad itself: "${[person ? LINES.aiPerson : '', voice ? LINES.aiVoice : ''].filter(Boolean).join('" and "')}", readable while the person is on screen or the voice is heard. ${BULK.ai.law}`, LINES.studioAi);
  return { aiMade, person, voice, burn: person ? LINES.aiPerson : voice ? LINES.aiVoice : '', lines };
}

module.exports = { AI_CHOICES, AI_INPUT, labelsFor };
