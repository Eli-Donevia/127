// Checklists (SOPs) without AI: a preset for common jobs, or the member's own words turned into
// numbered steps (paste a voice-note transcript or rough notes). Every step reads as an action.

const { text } = require('../../_kit');

const PRESETS = [
  {
    id: 'clean', duties: 'kitchens, bathrooms, dusting and floors', match: /\b(clean|cleaning|maid|tidy|move-?out|deep clean)\b/i, title: 'Standard home clean', minutes: 150,
    supplies: ['All-purpose cleaner', 'Glass cleaner', 'Bathroom cleaner', 'Microfiber cloths, one color per room type', 'Vacuum and mop', 'Trash bags', 'Gloves'],
    steps: [
      ['Text when you are close', 'Message the customer when you are 10 minutes away so nobody is surprised at the door.'],
      ['Walk through first', 'Walk every room. Note anything fragile or off limits and take before photos of the kitchen, bathrooms and main room.'],
      ['Start high, finish low', 'Dust top to bottom in each room: fans, shelves, frames, then counters. Floors always come last.'],
      ['Kitchen', 'Wipe counters, backsplash, stovetop and appliance fronts. Clean the sink and faucet until they shine. Empty the trash and put in a new bag.'],
      ['Bathrooms', 'Spray toilet, tub and shower first so the cleaner can sit. Clean mirror and sink, then the toilet inside and out, then tub and shower.'],
      ['Bedrooms and living areas', 'Dust surfaces and straighten pillows and throws. Never move papers or open drawers.'],
      ['Floors', 'Vacuum every room including edges, then mop hard floors working toward the door.'],
      ['Final walk', 'Walk every room again with this list and take after photos of the same spots as the before photos.'],
      ['Lock up and tell them', 'Lock up exactly as you found it. Text the customer that you are done, with two after photos.'],
    ],
    quality: ['No streaks on mirrors or glass', 'Sinks and faucets dry and shiny', 'Trash out and new bags in', 'Floors done to the edges', 'Nothing moved that was not on the list'],
    mistakes: ['Cleaning floors before dusting', 'Using one cloth for the bathroom and the kitchen', 'Leaving without after photos'],
    done: 'Every room on the list is done, after photos are sent and the door is locked.',
  },
  {
    id: 'detail', duties: 'washing, drying and interiors', match: /\b(detail|detailing|car wash|auto|vehicle|interior)\b/i, title: 'Full car detail', minutes: 180,
    supplies: ['Two buckets with grit guards', 'pH neutral car soap', 'Wheel cleaner and brushes', 'Microfiber wash mitt and drying towels', 'Shop vacuum', 'Interior cleaner and brushes', 'Glass cleaner', 'Trash bags'],
    steps: [
      ['Confirm the spot', 'Check where you can park and get water. Ask the customer to take valuables out of the car.'],
      ['Before photos', 'Photograph all four sides, the wheels, front seats, back seats and any damage already there.'],
      ['Wheels first', 'Clean wheels and tires before the paint so brake dust never splashes onto clean panels.'],
      ['Wash top down', 'Pre-rinse, then wash with the two-bucket method from the roof down. Rinse before the soap dries.'],
      ['Dry and glass', 'Dry with clean towels, then do glass inside and out.'],
      ['Interior', 'Remove mats, vacuum seats and carpets, then wipe dash, doors and console. Clean and dry the mats before they go back.'],
      ['Final check', 'Walk around in daylight. Look for missed spots on lower panels, door jambs and mirrors.'],
      ['After photos and payment', 'Take after photos from the same angles, show the customer and take payment.'],
    ],
    quality: ['No water spots on glass or paint', 'Door jambs wiped', 'Tires dressed evenly', 'No dust in vents or cup holders', 'Mats dry and back in place'],
    mistakes: ['Washing in direct sun', 'Using the same mitt on wheels and paint', 'Skipping before photos of existing damage'],
    done: 'The car passes your walk-around, after photos are taken and the customer has paid.',
  },
  {
    id: 'lawn', duties: 'mowing, trimming, edging and cleanup', match: /\b(lawn|mow|mowing|yard|landscap\w*|edging|grass)\b/i, title: 'Mow, edge and blow', minutes: 60,
    supplies: ['Mower with a sharp blade', 'String trimmer or edger', 'Leaf blower', 'Fuel', 'Safety glasses and ear protection', 'Yard bags'],
    steps: [
      ['Walk the yard', 'Pick up sticks, toys and rocks before you start. Note sprinkler heads and soft spots.'],
      ['Trim first', 'Trim around beds, fences, trees and posts so the mower picks up the clippings.'],
      ['Mow', 'Mow in straight lines and change direction from last time. Never cut more than a third of the blade height.'],
      ['Edge', 'Edge sidewalks and the driveway for a clean line.'],
      ['Blow', 'Blow clippings off the driveway, walks and porch back onto the lawn.'],
      ['Final look and photo', 'Look from the street, fix any missed strips and take one after photo for the customer.'],
    ],
    quality: ['Even height with no missed strips', 'Clean edges on walks and drive', 'No clippings on hard surfaces', 'Gates closed'],
    mistakes: ['Mowing wet grass', 'Leaving gates open with pets around', 'Dull blades that tear the grass'],
    done: 'The yard looks even from the street, hard surfaces are clear and the customer has the after photo.',
  },
  {
    id: 'pets', duties: 'dog walks, feeding and short updates for owners', match: /\b(dog|pet|walk|walking|sitter|sitting|grooming|cat)\b/i, title: 'Dog walk visit', minutes: 40,
    supplies: ['Leash and backup slip lead', 'Waste bags', 'Treats the owner approved', 'Water and a bowl', 'House key or entry code'],
    steps: [
      ['Check the notes', 'Read the pet notes before you arrive: feeding, meds, fears, other dogs to avoid.'],
      ['Arrive and greet calmly', 'Enter, greet calmly, check the house looks normal and message the owner that you have arrived.'],
      ['Leash up', 'Check the collar or harness fit before you leave the door.'],
      ['Walk the route', 'Walk the agreed route and time. Pick up after the dog every time.'],
      ['Back home', 'Wipe paws, refill water and give food or meds only as written in the notes.'],
      ['Report', 'Send the owner a photo and a two-line update: pee, poop, water, anything unusual.'],
      ['Lock up', 'Check doors and gates, lock up and log the visit.'],
    ],
    quality: ['Walk was the full agreed time', 'Water bowl full', 'House locked as found', 'Owner got a photo and update'],
    mistakes: ['Letting the dog off leash', 'Giving treats the owner did not approve', 'Forgetting the update message'],
    done: 'The dog is home with water, the house is locked and the owner has the photo and update.',
  },
  {
    id: 'ship', duties: 'picking, packing and shipping orders', match: /\b(ship|shipping|order|orders|pack|packing|parcel|candle|candles|etsy|shop)\b/i, title: 'Pack and ship an order', minutes: 15,
    supplies: ['Boxes or mailers in your common sizes', 'Packing paper or padding', 'Tape', 'Thank you card', 'Scale', 'Printer or label app'],
    steps: [
      ['Check the order', 'Read the order twice: item, variant, quantity, gift note and address.'],
      ['Pick and inspect', 'Pull the item and check it for marks, chips or missing parts.'],
      ['Pack it to survive a drop', 'Pad all sides so nothing moves when you shake the box.'],
      ['Add the card', 'Add a handwritten thank you card and any care instructions.'],
      ['Weigh and label', 'Weigh the box, buy the label and stick it flat on the largest side.'],
      ['Mark shipped', 'Mark the order shipped with tracking so the customer gets the update.'],
      ['Drop off the same day', 'Drop off or schedule pickup before the cutoff time.'],
    ],
    quality: ['Right item and variant', 'Nothing moves when shaken', 'Tracking sent to the customer', 'Shipped within the time on your shop page'],
    mistakes: ['Guessing the weight', 'Skipping the inspect step', 'Marking shipped before the label is bought'],
    done: 'The box is dropped off and the customer has tracking.',
  },
  {
    id: 'booking', duties: 'replying to new customers and booking jobs', match: /\b(book|booking|inquiry|inquiries|lead|quote|new customer|intake|onboard\w*)\b/i, title: 'New inquiry to booked job', minutes: 10,
    supplies: ['Your price list', 'Your booking link', 'Your payment link', 'A notes app or spreadsheet for customers'],
    steps: [
      ['Reply fast', 'Reply within one hour during work hours, even if it is only to say you will send a price today.'],
      ['Ask three questions', 'Ask what they need, where, and when they would like it done.'],
      ['Send the price', 'Send a clear price per job or per visit and what it includes.'],
      ['Offer two times', 'Offer two specific times instead of asking when works.'],
      ['Confirm in writing', 'Send a confirmation with date, time window, address and price.'],
      ['Log it', 'Add the customer to your list with their name, contact, job and date.'],
      ['Remind the day before', 'Send a reminder the day before with your time window.'],
    ],
    quality: ['Reply sent within an hour', 'Price and what it includes in writing', 'Customer added to your list'],
    mistakes: ['Asking "when works for you?" instead of offering times', 'Leaving the price vague', 'Forgetting the reminder'],
    done: 'The job is on your calendar, the customer has the confirmation and they are on your list.',
  },
  {
    id: 'review', duties: 'following up with customers after each job', match: /\b(review|reviews|follow ?up|after the job|feedback)\b/i, title: 'Follow up and ask for a review', minutes: 5,
    supplies: ['Your review link', 'Your customer list'],
    steps: [
      ['Wait a day', 'Send the follow up the day after the job, not the same hour.'],
      ['Check they are happy', 'Ask if everything looks right and offer to fix anything that was missed.'],
      ['Fix first', 'If something was missed, book the fix before you ask for anything.'],
      ['Ask once', 'If they are happy, send your review link with one short line. Ask once and do not chase.'],
      ['Thank them', 'Thank them whether or not they leave a review, and note it in your customer list.'],
    ],
    quality: ['Follow up sent the next day', 'Any fix booked before a review ask', 'Only one ask per customer'],
    mistakes: ['Asking for a review before checking they are happy', 'Offering money or discounts for reviews', 'Chasing more than once'],
    done: 'Every customer from yesterday got one follow up, and any fixes are booked.',
  },
];

const GENERIC = {
  id: 'generic', title: '', minutes: 30,
  supplies: ['Everything you need for the job, packed the night before', 'Your phone, charged', 'The customer details and address'],
  steps: [
    ['Get ready the night before', 'Check the job details, pack what you need and plan your route or schedule.'],
    ['Confirm with the customer', 'Send a short message with your time window or delivery date.'],
    ['Start with a before photo', 'Take a photo or note of how things looked when you started.'],
    ['Do the work in the same order every time', 'Follow the same order on every job so nothing gets skipped.'],
    ['Check it against this list', 'Go through every step again before you call it done.'],
    ['Wrap up and tell the customer', 'Send an after photo or a short summary and take payment.'],
    ['Log it', 'Write down the date, the time it took and anything to do differently next time.'],
  ],
  quality: ['Every step checked', 'Customer got an update', 'Paid on the day'],
  mistakes: ['Skipping steps when you are in a hurry', 'Not writing down what took longer than planned'],
  done: 'The work is checked, the customer has heard from you and the job is logged.',
};

function presetFor(task, what = '') {
  const t = String(task || '');
  return PRESETS.find((p) => p.match.test(t)) || PRESETS.find((p) => p.match.test(String(what || ''))) || null;
}

const FILLER = /\b(um+|uh+|erm|you know|basically|kind of|sort of|i guess|i mean|like,|okay so|ok so|so yeah|yeah|alright so|right so)\b[,]?\s*/gi;
const JOINERS = /\s*(?:,\s*then\b|\b(?:and then|after that|afterwards|once that'?s done|once that is done|finally|lastly)\b|^\s*(?:okay so |ok so |so )?(?:then|next|first(?:ly)?|second(?:ly)?|third(?:ly)?)\b),?\s*/gi;
const BREAKS = [',', ' because ', ' so that ', ' so ', ' when ', ' while ', ' before ', ' until ', ' and ', ' but '];
const STOP = /\s+\b(and|the|a|an|to|of|with|for|in|on|at|or|so|it|my|your|then)$/i;

// The action at the front of a sentence: cut at the first natural break, at most 7 words.
function titleOf(p) {
  let t = p;
  for (const b of BREAKS) {
    const i = t.toLowerCase().indexOf(b);
    if (i > 0 && t.slice(0, i).trim().split(/\s+/).length >= 2) t = t.slice(0, i);
  }
  let words = t.trim().split(/\s+/).slice(0, 7).join(' ');
  while (STOP.test(words)) words = words.replace(STOP, '');
  return words.replace(/[,;:]$/, '').trim();
}

// Owner notes speak as "I": the checklist speaks to whoever does the job.
function toYou(p) {
  return p.replace(/\bI am\b/g, 'you are').replace(/\bI'm\b/g, "you're").replace(/\bI've\b/g, "you've").replace(/\bI\b/g, 'you').replace(/\bmy\b/gi, 'your');
}
const LEAD = /^(?:and |so |but |also )?(?:(?:i|we|you)(?:'ll|'d)?\s+)?(?:always |usually |just |normally |then |also |really )*(?:(?:need to|have to|want to|got to|gotta|should|will|can|try to|like to|make sure (?:to|that i|i)?)\s+)?/i;

function cleanPiece(s) {
  let p = String(s || '').replace(/\blike (?=(\d|a |an |ten|five|two|three|four|twenty|fifteen|thirty|half))/gi, 'about ').replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  p = p.replace(LEAD, '').replace(/^[,;:\s]+|[,;:\s]+$/g, '').trim();
  return p;
}

// Rough notes or a transcript -> [{ title, detail }]
function stepsFromNotes(notes, max = 14) {
  const raw = String(notes || '').replace(/\r/g, '').replace(/[•*]+/g, '\n').replace(/^\s*\d+[.)]\s*/gm, '\n');
  const pieces = raw.split(/[.!?;\n]+/).flatMap((s) => s.split(JOINERS)).map(cleanPiece).filter((p) => p.split(/\s+/).length >= 3);
  const seen = new Set();
  const out = [];
  for (const p of pieces) {
    const key = p.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').slice(0, 5).join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    const title = text.sentenceCase(titleOf(p));
    const full = text.sentenceCase(toYou(p));
    out.push({ title, detail: title.toLowerCase() === p.toLowerCase() ? '' : `${full.replace(/[.]+$/, '')}.` });
    if (out.length >= max) break;
  }
  return out;
}

// Facts -> a full SOP. { task, notes, who, minutes, what, business }
function templateSop({ task, notes, who = 'me', minutes, what, business }) {
  const preset = presetFor(task, what);
  const base = preset || GENERIC;
  const fromNotes = stepsFromNotes(notes);
  const steps = (fromNotes.length >= 3 ? fromNotes : base.steps.map(([title, detail]) => ({ title, detail })))
    .map((s, i) => ({ n: i + 1, title: s.title, detail: s.detail }));
  const title = text.titleCase(text.oneLine(task || base.title || 'How we do the job')).slice(0, 80);
  const helper = who === 'helper';
  return {
    title,
    purpose: `The same steps every time, so ${helper ? 'a helper can do this job well without you there' : 'nothing gets skipped on a busy day'}${business ? ` at ${business}` : ''}.`,
    who: helper ? 'A helper, with you the first time' : 'You',
    minutes: Number(minutes) > 0 ? Math.round(Number(minutes)) : base.minutes,
    supplies: base.supplies,
    steps,
    quality: base.quality,
    mistakes: base.mistakes,
    done: base.done,
    duties: preset ? preset.duties : '',
    source: fromNotes.length >= 3 ? 'notes' : preset ? 'preset' : 'generic',
    preset: base.id,
  };
}

module.exports = { PRESETS, GENERIC, presetFor, stepsFromNotes, templateSop, cleanPiece, titleOf };
