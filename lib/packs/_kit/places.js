// Finding local businesses near a city, for any pack (leads, intel and every business-type pack).
//   geocode(ctx, 'Des Moines, IA')                 OpenStreetMap Nominatim, 1 request a second, cached
//                                                  30 days (48 hours on LocationIQ's free plan, L57)
//   findPlaces(ctx, { category, city, limit })     Google Places API (New) Text Search when the tool
//                                                  declares wants: ['places'] and a key is set; else
//                                                  OpenStreetMap (Overpass); else made-up sample places
//   filterPlaces(places, { category, known })      drops chains, closed listings and duplicates
//   categoryOf('dog groomers')                     one of CATEGORIES, or a custom one from the words
//
// Google Maps Platform terms (BUILDING.md, "Harness engine and new rules"): Places content (name, phone,
// address, rating, reviews) may be shown during the run with "Google Maps" attribution, never cached
// past the run or saved. Only place_id is kept. So nothing here caches a Google response, every
// Google place carries attribution: 'Google Maps', and exportable(place) strips Places content.
// OpenStreetMap data is ODbL: wherever OSM businesses are shown, the credit links to
// openstreetmap.org/copyright (creditBlock on screen, creditLine in spreadsheets, creditHtml in pages).
// OpenStreetMap servers follow Legal L55 (osmServer below): one server, never a rotation of public
// mirrors, and live runs only on 127's own servers. Those servers (Tracestrack, LocationIQ) carry a key
// in their URLs, so a server URL is never saved, shown or logged, and server error text goes through
// web.scrubKeys (Legal L57). A list fed by a LocationIQ lookup shows "Search by LocationIQ.com"
// (searchBlock, creditBlocks, creditHtml), as its free plan requires.
// Sample places are fictional (.example sites, 555-01xx phones) and always carry sample: true.
// Generalized from the gym pack's sources.js (v2/workflows/gym-video) and the Funnels First 25 buyers
// (v2/funnels/code/public/funnels/first25-data.js, read only).

const web = require('./web');
const { slug, hash, pickBy, plain } = require('./text');

const OSM_CREDIT = 'Business data from OpenStreetMap contributors (ODbL)';
const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';
const OSM_ATTRIBUTION = OSM_CREDIT;
const GOOGLE_ATTRIBUTION = 'Google Maps';
const SAMPLE_ATTRIBUTION = 'Sample businesses. They are made up so you can see how it works.';

// Prices checked 2026-10-19 on https://developers.google.com/maps/billing-and-pricing/pricing (per 1,000
// requests, 0 to 100,000 a month). A search asking for website, phone and rating bills as Enterprise.
const PRICING = {
  checked: '2026-10-19',
  source: 'https://developers.google.com/maps/billing-and-pricing/pricing',
  textSearchEnterprise: { usdPer1000: 35, freePerMonth: 1000 },
  placeDetailsEnterpriseAtmosphere: { usdPer1000: 25, freePerMonth: 1000 },
};

// ---------- categories ----------
// q: search words ("plumbers in Des Moines, IA"). type: a Google Places Table A type (checked
// 2026-10-19 against https://developers.google.com/maps/documentation/places/web-service/place-types,
// "Last updated 2026-10-16"), null where none fits (the words do the work). osm: OpenStreetMap tags
// (taginfo), "k=v" or "k=v][k2=v2". what / film / thing: words for messages. family: sample content.
// chains: names dropped from lists (a chain's marketing is decided at head office, not a first client).
// The 12 Funnels buyers (gyms ... law) keep their ids, labels, words and chain lists.
const CATEGORIES = {
  gyms: { label: 'Gyms and fitness studios', one: 'gym', many: 'gyms', q: 'gyms and fitness studios', type: 'gym', osm: ['leisure=fitness_centre', 'amenity=gym', 'sport=crossfit'], what: 'classes', film: 'a class', thing: 'class', family: 'fitness', aliases: ['gym', 'fitness', 'crossfit', 'fitness studio', 'boxing gym'], chains: ['planet fitness', 'anytime fitness', 'la fitness', 'orangetheory', 'crunch fitness', '24 hour fitness', "gold's gym", 'golds gym', 'snap fitness', 'ymca', 'life time', 'lifetime fitness', 'equinox', '9round', 'retro fitness', 'blink fitness', 'chuze', 'eos fitness', 'genesis health', 'workout anytime', 'fitness 19', 'youfit', 'esporta', 'vasa fitness'] },
  yoga: { label: 'Yoga and pilates studios', one: 'studio', many: 'yoga and pilates studios', q: 'yoga and pilates studios', type: 'yoga_studio', osm: ['sport=yoga', 'leisure=fitness_centre][sport=pilates'], what: 'classes', film: 'a class', thing: 'class', family: 'fitness', aliases: ['yoga', 'pilates', 'yoga studio', 'barre'], chains: ['corepower', 'club pilates', 'yogasix', 'pure barre', 'solidcore', 'hotworx', 'hot worx', 'stretchlab', 'bodybar'] },
  restaurants: { label: 'Restaurants', one: 'restaurant', many: 'restaurants', q: 'restaurants', type: 'restaurant', osm: ['amenity=restaurant'], what: 'food', film: 'a dish coming out of the kitchen', thing: 'dish', family: 'food', aliases: ['restaurant', 'food', 'diner', 'bistro', 'taqueria', 'pizza'], chains: ["mcdonald's", 'mcdonalds', 'starbucks', 'subway', 'chipotle', 'panera', 'taco bell', "wendy's", 'burger king', 'chick-fil-a', "domino's", 'pizza hut', 'dunkin', "applebee's", 'olive garden', "chili's", 'buffalo wild wings', "arby's", 'kfc', 'panda express', 'sonic', 'jimmy john', 'qdoba', "culver's", 'dairy queen', 'five guys', 'noodles & company', 'red robin', 'texas roadhouse', 'ihop', "denny's", 'perkins', 'jersey mike', 'firehouse subs', "casey's", 'kwik trip', 'kwik star', 'hy-vee', 'caribou coffee', 'dutch bros', "raising cane's", 'whataburger', 'popeyes', 'little caesars', "papa john's", "hardee's", 'cracker barrel', 'outback', 'red lobster'] },
  cafes: { label: 'Cafes and coffee shops', one: 'cafe', many: 'cafes', q: 'cafes and coffee shops', type: 'cafe', osm: ['amenity=cafe'], what: 'coffee and food', film: 'a latte being poured', thing: 'drink', family: 'food', aliases: ['cafe', 'coffee', 'coffee shop', 'tea house'], chains: ['starbucks', 'dunkin', 'caribou coffee', 'dutch bros', 'peet', 'tim hortons', 'scooter', 'biggby', 'panera', 'mcdonald', 'krispy kreme', 'the human bean', 'black rifle'] },
  bakeries: { label: 'Bakeries', one: 'bakery', many: 'bakeries', q: 'bakeries', type: 'bakery', osm: ['shop=bakery', 'shop=pastry'], what: 'baked goods', film: 'a tray coming out of the oven', thing: 'pastry', family: 'food', aliases: ['bakery', 'pastry', 'donuts', 'cake shop'], chains: ['crumbl', 'nothing bundt cakes', 'insomnia cookies', 'great harvest', 'cinnabon', 'krispy kreme', 'dunkin', 'panera', 'auntie anne', 'paris baguette', 'tous les jours', 'duck donuts'] },
  bars: { label: 'Bars and breweries', one: 'bar', many: 'bars', q: 'bars and breweries', type: 'bar', osm: ['amenity=bar', 'amenity=pub', 'craft=brewery'], what: 'drinks', film: 'a drink being made', thing: 'drink', family: 'food', aliases: ['bar', 'pub', 'brewery', 'taproom', 'cocktail bar', 'wine bar'], chains: ['buffalo wild wings', "applebee's", 'twin peaks', 'hooters', 'topgolf', 'dave & buster', 'world of beer', 'yard house', "bj's restaurant", 'tilted kilt'] },
  salons: { label: 'Hair salons', one: 'salon', many: 'salons', q: 'hair salons', type: 'hair_salon', osm: ['shop=hairdresser'], what: 'work', film: 'a cut coming together', thing: 'cut', family: 'beauty', aliases: ['salon', 'hair', 'hair salon', 'hairdresser', 'stylist'], chains: ['great clips', 'supercuts', 'sport clips', 'fantastic sams', 'cost cutters', 'ulta', 'regis', 'hair cuttery', 'smartstyle', 'first choice haircutters', 'floyd', 'drybar', 'european wax', 'the lash lounge'] },
  barbers: { label: 'Barbershops', one: 'barbershop', many: 'barbershops', q: 'barbershops', type: 'barber_shop', osm: ['shop=hairdresser][hairdresser=barber', 'shop=barber'], what: 'cuts', film: 'a fade coming together', thing: 'cut', family: 'beauty', aliases: ['barber', 'barbershop', 'barbers'], chains: ['great clips', 'supercuts', 'sport clips', 'fantastic sams', 'cost cutters', 'floyd', 'hair cuttery', 'roosters men', 'v\'s barbershop', 'the gents place'] },
  spas: { label: 'Day spas and massage', one: 'spa', many: 'spas', q: 'day spas and massage', type: 'spa', osm: ['shop=massage', 'shop=beauty][beauty=spa', 'leisure=spa'], what: 'treatments', film: 'the treatment room', thing: 'treatment', family: 'beauty', aliases: ['spa', 'day spa', 'massage', 'massage therapist'], chains: ['massage envy', 'hand & stone', 'elements massage', 'massage heights', 'massage green', 'woodhouse', 'european wax center', 'the now'] },
  nails: { label: 'Nail salons', one: 'nail salon', many: 'nail salons', q: 'nail salons', type: 'nail_salon', osm: ['shop=beauty][beauty=nails'], what: 'work', film: 'a set being finished', thing: 'set', family: 'beauty', aliases: ['nail', 'nails', 'nail salon', 'manicure'], chains: ['regal nails', 'the nail bar', 'frenchies', 'happy nails'] },
  medspas: { label: 'Med spas and skin clinics', one: 'med spa', many: 'med spas', q: 'med spas and skin clinics', type: null, osm: ['shop=beauty][beauty=skin_care', 'healthcare=clinic][healthcare:speciality=dermatology'], what: 'treatments', film: 'the space and a consult', thing: 'treatment', family: 'beauty', aliases: ['med spa', 'medspa', 'medical spa', 'skin clinic', 'aesthetics', 'botox'], chains: ['ideal image', 'laseraway', 'milan laser', 'european wax center', 'hand & stone', 'massage envy', 'the joint', 'skin laundry', 'sono bello', 'body sculpt', 'alchemy 43', 'ever/body', 'face foundrie'] },
  dentists: { label: 'Dentists', one: 'dental office', many: 'dental offices', q: 'dentists', type: 'dentist', osm: ['amenity=dentist', 'healthcare=dentist'], what: 'care', film: 'the office and the team', thing: 'visit', family: 'health', aliases: ['dentist', 'dental', 'dental office', 'orthodontist'], chains: ['aspen dental', 'heartland dental', 'western dental', 'coast dental', 'gentle dental', 'smile brands', 'bright now', 'monarch dental', 'comfort dental', 'kool smiles', 'small smiles', 'castle dental', 'affordable dentures', 'clear choice', 'clearchoice'] },
  chiro: { label: 'Chiropractors and physical therapy', one: 'clinic', many: 'chiropractic and PT clinics', q: 'chiropractors and physical therapy clinics', type: 'chiropractor', osm: ['healthcare=chiropractor', 'healthcare=physiotherapist', 'amenity=chiropractor'], what: 'care', film: 'the clinic and a session', thing: 'session', family: 'health', aliases: ['chiropractor', 'chiro', 'physical therapy', 'physical therapist', 'pt clinic'], chains: ['the joint', 'athletico', 'ati physical therapy', 'select physical therapy', 'upstream rehab', 'pivot physical therapy', 'professional physical therapy', 'confluent health', 'novacare', 'physiotherapy associates', 'benchmark physical therapy'] },
  vets: { label: 'Vets and animal clinics', one: 'vet clinic', many: 'vet clinics', q: 'veterinarians', type: 'veterinary_care', osm: ['amenity=veterinary'], what: 'care', film: 'a checkup with a happy dog', thing: 'visit', family: 'health', aliases: ['vet', 'veterinarian', 'animal hospital', 'animal clinic'], chains: ['banfield', 'vca', 'bluepearl', 'thrive pet', 'petsmart', 'petco', 'medvet', 'national veterinary associates'] },
  groomers: { label: 'Pet groomers', one: 'groomer', many: 'pet groomers', q: 'dog groomers', type: 'pet_care', osm: ['shop=pet_grooming'], what: 'grooming', film: 'a dog before and after', thing: 'groom', family: 'beauty', aliases: ['pet groomer', 'dog groomer', 'groomer', 'grooming'], chains: ['petsmart', 'petco', 'dogtopia', 'camp bow wow', 'aussie pet mobile', 'scenthound', 'woof gang'] },
  realtors: { label: 'Real estate agents', one: 'agent', many: 'real estate agents', q: 'real estate agents', type: 'real_estate_agency', osm: ['office=estate_agent'], what: 'listings', film: 'a listing walkthrough', thing: 'listing', family: 'pro', aliases: ['realtor', 'real estate', 'real estate agent', 'realty'], chains: [] },
  insurance: { label: 'Insurance agents', one: 'agency', many: 'insurance agencies', q: 'insurance agencies', type: 'insurance_agency', osm: ['office=insurance'], what: 'coverage', film: 'the office and the team', thing: 'quote', family: 'pro', aliases: ['insurance', 'insurance agent', 'insurance agency'], chains: [] },
  law: { label: 'Law firms', one: 'firm', many: 'law firms', q: 'law firms', type: 'lawyer', osm: ['office=lawyer'], what: 'cases', film: 'the office and the team', thing: 'consult', family: 'pro', aliases: ['lawyer', 'attorney', 'law firm', 'legal'], chains: ['legalzoom', 'jacoby & meyers', 'morgan & morgan', 'h&r block', 'jackson hewitt', 'liberty tax'] },
  accountants: { label: 'Accountants and tax preparers', one: 'firm', many: 'accounting firms', q: 'accountants and tax preparers', type: 'accounting', osm: ['office=accountant', 'office=tax_advisor'], what: 'work', film: 'the office and the team', thing: 'consult', family: 'pro', aliases: ['accountant', 'cpa', 'tax', 'tax preparer', 'bookkeeper', 'accounting'], chains: ['h&r block', 'jackson hewitt', 'liberty tax'] },
  auto: { label: 'Auto repair and detailing', one: 'shop', many: 'auto shops', q: 'auto repair and detailing shops', type: 'car_repair', osm: ['shop=car_repair', 'amenity=car_wash'], what: 'work', film: 'a car before and after', thing: 'job', family: 'auto', aliases: ['auto repair', 'mechanic', 'auto shop', 'detailing', 'car wash', 'body shop'], chains: ['jiffy lube', 'midas', 'meineke', 'firestone', 'pep boys', 'valvoline', 'take 5', 'goodyear', 'monro', 'christian brothers automotive', 'maaco', 'discount tire', 'les schwab', 'ntb', 'caliber collision', 'gerber collision', 'safelite', 'grease monkey', 'tire kingdom', 'big o tires', 'mavis tire', 'brakes plus', 'tires plus', 'quick lane', 'mister car wash', "tommy's express", 'autozone', "o'reilly", 'advance auto'] },
  dealers: { label: 'Car dealers', one: 'dealership', many: 'car dealers', q: 'used car dealers', type: 'car_dealer', osm: ['shop=car'], what: 'cars', film: 'a walkaround of a car on the lot', thing: 'car', family: 'auto', aliases: ['car dealer', 'dealership', 'used cars', 'auto sales'], chains: ['carmax', 'carvana', 'autonation', 'drivetime', 'enterprise car sales', 'echopark', 'lithia', 'sonic automotive', 'penske', 'hendrick'] },
  plumbers: { label: 'Plumbers', one: 'plumbing company', many: 'plumbers', q: 'plumbers', type: 'plumber', osm: ['craft=plumber'], what: 'work', film: 'a job from start to finish', thing: 'job', family: 'home', aliases: ['plumber', 'plumbing'], chains: ['roto-rooter', 'mr. rooter', 'benjamin franklin plumbing', 'ars rescue', 'one hour heating', 'home depot', "lowe's"] },
  hvac: { label: 'Heating and cooling (HVAC)', one: 'HVAC company', many: 'HVAC companies', q: 'heating and air conditioning contractors', type: null, osm: ['craft=hvac'], what: 'work', film: 'a new unit going in', thing: 'job', family: 'home', aliases: ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace'], chains: ['one hour heating', 'aire serv', 'ars rescue', 'service experts', 'carrier', 'trane', 'lennox', 'home depot', "lowe's", 'sears home'] },
  electricians: { label: 'Electricians', one: 'electrician', many: 'electricians', q: 'electricians', type: 'electrician', osm: ['craft=electrician'], what: 'work', film: 'a panel upgrade from start to finish', thing: 'job', family: 'home', aliases: ['electrician', 'electrical'], chains: ['mister sparky', 'mr. electric', 'home depot', "lowe's"] },
  roofers: { label: 'Roofers', one: 'roofing company', many: 'roofers', q: 'roofing contractors', type: 'roofing_contractor', osm: ['craft=roofer'], what: 'work', film: 'a roof before and after', thing: 'job', family: 'home', aliases: ['roofer', 'roofing'], chains: ['leaf filter', 'leaffilter', 'home depot', "lowe's", 'erie metal roofs', 'window nation', 'renewal by andersen'] },
  landscapers: { label: 'Landscaping and lawn care', one: 'landscaping company', many: 'landscapers', q: 'landscaping and lawn care companies', type: null, osm: ['craft=gardener', 'shop=garden_centre'], what: 'work', film: 'a yard before and after', thing: 'job', family: 'home', aliases: ['landscaper', 'landscaping', 'lawn care', 'lawn', 'tree service'], chains: ['trugreen', 'brightview', 'the grounds guys', 'weed man', 'lawn doctor', 'davey tree', 'home depot', "lowe's"] },
  cleaners: { label: 'Cleaning companies', one: 'cleaning company', many: 'cleaning companies', q: 'house and office cleaning services', type: null, osm: ['craft=cleaning', 'office=cleaning'], what: 'work', film: 'a room before and after', thing: 'clean', family: 'home', aliases: ['cleaner', 'cleaning', 'maid', 'house cleaning', 'janitorial', 'office cleaning'], chains: ['molly maid', 'merry maids', 'the maids', 'maid pro', 'jani-king', 'coverall', 'servpro', 'servicemaster', 'stanley steemer', 'chem-dry'] },
  contractors: { label: 'Home services (plumbing, HVAC, roofing)', one: 'company', many: 'home service companies', q: 'plumbing HVAC and roofing contractors', type: null, osm: ['craft=plumber', 'craft=hvac', 'craft=roofer', 'craft=electrician'], what: 'work', film: 'a job from start to finish', thing: 'job', family: 'home', aliases: ['contractor', 'contractors', 'home services', 'home service', 'remodeling', 'handyman', 'builder'], chains: ['roto-rooter', 'mr. rooter', 'ars rescue', 'one hour heating', 'benjamin franklin plumbing', 'aire serv', 'mister sparky', 'servpro', 'servicemaster', 'mr. electric', 'home depot', "lowe's", 'sears home', 'leaf filter', 'leaffilter', 'rhino shield', 'window nation', 'renewal by andersen'] },
  churches: { label: 'Churches', one: 'church', many: 'churches', q: 'churches', type: 'church', osm: ['amenity=place_of_worship][religion=christian'], what: 'services', film: 'a Sunday service', thing: 'service', family: 'community', aliases: ['church', 'churches', 'congregation'], chains: [] },
  schools: { label: 'Private schools and tutoring centers', one: 'school', many: 'schools', q: 'private schools and tutoring centers', type: 'school', osm: ['amenity=school', 'amenity=prep_school'], what: 'programs', film: 'a day in the classroom', thing: 'program', family: 'community', aliases: ['school', 'private school', 'tutoring', 'tutoring center', 'academy'], chains: ['kumon', 'mathnasium', 'sylvan', 'huntington learning', 'kaplan', 'c2 education', 'tutor doctor', 'club z'] },
  daycares: { label: 'Daycares and preschools', one: 'daycare', many: 'daycares', q: 'daycares and preschools', type: 'child_care_agency', osm: ['amenity=childcare', 'amenity=kindergarten'], what: 'care', film: 'a morning in the classroom', thing: 'tour', family: 'community', aliases: ['daycare', 'preschool', 'childcare', 'child care', 'nursery'], chains: ['kindercare', 'learning care group', 'la petite academy', 'childtime', 'tutor time', 'goddard school', 'primrose', 'bright horizons', 'kids r kids', 'the learning experience', 'lightbridge', 'kiddie academy', 'cadence education', 'ymca'] },
  boutiques: { label: 'Boutiques and local shops', one: 'shop', many: 'boutiques', q: 'boutiques and local gift shops', type: 'clothing_store', osm: ['shop=clothes', 'shop=boutique', 'shop=gift'], what: 'products', film: 'new arrivals on the rack', thing: 'piece', family: 'retail', aliases: ['boutique', 'clothing', 'clothing store', 'gift shop', 'gifts', 'shop', 'retail'], chains: ['target', 'walmart', 'tj maxx', 'marshalls', 'ross dress for less', 'old navy', 'h&m', 'zara', "kohl's", "macy's", 'nordstrom', 'banana republic', 'american eagle', 'hollister', 'ann taylor', 'francesca', "altar'd state", 'buckle', 'maurices', 'torrid', 'lane bryant', 'christopher & banks', 'hallmark', "claire's", 'five below', 'hobby lobby', 'michaels', "kirkland's", 'homegoods'] },
  florists: { label: 'Florists', one: 'florist', many: 'florists', q: 'florists', type: 'florist', osm: ['shop=florist'], what: 'arrangements', film: 'an arrangement coming together', thing: 'arrangement', family: 'retail', aliases: ['florist', 'flowers', 'flower shop'], chains: ['1-800-flowers', 'ftd', 'teleflora', 'proflowers', 'edible arrangements', 'hy-vee', 'kroger', 'trader joe'] },
  photographers: { label: 'Photographers', one: 'photographer', many: 'photographers', q: 'photographers and photo studios', type: null, osm: ['craft=photographer', 'shop=photo'], what: 'photos', film: 'a shoot behind the scenes', thing: 'session', family: 'pro', aliases: ['photographer', 'photography', 'photo studio'], chains: ['jcpenney portraits', 'picture people', 'lifetouch', 'olan mills', 'kiddie kandids'] },
  hotels: { label: 'Hotels, inns and B&Bs', one: 'hotel', many: 'hotels', q: 'independent hotels inns and bed and breakfasts', type: 'hotel', osm: ['tourism=hotel', 'tourism=guest_house', 'tourism=motel'], what: 'rooms', film: 'a room tour', thing: 'stay', family: 'hospitality', aliases: ['hotel', 'motel', 'inn', 'b&b', 'bed and breakfast', 'lodging'], chains: ['marriott', 'hilton', 'hyatt', 'holiday inn', 'hampton inn', 'best western', 'comfort inn', 'comfort suites', 'la quinta', 'days inn', 'super 8', 'motel 6', 'red roof', 'courtyard', 'fairfield inn', 'residence inn', 'springhill suites', 'embassy suites', 'doubletree', 'sheraton', 'westin', 'quality inn', 'sleep inn', 'americinn', 'baymont', 'microtel', 'wingate', 'drury', 'homewood suites', 'home2 suites', 'tru by hilton', 'candlewood', 'staybridge', 'extended stay', 'radisson', 'wyndham', 'ramada', 'clarion', 'econo lodge', 'choice hotels'] },
  venues: { label: 'Wedding and event venues', one: 'venue', many: 'event venues', q: 'wedding and event venues', type: 'wedding_venue', osm: ['amenity=events_venue', 'amenity=conference_centre'], what: 'events', film: 'the space set up for a wedding', thing: 'event', family: 'hospitality', aliases: ['wedding venue', 'event venue', 'venue', 'banquet hall', 'event space'], chains: ['marriott', 'hilton', 'hyatt', 'topgolf', 'dave & buster'] },
  // Partners for the household packs (tutoring, petcare): places that serve the same families. Types checked
  // 2026-10-19 against the Table A list above (library, community_center, pet_store, apartment_complex).
  libraries: { label: 'Public libraries', one: 'library', many: 'libraries', q: 'public libraries', type: 'library', osm: ['amenity=library'], what: 'programs', film: 'a story time', thing: 'program', family: 'community', aliases: ['library', 'public library', 'public libraries', 'branch library'], chains: [] },
  community: { label: 'Community and rec centers', one: 'community center', many: 'community centers', q: 'community and recreation centers', type: 'community_center', osm: ['amenity=community_centre'], what: 'programs', film: 'a class in the main hall', thing: 'class', family: 'community', aliases: ['community center', 'community centre', 'community centres', 'rec center', 'recreation center', 'community and rec centers'], chains: [] },
  petstores: { label: 'Pet supply stores', one: 'pet store', many: 'pet stores', q: 'pet supply stores', type: 'pet_store', osm: ['shop=pet'], what: 'supplies', film: 'the shop floor', thing: 'visit', family: 'retail', aliases: ['pet store', 'pet shop', 'pet supply', 'pet supply store', 'pet supplies', 'feed store'], chains: ['petsmart', 'petco', 'pet supplies plus', 'pet supermarket', 'pet valu', 'pet food express', 'tractor supply', 'pet people', 'mud bay'] },
  apartments: { label: 'Apartment buildings', one: 'apartment building', many: 'apartment buildings', q: 'apartment complexes', type: 'apartment_complex', osm: ['building=apartments', 'landuse=residential][residential=apartments'], what: 'homes', film: 'a tour of a model unit', thing: 'tour', family: 'hospitality', aliases: ['apartments', 'apartment', 'apartment building', 'apartment complex', 'apartment complexes', 'apartment community'], chains: [] },
  // Wave 4 partners (Oct 19): music, tech help and personal training. type is null (the words do the work).
  music_stores: { label: 'Music stores', one: 'music store', many: 'music stores', q: 'music stores and instrument shops', type: null, osm: ['shop=musical_instrument'], what: 'instruments', film: 'the shop floor', thing: 'visit', family: 'retail', aliases: ['music store', 'music stores', 'musical instrument stores', 'instrument shops', 'guitar shops', 'piano stores'], chains: ['guitar center', 'sam ash', 'music & arts', 'music and arts'] },
  seniors: { label: 'Senior centers and senior living', one: 'senior center', many: 'senior centers', q: 'senior centers and senior living communities', type: null, osm: ['amenity=social_facility][social_facility:for=senior', 'amenity=community_centre][community_centre:for=senior'], what: 'programs', film: 'an activity morning', thing: 'program', family: 'community', aliases: ['senior centers', 'senior center', 'senior living', 'senior living communities', 'retirement communities', 'assisted living', 'senior and community centers'], chains: ['brookdale', 'sunrise senior living', 'atria senior living', 'holiday retirement', 'erickson senior living', 'five star senior living', 'benchmark senior living'] },
  phone_repair: { label: 'Phone and computer repair shops', one: 'repair shop', many: 'repair shops', q: 'phone and computer repair shops', type: null, osm: ['craft=electronics_repair', 'shop=mobile_phone', 'shop=computer'], what: 'repairs', film: 'a repair on the bench', thing: 'repair', family: 'retail', aliases: ['phone repair shops', 'phone repair shop', 'phone repair', 'cell phone repair', 'computer repair shops', 'computer repair', 'electronics repair'], chains: ['ubreakifix', 'asurion', 'cpr cell phone repair', 'batteries plus', 'best buy', 'apple store', 'verizon', 'at&t', 't-mobile', 'cricket wireless', 'boost mobile', 'metro by t-mobile', 'gamestop'] },
  running: { label: 'Running stores', one: 'running store', many: 'running stores', q: 'running stores', type: null, osm: ['shop=sports][sport=running', 'shop=shoes][shoes=running'], what: 'gear', film: 'a shoe fitting', thing: 'visit', family: 'retail', aliases: ['running stores', 'running store', 'running shops', 'running shoe stores'], chains: ["dick's sporting goods", 'academy sports', 'big 5 sporting goods', 'road runner sports', 'rei', 'foot locker'] },
  physio: { label: 'Physical therapy clinics', one: 'clinic', many: 'physical therapy clinics', q: 'physical therapy clinics', type: null, osm: ['healthcare=physiotherapist'], what: 'care', film: 'the clinic', thing: 'visit', family: 'health', aliases: ['physical therapy clinics', 'physical therapy clinic', 'physiotherapists', 'physiotherapist', 'physiotherapy clinics'], chains: ['athletico', 'ati physical therapy', 'select physical therapy', 'upstream rehab', 'pivot physical therapy', 'professional physical therapy', 'confluent health', 'novacare', 'physiotherapy associates', 'benchmark physical therapy'] },
};

// "Plumbers", "a plumber", "dog groomers" or an id -> a category (custom when nothing matches).
function categoryOf(input) {
  const raw = String((input && input.id) || input || '').trim();
  const k = raw.toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!k) return { id: 'restaurants', ...CATEGORIES.restaurants };
  if (CATEGORIES[k]) return { id: k, ...CATEGORIES[k] };
  const singular = k.replace(/(ies)$/, 'y').replace(/(ses|xes|ches|shes)$/, (m) => m.slice(0, -2)).replace(/s$/, '');
  for (const [id, c] of Object.entries(CATEGORIES)) {
    const names = [id, c.one, c.many, c.label.toLowerCase(), ...(c.aliases || [])].map((x) => String(x).toLowerCase());
    if (names.includes(k) || names.includes(singular) || names.some((n) => n.replace(/s$/, '') === singular)) return { id, ...c };
  }
  // "crossfit gyms", "hair salons downtown": an alias that covers most of the words.
  for (const [id, c] of Object.entries(CATEGORIES)) {
    if ((c.aliases || []).some((a) => a.length > 3 && ((k.includes(a) && a.length >= k.length * 0.45) || (a.includes(k) && k.length >= a.length * 0.6)))) return { id, ...c };
  }
  // Something we don't list ("food trucks", "tattoo shops"): search by the words only (Google), no OSM tags.
  const words = plain(raw).slice(0, 60);
  return { id: `custom:${slug(words, 40)}`, label: words.charAt(0).toUpperCase() + words.slice(1), one: singular || words, many: words, q: words, type: null, osm: [], what: 'work', film: 'a day at work', thing: 'visit', family: 'other', aliases: [], chains: [], custom: true };
}

// Every category, for pickers: [{ id, label }].
function categoryList() {
  return Object.entries(CATEGORIES).map(([id, c]) => ({ id, label: c.label }));
}

// ---------- names, chains, duplicates ----------

const norm = (s) => ` ${String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9&' ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
// "Grit Fitness LLC" and "The Grit Fitness" are one business.
function baseName(s) {
  return norm(s).replace(/ (llc|inc|co|company|corp|ltd|pllc|pc|the|and|&) /g, ' ').replace(/ (llc|inc|co|company|corp|ltd|pllc|pc|the) /g, ' ').trim();
}
function isChain(name, category) {
  const n = norm(name);
  const list = (category && category.chains) || [];
  return list.some((c) => n.includes(norm(c)));
}
// Listing links many businesses share, so they never mark two businesses as one.
const SHARED_HOSTS = /(^|\.)(facebook|instagram|linktr|yelp|google|goo|square|squareup|wixsite|business|mindbodyonline|vagaro|booksy|toasttab|clover|godaddysites|weebly|carrd|business\.site)\./;

// Drops closed listings, chains (the category's list, an OSM brand tag, or a name 3+ times in the
// list), duplicates (same name, same website domain, same phone) and businesses already known
// (keys or domains from the member's Pipeline). Returns { kept, dropped: { closed, chains, dupes, known } }.
function filterPlaces(places, { category, known } = {}) {
  const cat = category && category.chains ? category : categoryOf(category);
  const knownSet = new Set((known || []).map((k) => String(k).toLowerCase()));
  const counts = {};
  for (const p of places || []) {
    const k = baseName(p.name);
    if (k) counts[k] = (counts[k] || 0) + 1;
  }
  const seen = new Set();
  const dropped = { closed: 0, chains: 0, dupes: 0, known: 0 };
  const kept = [];
  for (const p of places || []) {
    const k = baseName(p.name);
    if (p.closed) {
      dropped.closed++;
      continue;
    }
    if (p.brand || isChain(p.name, cat) || (k && counts[k] >= 3)) {
      dropped.chains++;
      continue;
    }
    const dom = p.website ? web.domainOf(p.website) : null;
    if (knownSet.has(String(p.key).toLowerCase()) || (dom && knownSet.has(dom))) {
      dropped.known++;
      continue;
    }
    const keys = [];
    if (k) keys.push(`n:${k}`);
    if (dom && !SHARED_HOSTS.test(`${dom}.`)) keys.push(`w:${dom}`);
    const tel = String(p.phone || '').replace(/\D/g, '').slice(-10);
    if (tel.length === 10 && tel.slice(3, 6) !== '555') keys.push(`p:${tel}`); // 555 numbers are fictional, never an id
    if (keys.some((x) => seen.has(x))) {
      dropped.dupes++;
      continue;
    }
    keys.forEach((x) => seen.add(x));
    kept.push(p);
  }
  return { kept, dropped };
}

// ---------- links ----------

// Google Maps search link for a place id (https://developers.google.com/maps/documentation/urls/get-started):
// query is only used when Maps can't find the place id, so it holds the member's own words, not Places content.
function mapsLink({ placeId, query }) {
  const q = encodeURIComponent(String(query || 'business').slice(0, 80)).replace(/%20/g, '+');
  return placeId ? `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}
function osmLink(type, id) {
  return `https://www.openstreetmap.org/${type}/${id}`;
}
// Directions through up to 9 stops (3 on phones). Stops: [{ placeId?, address?, lat?, lng? }].
function directionsLink(stops, { origin, mode = 'driving' } = {}) {
  const list = (stops || []).slice(0, 10);
  if (!list.length) return null;
  const at = (s) => s.address || (Number.isFinite(s.lat) && Number.isFinite(s.lng) ? `${s.lat.toFixed(5)},${s.lng.toFixed(5)}` : s.query || 'stop');
  const enc = (s) => encodeURIComponent(s).replace(/%20/g, '+');
  const dest = list[list.length - 1];
  const mid = list.slice(0, -1);
  let u = `https://www.google.com/maps/dir/?api=1&travelmode=${mode}`;
  if (origin) u += `&origin=${enc(origin)}`;
  u += `&destination=${enc(at(dest))}`;
  if (dest.placeId) u += `&destination_place_id=${encodeURIComponent(dest.placeId)}`;
  if (mid.length) {
    u += `&waypoints=${mid.map((s) => enc(at(s))).join('%7C')}`;
    if (mid.every((s) => s.placeId)) u += `&waypoint_place_ids=${mid.map((s) => encodeURIComponent(s.placeId)).join('%7C')}`;
  }
  return u;
}

// What may be kept after the run (Pipeline, CSV, saved files). Google: place_id and the Maps link
// built from it, nothing else from Places. OpenStreetMap and sample: everything (ODbL / made up).
function exportable(place) {
  if (!place) return {};
  if (place.source === 'google') return { key: place.key, source: 'google', placeId: place.placeId, mapsUrl: place.mapsUrl, attribution: GOOGLE_ATTRIBUTION };
  const { key, source, name, address, website, phone, instagram, mapsUrl, osmId, sample, searchBy } = place;
  return { key, source, name, address, website, phone, instagram, mapsUrl, osmId, sample: !!sample, attribution: source === 'osm' ? OSM_ATTRIBUTION : SAMPLE_ATTRIBUTION, ...(searchBy ? { searchBy } : {}) };
}

// ---------- distance ----------

function km(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---------- OpenStreetMap servers (Legal L55; the gym pack's G49 and G53 follow the same rules) ----------
// 127's own servers come from the 'osm' setting: { overpass, nominatim } https URLs (a bare URL is
// Overpass alone; a server's key can sit in its URL). Without them, the one public server of each
// kind, for testing and low volume only: a busy or failing answer gets one pause and one retry on the
// same server, never a hop to another public mirror. A live run (NODE_ENV=production) never uses the
// public servers: without both of 127's own, searches are held and lists show sample businesses.
// Every tool that calls findPlaces, finder, geocode or overpass declares wants: ['osm'], so the harness
// hands it those settings (needs.js reads OSM_OVERPASS_URL and OSM_NOMINATIM_URL).

const OVERPASS_PUBLIC = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_PUBLIC = 'https://nominatim.openstreetmap.org/search';
const HELD_NOTE = "Real business search isn't switched on yet, so these are sample businesses, made up for practice.";
// LocationIQ's free plan allows commercial use only with this link wherever its search is used, at the
// size of the line it's in and never behind a tap (Legal L57). Not needed in emails or CSVs.
const LOCATIONIQ_CREDIT = { label: 'Search by LocationIQ.com', href: 'https://locationiq.com' };
function isLocationIq(url) {
  try {
    return /(^|\.)locationiq\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function osmServer(ctx) {
  let v = secretOf(ctx, 'osm');
  if (typeof v === 'string') v = { overpass: v };
  if (!v || typeof v !== 'object') v = {};
  const ok = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : null);
  const own = !!(ok(v.overpass) && ok(v.nominatim));
  return { overpass: ok(v.overpass) || OVERPASS_PUBLIC, nominatim: ok(v.nominatim) || NOMINATIM_PUBLIC, own, held: !own && process.env.NODE_ENV === 'production' };
}

// Adds query parameters to a server URL that may already carry its own (a key, say).
function withParams(url, params) {
  const q = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `${url}${url.includes('?') ? '&' : '?'}${q}`;
}

// The OpenStreetMap credit, wherever OSM businesses are shown (ODbL). Each returns nothing when no
// business in the list came from OSM. list: places, leads or anything with a `source`.
// Views use creditBlocks(list), which adds LocationIQ's link when a LocationIQ lookup found the list
// (places carry searchBy: 'locationiq'). Spreadsheets need only the OSM line (creditLine).
const listOf = (list) => (Array.isArray(list) ? list : [list]);
const anyOsm = (list) => listOf(list).some((p) => p && (p.source === 'osm' || p.source === 'openstreetmap'));
const anyLocationIq = (list) => listOf(list).some((p) => p && p.searchBy === 'locationiq');
const creditBlock = (list) => (anyOsm(list) ? { type: 'link', label: OSM_CREDIT, href: OSM_COPYRIGHT } : null);
const searchBlock = (list) => (anyLocationIq(list) ? { type: 'link', label: LOCATIONIQ_CREDIT.label, href: LOCATIONIQ_CREDIT.href } : null);
const creditBlocks = (list) => [creditBlock(list), searchBlock(list)].filter(Boolean);
const creditLine = (list) => (anyOsm(list) ? `${OSM_CREDIT}: ${OSM_COPYRIGHT}` : '');
const creditHtml = (list) =>
  anyOsm(list)
    ? `<p class="osm-credit">Business data from <a href="${OSM_COPYRIGHT}">OpenStreetMap contributors</a> (ODbL)${anyLocationIq(list) ? ` · <a href="${LOCATIONIQ_CREDIT.href}">${LOCATIONIQ_CREDIT.label}</a>` : ''}</p>`
    : '';

// ---------- geocode (OpenStreetMap Nominatim) ----------
// Usage policy (https://operations.osmfoundation.org/policies/nominatim/, checked 2026-10-19): at most
// 1 request a second, an identifying User-Agent, cache results, show attribution. One queue per process.

let nominatimQueue = Promise.resolve();
let nominatimLast = 0;
function nominatimTurn() {
  const turn = nominatimQueue.then(async () => {
    const wait = Math.max(0, nominatimLast + 1100 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    nominatimLast = Date.now();
  });
  nominatimQueue = turn.catch(() => {});
  return turn;
}

// LocationIQ's free plan lets an answer be reused for 48 hours at most (Legal L57); Nominatim, 30 days.
// format=json: LocationIQ doesn't answer jsonv2, and both answer json the same way (Funnels F42).
// A LocationIQ answer carries searchBy, so the lists it feeds show LocationIQ's link.
async function geocode(ctx, place) {
  const q = String(place || '').trim().slice(0, 120);
  if (!q) return null;
  const srv = osmServer(ctx);
  if (srv.held) return null;
  const liq = isLocationIq(srv.nominatim);
  return web.cached(ctx, `geo:v2:${liq ? 'liq:' : ''}${slug(q, 80)}`, liq ? 48 : 24 * 30, async () => {
    await nominatimTurn();
    try {
      const r = await web.getJson(ctx, withParams(srv.nominatim, { format: 'json', limit: 1, q }), { timeoutMs: 8000, maxBytes: 200000 });
      const hit = Array.isArray(r.data) ? r.data[0] : null;
      if (!hit) return null;
      return { lat: Number(hit.lat), lng: Number(hit.lon), label: plain(hit.display_name || q), source: 'osm', attribution: OSM_ATTRIBUTION, ...(liq ? { searchBy: 'locationiq', searchCredit: LOCATIONIQ_CREDIT } : {}) };
    } catch {
      return null;
    }
  });
}

// ---------- Google Places API (New) Text Search ----------
// https://developers.google.com/maps/documentation/places/web-service/text-search (checked 2026-10-19):
// pageSize up to 20, nextPageToken for more, 60 results at most; a request bills at the highest SKU of
// any field it asks for (websiteUri, phone, rating: Enterprise). Never cached: the terms allow only place_id.

const GOOGLE_FIELDS = ['places.id', 'places.displayName', 'places.formattedAddress', 'places.location', 'places.websiteUri', 'places.nationalPhoneNumber', 'places.rating', 'places.userRatingCount', 'places.businessStatus', 'places.primaryType', 'nextPageToken'];

function fromGoogle(p, { query } = {}) {
  const status = p.businessStatus || 'OPERATIONAL';
  return {
    key: `gplaces:${p.id}`,
    placeId: p.id,
    source: 'google',
    attribution: GOOGLE_ATTRIBUTION,
    name: plain((p.displayName && p.displayName.text) || ''),
    address: plain(p.formattedAddress || ''),
    lat: p.location ? Number(p.location.latitude) : null,
    lng: p.location ? Number(p.location.longitude) : null,
    website: p.websiteUri || null,
    phone: p.nationalPhoneNumber || null,
    rating: Number.isFinite(p.rating) ? p.rating : null,
    reviews: Number.isFinite(p.userRatingCount) ? p.userRatingCount : null,
    status,
    closed: /^CLOSED/.test(status),
    type: p.primaryType || null,
    mapsUrl: mapsLink({ placeId: p.id, query }),
  };
}

async function spend(ctx, usd, what) {
  if (ctx && typeof ctx.spend === 'function') {
    try {
      await ctx.spend(usd, what);
    } catch (e) {
      if (/limit|budget|paused/i.test(String(e && e.message))) throw e;
    }
  }
}

async function googleSearch(ctx, key, { cat, city, limit, center, radiusKm }) {
  const textQuery = `${cat.q} in ${city}`.slice(0, 200);
  const out = [];
  let token = null;
  let requests = 0;
  const pages = Math.min(3, Math.ceil(Math.min(60, limit) / 20));
  for (let i = 0; i < pages; i++) {
    const body = { textQuery, pageSize: 20, languageCode: 'en' };
    if (cat.type) body.includedType = cat.type;
    if (center && Number.isFinite(center.lat)) body.locationBias = { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: Math.min(50000, Math.max(1000, (radiusKm || 15) * 1000)) } };
    if (token) body.pageToken = token;
    const r = await web.getText(ctx, 'https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': GOOGLE_FIELDS.join(',') },
      timeoutMs: 15000,
      maxBytes: 2e6,
    });
    requests++;
    await spend(ctx, PRICING.textSearchEnterprise.usdPer1000 / 1000, 'Google Places text search');
    if (!r.ok) throw new Error(`Google Places answered ${r.status}`);
    let data;
    try {
      data = JSON.parse(r.text);
    } catch {
      throw new Error('Google Places sent something we could not read');
    }
    for (const p of data.places || []) if (p && p.id) out.push(fromGoogle(p, { query: `${cat.one} ${city}` }));
    token = data.nextPageToken || null;
    if (!token || out.length >= limit) break;
    await web.sleep(1200, ctx && ctx.signal);
  }
  return { places: out, requests };
}

// ---------- OpenStreetMap (Overpass) ----------
// One server (osmServer): small queries, short timeouts, one pause and one retry on the same server.

// Runs one Overpass query and returns its elements. Throws when the server is held, busy twice or off.
async function overpass(ctx, query, { timeoutMs = 25000, maxBytes = 4e6 } = {}) {
  const srv = osmServer(ctx);
  if (srv.held) throw new Error(HELD_NOTE);
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await web.sleep(3000, ctx && ctx.signal);
    try {
      const r = await web.getText(ctx, srv.overpass, { method: 'POST', body: `data=${encodeURIComponent(query)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, timeoutMs, maxBytes });
      if (!r.ok) {
        lastErr = new Error(`OpenStreetMap answered ${r.status}`);
        continue;
      }
      const data = JSON.parse(r.text);
      if (data && Array.isArray(data.elements)) return data.elements;
      lastErr = new Error('OpenStreetMap sent no list');
    } catch (e) {
      if (ctx && ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
      if (/network is off/i.test(String(e && e.message))) throw e;
      lastErr = e;
    }
  }
  const err = new Error("OpenStreetMap's server is busy right now. Try again in a few minutes.");
  // The server's own words can echo its URL, key included: keep them only scrubbed.
  if (lastErr) err.cause = new Error(web.scrubKeys(lastErr.message));
  throw err;
}

function overpassFilter(tag) {
  return String(tag)
    .split('][')
    .map((kv) => {
      const [k, v] = kv.replace(/^\[|\]$/g, '').split('=');
      return `["${k.replace(/"/g, '')}"="${String(v || '').replace(/"/g, '')}"]`;
    })
    .join('');
}

function overpassQuery(cat, center, radiusKm, max = 150) {
  const r = Math.round(Math.min(40, Math.max(1, radiusKm || 15)) * 1000);
  const parts = cat.osm.map((t) => `nwr${overpassFilter(t)}["name"](around:${r},${center.lat.toFixed(5)},${center.lng.toFixed(5)});`);
  return `[out:json][timeout:20];(${parts.join('')});out center tags ${max};`;
}

function fromOsm(el, center) {
  const t = el.tags || {};
  const lat = Number.isFinite(el.lat) ? el.lat : el.center ? el.center.lat : null;
  const lng = Number.isFinite(el.lon) ? el.lon : el.center ? el.center.lon : null;
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const address = [street, t['addr:city']].filter(Boolean).join(', ');
  const website = t.website || t['contact:website'] || t.url || null;
  const ig = String(t['contact:instagram'] || '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/@?].*$/, '') || null;
  const place = {
    key: `osm:${el.type}/${el.id}`,
    osmId: `${el.type}/${el.id}`,
    source: 'osm',
    attribution: OSM_ATTRIBUTION,
    name: plain(t.name || ''),
    address: plain(address),
    lat,
    lng,
    website: website && web.normalizeUrl(website),
    phone: t.phone || t['contact:phone'] || null,
    rating: null,
    reviews: null,
    status: 'OPERATIONAL',
    closed: !!(t['disused:shop'] || t['disused:amenity'] || t['was:shop'] || t['abandoned:shop']),
    brand: t.brand || t['brand:wikidata'] ? plain(t.brand || 'brand') : null,
    hours: t.opening_hours || null,
    instagram: ig ? ig.toLowerCase() : null,
    mapsUrl: osmLink(el.type, el.id),
  };
  place.km = km(center, place);
  return place;
}

async function osmSearch(ctx, { cat, center, radiusKm, limit }) {
  const elements = await overpass(ctx, overpassQuery(cat, center, radiusKm, Math.min(200, limit * 4)));
  const seen = new Set();
  const out = [];
  for (const el of elements) {
    if (!el.tags || !el.tags.name) continue;
    const p = fromOsm(el, center);
    if (seen.has(p.key)) continue;
    seen.add(p.key);
    out.push(p);
  }
  out.sort((a, b) => (a.km == null ? 1e9 : a.km) - (b.km == null ? 1e9 : b.km));
  return out;
}

// ---------- sample places (made up, clearly marked) ----------

const PREFIX = ['Oak Street', 'Northside', 'Blue Door', 'Maple & Main', 'Riverbend', 'Copper', 'Juniper', 'Harbor', 'Lantern', 'Sunday', 'Two Rivers', 'Fox Hollow', 'Ember', 'Granite', 'Willow', 'East Village', 'Brightside', 'Cedar', 'Prairie', 'Union', 'Highland', 'Kestrel', 'Golden Hour', 'Southpoint', 'Fieldstone', 'Bluebird', 'Ironwood', 'Market Street', 'Linden', 'Westgate'];
const OWNERS = ['Maria', 'Dev', 'Tasha', 'Luis', 'Priya', 'Marcus', 'Elena', 'Sam', 'Keisha', 'Omar', 'Hannah', 'Jamal', 'Grace', 'Mateo', 'Aisha', 'Ben', 'Rosa', 'Kwame', 'Lena', 'Tony', 'Mei', 'Andre', 'Nadia', 'Carlos'];
const SURNAMES = ['Lopez', 'Patel', 'Nguyen', 'Johnson', 'Okafor', 'Kim', 'Garcia', 'Schmidt', 'Haddad', 'Brooks', 'Rivera', 'Chen', 'Mensah', 'Novak', 'Reyes', 'Walsh'];
// Sample name endings by category (falls back to the family list).
const NOUNS = {
  gyms: ['Strength Co', 'Fitness', 'Barbell Club', 'Athletic Club', 'Training Studio', 'Boxing Gym', 'Performance', 'CrossFit'],
  yoga: ['Yoga House', 'Pilates Room', 'Yoga Collective', 'Barre Studio', 'Hot Yoga', 'Movement Studio'],
  restaurants: ['Kitchen', 'Taqueria', 'Noodle Bar', 'Diner', 'Bistro', 'Smokehouse', 'Pho House', 'Pizza Co', 'Cantina', 'Grill', 'Dumpling House'],
  cafes: ['Coffee Bar', 'Coffee Co', 'Espresso', 'Cafe', 'Tea House', 'Roasters'],
  bakeries: ['Bakehouse', 'Bakery', 'Donut Co', 'Pastry Shop', 'Bread Co', 'Cake Studio'],
  bars: ['Tap Room', 'Brewing Co', 'Social Club', 'Wine Bar', 'Tavern', 'Cocktail Room'],
  salons: ['Salon', 'Hair Studio', 'Hair Co', 'Blowout Bar', 'Color Bar', 'Hair Lounge'],
  barbers: ['Barber Co', 'Barbershop', 'Cuts', 'Fade Shop', 'Grooming Co'],
  spas: ['Day Spa', 'Massage Studio', 'Wellness Spa', 'Bodywork', 'Spa'],
  nails: ['Nail Lounge', 'Nail Bar', 'Nail Studio', 'Nails & Spa'],
  medspas: ['Aesthetics', 'Skin Studio', 'Med Spa', 'Skin Clinic', 'Laser & Skin'],
  dentists: ['Family Dental', 'Smiles', 'Dental Studio', 'Dentistry', 'Dental Care'],
  chiro: ['Chiropractic', 'Physical Therapy', 'Spine & Sport', 'Wellness Clinic', 'Rehab'],
  vets: ['Animal Clinic', 'Pet Hospital', 'Veterinary Care', 'Animal Hospital'],
  groomers: ['Grooming Parlor', 'Dog Spa', 'Pet Grooming', 'Pup Salon'],
  realtors: ['Realty', 'Home Team', 'Real Estate', 'Properties', 'Realty Group'],
  insurance: ['Insurance Agency', 'Insurance Group', 'Insurance', 'Coverage Co'],
  law: ['Law Group', 'Legal', 'Law Office', 'Law Firm', 'Attorneys'],
  accountants: ['Tax & Accounting', 'CPA', 'Bookkeeping', 'Accounting', 'Tax Service'],
  auto: ['Auto Repair', 'Garage', 'Auto Spa', 'Detail Co', 'Tire & Brake', 'Collision'],
  dealers: ['Motors', 'Auto Sales', 'Car Co', 'Autos'],
  plumbers: ['Plumbing', 'Plumbing & Drain', 'Pipe Works', 'Plumbing Co'],
  hvac: ['Heating & Air', 'Comfort Co', 'HVAC', 'Heating & Cooling'],
  electricians: ['Electric', 'Electrical Services', 'Wiring Co', 'Electric Co'],
  roofers: ['Roofing', 'Roof Co', 'Roofing & Gutters', 'Exteriors'],
  landscapers: ['Lawn & Landscape', 'Landscaping', 'Lawn Care', 'Tree Care', 'Gardens'],
  cleaners: ['Cleaning Co', 'Maids', 'Cleaning Services', 'Janitorial'],
  contractors: ['Plumbing', 'Heating & Air', 'Roofing', 'Electric', 'Home Services', 'Builders', 'Restoration'],
  churches: ['Community Church', 'Fellowship', 'Chapel', 'Church'],
  schools: ['Academy', 'Learning Center', 'Tutoring', 'Prep School', 'Montessori'],
  daycares: ['Kids Club', 'Early Learning', 'Child Care', 'Preschool', 'Little Learners'],
  boutiques: ['Boutique', 'Goods', 'Mercantile', 'Gift Shop', 'Outfitters', 'General Store'],
  florists: ['Flower Co', 'Florist', 'Blooms', 'Floral Studio'],
  photographers: ['Photography', 'Photo Studio', 'Portraits', 'Photo Co'],
  hotels: ['Inn', 'Hotel', 'Guest House', 'Bed & Breakfast', 'Lodge'],
  venues: ['Event Barn', 'Loft', 'Gardens', 'Ballroom', 'Event Space'],
  libraries: ['Public Library', 'Branch Library', 'Library', 'Community Library'],
  community: ['Community Center', 'Rec Center', 'Recreation Center', 'Neighborhood Center', 'Family Center'],
  petstores: ['Pet Supply', 'Pet Shop', 'Feed & Pet', 'Pet Market', 'Pet Pantry'],
  apartments: ['Apartments', 'Lofts', 'Flats', 'Commons', 'Residences'],
  music_stores: ['Music', 'Guitar Shop', 'Piano Co', 'Music Shop', 'Strings'],
  seniors: ['Senior Center', 'Senior Living', 'Active Living Center', 'Retirement Community'],
  phone_repair: ['Phone Repair', 'Device Repair', 'Tech Repair', 'Computer Repair'],
  running: ['Running Co', 'Run Shop', 'Running Outfitters', 'Stride Shop'],
  physio: ['Physical Therapy', 'PT & Rehab', 'Movement Clinic', 'Sports Rehab'],
  other: ['Co', 'Studio', 'Works', 'Collective', 'Shop', 'Services'],
};
const STREETS = ['Main St', 'Grand Ave', 'Oak St', 'Elm St', '2nd Ave', 'Park Ave', 'River Rd', 'Maple Ave', 'University Ave', 'Lincoln Way', 'Cedar St', 'Washington Ave', 'Center St', 'Market St', 'Ingersoll Ave', 'Broadway'];

// Fictional numbers (555-0100 to 555-0199 are set aside for fiction).
function samplePhone(seed) {
  return `(555) 555-01${String(hash(`tel:${seed}`) % 100).padStart(2, '0')}`;
}
function sampleCenter(city) {
  const h = hash(`center:${String(city || '').toLowerCase()}`);
  return { lat: 30 + (h % 1500) / 100, lng: -120 + ((h >> 11) % 4500) / 100 };
}
function cityShort(city) {
  return String(city || '').split(',')[0].replace(/\s+\d{5}(-\d{4})?$/, '').trim() || 'Your city';
}

// limit independents plus one chain, one duplicate and one closed listing, so the filters show their work.
function samplePlaces({ category, city, limit = 25 } = {}) {
  const cat = category && category.q ? category : categoryOf(category);
  const town = cityShort(city);
  const nouns = NOUNS[cat.id] || (cat.custom ? [titleWords(cat.one || 'Co')] : NOUNS.other);
  const center = sampleCenter(city);
  const used = new Set();
  const out = [];
  let i = 0;
  while (out.length < limit && i < limit * 6) {
    const seed = `${cat.id}|${town}|${i}`;
    const h = hash(seed);
    i++;
    const owner = OWNERS[h % OWNERS.length];
    const pre = PREFIX[(h >> 5) % PREFIX.length];
    const noun = nouns[(h >> 9) % nouns.length];
    const style = (h >> 13) % 5;
    const name = style === 0 ? `${owner}'s ${noun}` : style === 1 ? `${SURNAMES[(h >> 3) % SURNAMES.length]} ${noun}` : style === 2 ? `${town} ${noun}` : `${pre} ${noun}`;
    const k = baseName(name);
    if (used.has(k)) continue;
    used.add(k);
    out.push(sampleOne(name, cat, town, center, h));
  }
  // The extras the filters drop: a chain, the same business listed twice, a closed listing.
  if (cat.chains && cat.chains.length) {
    const chain = cat.chains[hash(`${cat.id}${town}`) % cat.chains.length];
    out.splice(3, 0, { ...sampleOne(`${titleWords(chain)} ${town}`, cat, town, center, hash(`chain${town}`)), website: `https://${slug(chain, 30) || 'chain'}.example/locations/${slug(town, 20)}` });
  }
  if (out.length > 6) out.splice(7, 0, { ...out[5], key: `${out[5].key}-2`, name: out[5].name.replace(/ \(sample\)$/, ' LLC (sample)') });
  const closedName = `${PREFIX[hash(`${town}closed`) % PREFIX.length]} ${nouns[0]}`;
  if (!used.has(baseName(closedName))) out.splice(12, 0, { ...sampleOne(closedName, cat, town, center, hash(`closed${town}`)), status: 'CLOSED_PERMANENTLY', closed: true });
  return out;
}

function titleWords(s) {
  return String(s || '').replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// Every sample name ends in "(sample)", so a made-up business is never mistaken for a real one. Keys and
// .example websites come from the name without it.
function sampleOne(name, cat, town, center, h) {
  const base = String(name).replace(/\s*\(sample\)$/i, '');
  const s = slug(base, 40) || `biz-${h % 1000}`;
  const hasSite = h % 8 !== 3; // about 1 in 8 has no website, like real listings
  const reviews = h % 3 === 0 ? 3 + (h % 34) : 40 + ((h >> 4) % 380);
  const rating = Math.round((3.6 + ((h >> 6) % 14) / 10) * 10) / 10;
  const lat = center.lat + (((h >> 8) % 1000) - 500) / 9000;
  const lng = center.lng + (((h >> 18) % 1000) - 500) / 9000;
  return {
    key: `sample:${s}`,
    source: 'sample',
    sample: true,
    attribution: SAMPLE_ATTRIBUTION,
    name: `${base} (sample)`,
    address: `${100 + (h % 8900)} ${STREETS[(h >> 7) % STREETS.length]}, ${town}`,
    lat: Math.round(lat * 1e5) / 1e5,
    lng: Math.round(lng * 1e5) / 1e5,
    website: hasSite ? `https://${s}.example/` : null,
    phone: samplePhone(s),
    rating: Math.min(5, rating),
    reviews,
    status: 'OPERATIONAL',
    closed: false,
    instagram: (h >> 10) % 3 === 0 ? s.replace(/-/g, '').slice(0, 24) : null,
    mapsUrl: null,
  };
}

// ---------- the one call packs use ----------

function secretOf(ctx, name) {
  try {
    return ctx && typeof ctx.secret === 'function' ? ctx.secret(name) : null;
  } catch {
    return null;
  }
}

// { category, city, limit = 25, radiusKm = 15 } -> { places, source, sample, category, city, attribution,
// note, requests }. Unfiltered (call filterPlaces). Never throws for a missing source: falls through to
// sample places marked sample: true, with the reason in `note`. google: false skips Google Places
// (for outputs that store names, phones or addresses, which the Places terms don't allow).
// Google Places is opt-in per call (Legal L53, Oct 19): a pack passes { google: true } only once it
// stores the place ID and its own work and nothing else, re-fetches by place ID to show a listing,
// builds Maps links from the ID, keeps Google fields out of messages and CSVs, and shows the
// "Google Maps" mark wherever results appear. Until then every list comes from OpenStreetMap.
async function findPlaces(ctx, { category, city, limit = 25, radiusKm = 15, google = false } = {}) {
  const cat = category && category.q ? category : categoryOf(category);
  const where = String(city || '').trim();
  const want = Math.max(1, Math.min(60, Number(limit) || 25));
  const result = (places, source, note, extra = {}) => ({
    places,
    source,
    sample: source === 'sample',
    category: { id: cat.id, label: cat.label, one: cat.one, many: cat.many },
    city: where,
    attribution: source === 'google' ? GOOGLE_ATTRIBUTION : source === 'osm' ? OSM_ATTRIBUTION : SAMPLE_ATTRIBUTION,
    note: note || '',
    ...extra,
  });
  const sample = (why) => result(samplePlaces({ category: cat, city: where, limit: want }), 'sample', why);
  if (!where) return sample('Add a city to search real businesses. These are sample businesses.');
  if (ctx && ctx.sample) return sample('Sample run: these businesses are made up.');
  const key = google ? secretOf(ctx, 'places') : null;
  let why = google ? 'No Google Places key yet' : 'Google Places is off for this list';
  if (key) {
    try {
      const g = await googleSearch(ctx, key, { cat, city: where, limit: Math.min(60, want + 5), radiusKm });
      if (g.places.length) return result(g.places, 'google', '', { requests: g.requests });
      why = 'Google Places found nothing for that search';
    } catch (e) {
      if (ctx && ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
      if (/limit|budget|paused/i.test(String(e && e.message))) throw e;
      why = `Google Places didn't answer (${plain(web.scrubKeys(e.message)).slice(0, 60)})`;
    }
  }
  if (cat.osm && cat.osm.length && osmServer(ctx).held) return result(samplePlaces({ category: cat, city: where, limit: want }), 'sample', HELD_NOTE, { held: true });
  if (cat.osm && cat.osm.length) {
    try {
      const center = await geocode(ctx, where);
      if (center) {
        const places = await osmSearch(ctx, { cat, center, radiusKm, limit: want + 5 });
        if (center.searchBy) places.forEach((p) => (p.searchBy = center.searchBy));
        if (places.length) return result(places.slice(0, Math.min(60, want + 15)), 'osm', '', center.searchCredit ? { searchCredit: center.searchCredit } : {});
        why = `${why}, and OpenStreetMap lists none near ${cityShort(where)}`;
      } else why = `${why}, and we couldn't find ${cityShort(where)} on the map`;
    } catch (e) {
      if (ctx && ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
      why = `${why}, and OpenStreetMap didn't answer`;
    }
  } else why = `${why}, and OpenStreetMap has no tag for "${cat.label}"`;
  return sample(`${why}. These are sample businesses so you can see how it works.`);
}

// A `find(type, { city, limit })` for kit first25.household and similar helpers: businesses as
// { name, address, phone, website, rating, reviews, source, place_id, sample }, chains and duplicates
// dropped. Google Places is skipped unless { google: true }, because those helpers save names, phones
// and addresses in CSVs, which the Places terms don't allow (OpenStreetMap or sample instead).
function finder(ctx, { google = false, radiusKm = 15 } = {}) {
  return async (type, { city, limit = 5 } = {}) => {
    const t = type || {};
    const s = t.search || {};
    const cat = categoryOf(s.category || s.words || t.label || t.id);
    if (cat.custom && s.words) Object.assign(cat, { q: plain(s.words), many: plain(s.words) });
    const r = await findPlaces(ctx, { category: cat, city, limit: Math.max(limit * 2, limit + 4), radiusKm, google });
    const { kept } = filterPlaces(r.places, { category: cat });
    return kept.slice(0, limit).map((p) => ({
      name: p.source === 'google' ? '' : p.name,
      address: p.source === 'google' ? '' : p.address || '',
      phone: p.source === 'google' ? '' : p.phone || '',
      website: p.website || '',
      rating: p.source === 'google' ? null : p.rating,
      reviews: p.source === 'google' ? null : p.reviews,
      source: p.source,
      place_id: p.placeId || null,
      sample: !!p.sample,
      ...(p.searchBy ? { searchBy: p.searchBy } : {}),
    }));
  };
}

module.exports = {
  finder,
  overpassFilter,
  overpassQuery,
  CATEGORIES,
  PRICING,
  OSM_ATTRIBUTION,
  OSM_CREDIT,
  OSM_COPYRIGHT,
  HELD_NOTE,
  osmServer,
  overpass,
  creditBlock,
  creditBlocks,
  searchBlock,
  creditLine,
  creditHtml,
  LOCATIONIQ_CREDIT,
  isLocationIq,
  GOOGLE_ATTRIBUTION,
  SAMPLE_ATTRIBUTION,
  categoryOf,
  categoryList,
  findPlaces,
  filterPlaces,
  geocode,
  samplePlaces,
  samplePhone,
  sampleCenter,
  cityShort,
  isChain,
  baseName,
  mapsLink,
  osmLink,
  directionsLink,
  exportable,
  km,
  overpassQuery,
  fromGoogle,
  fromOsm,
  pickBy,
};
