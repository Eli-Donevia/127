// The HQ premium pass (HQ_PREMIUM), the pieces built on ported code. Toast and sheet are MIT, (c) 2023 Emil Kowalski
// (public/js/vendor/LICENSE-sonner.txt and LICENSE-vaul.txt); liquid chrome is MIT, (c) 2026 Harsh Jadhav
// (LICENSE-liquid-chrome.txt). Without this script the page works as before.
import { toast } from './vendor/toast.js';
import { sheet } from './vendor/sheet.js';
import { liquidChrome } from './vendor/liquid-chrome.js';

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

// The ask bar: the lens is live liquid chrome (Pop in its highlights), slow at rest, stirred by typing, fast while 127
// works. The grey line opens on the member's question, turns through jobs from their Brain three times, then rests on
// the question. Reduced motion: one still frame of chrome and no turning.
const ask = document.querySelector('.shell.hqp .hqp-ask');
if (ask) {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const input = ask.querySelector('#talk-in');
  const orb = ask.querySelector('#orb');
  const line = ask.querySelector('[data-ask-line]');
  const TONES = {
    dark: { base: [0.03, 0.03, 0.05], mid: [0.72, 0.73, 0.82], spec: [0.49, 0.55, 1] },
    light: { base: [0.55, 0.56, 0.62], mid: [0.93, 0.93, 0.96], spec: [0.29, 0.34, 0.85] },
  };
  const look = () => (document.documentElement.classList.contains('hq-light') ? TONES.light : TONES.dark);
  const REST = { amplitude: 0.6, speed: 0.6 };
  let fx = null;
  const canvas = ask.querySelector('[data-chrome]');
  if (canvas) {
    try { fx = liquidChrome(canvas, { ...REST, ...look(), scale: 1, vignette: 0.6, interactive: true }); } catch (e) { fx = null; }
    if (fx && fx.ok) canvas.parentNode.classList.add('live');
    else fx = null;
  }
  if (fx) {
    new MutationObserver(() => fx.set(look())).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    if (orb) new MutationObserver(() => fx.set(orb.getAttribute('data-state') === 'thinking' ? { amplitude: 1, speed: 3 } : REST)).observe(orb, { attributes: true, attributeFilter: ['data-state'] });
  }
  let stir = 0;
  if (input) input.addEventListener('input', () => {
    ask.classList.toggle('has-text', !!input.value);
    if (!fx) return;
    fx.set({ amplitude: 0.95, speed: 1.8 });
    clearTimeout(stir);
    stir = setTimeout(() => fx.set(REST), 700);
  });
  let ex = [];
  try { ex = JSON.parse(ask.getAttribute('data-ask-ex') || '[]'); } catch (e) { ex = []; }
  if (line && ex.length && !reduce) {
    const list = [line.textContent].concat(ex);
    let i = 0, turns = 0;
    const timer = setInterval(() => {
      if (ask.classList.contains('has-text') || document.hidden) return;
      i = (i + 1) % list.length;
      turns += 1;
      line.classList.add('out');
      setTimeout(() => {
        line.classList.remove('out');
        line.classList.add('in');
        line.textContent = list[i];
        void line.offsetWidth;
        line.classList.remove('in');
      }, 450);
      if (turns >= list.length * 3) clearInterval(timer); // back on the question
    }, 2800);
  }
}
