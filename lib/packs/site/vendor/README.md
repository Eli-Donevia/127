# vendor

`motion-sites.js` is a prepared bundle of Motion (https://motion.dev), MIT License, Copyright (c) 2024 Motion B.V.
(full text in `MOTION-LICENSE.md`). It exposes one global, `Motion`, with:

- `animate` from `motion/mini` (the small Web Animations API version, springs included via `type: Motion.spring`)
- `scroll`, `inView`, `stagger` and `spring` from `motion`

It is about 23 KB minified, about 9.5 KB gzip. The site pack's choreography layer (`lib/motion.js`, see
`lib/choreo.md`) inlines it into the pages of designs that declare `choreo`; nothing is fetched from a CDN.

How it was built: an esbuild bundle of `motion-entry.js` with `motion@13.5.1` installed, IIFE format, global name
`Motion`, minified, with the license line kept as the first line:

```
esbuild motion-entry.js --bundle --format=iife --global-name=Motion --minify --legal-comments=none \
  --banner:js="/*! Motion 13.5.1 (animate from motion/mini; scroll, inView, stagger, spring) | MIT License | Copyright (c) 2024 Motion B.V. | https://motion.dev */" \
  --outfile=motion-sites.js
```

To update it, rebuild the same way with the new version, keep the license line, and run `npm test`
(test/site-premium.test.js checks the bundle is the one the pages carry).
