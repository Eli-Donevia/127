// Inputs every local tool accepts, so other packs (reviews, household packs) can pass the member's
// facts straight in. Anything left empty comes from the brain and from what the member typed last time.

const BIZ = {
  business: { type: 'string', title: 'Business name', maxLength: 80 },
  what: { type: 'string', title: 'What you do', maxLength: 160, description: 'Like "mobile car detailing" or "dog walking"' },
  city: { type: 'string', title: 'City', maxLength: 80 },
  region: { type: 'string', title: 'State or region', maxLength: 40 },
  phone: { type: 'string', title: 'Phone', maxLength: 40 },
  email: { type: 'string', title: 'Email', maxLength: 120 },
  website: { type: 'string', title: 'Website', maxLength: 300 },
  booking: { type: 'string', title: 'Booking link', maxLength: 300 },
  color: { type: 'string', title: 'Brand color', maxLength: 20, description: 'A hex color like #1f6feb. Your brand color is used when you have one.' },
  services: { type: 'string', title: 'Services and prices, one per line', maxLength: 2000, description: 'Like "Full detail, 180" or "Weekly mow, from 45"' },
  firstName: { type: 'string', title: 'Your first name', maxLength: 40 },
  group: { type: 'string', title: 'Kind of business (optional)', maxLength: 20, description: 'auto, cleaning, yard, washing, home, pets, beauty, fitness, food, lessons, events, pro, retail or general' },
};

const ASSET = { type: 'object', description: 'A saved file' };
const ASSETS = { type: 'array', items: ASSET };

// Remembers the facts the member typed (only the ones they typed) for the next local run.
function typed(input, keys = ['business', 'phone', 'email', 'website', 'booking', 'color', 'area']) {
  const out = {};
  for (const k of keys) if (input[k] != null && String(input[k]).trim()) out[k === 'business' ? 'name' : k] = String(input[k]).trim();
  return out;
}

module.exports = { BIZ, ASSET, ASSETS, typed };
