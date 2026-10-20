/*!
 * toast.js — stacked toasts in plain JS + CSS (no React).
 *
 * The behaviour and the stacking CSS math follow Sonner by Emil Kowalski:
 *   https://github.com/emilkowalski/sonner  (src/styles.css, src/index.tsx)
 * Copyright (c) 2023 Emil Kowalski. MIT License (see LICENSE-sonner.txt in this folder).
 *
 * What it does, as in Sonner: new toasts enter from the edge, older ones tuck
 * behind the front toast slightly smaller; hovering (or focusing) the stack
 * fans them out; timers pause while expanded or the tab is hidden; swipe down
 * (or sideways) to dismiss. 127 changes: vanilla DOM, max 3 visible,
 * aria-live region, tone colours from tokens (success uses Signal green only).
 *
 * Usage:
 *   import { toast } from './toast.js'
 *   toast('Saved to your Brain')
 *   toast.success('Site published', { description: '127group.io/s/acme', action: { label: 'Open', onClick } })
 *   const id = toast.loading('Building your site…'); later: toast.update(id, { type: 'success', title: 'Built' })
 */

const GAP = 14
const VISIBLE = 3
const DURATION = 4000
const SWIPE = 45

let root, list = [], seq = 0, expanded = false

function mount() {
  if (root) return
  root = document.createElement('ol')
  root.className = 'tst-root'
  root.setAttribute('aria-live', 'polite')
  root.setAttribute('aria-label', 'Notifications')
  root.addEventListener('pointerenter', () => setExpanded(true))
  root.addEventListener('pointerleave', () => setExpanded(false))
  root.addEventListener('focusin', () => setExpanded(true))
  root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) setExpanded(false) })
  document.addEventListener('visibilitychange', () => list.forEach((t) => (document.hidden ? pause(t) : resume(t))))
  document.body.append(root)
}

function setExpanded(v) {
  expanded = v
  root.dataset.expanded = v
  list.forEach((t) => (v ? pause(t) : resume(t)))
  layout()
}

function layout() {
  // Front toast is the newest. Each toast knows how many are in front of it
  // and the summed height of those, which drives the expanded offset.
  const live = list.filter((t) => !t.removed)
  const front = live[live.length - 1]
  let offset = 0
  for (let i = live.length - 1; i >= 0; i--) {
    const t = live[i]
    const before = live.length - 1 - i
    t.el.style.setProperty('--index', before)
    t.el.style.setProperty('--offset', offset + 'px')
    t.el.style.setProperty('--front-h', (front?.h || 0) + 'px')
    t.el.dataset.front = t === front
    t.el.dataset.hidden = before >= VISIBLE
    t.el.style.zIndex = 100 - before
    offset += t.h + GAP
  }
  root.style.setProperty('--stack-h', (expanded ? offset - GAP : (front?.h || 0) + Math.min(live.length - 1, VISIBLE - 1) * GAP) + 'px')
}

function pause(t) {
  if (!t.timer) return
  clearTimeout(t.timer); t.timer = 0
  t.left -= performance.now() - t.started
}
function resume(t) {
  if (t.timer || t.left === Infinity || t.removed || expanded || document.hidden) return
  t.started = performance.now()
  t.timer = setTimeout(() => dismiss(t.id), Math.max(t.left, 600))
}

function render(t) {
  const { el, opts } = t
  el.dataset.type = opts.type || 'default'
  el.innerHTML = `<span class="tst-icon" aria-hidden="true"></span><div class="tst-body"><p class="tst-title"></p><p class="tst-desc"></p></div>`
  el.querySelector('.tst-title').textContent = opts.title
  const desc = el.querySelector('.tst-desc')
  if (opts.description) desc.textContent = opts.description
  else desc.remove()
  if (opts.action) {
    const b = document.createElement('button')
    b.className = 'tst-action'
    b.textContent = opts.action.label
    b.onclick = (e) => { opts.action.onClick?.(e); dismiss(t.id) }
    el.append(b)
  }
}

function attachSwipe(t) {
  let x0 = 0, y0 = 0, dx = 0, dy = 0, down = false
  t.el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return
    down = true; x0 = e.clientX; y0 = e.clientY
    t.el.setPointerCapture(e.pointerId)
    t.el.dataset.swiping = true
  })
  t.el.addEventListener('pointermove', (e) => {
    if (!down) return
    dx = e.clientX - x0; dy = Math.max(0, e.clientY - y0)
    const horizontal = Math.abs(dx) > dy
    t.el.style.setProperty('--swipe-x', (horizontal ? dx : 0) + 'px')
    t.el.style.setProperty('--swipe-y', (horizontal ? 0 : dy) + 'px')
  })
  const end = () => {
    if (!down) return
    down = false
    t.el.dataset.swiping = false
    if (Math.abs(dx) > SWIPE || dy > SWIPE) {
      t.el.dataset.swipeOut = Math.abs(dx) > dy ? (dx > 0 ? 'right' : 'left') : 'down'
      dismiss(t.id)
    } else {
      t.el.style.setProperty('--swipe-x', '0px')
      t.el.style.setProperty('--swipe-y', '0px')
    }
    dx = dy = 0
  }
  t.el.addEventListener('pointerup', end)
  t.el.addEventListener('pointercancel', end)
}

export function toast(title, opts = {}) {
  mount()
  const t = { id: ++seq, opts: { title, ...opts }, removed: false, timer: 0 }
  t.left = opts.duration ?? (opts.type === 'loading' ? Infinity : DURATION)
  t.el = document.createElement('li')
  t.el.className = 'tst'
  t.el.tabIndex = 0
  t.el.dataset.mounted = false
  render(t)
  attachSwipe(t)
  root.append(t.el)
  t.h = t.el.getBoundingClientRect().height
  list.push(t)
  layout()
  requestAnimationFrame(() => { t.el.dataset.mounted = true })
  resume(t)
  return t.id
}

export function dismiss(id) {
  const t = list.find((x) => x.id === id)
  if (!t || t.removed) return
  t.removed = true
  clearTimeout(t.timer)
  t.el.dataset.removed = true
  layout()
  setTimeout(() => { t.el.remove(); list = list.filter((x) => x !== t); layout() }, 400)
}

toast.success = (title, o) => toast(title, { ...o, type: 'success' })
toast.error = (title, o) => toast(title, { ...o, type: 'error' })
toast.info = (title, o) => toast(title, { ...o, type: 'info' })
toast.loading = (title, o) => toast(title, { ...o, type: 'loading' })
toast.dismiss = dismiss
toast.update = (id, next) => {
  const t = list.find((x) => x.id === id)
  if (!t) return
  t.opts = { ...t.opts, ...next }
  render(t)
  t.h = t.el.getBoundingClientRect().height
  if (t.opts.type !== 'loading') { t.left = next.duration ?? DURATION; resume(t) }
  layout()
}
