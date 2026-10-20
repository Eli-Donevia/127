// First Light, live: the glass 127 lit in the browser. Every light in the scene was path-traced on its own
// (v2/design/motion), and this adds them up in linear light each frame, so the light can move: it plays the reveal,
// breathes, follows the pointer (or a finger) with a soft light, sweeps through the glass on a click, and sinks back
// into the floor line as the page scrolls on. The poster is the same picture at rest, so the hand-over is invisible.
//   firstLight(stage, { base: '/img/fl/', small: bool, reveal: bool, water: bool }) -> Promise (resolves once it's drawing)
//
// With water (passes in /img/flw/, rendered with the mark lifted off a still-water floor), the 127 floats and both it
// and the floor are liquid. Two height fields run on the GPU as a wave equation (half-float textures, ping-ponged at
// 60 steps a second): one for the glass, in screen space, and one for the water, laid on the floor itself in scene
// units, so its rings shrink and flatten into the distance the way real ripples do. The pointer drags a wake through
// whichever it's over, a click drops a stone, and now and then a drop falls from the bottom of a digit. Ripples bend
// what the floor reflects (its crests catch the halo), bend the light through the glass (each colour a little
// differently) and throw moving caustics up onto the underside of the glass. Without float render targets the mark
// still floats; it just doesn't ripple.
const OS = 1.08;                 // the passes have 8% extra border, so the camera push is a crop of real pixels
const HY = 0.2618;               // the floor line's height in the passes, from the bottom
const PASSES = ['halo', 'rig', 'line', 'shine', 't0', 't1', 't2', 't3', 't4', 't5', 't6'];
const BG = [6 / 255, 6 / 255, 7 / 255];   // --bg
// The camera the passes were rendered with (motion_v2.py, 16x9): a 50 mm lens on 36 mm (less the border), 5.6 back
// and 0.5 up, aimed at the standing mark's middle, 0.736 up. The water needs it to find the floor under each pixel.
const TH = 18 / (50 / OS), TV = TH * 0.5625, CY = -5.6, CZ = 0.5, PITCH = Math.atan2(0.736 - 0.5, 5.6);
const WB = [-3.4, -3.8, 6.8, 6.3];       // the water's patch of floor: x, y (y runs away from the camera), width, depth
const LIFT = 0.26;                       // how far the glass floats
const YAW = -22 * Math.PI / 180;         // the mark is turned this much
const FEET = [[-0.963, -0.707], [-0.551, 0.353], [0.583, 0.842]];   // the bottoms of the 1, the 2 and the 7, along the mark
const F = 1 - HY;
// The water's look: how far ripples bend the reflection, how bright crests flash, how far they bend the glass, caustics
const LOOK = [0.5, 3.0, 2.5, 5.0];
const WET = 3.0;                         // how much brighter the water's reflection is than the passes' floor

const VS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// One step of the wave equation: h' = 2h - h_prev + c2 * laplacian(h), damped, with a sponge at the edges so waves
// leave instead of bouncing back. Input: a wake along the pointer's path and up to four drops.
const STEP = `#version 300 es
precision highp float;
uniform sampler2D uS; uniform vec2 uPx, uAsp; uniform float uC2, uDamp;
uniform vec4 uSeg; uniform vec2 uSegRS; uniform vec4 uDrop[4];
out vec4 o;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0)); }
void main() {
  vec2 uv = gl_FragCoord.xy * uPx;
  vec2 c = texture(uS, uv).rg;
  float n = texture(uS, uv - vec2(uPx.x, 0.0)).r + texture(uS, uv + vec2(uPx.x, 0.0)).r
          + texture(uS, uv - vec2(0.0, uPx.y)).r + texture(uS, uv + vec2(0.0, uPx.y)).r;
  float h = 2.0 * c.r - c.g + uC2 * (n - 4.0 * c.r);
  vec2 e = min(uv, 1.0 - uv) * uAsp;
  h *= uDamp * mix(0.92, 1.0, smoothstep(0.0, 0.05 * max(uAsp.x, uAsp.y), min(e.x, e.y)));
  vec2 p = uv * uAsp;
  float w = seg(p, uSeg.xy * uAsp, uSeg.zw * uAsp);
  h += uSegRS.y * exp(-w * w / (uSegRS.x * uSegRS.x));
  for (int i = 0; i < 4; i++) { vec2 d = p - uDrop[i].xy * uAsp; h += uDrop[i].w * exp(-dot(d, d) / (uDrop[i].z * uDrop[i].z)); }
  o = vec4(clamp(h, -4.0, 4.0), c.r, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
#define WATER 0
uniform sampler2D T[11];
uniform sampler2D uW, uM;
uniform vec2 uRes; uniform float uDpr; uniform vec4 uFrame;
uniform float uHalo, uUp, uRig, uLine, uReach, uZoom, uTime, uGrain;
uniform vec2 uDrift, uSweep, uCur; uniform float uTorch[7];
uniform vec3 uBg;
uniform float uBob, uTilt, uWet;
uniform vec4 uK;      // LOOK
uniform vec4 uDrip;   // a falling drop: where (passes), brightness, stretch
out vec4 o;
const float F = 1.0 - HY;
const vec3 HALO = vec3(0.89, 0.90, 0.95);
const vec4 WB = vec4(WBOX);
const vec2 CAM = vec2(sin(PITCH), cos(PITCH));
const float HS = 0.01;   // the fields' heights are in hundredths of a scene unit
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
// the reveal's halo mask: it comes up out of the floor line (its reflection goes down)
float haloAt(vec2 t) { float y = 1.0 - t.y; float d = y >= HY ? y - HY : (HY - y) * 1.7; return uHalo * sm(uUp + 0.3, uUp - 0.3, d); }
// every light at a point of the passes
vec3 light(vec2 t) {
  float y = 1.0 - t.y;
  float line = uLine * sm(uReach + 0.06, uReach - 0.06, abs(t.x - 0.5));
  line *= 1.0 + uCur.y * 1.6 * exp(-pow((t.x - uCur.x) / 0.06, 2.0));
  vec3 img = haloAt(t) * at(0, t) + uRig * at(1, t) + line * at(2, t);
  float band = exp(-pow(((t.x - uSweep.x) + 0.35 * (y - HY) * 0.5625) / 0.05, 2.0));
  img += 3.2 * uSweep.y * band * at(3, t);
  for (int i = 0; i < 7; i++) if (uTorch[i] > 0.001) img += uTorch[i] * at(4 + i, t);
  return img;
}
vec3 back(vec2 t) { return haloAt(t) * at(0, t) + uRig * at(1, t); }
// the camera ray through a point of the passes, in the scene (x right, y away, z up)
vec3 ray(vec2 t) { float x = (2.0 * t.x - 1.0) * TH, y = -(2.0 * t.y - 1.0) * TV; return vec3(x, CAM.y - CAM.x * y, CAM.y * y + CAM.x); }
// the water at a point of the floor: height, slope (scene units) and curvature (for caustics)
vec4 wave(vec2 P, float k) {
  vec2 w = (P - WB.xy) / WB.zw, e = k / vec2(textureSize(uW, 0));
  float c = texture(uW, w).r, l = texture(uW, w - vec2(e.x, 0.0)).r, r = texture(uW, w + vec2(e.x, 0.0)).r;
  float b = texture(uW, w - vec2(0.0, e.y)).r, f = texture(uW, w + vec2(0.0, e.y)).r;
  return vec4(c, HS * (r - l) / (2.0 * e.x * WB.z), HS * (f - b) / (2.0 * e.y * WB.w), l + r + b + f - 4.0 * c);
}
// a long, low swell under it all, so the water is never dead still: the slopes of three crossing waves
vec2 swell(vec2 P) {
  vec2 g = vec2(0.0), d;
  d = vec2(0.42, 0.91); g += d * cos(dot(P, d) * 5.1 - uTime * 1.7);
  d = vec2(-0.74, 0.67); g += d * 0.8 * cos(dot(P, d) * 7.3 - uTime * 2.1 + 1.3);
  d = vec2(0.98, -0.2); g += d * 0.5 * cos(dot(P, d) * 11.0 - uTime * 2.7 + 4.0);
  return g * 0.0022;
}
void main() {
  vec2 q = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 u = (q - uFrame.xy) / uFrame.zw;                       // the frame, 0..1, y down
  vec2 t = 0.5 + (u - 0.5) / uZoom + uDrift;                  // the passes
  float edge = sm(0.0, 0.13, u.x) * sm(0.0, 0.13, 1.0 - u.x) * sm(0.0, 0.1, u.y) * sm(0.0, 0.24, 1.0 - u.y);
  vec3 col = uBg;
  if (edge > 0.0 && t.x > 0.0 && t.x < 1.0 && t.y > 0.0 && t.y < 1.0) {
    // the float: above the floor line the picture rides up and down (and rocks a little); its reflection goes the
    // other way. Each eases to still at the line, where there's only dark floor and the halo's glow to stretch.
    float bob = uBob + uTilt * (t.x - 0.5);
    vec3 img;
    if (t.y < F) {
      vec2 tt = vec2(t.x, t.y + bob * sm(F, F - 0.035, t.y));
#if WATER
      // the glass is liquid: its ripples bend everything seen through it, the edges included
      vec2 m = vec2(tt.x, tt.y / F), e = 1.0 / vec2(textureSize(uM, 0));
      vec2 gm = vec2(texture(uM, m + vec2(e.x, 0.0)).r - texture(uM, m - vec2(e.x, 0.0)).r,
                     texture(uM, m + vec2(0.0, e.y)).r - texture(uM, m - vec2(0.0, e.y)).r);
      float glass = clamp(dot(at(3, tt), vec3(0.3, 0.5, 0.2)) * 0.9, 0.0, 1.0);
      vec2 off = gm * HS * uK.z * (0.3 + 0.7 * glass);
      vec2 ts = tt + off;
      img = light(ts);
      if (dot(off, off) > 1e-10) {
        // dispersion: red bends less than blue
        vec2 dr = off * 0.25;
        vec3 g0 = back(ts), r0 = back(ts - dr), b0 = back(ts + dr);
        img += vec3(r0.r - g0.r, 0.0, b0.b - g0.b) * (0.4 + 0.6 * glass);
        // and the ripples' faces that tip toward the key light (up and to the left) catch it
        float k = max(0.0, dot(gm, vec2(-0.6, -0.8))) * 2.5;
        img += HALO * k * k * glass * (0.6 * uRig + 0.4 * uHalo);
      }
      // caustics: light bounced off the rippled water dances on the underside of the glass, strongest near the bottom
      vec3 d = ray(tt); float s = -CY / max(d.y, 1e-3); float z = CZ + s * d.z;
      vec4 wv = wave(vec2(s * d.x, 0.0), 2.0);
      img += HALO * max(0.0, -wv.w) * HS * uK.w * 10.0 * glass * exp(-max(z - LIFT, 0.0) / 0.28) * (0.3 + 0.7 * uHalo);
#else
      img = light(tt);
#endif
    } else {
      vec2 tt = vec2(t.x, t.y - bob * sm(F + 0.01, F + 0.07, t.y));
#if WATER
      // the water: the floor in the passes is a mirror, so bending where it samples bends what it reflects
      vec3 d = ray(t); float s = -CZ / min(d.z, -1e-4); vec2 P = vec2(s * d.x, CY + s * d.y);
      vec4 wv = wave(P, 1.0);
      // right at the line the floor is so foreshortened that ripples go finer than a pixel, so they fade out there
      float far = sm(F, F + 0.06, t.y);
      vec2 g = (wv.yz + swell(P)) * far;
      img = light(tt + vec2(g.x / TH, -g.y / TV) * uK.x);
      // crests that tip toward the halo flash with it (only what the ripples add: the still mirror is in the passes)
      vec3 Pw = vec3(P, 0.0), V = normalize(vec3(0.0, CY, CZ) - Pw), H = normalize(V + normalize(vec3(0.0, 2.6, 1.3) - Pw));
      vec3 n = normalize(vec3(-wv.yz * far * far, 1.0));
      float sp = max(0.0, pow(max(dot(n, H), 0.0), 700.0) - pow(H.z, 700.0));
      img += HALO * sp * uK.y * (0.25 + 0.75 * uHalo) * sm(1.0, 0.84, t.y);
#else
      img = light(tt);
#endif
      // water reflects far more than the passes' dark floor, most of all at a glancing angle, toward the line
      img *= 1.0 + uWet * mix(1.0, 0.55, sm(F, 1.0, t.y));
    }
    // a drop on its way down from a digit
    if (uDrip.z > 0.0) { vec2 dq = (t - uDrip.xy) * vec2(1.7778, 1.0 / uDrip.w); img += HALO * uDrip.z * exp(-dot(dq, dq) / 5e-6); }
    vec3 c = agx(img);
    float g = (hash(q * uDpr + fract(uTime) * 91.7) - 0.5) * uGrain;
    col = mix(uBg, c + g, edge);
  }
  // a hair of dither everywhere, so the dark glow doesn't band on 8-bit screens
  col += (hash(gl_FragCoord.xy + 0.37) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`.replaceAll('HY', String(HY)).replace('WBOX', WB.join(', ')).replace(/\bTH\b/g, TH.toFixed(6)).replace(/\bTV\b/g, TV.toFixed(6))
  .replaceAll('PITCH', PITCH.toFixed(6)).replace(/\bCY\b/g, `(${CY.toFixed(2)})`).replace(/\bCZ\b/g, CZ.toFixed(2)).replace(/\bLIFT\b/g, LIFT.toFixed(2));

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (v, p = 3) => 1 - Math.pow(1 - clamp(v), p);
const inOut = (v) => { v = clamp(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const ramp = (t, a, b, f = easeOut) => f((t - a) / (b - a));
// The reveal's beats in seconds (the same as the clips): line start, bright, full width; line settles; halo rises; key lights
const B = { line: [0.3, 0.8, 1.2], settle: [1.6, 3.4], up: [0.9, 3.9], halo: [0.9, 3.4], rig: [2.0, 3.9], end: 5.0 };

// A point of the passes to the floor under it, and a point of the scene to the passes
const PS = Math.sin(PITCH), PC = Math.cos(PITCH);
function toFloor(t) {
  const x = (2 * t[0] - 1) * TH, y = -(2 * t[1] - 1) * TV, dy = PC - PS * y, dz = PC * y + PS;
  if (dz > -1e-4) return null;
  const s = -CZ / dz; return [s * x, CY + s * dy];
}
function toPasses(p) {
  const d = [p[0], p[1] - CY, p[2] - CZ], zc = d[1] * PC + d[2] * PS, yc = -d[1] * PS + d[2] * PC;
  return [0.5 + d[0] / zc / (2 * TH), 0.5 - yc / zc / (2 * TV)];
}

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
  const imgs = await Promise.all(PASSES.map((n) => load((opts.files || {})[n + suf] || base + n + suf + '.jpg')));

  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const program = (fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  const tex = (unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // ---- the two height fields (the ripples need half-float render targets), ping-ponged ----
  let sims = null, step = null;
  if (opts.water && (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) {
    const ps = program(STEP);
    const SU = {}; ['uS', 'uPx', 'uAsp', 'uC2', 'uDamp', 'uSeg', 'uSegRS', 'uDrop'].forEach((n) => { SU[n] = gl.getUniformLocation(ps, n === 'uDrop' ? 'uDrop[0]' : n); });
    let ok = true;
    const field = (w, h, unit, asp, c2, damp) => {
      const bufs = [0, 1].map(() => {
        const t = tex(13); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        ok = ok && gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
        return { t, fb };
      });
      return { w, h, unit, asp, c2, damp, bufs, i: 0, seg: null, drops: [] };
    };
    // the glass in screen space (the passes above the floor line, 16:9); the water on the floor, in scene units
    const k = opts.small ? 0.6 : 1;
    const f = {
      glass: field(Math.round(320 * k), Math.round(133 * k), 12, [16 / 9, F], 0.3, 0.965),
      water: field(Math.round(352 * k), Math.round(326 * k), 11, [WB[2], WB[3]], 0.46, 0.9935),
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (ok) {
      sims = f;
      step = () => {
        gl.useProgram(ps); gl.uniform1i(SU.uS, 13);
        for (const s of Object.values(sims)) {
          const from = s.bufs[s.i], to = s.bufs[1 - s.i];
          gl.activeTexture(gl.TEXTURE13); gl.bindTexture(gl.TEXTURE_2D, from.t);
          gl.bindFramebuffer(gl.FRAMEBUFFER, to.fb); gl.viewport(0, 0, s.w, s.h);
          gl.uniform2f(SU.uPx, 1 / s.w, 1 / s.h); gl.uniform2fv(SU.uAsp, s.asp); gl.uniform1f(SU.uC2, s.c2); gl.uniform1f(SU.uDamp, s.damp);
          const g = s.seg || [0, 0, 0, 0, 1, 0];
          gl.uniform4f(SU.uSeg, g[0], g[1], g[2], g[3]); gl.uniform2f(SU.uSegRS, g[4], g[5]);
          const d = new Float32Array(16); s.drops.slice(0, 4).forEach((x, j) => d.set(x, j * 4)); gl.uniform4fv(SU.uDrop, d);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          s.i = 1 - s.i; s.seg = null; s.drops = s.drops.slice(4);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(pr);
        for (const s of Object.values(sims)) { gl.activeTexture(gl.TEXTURE0 + s.unit); gl.bindTexture(gl.TEXTURE_2D, s.bufs[s.i].t); }
      };
    }
  }

  const pr = program(sims ? FS.replace('#define WATER 0', '#define WATER 1') : FS);
  gl.useProgram(pr);
  imgs.forEach((im, i) => { tex(i); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, im); });
  const U = {}; ['T', 'uRes', 'uDpr', 'uFrame', 'uHalo', 'uUp', 'uRig', 'uLine', 'uReach', 'uZoom', 'uTime', 'uGrain', 'uDrift', 'uSweep', 'uCur', 'uTorch', 'uBg',
    'uW', 'uM', 'uBob', 'uTilt', 'uWet', 'uK', 'uDrip']
    .forEach((n) => { U[n] = gl.getUniformLocation(pr, n === 'T' ? 'T[0]' : n === 'uTorch' ? 'uTorch[0]' : n); });
  gl.uniform1iv(U.T, PASSES.map((_, i) => i));
  gl.uniform3fv(U.uBg, BG);
  gl.uniform1i(U.uW, 11); gl.uniform1i(U.uM, 12);
  gl.uniform4fv(U.uK, opts.look || LOOK); gl.uniform1f(U.uWet, opts.water ? WET : 0);
  if (sims) step();

  // ---- state ----
  const S = { start: null, reveal: opts.reveal !== false, ptr: null, lastMove: -1e9, p: 3, pk: 0, cx: 0.5, sweep: -1, scroll: 0, mx: 0, my: 0,
    zoom: OS, drift: [0, 0], bob: 0, wet: null, acc: 0, drip: null, nextDrip: null, stone: null };
  let dpr = 1, W = 0, H = 0, frame = [0, 0, 1, 1], cap = opts.small ? 2 : 1.5, slow = 0;
  const size = () => {
    const r = stage.getBoundingClientRect(), f = poster.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, cap);
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
  const onClick = (e) => {
    if (e.target.closest('a,button,input,label,select,textarea')) return;
    S.sweep = performance.now();
    if (S.ptr) S.stone = S.ptr;
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onMove, { passive: true });
  stage.parentElement.addEventListener('click', onClick);

  // where a point of the frame lands: on the glass or on the water (as a uv of that field), after the float
  const where = (fr) => {
    const t = [0.5 + (fr[0] - 0.5) / S.zoom + S.drift[0], 0.5 + (fr[1] - 0.5) / S.zoom + S.drift[1]];
    if (t[1] < F) return { f: 'glass', uv: [t[0], (t[1] + S.bob * clamp((F - t[1]) / 0.035)) / F] };
    const P = toFloor(t); if (!P) return null;
    return { f: 'water', uv: [(P[0] - WB[0]) / WB[2], (P[1] - WB[1]) / WB[3]] };
  };
  // the pointer's wake: from where it was a step ago to where it is now, stronger the faster it moves
  const stir = (dt) => {
    const now = S.ptr && performance.now() - S.lastMove < 150 ? where(S.ptr) : null, was = S.wet;
    S.wet = now;
    if (!now || !was || was.f !== now.f) return;
    const f = sims[now.f], a = f.asp;
    const dist = Math.hypot((now.uv[0] - was.uv[0]) * a[0], (now.uv[1] - was.uv[1]) * a[1]);
    if (dist < 1e-5 || dist > 0.6 * Math.max(a[0], a[1])) return;
    const glass = now.f === 'glass', v = clamp(dist / dt / (glass ? 1.2 : 3.5));
    f.seg = [...was.uv, ...now.uv, glass ? 0.026 : 0.06, (glass ? 0.6 : 0.45) * (0.2 + v)];
  };
  const stone = () => {
    const w = where(S.stone); S.stone = null; if (!w) return;
    sims[w.f].drops.push(w.f === 'glass' ? [...w.uv, 0.05, 6] : [...w.uv, 0.1, 5]);
  };
  // now and then a drop gathers on the bottom of a digit and falls (about a quarter of a second, as from that high)
  const drip = (t) => {
    if (S.nextDrip === null) S.nextDrip = t + 2.5;
    if (!S.drip && t > S.nextDrip) {
      const foot = FEET[Math.floor(Math.random() * 3)], lx = (foot[0] + Math.random() * (foot[1] - foot[0])) * 0.84;
      S.drip = { x: lx * Math.cos(YAW), y: lx * Math.sin(YAW) - 0.05, t0: t };
    }
    if (!S.drip) return [0, 0, 0, 1];
    const d = S.drip, k = (t - d.t0) / 0.23;
    if (k >= 1) {
      sims.water.drops.push([(d.x - WB[0]) / WB[2], (d.y - WB[1]) / WB[3], 0.03, 3]);
      S.drip = null; S.nextDrip = t + 2 + Math.random() * 3.5;
      return [0, 0, 0, 1];
    }
    const p = toPasses([d.x, d.y, (LIFT - 0.004) * (1 - k * k)]);
    return [p[0], p[1] - S.bob * (1 - k), 0.5 * Math.min(1, k * 5), 1 + 4 * k];
  };

  const draw = (now) => {
    if (S.start === null) S.start = now;
    const t = (now - S.start) / 1000, dt = Math.min(0.05, (now - (S.prev || now)) / 1000); S.prev = now;
    // a slow GPU (under about 40 frames a second for two seconds running) gets fewer pixels, down to 0.75 per point
    slow = dt > 0.025 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 80 && cap > 0.75 && !opts.capture) { cap = Math.max(0.75, Math.min(cap, dpr) - 0.25); slow = 0; size(); }
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
    // the float, once the light is up: a slow rise and fall with a second, slower sway, and a slight rock
    // (picking up at rest, it starts from the poster's place, still)
    const fl = !opts.water ? 0 : S.reveal ? ramp(rv, 3.0, 5.0, inOut) : ramp(t, 0, 1.5, inOut), ft = S.reveal ? Math.max(0, rv - 3.0) : t;
    S.bob = fl * (0.0075 * (1 - Math.cos(2 * Math.PI * ft / 6)) / 2 + 0.0022 * (1 - Math.cos(2 * Math.PI * ft / 9.7)) / 2);
    const tilt = fl * 0.0035 * Math.sin(2 * Math.PI * ft / 7.3 + 0.8);
    S.zoom = zoom; S.drift = [dx, -dy];
    let dr = [0, 0, 0, 1];
    if (sims) {
      dr = drip(rv);
      if (S.stone) stone();
      // the ripples run at a steady 60 steps a second, whatever the screen's rate
      S.acc = Math.min(S.acc + dt, 4 / 60);
      while (S.acc >= 1 / 60) { S.acc -= 1 / 60; stir(1 / 60); step(); }
      gl.viewport(0, 0, cv.width, cv.height);
    }
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uDpr, dpr); gl.uniform4fv(U.uFrame, frame);
    gl.uniform1f(U.uHalo, halo); gl.uniform1f(U.uUp, up); gl.uniform1f(U.uRig, rig); gl.uniform1f(U.uLine, line);
    gl.uniform1f(U.uReach, reach); gl.uniform1f(U.uZoom, zoom); gl.uniform2f(U.uDrift, dx, -dy);
    gl.uniform1f(U.uTime, t); gl.uniform1f(U.uGrain, opts.grain ?? 0.035);
    gl.uniform2f(U.uSweep, sw[0], sw[1]); gl.uniform2f(U.uCur, S.cx, S.pk * 0.8); gl.uniform1fv(U.uTorch, tw);
    gl.uniform1f(U.uBob, S.bob); gl.uniform1f(U.uTilt, tilt); gl.uniform4fv(U.uDrip, dr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // ---- run only while it's on screen ----
  let raf = 0, onScreen = true;
  const tick = (now) => { raf = 0; const r = stage.getBoundingClientRect(); S.scroll = clamp(-r.top / Math.max(1, r.height)); draw(now); go(); };
  const go = () => { if (!raf && onScreen && !document.hidden && !opts.capture) raf = requestAnimationFrame(tick); };
  new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; go(); }).observe(stage);
  // back from a hidden tab, the ripples pick up where they were instead of catching up
  document.addEventListener('visibilitychange', () => { S.prev = 0; go(); });
  new ResizeObserver(() => { size(); }).observe(stage);
  size();
  stage.appendChild(cv);
  if (opts.capture) return { cv, draw, S, water: !!sims };
  go();
  return { cv, reveal: S.reveal, water: !!sims };
}
