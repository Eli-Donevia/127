/*!
 * particle-swarm.js — a swarm of points that forms text, an SVG or an image,
 * scatters from the cursor, and can be scrubbed by scroll. Canvas 2D, no deps.
 *
 * Built for 127 on the particle logic of Componentry's
 * <CursorDrivenParticleTypography> (React):
 *   https://github.com/harshjdhv/componentry
 *   packages/ui/src/components/cursor-driven-particle-typography.tsx
 * Copyright (c) 2026 Harsh Jadhav. MIT License (see LICENSE in this folder).
 *
 * The "form from nothing" idea is from particles.casberry.in (Casberry India),
 * which publishes no source or license, so none of its code is used here.
 *
 * 127 changes: no React; typed arrays (thousands of points at 60fps on phones);
 * a `progress` value (0 = scattered swarm, 1 = formed shape) that you can drive
 * from scroll; shapes from text, an SVG/PNG URL or any canvas; per-point colour
 * from the source image or a two-colour ramp; particle cap per viewport; pauses
 * offscreen; reduced motion shows the formed shape, still.
 *
 * Usage:
 *   import { particleSwarm } from './particle-swarm.js'
 *   const swarm = await particleSwarm(canvas, {
 *     source: { text: '127', font: '700 1px Geist, sans-serif' },
 *     // or source: { src: '/brand/127-mark-white.svg' }
 *     colors: ['#E3E6F1', '#7C8CFF'],   // halo -> Pop (accent on the subject only)
 *     density: 5, size: 1.4, progress: 0, auto: false,
 *   })
 *   window.addEventListener('scroll', () => swarm.progress(Math.min(1, scrollY / 600)))
 *   // or swarm.formIn(1400)  // animate 0 -> 1 over 1.4s
 */

const ease = (t) => 1 - Math.pow(1 - t, 3)

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

function hexToRgb(h) {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Rasterise the source into an offscreen canvas that fits the target box,
// then sample it on a grid. Returns { xs, ys, cols } in CSS pixels.
async function sample(source, w, h, density, fit) {
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const c = off.getContext('2d', { willReadFrequently: true })
  c.clearRect(0, 0, w, h)

  if (source.text) {
    if (document.fonts?.ready) await document.fonts.ready
    const base = source.font || '700 1px sans-serif'
    c.font = base.replace(/\b1px\b/, '100px')
    const m = c.measureText(source.text)
    const size = Math.floor(100 * Math.min((w * fit) / m.width, (h * fit) / 100))
    c.font = base.replace(/\b1px\b/, size + 'px')
    c.fillStyle = '#fff'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(source.text, w / 2, h / 2)
  } else {
    const img = source.canvas || (await loadImage(source.src))
    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    const s = Math.min((w * fit) / iw, (h * fit) / ih)
    c.drawImage(img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s)
  }

  const data = c.getImageData(0, 0, w, h).data
  const xs = [], ys = [], cols = []
  for (let y = 0; y < h; y += density) {
    for (let x = 0; x < w; x += density) {
      const i = (y * w + x) * 4
      if (data[i + 3] > 128) {
        xs.push(x)
        ys.push(y)
        cols.push([data[i], data[i + 1], data[i + 2]])
      }
    }
  }
  return { xs, ys, cols }
}

export async function particleSwarm(canvas, opts = {}) {
  const o = {
    source: { text: '127' },
    density: 5,            // grid step in CSS px; lower = more points
    size: 1.4,             // point radius in CSS px
    colors: null,          // [from, to] hex ramp, left to right; null = take colours from the source
    fit: 0.8,              // shape fills this share of the box
    scatter: 1.2,          // how far the swarm starts, as a share of the box
    radius: 110,           // cursor push radius (px)
    push: 14,              // cursor push strength
    spring: 0.07,          // pull back to the shape
    friction: 0.84,
    jitter: 0.7,           // 0 = exact grid, 1 = up to one grid step of offset
    maxPoints: matchMedia('(max-width: 768px)').matches ? 2200 : 6000,
    progress: 1,
    ...opts,
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const ctx = canvas.getContext('2d')
  let W = 0, H = 0, N = 0
  let ox, oy, sx, sy, x, y, vx, vy, col
  let prog = reduce ? 1 : o.progress
  let mx = -1e4, my = -1e4, raf = 0, visible = true, tween = null

  async function build() {
    const r = canvas.getBoundingClientRect()
    W = Math.max(1, Math.round(r.width))
    H = Math.max(1, Math.round(r.height))
    const dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let density = o.density
    let pts = await sample(o.source, W, H, density, o.fit)
    while (pts.xs.length > o.maxPoints) {
      density += 1
      pts = await sample(o.source, W, H, density, o.fit)
    }
    N = pts.xs.length
    // A little jitter off the sampling grid so the shape reads organic, not pixelated.
    const j = density * o.jitter
    ox = Float32Array.from(pts.xs, (v) => v + (Math.random() - 0.5) * j)
    oy = Float32Array.from(pts.ys, (v) => v + (Math.random() - 0.5) * j)
    sx = new Float32Array(N); sy = new Float32Array(N)
    x = new Float32Array(N); y = new Float32Array(N)
    vx = new Float32Array(N); vy = new Float32Array(N)
    col = new Array(N)

    const ramp = o.colors?.map(hexToRgb)
    for (let i = 0; i < N; i++) {
      // Scatter positions: a soft disc around the centre, biased outward.
      const a = Math.random() * Math.PI * 2
      const d = Math.sqrt(Math.random()) * Math.max(W, H) * 0.5 * o.scatter
      sx[i] = W / 2 + Math.cos(a) * d
      sy[i] = H / 2 + Math.sin(a) * d
      const c = ramp
        ? ramp[0].map((v, k) => Math.round(v + (ramp[1][k] - v) * (ox[i] / W)))
        : pts.cols[i]
      col[i] = `rgb(${c[0]},${c[1]},${c[2]})`
      x[i] = sx[i] + (ox[i] - sx[i]) * ease(prog)
      y[i] = sy[i] + (oy[i] - sy[i]) * ease(prog)
    }
    draw()
  }

  function step() {
    const k = ease(prog)
    const r2 = o.radius * o.radius
    for (let i = 0; i < N; i++) {
      const tx = sx[i] + (ox[i] - sx[i]) * k
      const ty = sy[i] + (oy[i] - sy[i]) * k
      const dx = mx - x[i], dy = my - y[i]
      const d2 = dx * dx + dy * dy
      if (d2 < r2) {
        const d = Math.sqrt(d2) || 1
        const f = ((o.radius - d) / o.radius) * o.push
        vx[i] -= (dx / d) * f * 0.1
        vy[i] -= (dy / d) * f * 0.1
      }
      vx[i] = (vx[i] + (tx - x[i]) * o.spring) * o.friction
      vy[i] = (vy[i] + (ty - y[i]) * o.spring) * o.friction
      x[i] += vx[i]
      y[i] += vy[i]
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H)
    const s = o.size, s2 = s * 2
    // Batch by colour: one fillStyle switch per run of equal colours.
    let last = ''
    for (let i = 0; i < N; i++) {
      if (col[i] !== last) { ctx.fillStyle = col[i]; last = col[i] }
      ctx.fillRect(x[i] - s, y[i] - s, s2, s2)
    }
  }

  function loop(now) {
    if (tween) {
      const t = Math.min(1, (now - tween.t0) / tween.ms)
      prog = tween.from + (tween.to - tween.from) * t
      if (t >= 1) tween = null
    }
    step()
    draw()
    raf = requestAnimationFrame(loop)
  }
  const start = () => { if (!raf && !reduce && visible && !document.hidden) raf = requestAnimationFrame(loop) }
  const stop = () => { cancelAnimationFrame(raf); raf = 0 }

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect()
    mx = e.clientX - r.left
    my = e.clientY - r.top
  }
  const onLeave = () => { mx = my = -1e4 }
  const onVis = () => (document.hidden ? stop() : start())

  canvas.style.touchAction = 'pan-y'
  canvas.addEventListener('pointermove', onMove, { passive: true })
  canvas.addEventListener('pointerleave', onLeave)
  canvas.addEventListener('pointerup', onLeave)
  document.addEventListener('visibilitychange', onVis)
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop() })
  io.observe(canvas)
  let rt = 0
  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(build, 120) })
  ro.observe(canvas)

  await build()
  start()

  return {
    get count() { return N },
    /** Set formation 0..1 directly (e.g. from scroll). */
    progress(p) { tween = null; prog = reduce ? 1 : Math.max(0, Math.min(1, p)); if (reduce) draw() },
    /** Animate formation to `to` over `ms`. */
    formIn(ms = 1400, to = 1) { if (reduce) return; tween = { from: prog, to, ms, t0: performance.now() } },
    async setSource(source) { o.source = source; await build() },
    destroy() {
      stop(); io.disconnect(); ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerup', onLeave)
      document.removeEventListener('visibilitychange', onVis)
    },
  }
}
