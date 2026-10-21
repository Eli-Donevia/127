// Liquid 127: the homepage's water hero, drawn as a real 3D scene every frame. The glass 127 is a signed distance
// field (its outline baked into /img/liquid/mark-sdf.png by v2/design/motion/src/liquid-sdf.py, extruded and
// bevelled here) and the pond is a height field run as a wave equation on the GPU. Each pixel marches a ray through
// both: the glass refracts and reflects a studio of soft lights (one of them follows the pointer), the pond mirrors
// the glass and the lights, and you can see the glass's glow through the water while it's under.
//   liquid127(stage, { small, reveal, scrub, capture, onSlow }) -> Promise (resolves once it's drawing)
//   scrub: () => 0..1, how far the page has scrolled through the hero's pin; the rise follows the first 65% of it
//   pop: true lights it with the accent (#7C8CFF) as well as white; setPop(bool) changes it live
//
// It's alive: the 127 floats and sways, turns toward the pointer on a spring, its surface moves like liquid, a hover
// sends a ripple through the glass, the pointer drags a wake through the pond, and a click drops a stone and makes the
// glass wobble. It forms out of the water: the pond swells, a mound of liquid climbs out of it still joined to the
// surface, gathers into the 127 and pulls free, dripping. With scrub the page opens on the still pond and the first
// bit of scroll plays that rise (scrolling back sinks it again); without, it plays on opening. Scrolling past the hero
// runs it back into the water.

const K = 2.4 / 290.8;                         // scene units per unit of the mark's path (the 127 is 2.4 wide)
const SW = 350.5778 * K, SH = 197.2 * K, SR = 60 * K;   // the distance field's extent and range, in scene units
const HALF = 72.6 * K;                         // half the mark's height
const LIFT = 0.25, DEPTH = 0.15, BEVEL = 0.028; // how far it floats, half its thickness, its rounded edge
const REST = LIFT + HALF;                      // the mark's middle, at rest
const CAM = [0, 0.62, 5.6], AIM = [0, 0.78, 0], TANV = 0.215;
const WB = [-4.5, -7.0, 9.0, 10.5];            // the pond's simulated patch: x, z (z toward the camera), width, depth
const FEET = [[38.3, 68.4], [87.3, 194.8], [222.2, 253.0]].map(([a, b]) => [(a - 153) * K, (b - 153) * K]);
const BG = [6 / 255, 6 / 255, 7 / 255];
const SOFT = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i;

const VS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// The pond: one step of the wave equation, damped, with a sponge at the edges; input is a wake and up to four drops.
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
#define STEPS 90
#define INNER 22
#define REFL 48
uniform sampler2D uSdf, uW;
uniform vec2 uRes; uniform float uDpr; uniform vec4 uFrame; uniform float uTime, uGrain;
uniform vec4 uMark;          // the mark's middle (xyz) and its stretch (w)
uniform mat3 uRot;           // scene to mark
uniform float uForm, uMerge, uWobble, uGlow, uKey, uFade;
uniform vec4 uPoke[4];       // ripples through the glass: where on its face (x, y), strength, age
uniform vec3 uPtr;
uniform float uNeon;          // the water glows neon where it's disturbed (the hero without the 127)
uniform float uPop;           // how much of the light is the accent colour           // the pointer's light: where it points (x, y) and how strong
out vec4 o;
const vec3 HALO = vec3(0.89, 0.90, 0.95), POP = vec3(0.20, 0.83, 0.92);   // Tide #7CEBF6, in linear light, a touch hotter
const vec3 TIDE = vec3(0.20, 0.83, 0.92), ORCHID = vec3(0.40, 0.26, 1.0), FLARE = vec3(0.89, 0.20, 1.0);   // D57, linear
const vec3 BG = vec3(BGC);
const float SW_ = SWV, SH_ = SHV, SR_ = SRV, DEPTH_ = DEPTHV, BEVEL_ = BEVELV;
const vec4 WB_ = vec4(WBV);
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float sm(float a, float b, float x) { float k = clamp((x - a) / (b - a), 0.0, 1.0); return k * k * (3.0 - 2.0 * k); }
// the 127's outline: signed distance in the plane of the mark
float mark2(vec2 p) {
  vec2 uv = vec2(p.x / SW_ + 0.5, 0.5 - p.y / SH_), c = clamp(uv, 0.002, 0.998);
  vec3 s = texture(uSdf, c).rgb;
  float d = ((s.r * 65280.0 + s.g * 255.0) / 65535.0 - 0.5) * 2.0 * SR_;
  return d + length((uv - c) * vec2(SW_, SH_));
}
// the glass: the outline extruded and rounded, then made liquid
float glass(vec3 p) {
  vec3 q = uRot * (p - uMark.xyz); q.y /= uMark.w;
  // far from it, a box is enough (and saves the texture)
  vec3 b = abs(q) - vec3(1.3, 0.72, 0.3);
  float box = length(max(b, 0.0));
  if (box > 0.35 + 0.4 * (1.0 - uForm)) return box;
  vec2 w = vec2(mark2(q.xy) + BEVEL_, abs(q.z) - DEPTH_ + BEVEL_);
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - BEVEL_;
  // unformed, it's a swollen, moving mass of water; formed, its surface still moves a hair
  float u = 1.0 - uForm;
  float n = noise(q * vec3(1.7, 1.4, 1.7) + vec3(0.0, -uTime * 0.9, uTime * 0.3)) - 0.5;
  n += 0.3 * (noise(q * 4.2 + vec3(uTime * 0.7, -uTime * 1.3, 0.0)) - 0.5);
  d += n * (0.5 * u * u + uWobble) - 0.16 * u;
  // a ripple running out from where the glass was touched
  for (int i = 0; i < 4; i++) {
    if (uPoke[i].z <= 0.0) continue;
    float r = length(q.xy - uPoke[i].xy), a = uPoke[i].w;
    d -= uPoke[i].z * exp(-r * r / 0.09) * sin(18.0 * r - 14.0 * a) * exp(-a * 2.2);
  }
  return d;
}
// the pond: a long low swell under the simulated ripples
float water(vec2 P) {
  vec2 uv = (P - WB_.xy) / WB_.zw;
  float h = texture(uW, uv).r * 0.01 * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  h += 0.0035 * sin(dot(P, vec2(0.42, 0.91)) * 5.1 - uTime * 1.7) + 0.0026 * sin(dot(P, vec2(-0.74, 0.67)) * 7.3 - uTime * 2.1 + 1.3);
  return h;
}
float scene(vec3 p, out float g) { g = glass(p); float w = p.y - water(p.xz); return uMerge > 0.001 ? smin(g, w, uMerge) : min(g, w); }
vec3 gnorm(vec3 p) { const vec2 e = vec2(0.0015, -0.0015);
  return normalize(e.xyy * glass(p + e.xyy) + e.yyx * glass(p + e.yyx) + e.yxy * glass(p + e.yxy) + e.xxx * glass(p + e.xxx)); }
vec3 snorm(vec3 p) { const vec2 e = vec2(0.002, -0.002); float g;
  return normalize(e.xyy * scene(p + e.xyy, g) + e.yyx * scene(p + e.yyx, g) + e.yxy * scene(p + e.yxy, g) + e.xxx * scene(p + e.xxx, g)); }
vec3 wnorm(vec2 P) { float e = 0.01; return normalize(vec3(water(P - vec2(e, 0)) - water(P + vec2(e, 0)), 2.0 * e, water(P - vec2(0, e)) - water(P + vec2(0, e)))); }
// a soft-edged panel of light in direction c, w wide and h tall
float panel(vec3 d, vec3 c, vec3 up, float w, float h) {
  float k = dot(d, c); if (k <= 0.0) return 0.0;
  vec3 x = normalize(cross(c, up)), y = cross(x, c);
  vec2 q = vec2(dot(d, x), dot(d, y)) / k;
  return sm(w, w * 0.55, abs(q.x)) * sm(h, h * 0.55, abs(q.y));
}
// the studio: a void with tall strips behind the mark (so the glass glows from within), a soft top light, a dim
// fill, and the pointer's light in front. Below the horizon it's the pond, a dark mirror of all that.
vec3 sky(vec3 d, float key) {
  vec3 c = vec3(0.010, 0.010, 0.013) * exp(-abs(d.y) * 5.0);
  // a broad soft glow straight behind: what lights the glass from within, as the halo did
  vec2 bq = vec2(d.x, d.y - 0.12) / max(-d.z, 1e-3);
  c += mix(HALO, POP * 1.5, uPop * 0.6) * 0.55 * step(0.0, -d.z) * exp(-dot(bq, bq * vec2(1.6, 3.4)) / 0.16);
  c += mix(HALO, POP * 1.6, uPop) * 2.6 * panel(d, normalize(vec3(-0.85, 0.18, -1.0)), vec3(0, 1, 0), 0.08, 0.9);
  c += mix(HALO, POP * 1.6, uPop * 0.35) * 2.6 * panel(d, normalize(vec3(0.85, 0.18, -1.0)), vec3(0, 1, 0), 0.08, 0.9);
  c += vec3(0.72, 0.75, 1.0) * 0.9 * panel(d, normalize(vec3(0.0, 0.05, -1.0)), vec3(0, 1, 0), 0.9, 0.12);
  c += HALO * 1.6 * uKey * key * panel(d, normalize(vec3(0.15, 1.0, 0.35)), vec3(0, 0, -1), 0.7, 0.35);
  c += HALO * 0.18 * panel(d, normalize(vec3(-0.4, 0.25, 1.0)), vec3(0, 1, 0), 0.6, 0.4);
  vec3 pc = normalize(vec3(uPtr.x * 1.4, 0.35 + uPtr.y * 0.6, 1.0));
  vec3 pl = mix(HALO, POP * 1.4, uPop);
  c += pl * 3.2 * uPtr.z * pow(max(dot(d, pc), 0.0), 900.0);
  c += pl * 0.25 * uPtr.z * pow(max(dot(d, pc), 0.0), 60.0);
  return c;
}
// what the pond mirrors: only the void, a faint sheen and the pointer's light (no glow or strips, so it stays dark)
vec3 skyW(vec3 d) {
  vec3 c = vec3(0.006, 0.006, 0.008);
  // a low, wide, faint sheen far behind, so the ripples have something to catch
  c += HALO * 0.16 * step(0.0, -d.z) * exp(-pow(d.y / max(-d.z, 1e-3) - 0.06, 2.0) / 0.004) * exp(-d.x * d.x / 0.5);
  vec3 pc = normalize(vec3(uPtr.x * 1.4, 0.35 + uPtr.y * 0.6, 1.0));
  c += mix(HALO, POP * 1.4, uPop) * 2.0 * uPtr.z * pow(max(dot(d, pc), 0.0), 900.0);
  return c;
}
vec3 env(vec3 d) { return d.y >= 0.0 ? sky(d, 1.0) : sky(vec3(d.x, -d.y, d.z), 0.0) * 0.06 + vec3(0.003, 0.003, 0.004); }
// the glass, from outside: reflection, and what's seen through it (bent in, across and out, each colour a little
// differently), dimmed by the depth of glass it crossed
vec3 shadeGlass(vec3 p, vec3 rd, vec3 n, bool full) {
  float c = clamp(-dot(rd, n), 0.0, 1.0), F = 0.04 + 0.96 * pow(1.0 - c, 5.0);
  vec3 refl = env(reflect(rd, n));
  vec3 r2 = refract(rd, n, 1.0 / 1.47), q = p - n * (max(glass(p), 0.0) + 0.006);   // the hit can sit a hair outside
  float len = 0.0;
  if (full) {
    for (int i = 0; i < INNER; i++) { float d = -glass(q); if (d < 0.002) break; q += r2 * max(d, 0.008); len += max(d, 0.008); }
  } else { q += r2 * 0.25; len = 0.25; }
  vec3 n2 = -gnorm(q), t;
  vec3 col;
  vec3 a = refract(r2, n2, 1.44), b = refract(r2, n2, 1.47), e = refract(r2, n2, 1.51);
  if (dot(b, b) < 0.5) { b = reflect(r2, n2); a = b; e = b; }
  col = vec3(env(dot(a, a) < 0.5 ? b : a).r, env(b).g, env(dot(e, e) < 0.5 ? b : e).b);
  col *= exp(-len * vec3(0.55, 0.45, 0.32)) * 0.96;
  col += vec3(0.02, 0.022, 0.03) * uGlow;
  return mix(col, refl, F);
}
// the pond: a dark mirror of the glass and the lights, and under it the glass's glow while it's below
vec3 shadeWater(vec3 p, vec3 rd, vec3 n) {
  float c = clamp(-dot(rd, n), 0.0, 1.0), F = 0.02 + 0.98 * pow(1.0 - c, 5.0);
  vec3 rr = reflect(rd, n), q = p + rr * 0.01, refl = skyW(rr);
  float t = 0.0;
  if (uNeon < 0.5) for (int i = 0; i < REFL; i++) { float d = glass(q); if (d < 0.002) { refl = shadeGlass(q, rr, gnorm(q), false); break; } q += rr * d; t += d; if (t > 9.0) break; }
  vec3 col = refl * (F * 1.1 + 0.03);
  // where the pointer or a drop stirs it, the water lights up from within along its ripples: teal through orchid to
  // flare, drifting slowly across the pond (D57). Only moving water glows; the still pond stays a dark mirror.
  if (uNeon > 0.0) {
    vec2 uv = (p.xz - WB_.xy) / WB_.zw, e2 = vec2(1.0 / 256.0, 0.0);
    float h0 = texture(uW, uv).r, gx = texture(uW, uv + e2).r - texture(uW, uv - e2).r, gz = texture(uW, uv + e2.yx).r - texture(uW, uv - e2.yx).r;
    float g = smoothstep(0.05, 0.22, length(vec2(gx, gz))) * (0.55 + 0.45 * smoothstep(0.0, 0.4, h0));
    float a = abs(fract(dot(p.xz, vec2(0.19, 0.11)) + uTime * 0.035) * 2.0 - 1.0);
    vec3 neon = mix(mix(TIDE, ORCHID, smoothstep(0.15, 0.6, a)), FLARE, smoothstep(0.65, 1.0, a));
    col += neon * g * g * 1.15 * uNeon * (0.35 + 0.65 * (1.0 - c));
  }
  if (uGlow > 0.0) {
    vec3 rt = refract(rd, n, 1.0 / 1.33); q = p; t = 0.0;
    for (int i = 0; i < 24; i++) { float d = glass(q); if (d < 0.004) { col += mix(HALO, POP * 1.3, uPop) * 0.5 * uGlow * exp(-t * 1.8) * (0.5 + 0.5 * dot(gnorm(q), -rt)); break; } q += rt * max(d, 0.01); t += max(d, 0.01); if (t > 2.0) break; }
  }
  return col;
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
float h2(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 q = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 u = (q - uFrame.xy) / uFrame.zw;                       // the 16:9 frame the poster fills, 0..1, y down
  vec3 ro = vec3(CAMV), fw = normalize(vec3(AIMV) - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 rd = normalize(fw + rt * (u.x - 0.5) * 2.0 * TANV_ * 16.0 / 9.0 - up * (u.y - 0.5) * 2.0 * TANV_);
  vec3 col = vec3(0.0);
  float t = 0.0, g, hit = 0.0;
  vec3 p = ro;
  for (int i = 0; i < STEPS; i++) {
    p = ro + rd * t;
    float d = scene(p, g);
    if (d < 0.0015 * (1.0 + t)) { hit = 1.0; break; }
    t += d * 0.8;
    if (t > 40.0 || (rd.y > 0.0 && p.y > 2.6)) break;
  }
  if (hit > 0.5) {
    float w = p.y - water(p.xz);
    // where the glass and the pond are still one, the surface is a blend of both
    float k = uMerge > 0.001 ? clamp(0.5 + 0.5 * (w - g) / uMerge, 0.0, 1.0) : step(g, w);
    vec3 cg = k > 0.01 ? shadeGlass(p, rd, uMerge > 0.001 && k < 0.99 ? snorm(p) : gnorm(p), true) : vec3(0.0);
    vec3 cw = k < 0.99 ? shadeWater(p, rd, k > 0.01 ? snorm(p) : wnorm(p.xz)) : vec3(0.0);
    col = mix(cw, cg, k);
    col = mix(col, vec3(0.0), sm(9.0, 22.0, t));            // the far pond fades into the dark
  } else col = vec3(0.010, 0.010, 0.013) * exp(-abs(rd.y) * 5.0);    // the lights themselves are out of sight
  vec2 s = q / (uRes / uDpr);
  float edge = sm(0.0, 0.08, s.x) * sm(0.0, 0.08, 1.0 - s.x) * sm(0.0, 0.05, s.y) * sm(0.0, 0.16, 1.0 - s.y);
  vec3 c = agx(col * uFade);
  c += (h2(q * uDpr + fract(uTime) * 91.7) - 0.5) * uGrain;
  c = mix(BG, c, edge);
  c += (h2(gl_FragCoord.xy + 0.37) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`.replace('BGC', BG.join(', ')).replace('SWV', SW.toFixed(5)).replace('SHV', SH.toFixed(5)).replace('SRV', SR.toFixed(5))
  .replace('DEPTHV', DEPTH.toFixed(3)).replace('BEVELV', BEVEL.toFixed(3)).replace('WBV', WB.join(', '))
  .replace('CAMV', CAM.join(', ')).replace('AIMV', AIM.join(', ')).replaceAll('TANV_', TANV.toFixed(4));


const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (v, p = 3) => 1 - Math.pow(1 - clamp(v), p);
const inOut = (v) => { v = clamp(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const ramp = (t, a, b, f = easeOut) => f((t - a) / (b - a));
// The rise, in seconds: the pond swells, the mass climbs out, gathers into the 127, pulls free of the water, settles
const R = { swell: [0.2, 1.4], up: [0.6, 3.6], form: [1.2, 3.9], free: [2.6, 3.9], glow: [0.0, 1.2], key: [1.0, 3.6], end: 5.0, deep: 1.75 };

function load(src) {
  return fetch(src).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then((b) => createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }));
}
// a point of the frame to a ray, and where that ray meets the pond or the mark's face
function rayAt(u, v) {
  const f = [AIM[0] - CAM[0], AIM[1] - CAM[1], AIM[2] - CAM[2]], fl = Math.hypot(...f); f.forEach((x, i) => { f[i] = x / fl; });
  const r = [-f[2], 0, f[0]], rl = Math.hypot(...r); r.forEach((x, i) => { r[i] = x / rl; });
  const up = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const a = (u - 0.5) * 2 * TANV * 16 / 9, b = -(v - 0.5) * 2 * TANV;
  const d = [0, 1, 2].map((i) => f[i] + r[i] * a + up[i] * b), dl = Math.hypot(...d);
  return d.map((x) => x / dl);
}

export async function liquid127(stage, opts = {}) {
  const poster = stage.querySelector('img');
  const cv = document.createElement('canvas');
  cv.className = 'fl-canvas'; cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: !!opts.capture, failIfMajorPerformanceCaveat: !opts.capture });
  if (!gl) throw new Error('no webgl2');
  if (!opts.capture) {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg && SOFT.test(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)))) throw new Error('software webgl');
  }
  if (!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) throw new Error('no float targets');
  const sdfImg = await load(opts.sdf || '/img/liquid/mark-sdf.png');

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

  // ---- the pond's height field, ping-ponged ----
  const ps = program(STEP);
  const SU = {}; ['uS', 'uPx', 'uAsp', 'uC2', 'uDamp', 'uSeg', 'uSegRS', 'uDrop'].forEach((n) => { SU[n] = gl.getUniformLocation(ps, n === 'uDrop' ? 'uDrop[0]' : n); });
  const fw = opts.small ? 240 : 384, fh = Math.round(fw * WB[3] / WB[2]);
  const pond = { w: fw, h: fh, asp: [WB[2], WB[3]], c2: 0.46, damp: 0.9935, i: 0, seg: null, drops: [], bufs: [0, 1].map(() => {
    const t = tex(3); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, fw, fh, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('no float targets');
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, fb };
  }) };
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const pr = program(opts.small ? FS.replace('#define STEPS 90', '#define STEPS 64').replace('#define INNER 22', '#define INNER 14').replace('#define REFL 48', '#define REFL 32') : FS);
  const step = () => {
    gl.useProgram(ps); gl.uniform1i(SU.uS, 4);
    const from = pond.bufs[pond.i], to = pond.bufs[1 - pond.i];
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, from.t);
    gl.bindFramebuffer(gl.FRAMEBUFFER, to.fb); gl.viewport(0, 0, pond.w, pond.h);
    gl.uniform2f(SU.uPx, 1 / pond.w, 1 / pond.h); gl.uniform2fv(SU.uAsp, pond.asp); gl.uniform1f(SU.uC2, pond.c2); gl.uniform1f(SU.uDamp, pond.damp);
    const g = pond.seg || [0, 0, 0, 0, 1, 0];
    gl.uniform4f(SU.uSeg, g[0], g[1], g[2], g[3]); gl.uniform2f(SU.uSegRS, g[4], g[5]);
    const d = new Float32Array(16); pond.drops.slice(0, 4).forEach((x, j) => d.set(x, j * 4)); gl.uniform4fv(SU.uDrop, d);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    pond.i = 1 - pond.i; pond.seg = null; pond.drops = pond.drops.slice(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(pr);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, pond.bufs[pond.i].t);
  };
  const drop = (x, z, r, a) => pond.drops.push([(x - WB[0]) / WB[2], (z - WB[1]) / WB[3], r, a]);

  gl.useProgram(pr);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  tex(0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, sdfImg);
  const U = {}; ['uSdf', 'uW', 'uRes', 'uDpr', 'uFrame', 'uTime', 'uGrain', 'uMark', 'uRot', 'uForm', 'uMerge', 'uWobble', 'uGlow', 'uKey', 'uFade', 'uPoke', 'uPtr', 'uPop', 'uNeon']
    .forEach((n) => { U[n] = gl.getUniformLocation(pr, n === 'uPoke' ? 'uPoke[0]' : n); });
  gl.uniform1i(U.uSdf, 0); gl.uniform1i(U.uW, 1);
  step();


  // ---- state ----
  const S = { start: null, reveal: opts.reveal !== false, ptr: null, lastMove: -1e9, scroll: 0, prev: 0, acc: 0,
    yaw: 0, yawV: 0, pitch: 0, pitchV: 0, sq: 0, sqV: 0, lx: 0, ly: 0, lk: 0, pokes: [], ph: 0, dph: 0, pop: opts.pop ? 1 : 0, popT: opts.pop ? 1 : 0, wet: null, stone: null, wasY: null, freed: false, drips: [], nextDrip: null };
  let dpr = 1, W = 0, H = 0, frame = [0, 0, 1, 1], scale = opts.scale || (opts.small ? 0.55 : 0.75), slow = 0, stopped = false;
  const fps = opts.fps || (opts.small ? 30 : 60);
  const size = () => {
    const r = stage.getBoundingClientRect(), f = poster.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2) * scale;
    W = r.width; H = r.height;
    cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
    frame = [f.left - r.left, f.top - r.top, f.width, f.height];
  };
  const toFrame = (x, y) => [(x - frame[0]) / frame[2], (y - frame[1]) / frame[3]];
  const onMove = (e) => {
    const r = stage.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) { S.ptr = null; return; }
    S.ptr = toFrame(e.clientX - r.left, e.clientY - r.top); S.lastMove = performance.now();
  };
  const onClick = (e) => {
    if (e.target.closest('a,button,input,label,select,textarea')) return;
    if (S.ptr) S.stone = S.ptr;
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onMove, { passive: true });
  stage.parentElement.addEventListener('click', onClick);

  // where a point of the frame lands: the mark's face (in the mark's own plane) or the pond
  // just the body of water (opts.mark false): the first drop lands soon after it starts, then now and then another
  const noMark = opts.mark === false;
  const hitAt = (fr, my) => {
    const d = rayAt(fr[0], fr[1]);
    const s = (DEPTH - CAM[2]) / d[2];                          // the front face, near enough
    const x = CAM[0] + d[0] * s, y = CAM[1] + d[1] * s;
    if (!noMark && Math.abs(x) < 1.25 && Math.abs(y - my) < HALF + 0.05) return { f: 'glass', x, y: (y - my) };
    if (d[1] >= -1e-4) return null;
    const k = -CAM[1] / d[1];
    return { f: 'pond', x: CAM[0] + d[0] * k, z: CAM[2] + d[2] * k };
  };
  const stir = (dt, my) => {
    const now = S.ptr && performance.now() - S.lastMove < 150 ? hitAt(S.ptr, my) : null, was = S.wet;
    S.wet = now;
    if (!now || !was || was.f !== now.f) return;
    if (now.f === 'glass') {
      const v = Math.hypot(now.x - was.x, now.y - was.y) / dt;
      if (v > 0.4 && (!S.pokes.length || S.pokes[S.pokes.length - 1].age > 0.12)) S.pokes.push({ x: now.x, y: now.y, a: Math.min(0.012, 0.0025 * v), age: 0 });
      return;
    }
    const a = [(was.x - WB[0]) / WB[2], (was.z - WB[1]) / WB[3]], b = [(now.x - WB[0]) / WB[2], (now.z - WB[1]) / WB[3]];
    const dist = Math.hypot(now.x - was.x, now.z - was.z);
    if (dist < 1e-4 || dist > 2) return;
    pond.seg = [...a, ...b, 0.07, 0.5 * (0.2 + clamp(dist / dt / 3.5))];
  };

  const draw = (now, paint = true) => {
    if (S.start === null) S.start = now;
    const t = (now - S.start) / 1000, dt = Math.min(0.05, (now - (S.prev || now)) / 1000); S.prev = now;
    slow = dt > 1.5 / fps ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 80 && !opts.capture) {
      slow = 0;
      if (scale > 0.4) { scale -= 0.12; size(); } else { stopped = true; if (opts.onSlow) opts.onSlow(); }
    }
    // rv: how far into the rise; ck: the clock its life runs on (the same, unless the scroll drives the rise)
    let rv = S.reveal ? t : R.end + t, ck = rv;
    const scrub = opts.scrub && S.reveal;
    if (scrub) {
      // the rise follows the scroll, with a little liquid lag; once it's free it settles in its own time
      const p = clamp(opts.scrub() / 0.65), was = S.ph, top = R.free[1];
      if (p > 0.995 && S.ph >= top - 0.05) S.ph = Math.min(R.end + 1.5, S.ph + dt);
      else { S.ph = Math.min(S.ph, top); S.ph += (p * top - S.ph) * (1 - Math.exp(-dt * 5)); }
      S.dph = S.ph - was; rv = S.ph; ck = R.end + t;
    }
    // the rise
    const v = clamp((rv - R.up[0]) / (R.up[1] - R.up[0]));
    let y = REST - R.deep * Math.pow(1 - v, 2.4);
    let form = ramp(rv, ...R.form, inOut), merge = 0.42 * (1 - ramp(rv, ...R.free, inOut)), glow = (1 - ramp(rv, R.up[1] - 0.8, R.up[1] + 0.4)) * ramp(rv, 0.2, 0.9);
    // without the 127 (mark: false) it's just the pond: the mark stays far under, out of sight
    if (noMark) { y = -4; form = 0; merge = 0; glow = 0; }
    let key = 0.35 + 0.65 * ramp(rv, ...R.key), fade = 0.25 + 0.75 * ramp(scrub ? t : rv, 0, 1.2);
    const wob = 0.0035 + 0.02 * (1 - ramp(rv, R.free[1] - 0.5, R.end + 1.5, (x) => x));
    // alive: it floats and sways on its own, and turns to the pointer on a spring
    const idle = !S.ptr || now - S.lastMove > 2600;
    const fl = ramp(rv, R.free[0], R.end + 0.5, inOut);
    y += fl * (0.03 * Math.sin(2 * Math.PI * ck / 6.2) + 0.012 * Math.sin(2 * Math.PI * ck / 9.7));
    const yawT = (idle ? 0.09 * Math.sin(2 * Math.PI * ck / 11) : (clamp(S.ptr[0], -0.2, 1.2) - 0.5) * 0.8) * fl;
    const pitchT = (idle ? 0.035 * Math.sin(2 * Math.PI * ck / 8.3 + 1) : (clamp(S.ptr[1], -0.2, 1.2) - 0.45) * 0.32) * fl;
    const spring = (x, vv, tgt, k, c) => { const a = k * (tgt - x) - c * vv; vv += a * dt; return [x + vv * dt, vv]; };
    [S.yaw, S.yawV] = spring(S.yaw, S.yawV, yawT, 26, 5.5);
    [S.pitch, S.pitchV] = spring(S.pitch, S.pitchV, pitchT, 26, 5.5);
    [S.sq, S.sqV] = spring(S.sq, S.sqV, 0, 160, 7);
    // the pointer's light
    const lxT = S.ptr && !idle ? (S.ptr[0] - 0.5) * 2 : 0.6 * Math.sin(ck * 0.4), lyT = S.ptr && !idle ? (0.5 - S.ptr[1]) * 2 : 0.2;
    const la = 1 - Math.exp(-dt * (idle ? 1.2 : 6));
    S.lx += (lxT - S.lx) * la; S.ly += (lyT - S.ly) * la; S.lk += ((rv > 3 ? (idle ? 0.5 : 1) : 0) - S.lk) * (1 - Math.exp(-dt * 2));
    // scrolling on: back into the water
    const s = S.scroll;
    if (s > 0.12) {
      const k = inOut((s - 0.2) / 0.5);
      form = Math.min(form, 1 - inOut((s - 0.12) / 0.4)); y = Math.min(y, REST - R.deep * 0.9 * k * k);
      merge = Math.max(merge, 0.42 * inOut((s - 0.12) / 0.3)); key *= 1 - 0.5 * s;
    }
    // the pond: it swells first, rings where the mass breaks through, and drops as it pulls free
    // (driven by the scroll, it swells as fast as the scroll moves it, and only on the way up)
    if (rv > R.swell[0] && rv < R.swell[1] && S.reveal) drop(0, -0.02, 0.5, 0.06 * Math.sin(Math.PI * (rv - R.swell[0]) / (R.swell[1] - R.swell[0])) * (scrub ? clamp(S.dph * 60, 0, 2) : 1));
    // before the first scroll, the still pond stirs now and then, as if something were under it
    if (scrub && rv < 0.05) { if (S.invite === undefined) S.invite = ck + 1.6; if (ck > S.invite) { drop(0, -0.02, 0.4, 1.0); S.invite = ck + 3.4; } }
    const bottom = y - HALF, wasB = S.wasY === null ? bottom : S.wasY; S.wasY = bottom;
    if (bottom < 0 && bottom + 2 * HALF > 0 && wasB < bottom && Math.random() < 0.5) {
      const f = FEET[Math.floor(Math.random() * 3)]; drop(f[0] + Math.random() * (f[1] - f[0]), (Math.random() - 0.5) * 0.3, 0.07, 0.9 * clamp((bottom - wasB) * 60 / 0.8));
    }
    if (S.freed && merge > 0.2) S.freed = false;            // sunk back (scrolled up): it can drip free again
    if (!S.freed && merge < 0.05 && S.reveal && rv < R.end + 1) {
      S.freed = true; FEET.forEach((f, i) => S.drips.push({ t: ck + 0.05 + 0.13 * i, x: (f[0] + f[1]) / 2 }));
    }
    if (S.nextDrip === null) S.nextDrip = ck + 3;
    if (!noMark && ck > S.nextDrip && fl > 0.9) { const f = FEET[Math.floor(Math.random() * 3)]; S.drips.push({ t: ck + 0.25, x: f[0] + Math.random() * (f[1] - f[0]) }); S.nextDrip = ck + 2.5 + Math.random() * 4; }
    if (noMark) {
      if (S.nextDrop === undefined) S.nextDrop = t + 0.8;
      if (t > S.nextDrop) {
        const first = !S.dropped; S.dropped = true; S.nextDrop = t + 5 + Math.random() * 4;
        drop(first ? 0 : (Math.random() - 0.5) * 2.6, first ? -0.3 : -0.7 + Math.random() * 0.9, first ? 0.14 : 0.08, first ? 5 : 2.6);
      }
    }
    S.drips = S.drips.filter((d) => { if (ck < d.t) return true; drop(d.x, 0.0, 0.05, 2.4); return false; });
    if (S.stone) { const h = hitAt(S.stone, y); S.stone = null;
      if (h && h.f === 'pond') drop(h.x, h.z, 0.12, 5); else if (h) { S.sqV -= 1.2; S.pokes.push({ x: h.x, y: h.y, a: 0.02, age: 0 }); } }
    S.acc = Math.min(S.acc + dt, 4 / 60);
    while (S.acc >= 1 / 60) { S.acc -= 1 / 60; stir(1 / 60, y); step(); }
    S.pokes.forEach((p) => { p.age += dt; }); S.pokes = S.pokes.filter((p) => p.age < 2.2).slice(-4);

    if (!paint) return;
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uDpr, dpr); gl.uniform4fv(U.uFrame, frame);
    gl.uniform1f(U.uTime, t); gl.uniform1f(U.uGrain, opts.grain ?? 0.03);
    gl.uniform4f(U.uMark, 0, y, 0, 1 + S.sq);
    const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw), cp = Math.cos(S.pitch), sp_ = Math.sin(S.pitch);
    // scene to mark: undo the yaw (about y), then the pitch (about x); column-major
    gl.uniformMatrix3fv(U.uRot, false, new Float32Array([cy, sy * sp_, sy * cp, 0, cp, -sp_, -sy, cy * sp_, cy * cp]));
    gl.uniform1f(U.uForm, form); gl.uniform1f(U.uMerge, merge); gl.uniform1f(U.uWobble, wob); gl.uniform1f(U.uGlow, glow);
    gl.uniform1f(U.uKey, key); gl.uniform1f(U.uFade, fade);
    const pk = new Float32Array(16); S.pokes.forEach((p, j) => pk.set([p.x, p.y, p.a, p.age], j * 4)); gl.uniform4fv(U.uPoke, pk);
    gl.uniform3f(U.uPtr, S.lx, S.ly, S.lk);
    S.pop += (S.popT - S.pop) * (1 - Math.exp(-dt * 3)); gl.uniform1f(U.uPop, S.pop); gl.uniform1f(U.uNeon, noMark ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  let raf = 0, onScreen = true, last = 0;
  const gap = 1000 / fps - 2;
  const tick = (now) => {
    raf = 0;
    if (now - last >= gap) { last = now; const r = stage.getBoundingClientRect(); S.scroll = clamp(-r.top / Math.max(1, r.height)); draw(now); }
    go();
  };
  const go = () => { if (!raf && !stopped && onScreen && !document.hidden && !opts.capture) raf = requestAnimationFrame(tick); };
  new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; go(); }).observe(stage);
  document.addEventListener('visibilitychange', () => { S.prev = 0; go(); });
  new ResizeObserver(() => { size(); }).observe(stage);
  size();
  stage.appendChild(cv);
  if (opts.capture) return { cv, draw, S };
  go();
  return { cv, reveal: S.reveal, setPop: (on) => { S.popT = on ? 1 : 0; } };
}
