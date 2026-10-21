/*!
 * liquid-chrome.js — plain WebGL1 liquid-metal background, no framework.
 *
 * Ported to vanilla JS for 127 from Componentry's <LiquidChrome> (React).
 * Original: https://github.com/harshjdhv/componentry
 *   packages/ui/src/components/liquid-chrome.tsx
 * Copyright (c) 2026 Harsh Jadhav. MIT License (see LICENSE-liquid-chrome.txt in this folder).
 *
 * 127 changes: no React; DPR capped; optional render scale; pauses when the
 * canvas is offscreen or the tab is hidden; reduced motion draws one still
 * frame; pointer (mouse + touch) input; poster fallback when WebGL is missing;
 * tint / highlight colours are uniforms so the accent system can drive them.
 *
 * Usage:
 *   import { liquidChrome } from './liquid-chrome.js'
 *   const fx = liquidChrome(document.querySelector('canvas'), {
 *     base: [0.02, 0.02, 0.03],      // shadow tint (rgb 0..1)
 *     mid: [0.80, 0.80, 0.90],       // silver midtone
 *     spec: [1, 1, 1],               // specular highlight (try the Pop #7C8CFF -> [0.49,0.55,1])
 *     amplitude: 0.6, speed: 1, scale: 0.5, interactive: true,
 *     poster: '/img/hero-poster.webp' // shown if WebGL is unavailable
 *   })
 *   fx.set({ amplitude: 0.9 }); fx.destroy()
 */

const VERT = `attribute vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }`

const FRAG = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_base;
uniform vec3 u_mid;
uniform vec3 u_spec;
uniform float u_amplitude;
uniform float u_vignette;

const mat2 m = mat2(0.80, 0.60, -0.60, 0.80);
float hash(vec2 p){ float h = dot(p, vec2(127.1, 311.7)); return fract(sin(h) * 43758.5453123); }
float noise(in vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float f = 0.0;
  f += 0.5000 * noise(p); p = m * p * 2.02;
  f += 0.2500 * noise(p); p = m * p * 2.03;
  f += 0.1250 * noise(p); p = m * p * 2.01;
  f += 0.0625 * noise(p);
  return f / 0.9375;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = -1.0 + 2.0 * uv;
  p.x *= u_resolution.x / max(u_resolution.y, 1.0);

  vec2 mouse = (u_mouse - 0.5) * 2.0;
  mouse.x *= u_resolution.x / max(u_resolution.y, 1.0);
  vec2 diff = p - mouse;
  float dist = length(diff);
  if (dist > 0.0) p += (diff / dist) * exp(-dist * 3.0) * 0.1;

  float t = u_time * 0.5;
  vec2 q = vec2(fbm(p + t * 0.1), fbm(p + vec2(5.2, 1.3) + t * 0.15));
  vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.2),
                fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.25));
  float f = fbm(p + r * 4.0 * u_amplitude);

  vec3 col = u_base;
  col = mix(col, vec3(0.0), 1.0 - smoothstep(0.1, 0.3, f));
  col = mix(col, u_mid, smoothstep(0.4, 0.6, f));
  col = mix(col, u_spec, smoothstep(0.6, 0.8, f));

  float v = 16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
  col *= mix(1.0, 0.5 + 0.5 * pow(max(0.0, v), 0.2), u_vignette);
  gl_FragColor = vec4(col, 1.0);
}`

export function liquidChrome(canvas, opts = {}) {
  const o = {
    base: [0.1, 0.1, 0.1], mid: [0.8, 0.8, 0.9], spec: [1, 1, 1],
    amplitude: 0.6, speed: 1, scale: 1, maxDpr: 2, vignette: 1,
    interactive: true, poster: null, ...opts,
  }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'low-power' })

  if (!gl) {
    if (o.poster) {
      canvas.style.background = `center / cover no-repeat url("${o.poster}")`
    }
    return { set() {}, destroy() {}, ok: false }
  }

  const compile = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
    return s
  }
  const prog = gl.createProgram()
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  gl.useProgram(prog)

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'position')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const u = {}
  for (const n of ['resolution', 'time', 'mouse', 'base', 'mid', 'spec', 'amplitude', 'vignette']) {
    u[n] = gl.getUniformLocation(prog, 'u_' + n)
  }

  const mouse = [0.5, 0.5]
  let raf = 0, visible = true, t0 = performance.now()

  const resize = () => {
    const r = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr) * o.scale
    canvas.width = Math.max(1, Math.round(r.width * dpr))
    canvas.height = Math.max(1, Math.round(r.height * dpr))
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(u.resolution, canvas.width, canvas.height)
    if (reduce) draw(0)
  }

  const draw = (now) => {
    gl.uniform1f(u.time, ((now - t0) / 1000) * o.speed)
    gl.uniform2f(u.mouse, mouse[0], mouse[1])
    gl.uniform3fv(u.base, o.base)
    gl.uniform3fv(u.mid, o.mid)
    gl.uniform3fv(u.spec, o.spec)
    gl.uniform1f(u.amplitude, o.amplitude)
    gl.uniform1f(u.vignette, o.vignette)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  const loop = (now) => {
    draw(now)
    raf = requestAnimationFrame(loop)
  }
  const start = () => { if (!raf && visible && !reduce && !document.hidden) raf = requestAnimationFrame(loop) }
  const stop = () => { cancelAnimationFrame(raf); raf = 0 }

  const onPointer = (e) => {
    if (!o.interactive) return
    const r = canvas.getBoundingClientRect()
    mouse[0] = (e.clientX - r.left) / r.width
    mouse[1] = 1 - (e.clientY - r.top) / r.height
  }
  const onVis = () => (document.hidden ? stop() : start())

  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop() })
  io.observe(canvas)
  window.addEventListener('pointermove', onPointer, { passive: true })
  document.addEventListener('visibilitychange', onVis)

  resize()
  if (reduce) draw(t0 + 4000)
  start()

  return {
    ok: true,
    set(next) { Object.assign(o, next); if (reduce) draw(t0 + 4000) },
    destroy() {
      stop(); ro.disconnect(); io.disconnect()
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVis)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
