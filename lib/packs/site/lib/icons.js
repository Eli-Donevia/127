// A small set of line icons drawn for these templates (24px grid, round caps). Inline SVG, so there
// are no icon fonts or extra requests. Icons are decoration: aria-hidden, the text beside them carries
// the meaning.

const P = {
  phone: '<path d="M6.6 3.5h2.6l1.5 4-2.1 1.5a11.6 11.6 0 0 0 6.4 6.4l1.5-2.1 4 1.5v2.6a2.4 2.4 0 0 1-2.6 2.4C10.6 19.2 4.8 13.4 4.2 6.1a2.4 2.4 0 0 1 2.4-2.6z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.8 6.6 12 12.4l8.2-5.8"/>',
  pin: '<path d="M12 21s6.8-5.9 6.8-11.2a6.8 6.8 0 0 0-13.6 0C5.2 15.1 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3 2"/>',
  check: '<path d="M5 12.6l4.4 4.2L19 7.4"/>',
  arrow: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
  arrowUpRight: '<path d="M7 17 17 7M8.5 7H17v8.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  shield: '<path d="M12 3.2 19.2 6v5.6c0 4.4-3 8-7.2 9.2-4.2-1.2-7.2-4.8-7.2-9.2V6L12 3.2z"/><path d="m8.9 12.2 2.2 2.2 4.1-4.3"/>',
  star4: '<path d="M12 3.5c.7 4.4 4.1 7.8 8.5 8.5-4.4.7-7.8 4.1-8.5 8.5-.7-4.4-4.1-7.8-8.5-8.5 4.4-.7 7.8-4.1 8.5-8.5z"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.9"/><circle cx="17.1" cy="6.9" r=".9" fill="currentColor" stroke="none"/>',
  tiktok: '<path d="M14.2 3.5v10.6a3.6 3.6 0 1 1-3.6-3.6"/><path d="M14.2 3.5c.5 2.7 2.3 4.4 5.1 4.6"/>',
  youtube: '<rect x="2.8" y="5.6" width="18.4" height="12.8" rx="4"/><path d="M10.4 9.3v5.4l4.6-2.7z" fill="currentColor" stroke="none"/>',
  facebook: '<path d="M14.6 7.6h2V4.4h-2.4c-2.6 0-4 1.6-4 4v2H8.4v3.2h1.8V20h3.4v-6.4h2.4l.5-3.2h-2.9V8.8c0-.8.4-1.2 1-1.2z"/>',
  linkedin: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8 10.6V16M8 7.9v.1M11.6 16v-5.4M11.6 13.1c0-1.6 1-2.6 2.4-2.6s2.2 1 2.2 2.6V16"/>',
  x: '<path d="M5 4.6 19 19.4M19 4.6 5 19.4"/>',
  link: '<path d="M10.2 13.8a3.9 3.9 0 0 0 5.6 0l2.9-2.9a3.9 3.9 0 0 0-5.6-5.6l-1 1"/><path d="M13.8 10.2a3.9 3.9 0 0 0-5.6 0l-2.9 2.9a3.9 3.9 0 0 0 5.6 5.6l1-1"/>',
  bag: '<path d="M5.2 8.2h13.6l-1 12H6.2l-1-12z"/><path d="M9 8.2V7a3 3 0 0 1 6 0v1.2"/>',
  play: '<path d="M9 6.8v10.4l8.2-5.2z" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.4 2.4 3.6 5.3 3.6 8.6s-1.2 6.2-3.6 8.6c-2.4-2.4-3.6-5.3-3.6-8.6S9.6 5.8 12 3.4z"/>',
  truck: '<path d="M3 6.5h11v9.5H3zM14 9.5h3.8l3.2 3.4V16H14"/><circle cx="7" cy="17.4" r="1.6"/><circle cx="17.4" cy="17.4" r="1.6"/>',
  refresh: '<path d="M19.6 11.4a7.7 7.7 0 1 1-2.2-5.2M19.6 4.6v4.6H15"/>',
  chat: '<path d="M4.5 5.5h15v10.2h-8.6L6 19.5v-3.8H4.5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.2 3.2M15.2 15.2l3.2 3.2M5.6 18.4l3.2-3.2M15.2 8.8l3.2-3.2"/>',
  heart: '<path d="M12 19.5s-7.5-4.4-7.5-10a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6c0 5.6-7.5 10-7.5 10z"/>',
  leaf: '<path d="M5 19c0-8.5 5.5-13.5 14-14-.5 8.5-5.5 14-14 14z"/><path d="M5 19 13 11"/>',
  bolt: '<path d="M13 3 5.5 13.2H12L11 21l7.5-10.2H12z"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
  user: '<circle cx="12" cy="8.6" r="3.8"/><path d="M4.8 20c.8-3.6 3.6-5.6 7.2-5.6s6.4 2 7.2 5.6"/>',
  home: '<path d="M4 11 12 4.5 20 11v8.5H4z"/><path d="M10 19.5V14h4v5.5"/>',
  utensils: '<path d="M7 3.5v17M4.5 3.5v5a2.5 2.5 0 0 0 5 0v-5M16.5 20.5v-17c-2.2 1.2-3.4 3.6-3.4 6.6v4.4h3.4"/>',
  scissors: '<circle cx="6.5" cy="17" r="2.6"/><circle cx="6.5" cy="7" r="2.6"/><path d="M8.6 8.6 19.5 18M8.6 15.4 19.5 6"/>',
  camera: '<path d="M4 8h3.4l1.6-2.5h6L16.6 8H20v11H4z"/><circle cx="12" cy="13.2" r="3.4"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
};

const SOCIAL_LABEL = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X' };

function icon(name, { size = 20, stroke = 1.8, cls = 'i' } = {}) {
  const body = P[name] || P.arrow;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Icon for a link by where it goes.
function iconForLink(link) {
  const h = String((link && link.href) || '');
  const k = (link && link.kind) || '';
  if (/instagram\.com/.test(h)) return 'instagram';
  if (/tiktok\.com/.test(h)) return 'tiktok';
  if (/youtube\.com|youtu\.be/.test(h)) return 'youtube';
  if (/facebook\.com/.test(h)) return 'facebook';
  if (/linkedin\.com/.test(h)) return 'linkedin';
  if (/(^|\/\/|\.)x\.com|twitter\.com/.test(h)) return 'x';
  if (/^mailto:/.test(h)) return 'mail';
  if (/^tel:/.test(h)) return 'phone';
  if (k === 'booking' || k === 'reserve') return 'calendar';
  if (k === 'order') return 'utensils';
  if (k === 'buy') return 'bag';
  if (k === 'maps') return 'pin';
  if (k === 'listen' || k === 'work') return 'play';
  if (k === 'newsletter' || k === 'form') return 'mail';
  if (k === 'message') return 'chat';
  return 'link';
}

module.exports = { icon, iconForLink, ICONS: P, SOCIAL_LABEL };
