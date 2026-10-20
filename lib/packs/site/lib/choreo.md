# Choreography: a design's motion as data

A site design that declares `choreo` gets its motion from one small settings block instead of hand-written animation
code. The shared runtime (`lib/choreo-client.js`, inlined by `lib/motion.js`) reads the block and drives the vendored
Motion bundle (`vendor/motion-sites.js`, MIT). A site brief can override the block field by field through
`site.build`'s `motion` input. Code can list every value: `require('./motion').CHOREO_PRESETS` (each value with what it
does) and `CHOREO_DEFAULTS`.

## The block, exactly as accepted

```js
{
  intro:  'assemble' | 'develop' | 'pour' | 'unfold' | 'type' | 'mask' | 'stamp' | 'draw' | 'none',
  alive:  ['drift' | 'pointer' | 'tap' | 'scroll', ...]  or  ['still'],
  scroll: 'scrub' | 'pin' | 'scene' | 'roadmap' | 'none',
  pace:   'calm' | 'medium' | 'fast',
  look:   'free words'
}
```

- Plain JSON data only, no functions. Every field is optional. Unknown keys are ignored.
- `intro`, `scroll`, `pace`: a string from the list. Anything else (a typo, a number, null) falls back.
- `alive`: an array of the listed strings (a single string is read as a one-item array). Unknown entries are dropped
  and repeats removed. `['still']` alone means no motion at rest; `still` next to another value is dropped. If nothing
  valid is left, it falls back.
- `pace`: the one speed knob. `calm` multiplies every duration by 1.3 (and softens the springs), `medium` by 1,
  `fast` by 0.78.
- `look`: any string, whitespace collapsed, cut at 200 characters, kept and passed through to the page's settings.
  The runtime does not use it yet. A non-string falls back.
- Nothing throws. Each field falls back to the design's own value, and the design's own value (if it is invalid or
  missing) falls back to the defaults: `{ intro: 'develop', alive: ['drift', 'pointer'], scroll: 'scrub', pace:
  'medium', look: '' }`.

### Where it comes from

1. The design module's `choreo` (for example `lib/templates/motion/beacon.js`) sets the design's own values.
2. A site brief's `motion` (the `motion` input of `site.build`, the `motion` option of `buildSite`) overrides it field
   by field: `resolveChoreo(design.choreo, brief.motion)`. A field the brief leaves out keeps the design's value.
3. A design without `choreo` ignores `motion`: its markup has no hooks for it.

`buildSite` returns the resolved block as `choreo`.

## Markup hooks (what each design puts in its HTML)

| Hook | What it marks |
|---|---|
| `data-ci="head"` | The headline. Its words (or letters) play the intro. A design that splits it itself marks the pieces `data-ci-part`. Screen readers get the plain text. |
| `data-ci="subject"` | The hero's main thing (a photo, the product, a card). It forms the intro's way. |
| `data-ci="then"` | What follows (lead, buttons, small facts). Arrives in page order once the idea has played, the way `data-ci-from` says: `rise` (default; `--ci-rise` sets how far), `mask` (wipes up from its baseline), `fade`, or `side`. |
| `data-pop` | On the head: its pop gesture. `line` draws a line in the member's colour under the last word (set below the descenders), `trail` lands the letters in that colour and cools them to their own, `line trail` both. Left off: no gesture, and the design shows its pop its own way. |
| `data-alive="1"` | Moves at rest on springs. The number is its strength (about 0.2 to 2). Put it on an element inside or around a `data-ci` one, not on the same element. |
| `data-sc` | The scroll moment's section. The runtime sets `--p` (0 to 1) on it and `--pi` and class `on` on each `data-sc-part`; `pin` also sets `cur` on the current part. `data-sc-stage` is the box that sticks (with it, progress is measured while the stage is stuck). `data-sc-line` scales with `--p` (scrub). |
| `data-rm` | A roadmap (`lib/templates/roadmap.js`): the member's steps, services, menu groups or options as nodes on a line ending at the page's button. Its line draws and its nodes pop in, in order, with the scroll; backwards when scrolling up. Plays for every `scroll` value except `none`. |
| `data-sx="0.3"` | A band that slides sideways with the page scroll (that share of the scroll; negative goes the other way). Replaces a looping marquee. |

Anything below the fold when the page opens plays its intro when it scrolls into view.

## Presets, one example each

### intro

- `assemble`: the headline's letters fly in from scattered places and lock together on a spring; the subject lands
  with a firm, settled landing. For trades and products being put together.
  `{ intro: 'assemble' }`
- `develop`: the subject develops like a photograph (blurred, grey and bright to sharp and full color); the words come
  into focus one by one. For people and portraits (coaches, photographers).
  `{ intro: 'develop' }`
- `pour`: the letters drop in left to right like something poured, settling as they land; the subject fills from the
  bottom up like a glass. For food and drink.
  `{ intro: 'pour' }`
- `unfold`: the words unfold up from their baseline like a turned page; the subject opens from its center. For
  editorial, studios, salons.
  `{ intro: 'unfold' }`
- `type`: the headline is typed out letter by letter with a caret; the subject wipes on from the left. For software,
  writing, digital products.
  `{ intro: 'type' }`
- `mask`: the words rise out of their own baseline as if from behind a rule; the subject is uncovered from the bottom
  up. For editorial and quiet confidence.
  `{ intro: 'mask' }`
- `stamp`: each word is pressed onto the page a beat apart, like type in a press; the subject is printed in with a
  flash of ink. For posters, tickets, labels.
  `{ intro: 'stamp' }`
- `draw`: the words settle from wide tracking while the subject's own line drawing draws itself (its SVG paths with
  `pathLength="1"`, or every path in it). For anything the design draws in line.
  `{ intro: 'draw' }`
- `none`: the hero is there at once.
  `{ intro: 'none' }`

Each intro plays for 1.2 to 2.4 s, then the page is fully usable. Phones get words instead of letters (except `type`)
and no blur.

### alive

- `drift`: drifts and breathes slowly on soft springs, a new resting place every few seconds.
  `{ alive: ['drift'] }`
- `pointer`: leans toward the pointer on a spring (mouse and trackpad only; phones skip it).
  `{ alive: ['pointer'] }`
- `tap`: a small, firm spring when tapped or clicked.
  `{ alive: ['tap'] }`
- `scroll`: lags and tilts a little with the scroll speed, then settles.
  `{ alive: ['scroll'] }`
- `still`: no motion at rest.
  `{ alive: ['still'] }`

Values combine: `{ alive: ['pointer', 'tap', 'drift'] }`. The loop starts after the page has loaded and the intro has
played, and stops off screen, in a hidden tab and on the Pause motion button.

### scroll

- `scrub`: the section's pieces move with the scroll, in order (each slides up from `--sy`, default 2.5rem, and across
  from `--sx`), and back when scrolling up.
  `{ scroll: 'scrub' }`
- `pin`: the section holds on screen while its pieces step through one by one (desktop with a mouse; phones and
  tablets get it unpinned, each piece lighting as it passes).
  `{ scroll: 'pin' }`
- `scene`: the section changes scene as it crosses the screen; each piece moves at its own `--depth` and turns by its
  `--turn`.
  `{ scroll: 'scene' }`
- `roadmap`: the design's roadmap (`data-rm`) is the one scroll moment; other `data-sc` sections stay still.
  `{ scroll: 'roadmap' }`
- `none`: no scroll moment (roadmaps show complete).
  `{ scroll: 'none' }`

### pace and look

`{ pace: 'calm', look: 'editorial, slow and soft' }`

## The pop: the member's colour as light

Every choreo page sets `--pop` to the member's own brand colour (`--primary-text`, which is their colour made safe to
read on the page) and uses it as light on the subject, one pop per view, never as a big flat fill or a glow behind
things:

- the head's gesture, if the design asks for one with `data-pop` (a colour trail as the letters land, a line drawn
  under the last word); each design picks its own, so the 18 don't share one signature;
- the roadmap's line draws in that colour with a comet riding its tip (a dot and a short trail that catches up on
  springs), and the current node fills with it;
- links underline in it on hover; buttons press in and spring back, barely past where they started (one spring per
  page, `bounce` 0.1, for every intro, the subject and the buttons);
- the `type` caret is that colour.

A headline blended into its own light (lumen) keeps its colour: its light is already the pop. 127's own colours are
never used on a member's page.

## A full block

```js
choreo: { intro: 'pour', alive: ['drift', 'tap'], scroll: 'scene', pace: 'medium', look: 'warm, generous, a little bounce' }
```

and a brief that changes only the pace and the intro:

```js
buildSite(ctx, { facts, template: 'supper', motion: { intro: 'develop', pace: 'calm' } })
// -> { intro: 'develop', alive: ['drift', 'tap'], scroll: 'scene', pace: 'calm', look: 'warm, generous, a little bounce' }
```

## What ships, and the rules it keeps

- Only pages of designs with `choreo` carry the bundle: `motion.js` beside `index.html` (loaded with `defer` from the
  head, cached a week by `_headers`) and `motion-LICENSE.txt`. The one-file preview inlines it. About 9.5 KB gzip for
  the bundle and 3.5 KB for the runtime.
- Why a separate deferred file rather than inline: the HTML stays about 23 KB smaller, so first paint is not waiting
  on it; it downloads in parallel with the HTML and is cached for the next page view.
- JavaScript off and reduced motion: nothing is hidden (the hidden first frames are behind `html.m`, which reduced
  motion never gets), and every section is complete and still. If the bundle never arrives, the intro's pieces show
  anyway after 2.6 s.
- Save-Data: no intro and no motion at rest.
