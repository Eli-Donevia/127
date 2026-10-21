#!/usr/bin/env node
// Builds the Motion Pack (content/shop/packs.json, slug "motion"): one self-contained .html per move, each a working
// demo with the move's code inline, how to use it and a prompt to hand an AI builder. Sources: the site pack's motion
// runtime (lib/packs/site/lib/motion.js and choreo-client.js, driving the vendored Motion bundle, MIT) and the MIT ports
// in content/shop/src/ports (licenses kept inside each file). Output: content/shop/files/motion/. Run after either
// source changes; test/shop.test.js checks the output is current.
//
//   node scripts/build-motion-pack.js          writes the files
//   node scripts/build-motion-pack.js --check  exits 1 if a file would change

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MOTION_CSS, MOTION_JS, CHOREO_PRESETS, resolveChoreo, choreoAssets } = require('../lib/packs/site/lib/motion');

const ROOT = path.join(__dirname, '..', 'content', 'shop');
const PORTS = path.join(ROOT, 'src', 'ports');
const OUT = path.join(ROOT, 'files', 'motion');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
// A port's module source, made to run inline (its exports become plain declarations).
// Its header's em dash becomes a colon, so the delivered file passes 127's copy check.
const inline = (src) => src.replace(/^export (async )?function /gm, '$1function ').replace(/^export \{[^}]*\};?$/gm, '').replace(/ — /g, ': ');

const SHELL_CSS = `
:root{--bg:#060607;--panel:#0e0f12;--line:rgba(255,255,255,.09);--ink:#eceef4;--dim:#9a9eab;--faint:#6b6f7b;--pop:#7c8cff;--primary:#e3e6f1}
*{box-sizing:border-box}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:0 max(16px,4vw)}
.bar{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 0;font:12px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
.bar button{font:inherit;letter-spacing:inherit;text-transform:inherit;color:var(--ink);background:none;border:1px solid var(--line);border-radius:999px;padding:9px 14px;cursor:pointer}
.bar button:hover{border-color:var(--dim)}
.stage{min-height:78vh;min-height:78svh;display:grid;align-content:center;gap:28px;padding:40px 0 64px}
.stage h1{margin:0;font-size:clamp(44px,9vw,112px);line-height:.95;letter-spacing:-.045em;font-weight:650;max-width:11ch;background:linear-gradient(180deg,#fff 30%,#a9adb9);-webkit-background-clip:text;background-clip:text;color:transparent}
.stage .lead{margin:0;max-width:44ch;color:var(--dim);font-size:clamp(16px,2vw,19px)}
.row{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(24px,5vw,72px);align-items:center}
@media (max-width:760px){.row{grid-template-columns:1fr}}
.subject{aspect-ratio:4/5;border-radius:22px;background:linear-gradient(160deg,#16171c,#0b0b0e);border:1px solid var(--line);position:relative;overflow:hidden;display:grid;place-items:center}
.subject svg{width:72%;height:auto}
.btn{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 22px;border-radius:999px;background:var(--primary);color:#0a0a0c;font-weight:600;text-decoration:none;width:max-content}
.how{border-top:1px solid var(--line);padding:56px 0 80px;display:grid;gap:28px}
.how h2{margin:0;font-size:24px;letter-spacing:-.01em;font-weight:600}
.how p,.how li{color:var(--dim);max-width:68ch}
.how ol{margin:0;padding-left:1.2em;display:grid;gap:8px}
.how code{font:13px/1.5 ui-monospace,"SF Mono",Menlo,monospace;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:1px 6px}
.prompt{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px;font:14px/1.6 ui-monospace,"SF Mono",Menlo,monospace;color:var(--ink);white-space:pre-wrap;margin:0}
.lic{font-size:13px;color:var(--faint)}
`;

// The demo subject: a line drawing (paths with pathLength=1 so "draw" can draw it), lit in the pop colour.
const SUBJECT_SVG = `<svg viewBox="0 0 200 240" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<path pathLength="1" d="M30 200 L100 40 L170 200" stroke="#e3e6f1" stroke-width="2"/>
<path pathLength="1" d="M55 145 H145" stroke="#e3e6f1" stroke-width="2"/>
<path pathLength="1" d="M100 40 V215" stroke="#7c8cff" stroke-width="2.5"/>
<circle pathLength="1" cx="100" cy="40" r="9" stroke="#7c8cff" stroke-width="2.5"/>
</svg>`;

function page({ id, title, kicker, headCss = '', body, how, prompt, scripts = '', license }) {
  return `<!doctype html>
<!--
  127 Motion Pack: ${title}
  ${kicker}
  Open this file in a browser to see it. Everything it needs is inside this one file.
  Licenses for the code inside are at the bottom of this file.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · 127 Motion Pack</title>
<style>${SHELL_CSS}${headCss}</style>
</head>
<body>
<div class="wrap">
<div class="bar"><span>127 Motion Pack · ${esc(id)}</span><button type="button" onclick="location.reload()">Play again</button></div>
${body}
<section class="how">
<h2>How to use it</h2>
${how}
<h2>Prompt for an AI builder</h2>
<p>Paste this, with this whole file attached, into Claude, Lovable, Bolt, v0 or Webflow's AI.</p>
<pre class="prompt">${esc(prompt)}</pre>
<p class="lic">${license}</p>
</section>
</div>
${scripts}
</body>
</html>
`;
}

const MOTION_LICENSE = 'Motion runtime: Motion (motion.dev), MIT License, Copyright (c) 2024 Motion B.V. The choreography runtime and styles are 127\'s, yours to use on any site you make.';

// One choreographed page: the shared motion kit, the preset's CSS and runtime, and the Motion bundle inline.
function choreoPage({ id, title, kicker, choreo, css = '', body, how, prompt }) {
  const ch = resolveChoreo(choreo, {});
  const ca = choreoAssets(ch);
  const scripts = `<script>\n${ca.bundle}\n</script>\n<script>\n${MOTION_JS}\n</script>\n<script>\n${ca.script}\n</script>`;
  return page({ id, title, kicker, headCss: `${MOTION_CSS}\n${ca.css}\n${css}`, body, how, prompt, scripts, license: MOTION_LICENSE });
}

function hero(head, lead) {
  return `<main class="stage row">
<div style="display:grid;gap:28px">
<h1 data-ci="head" data-pop="line">${head}</h1>
<p class="lead" data-ci="then">${lead}</p>
<a class="btn" href="#how" data-ci="then">See how it's wired</a>
</div>
<div class="subject" data-ci="subject"><div data-alive="0.6">${SUBJECT_SVG}</div></div>
</main>`;
}

const INTRO_COPY = {
  assemble: ['Built piece by piece.', 'Letters fly in from scattered places and lock together on one firm spring.', 'trades, products, anything put together'],
  develop: ['Comes into focus.', 'The subject develops like a photograph while the words sharpen one by one.', 'people, portraits, coaches, photographers'],
  pour: ['Poured in, letter by letter.', 'Letters drop in left to right and settle as they land; the subject fills from the bottom up.', 'food, drink, anything you fill'],
  unfold: ['Opens like a page.', 'Words unfold up from their baseline; the subject opens from its center.', 'editorial, studios, salons'],
  type: ['Typed out, live.', 'The headline types itself with a caret in your color; the subject wipes on from the left.', 'software, writing, digital products'],
  mask: ['Rises from the rule.', 'Words rise out of their own baseline as if from behind a line; the subject is uncovered from the bottom up.', 'quiet confidence, editorial'],
  stamp: ['Pressed onto the page.', 'Each word is pressed on a beat apart, like type in a press; the subject prints in with a flash of ink.', 'posters, tickets, labels, events'],
  draw: ['Drawn in one line.', 'Words settle from wide to their own width while the subject\'s line drawing draws itself.', 'anything drawn in line, architects, makers'],
};

function introFile(name) {
  const [head, lead, fits] = INTRO_COPY[name];
  return {
    id: `intro-${name}`,
    title: `${name[0].toUpperCase()}${name.slice(1)} intro`,
    summary: `For ${fits}: ${CHOREO_PRESETS.intro[name].split(';')[0]}.`,
    html: choreoPage({
      id: `intro-${name}`,
      title: `${name[0].toUpperCase()}${name.slice(1)} intro`,
      kicker: CHOREO_PRESETS.intro[name],
      choreo: { intro: name, alive: ['drift', 'pointer'], scroll: 'none' },
      body: hero(head, lead),
      how: `<p>Good for ${esc(fits)}. Plays once in 1.2 to 2.4 seconds, then the page is fully usable. Phones get words instead of letters and no blur. Reduced motion and JavaScript off show the page complete and still.</p>
<ol>
<li>Copy the three <code>&lt;script&gt;</code> blocks at the end of this file to the end of your page's <code>&lt;body&gt;</code>, in the same order.</li>
<li>Copy the <code>&lt;style&gt;</code> block's motion rules (everything after the first block of page styles) into your CSS.</li>
<li>Mark your headline <code>data-ci="head"</code>, your hero image or product <code>data-ci="subject"</code>, and what follows (lead, buttons) <code>data-ci="then"</code>.</li>
<li>Optional: <code>data-pop="line"</code> on the headline draws one line in your color under the last word. Set your color with <code>--pop</code>.</li>
</ol>`,
      prompt: `Add the "${name}" intro from the attached file to my page's hero. Copy its three script blocks to the end of my <body> in the same order, and its motion CSS into my stylesheet. Mark my headline data-ci="head" data-pop="line", my hero image data-ci="subject", and my lead and buttons data-ci="then". Set --pop to my brand color. Don't change my copy or layout. Keep the "Pause motion" button it adds.`,
    }),
  };
}

function scrollFile(name) {
  const parts = ['Find the one thing', 'Make it once', 'Show it working', 'Ask for the yes'];
  const isPin = name === 'pin';
  const cards = parts.map((t, i) => `<li data-sc-part style="--sy:${3 + i}rem;--depth:${(0.6 + i * 0.35).toFixed(2)};--turn:${i % 2 ? -4 : 5}deg" class="sc-card"><b>0${i + 1}</b><span>${t}</span></li>`).join('\n');
  const body = `<main class="stage"><h1 data-ci="head">Scroll ${name}.</h1><p class="lead" data-ci="then">${esc(CHOREO_PRESETS.scroll[name][0].toUpperCase() + CHOREO_PRESETS.scroll[name].slice(1))}. Scroll down.</p></main>
<section data-sc class="sc"${isPin ? ' style="--n:4"' : ''}>
<div${isPin ? ' data-sc-stage' : ''} class="sc-stage">
<div data-sc-line class="sc-line" aria-hidden="true"></div>
<ol class="sc-list">
${cards}
</ol>
</div>
</section>
<div style="height:60vh"></div>`;
  const headCss = `.sc-stage{display:grid;align-content:center;gap:24px;padding:48px 0}
.sc-line{height:2px;background:var(--pop)}
.sc-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
@media (max-width:760px){.sc-list{grid-template-columns:1fr 1fr}}
.sc-card{min-height:220px;border:1px solid var(--line);border-radius:18px;background:var(--panel);padding:20px;display:grid;align-content:space-between;transition:border-color .4s,opacity .4s}
html.m [data-sc=""] .sc-card{opacity:.45}
html.m .sc-card.on{opacity:1}
.sc-card.cur{border-color:var(--pop)}
.sc-card b{font:13px/1 ui-monospace,Menlo,monospace;color:var(--faint)}
.sc-card span{font-size:22px;line-height:1.15;letter-spacing:-.01em;font-weight:600}`;
  return {
    id: `scroll-${name}`,
    title: `Scroll ${name}`,
    summary: `${CHOREO_PRESETS.scroll[name][0].toUpperCase()}${CHOREO_PRESETS.scroll[name].slice(1).split(' (')[0]}.`,
    html: choreoPage({
      id: `scroll-${name}`,
      title: `Scroll ${name}`,
      kicker: CHOREO_PRESETS.scroll[name],
      choreo: { intro: 'mask', alive: ['still'], scroll: name },
      css: headCss,
      body,
      how: `<p>Mark the section <code>data-sc</code> and each piece in it <code>data-sc-part</code>. The runtime sets <code>--p</code> (0 to 1) on the section and <code>--pi</code> plus class <code>on</code> on each piece${isPin ? ', and class <code>cur</code> on the current one. The box that sticks is <code>data-sc-stage</code>; set <code>--n</code> on the section to the number of pieces. Phones and tablets get it unpinned, each piece lighting as it passes' : ''}. A <code>data-sc-line</code> grows with the scroll.</p>
<ol><li>Copy the three script blocks at the end of this file to the end of your <code>&lt;body&gt;</code>, in order.</li><li>Copy the motion CSS from the <code>&lt;style&gt;</code> block, and the <code>.sc-</code> rules if you want this look.</li><li>Add the attributes above to your section.</li></ol>`,
      prompt: `Add the "scroll ${name}" moment from the attached file to my page's section that lists [my steps / services / features]. Copy its three script blocks to the end of my <body> in order and its motion CSS into my stylesheet. Mark the section data-sc${isPin ? ' with a data-sc-stage box inside and --n set to the number of pieces' : ''}, each item data-sc-part, and add a data-sc-line rule above them. Keep my markup and copy.`,
    }),
  };
}

function aliveFile() {
  const tiles = [['drift', 'Drifts and breathes'], ['pointer', 'Leans to your pointer'], ['tap', 'Springs when tapped'], ['scroll', 'Tilts with the scroll']];
  const body = `<main class="stage"><h1 data-ci="head">Alive at rest.</h1><p class="lead" data-ci="then">After the intro, things keep breathing on soft springs. Move your pointer, tap a card, scroll.</p>
<ul class="alive-grid">${tiles.map(([k, t]) => `<li class="alive-card" data-ci="then"><div data-alive="${k === 'tap' ? 1.4 : 1}"><b>${k}</b><span>${t}</span></div></li>`).join('')}</ul></main><div style="height:50vh"></div>`;
  const headCss = `.alive-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}@media (max-width:760px){.alive-grid{grid-template-columns:1fr 1fr}}
.alive-card>div{min-height:180px;border:1px solid var(--line);border-radius:18px;background:var(--panel);padding:20px;display:grid;align-content:space-between}
.alive-card b{font:13px/1 ui-monospace,Menlo,monospace;color:var(--pop)}.alive-card span{font-size:20px;font-weight:600;line-height:1.2}`;
  return {
    id: 'alive',
    title: 'Alive at rest',
    summary: 'Cards and images that drift, lean toward the pointer, spring when tapped and tilt with the scroll.',
    html: choreoPage({
      id: 'alive',
      title: 'Alive at rest',
      kicker: 'drift, pointer, tap and scroll, combined',
      choreo: { intro: 'unfold', alive: ['drift', 'pointer', 'tap', 'scroll'], scroll: 'none' },
      css: headCss,
      body,
      how: `<p>Put <code>data-alive="1"</code> on an element inside or around a <code>data-ci</code> one (the number is its strength, about 0.2 to 2). Pick the behaviors in the settings block at the very end of the last script: <code>"alive":["drift","pointer","tap","scroll"]</code>. The loop stops off screen, in a hidden tab and on the Pause motion button. Phones skip pointer.</p>`,
      prompt: `Using the attached file, make my hero image and my three feature cards move at rest: copy its three script blocks to the end of my <body> in order and its motion CSS into my stylesheet, wrap each card's content in a div with data-alive="1", and keep "drift", "pointer" and "tap" in the settings block. Don't change my layout.`,
    }),
  };
}

function kitFile() {
  const body = `<div class="prog"></div>
<main class="stage"><h1 data-split>Small moves, everywhere.</h1><p class="lead" data-rv style="--d:3">Reveal on scroll, kinetic type, parallax, a magnetic button, a spotlight card and a ticking number. No library: about 3 KB.</p><a class="btn" data-mag href="#kit" data-rv style="--d:4">I lean toward you</a></main>
<section id="kit" class="kit">
<div class="kit-card" data-rv><b>data-rv</b><span>Fades up when it scrolls into view.</span></div>
<div class="kit-card" data-rv="left" style="--d:1"><b>data-rv="left"</b><span>Slides in from the left.</span></div>
<div class="kit-card" data-rv="scale" style="--d:2"><b>data-rv="scale"</b><span>Grows in.</span></div>
<div class="kit-mask" data-rv="mask"><div class="kit-img"></div></div>
<div class="kit-card" data-spot><b>data-spot</b><span>A soft light follows your pointer.</span></div>
<div class="kit-card"><b>data-count</b><span class="kit-num" data-count>2,480</span></div>
<div class="kit-par"><div data-par="0.15" class="kit-dot"></div></div>
</section><div style="height:40vh"></div>`;
  const headCss = `.kit{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:40px 0}@media (max-width:760px){.kit{grid-template-columns:1fr}}
.kit-card{min-height:160px;border:1px solid var(--line);border-radius:18px;background:var(--panel);padding:20px;display:grid;align-content:space-between}
.kit-card b{font:13px/1 ui-monospace,Menlo,monospace;color:var(--faint)}.kit-card span{font-size:18px;font-weight:600}.kit-num{font-size:44px!important;letter-spacing:-.03em}
.kit-mask{border-radius:18px;overflow:hidden;min-height:160px}.kit-img{height:100%;min-height:160px;background:radial-gradient(120% 90% at 30% 20%,#2a2d38,#0b0b0e)}
.kit-par{position:relative;min-height:160px;border:1px solid var(--line);border-radius:18px;overflow:hidden}.kit-dot{position:absolute;left:50%;top:40%;width:56px;height:56px;margin-left:-28px;border-radius:50%;border:2px solid var(--pop)}`;
  return {
    id: 'kit-reveal',
    title: 'Reveal kit',
    summary: 'Reveal on scroll, words that rise, parallax, a magnetic button, a spotlight card, a ticking number and a reading bar. About 3 KB.',
    html: page({
      id: 'kit-reveal',
      title: 'Reveal kit',
      kicker: 'reveal on scroll, kinetic type, parallax, magnetic, spotlight, count, reading progress',
      headCss: `${MOTION_CSS}\n${headCss}`,
      body,
      how: `<ol><li>Copy the one script at the end of this file to the end of your <code>&lt;body&gt;</code>, and the motion rules from the <code>&lt;style&gt;</code> block into your CSS.</li>
<li>Add the attributes: <code>data-rv</code> (or <code>="mask"</code>, <code>="scale"</code>, <code>="left"</code>, <code>="right"</code>) to reveal, <code>style="--d:2"</code> to stagger, <code>data-split</code> for words that rise, <code>data-par="0.12"</code> for parallax, <code>data-mag</code> on a button, <code>data-spot</code> on a card, <code>data-count</code> on a number, and <code>&lt;div class="prog"&gt;</code> for a reading bar.</li>
<li>It adds a Pause motion button to your footer. Keep it: it's what makes looping motion accessible.</li></ol>`,
      prompt: `Using the attached file, add scroll reveals to my page: copy its script to the end of my <body> and its motion CSS into my stylesheet. Put data-split on my main headline, data-rv on each section's heading and cards with --d staggering them, data-mag on my main button and data-spot on my pricing cards. Don't change my copy or layout.`,
      scripts: `<script>\n${MOTION_JS}\n</script>`,
      license: '127\'s motion kit, yours to use on any site you make.',
    }),
  };
}

function portLicense(name) {
  return esc(read(PORTS, name, 'LICENSE')).replace(/\n/g, '<br>');
}

function fxFile({ id, name, title, kicker, css = '', body, run, how, prompt }) {
  const src = inline(read(PORTS, name, `${name}.js`));
  const portCss = fs.existsSync(path.join(PORTS, name, `${name}.css`)) ? read(PORTS, name, `${name}.css`) : '';
  return {
    id,
    title,
    summary: `${kicker[0].toUpperCase()}${kicker.slice(1)}.`,
    html: page({
      id, title, kicker,
      headCss: `${portCss}\n${css}`,
      body,
      how,
      prompt,
      scripts: `<script type="module">\n${src}\n${run}\n</script>`,
      license: `Code: ${portLicense(name)}`,
    }),
  };
}

function files() {
  const out = [];
  for (const name of ['assemble', 'develop', 'pour', 'unfold', 'type', 'mask', 'stamp', 'draw']) out.push(introFile(name));
  for (const name of ['scrub', 'pin', 'scene']) out.push(scrollFile(name));
  out.push(aliveFile());
  out.push(kitFile());
  out.push(fxFile({
    id: 'fx-liquid-chrome', name: 'liquid-chrome', title: 'Liquid chrome', kicker: 'a liquid-metal background that warps under the pointer (WebGL1, every phone)',
    css: `.fx-hero{position:relative;min-height:80vh;min-height:80svh;border-radius:24px;overflow:hidden;display:grid;align-content:end;padding:clamp(24px,5vw,56px);border:1px solid var(--line)}.fx-hero canvas{position:absolute;inset:0;width:100%;height:100%}.fx-hero h1{position:relative;margin:0;font-size:clamp(44px,8vw,104px);line-height:.95;letter-spacing:-.045em;color:#fff;text-shadow:0 2px 40px rgba(0,0,0,.6)}`,
    body: `<main class="fx-hero"><canvas aria-hidden="true"></canvas><h1>Liquid chrome.</h1></main>`,
    run: `liquidChrome(document.querySelector('.fx-hero canvas'), { spec: [0.49, 0.55, 1], amplitude: 0.6, speed: 1, scale: innerWidth < 760 ? 0.5 : 1, interactive: true });`,
    how: `<p>Call <code>liquidChrome(canvas, { base, mid, spec, amplitude, speed, scale, poster })</code>. Colors are 0 to 1 RGB: <code>spec</code> is the highlight, so your brand color goes there. Use <code>scale: 0.5</code> on phones. It pauses off screen and in hidden tabs, draws one still frame under reduced motion, and shows <code>poster</code> where WebGL is missing.</p>`,
    prompt: `Add the liquid chrome background from the attached file behind my hero: a <canvas> absolutely filling the hero, the module script at the end of <body>, and spec set to my brand color as 0-1 RGB. Use scale 0.5 under 760px. Keep my hero text above it and readable.`,
  }));
  out.push(fxFile({
    id: 'fx-particle-swarm', name: 'particle-swarm', title: 'Particle swarm', kicker: 'a swarm that forms your word, logo or image from a scatter, scrubbed by scroll',
    css: `.ps{position:sticky;top:0;height:100vh;height:100svh}.ps canvas{width:100%;height:100%;display:block}.ps-room{height:220vh}`,
    body: `<div class="ps-room"><div class="ps"><canvas aria-label="Particles forming the word Yours"></canvas></div></div>`,
    run: `const c = document.querySelector('.ps canvas');
particleSwarm(c, { source: { text: 'Yours', font: '700 1px system-ui' }, colors: ['#e3e6f1', '#7c8cff'], progress: 0 }).then((swarm) => {
  const room = document.querySelector('.ps-room');
  // Forms on arrival, then scatters as the visitor scrolls on (and forms again on the way back up).
  swarm.formIn(1800);
  const f = () => { const r = room.getBoundingClientRect(); swarm.progress(1 - Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)))); };
  setTimeout(() => addEventListener('scroll', f, { passive: true }), 1800);
});`,
    how: `<p>Call <code>await particleSwarm(canvas, { source, colors, progress })</code>. Here it forms on arrival and scatters as you scroll on. <code>source</code> is <code>{ text, font }</code>, <code>{ src: 'logo.svg' }</code> or an image. <code>swarm.progress(0..1)</code> scatters or forms it (tie it to scroll, as here), or <code>swarm.formIn(1200)</code> plays it once. The cursor pushes points away. It caps points per screen size (2,200 on a phone) and shows the formed shape, still, under reduced motion.</p>`,
    prompt: `Using the attached file, form my logo (logo.svg) out of particles as visitors scroll the first screen: a sticky full-screen canvas inside a 220vh section, the module script at the end of <body>, colors set to white and my brand color, and progress tied to how far the section has scrolled.`,
  }));
  out.push(fxFile({
    id: 'fx-activity-rings', name: 'activity-rings', title: 'Activity rings', kicker: 'progress rings that draw in turn, count up, and lap past 100%',
    css: `.rg{display:grid;grid-template-columns:auto 1fr;gap:clamp(24px,5vw,64px);align-items:center;min-height:70vh}@media (max-width:760px){.rg{grid-template-columns:1fr}}.rg h1{margin:0;font-size:clamp(40px,7vw,88px);line-height:.95;letter-spacing:-.04em}`,
    body: `<main class="rg"><div class="rings" data-rings></div><h1>Progress you can see.</h1></main>`,
    run: `activityRings(document.querySelector('[data-rings]'), [
  { label: 'Calls', current: 7, target: 10, unit: 'calls', color: '#7c8cff', colorEnd: '#a9b4ff' },
  { label: 'Posts', current: 5, target: 4, unit: 'posts', color: '#86d6ad', colorEnd: '#b4ebcd' },
  { label: 'Focus', current: 90, target: 120, unit: 'min', color: '#e3e6f1', colorEnd: '#ffffff' },
], { size: 220, stroke: 16, gap: 5 });`,
    how: `<p>Call <code>activityRings(el, rings, { size, stroke, gap })</code>, one ring per <code>{ label, current, target, unit, color, colorEnd }</code>. It draws when scrolled into view and returns <code>update(rings)</code> to move them on. Great for a client dashboard, a habit page or a fundraiser.</p>`,
    prompt: `Using the attached file, add activity rings to my page showing [three numbers with their targets]: the rings CSS in my stylesheet, a <div data-rings> where they go, and the module script at the end of <body> with my numbers.`,
  }));
  out.push(fxFile({
    id: 'fx-toast', name: 'toast', title: 'Stacked toasts', kicker: 'notifications that stack, fan out on hover and swipe away',
    css: `.ts{min-height:70vh;display:grid;align-content:center;gap:24px}.ts h1{margin:0;font-size:clamp(40px,7vw,88px);line-height:.95;letter-spacing:-.04em}.ts .row2{display:flex;flex-wrap:wrap;gap:12px}.ts button{height:46px;padding:0 18px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit;cursor:pointer}`,
    body: `<main class="ts"><h1>Tell them it worked.</h1><div class="row2"><button data-t="plain">Saved</button><button data-t="success">Booked</button><button data-t="loading">Sending…</button></div></main>`,
    run: `document.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
  const t = b.dataset.t;
  if (t === 'plain') toast('Saved', { description: 'Your changes are in.' });
  if (t === 'success') toast.success('Booked for Thursday, 10am', { description: 'A confirmation is on its way.' });
  if (t === 'loading') { const id = toast.loading('Sending your quote…'); setTimeout(() => toast.update(id, { type: 'success', title: 'Quote sent' }), 1400); }
}));`,
    how: `<p>Call <code>toast(title, { description, action, duration })</code>, or <code>toast.success</code>, <code>toast.error</code>, <code>toast.loading</code>, then <code>toast.update(id, {...})</code>. Up to three show; hover fans them out; swipe dismisses. It announces to screen readers.</p>`,
    prompt: `Using the attached file, show a toast when my contact form sends: the toast CSS in my stylesheet, the module script at the end of <body>, and on submit a toast.loading("Sending…") that becomes toast.success("Sent. We'll reply today.") when the request finishes.`,
  }));
  out.push(fxFile({
    id: 'fx-sheet', name: 'sheet', title: 'Bottom sheet', kicker: 'a drag-to-close sheet with snap points, on a native dialog',
    css: `.sh{min-height:70vh;display:grid;align-content:center;gap:24px}.sh h1{margin:0;font-size:clamp(40px,7vw,88px);line-height:.95;letter-spacing:-.04em}.sh button{height:48px;padding:0 22px;border-radius:999px;border:0;background:var(--primary);color:#0a0a0c;font:inherit;font-weight:600;width:max-content;cursor:pointer}.sht-body p{color:var(--dim)}`,
    body: `<main class="sh app"><h1>Details, one drag away.</h1><button type="button" id="open">Open the sheet</button></main>
<dialog class="sht" id="s"><div class="sht-handle"></div><div class="sht-body"><h2>Book a visit</h2><p>Drag me up to full height, or flick me down to close. Esc works too.</p></div></dialog>`,
    run: `const s = sheet(document.getElementById('s'), { snapPoints: [0.55, 1], scaleBackground: document.querySelector('.app') });
document.getElementById('open').addEventListener('click', () => s.open());`,
    how: `<p>Mark up <code>&lt;dialog class="sht"&gt;</code> with a <code>.sht-handle</code> and a <code>.sht-body</code>, then call <code>sheet(dialog, { snapPoints: [0.55, 1], scaleBackground: appEl })</code> and <code>open()</code>. Native dialog means focus stays inside and Esc closes it.</p>`,
    prompt: `Using the attached file, open my booking form in a bottom sheet on phones: wrap the form in <dialog class="sht"> with a .sht-handle and .sht-body, add the sheet CSS and the module script, and open it from my "Book" button with snap points 0.55 and 1.`,
  }));
  return out;
}

function readme(list) {
  return `# 127 Motion Pack

${list.length} moves, one file each. Open any file in a browser to see it, then follow "How to use it" at the bottom of the
page, or attach the file to Claude, Lovable, Bolt, v0 or Webflow's AI with the prompt it gives you.

${list.map((f) => `- ${f.id}.html: ${f.title}`).join('\n')}

Every move respects reduced motion (the page shows complete and still), works with JavaScript off, and adds a Pause
motion button wherever something loops.

Licenses: the motion runtime uses Motion (motion.dev, MIT). The five effects (fx-*) are ports of MIT components; each
file carries its license at the bottom. 127's own code here is yours to use on any site you make, for you or for
clients. Please don't resell or share the pack itself.
`;
}

function build({ check = false } = {}) {
  const list = files();
  const want = new Map(list.map((f) => [`${f.id}.html`, f.html]));
  want.set('README.md', readme(list));
  if (check) {
    const stale = [...want].filter(([name, data]) => !fs.existsSync(path.join(OUT, name)) || fs.readFileSync(path.join(OUT, name), 'utf8') !== data).map(([n]) => n);
    return { stale, list };
  }
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, data] of want) fs.writeFileSync(path.join(OUT, name), data);
  const manifest = list.map((f) => ({ id: f.id, title: f.title, summary: f.summary, file: `${f.id}.html`, bytes: Buffer.byteLength(f.html), sha256: crypto.createHash('sha256').update(f.html).digest('hex') }));
  fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  return { stale: [], list };
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const r = build({ check });
  if (check && r.stale.length) {
    console.error(`Motion Pack is out of date: ${r.stale.join(', ')}. Run node scripts/build-motion-pack.js`);
    process.exit(1);
  }
  console.log(check ? 'Motion Pack is current.' : `Wrote ${r.list.length} moves to ${path.relative(process.cwd(), OUT)}`);
}

module.exports = { build, files };
