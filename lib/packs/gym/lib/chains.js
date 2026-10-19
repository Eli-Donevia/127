// Who owns the gym decides who buys its video.
//   independent: the owner decides and pays. Best first clients.
//   franchise:   a local owner runs it and often posts local content, inside the brand's rules. Worth a pitch.
//   corporate:   head office runs marketing. Skip by default.
//   nonprofit:   YMCA and the like. Slow buyers. Skip by default.
//   public:      city rec centers, schools, hotels, apartments. Not buyers.
// Brands are matched on OSM's brand tag, Google's name, or the name itself.

const CHAINS = [
  // franchise: locally owned locations
  ['Anytime Fitness', 'franchise'],
  ['Snap Fitness', 'franchise'],
  ['Orangetheory', 'franchise', /orange\s*theory/i],
  ['F45 Training', 'franchise', /\bf45\b/i],
  ['Club Pilates', 'franchise'],
  ['Pure Barre', 'franchise'],
  ['YogaSix', 'franchise', /yoga\s*six/i],
  ['CycleBar', 'franchise', /cycle\s*bar/i],
  ['Row House', 'franchise'],
  ['StretchLab', 'franchise', /stretch\s*lab/i],
  ['Rumble', 'franchise', /\brumble\b/i],
  ['BFT', 'franchise', /\bbft\b|body fit training/i],
  ['9Round', 'franchise', /\b9\s*round\b/i],
  ['Title Boxing Club', 'franchise'],
  ['Burn Boot Camp', 'franchise'],
  ['Fit Body Boot Camp', 'franchise'],
  ['Workout Anytime', 'franchise'],
  ['UFC Gym', 'franchise'],
  ['Mayweather Boxing + Fitness', 'franchise', /mayweather/i],
  ['Hotworx', 'franchise', /hot\s*worx/i],
  ["Farrell's eXtreme Bodyshaping", 'franchise', /farrell'?s/i],
  ['Crunch Fitness', 'franchise', /\bcrunch\b/i],
  ["Gold's Gym", 'franchise', /gold'?s gym/i],
  ['Planet Fitness', 'franchise'],
  ['Curves', 'franchise', /^curves\b/i],
  ['Jazzercise', 'franchise'],
  ['The Exercise Coach', 'franchise'],
  ['Fitness Together', 'franchise'],
  ['Retro Fitness', 'franchise'],
  ['iLoveKickboxing', 'franchise', /i\s*love\s*kickboxing/i],
  ['Premier Martial Arts', 'franchise'],
  ['Tiger Rock Martial Arts', 'franchise', /tiger rock/i],
  ['Pvolve', 'franchise'],
  ['Restore Hyper Wellness', 'franchise'],
  ['CKO Kickboxing', 'franchise', /\bcko\b/i],
  ['The Little Gym', 'franchise'],
  ['Kids Strong', 'franchise'],
  ['Get In Shape for Women', 'franchise'],
  ['Xponential', 'franchise'],
  ['Koko FitClub', 'franchise', /\bkoko fit\s*club\b/i],
  ['Kosama', 'franchise'],
  // corporate: head office runs marketing
  ['Life Time', 'corporate', /\blife\s*time\b/i],
  ['LA Fitness', 'corporate', /\bla fitness\b/i],
  ['24 Hour Fitness', 'corporate', /24\s*hour fitness/i],
  ['Equinox', 'corporate'],
  ['Blink Fitness', 'corporate'],
  ['EoS Fitness', 'corporate', /\beos fitness\b/i],
  ['Chuze Fitness', 'corporate'],
  ['VASA Fitness', 'corporate', /\bvasa\b/i],
  ['Genesis Health Clubs', 'corporate', /genesis health/i],
  ['CorePower Yoga', 'corporate', /core\s*power yoga/i],
  ['SoulCycle', 'corporate', /soul\s*cycle/i],
  ['Barry\'s', 'corporate', /barry'?s bootcamp|^barry'?s\b/i],
  ['Esporta Fitness', 'corporate'],
  ['Fitness 19', 'corporate'],
  ['YouFit', 'corporate', /\byou\s*fit\b/i],
  // nonprofit
  ['YMCA', 'nonprofit', /\bymca\b|\by\.m\.c\.a\b|\bthe y\b/i],
  ['YWCA', 'nonprofit', /\bywca\b/i],
  ['JCC', 'nonprofit', /\bjcc\b|jewish community center/i],
  ['Boys & Girls Club', 'nonprofit', /boys (and|&) girls club/i],
];

// Places that come up in gym searches but don't buy marketing.
const NOT_BUYERS = [
  /\b(high|middle|elementary|junior high) school\b|\bschool district\b|\buniversity\b|\bcollege\b|\bcampus\b/i,
  /\brec(reation)?\.? cent(er|re)\b|\bcommunity cent(er|re)\b|\bparks? (and|&) rec|\baquatics?\b|\bnatatorium\b/i,
  /\b(hotel|inn|suites|marriott|hilton|hyatt|holiday inn|hampton|residence inn|courtyard|sheraton|westin)\b/i,
  /\b(apartments?|apts|lofts|residences|condos?|clubhouse|senior living|retirement)\b/i,
  /\b(hospital|clinic|physical therapy|rehab|chiropractic|medical)\b/i,
  /\b(police|fire station|army|national guard|air force|navy|base gym)\b/i,
  /\bemployee\b|\bcorporate (fitness|wellness)\b|\bstaff gym\b/i,
];

// Hospital and health-system gyms: a marketing department buys, not an owner.
const HEALTH_SYSTEM = /\b(mercy\s?one|unitypoint|mayo|kaiser|sanford|essentia|advocate|baptist health|health system|medical cent(er|re))\b/i;

// Names so generic they're almost always a building's own gym.
const GENERIC = /^(the )?(fitness( center| centre| room)?|gym|weight room|exercise room|workout room|wellness center|fitness studio)$/i;

function matchChain(name, brand) {
  const hay = [brand, name].filter(Boolean).join(' | ');
  for (const [label, kind, re] of CHAINS) {
    const rx = re || new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (rx.test(hay)) return { kind, brand: label };
  }
  return null;
}

// -> { kind, brand?, reason? }
// A city, town or county running it (OSM's operator tag): a rec center, whatever its name says.
const GOVERNMENT = /^(the )?(city|town|village|county|township) of\b|\b(city|county|township) government\b/i;

function classifyOwner({ name, brand, operator, access }) {
  const n = String(name || '').trim();
  if (access && /^(private|no|permit|residents|employees|students)$/i.test(String(access).trim())) {
    return { kind: 'public', reason: 'Private gym (members of a building or company).' };
  }
  if (operator && GOVERNMENT.test(String(operator).trim())) return { kind: 'public', reason: 'Run by the city or county.' };
  for (const re of NOT_BUYERS) {
    if (re.test(n) || (operator && re.test(operator))) return { kind: 'public', reason: 'Not a gym business (school, rec center, hotel, apartment or clinic).' };
  }
  if (GENERIC.test(n)) return { kind: 'public', reason: 'Generic name, likely a building gym.' };
  if (HEALTH_SYSTEM.test(n) || (operator && HEALTH_SYSTEM.test(operator))) return { kind: 'corporate', brand: n, reason: 'Run by a health system.' };
  const chain = matchChain(n, brand);
  if (chain) return chain;
  // CrossFit boxes are independent affiliates under one brand name: the owner decides and pays.
  if (brand && /^crossfit$/i.test(brand.trim())) return { kind: 'independent' };
  if (brand && brand.trim() && brand.trim().toLowerCase() !== n.toLowerCase()) {
    // Unknown brand tag: treat as a small chain or franchise.
    return { kind: 'franchise', brand: brand.trim() };
  }
  return { kind: 'independent' };
}

module.exports = { classifyOwner, matchChain, CHAINS };
