// The HQ premium pass (HQ_PREMIUM): the page's message after a form ("Saved", "Connected", an error) slides in as a
// toast instead of a bar at the top. The toast is public/js/vendor/toast.js, a port of Sonner (MIT, (c) 2023 Emil
// Kowalski, LICENSE-sonner.txt). Wins and notes leave after 6 seconds (hover or focus holds them); errors stay
// until closed. Without this script the message shows as the bar, as before.
import { toast } from './vendor/toast.js';

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
