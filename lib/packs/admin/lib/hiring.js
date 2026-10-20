// Hiring helper rules: what a job post, a screening question or an interview question must not ask
// or hint at. US federal law (EEOC) bars hiring decisions based on race, color, religion, sex
// (including pregnancy, sexual orientation and gender identity), national origin, age (40 and
// over), disability or genetic information; many states and cities add more (salary history,
// arrest records, marital status). So questions stay on the job: skills, experience, availability
// for the hours, and the work itself.
//
//   protectedProblems(text) -> ['age', ...]  (empty means it passes)
//   postProblems(text) -> words in a job post that read as age or gender coded

const RULES = [
  ['age', /\b(how old|your age|\bage\b|date of birth|birth ?date|born in|year (you )?(were )?born|what year did you graduate|graduation year|when did you graduate|retire(ment|d)?|too old|too young|young(er)?|older workers?|digital native|recent (grad|graduate)s?\b|energetic young)/i],
  ['family', /\b(married|marital|spouse|husband|wife|partner's|boyfriend|girlfriend|kids|children|child ?care|childcare|babysitter|pregnan\w*|plan(s|ning)? (to|on) (have|start) a family|family plans|maiden name|single (mom|mother|dad|father|parent)|are you a (mom|mother|dad|father|parent))\b/i],
  ['health', /\b(health (problems?|conditions?|issues?)|medical (history|conditions?|problems?)|disabilit(y|ies)|disabled|handicap\w*|illness(es)?|sick days|how many days (were you|did you) (sick|miss)|medications?|prescriptions?|mental health|therapy|workers'? comp\w*|injur(y|ies|ed) (before|in the past)|drink alcohol|do you (smoke|drink)|your (weight|height)|how (much do you weigh|tall are you)|genetic|family (medical|health) history)\b/i],
  ['religion', /\b(religio\w*|church|mosque|synagogue|temple|pray(er)?s?|faith|which holidays|religious holidays|sabbath|worship)\b/i],
  ['national origin', /\b(where are you (from|originally from)|where were you born|birthplace|country of (origin|birth)|native (language|tongue)|first language|mother tongue|nationality|ethnic\w*|your accent|are you (a )?(us |u\.s\. )?citizen|citizenship|immigra\w*|green card|visa status|heritage|ancestry)\b/i],
  ['race or color', /\b(race|racial|skin (color|tone)|complexion)\b/i],
  ['sex or gender', /\b(gender|sexual orientation|gay|lesbian|transgender|are you (a )?(man|woman|male|female)|sex\b)\b/i],
  ['arrest record', /\b(ever (been )?arrested|arrest record|criminal record|been convicted|convictions?|felon(y|ies))\b/i],
  ['pay history', /\b(salary history|pay history|salary at your (last|previous|current|old)|(salary|pay|wage|rate) (at|in) your (last|previous|current|old)|how much (do|did) you (make|earn|get paid)|what were you paid|current (salary|pay|wage)|what (do|did) you (make|earn)|previous (salary|pay|wage)|last (salary|pay|wage))\b/i],
  ['military discharge', /\b(type of discharge|dishonorabl\w*|discharge status)\b/i],
  ['membership', /\b(union member\w*|political (party|views|affiliation)|who did you vote)\b/i],
];

function protectedProblems(text) {
  const s = String(text || '');
  // "Can you work the scheduled hours, including Saturdays?" is fine: it is about the job.
  return RULES.filter(([, re]) => re.test(s)).map(([k]) => k);
}

// Job post words that read as age- or gender-coded, with a neutral swap.
const CODED = [
  [/\b(young|youthful)\b/i, 'young', 'leave out, or describe the work instead'],
  [/\bdigital natives?\b/i, 'digital native', 'comfortable with apps like [the ones you use]'],
  [/\brecent (college )?grad(uate)?s?\b/i, 'recent graduate', 'early in your career, or any level of experience'],
  [/\bfresh blood\b/i, 'fresh blood', 'leave out'],
  [/\b(energetic|high[- ]energy)\b/i, 'energetic', 'reliable and quick to learn'],
  [/\b(salesman|foreman|handyman|cameraman|deliveryman|repairman|workman)\b/i, 'gendered job title', 'salesperson, crew lead, handyperson, camera operator, delivery driver, repair tech'],
  [/\b(guys|gals|he or she|his or her|manpower)\b/i, 'gendered wording', 'you, they, team, staff'],
  [/\b(native english|english as a first language|mother tongue)\b/i, 'native speaker', 'clear written and spoken English (only if the job needs it)'],
  [/\b(able-bodied|physically fit|must be healthy)\b/i, 'health wording', 'name the real task, like "lift 50 lb bags with or without help"'],
  [/\b(clean[- ]cut|well[- ]groomed)\b/i, 'appearance wording', 'wears the work uniform and safety gear'],
  [/\b(no (felons|criminal record)|must pass (a )?(background|criminal) check)\b/i, 'record wording', 'check your state and city rules before asking about records'],
  [/\b(us citizens? only|must be (a )?(us )?citizen)\b/i, 'citizenship', 'legally able to work in the US (you check this with Form I-9 after an offer)'],
];
function postProblems(text) {
  const s = String(text || '');
  return CODED.filter(([re]) => re.test(s)).map(([, word, swap]) => ({ word, swap }));
}

// Role families for the templates used when AI is off.
const ROLES = [
  { id: 'field', test: /\b(clean\w*|lawn|landscap\w*|crew|helper|handy\w*|install\w*|mov(er|ing)|junk|pressure|window|paint\w*|pool|detail\w*|tech|technician|labor\w*|driver|delivery)\b/i },
  { id: 'front', test: /\b(front desk|reception\w*|admin\w*|assistant|office|coordinator|scheduler|customer service|support|bookkeep\w*|va\b|virtual)\b/i },
  { id: 'creative', test: /\b(design\w*|editor|video|photo\w*|social media|content|writer|copy\w*|marketing)\b/i },
  { id: 'retail', test: /\b(barista|cashier|retail|sales associate|server|cook|baker|kitchen|shop|store|packer|fulfil\w*|warehouse)\b/i },
];
const roleOf = (role) => (ROLES.find((r) => r.test.test(role)) || { id: 'general' }).id;

const SCREEN = {
  field: [
    'Tell me about a job like this you have done before, paid or not. What did you do each day?',
    'The work starts at [start time] and some days run until [end time]. Can you work those hours?',
    'Do you have a valid driver\'s license and a way to get to job sites? (Only ask if the job needs driving.)',
    'This job means [the physical part, like lifting 50 lb bags or being on your feet for 6 hours]. Can you do that, with or without reasonable accommodation?',
    'A customer is unhappy with something you did. What do you do?',
  ],
  front: [
    'Tell me about a time you kept a busy schedule or inbox under control. What did you use?',
    'Which of these have you used: [your tools, like Google Calendar, Square or QuickBooks]?',
    'This role is [hours per week], mostly [days and times]. Does that work for you?',
    'A customer calls upset that their appointment was missed. Walk me through what you say.',
    'How do you keep track of tasks that are not due for a few weeks?',
  ],
  creative: [
    'Send two or three pieces you made that are closest to this work, and tell me what part you did.',
    'Which tools do you use for [the work, like Canva, CapCut or Lightroom]?',
    'We need about [amount] each week, with drafts by [day]. Does that fit your schedule?',
    'Tell me about a time someone asked for big changes to your work. What did you do?',
    'What would you want to know about our business before starting?',
  ],
  retail: [
    'Tell me about a job where you served customers. What did a busy shift look like?',
    'Shifts are [days and times], including [weekends or early mornings]. Which of those can you work?',
    'How would you handle a line of customers when something runs out?',
    'This job means [the physical part, like standing for a full shift]. Can you do that, with or without reasonable accommodation?',
    'What would a past manager say you are best at?',
  ],
  general: [
    'Tell me about work you have done that is closest to this job.',
    'The job is [hours per week], on [days and times]. Does that work for you?',
    'What part of this job do you think you would be best at, and what would you need to learn?',
    'Tell me about a time something went wrong at work and you fixed it.',
    'When could you start?',
  ],
};

const SCORECARD = {
  field: ['Has done similar work or learns fast', 'Shows up on time and can work the hours', 'Careful and safe with tools and property', 'Good with customers', 'Follows a checklist'],
  front: ['Organized: calendar, inbox, follow-ups', 'Clear and kind with customers on the phone and by email', 'Comfortable with our tools or quick to learn them', 'Can work the hours', 'Handles a problem without being told every step'],
  creative: ['Work samples match the style we need', 'Meets deadlines', 'Takes feedback well', 'Knows the tools', 'Asks good questions about the business'],
  retail: ['Friendly and quick with customers', 'Can work the shifts', 'Stays calm when busy', 'Careful with cash, stock or orders', 'Reliable: on time, follows through'],
  general: ['Relevant experience or quick to learn', 'Can work the hours', 'Communicates clearly', 'Reliable', 'Solves problems'],
};

module.exports = { protectedProblems, postProblems, roleOf, SCREEN, SCORECARD, RULES, CODED };
