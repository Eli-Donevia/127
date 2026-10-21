// Lenis (MIT, darkroom.engineering, see LICENSE): smooth wheel scroll for designs that ask for it, as an inline
// script. The vendored module's header comment stays at the top of what ships. Starts after load, never under reduced
// motion (no html.m), stops while Pause motion is on (html.mp) and starts again when it is turned off.
const fs = require('fs');
const path = require('path');
let cache = null;
function lenisScript({ lerp = 0.1 } = {}) {
  if (!cache) cache = fs.readFileSync(path.join(__dirname, 'lenis.min.mjs'), 'utf8').trim().replace(/export\s*\{\s*(\w+)\s+as\s+default\s*\}\s*;?\s*$/, 'window.__Lenis=$1;');
  return `;(function(){var h=document.documentElement;if(!h.classList.contains('m')||matchMedia('(pointer: coarse)').matches)return;
${cache}
var L=window.__Lenis,l=null,raf=0;function loop(t){if(l){l.raf(t);raf=requestAnimationFrame(loop)}}
function on(){if(l||h.classList.contains('mp'))return;l=new L({lerp:${lerp},anchors:true,autoRaf:false});h.classList.add('lenis');raf=requestAnimationFrame(loop)}
function off(){if(!l)return;cancelAnimationFrame(raf);l.destroy();l=null}
window.addEventListener('load',function(){setTimeout(on,300)});
new MutationObserver(function(){h.classList.contains('mp')?off():on()}).observe(h,{attributes:true,attributeFilter:['class']});})();`;
}
const LENIS_CSS = 'html.lenis,html.lenis body{height:auto}.lenis.lenis-stopped{overflow:clip}.lenis.lenis-smooth iframe{pointer-events:none}';
module.exports = { lenisScript, LENIS_CSS };
