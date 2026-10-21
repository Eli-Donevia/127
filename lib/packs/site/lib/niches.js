// What we know about common first businesses, so the template copy reads like it was written for
// this one: what one job is called, who buys, the result they want, the button words, which design
// fits and which schema.org type Google should see (data/schema-types.json). Copy here describes
// the kind of work in general terms only; facts about the member's business come from the member.

const NICHES = [
  // ---------- added for the verticals (content/verticals, lib/verticals.js): kinds the list below would miss ----------
  { id: 'dispatch', re: /\b(dispatch(er|ers|ing)?|dispatch service)\b/i, template: 'agency', schema: 'Organization', noun: 'load', people: 'owner-operators', result: 'loads booked and the paperwork handled', book: 'Talk to dispatch', gallery: ['The load board on screen', 'A rate confirmation', 'The weekly carrier report', 'A truck on the road'], hero: 'The load board on screen' },
  { id: 'trucking', re: /\b(trucking|owner.?operators?|dry van|reefer|flatbed|hotshot|freight hauling|truckload)\b/i, template: 'local-service', schema: 'LocalBusiness', noun: 'load', people: 'brokers and shippers', result: 'freight picked up and delivered as booked', book: 'Contact dispatch', gallery: ['The truck at a dock', 'The trailer, loaded', 'On the road', 'Paperwork, signed'], hero: 'The truck, parked at a dock' },
  { id: 'breeder', re: /\b(breeders?|breeding|kennels?|litters?)\b/i, template: 'local-service', schema: 'LocalBusiness', noun: 'puppy', people: 'families', result: 'a puppy raised in a home you can visit', book: 'Join the waitlist', gallery: ['The litter at play', 'Mom with the puppies', 'Where the puppies are raised', 'A puppy going home'], hero: 'The current litter' },
  { id: 'eyewear', re: /\b(eyewear|eyeglass(es)?|sunglasses|optical|acetate frames?|glasses frames?)\b/i, template: 'product', schema: 'Product', noun: 'frame', people: 'people who wear glasses', result: 'frames that fit your face', book: 'Shop frames', gallery: ['A frame on a face', 'The frame, folded, up close', 'The case and cloth', 'Three colorways side by side'], hero: 'A frame, folded, up close' },
  { id: 'roaster', re: /\b(roast(er|ers|ery|ing)|coffee beans?|single.?origin)\b/i, template: 'product', schema: 'Product', noun: 'bag', people: 'coffee drinkers', result: 'coffee roasted in small batches', book: 'Shop coffee', gallery: ['Beans in the cooling tray', 'A bag, sealed and dated', 'A pour-over, brewing', 'The roaster at work'], hero: 'Beans in the cooling tray' },
  // ---------- home and local services ----------
  {
    id: 'detailing',
    re: /\b(detail(ing|er)?|car wash|auto spa|ceramic coat|paint correction)\b/i,
    template: 'local-service',
    schema: 'AutoWash',
    noun: 'detail',
    people: 'drivers',
    result: 'a car that feels new again',
    book: 'Book a detail',
    gallery: ['A finished interior detail', 'Paint, up close after a wash and wax', 'A freshly detailed car', 'Wheels and tires after cleaning'],
    hero: 'A freshly detailed car',
  },
  {
    id: 'washing',
    re: /\b(pressure wash|power wash|soft wash|window clean|gutter clean|roof clean|house wash)/i,
    template: 'local-service',
    schema: 'HomeAndConstructionBusiness',
    noun: 'job',
    people: 'homeowners',
    result: 'surfaces that look new again',
    book: 'Book a wash',
    gallery: ['A driveway after pressure washing', 'A clean house exterior', 'Clear windows after a wash', 'A deck, cleaned'],
    hero: 'A clean driveway and house front',
  },
  {
    id: 'cleaning',
    re: /\b(house ?clean|home clean|cleaning|maid|janitorial|deep clean|move.?(in|out) clean|airbnb turnover|office clean)/i,
    template: 'local-service',
    schema: 'HomeAndConstructionBusiness',
    noun: 'clean',
    people: 'busy households',
    result: 'a home that feels calm and fresh',
    book: 'Book a clean',
    gallery: ['A freshly cleaned kitchen', 'A tidy living room', 'A spotless bathroom', 'Cleaning supplies ready to go'],
    hero: 'A bright, freshly cleaned home',
  },
  {
    id: 'lawn',
    re: /\b(lawn|landscap|yard|mow(ing)?|snow (removal|plow)|gardening|hedge|leaf removal|mulch)/i,
    template: 'local-service',
    schema: 'HomeAndConstructionBusiness',
    noun: 'visit',
    people: 'homeowners',
    result: 'a yard you are proud to come home to',
    book: 'Book a visit',
    gallery: ['A freshly mowed lawn', 'Clean edges along a driveway', 'A tidy garden bed', 'A finished yard'],
    hero: 'A freshly cut lawn',
  },
  {
    id: 'painting',
    re: /\b(painter|painting company|house paint|interior paint|exterior paint)/i,
    template: 'local-service',
    schema: 'HousePainter',
    noun: 'project',
    people: 'homeowners',
    result: 'fresh walls without the mess',
    book: 'Get a quote',
    gallery: ['A freshly painted room', 'Clean paint lines', 'An exterior after painting', 'A finished project'],
    hero: 'A freshly painted room',
  },
  {
    id: 'handyman',
    re: /\b(handyman|handy ?person|home repair|furniture assembly|tv mount|odd jobs|drywall)/i,
    template: 'local-service',
    schema: 'HomeAndConstructionBusiness',
    noun: 'job',
    people: 'homeowners',
    result: 'your to-do list, finally done',
    book: 'Get a quote',
    gallery: ['A finished repair', 'Furniture, assembled', 'A mounted TV', 'Tools ready for the job'],
    hero: 'A finished home repair',
  },
  { id: 'plumbing', re: /\bplumb/i, template: 'local-service', schema: 'Plumber', noun: 'job', people: 'homeowners', result: 'water running the way it should', book: 'Get a quote', gallery: ['A finished install', 'Clean pipe work', 'A new fixture', 'A repaired leak'], hero: 'Clean plumbing work' },
  { id: 'electric', re: /\belectric(al|ian)\b/i, template: 'local-service', schema: 'Electrician', noun: 'job', people: 'homeowners', result: 'power you can count on', book: 'Get a quote', gallery: ['A new light fixture', 'A tidy panel', 'Outdoor lighting', 'A finished install'], hero: 'Electrical work, done neatly' },
  { id: 'hvac', re: /\b(hvac|heating|air condition|furnace)\b/i, template: 'local-service', schema: 'HVACBusiness', noun: 'visit', people: 'homeowners', result: 'a home at the right temperature', book: 'Book a visit', gallery: ['A serviced AC unit', 'A clean furnace', 'A new thermostat', 'A finished install'], hero: 'A serviced heating and cooling unit' },
  { id: 'roofing', re: /\broof/i, template: 'local-service', schema: 'RoofingContractor', noun: 'project', people: 'homeowners', result: 'a roof you can stop worrying about', book: 'Get a quote', gallery: ['A finished roof', 'Shingles up close', 'Gutters and edges', 'A roof repair'], hero: 'A finished roof' },
  { id: 'trucking', re: /\b(trucking|truckers?|freight|logistics|carriers?|dispatch\w*|box trucks?|hot ?shot|ltl|ftl|3pl|drayage|flatbed|reefer|owner.?operators?)\b/i, template: 'local-service', schema: 'LocalBusiness', noun: 'load', people: 'shippers and brokers', result: 'loads picked up on time and delivered as promised', book: 'Get a quote', gallery: ['A truck on the highway at dawn', 'The fleet in the yard', 'A load strapped and ready', 'A delivery at the dock'], hero: 'A truck on the highway at dawn' },
  { id: 'moving', re: /\b(moving|movers|junk removal|hauling)\b/i, template: 'local-service', schema: 'MovingCompany', noun: 'move', people: 'families', result: 'a move without the stress', book: 'Get a quote', gallery: ['A packed truck', 'Boxes, labeled', 'Furniture, wrapped', 'An empty, clean room'], hero: 'A packed moving truck' },
  { id: 'techhelp', re: /\b(tech help|tech support|tech tutor\w*|technology help|computer (help|repair|support|setup|lessons?)|phone help|smartphone help|iphone help|ipad help|tablet help|it support|senior tech)\b/i, template: 'local-service', schema: 'LocalBusiness', noun: 'visit', people: 'people who want patient help with their tech', result: 'devices set up the way you like, explained in plain words', book: 'Book a visit', gallery: ['Help at the kitchen table', 'A phone being set up', 'A tidy desk and printer', 'A printed checklist on the table'], hero: 'Tech help at a kitchen table' },
  // In-home cooking is a local service, not a restaurant: no counter to visit and nothing to order.
  { id: 'chef', re: /\b(meal prep\w*|personal chefs?|private chefs?|in-home chefs?|home chefs?|chef services?)\b/i, template: 'local-service', schema: 'LocalBusiness', noun: 'cook day', people: 'busy households', result: 'home-cooked meals without the cooking', book: 'Book a cook day', gallery: ['Labeled containers in the fridge', 'A plated dinner', 'Fresh groceries laid out', 'A clean kitchen after a cook day'], hero: 'A week of meals, labeled and ready' },
  // Grooming is its own trade: the pet-sitting promise ("while you are away") is wrong for a groomer.
  { id: 'petgroom', re: /\b(pet groom\w*|dog groom\w*|cat groom\w*|grooming|groomers?)\b/i, template: 'local-service', schema: 'LocalBusiness', noun: 'groom', people: 'pet owners', result: 'a clean, comfortable pet who looks and feels their best', book: 'Book a groom', gallery: ['A dog after a bath and trim', 'Brushes and towels, ready', 'A calm cat on the table', 'A fresh trim, close up'], hero: 'A dog fresh from the groomer' },
  {
    id: 'petcare',
    re: /\b(dog walk|pet sit|pet care|dog sit|cat sit|doggy daycare|pet taxi)/i,
    template: 'local-service',
    schema: 'LocalBusiness',
    noun: 'visit',
    people: 'pet owners',
    result: 'happy, well cared for pets while you are away',
    book: 'Book a visit',
    gallery: ['A happy dog on a walk', 'A cat at home, relaxed', 'A dog after grooming', 'Leash and treats, ready'],
    hero: 'A happy dog on a walk',
  },
  // ---------- studios ----------
  { id: 'florist', re: /\b(florists?|flower (shop|studio|farm)s?|flowers|floral|bouquets?|arrangements)\b/i, template: 'studio', schema: 'Florist', noun: 'order', people: 'customers', result: 'fresh flowers, arranged for the day they are for', book: 'Order flowers', gallery: ['A hand-tied bouquet', 'Stems on the bench', 'The cooler, full', 'An arrangement, delivered'], hero: 'A hand-tied bouquet' },
  { id: 'barber', re: /\b(barber(shop|s)?|fades?|beard trims?|hot towel shaves?)\b/i, template: 'studio', schema: 'HairSalon', noun: 'cut', people: 'clients', result: 'a sharp cut that fits you', book: 'Book a cut', gallery: ['A fresh fade', 'The barber chair', 'Tools of the trade', 'A clean beard line'], hero: 'Inside the shop' },
  { id: 'nails', re: /\b(nails?|manicures?|pedicures?|gel x|acrylics)\b/i, template: 'studio', schema: 'NailSalon', noun: 'appointment', people: 'clients', result: 'nails you keep looking at', book: 'Book now', gallery: ['A finished gel manicure', 'Nail art, up close', 'The nail station', 'A pedicure, finished'], hero: 'A finished manicure' },
  { id: 'beauty', re: /\b(lash\w*|brows?|makeup artist|mua|facials?|esthetic\w*|skin ?care studio|waxing|spray tans?|med ?spas?)\b/i, template: 'studio', schema: 'BeautySalon', noun: 'appointment', people: 'clients', result: 'a look you feel good in', book: 'Book now', gallery: ['Lashes, up close', 'A calm treatment room', 'Skin care products', 'A finished look'], hero: 'A calm treatment room' },
  { id: 'salon', re: /\b(salons?|hair ?stylists?|hairstyl\w*|blowouts?|balayage|braid\w*|locs|loctician\w*|hair colou?r\w*|extensions)\b/i, template: 'studio', schema: 'HairSalon', noun: 'appointment', people: 'clients', result: 'hair you love walking out with', book: 'Book now', gallery: ['A finished cut and style', 'Color, up close', 'The studio chair', 'A blowout, finished'], hero: 'Inside the studio' },
  { id: 'spa', re: /\b(massages?|massage therap\w*|day spas?|bodywork|reflexology|wellness studio)\b/i, template: 'studio', schema: 'DaySpa', noun: 'session', people: 'clients', result: 'an hour that resets your week', book: 'Book a session', gallery: ['A calm treatment room', 'Warm towels and oils', 'The front desk', 'A quiet corner of the studio'], hero: 'A calm treatment room' },
  { id: 'tattoo', re: /\btattoo/i, template: 'studio', schema: 'TattooParlor', noun: 'session', people: 'clients', result: 'art you will be proud to wear', book: 'Book a consult', gallery: ['A finished piece', 'Linework, up close', 'The studio', 'Flash on the wall'], hero: 'Inside the studio' },
  // Classes where people make something (pottery wheel, a painting night): a studio people book a seat at, not a shop.
  { id: 'classes', re: /\b((pottery|ceramics?|clay|wheel|art|painting|drawing|watercolou?r|sewing|knitting|crochet|candle.?making|floral|flower arranging|cooking|baking|cocktail|jewel(le)?ry.?making|woodworking|calligraphy|glass.?blowing|stained glass|printmaking)\s+(classes?|lessons?|workshops?|nights?|sessions?)|(classes?|workshops?)\s+in\s+(pottery|ceramics|painting|sewing|cooking|baking))\b/i, template: 'studio', schema: 'LocalBusiness', noun: 'class', people: 'beginners and regulars', result: 'an evening of making something with your hands', book: 'Book a class', gallery: ['Hands at the wheel', 'The studio, set for class', 'Finished pieces on a shelf', 'Tools laid out'], hero: 'The studio, set for class' },
  { id: 'fitness', re: /\b(personal train\w*|trainers?|fitness studio|gyms?|yoga|pilates|boxing|crossfit|spin studio|barre|dance studio|martial arts)\b/i, template: 'studio', schema: 'ExerciseGym', noun: 'session', people: 'members', result: 'workouts that fit your week', book: 'Book a session', gallery: ['A class in motion', 'Training, up close', 'The studio floor', 'Equipment, ready'], hero: 'The studio floor' },
  // ---------- food ----------
  // A roaster sells beans (a shop); a cafe pours them (a restaurant).
  { id: 'roaster', re: /\b(coffee roast\w*|roaster(y|ies)?|roastery|whole bean|single origin|coffee beans|coffee subscriptions?|specialty coffee)\b/i, template: 'product', schema: 'Product', noun: 'bag', people: 'coffee drinkers', result: 'fresh coffee, roasted to order', book: 'Shop coffee', gallery: ['A bag of beans with its roast date', 'Beans in the roaster', 'A pour over, brewing', 'The week\'s coffees lined up'], hero: 'A fresh bag of beans' },
  { id: 'cafe', re: /\b(cafe|café|coffee shop|coffee bar|espresso|tea house|boba)\b/i, template: 'restaurant', schema: 'CafeOrCoffeeShop', noun: 'visit', people: 'guests', result: 'good coffee and a seat to enjoy it', book: 'Order ahead', gallery: ['A fresh latte', 'The counter', 'Pastries in the case', 'A quiet table by the window'], hero: 'A fresh cup of coffee' },
  { id: 'bakery', re: /\b(bakery|bake shop|baker|cakes?|cookies|pastr(y|ies)|bread|cupcakes?|donuts?|bagels?)\b/i, template: 'restaurant', schema: 'Bakery', noun: 'order', people: 'customers', result: 'fresh bakes worth the trip', book: 'Order now', gallery: ['Fresh bread from the oven', 'A celebration cake', 'Cookies on a tray', 'The bakery counter'], hero: 'Fresh bakes on the counter' },
  { id: 'bar', re: /\b(bar|pub|brewery|taproom|wine bar|winery|cocktail)\b/i, template: 'restaurant', schema: 'BarOrPub', noun: 'visit', people: 'guests', result: 'a good drink with good people', book: 'Reserve a table', gallery: ['A drink on the bar', 'The taps', 'A full room on a Friday', 'Small plates'], hero: 'The bar' },
  { id: 'foodtruck', re: /\b(food trucks?|catering|caterers?|pop.?up kitchen)\b/i, template: 'restaurant', schema: 'FoodEstablishment', noun: 'order', people: 'customers', result: 'food people talk about after', book: 'Order now', gallery: ['A plate, fresh from the kitchen', 'The truck', 'Prep in progress', 'A full spread'], hero: 'A plate, fresh from the kitchen' },
  { id: 'restaurant', re: /\b(restaurant|kitchen|grill|bistro|tacos?|taqueria|pizza|burgers?|bbq|barbecue|sushi|ramen|diner|eatery|deli|brunch)\b/i, template: 'restaurant', schema: 'Restaurant', noun: 'meal', people: 'guests', result: 'a meal worth coming back for', book: 'Order online', gallery: ['A signature dish', 'The dining room', 'The kitchen at work', 'A table set for dinner'], hero: 'A signature dish' },
  // ---------- people who teach, coach and consult ----------
  { id: 'music', re: /\b(music (lessons?|teach\w*|instructors?|studio)|piano|guitar|violin|viola|cello|ukulele|drum (lessons?|teachers?)|voice lessons?|singing lessons?|vocal (coach\w*|lessons?))\b/i, template: 'coach', schema: 'LocalBusiness', noun: 'lesson', people: 'students and families', result: 'patient one to one lessons on the music you want to play', book: 'Book a first lesson', gallery: ['A lesson in progress', 'Hands on the instrument', 'Sheet music on the stand', 'The teaching space'], hero: 'A lesson in progress' },
  { id: 'tutoring', re: /\b(tutors?|tutoring|lessons?|test prep|sat prep|act prep|homework help|reading help|math help|piano|guitar|music teachers?|language teachers?)\b/i, template: 'coach', schema: 'LocalBusiness', noun: 'lesson', people: 'students and parents', result: 'patient, one to one help with schoolwork', book: 'Book a first lesson', gallery: ['A lesson in progress', 'Notes and practice work', 'A quiet study space', 'Books and materials'], hero: 'A lesson in progress' },
  { id: 'coaching', re: /\b(coach(es|ing)?|mentor\w*|accountability|mindset)\b/i, template: 'coach', schema: 'LocalBusiness', noun: 'session', people: 'clients', result: 'clear next steps and someone in your corner', book: 'Book a call', gallery: ['A coaching session', 'Notes from a session', 'A calm workspace', 'A walk and talk'], hero: 'A portrait of the coach' },
  { id: 'event', re: /\b(workshops?|bootcamps?|retreats?|cohorts?|masterclass(es)?|camps?)\b/i, template: 'coach', schema: 'LocalBusiness', noun: 'spot', people: 'people', result: 'a few focused hours with people like you', book: 'Save my spot', gallery: ['The room, set up', 'People working together', 'Notes on a whiteboard', 'The host, speaking'], hero: 'The room, ready for the group' },
  // ---------- B2B services ----------
  { id: 'webdesign', re: /\b(web ?design|websites?|web developer|landing pages?|webflow|wordpress|shopify (dev|design))\b/i, template: 'agency', schema: 'Organization', noun: 'project', people: 'businesses', result: 'a clear, fast website for your business', book: 'Start a project', gallery: ['A website on a laptop', 'A homepage on a phone', 'Design work in progress', 'A finished launch'], hero: 'A website on a laptop' },
  { id: 'social', re: /\b(social media|content manag\w*|instagram manag\w*|smm|community manag\w*)\b/i, template: 'agency', schema: 'Organization', noun: 'month', people: 'businesses', result: 'steady posts that sound like you', book: 'Start a project', gallery: ['A content calendar', 'Posts on a phone', 'A shoot in progress', 'A finished post grid'], hero: 'Posts on a phone' },
  { id: 'automation', re: /\b(automations?|ai agents?|chatbots?|ai front desk|zapier|make\.com|ai receptionists?|crm setup|missed.?calls?)\b/i, template: 'agency', schema: 'Organization', noun: 'build', people: 'businesses', result: 'the repetitive tasks, set up to run on their own', book: 'Book a call', gallery: ['An automation on screen', 'A booking flow on a phone', 'A dashboard', 'A build in progress'], hero: 'An automation on screen' },
  { id: 'marketing', re: /\b(marketing|seo|google ads|meta ads|facebook ads|ppc|lead gen\w*|copywrit\w*|branding agency|agency)\b/i, template: 'agency', schema: 'Organization', noun: 'project', people: 'businesses', result: 'marketing that is clear and consistent', book: 'Book a call', gallery: ['A campaign on screen', 'A strategy session', 'Ad creative in progress', 'A results report'], hero: 'A campaign on screen' },
  { id: 'consulting', re: /\b(consult(ant|ants|ing)|advisors?|fractional|bookkeep\w*|accounting|tax prep|virtual assistan\w*|va|operations)\b/i, template: 'agency', schema: 'Organization', noun: 'engagement', people: 'businesses', result: 'clear next steps for your business', book: 'Book a call', gallery: ['A working session', 'Notes on a whiteboard', 'A laptop and coffee', 'A plan on paper'], hero: 'A working session' },
  // ---------- makers and creators ----------
  { id: 'video', re: /\b(video edit\w*|editors?|editing|videograph\w*|filmmak\w*|reels? edit\w*|youtube edit\w*|motion design\w*|animat(or|ion)s?|short.?form edit\w*)\b/i, template: 'portfolio', schema: 'Person', noun: 'project', people: 'brands and creators', result: 'clean, tight edits that fit your brand', book: 'Start a project', gallery: ['A brand film', 'A short form edit', 'A product video', 'A behind the scenes cut', 'An event recap', 'A YouTube edit'], hero: 'A frame from a recent edit' },
  { id: 'bizphoto', re: /\b((business|commercial|food|brand|restaurant|real estate|interior|headshot) photograph\w*|photograph\w* for (local )?business\w*)\b/i, template: 'portfolio', schema: 'LocalBusiness', noun: 'shoot', people: 'local businesses', result: 'photos of your place, your work and your team that you will actually use', book: 'Book a shoot', gallery: ['A dish for the menu', 'The storefront', 'A team headshot', 'A product up close', 'The room before opening', 'Hands at work'], hero: 'A favorite recent photo' },
  { id: 'photo', re: /\b(photograph\w*|photo shoots?|headshots?|portraits?|wedding photo\w*|product photo\w*)\b/i, template: 'portfolio', schema: 'LocalBusiness', noun: 'shoot', people: 'clients', result: 'photos you will actually use', book: 'Book a shoot', gallery: ['A portrait session', 'A product shot', 'An event moment', 'A headshot', 'A family session', 'A detail shot'], hero: 'A favorite recent photo' },
  { id: 'design', re: /\b(graphic design\w*|designers?|illustrat\w*|logo design\w*|brand identit\w*|ui design|ux)\b/i, template: 'portfolio', schema: 'Person', noun: 'project', people: 'brands', result: 'clean design that fits your brand', book: 'Start a project', gallery: ['A brand identity', 'A poster', 'A packaging design', 'An illustration', 'A website design', 'A social kit'], hero: 'A recent design project' },
  { id: 'ugc', re: /\b(ugc|user generated content|content creator for brands)\b/i, template: 'portfolio', schema: 'Person', noun: 'video', people: 'brands', result: 'ads that feel like a friend recommending you', book: 'Work with me', gallery: ['A product unboxing', 'A talking head review', 'A how to video', 'A lifestyle clip', 'A hook test', 'A before and after'], hero: 'A frame from a recent video' },
  { id: 'creator', re: /\b(creators?|influencers?|youtubers?|streamers?|podcast(er|s)?|newsletters?|faceless|channels?|bloggers?|writers?)\b/i, template: 'creator', schema: 'Person', noun: 'post', people: 'followers', result: 'more of what you come here for', book: 'Start here', gallery: [], hero: '' },
  // ---------- products ----------
  { id: 'eyewear', re: /\b(eyewear|eye ?glasses|glasses|sunglasses|spectacles|optical|opticians?|frames? (shop|store|brand))\b/i, template: 'product', schema: 'Product', noun: 'pair', people: 'people who want frames they love', result: 'frames that fit your face and your days', book: 'Shop frames', gallery: ['A pair on a lit table', 'Frames in every colour', 'A pair being worn', 'The case and cloth'], hero: 'A pair of frames on a lit table' },
  { id: 'apparel', re: /\b(streetwear|apparel|clothing( brand| line)?|t-?shirts?|tees|hoodies?|crewnecks?|fashion brand|merch drops?)\b/i, template: 'product', schema: 'Product', noun: 'piece', people: 'people who wear it', result: 'pieces made in small runs', book: 'Shop the drop', gallery: ['The new piece on a hanger', 'Fabric up close', 'The piece being worn', 'The drop, folded'], hero: 'The new piece on a hanger' },
  { id: 'digital', re: /\b(templates?|notion|ebooks?|e-books?|presets?|printables?|digital (products?|downloads?)|planners?|canva kits?|spreadsheets?|online courses?)\b/i, template: 'product', schema: 'Product', noun: 'download', people: 'buyers', result: 'a simple tool you can use today', book: 'Get it now', gallery: ['The template, open on a laptop', 'A page up close', 'The template on a phone', 'What comes in the download'], hero: 'The product, open on a laptop' },
  { id: 'product', re: /\b(candles?|soaps?|jewel\w*|apparel|clothing|t-?shirts?|hoodies?|merch\w*|skincare|cosmetics?|supplements?|sauces?|snacks?|accessor\w*|handbags?|prints?|stickers?|mugs?|toys?|plants?|pottery|ceramics|handmade|hand-poured|shopify|etsy|e-?commerce|online store|brand)\b/i, template: 'product', schema: 'Product', noun: 'order', people: 'customers', result: 'something you will reach for every day', book: 'Buy now', gallery: ['The product, up close', 'The product in use', 'Packaging', 'The product in a home'], hero: 'The product, up close' },
  { id: 'resale', re: /\b(resale|resell\w*|flipp?ing|thrift\w*|vintage|sneakers?|consignment)\b/i, template: 'product', schema: 'Product', noun: 'piece', people: 'buyers', result: 'great pieces at fair prices', book: 'Shop the drop', gallery: ['The latest drop', 'A piece up close', 'Tags and details', 'Packed to ship'], hero: 'The latest drop' },
];

const GENERIC = {
  local: { id: 'service', template: 'local-service', schema: 'LocalBusiness', noun: 'job', people: 'customers', result: 'the job done right the first time', book: 'Book now', gallery: ['Our work, finished', 'A job in progress', 'Tools ready to go', 'A finished job, up close'], hero: 'Our work, finished' },
  online: { id: 'online', template: 'agency', schema: 'Organization', noun: 'project', people: 'clients', result: 'work you are proud to share', book: 'Get in touch', gallery: ['Work in progress', 'A finished project', 'A planning session', 'A launch day'], hero: 'Work in progress' },
};

// Best niche for a business from its own words. Returns a profile (never null). What they do comes
// before who it's for: "Video editing for local gyms" is video, not a gym.
function nicheFor({ what, niche, offer, name, online } = {}) {
  const head = (s) => String(s || '').split(/\s+for\s+/i)[0];
  const tries = [[what, niche].map(head), [what, niche, offer, name]];
  for (const parts of tries) {
    const hay = parts.filter(Boolean).join(' ');
    if (!hay) continue;
    for (const n of NICHES) if (n.re.test(hay)) return n;
  }
  return online ? GENERIC.online : GENERIC.local;
}

// Does the business come to the customer? (Only from the member's own words.)
function isMobile(...texts) {
  return /\b(mobile|we come to you|come to you|at your (home|house|office|door|place)|on.?site|in your driveway|house ?calls?)\b/i.test(texts.filter(Boolean).join(' '));
}

module.exports = { NICHES, GENERIC, nicheFor, isMobile };
