// CSS every design shares: a small modern reset, the type scale, buttons, form fields, the CSS-only
// menu, FAQ accordions, focus rings and reduced motion. Each template adds its own look on top.
// No frameworks and no scripts: the page works with JavaScript off.

function baseCss(fonts, { radius = '18px', radiusSm = '12px', btnRadius = '999px', max = '72rem' } = {}) {
  return `
:root{--font-display:${fonts.display};--font-body:${fonts.body};--radius:${radius};--radius-sm:${radiusSm};--radius-btn:${btnRadius};--max:${max};--section:clamp(4.5rem,3rem + 5vw,8rem)}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:1rem}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font-body);font-size:1.0625rem;line-height:1.6;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
img,video{display:block;max-width:100%;height:auto}
svg.i{display:inline-block;flex:none;vertical-align:-.18em}
h1,h2,h3,h4{margin:0;font-family:var(--font-display);font-weight:700;line-height:1.06;letter-spacing:-.02em;text-wrap:balance}
p,dl,dd,dt,figure,blockquote{margin:0}
p{text-wrap:pretty}
ul,ol{margin:0;padding:0;list-style:none}
a{color:inherit;text-underline-offset:.2em;text-decoration-thickness:1px}
.wrap{width:min(100% - 2rem,var(--max));margin-inline:auto}
@media (min-width:48rem){.wrap{width:min(100% - 4rem,var(--max))}}
.sec{padding-block:var(--section)}
.eyebrow{display:inline-block;font-family:var(--font-body);font-size:.8125rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--primary-text)}
.h2{font-size:clamp(2rem,1.45rem + 2.4vw,3.4rem)}
.lead{font-size:clamp(1.125rem,1.02rem + .45vw,1.3rem);line-height:1.55;color:var(--muted)}
.muted{color:var(--muted)}
.skip{position:absolute;left:1rem;top:-5rem;z-index:100;padding:.75rem 1.1rem;border-radius:.6rem;background:var(--ink);color:var(--bg);font-weight:600;text-decoration:none}
.skip:focus{top:1rem}
:focus-visible{outline:3px solid var(--focus);outline-offset:3px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.55rem;min-height:3.1rem;padding:.85rem 1.5rem;border:2px solid transparent;border-radius:var(--radius-btn);font-family:var(--font-body);font-size:1rem;font-weight:600;line-height:1.1;text-decoration:none;cursor:pointer;transition:background-color .2s ease,color .2s ease,border-color .2s ease,transform .2s ease,box-shadow .2s ease}
.btn:hover{transform:translateY(-1px)}
.btn-primary{background:var(--button);color:var(--on-button)}
.btn-primary:hover{background:var(--button-hover)}
.btn-ghost{background:transparent;color:inherit;border-color:currentColor}
.btn-ghost:hover{background:var(--primary-soft);color:var(--ink);border-color:var(--primary-soft)}
.btn-lg{min-height:3.6rem;padding-inline:1.9rem;font-size:1.0625rem}
.btn-block{width:100%}
.form{display:grid;gap:1rem}
.form .row{display:grid;gap:1rem}
@media (min-width:40rem){.form .row{grid-template-columns:1fr 1fr}}
.field{display:grid;gap:.4rem}
.field label{font-size:.9375rem;font-weight:600;color:var(--ink)}
.field .opt{font-weight:400;color:var(--muted)}
.field input,.field select,.field textarea{width:100%;min-height:3.1rem;padding:.8rem .95rem;font:inherit;font-size:1rem;color:var(--ink);background:var(--bg);border:1.5px solid var(--line);border-radius:var(--radius-sm);transition:border-color .15s ease,box-shadow .15s ease;-webkit-appearance:none;appearance:none}
.field select{background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(100% - 1.3rem) 55%,calc(100% - .95rem) 55%;background-size:.35rem .35rem;background-repeat:no-repeat;padding-right:2.5rem}
.field textarea{min-height:8.5rem;resize:vertical}
.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--primary-text);box-shadow:0 0 0 4px var(--primary-soft)}
.form-note{font-size:.9375rem;color:var(--muted)}
.form-note a{color:var(--ink);font-weight:600}
.hp{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
details>summary{cursor:pointer;list-style:none}
details>summary::-webkit-details-marker{display:none}
.faq{display:grid;gap:.75rem}
.faq details{border:1.5px solid var(--line);border-radius:var(--radius-sm);background:var(--bg);transition:border-color .2s ease}
.faq details[open]{border-color:var(--primary-tint)}
.faq summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem 1.25rem;font-weight:600;font-size:1.0625rem}
.faq summary .i{transition:transform .2s ease;color:var(--primary-text)}
.faq details[open] summary .i{transform:rotate(45deg)}
.faq .ans{padding:0 1.25rem 1.2rem;color:var(--muted);max-width:44rem}
.hours{display:grid;gap:.15rem}
.hours div{display:flex;justify-content:space-between;gap:1.5rem;padding:.55rem 0;border-bottom:1px solid var(--line)}
.hours div:last-child{border-bottom:0}
.hours dt{font-weight:600}
.hours dd{color:var(--muted);text-align:right}
.socials{display:flex;flex-wrap:wrap;gap:.5rem}
.socials a{display:inline-grid;place-items:center;width:2.75rem;height:2.75rem;border-radius:999px;border:1.5px solid currentColor;opacity:.9;transition:opacity .2s ease,background-color .2s ease}
.socials a:hover{opacity:1}
.contact-list{display:grid;gap:.9rem}
.contact-list li{display:flex;gap:.8rem;align-items:flex-start}
.contact-list .i{margin-top:.2rem;color:var(--primary-text)}
.contact-list a{font-weight:600;text-decoration:none}
.contact-list a:hover{text-decoration:underline}
.hdr{position:relative}
.mode-tg{display:inline-grid;place-items:center;width:2.75rem;height:2.75rem;flex:none;border-radius:999px;border:1px solid var(--line);background:none;color:inherit;cursor:pointer}
.mode-tg[hidden]{display:none}
.mode-tg:hover{border-color:currentColor}
.mode-tg .i-moon,html[data-theme="light"] .mode-tg .i-sun{display:none}
html[data-theme="light"] .mode-tg .i-moon{display:block}
.menu{position:static}
.menu>summary{display:inline-grid;place-items:center;width:3rem;height:3rem;border-radius:999px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink)}
.menu>summary .i-close,.menu[open]>summary .i-open{display:none}
.menu[open]>summary::before{content:"";position:fixed;inset:0;z-index:39;background:rgba(0,0,0,.32);cursor:default}
.menu[open]>summary .i-close{display:block}
.menu-panel{position:absolute;left:0;right:0;top:100%;z-index:40;padding:.5rem clamp(1rem,5vw,2rem) 1.5rem;background:var(--bg);color:var(--ink);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.menu-panel ul{display:grid}
.menu-panel li a{display:block;padding:.85rem 0;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:1.5rem;line-height:1.1;letter-spacing:-.01em;text-decoration:none}
.menu-panel li a:hover{color:var(--primary-text)}
.menu-panel .btn{margin-top:1.25rem;width:100%}
.mbar{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;gap:.6rem;padding:.65rem .8rem calc(.65rem + env(safe-area-inset-bottom));background:var(--bg);border-top:1px solid var(--line);box-shadow:0 -10px 30px -18px rgba(0,0,0,.35)}
.mbar .btn{flex:1;min-height:3rem;padding-inline:.8rem}
body.has-bar{padding-bottom:5.2rem}
.mbar{transition:transform .3s cubic-bezier(.16,1,.3,1)}body.bar-off .mbar{transform:translateY(110%)}
.hdr-actions{display:flex;align-items:center;gap:.5rem}
@media (min-width:60rem){.mbar{display:none}body.has-bar{padding-bottom:0}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}.btn:hover{transform:none}}
`.trim();
}

module.exports = { baseCss };
