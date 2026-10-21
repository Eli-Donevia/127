/*!
 * activity-rings.js — Apple Watch style progress rings in plain SVG + JS.
 *
 * Ported to vanilla JS for 127 HQ ("Today's rings") from Kokonut UI's
 * <AppleActivityCard> (React + Motion):
 *   https://github.com/kokonut-labs/kokonutui  components/kokonutui/apple-activity-card.tsx
 * Copyright (c) 2025 kokonutUI. MIT License (see LICENSE in this folder).
 *
 * Kept from the original: rings draw one after another (staggered), the count
 * runs on the same clock as the ring, a goal past 100% keeps drawing a second
 * lap on top led by a shadowed end cap, and a one-time pulse when the goal is hit.
 * 127 changes: no React/Motion/Tailwind; colours come from CSS custom properties
 * so the accent system controls them; draws when scrolled into view;
 * reduced motion paints the final state.
 *
 * Usage:
 *   <div class="rings" data-rings></div>
 *   import { activityRings } from './activity-rings.js'
 *   const r = activityRings(el, [
 *     { label: 'Ship', current: 3, target: 5, unit: 'tasks', color: '#7C8CFF', colorEnd: '#A9B4FF' },
 *     { label: 'Learn', current: 40, target: 30, unit: 'min', color: '#86D6AD', colorEnd: '#B4EBCD' },
 *   ], { size: 180, stroke: 14, gap: 4 })
 *   r.update([...])   // carries on from where each ring stands
 *
 * 127 Life: wrapped as a classic script (window.activityRings) for public/js/life. Licence: vendor/LICENSE-kokonutui.
 */
(function () {


const NS = 'http://www.w3.org/2000/svg'
const EASE = (t) => 1 - Math.pow(1 - t, 4) // close to cubic-bezier(.23,1,.32,1)
const STAGGER = 180
const DRAW = 1200
const OVER = 600
const MAX_LAPS = 3
let uid = 0

const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag)
  for (const k in attrs) n.setAttribute(k, attrs[k])
  return n
}
const ratioOf = (d) => (d.target > 0 ? Math.min(Math.max(d.current / d.target, 0), MAX_LAPS) : 0)

function activityRings(host, rings, opts = {}) {
  const size = opts.size ?? 180
  const stroke = opts.stroke ?? 14
  const gap = opts.gap ?? 4
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const id = ++uid

  host.classList.add('ar')
  host.innerHTML = ''
  const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'ar-svg', role: 'img' })
  const defs = el('defs')
  const shadow = el('filter', { id: `ar-sh-${id}`, x: '-50%', y: '-50%', width: '200%', height: '200%' })
  shadow.append(el('feDropShadow', { dx: 0, dy: 0, stdDeviation: 1.6, 'flood-color': '#000', 'flood-opacity': 0.55 }))
  defs.append(shadow)
  svg.append(defs)

  const legend = document.createElement('ul')
  legend.className = 'ar-legend'

  const state = rings.map((d, i) => {
    const r = size / 2 - stroke / 2 - i * (stroke + gap)
    const c = 2 * Math.PI * r
    const gid = `ar-g-${id}-${i}`
    const grad = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 1 })
    grad.append(el('stop', { offset: '0%', 'stop-color': d.color }), el('stop', { offset: '100%', 'stop-color': d.colorEnd || d.color }))
    defs.append(grad)

    const g = el('g', { transform: `rotate(-90 ${size / 2} ${size / 2})` })
    const track = el('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: d.color, 'stroke-opacity': 0.16, 'stroke-width': stroke })
    const base = el('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: `url(#${gid})`, 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-dasharray': c, 'stroke-dashoffset': c })
    const lap = el('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: d.colorEnd || d.color, 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-dasharray': c, 'stroke-dashoffset': c, opacity: 0 })
    // End cap that leads the overflow lap, with a shadow so the lap reads as "on top".
    const cap = el('g', { opacity: 0 })
    cap.style.transformOrigin = `${size / 2}px ${size / 2}px`
    cap.append(el('circle', { cx: size / 2 + r, cy: size / 2, r: stroke / 2, fill: d.colorEnd || d.color, filter: `url(#ar-sh-${id})` }))
    const pulse = el('circle', { cx: size / 2 + r, cy: size / 2, r: stroke / 2, fill: d.colorEnd || d.color, opacity: 0 })
    pulse.style.transformOrigin = `${size / 2 + r}px ${size / 2}px`
    g.append(track, base, lap, cap, pulse)
    svg.append(g)

    const li = document.createElement('li')
    li.style.setProperty('--ar-color', d.color)
    li.innerHTML = `<span class="ar-label"></span><span class="ar-val"><b class="ar-count">0</b><span class="ar-of"></span></span>`
    li.querySelector('.ar-label').textContent = d.label
    li.querySelector('.ar-of').textContent = `/${d.target} ${d.unit || ''}`.trimEnd()
    legend.append(li)

    return { d, c, base, lap, cap, pulse, count: li.querySelector('.ar-count'), shown: null, anim: 0 }
  })

  host.append(svg, legend)
  svg.setAttribute('aria-label', rings.map((d) => `${d.label}: ${d.current} of ${d.target} ${d.unit || ''}`).join(', '))

  function paint(s, p, ratio) {
    s.base.setAttribute('stroke-dashoffset', (1 - Math.min(p, 1)) * s.c)
    const over = p > 1
    const rest = over ? p - Math.floor(p) || 1 : 0
    s.lap.setAttribute('stroke-dashoffset', (1 - rest) * s.c)
    s.lap.setAttribute('opacity', over ? 1 : 0)
    s.cap.setAttribute('opacity', over ? 1 : 0)
    s.cap.style.transform = `rotate(${rest * 360}deg)`
    s.count.textContent = p >= ratio ? s.d.current : Math.round((p / (ratio || 1)) * s.d.current)
  }

  function run(s, i) {
    const ratio = ratioOf(s.d)
    cancelAnimationFrame(s.anim)
    if (reduce || ratio === 0) { paint(s, ratio, ratio); s.shown = ratio; return }
    const from = s.shown ?? 0
    const delay = s.shown === null ? i * STAGGER : 0
    const dur = DRAW + OVER * Math.min(Math.max(ratio - 1, 0), 1)
    let pulsed = from >= 1
    paint(s, from, ratio)
    const t0 = performance.now() + delay
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - t0) / dur))
      const p = from + (ratio - from) * EASE(t)
      s.shown = p
      paint(s, p, ratio)
      if (!pulsed && p >= 1) {
        pulsed = true
        s.pulse.animate?.([{ transform: 'scale(1)', opacity: 0.6 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.23,1,.32,1)' })
      }
      if (t < 1) s.anim = requestAnimationFrame(tick)
    }
    s.anim = requestAnimationFrame(tick)
  }

  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    io.disconnect()
    state.forEach(run)
  }, { threshold: 0.4 })
  io.observe(host)

  return {
    update(next) {
      next.forEach((d, i) => { if (state[i]) { state[i].d = { ...state[i].d, ...d }; run(state[i], i) } })
    },
    destroy() { io.disconnect(); state.forEach((s) => cancelAnimationFrame(s.anim)) },
  }
}

window.activityRings = activityRings
})();
