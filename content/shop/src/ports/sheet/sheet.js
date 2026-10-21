/*!
 * sheet.js — draggable bottom sheet in plain JS + CSS (no React, no Radix).
 *
 * Behaviour follows Vaul by Emil Kowalski:
 *   https://github.com/emilkowalski/vaul  (src/index.tsx, src/use-snap-points.ts, src/style.css)
 * Copyright (c) 2023 Emil Kowalski. MIT License (see LICENSE in this folder).
 *
 * Kept from Vaul: drag the handle or the sheet to move it; release with enough
 * velocity or past the threshold to close; optional snap points; the page
 * behind scales back slightly (scale background); overscroll is damped; the
 * sheet only drags when its inner content is scrolled to the top.
 * 127 changes: vanilla DOM over a native <dialog> (free focus trap, Esc,
 * inert background), CSS custom properties for the scale effect.
 *
 * Usage (the Ask 127 phone sheet):
 *   <dialog class="sht" id="ask"><div class="sht-handle"></div><div class="sht-body">…</div></dialog>
 *   import { sheet } from './sheet.js'
 *   const s = sheet(document.getElementById('ask'), { snapPoints: [0.5, 1], scaleBackground: document.querySelector('.app') })
 *   s.open(); s.snapTo(1); s.close()
 */

const CLOSE_THRESHOLD = 0.25   // share of sheet height
const VELOCITY_THRESHOLD = 0.4 // px per ms
const EASE = 'cubic-bezier(.32,.72,0,1)'
const DUR = 500

export function sheet(dialog, opts = {}) {
  const snaps = (opts.snapPoints || [1]).slice().sort((a, b) => a - b) // share of sheet height visible
  const bg = opts.scaleBackground || null
  const body = dialog.querySelector('.sht-body') || dialog
  let y = 0, startY = 0, startT = 0, lastY = 0, lastT = 0, dragging = false, snap = snaps[snaps.length - 1]

  const h = () => dialog.getBoundingClientRect().height
  const offsetFor = (s) => (1 - s) * h()

  function setY(px, animate) {
    y = px
    dialog.style.transition = animate ? `transform ${DUR}ms ${EASE}` : 'none'
    dialog.style.transform = `translate3d(0, ${px}px, 0)`
    const shown = Math.max(0, Math.min(1, 1 - px / h()))
    dialog.style.setProperty('--sht-shown', shown)
    if (bg) {
      bg.style.transition = animate ? `transform ${DUR}ms ${EASE}, border-radius ${DUR}ms ${EASE}` : 'none'
      const k = shown
      bg.style.transform = `scale(${1 - 0.05 * k}) translate3d(0, ${14 * k}px, 0)`
      bg.style.borderRadius = `${12 * k}px`
      bg.style.transformOrigin = 'top center'
    }
  }

  function open() {
    if (!dialog.open) dialog.showModal()
    setY(h(), false)
    requestAnimationFrame(() => setY(offsetFor(snap = snaps[0]), true))
  }

  function close() {
    setY(h(), true)
    setTimeout(() => { if (dialog.open) dialog.close(); if (bg) bg.style.cssText += ';transform:;border-radius:' }, DUR)
  }

  function snapTo(s) { snap = s; setY(offsetFor(s), true) }

  const canDrag = (e) => e.target.closest('.sht-handle') || body.scrollTop <= 0

  dialog.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a, input, textarea, select, [contenteditable]')) return
    if (!canDrag(e)) return
    dragging = true
    startY = lastY = e.clientY
    startT = lastT = performance.now()
    dialog.setPointerCapture(e.pointerId)
  })

  dialog.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const base = offsetFor(snap)
    let next = base + (e.clientY - startY)
    // Damp pulling above the top snap point, as Vaul does.
    if (next < 0) next = -Math.sqrt(-next) * 4
    lastY = e.clientY
    lastT = performance.now()
    setY(next, false)
  })

  const end = (e) => {
    if (!dragging) return
    dragging = false
    const dt = Math.max(1, performance.now() - startT)
    const v = (e.clientY - startY) / dt
    const dragged = y - offsetFor(snap)
    if (v > VELOCITY_THRESHOLD || y > h() * (1 - snaps[0] + CLOSE_THRESHOLD)) return close()
    // Otherwise settle on the nearest snap point, nudged by velocity.
    const shown = 1 - y / h() - v * 0.15
    const nearest = snaps.reduce((a, b) => (Math.abs(b - shown) < Math.abs(a - shown) ? b : a))
    snapTo(Math.abs(dragged) < 4 ? snap : nearest)
  }
  dialog.addEventListener('pointerup', end)
  dialog.addEventListener('pointercancel', end)
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close() })
  dialog.addEventListener('click', (e) => { if (e.target === dialog && opts.dismissOnBackdrop !== false) close() })

  return { open, close, snapTo, get snap() { return snap } }
}
