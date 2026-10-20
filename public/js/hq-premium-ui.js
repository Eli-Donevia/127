// The HQ premium pass (HQ_PREMIUM), the pieces built on ported code. Both ports are MIT, (c) 2023 Emil Kowalski
// (public/js/vendor/LICENSE-sonner.txt and LICENSE-vaul.txt). Without this script the page works as before.
import { toast } from './vendor/toast.js';
import { sheet } from './vendor/sheet.js';

// The page's message after a form ("Saved", "Connected", an error) slides in as a toast (Sonner) instead of a bar at
// the top. Wins and notes leave after 6 seconds (hover or focus holds them); errors stay until closed.
const bar = document.querySelector('.shell.hqp [data-flash]');
if (bar) {
  const type = bar.getAttribute('data-flash');
  const text = bar.textContent.trim();
  if (text) {
    bar.hidden = true;
    if (type === 'error') toast.error(text, { duration: Infinity, action: { label: 'Close' } });
    else if (type === 'win') toast.success(text, { duration: 6000 });
    else toast.info(text, { duration: 6000 });
  }
}

// On a phone, More opens as a sheet you can drag down to close (Vaul), and the page behind steps back. The
// <details> menu stays as it was for anyone without this script.
const more = document.querySelector('.shell.hqp .ws-more');
const tiles = more && more.querySelector('.ws-sheet');
if (more && tiles && window.HTMLDialogElement) {
  const d = document.createElement('dialog');
  d.className = 'sht hqp-more';
  d.setAttribute('aria-label', 'More');
  d.innerHTML = '<div class="sht-handle" aria-hidden="true"></div><div class="sht-body"></div>';
  d.querySelector('.sht-body').append(tiles.cloneNode(true));
  document.body.append(d);
  const s = sheet(d, { snapPoints: [1], scaleBackground: document.querySelector('.shell.hqp') });
  more.querySelector('summary').addEventListener('click', (e) => { e.preventDefault(); s.open(); });
}
