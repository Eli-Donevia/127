// First Light, live: the glass 127 lit in the browser. Every light in the scene was path-traced on its own
// (v2/design/motion), and this adds them up in linear light each frame, so the light can move: it plays the reveal,
// breathes, follows the pointer (or a finger) with a soft light, sweeps through the glass on a click, and sinks back
// into the floor line as the page scrolls on. The poster is the same picture at rest, so the hand-over is invisible.
//   firstLight(stage, { base: '/img/fl/', small: bool, reveal: bool }) -> Promise (resolves once it's drawing)
const OS = 1.08;                 // the passes have 8% extra border, so the camera push is a crop of real pixels
const HY = 0.2618;               // the floor line's height in the passes, from the bottom
const PASSES = ['halo', 'rig', 'line', 'shine', 't0', 't1', 't2', 't3', 't4', 't5', 't6'];
const BG = [6 / 255, 6 / 255, 7 / 255];   // --bg

const VS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D T[11];
uniform vec2 uRes; uniform float uDpr; uniform vec4 uFrame;
uniform float uHalo, uUp, uRig, uLine, uReach, uZoom, uTime, uGrain;
uniform vec2 uDrift, uSweep, uCur; uniform float uTorch[7];
uniform vec3 uBg;
out vec4 o;
vec3 dec(vec3 e) { return (exp2(e * 8.0056) - 1.0) / 32.0; }
vec3 at(int i, vec2 t) {
  vec3 e;
  // GLSL ES wants constant indices into a sampler array
  if (i == 0) e = texture(T[0], t).rgb; else if (i == 1) e = texture(T[1], t).rgb; else if (i == 2) e = texture(T[2], t).rgb;
  else if (i == 3) e = texture(T[3], t).rgb; else if (i == 4) e = texture(T[4], t).rgb; else if (i == 5) e = texture(T[5], t).rgb;
  else if (i == 6) e = texture(T[6], t).rgb; else if (i == 7) e = texture(T[7], t).rgb; else if (i == 8) e = texture(T[8], t).rgb;
  else if (i == 9) e = texture(T[9], t).rgb; else e = texture(T[10], t).rgb;
  return dec(e);
}
// AgX with the Punchy look, as the clips were graded in Blender
vec3 agxC(vec3 x) { vec3 x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
vec3 agx(vec3 v) {
  const mat3 m = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772,
    0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 mi = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417,
    -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  v = clamp(log2(m * max(v, 1e-10)), -12.47393, 4.026069);
  v = agxC((v + 12.47393) / 16.49999);
  float l = dot(v, vec3(0.2126, 0.7152, 0.0722));
  v = pow(max(v, 0.0), vec3(1.35));
  v = l + 1.4 * (v - l);
  return clamp(mi * v, 0.0, 1.0);
}
float sm(float a, float b, float x) { float k = clamp((x - a) / (b - a), 0.0, 1.0); return k * k * (3.0 - 2.0 * k); }
float hash(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 q = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 u = (q - uFrame.xy) / uFrame.zw;                       // the frame, 0..1, y down
  vec2 t = 0.5 + (u - 0.5) / uZoom + uDrift;                  // the passes
  float edge = sm(0.0, 0.13, u.x) * sm(0.0, 0.13, 1.0 - u.x) * sm(0.0, 0.1, u.y) * sm(0.0, 0.24, 1.0 - u.y);
  vec3 col = uBg;
  if (edge > 0.0 && t.x > 0.0 && t.x < 1.0 && t.y > 0.0 && t.y < 1.0) {
    float y = 1.0 - t.y;
    // the reveal's masks: the halo comes up out of the floor line (its reflection goes down), the line draws out
    float d = y >= HY ? y - HY : (HY - y) * 1.7;
    float halo = uHalo * sm(uUp + 0.3, uUp - 0.3, d);
    float line = uLine * sm(uReach + 0.06, uReach - 0.06, abs(t.x - 0.5));
    line *= 1.0 + uCur.y * 1.6 * exp(-pow((t.x - uCur.x) / 0.06, 2.0));
    vec3 img = halo * at(0, t) + uRig * at(1, t) + line * at(2, t);
    float band = exp(-pow(((t.x - uSweep.x) + 0.35 * (y - HY) * 0.5625) / 0.05, 2.0));
    img += 3.2 * uSweep.y * band * at(3, t);
    for (int i = 0; i < 7; i++) if (uTorch[i] > 0.001) img += uTorch[i] * at(4 + i, t);
    vec3 c = agx(img);
    float g = (hash(q * uDpr + fract(uTime) * 91.7) - 0.5) * uGrain;
    col = mix(uBg, c + g, edge);
  }
  // a hair of dither everywhere, so the dark glow doesn't band on 8-bit screens
  col += (hash(gl_FragCoord.xy + 0.37) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`.replaceAll('HY', String(HY));

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (v, p = 3) => 1 - Math.pow(1 - clamp(v), p);
const inOut = (v) => { v = clamp(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const ramp = (t, a, b, f = easeOut) => f((t - a) / (b - a));
// The reveal's beats in seconds (the same as the clips): line start, bright, full width; line settles; halo rises; key lights
const B = { line: [0.3, 0.8, 1.2], settle: [1.6, 3.4], up: [0.9, 3.9], halo: [0.9, 3.4], rig: [2.0, 3.9], end: 5.0 };

function load(src) {
  return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

export async function firstLight(stage, opts = {}) {
  const poster = stage.querySelector('img');
  const cv = document.createElement('canvas');
  cv.className = 'fl-canvas'; cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
  if (!gl) throw new Error('no webgl2');
  const base = opts.base || '/img/fl/', suf = opts.small ? '-s' : '';
  const imgs = await Promise.all(PASSES.map((n) => load(base + n + suf + '.jpg')));

  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  imgs.forEach((im, i) => {
    gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, im);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  });
  const U = {}; ['T', 'uRes', 'uDpr', 'uFrame', 'uHalo', 'uUp', 'uRig', 'uLine', 'uReach', 'uZoom', 'uTime', 'uGrain', 'uDrift', 'uSweep', 'uCur', 'uTorch', 'uBg']
    .forEach((n) => { U[n] = gl.getUniformLocation(pr, n === 'T' ? 'T[0]' : n === 'uTorch' ? 'uTorch[0]' : n); });
  gl.uniform1iv(U.T, PASSES.map((_, i) => i));
  gl.uniform3fv(U.uBg, BG);

  // ---- state ----
  const S = { start: null, reveal: opts.reveal !== false, ptr: null, lastMove: -1e9, p: 3, pk: 0, cx: 0.5, sweep: -1, scroll: 0, mx: 0, my: 0 };
  let dpr = 1, W = 0, H = 0, frame = [0, 0, 1, 1];
  const size = () => {
    const r = stage.getBoundingClientRect(), f = poster.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, opts.small ? 2 : 1.5);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    frame = [f.left - r.left, f.top - r.top, f.width, f.height];
    gl.viewport(0, 0, cv.width, cv.height);
  };
  // the pointer: across the mark moves the light from left to right; near the floor it lights the line under it
  const toTex = (x, y) => [(x - frame[0]) / frame[2], (y - frame[1]) / frame[3]];
  const onMove = (e) => {
    const r = stage.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) { S.ptr = null; return; }
    S.ptr = toTex(e.clientX - r.left, e.clientY - r.top); S.lastMove = performance.now();
  };
  const onClick = (e) => { if (!e.target.closest('a,button,input,label,select,textarea')) S.sweep = performance.now(); };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onMove, { passive: true });
  stage.parentElement.addEventListener('click', onClick);

  const draw = (now) => {
    if (S.start === null) S.start = now;
    const t = (now - S.start) / 1000, dt = Math.min(0.05, (now - (S.prev || now)) / 1000); S.prev = now;
    const rv = S.reveal ? t : B.end + t;            // seconds into the reveal (past B.end = at rest)
    let halo = 1, up = 1.15, rig = 1, line = 0.35, reach = 1, zoom = OS, dx = 0, dy = 0;
    if (rv < B.end) {
      const [l0, l1, l2] = B.line;
      reach = ramp(rv, l0, l2) * 0.62;
      line = 1.2 * ramp(rv, l0, l1) - 0.85 * ramp(rv, ...B.settle);
      up = ramp(rv, ...B.up, inOut) * 1.15; halo = ramp(rv, ...B.halo); rig = ramp(rv, ...B.rig);
      zoom = 1 + (OS - 1) * ramp(rv, 0, B.end, (v) => easeOut(v, 2)); dx = 0.012 * (1 - ramp(rv, 0, B.end));
    } else {
      // at rest it breathes, as the loop does
      const ph = 2 * Math.PI * (rv - B.end) / 6;
      halo = 1 + 0.09 * Math.sin(ph); line = 0.35 + 0.08 * Math.sin(ph);
      zoom = OS - 0.012 * (1 - Math.cos(ph)) / 2; dx = 0.004 * Math.sin(ph);
    }
    // the moving light: the pointer leads it; with no pointer it drifts on its own, dimmer
    const live = rv > 3.6, idle = now - S.lastMove > 2600 || !S.ptr;
    const tp = idle ? 3 + 2.6 * Math.sin((rv - 3.6) * 2 * Math.PI / 16) : clamp((S.ptr[0] - 0.22) / 0.56) * 6;
    const tk = !live ? 0 : (idle ? 0.55 : 1);
    const a = 1 - Math.exp(-dt * (idle ? 1.5 : 5));
    S.p += (tp - S.p) * a; S.pk += (tk - S.pk) * (1 - Math.exp(-dt * 2.5));
    const cxT = S.ptr && !idle ? 0.5 + (S.ptr[0] - 0.5) / OS : 0.5 + (S.p / 6 - 0.5) * 0.5;
    S.cx += (cxT - S.cx) * a;
    const tw = []; for (let i = 0; i < 7; i++) { const w = Math.max(0, 1 - Math.abs(S.p - i)); tw.push(w * w * (3 - 2 * w) * S.pk * (opts.torch || 0.85)); }
    // a little parallax with the pointer
    const mxT = S.ptr && !idle ? clamp(S.ptr[0], -0.2, 1.2) - 0.5 : 0, myT = S.ptr && !idle ? clamp(S.ptr[1], -0.2, 1.2) - 0.5 : 0;
    S.mx += (mxT - S.mx) * a; S.my += (myT - S.my) * a;
    dx += S.mx * 0.006; dy += S.my * 0.004;
    // the click: a band of light through the glass
    let sw = [0, 0];
    if (S.sweep > 0) {
      const st = (now - S.sweep) / 1000 / 1.6;
      if (st >= 1) S.sweep = -1;
      else { const v = inOut(st); sw = [-0.12 + 1.24 * v, Math.pow(Math.sin(Math.PI * st), 0.6)]; halo *= 1 - 0.15 * sw[1]; }
    }
    // scrolling on: the halo sinks back into the line and the camera leans in
    const s = S.scroll;
    up = Math.min(up, 1.15 - 1.25 * s); halo *= 1 - 0.35 * s; rig *= 1 - 0.5 * s; zoom *= 1 + 0.07 * s;
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uDpr, dpr); gl.uniform4fv(U.uFrame, frame);
    gl.uniform1f(U.uHalo, halo); gl.uniform1f(U.uUp, up); gl.uniform1f(U.uRig, rig); gl.uniform1f(U.uLine, line);
    gl.uniform1f(U.uReach, reach); gl.uniform1f(U.uZoom, zoom); gl.uniform2f(U.uDrift, dx, -dy);
    gl.uniform1f(U.uTime, t); gl.uniform1f(U.uGrain, opts.grain ?? 0.035);
    gl.uniform2f(U.uSweep, sw[0], sw[1]); gl.uniform2f(U.uCur, S.cx, S.pk * 0.8); gl.uniform1fv(U.uTorch, tw);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // ---- run only while it's on screen ----
  let raf = 0, onScreen = true;
  const tick = (now) => { raf = 0; const r = stage.getBoundingClientRect(); S.scroll = clamp(-r.top / Math.max(1, r.height)); draw(now); go(); };
  const go = () => { if (!raf && onScreen && !document.hidden && !opts.capture) raf = requestAnimationFrame(tick); };
  new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; go(); }).observe(stage);
  document.addEventListener('visibilitychange', go);
  new ResizeObserver(() => { size(); }).observe(stage);
  size();
  stage.appendChild(cv);
  if (opts.capture) return { cv, draw, S };
  go();
  return { cv, reveal: S.reveal };
}
